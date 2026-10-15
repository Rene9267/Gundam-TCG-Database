/**
 * Backend simulato (GoTrue + PostgREST cards) per sviluppo locale.
 * Nessun Docker: in-memory + persistenza su .mock-data.json.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.MOCK_SUPABASE_PORT || 54321);
const HOST = '127.0.0.1';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, '.mock-data.json');
const DEMO_EMAIL = 'demo@local.test';
const DEMO_PASSWORD = 'localdev1';
const ACCESS_TTL_SEC = 3600;

const store = loadStore();

function loadStore() {
  try {
    const raw = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    return {
      users: raw.users || [],
      cards: raw.cards || [],
      sessions: raw.sessions || [],
    };
  } catch {
    return { users: [], cards: [], sessions: [] };
  }
}

function saveStore() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function ensureDemoUser() {
  if (store.users.some((u) => u.email === DEMO_EMAIL)) return;
  store.users.push({
    id: crypto.randomUUID(),
    email: DEMO_EMAIL,
    password: DEMO_PASSWORD,
    user_metadata: { nickname: 'Demo' },
  });
  saveStore();
}

function b64url(obj) {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function makeJwt(user) {
  const header = { alg: 'none', typ: 'JWT' };
  const payload = {
    sub: user.id,
    email: user.email,
    role: 'authenticated',
    exp: Math.floor(Date.now() / 1000) + ACCESS_TTL_SEC,
  };
  return `${b64url(header)}.${b64url(payload)}.sim`;
}

function publicUser(user) {
  return {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {},
    aud: 'authenticated',
    role: 'authenticated',
  };
}

function issueSession(user) {
  const access_token = makeJwt(user);
  const refresh_token = crypto.randomBytes(24).toString('hex');
  store.sessions = store.sessions.filter((s) => s.userId !== user.id);
  store.sessions.push({
    access_token,
    refresh_token,
    userId: user.id,
    expires_at: Date.now() + ACCESS_TTL_SEC * 1000,
  });
  saveStore();
  return {
    access_token,
    token_type: 'bearer',
    expires_in: ACCESS_TTL_SEC,
    refresh_token,
    user: publicUser(user),
  };
}

function getSession(req) {
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  return store.sessions.find((s) => s.access_token === token) || null;
}

function userFromSession(session) {
  if (!session) return null;
  return store.users.find((u) => u.id === session.userId) || null;
}

function send(res, status, body, extraHeaders = {}) {
  const payload = body == null ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, x-client-info',
    'Content-Type': 'application/json',
    ...extraHeaders,
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid json'));
      }
    });
    req.on('error', reject);
  });
}

function parseEqFilters(searchParams) {
  const filters = {};
  for (const [key, value] of searchParams.entries()) {
    if (key === 'select' || key === 'order') continue;
    if (typeof value === 'string' && value.startsWith('eq.')) {
      filters[key] = value.slice(3);
    }
  }
  return filters;
}

function matchCard(card, filters) {
  return Object.entries(filters).every(([k, v]) => String(card[k]) === String(v));
}

async function handleAuth(req, res, url) {
  const p = url.pathname;
  const grant = url.searchParams.get('grant_type');

  if (req.method === 'GET' && p === '/auth/v1/health') {
    return send(res, 200, { name: 'GoTrue', version: 'simulated' });
  }

  if (req.method === 'POST' && p === '/auth/v1/signup') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || password.length < 6) {
      return send(res, 400, { error: 'invalid_request', msg: 'Password should be at least 6 characters' });
    }
    if (store.users.some((u) => u.email === email)) {
      return send(res, 400, { error: 'user_already_exists', msg: 'User already registered' });
    }
    const user = {
      id: crypto.randomUUID(),
      email,
      password,
      user_metadata: body.data || {},
    };
    store.users.push(user);
    saveStore();
    return send(res, 200, issueSession(user));
  }

  if (req.method === 'POST' && p === '/auth/v1/token' && grant === 'password') {
    const body = await readBody(req);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    const user = store.users.find((u) => u.email === email && u.password === password);
    if (!user) {
      return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid login credentials' });
    }
    return send(res, 200, issueSession(user));
  }

  if (req.method === 'POST' && p === '/auth/v1/token' && grant === 'refresh_token') {
    const body = await readBody(req);
    const session = store.sessions.find((s) => s.refresh_token === body.refresh_token);
    const user = userFromSession(session);
    if (!user) {
      return send(res, 401, { error: 'invalid_grant', msg: 'Invalid refresh token' });
    }
    return send(res, 200, issueSession(user));
  }

  if (req.method === 'POST' && p === '/auth/v1/recover') {
    return send(res, 200, {});
  }

  if (req.method === 'POST' && p === '/auth/v1/logout') {
    const session = getSession(req);
    if (session) {
      store.sessions = store.sessions.filter((s) => s.access_token !== session.access_token);
      saveStore();
    }
    return send(res, 204, '');
  }

  if (p === '/auth/v1/user') {
    const session = getSession(req);
    const user = userFromSession(session);
    if (!user) return send(res, 401, { error: 'invalid_token', msg: 'Invalid token' });
    if (req.method === 'GET') return send(res, 200, publicUser(user));
    if (req.method === 'PUT') {
      const body = await readBody(req);
      if (body.password) {
        if (String(body.password).length < 6) {
          return send(res, 400, { msg: 'Password should be at least 6 characters' });
        }
        user.password = String(body.password);
      }
      if (body.data && typeof body.data === 'object') {
        user.user_metadata = { ...(user.user_metadata || {}), ...body.data };
      }
      saveStore();
      return send(res, 200, publicUser(user));
    }
  }

  return send(res, 404, { error: 'not_found', msg: 'Auth route not simulated: ' + p });
}

async function handleCards(req, res, url) {
  const session = getSession(req);
  const user = userFromSession(session);
  if (!user) return send(res, 401, { message: 'JWT expired' });

  const filters = parseEqFilters(url.searchParams);
  if (req.method === 'GET') {
    let rows = store.cards.filter((c) => matchCard(c, filters));
    const order = url.searchParams.get('order');
    if (order === 'updated_at.desc') {
      rows = rows.slice().sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)));
    }
    return send(res, 200, rows);
  }

  if (req.method === 'POST') {
    const body = await readBody(req);
    const card = {
      id: crypto.randomUUID(),
      user_id: body.user_id || user.id,
      card_code: body.card_code,
      card_name: body.card_name,
      set_name: body.set_name,
      quantity: body.quantity ?? 1,
      rarity: body.rarity,
      updated_at: body.updated_at || new Date().toISOString(),
    };
    const dup = store.cards.some(
      (c) => c.user_id === card.user_id && c.card_code === card.card_code
    );
    if (dup) {
      return send(res, 409, { message: 'duplicate key value violates unique constraint' });
    }
    store.cards.push(card);
    saveStore();
    return send(res, 201, [card]);
  }

  if (req.method === 'PATCH') {
    const body = await readBody(req);
    const card = store.cards.find((c) => matchCard(c, filters));
    if (!card) return send(res, 404, { message: 'not found' });
    Object.assign(card, body, { id: card.id, user_id: card.user_id });
    saveStore();
    return send(res, 200, [card]);
  }

  if (req.method === 'DELETE') {
    const before = store.cards.length;
    store.cards = store.cards.filter((c) => !matchCard(c, filters));
    if (store.cards.length === before) return send(res, 404, { message: 'not found' });
    saveStore();
    return send(res, 204, '');
  }

  return send(res, 405, { message: 'method not allowed' });
}

function syntheticCardtraderListings(blueprintId) {
  const id = parseInt(blueprintId, 10) || 0;
  const base = 150 + (id % 500);
  return [
    { price: { cents: base, currency: 'EUR' } },
    { price: { cents: base + 80, currency: 'EUR' } },
    { price: { cents: base + 120, currency: 'EUR' } },
  ];
}

async function handleCardtrader(req, res, url) {
  const session = getSession(req);
  if (!userFromSession(session)) return send(res, 401, { error: 'Unauthorized' });
  const blueprintId = url.searchParams.get('blueprint_id') || '0';

  const apiKey = process.env.CARDTRADER_API_KEY;
  if (apiKey) {
    try {
      const ctRes = await fetch(
        `https://api.cardtrader.com/api/v2/marketplace/products?blueprint_id=${blueprintId}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
      );
      const body = await ctRes.json();
      return send(res, ctRes.ok ? 200 : ctRes.status, body);
    } catch {
      // fall through to synthetic listings
    }
  }

  return send(res, 200, { [blueprintId]: syntheticCardtraderListings(blueprintId) });
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    return send(res, 204, '');
  }
  try {
    const url = new URL(req.url, `http://${HOST}:${PORT}`);
    if (url.pathname.startsWith('/auth/v1/')) return await handleAuth(req, res, url);
    if (url.pathname === '/rest/v1/cards') return await handleCards(req, res, url);
    if (url.pathname === '/functions/v1/cardtrader-proxy') return await handleCardtrader(req, res, url);
    if (url.pathname === '/' || url.pathname === '/auth/v1/health') {
      return send(res, 200, { status: 'ok', mode: 'simulated' });
    }
    send(res, 404, { error: 'not_found', path: url.pathname });
  } catch (err) {
    send(res, 500, { error: 'server_error', msg: String(err && err.message) });
  }
});

ensureDemoUser();
server.listen(PORT, HOST, () => {
  console.log(`Backend simulato: http://${HOST}:${PORT}`);
  console.log(`Utente demo: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
});

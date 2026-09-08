import { test } from 'node:test';
import assert from 'node:assert/strict';

const SUPABASE_URL = 'https://example.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_test';

function parseAuthResponse(text, status) {
  const trimmed = (text || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    throw new Error('Risposta non valida dal server (' + status + ')');
  }
}

function buildAuthUrl(path, query = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') qs.set(key, value);
  }
  const queryString = qs.toString();
  if (!queryString) return SUPABASE_URL + path;
  const sep = path.includes('?') ? '&' : '?';
  return SUPABASE_URL + path + sep + queryString;
}

async function authFetch(path, body, query = {}) {
  const r = await fetch(buildAuthUrl(path, query), {
    method: 'POST',
    headers: { apikey: SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = parseAuthResponse(await r.text(), r.status);
  if (!r.ok) {
    throw new Error(data.msg || data.error_description || data.error || data.message || 'Errore');
  }
  return data;
}

test('authFetch recover uses redirect_to query and accepts empty JSON body', async () => {
  let capturedUrl = '';
  let capturedBody = '';
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    capturedUrl = String(url);
    capturedBody = init.body || '';
    return {
      ok: true,
      status: 200,
      text: async () => '{}',
    };
  };

  try {
    const data = await authFetch(
      '/auth/v1/recover',
      { email: 'user@example.com' },
      { redirect_to: 'http://localhost:3456' }
    );
    assert.deepEqual(data, {});
    assert.equal(
      capturedUrl,
      'https://example.supabase.co/auth/v1/recover?redirect_to=http%3A%2F%2Flocalhost%3A3456'
    );
    assert.equal(capturedBody, JSON.stringify({ email: 'user@example.com' }));
    assert.ok(!capturedBody.includes('redirect_to'));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('authFetch maps invalid credentials without network toast', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false,
    status: 400,
    text: async () => JSON.stringify({ error: 'invalid login credentials' }),
  });

  try {
    await assert.rejects(
      () => authFetch('/auth/v1/token?grant_type=password', { email: 'a@b.c', password: 'wrong' }),
      (err) => err.message === 'invalid login credentials'
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

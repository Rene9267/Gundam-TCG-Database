import { test } from 'node:test';
import assert from 'node:assert/strict';
import { productPriceCents, parseCardtraderMarketplace } from '../scripts/lib/cardtrader-prices.mjs';

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function mapAuthError(err) {
  const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Email o password errata.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Questa email è già registrata. Prova ad accedere.';
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'Email non ancora confermata. Controlla la tua casella di posta.';
  }
  if (msg.includes('user not found')) {
    return 'Credenziali non valide.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak password')) {
    return 'La password deve avere almeno 6 caratteri.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  }
  if (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid'))) {
    return 'Sessione scaduta o non valida. Riprova.';
  }
  if (msg.includes('refresh') && msg.includes('token')) {
    return 'Sessione scaduta. Effettua di nuovo il login.';
  }
  if (msg.includes('error sending email') || msg.includes('email sending')) {
    return 'Errore nell\'invio dell\'email. Riprova più tardi.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Errore di rete. Controlla la connessione.';
  }
  return 'Si è verificato un errore. Riprova.';
}

function parseAuthResponse(text, status) {
  const trimmed = (text || '').trim();
  if (!trimmed) return {};
  try {
    return JSON.parse(trimmed);
  } catch (_) {
    throw new Error('Risposta non valida dal server (' + status + ')');
  }
}

function buildAuthUrl(baseUrl, path, query = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value != null && value !== '') qs.set(key, value);
  }
  const queryString = qs.toString();
  if (!queryString) return baseUrl + path;
  const sep = path.includes('?') ? '&' : '?';
  return baseUrl + path + sep + queryString;
}

const isTokenOrResource = (code) => code.startsWith('T-') || code.startsWith('R-') || code.startsWith('EXR-');

function classifyCardVariant(rc, cardAltInfo = {}) {
  const isRT = isTokenOrResource(rc.card_code);
  if (isRT) {
    if (/_p\d+$/.test(rc.card_code)) return 'altart';
    return 'resource';
  }
  const info = cardAltInfo[rc.card_code];
  if (info && info.isAltArt) return 'altart';
  if (rc.card_code.includes('_p') || rc.card_code.split('-')[0] !== rc.set_code) return 'altart';
  return 'base';
}

test('escapeHtml escapes HTML special characters', () => {
  assert.equal(escapeHtml('<script>"x"</script>'), '&lt;script&gt;&quot;x&quot;&lt;/script&gt;');
  assert.equal(escapeHtml(null), '');
});

test('mapAuthError maps known Supabase errors', () => {
  assert.equal(mapAuthError({ message: 'Invalid login credentials' }), 'Email o password errata.');
  assert.equal(mapAuthError({ message: 'User already registered' }), 'Questa email è già registrata. Prova ad accedere.');
  assert.equal(mapAuthError({ message: 'unknown' }), 'Si è verificato un errore. Riprova.');
});

test('mapAuthError maps network failures to Italian message', () => {
  assert.equal(mapAuthError({ message: 'Failed to fetch' }), 'Errore di rete. Controlla la connessione.');
  assert.equal(mapAuthError({ message: 'NetworkError when attempting to fetch resource.' }), 'Errore di rete. Controlla la connessione.');
});

test('parseAuthResponse handles empty and JSON bodies', () => {
  assert.deepEqual(parseAuthResponse('', 200), {});
  assert.deepEqual(parseAuthResponse('  ', 200), {});
  assert.deepEqual(parseAuthResponse('{"ok":true}', 200), { ok: true });
});

test('parseAuthResponse throws on non-JSON body', () => {
  assert.throws(
    () => parseAuthResponse('<html>error</html>', 502),
    /Risposta non valida dal server \(502\)/
  );
});

test('buildAuthUrl appends redirect_to as query string', () => {
  const base = 'https://example.supabase.co';
  assert.equal(
    buildAuthUrl(base, '/auth/v1/recover', { redirect_to: 'https://app.example.com' }),
    'https://example.supabase.co/auth/v1/recover?redirect_to=https%3A%2F%2Fapp.example.com'
  );
  assert.equal(
    buildAuthUrl(base, '/auth/v1/token?grant_type=refresh_token', { foo: 'bar' }),
    'https://example.supabase.co/auth/v1/token?grant_type=refresh_token&foo=bar'
  );
});

test('classifyCardVariant identifies base, alt art, and resources', () => {
  const altInfo = { 'GD02-001': { isAltArt: true } };
  assert.equal(classifyCardVariant({ card_code: 'GD01-001', set_code: 'GD01' }, altInfo), 'base');
  assert.equal(classifyCardVariant({ card_code: 'GD01-001_p1', set_code: 'GD01' }, altInfo), 'altart');
  assert.equal(classifyCardVariant({ card_code: 'T-001', set_code: 'GD01' }, altInfo), 'resource');
  assert.equal(classifyCardVariant({ card_code: 'R-002_p1', set_code: 'GD01' }, altInfo), 'altart');
  assert.equal(classifyCardVariant({ card_code: 'GD02-001', set_code: 'GD02' }, altInfo), 'altart');
});

test('cardBaseId strips variant suffix', () => {
  const cardBaseId = (code) => code.replace(/_(?:p\d+|beta|reprint|event|stp|winner|championship|other\d*)$/i, '');
  assert.equal(cardBaseId('GD01-001_p2'), 'GD01-001');
  assert.equal(cardBaseId('GD01-001'), 'GD01-001');
  assert.equal(cardBaseId('GD01-005_beta'), 'GD01-005');
});

test('productPriceCents reads nested price object', () => {
  assert.deepEqual(productPriceCents({
    price: { cents: 250, currency: 'EUR' },
  }), { cents: 250, currency: 'EUR' });
});

test('productPriceCents reads flat price_cents field', () => {
  assert.deepEqual(productPriceCents({
    price_cents: 199,
    price_currency: 'USD',
  }), { cents: 199, currency: 'USD' });
});

test('productPriceCents returns null when price is missing', () => {
  assert.equal(productPriceCents({}), null);
  assert.equal(productPriceCents(null), null);
});

test('parseCardtraderMarketplace aggregates min and average', () => {
  const json = {
    396535: [
      { price: { cents: 100, currency: 'EUR' } },
      { price: { cents: 300, currency: 'EUR' } },
      { price_cents: 200, price_currency: 'EUR' },
    ],
  };
  assert.deepEqual(parseCardtraderMarketplace(json, 396535), {
    minPrice: 1,
    avgPrice: 2,
    currency: 'EUR',
    listings: 3,
  });
});

test('parseCardtraderMarketplace returns null for empty listings', () => {
  assert.equal(parseCardtraderMarketplace({ 396535: [] }, 396535), null);
  assert.equal(parseCardtraderMarketplace({}, 396535), null);
});

test('parseCardtraderMarketplace skips products without price', () => {
  const json = {
    351184: [{ description: 'no price' }, { price: { cents: 50, currency: 'EUR' } }],
  };
  assert.deepEqual(parseCardtraderMarketplace(json, 351184), {
    minPrice: 0.5,
    avgPrice: 0.5,
    currency: 'EUR',
    listings: 1,
  });
});

const CT_PROXY_URL = SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/cardtrader-proxy';
const _ctCache = {};

async function fetchCardtraderPrices(blueprintId) {
  if (!blueprintId) return null;
  if (!accessToken) return null;
  const key = String(blueprintId);
  const cached = _ctCache[key];
  if (cached && Date.now() - cached.ts < 120_000) return cached.data;
  try {
    const res = await _ctFetch(blueprintId, accessToken);
    if (res.status === 401) {
      // Token scaduto: tenta refresh una sola volta e ritenta.
      try { await refreshUserSession(); } catch (_) { return null; }
      if (!accessToken) return null;
      const retry = await _ctFetch(blueprintId, accessToken);
      if (!retry.ok) return null;
      return _ctParse(retry, key);
    }
    if (!res.ok) return null;
    return _ctParse(res, key);
  } catch {
    return null;
  }
}

async function _ctFetch(blueprintId, token) {
  return fetch(`${CT_PROXY_URL}?blueprint_id=${encodeURIComponent(blueprintId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

function _ctParse(res, key) {
  return res.json().then(json => {
    const products = json[key];
    if (!products || !products.length) {
      _ctCache[key] = { ts: Date.now(), data: null };
      return null;
    }
    const centsArr = products.map(p => p.price.cents);
    const minCents = Math.min(...centsArr);
    const avgCents = Math.round(centsArr.reduce((a, b) => a + b, 0) / centsArr.length);
    const currency = products[0].price.currency || 'EUR';
    const result = { minPrice: minCents / 100, avgPrice: avgCents / 100, currency, listings: products.length };
    _ctCache[key] = { ts: Date.now(), data: result };
    return result;
  }).catch(() => null);
}

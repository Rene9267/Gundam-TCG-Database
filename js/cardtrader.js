const CT_PROXY_URL = SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/cardtrader-proxy';
const _ctCache = {};

function productPriceCents(product) {
  if (!product || typeof product !== 'object') return null;
  if (product.price && typeof product.price.cents === 'number') {
    return { cents: product.price.cents, currency: product.price.currency || 'EUR' };
  }
  if (typeof product.price_cents === 'number') {
    return { cents: product.price_cents, currency: product.price_currency || 'EUR' };
  }
  return null;
}

function parseCardtraderMarketplace(json, blueprintId) {
  const key = String(blueprintId);
  const products = json && json[key];
  if (!Array.isArray(products) || !products.length) return null;

  const priced = products.map(productPriceCents).filter(Boolean);
  if (!priced.length) return null;

  const centsArr = priced.map((p) => p.cents);
  const minCents = Math.min(...centsArr);
  const avgCents = Math.round(centsArr.reduce((a, b) => a + b, 0) / centsArr.length);
  const currency = priced[0].currency || 'EUR';

  return {
    minPrice: minCents / 100,
    avgPrice: avgCents / 100,
    currency,
    listings: priced.length,
  };
}

async function fetchCardtraderPrices(blueprintId) {
  if (!blueprintId) return { status: 'no_id' };
  if (!accessToken) return { status: 'unauthenticated' };

  const key = String(blueprintId);
  const cached = _ctCache[key];
  if (cached && Date.now() - cached.ts < 120_000) return cached.data;

  try {
    let res = await _ctFetch(blueprintId, accessToken);
    if (res.status === 401) {
      try { await refreshUserSession(); } catch (_) { return { status: 'error' }; }
      if (!accessToken) return { status: 'unauthenticated' };
      res = await _ctFetch(blueprintId, accessToken);
    }
    if (!res.ok) return { status: 'error' };
    return _ctParse(res, key);
  } catch {
    return { status: 'error' };
  }
}

async function _ctFetch(blueprintId, token) {
  const params = new URLSearchParams({
    blueprint_id: String(blueprintId),
    apikey: SUPABASE_ANON_KEY,
  });
  return fetch(`${CT_PROXY_URL}?${params}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function _ctParse(res, key) {
  return res.json().then((json) => {
    const prices = parseCardtraderMarketplace(json, key);
    if (prices) {
      const data = { status: 'ok', ...prices };
      _ctCache[key] = { ts: Date.now(), data };
      return data;
    }
    const data = { status: 'no_listings' };
    _ctCache[key] = { ts: Date.now(), data };
    return data;
  }).catch(() => ({ status: 'error' }));
}

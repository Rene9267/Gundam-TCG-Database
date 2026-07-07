const CT_PROXY_URL = SUPABASE_URL.replace(/\/+$/, '') + '/functions/v1/cardtrader-proxy';
const _ctCache = {};

async function fetchCardtraderPrices(blueprintId) {
  if (!blueprintId) return null;
  const key = String(blueprintId);
  const cached = _ctCache[key];
  if (cached && Date.now() - cached.ts < 120_000) return cached.data;
  try {
    const res = await fetch(`${CT_PROXY_URL}?blueprint_id=${blueprintId}`);
    if (!res.ok) return null;
    const json = await res.json();
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
  } catch {
    return null;
  }
}

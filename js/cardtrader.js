const CT_API_BASE = 'https://api.cardtrader.com/api/v2';
const _ctCache = {};

async function fetchCardtraderPrices(blueprintId) {
  if (!blueprintId) return null;
  const key = String(blueprintId);
  const cached = _ctCache[key];
  if (cached && Date.now() - cached.ts < 120_000) return cached.data;
  if (!CARDTRADER_API_KEY) return null;
  try {
    const res = await fetch(`${CT_API_BASE}/marketplace/products?blueprint_id=${blueprintId}`, {
      headers: { Authorization: `Bearer ${CARDTRADER_API_KEY}` },
    });
    if (!res.ok) {
      if (res.status === 429) console.warn('[cardtrader] rate limited');
      return null;
    }
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

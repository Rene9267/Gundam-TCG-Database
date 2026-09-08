/**
 * Pure CardTrader marketplace price parsing (shared by tests and browser via cardtrader.js).
 */

export function productPriceCents(product) {
  if (!product || typeof product !== 'object') return null;
  if (product.price && typeof product.price.cents === 'number') {
    return { cents: product.price.cents, currency: product.price.currency || 'EUR' };
  }
  if (typeof product.price_cents === 'number') {
    return { cents: product.price_cents, currency: product.price_currency || 'EUR' };
  }
  return null;
}

export function parseCardtraderMarketplace(json, blueprintId) {
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

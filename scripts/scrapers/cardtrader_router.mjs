import https from 'https';
import {
  computeSetSlug,
  computeCardSlug,
  computeVariantSlug,
  buildCardtraderUrl,
  buildCardtraderSearchUrl,
} from './url_builder.mjs';

const REQUEST_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
const RATE_LIMIT_MS = 1000;

function fetchFollowRedirect(url, redirects = 0) {
  if (redirects > MAX_REDIRECTS) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: REQUEST_TIMEOUT,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://www.cardtrader.com${res.headers.location}`;
        res.resume();
        fetchFollowRedirect(loc, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode === 404 || res.statusCode >= 400) {
        res.resume();
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => resolve(data));
    });
    req.on('error', () => resolve(null));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function extractBlueprintId(html) {
  const match = html.match(/<meta\s+property="og:url"\s+content="[^"]*\/cards\/(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)/i);
  return match ? match[1].trim() : null;
}

export async function resolveCardtraderSlug(slug, lang = 'en') {
  const url = buildCardtraderUrl(slug, lang);
  const html = await fetchFollowRedirect(url);
  if (!html) return { slug, url, found: false, blueprintId: null, title: null };
  return {
    slug,
    url,
    found: true,
    blueprintId: extractBlueprintId(html),
    title: extractTitle(html),
  };
}

export async function resolveCardtraderSearch(cardCode, lang = 'en') {
  const url = buildCardtraderSearchUrl(cardCode, lang);
  const html = await fetchFollowRedirect(url);
  return { cardCode, url, found: !!html };
}

export async function resolveCard(name, rarity, setName, setCode, lang = 'en') {
  const setSlug = computeSetSlug(setCode, setName);
  const baseSlug = computeCardSlug(name, setSlug);
  const variantSlug = computeVariantSlug(name, rarity, setSlug);

  let baseResult = null;
  let variantResult = null;

  if (baseSlug !== variantSlug) {
    baseResult = await resolveCardtraderSlug(baseSlug, lang);
    await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
  }

  variantResult = await resolveCardtraderSlug(variantSlug, lang);
  await new Promise(r => setTimeout(r, RATE_LIMIT_MS));

  return {
    name,
    rarity,
    setSlug,
    baseSlug,
    variantSlug,
    baseResult,
    variantResult,
    bestSlug: baseResult?.found ? baseSlug : variantSlug,
    bestId: baseResult?.blueprintId || variantResult?.blueprintId || null,
  };
}

export async function resolveCardBatch(cards, setName, setCode, lang = 'en', onProgress = null) {
  const setSlug = computeSetSlug(setCode, setName);
  const groups = {};
  for (const card of cards) {
    const key = `${card.card_name}||${(card.rarity || '').toLowerCase()}`;
    if (!groups[key]) {
      groups[key] = { name: card.card_name, rarity: (card.rarity || '').toLowerCase(), slug: setSlug };
    }
  }

  const results = {};
  const entries = Object.entries(groups);
  for (let i = 0; i < entries.length; i++) {
    const [key, group] = entries[i];
    const result = await resolveCard(group.name, group.rarity, setName, setCode, lang);
    results[key] = result;
    if (onProgress) onProgress(i + 1, entries.length, group.name, result);
  }
  return results;
}

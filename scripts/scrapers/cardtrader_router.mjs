import https from 'https';
import {
  computeSetSlug,
  computeCardSlug,
  computeVariantSlug,
  buildCardtraderUrl,
  buildCardtraderSearchUrl,
} from './url_builder.mjs';
import {
  parseVersionSelectOptions,
  extractCtRarityFromHtml,
  extractSlugFromHtml,
  buildPrintingsFromVersions,
} from './cardtrader_printings.mjs';

const REQUEST_TIMEOUT = 15000;
const MAX_REDIRECTS = 5;
const RATE_LIMIT_MS = 1000;
const VERSION_FETCH_MS = 250;

function fetchFollowRedirect(url, redirects = 0) {
  if (redirects > MAX_REDIRECTS) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: REQUEST_TIMEOUT,
    }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://www.cardtrader.com${res.headers.location}`;
        res.resume();
        fetchFollowRedirect(loc, redirects + 1).then(resolve);
        return;
      }
      if (res.statusCode === 404 || res.statusCode >= 400) {
        res.resume();
        resolve(null);
        return;
      }
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function fetchCardtraderPage(urlOrSlug, lang = 'en') {
  const url = urlOrSlug.startsWith('http')
    ? urlOrSlug
    : buildCardtraderUrl(urlOrSlug, lang);
  const html = await fetchFollowRedirect(url);
  if (!html) return null;
  return {
    html,
    blueprintId: extractBlueprintId(html),
    slug: extractSlugFromHtml(html),
    ctRarity: extractCtRarityFromHtml(html),
    title: extractTitle(html),
    versions: parseVersionSelectOptions(html),
  };
}

export async function resolveCardtraderSlug(slug, lang = 'en') {
  const page = await fetchCardtraderPage(slug, lang);
  if (!page) return { slug, url: buildCardtraderUrl(slug, lang), found: false, blueprintId: null, title: null };
  return {
    slug,
    url: buildCardtraderUrl(slug, lang),
    found: true,
    blueprintId: page.blueprintId,
    title: page.title,
    versions: page.versions,
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
    await sleep(RATE_LIMIT_MS);
  }

  variantResult = await resolveCardtraderSlug(variantSlug, lang);
  await sleep(RATE_LIMIT_MS);

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

export async function resolveCardVersions(baseCard, lang = 'en') {
  let entrySlug = baseCard.cardtrader_slug;
  let entryId = baseCard.cardtrader_id;

  if (!entrySlug && !entryId) {
    const setSlug = computeSetSlug(baseCard.set_code, baseCard.set_name);
    const guesses = [
      computeCardSlug(baseCard.card_name, setSlug),
      computeVariantSlug(baseCard.card_name, baseCard.rarity, setSlug),
    ];
    for (const slug of guesses) {
      const probe = await fetchCardtraderPage(slug, lang);
      await sleep(RATE_LIMIT_MS);
      if (probe?.blueprintId) {
        entrySlug = probe.slug || slug;
        entryId = probe.blueprintId;
        break;
      }
    }
  }

  const entryUrl = entryId
    ? `https://www.cardtrader.com/${lang}/cards/${entryId}`
    : buildCardtraderUrl(entrySlug, lang);

  const page = await fetchCardtraderPage(entryUrl, lang);
  if (!page) {
    return { printings: [], found: false };
  }

  let versions = page.versions;
  if (!versions.length && page.blueprintId) {
    versions = [{
      cardtrader_id: page.blueprintId,
      expansion: baseCard.set_name.replace(/\[.*?\]$/, '').trim(),
      collector_number: baseCard.card_code,
    }];
  }

  const ctRarityById = {};
  const slugById = {};
  if (page.blueprintId) {
    ctRarityById[page.blueprintId] = page.ctRarity;
    slugById[page.blueprintId] = page.slug || String(page.blueprintId);
  }

  const missing = versions.filter((v) => !ctRarityById[v.cardtrader_id] || !slugById[v.cardtrader_id]);
  for (const v of missing) {
    const detail = await fetchCardtraderPage(`https://www.cardtrader.com/${lang}/cards/${v.cardtrader_id}`, lang);
    await sleep(VERSION_FETCH_MS);
    if (!detail) continue;
    ctRarityById[v.cardtrader_id] = detail.ctRarity;
    slugById[v.cardtrader_id] = detail.slug || String(v.cardtrader_id);
  }

  const printings = buildPrintingsFromVersions({
    versions,
    baseCard,
    ctRarityById,
    slugById,
  });

  return { printings, found: printings.length > 0 };
}

export async function resolveCardBatch(cards, setName, setCode, lang = 'en', onProgress = null) {
  const baseCards = cards.filter((c) => !/_p\d+$/.test(c.card_code));
  const results = {};
  for (let i = 0; i < baseCards.length; i++) {
    const card = baseCards[i];
    const result = await resolveCardVersions(card, lang);
    results[card.card_code] = result;
    if (onProgress) onProgress(i + 1, baseCards.length, card.card_name, result);
    await sleep(RATE_LIMIT_MS);
  }
  return results;
}

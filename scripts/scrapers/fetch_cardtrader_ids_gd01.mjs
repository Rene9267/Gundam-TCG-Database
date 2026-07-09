import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_SET = 'GD01';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()',]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isVariantCode(code) {
  return /_p\d+$/.test(code);
}

function computeSetSlug(setCode, setName) {
  const codeSlug = setCode.toLowerCase().slice(0, 2) + '-' + setCode.toLowerCase().slice(2);
  const namePart = setName.replace(/\[.*?\]$/, '').trim();
  const nameSlug = slugify(namePart);
  return `${codeSlug}-${nameSlug}`;
}

function fetchFollowRedirect(url, redirects = 0) {
  if (redirects > 5) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const req = https.get(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
      timeout: 15000,
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
    req.on('error', (err) => reject(err));
    req.on('timeout', () => { req.destroy(); resolve(null); });
  });
}

function extractBlueprintId(html) {
  const match = html.match(/<meta\s+property="og:url"\s+content="[^"]*\/cards\/(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

async function main() {
  const refPath = path.join(__dirname, '..', '..', 'reference_cards.json');
  const refCards = JSON.parse(fs.readFileSync(refPath, 'utf-8'));

  const setCards = refCards.filter(c => c.set_code === TARGET_SET);
  const setName = setCards[0].set_name;
  const setSlug = computeSetSlug(TARGET_SET, setName);

  const groups = {};
  for (const card of setCards) {
    const key = `${card.card_name}||${(card.rarity || '').toLowerCase()}`;
    if (!groups[key]) {
      groups[key] = { name: card.card_name, rarity: (card.rarity || '').toLowerCase(), slug: setSlug };
    }
  }

  console.log(`\n=== ${TARGET_SET}: ${setName} (${setCards.length} cards, ${Object.keys(groups).length} unique name+rarity combos) ===\n`);

  const results = {};
  for (const [key, group] of Object.entries(groups)) {
    const { name, rarity } = group;
    const baseSlug = `${slugify(name)}-${setSlug}`;
    const variantSlug = rarity ? `${slugify(name)}-${rarity}-${setSlug}` : baseSlug;

    let baseId = null;
    let variantId = null;

    const baseUrl = `https://www.cardtrader.com/en/cards/${baseSlug}`;
    const variantUrl = `https://www.cardtrader.com/en/cards/${variantSlug}`;

    if (baseSlug !== variantSlug) {
      const html = await fetchFollowRedirect(baseUrl);
      if (html) {
        baseId = extractBlueprintId(html);
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    const html = await fetchFollowRedirect(variantUrl);
    if (html) {
      variantId = extractBlueprintId(html);
    }
    await new Promise(r => setTimeout(r, 1000));

    const baseLabel = baseId ? `id=${baseId}` : 'NOT FOUND';
    const variantLabel = variantId ? `id=${variantId}` : 'NOT FOUND';
    console.log(`  ${name.padEnd(50)} base→${baseLabel}  variant→${variantLabel}`);

    results[key] = { baseSlug, baseId, variantSlug, variantId };
  }

  let updated = 0;
  for (const card of setCards) {
    const key = `${card.card_name}||${(card.rarity || '').toLowerCase()}`;
    const result = results[key];
    if (!result) continue;

    const isVariant = isVariantCode(card.card_code);

    if (isVariant) {
      card.cardtrader_slug = result.variantSlug;
      card.cardtrader_id = result.variantId || result.baseId;
    } else {
      card.cardtrader_slug = result.baseId ? result.baseSlug : result.variantSlug;
      card.cardtrader_id = result.baseId || result.variantId;
    }
    updated++;
  }

  fs.writeFileSync(refPath, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log(`\n  → Updated ${updated}/${setCards.length} cards in set ${TARGET_SET}`);
  console.log('Done! reference_cards.json updated with GD01 CardTrader IDs.');
}

main().catch(console.error);

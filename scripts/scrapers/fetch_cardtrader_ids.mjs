import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ST01_SLUG = 'st-01-heroic-beginnings';

// Correct rarities per card name for ST01
const CARD_RARITIES = {
  'Gundam': 'lr',
  'Gundam (MA Form)': 'c',
  'Guncannon': 'c',
  'Guntank': 'c',
  'GM': 'c',
  'Gundam Aerial (Permet Score Six)': 'lr',
  'Gundam Aerial (Bit on Form)': 'c',
  'Demi Trainer': 'c',
  'Zowort': 'c',
  'Amuro Ray': 'c',
  'Suletta Mercury': 'c',
  'Thoroughly Damaged': 'c',
  "Kai's Resolve": 'c',
  'Unforeseen Incident': 'c',
  'White Base': 'c',
  'Asticassia School of Technology, Earth House': 'c',
};

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()',]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSlug(name, rarity) {
  return `${slugify(name)}-${rarity}-${ST01_SLUG}`;
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

function extractTitle(html) {
  const match = html.match(/<title>([^<]+)/i);
  return match ? match[1].trim() : null;
}

async function main() {
  const refPath = path.join(__dirname, 'reference_cards.json');
  const refCards = JSON.parse(fs.readFileSync(refPath, 'utf-8'));

  const st01Cards = refCards.filter(c => c.set_code === 'ST01');
  const uniqueNames = [...new Set(st01Cards.map(c => c.card_name))];

  console.log(`Mapping ${uniqueNames.length} unique ST01 cards with correct rarities...\n`);

  const results = {};
  for (const name of uniqueNames) {
    const rarity = CARD_RARITIES[name];
    if (!rarity) {
      console.log(`  ✗ No rarity defined for: ${name}`);
      continue;
    }
    const slug = buildSlug(name, rarity);
    const url = `https://www.cardtrader.com/en/cards/${slug}`;
    const html = await fetchFollowRedirect(url);
    if (html) {
      const id = extractBlueprintId(html);
      const title = extractTitle(html);
      if (id) {
        console.log(`  ✓ ${name.padEnd(50)} → id=${id}, rarity=${rarity}`);
        results[name] = { slug, blueprint_id: id, rarity };
      } else {
        console.log(`  ✗ ${name} → page loaded but no ID found`);
      }
    } else {
      console.log(`  ✗ ${name} → NOT FOUND (slug: ${slug})`);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  const outPath = path.join(__dirname, 'cardtrader_st01_mapping.json');
  fs.writeFileSync(outPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`\nDone! Mapped: ${Object.keys(results).length}/${uniqueNames.length}`);
  
  // Now update reference_cards.json
  let updated = 0;
  for (const card of refCards) {
    if (card.set_code === 'ST01' && results[card.card_name]) {
      card.cardtrader_slug = results[card.card_name].slug;
      card.cardtrader_id = results[card.card_name].blueprint_id;
      updated++;
    }
  }
  
  fs.writeFileSync(refPath, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log(`Updated ${updated} cards in reference_cards.json with CardTrader IDs`);
}

main().catch(console.error);

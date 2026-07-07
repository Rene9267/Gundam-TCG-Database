const https = require('https');
const fs = require('fs');
const path = require('path');

const CARDS_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) { reject(new Error('HTTP ' + res.statusCode)); return; }
      let d = ''; res.on('data', (c) => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

function baseCodeOf(code) {
  return code.replace(/_[a-z0-9]+$/i, '');
}

async function fetchRarity(cardCode) {
  const url = `https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=${cardCode}`;
  const html = await fetch(url);
  const m = html.match(/<div\s+class="rarity">\s*[\r\n]*\s*([\w\s+\-]+?)\s*[\r\n]*\s*<\/div>/);
  return m ? m[1].trim() : null;
}

async function main() {
  const cards = JSON.parse(fs.readFileSync(CARDS_PATH, 'utf-8'));
  console.log('Total cards:', cards.length);

  const baseCodes = [...new Set(cards.map(c => baseCodeOf(c.card_code)))];
  console.log('Unique base codes:', baseCodes.length);

  const rarityCache = {};
  const MAX = 3;
  let idx = 0;

  async function worker() {
    while (idx < baseCodes.length) {
      const code = baseCodes[idx++];
      if (rarityCache[code]) continue;
      try {
        const rarity = await fetchRarity(code);
        rarityCache[code] = rarity || null;
        process.stdout.write(`  ${idx}/${baseCodes.length}: ${code} -> ${rarity || '-'}\r`);
      } catch (e) {
        rarityCache[code] = null;
        process.stdout.write(`  ${idx}/${baseCodes.length}: ${code} FAILED\r`);
      }
    }
  }

  await Promise.all(Array.from({ length: MAX }, () => worker()));
  console.log('\nFetched rarity for', Object.keys(rarityCache).length, 'cards');

  // Propagate to all variants
  let count = 0;
  for (const card of cards) {
    const base = baseCodeOf(card.card_code);
    if (rarityCache[base] != null && !card.rarity) {
      card.rarity = rarityCache[base];
      count++;
    }
  }
  console.log('Updated', count, 'cards with rarity');

  fs.writeFileSync(CARDS_PATH, JSON.stringify(cards, null, 2), 'utf-8');
  console.log('Saved to', CARDS_PATH);
}

main().catch(console.error);

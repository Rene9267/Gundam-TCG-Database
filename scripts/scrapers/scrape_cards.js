// ============================================================
// Scraper — Estrae tutte le carte Gundam TCG dal sito ufficiale
// e produce un file JSON (reference_cards.json) pronto per
// essere importato in Supabase (tabelle reference_cards).
//
// Uso: node scrape_cards.js
// ============================================================
const https = require('https');
const fs = require('fs');
const path = require('path');

// === Configurazione ===
const SETS = [
  { packageId: '616001', setCode: 'ST01', setName: 'Heroic Beginnings' },
  { packageId: '616002', setCode: 'ST02', setName: 'Wings of Advance' },
  { packageId: '616003', setCode: 'ST03', setName: "Zeon's Rush" },
  { packageId: '616004', setCode: 'ST04', setName: 'SEED Strike' },
  { packageId: '616005', setCode: 'ST05', setName: 'Iron Bloom' },
  { packageId: '616006', setCode: 'ST06', setName: 'Clan Unity' },
  { packageId: '616007', setCode: 'ST07', setName: 'Celestial Drive' },
  { packageId: '616008', setCode: 'ST08', setName: 'Flash of Radiance' },
  { packageId: '616009', setCode: 'ST09', setName: 'Destiny Ignition' },
  { packageId: '616010', setCode: 'ST10', setName: 'Generation Pulse' },
  { packageId: '616101', setCode: 'GD01', setName: 'Newtype Rising' },
  { packageId: '616102', setCode: 'GD02', setName: 'Dual Impact' },
  { packageId: '616103', setCode: 'GD03', setName: 'Steel Requiem' },
  { packageId: '616104', setCode: 'GD04', setName: 'Phantom Aria' },
  { packageId: '616201', setCode: 'EB01', setName: 'Eternal Nexus' },
];

const IMAGE_BASE = 'https://www.gundam-gcg.com/en/images/cards/card';

// === Utility ===
function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function extractCards(html, setCode, setName) {
  const cards = [];

  // Pattern: <a ... data-src="detail.php?detailSearch=CODE" ... >
  //          <img ... data-src="../images/cards/card/CODE.webp... " alt="NAME">
  // Usiamo regex per estrarre le coppie (card_code, card_name)
  const itemRegex = /<a[^>]*?data-src\s*=\s*"detail\.php\?detailSearch=([^"]+)"[^>]*>[\s\S]*?<img[^>]*?alt\s*=\s*"((?:[^"\\]|\\.)*)"/gi;

  let match;
  while ((match = itemRegex.exec(html)) !== null) {
    const cardCode = match[1].trim();
    const cardName = match[2].trim();
    const imageUrl = `${IMAGE_BASE}/${cardCode}.webp`;

    cards.push({
      card_code: cardCode,
      card_name: cardName,
      set_code: setCode,
      set_name: `${setName} [${setCode}]`,
      image_url: imageUrl,
    });
  }

  return cards;
}

// === Main ===
async function main() {
  const allCards = [];

  for (const set of SETS) {
    const url = `https://www.gundam-gcg.com/en/cards/?package=${set.packageId}`;
    console.log(`Fetching ${set.setCode} (${set.setName})...`);

    try {
      const html = await fetch(url);
      const cards = extractCards(html, set.setCode, set.setName);
      console.log(`  → Found ${cards.length} cards`);
      allCards.push(...cards);

      // Rispetta il server — pausa tra le richieste
      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  → ERROR: ${err.message}`);
    }
  }

  // Salva JSON
  const outputPath = path.join(__dirname, '..', '..', 'reference_cards.json');
  fs.writeFileSync(outputPath, JSON.stringify(allCards, null, 2), 'utf-8');
  console.log(`\nDone! ${allCards.length} total cards saved to reference_cards.json`);
}

main().catch(console.error);

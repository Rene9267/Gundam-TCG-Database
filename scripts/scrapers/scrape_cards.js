// ============================================================
// Scraper — Estrae tutte le carte Gundam TCG dal sito ufficiale
// e produce un file JSON (reference_cards.json) pronto per
// essere importato in Supabase (tabelle reference_cards).
//
// Supporta campi: card_code, card_name, set_code, set_name,
// image_url, cardtrader_slug, cardtrader_id, rarity,
// card_type, color, level, cost
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

function parseDetailField(html, label) {
  const regex = new RegExp(label + '\\s*<[^>]*>([^<]+)', 'i');
  const m = html.match(regex);
  return m ? m[1].trim() : null;
}

function parseDetailTable(html) {
  // Formats seen:
  //   Lv.\n4\nCOST\n3\nCOLOR\nBlue\nTYPE\nUNIT
  //   <td>Lv.</td><td>4</td> etc.
  // Try inline text pattern first
  const result = { color: null, card_type: null, level: null, cost: null, rarity: null };

  // Rarity: appears after card code line, before the availability number
  // Pattern: "ST01-001</td>\n<td>LR +</td>"
  const rarityRegex = /<\/td>\s*<td>([A-Z]+(?:\s*\+\s*)?)<\/td>/;
  const rm = html.match(rarityRegex);
  if (rm) result.rarity = rm[1].trim();

  // Level
  const lvMatch = html.match(/Lv\.?\s*<\/[^>]*>\s*<[^>]*>\s*(\d+)/i);
  if (lvMatch) result.level = parseInt(lvMatch[1]);

  // Cost
  const costMatch = html.match(/COST\s*<\/[^>]*>\s*<[^>]*>\s*(\d+)/i);
  if (costMatch) result.cost = parseInt(costMatch[1]);

  // Color
  const colorMatch = html.match(/COLOR\s*<\/[^>]*>\s*<[^>]*>\s*(\w+)/i);
  if (colorMatch) result.color = colorMatch[1];

  // Type
  const typeMatch = html.match(/TYPE\s*<\/[^>]*>\s*<[^>]*>\s*(\w+(?:\s+\w+)?)/i);
  if (typeMatch) result.card_type = typeMatch[1].toUpperCase();

  return result;
}

async function fetchCardDetail(cardCode) {
  const url = `https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=${cardCode}`;
  try {
    const html = await fetch(url);
    return parseDetailTable(html);
  } catch (err) {
    console.error(`    Detail fetch failed for ${cardCode}: ${err.message}`);
    return {};
  }
}

function isVariantCode(code) {
  return /_[a-z0-9]+$/i.test(code);
}

function baseCodeOf(code) {
  return code.replace(/_[a-z0-9]+$/i, '');
}

function normalizeType(raw) {
  const map = {
    'UNIT': 'Unit',
    'PILOT': 'Pilot',
    'COMMAND': 'Command',
    'BASE': 'Base',
    'RESOURCE': 'Resource',
    'EX BASE': 'ExBase',
    'EX RESOURCE': 'ExResource',
    'UNIT TOKEN': 'Token',
  };
  return map[raw] || raw;
}

function normalizeColor(raw) {
  if (!raw) return null;
  const c = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return c;
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

      await new Promise((r) => setTimeout(r, 1000));
    } catch (err) {
      console.error(`  → ERROR: ${err.message}`);
    }
  }

  // Preserva campi extra da file esistente
  const outputPath = path.join(__dirname, '..', '..', 'reference_cards.json');
  let existing = {};
  try {
    existing = JSON.parse(fs.readFileSync(outputPath, 'utf-8')).reduce((m, c) => {
      m[c.card_code + '|' + c.set_code] = c;
      return m;
    }, {});
  } catch (_) {}

  // Fetch card details for ST01 (per evitare saturazione)
  console.log('\nFetching card details for ST01...');
  const st01Cards = allCards.filter(c => c.set_code === 'ST01');
  const detailCache = {};

  for (const card of st01Cards) {
    const baseCode = baseCodeOf(card.card_code);
    if (detailCache[baseCode]) continue;

    console.log(`  Detail: ${baseCode}`);
    const detail = await fetchCardDetail(baseCode);
    detailCache[baseCode] = detail;
    await new Promise((r) => setTimeout(r, 500));
  }

  // Propaga dettagli alle varianti
  for (const card of allCards) {
    const key = card.card_code + '|' + card.set_code;
    const prev = existing[key];

    // Mantieni campi esistenti
    if (prev) {
      card.cardtrader_slug = prev.cardtrader_slug || card.cardtrader_slug;
      card.cardtrader_id = prev.cardtrader_id || card.cardtrader_id;
    }

    // Applica dettagli dalla cache (ST01)
    const baseCode = baseCodeOf(card.card_code);
    const detail = detailCache[baseCode];
    if (detail) {
      card.rarity = detail.rarity || card.rarity;
      card.color = normalizeColor(detail.color) || card.color;
      card.card_type = normalizeType(detail.card_type) || card.card_type;
      card.level = detail.level != null ? detail.level : card.level;
      card.cost = detail.cost != null ? detail.cost : card.cost;
    }
  }

  fs.writeFileSync(outputPath, JSON.stringify(allCards, null, 2), 'utf-8');
  console.log(`\nDone! ${allCards.length} total cards saved to reference_cards.json`);
}

main().catch(console.error);
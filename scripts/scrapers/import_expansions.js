/**
 * Importa nuove espansioni in reference_cards.json senza riscrapare tutto il catalogo.
 *
 * Uso: node scripts/scrapers/import_expansions.js
 */
const https = require('https');
const fs = require('fs');
const path = require('path');

const REF_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');

const PACKAGE_SETS = [
  { packageId: '616105', setCode: 'GD05', setName: 'Freedom Ascension' },
];

const CODE_SETS = [
  {
    setCode: 'PC01A',
    setName: 'Premium Card Collection GUNDAM ASSEMBLE Set -Mobile Suit Gundam IRON-BLOODED ORPHANS-',
    cardCodes: [
      'ST05-001_p2', 'ST05-007_p2', 'GD03-060_p1', 'GD03-117_p1',
      'T-015_p1', 'T-016_p1', 'T-017_p1',
    ],
  },
  {
    setCode: 'PC02A',
    setName: 'Premium Card Collection GUNDAM ASSEMBLE Set -Mobile Suit Gundam GQuuuuuuX-',
    cardCodes: [
      'ST06-001_p2', 'ST06-005_p2', 'GD03-106_p1',
      'T-018_p1', 'T-019_p1', 'T-020_p1',
    ],
  },
];

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
    cards.push({
      card_code: match[1].trim(),
      card_name: match[2].trim(),
      set_code: setCode,
      set_name: `${setName} [${setCode}]`,
    });
  }
  return cards;
}

function parseDetailTable(html) {
  const result = { color: null, card_type: null, level: null, cost: null, rarity: null };
  const rarityMatch = html.match(/<div\s+class="rarity">\s*([\s\S]*?)<\/div>/i);
  if (rarityMatch) result.rarity = rarityMatch[1].replace(/\s+/g, ' ').trim();

  const lvMatch = html.match(/<dt[^>]*>Lv\.?\s*<\/dt>\s*<dd[^>]*>\s*(\d+)\s*<\/dd>/i);
  if (lvMatch) result.level = parseInt(lvMatch[1], 10);

  const costMatch = html.match(/<dt[^>]*>COST\s*<\/dt>\s*<dd[^>]*>\s*(\d+)\s*<\/dd>/i);
  if (costMatch) result.cost = parseInt(costMatch[1], 10);

  const colorMatch = html.match(/<dt[^>]*>COLOR\s*<\/dt>\s*<dd[^>]*>\s*(\w+)\s*<\/dd>/i);
  if (colorMatch) result.color = colorMatch[1];

  const typeMatch = html.match(/<dt[^>]*>TYPE\s*<\/dt>\s*<dd[^>]*>\s*([^<]+?)<\/dd>/i);
  if (typeMatch) result.card_type = typeMatch[1].trim().toUpperCase();

  return result;
}

function normalizeType(raw) {
  const map = {
    UNIT: 'Unit', PILOT: 'Pilot', COMMAND: 'Command', BASE: 'Base',
    RESOURCE: 'Resource', 'EX BASE': 'ExBase', 'EX RESOURCE': 'ExResource',
    'UNIT TOKEN': 'Token',
  };
  return map[raw] || raw;
}

function normalizeColor(raw) {
  if (!raw) return null;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

function baseCodeOf(code) {
  return code.replace(/_[a-z0-9]+$/i, '');
}

async function fetchCardDetail(cardCode) {
  const url = `https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=${encodeURIComponent(cardCode)}`;
  const html = await fetch(url);
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/i);
  const detail = parseDetailTable(html);
  return {
    card_name: nameMatch ? nameMatch[1].trim() : cardCode,
    rarity: detail.rarity,
    color: normalizeColor(detail.color),
    card_type: normalizeType(detail.card_type),
    level: detail.level,
    cost: detail.cost,
  };
}

async function loadPackageSet(set) {
  const url = `https://www.gundam-gcg.com/en/cards/?package=${set.packageId}`;
  console.log(`Fetching package ${set.setCode} (${set.packageId})...`);
  const html = await fetch(url);
  const cards = extractCards(html, set.setCode, set.setName);
  console.log(`  → ${cards.length} cards`);
  return cards;
}

async function loadCodeSet(set) {
  console.log(`Loading ${set.setCode} (${set.cardCodes.length} known codes)...`);
  return set.cardCodes.map(card_code => ({
    card_code,
    card_name: card_code,
    set_code: set.setCode,
    set_name: `${set.setName} [${set.setCode}]`,
  }));
}

async function enrichNewCards(cards, existing) {
  const detailCache = {};
  const bases = [...new Set(cards.map(c => baseCodeOf(c.card_code)))];
  let idx = 0;

  async function fetchNext() {
    while (idx < bases.length) {
      const code = bases[idx++];
      if (detailCache[code]) continue;
      try {
        process.stdout.write(`  Detail ${idx}/${bases.length}: ${code}\r`);
        detailCache[code] = await fetchCardDetail(code);
        await new Promise(r => setTimeout(r, 150));
      } catch (err) {
        console.error(`\n  Failed ${code}: ${err.message}`);
        detailCache[code] = {};
      }
    }
  }

  await Promise.all(Array.from({ length: 3 }, () => fetchNext()));
  console.log(`\n  Fetched details for ${Object.keys(detailCache).length} base cards`);

  for (const card of cards) {
    const key = card.card_code + '|' + card.set_code;
    const prev = existing[key];
    if (prev) {
      card.cardtrader_slug = prev.cardtrader_slug;
      card.cardtrader_id = prev.cardtrader_id;
      card.printings = prev.printings;
    }

    const base = baseCodeOf(card.card_code);
    const detail = detailCache[base] || {};
    if (detail.card_name) card.card_name = detail.card_name;
    card.rarity = detail.rarity || card.rarity;
    card.color = detail.color || card.color;
    card.card_type = detail.card_type || card.card_type;
    card.level = detail.level != null ? detail.level : card.level;
    card.cost = detail.cost != null ? detail.cost : card.cost;
  }
}

async function main() {
  let refCards = [];
  try {
    refCards = JSON.parse(fs.readFileSync(REF_PATH, 'utf-8'));
  } catch (_) {}

  const existing = refCards.reduce((m, c) => {
    m[c.card_code + '|' + c.set_code] = c;
    return m;
  }, {});

  const incoming = [];
  for (const set of PACKAGE_SETS) {
    incoming.push(...await loadPackageSet(set));
    await new Promise(r => setTimeout(r, 500));
  }
  for (const set of CODE_SETS) {
    incoming.push(...await loadCodeSet(set));
  }

  const newCards = incoming.filter(c => !existing[c.card_code + '|' + c.set_code]);

  refCards = refCards.filter(c => !PACKAGE_SETS.some(s => s.setCode === c.set_code));
  const kept = refCards.filter(c => !incoming.some(n => n.card_code === c.card_code && n.set_code === c.set_code));

  console.log(`\nEnriching ${incoming.length} cards (${newCards.length} new)...`);
  await enrichNewCards(incoming, existing);

  refCards = [...kept, ...incoming].sort((a, b) => {
    const setCmp = a.set_code.localeCompare(b.set_code);
    return setCmp !== 0 ? setCmp : a.card_code.localeCompare(b.card_code);
  });

  fs.writeFileSync(REF_PATH, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log(`\nDone! ${refCards.length} total cards in reference_cards.json`);
  for (const set of [...PACKAGE_SETS, ...CODE_SETS]) {
    const count = refCards.filter(c => c.set_code === set.setCode).length;
    console.log(`  ${set.setCode}: ${count} cards`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseDetail(html, cardCode) {
  const nameMatch = html.match(/<h1[^>]*>([^<]+)/i) || html.match(/<title>([^<|]+)/i);
  const card_name = nameMatch ? nameMatch[1].trim() : cardCode;
  const sourceMatch = html.match(/Where to get it[\s\S]*?<dd[^>]*>([^<]+)/i);
  const source = sourceMatch ? sourceMatch[1].trim() : null;
  if (!source) return null;

  const rarityMatch = html.match(/<div\s+class="rarity">\s*([\s\S]*?)<\/div>/i);
  const rarity = rarityMatch ? rarityMatch[1].trim() : null;
  const lvMatch = html.match(/<dt[^>]*>Lv\.?\s*<\/dt>\s*<dd[^>]*>\s*(\d+)\s*<\/dd>/i);
  const costMatch = html.match(/<dt[^>]*>COST\s*<\/dt>\s*<dd[^>]*>\s*(\d+)\s*<\/dd>/i);
  const colorMatch = html.match(/<dt[^>]*>COLOR\s*<\/dt>\s*<dd[^>]*>\s*(\w+)\s*<\/dd>/i);
  const typeMatch = html.match(/<dt[^>]*>TYPE\s*<\/dt>\s*<dd[^>]*>\s*([^<]+?)<\/dd>/i);

  const typeMap = {
    UNIT: 'Unit', PILOT: 'Pilot', COMMAND: 'Command', BASE: 'Base',
    RESOURCE: 'Resource', 'EX BASE': 'ExBase', 'EX RESOURCE': 'ExResource',
    'UNIT TOKEN': 'Token',
  };
  const rawType = typeMatch ? typeMatch[1].trim().toUpperCase() : null;
  const card_type = rawType ? (typeMap[rawType] || rawType) : null;
  const color = colorMatch
    ? colorMatch[1].charAt(0).toUpperCase() + colorMatch[1].slice(1).toLowerCase()
    : null;

  return {
    card_code: cardCode,
    card_name,
    rarity,
    color,
    card_type,
    level: lvMatch ? parseInt(lvMatch[1], 10) : null,
    cost: costMatch ? parseInt(costMatch[1], 10) : null,
    source,
  };
}

function setMetaFromSource(source, setCode) {
  const names = {
    PC01A: 'Premium Card Collection GUNDAM ASSEMBLE Set -Mobile Suit Gundam IRON-BLOODED ORPHANS-',
    PC02A: 'Premium Card Collection GUNDAM ASSEMBLE Set -Mobile Suit Gundam GQuuuuuuX-',
  };
  return {
    set_code: setCode,
    set_name: `${names[setCode]} [${setCode}]`,
  };
}

function buildCandidates() {
  const codes = new Set(['ST05-001_p2']);
  const bases = ['ST05-001', 'ST05-002', 'ST05-003', 'ST05-004', 'ST05-005', 'ST05-006', 'ST05-007', 'ST05-008', 'ST05-009', 'ST05-010', 'ST05-011', 'ST05-012', 'ST05-013', 'ST05-014', 'ST05-015', 'ST05-016', 'ST06-001', 'ST06-002', 'ST06-003', 'ST06-004', 'ST06-005', 'ST06-006', 'ST06-007', 'ST06-008', 'ST06-009', 'ST06-010', 'ST06-011', 'ST06-012', 'ST06-013', 'ST06-014', 'ST06-015', 'ST06-016', 'ST01-001', 'ST01-002', 'ST01-003', 'ST01-004', 'ST01-005', 'ST01-006', 'ST01-007', 'ST01-008', 'ST01-009', 'ST01-010', 'ST01-011', 'ST01-012', 'ST01-013', 'ST01-014', 'ST01-015', 'ST01-016', 'GD01-001', 'GD01-002', 'GD01-003', 'GD01-004', 'GD01-005', 'GD01-006', 'GD01-007', 'GD01-008', 'GD01-009', 'GD01-010'];
  for (const base of bases) {
    for (let p = 1; p <= 12; p++) codes.add(`${base}_p${p}`);
  }
  for (let t = 1; t <= 50; t++) codes.add(`T-${String(t).padStart(3, '0')}`);
  for (let t = 1; t <= 50; t++) {
    codes.add(`R-${String(t).padStart(3, '0')}`);
    for (let p = 1; p <= 5; p++) codes.add(`R-${String(t).padStart(3, '0')}_p${p}`);
  }
  for (let t = 1; t <= 30; t++) {
    codes.add(`EXR-${String(t).padStart(3, '0')}`);
    codes.add(`ER-${String(t).padStart(3, '0')}`);
  }
  return [...codes];
}

const setCode = process.argv[2];
if (!setCode) {
  console.error('Usage: node discover_set_by_source.mjs PC01A');
  process.exit(1);
}

const candidates = buildCandidates();
const found = [];
let checked = 0;

for (const code of candidates) {
  checked++;
  if (checked % 50 === 0) process.stdout.write(`checked ${checked}/${candidates.length}\r`);
  try {
    const html = await fetch(`https://www.gundam-gcg.com/en/cards/detail.php?detailSearch=${encodeURIComponent(code)}`);
    if (html.includes('404') && html.length < 3000) continue;
    const detail = parseDetail(html, code);
    if (detail?.source?.includes(`[${setCode}]`)) {
      const meta = setMetaFromSource(detail.source, setCode);
      found.push({
        card_code: detail.card_code,
        card_name: detail.card_name,
        set_code: meta.set_code,
        set_name: meta.set_name,
        color: detail.color,
        card_type: detail.card_type,
        level: detail.level,
        cost: detail.cost,
        rarity: detail.rarity,
      });
      console.log(`\n  + ${detail.card_code} ${detail.card_name}`);
    }
  } catch (_) {}
  await new Promise(r => setTimeout(r, 120));
}

console.log(`\nFound ${found.length} cards for ${setCode}`);
const out = path.join(__dirname, `${setCode.toLowerCase()}_discovered.json`);
fs.writeFileSync(out, JSON.stringify(found, null, 2));
console.log('Wrote', out);

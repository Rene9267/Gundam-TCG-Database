import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refPath = path.join(__dirname, '..', '..', 'reference_cards.json');
const outDir = path.join(__dirname, '..', '..', 'reference');

const cards = JSON.parse(fs.readFileSync(refPath, 'utf-8'));

const bySet = {};
for (const card of cards) {
  const set = card.set_code;
  if (!bySet[set]) bySet[set] = [];
  bySet[set].push(card);
}

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

let total = 0;
for (const [setCode, setCards] of Object.entries(bySet).sort()) {
  const outPath = path.join(outDir, `${setCode}.json`);
  fs.writeFileSync(outPath, JSON.stringify(setCards, null, 2), 'utf-8');
  const bytes = fs.statSync(outPath).size;
  console.log(`${setCode.padEnd(6)} ${String(setCards.length).padStart(4)} cards → ${outPath} (${(bytes / 1024).toFixed(1)} KB)`);
  total += setCards.length;
}

const setMeta = {};
for (const [setCode, setCards] of Object.entries(bySet)) {
  const crossRef = new Set();
  for (const card of cards) {
    if (card.card_code.startsWith(setCode + '-') && card.set_code !== setCode) {
      crossRef.add(card.set_code);
    }
  }
  setMeta[setCode] = {
    set_code: setCode,
    set_name: setCards[0].set_name,
    total: setCards.length,
    cross_ref_sets: [...crossRef].sort(),
  };
}

const index = {
  version: 1,
  sets: Object.values(setMeta).sort((a, b) => a.set_code.localeCompare(b.set_code)),
};

const indexPath = path.join(outDir, 'index.json');
fs.writeFileSync(indexPath, JSON.stringify(index, null, 2), 'utf-8');
console.log(`Wrote manifest → ${indexPath}`);

console.log(`\nPartitioned ${total} cards into ${Object.keys(bySet).length} expansion files under reference/`);

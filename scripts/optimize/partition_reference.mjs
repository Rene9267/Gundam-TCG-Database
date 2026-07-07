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

console.log(`\nPartitioned ${total} cards into ${Object.keys(bySet).length} expansion files under reference/`);

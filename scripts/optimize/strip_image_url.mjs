import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const refPath = path.join(__dirname, '..', '..', 'reference_cards.json');

const cards = JSON.parse(fs.readFileSync(refPath, 'utf-8'));

for (const card of cards) {
  delete card.image_url;
}

fs.writeFileSync(refPath, JSON.stringify(cards, null, 2), 'utf-8');
console.log(`Stripped image_url from ${cards.length} cards. File size saved.`);

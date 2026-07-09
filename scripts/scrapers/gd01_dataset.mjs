import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');

export const TARGET_SET = 'GD01';

export function isVariantCode(code) {
  return /_p\d+$/.test(code);
}

export function extractBaseCode(code) {
  return code.replace(/_[a-z0-9]+$/i, '');
}

export function isGdPrefix(code) {
  return /^gd\d{2}/i.test(code);
}

export function loadRefCards() {
  return JSON.parse(fs.readFileSync(REF_PATH, 'utf-8'));
}

export function saveRefCards(cards) {
  fs.writeFileSync(REF_PATH, JSON.stringify(cards, null, 2), 'utf-8');
}

export function filterBySet(cards, setCode) {
  return cards.filter(c => c.set_code === setCode);
}

export function getSetName(cards, setCode) {
  const card = cards.find(c => c.set_code === setCode);
  return card ? card.set_name : null;
}

export function groupByNameRarity(cards) {
  const groups = {};
  for (const card of cards) {
    const key = `${card.card_name}||${(card.rarity || '').toLowerCase()}`;
    if (!groups[key]) {
      groups[key] = {
        name: card.card_name,
        rarity: (card.rarity || '').toLowerCase(),
      };
    }
  }
  return groups;
}

export function extractCardIds(cards) {
  return cards.map(c => ({
    code: c.card_code,
    baseCode: extractBaseCode(c.card_code),
    isVariant: isVariantCode(c.card_code),
    name: c.card_name,
    rarity: c.rarity,
  }));
}

export function getRarityDistribution(cards) {
  const dist = {};
  for (const c of cards) {
    const r = c.rarity || 'NONE';
    dist[r] = (dist[r] || 0) + 1;
  }
  return dist;
}

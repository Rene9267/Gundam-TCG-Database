import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { resolveCardBatch } from './cardtrader_router.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REF_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');

function isBaseCode(code) {
  return !/_p\d+$/.test(code) && !/_(beta|reprint|event|stp|winner|championship|other)(\d+)?$/i.test(code);
}

function parseSetArg() {
  const eq = process.argv.find((a) => a.startsWith('--set='));
  if (eq) return eq.split('=')[1].toUpperCase();
  const idx = process.argv.indexOf('--set');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1].toUpperCase();
  return null;
}

function parseCodeArg() {
  const eq = process.argv.find((a) => a.startsWith('--code='));
  if (eq) return eq.split('=')[1].toUpperCase();
  const idx = process.argv.indexOf('--code');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1].toUpperCase();
  return null;
}

function applyPrintingsToCatalog(refCards, baseCode, printings) {
  const byCode = new Map(refCards.map((c) => [c.card_code, c]));
  const baseCard = byCode.get(baseCode);
  if (!baseCard || !printings?.length) return 0;

  baseCard.printings = printings;
  let updated = 1;

  for (const p of printings) {
    const row = byCode.get(p.printing_id);
    if (row) {
      row.cardtrader_id = p.cardtrader_id;
      row.cardtrader_slug = p.cardtrader_slug;
      updated++;
    }
  }

  const primary = printings.find((p) => p.printing_id === baseCode) || printings[0];
  if (primary) {
    baseCard.cardtrader_id = primary.cardtrader_id;
    baseCard.cardtrader_slug = primary.cardtrader_slug;
  }

  return updated;
}

async function processSet(setCode, refCards) {
  const setCards = refCards.filter((c) => c.set_code === setCode);
  if (!setCards.length) {
    console.warn(`Set ${setCode}: nessuna carta in reference_cards.json`);
    return 0;
  }
  const setName = setCards[0].set_name;
  const baseCards = setCards.filter((c) => isBaseCode(c.card_code));
  console.log(`\n=== ${setCode}: ${setName} (${baseCards.length} base cards) ===\n`);

  const batchResults = await resolveCardBatch(setCards, setName, setCode, 'en', (i, total, name, result) => {
    const count = result.printings?.length || 0;
    console.log(`  [${i}/${total}] ${name.padEnd(40)} → ${count} version${count === 1 ? '' : 'i'}`);
  });

  let updated = 0;
  for (const [baseCode, result] of Object.entries(batchResults)) {
    if (!result.found || !result.printings?.length) continue;
    updated += applyPrintingsToCatalog(refCards, baseCode, result.printings);
  }

  console.log(`  → Updated ${updated} catalog rows in set ${setCode}`);
  return updated;
}

async function main() {
  const targetSet = parseSetArg();
  const targetCode = parseCodeArg();
  const refCards = JSON.parse(fs.readFileSync(REF_PATH, 'utf-8'));

  if (targetCode) {
    const baseCard = refCards.find((c) => c.card_code === targetCode);
    if (!baseCard) {
      console.error(`Card ${targetCode} not found`);
      process.exit(1);
    }
    const { resolveCardVersions } = await import('./cardtrader_router.mjs');
    const result = await resolveCardVersions(baseCard, 'en');
    applyPrintingsToCatalog(refCards, targetCode, result.printings);
    console.log(`Updated ${targetCode} with ${result.printings?.length || 0} printings`);
  } else if (targetSet) {
    await processSet(targetSet, refCards);
  } else {
    const setCodes = [...new Set(refCards.map((c) => c.set_code))].sort();
    for (const setCode of setCodes) {
      await processSet(setCode, refCards);
    }
  }

  fs.writeFileSync(REF_PATH, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log('\nDone! reference_cards.json updated with CardTrader printings.');
  console.log('Usage: node scripts/scrapers/fetch_cardtrader_ids.mjs --set GD01');
  console.log('       node scripts/scrapers/fetch_cardtrader_ids.mjs --code GD01-005');
}

main().catch(console.error);

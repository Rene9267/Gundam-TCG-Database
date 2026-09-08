import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const cardtraderJs = readFileSync(join(root, 'js/cardtrader.js'), 'utf8');
const sheetJs = readFileSync(join(root, 'js/sheet.js'), 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

assert.match(cardtraderJs, /apikey:\s*SUPABASE_ANON_KEY/);
assert.match(cardtraderJs, /status:\s*'ok'/);
assert.match(cardtraderJs, /status:\s*'unauthenticated'/);
assert.match(cardtraderJs, /price_cents/);

assert.match(sheetJs, /Prezzi…/);
assert.match(sheetJs, /Accedi per i prezzi/);
assert.match(sheetJs, /Nessuna offerta/);
assert.match(sheetJs, /_ctPriceLoadId/);

assert.match(indexHtml, /id="sheet-price-status"/);

console.log('cardtrader integration checks passed');

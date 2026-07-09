import {
  TARGET_SET,
  loadRefCards,
  filterBySet,
  getSetName,
  groupByNameRarity,
  extractCardIds,
  getRarityDistribution,
  isVariantCode,
  isGdPrefix,
} from './gd01_dataset.mjs';
import { resolveCard } from './cardtrader_router.mjs';
import {
  computeSetSlug,
  computeCardSlug,
  computeVariantSlug,
  buildCardtraderUrl,
  buildCardtraderSearchUrl,
  buildCardImageUrl,
  slugify,
} from './url_builder.mjs';

const LANG = 'en';

function formatStatus(result) {
  const baseOk = result.baseResult?.found ? 'OK' : 'MISS';
  const variantOk = result.variantResult?.found ? 'OK' : 'MISS';
  const id = result.bestId ? `id=${result.bestId}` : 'NO ID';
  return `base=${baseOk} variant=${variantOk} best=${id}`;
}

async function main() {
  console.log(`\n=== ${TARGET_SET} URL Resolution Pipeline ===\n`);

  // Step 1: Load dataset
  console.log('[1/5] Loading reference cards...');
  const allCards = loadRefCards();

  // Step 2: Filter GD01 cards
  console.log('[2/5] Filtering GD01 cards...');
  const gd01Cards = filterBySet(allCards, TARGET_SET);
  const setName = getSetName(gd01Cards, TARGET_SET);
  console.log(`  Found ${gd01Cards.length} cards in "${setName}"`);

  // Step 3: Analyze card identifiers
  console.log('[3/5] Analyzing card identifiers...');
  const ids = extractCardIds(gd01Cards);
  const variants = ids.filter(c => c.isVariant);
  const baseCards = ids.filter(c => !c.isVariant);
  console.log(`  ${baseCards.length} base cards, ${variants.length} variants`);

  const gdPrefixCards = ids.filter(c => isGdPrefix(c.code));
  console.log(`  ${gdPrefixCards.length} cards with GD prefix`);

  const rarityDist = getRarityDistribution(gd01Cards);
  console.log('  Rarity distribution:');
  for (const [r, count] of Object.entries(rarityDist)) {
    console.log(`    ${r}: ${count}`);
  }

  const groups = groupByNameRarity(gd01Cards);
  console.log(`  ${Object.keys(groups).length} unique name+rarity combos\n`);

  // Step 4: Build and validate URLs
  console.log('[4/5] Building and validating CardTrader URLs...\n');
  const setSlug = computeSetSlug(TARGET_SET, setName);
  console.log(`  Set slug: ${setSlug}`);
  console.log(`  Example base URL: ${buildCardtraderUrl(computeCardSlug('Gundam', setSlug), LANG)}`);
  console.log(`  Example variant URL: ${buildCardtraderUrl(computeVariantSlug('Gundam', 'lr', setSlug), LANG)}`);
  console.log(`  Example search fallback: ${buildCardtraderSearchUrl('GD01-001', LANG)}`);
  console.log(`  Example image URL: ${buildCardImageUrl('GD01-001')}\n`);

  const entries = Object.entries(groups);
  console.log(`  Validating ${entries.length} unique card entries against CardTrader...\n`);

  let found = 0;
  let missing = 0;
  const details = [];

  for (let i = 0; i < entries.length; i++) {
    const [key, group] = entries[i];
    const result = await resolveCard(group.name, group.rarity, setName, TARGET_SET, LANG);

    const status = formatStatus(result);
    details.push({ key, group, result, status });

    if (result.bestId) {
      found++;
    } else {
      missing++;
    }

    const progress = `${i + 1}/${entries.length}`;
    const marker = result.bestId ? '✓' : '✗';
    console.log(`  [${progress}] ${marker} ${group.name.padEnd(50)} ${status}`);
  }

  // Step 5: Summary
  console.log(`\n[5/5] Validation Summary\n`);
  console.log(`  Total unique combos:  ${entries.length}`);
  console.log(`  Resolved (with ID):  ${found}`);
  console.log(`  Unresolved (no ID):  ${missing}`);
  console.log(`  Resolution rate:     ${((found / entries.length) * 100).toFixed(1)}%\n`);

  if (missing > 0) {
    console.log('  Unresolved entries:');
    for (const d of details) {
      if (!d.result.bestId) {
        console.log(`    ${d.group.name} (rarity: ${d.group.rarity || 'none'})`);
        console.log(`      base: ${d.result.baseResult?.url || 'N/A'}`);
        console.log(`      variant: ${d.result.variantResult?.url || 'N/A'}`);
      }
    }
  }

  console.log('\nDone!');
}

main().catch(console.error);

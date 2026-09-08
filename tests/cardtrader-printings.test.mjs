import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseVersionSelectOptions,
  extractCtRarityFromHtml,
  expansionKind,
  resolvePrintingKind,
  buildPrintingsFromVersions,
  computeBadge,
  plusBadgeFromRarity,
} from '../scripts/scrapers/cardtrader_printings.mjs';

const UNICORN_SELECT_HTML = `
<select>
<option value="341280">Edition Beta  #GD01-005</option>
<option value="341130">GD-01: Newtype Rising  #GD01-005</option>
<option selected="" value="344066">GD-01: Newtype Rising  #GD01-005a</option>
<option value="347724">Release Event Promos  #GD01-005</option>
<option value="400390">Reprints  #GD01-005</option>
</select>`;

const baseCard = {
  card_code: 'GD01-005',
  card_name: 'Unicorn Gundam (Unicorn Mode)',
  set_code: 'GD01',
  set_name: 'Newtype Rising [GD01]',
  rarity: 'R',
};

test('parseVersionSelectOptions extracts all CardTrader versions', () => {
  const versions = parseVersionSelectOptions(UNICORN_SELECT_HTML);
  assert.equal(versions.length, 5);
  assert.equal(versions[0].cardtrader_id, 341280);
  assert.equal(versions[0].expansion, 'Edition Beta');
  assert.equal(versions[2].collector_number, 'GD01-005a');
});

test('expansionKind classifies beta, event, and reprint', () => {
  assert.equal(expansionKind('Edition Beta'), 'beta');
  assert.equal(expansionKind('Release Event Promos'), 'event');
  assert.equal(expansionKind('Reprints'), 'reprint');
  assert.equal(expansionKind('GD-01: Newtype Rising'), 'set');
});

test('buildPrintingsFromVersions maps GD01-005 to five printings with badges', () => {
  const versions = parseVersionSelectOptions(UNICORN_SELECT_HTML);
  const printings = buildPrintingsFromVersions({
    versions,
    baseCard,
    ctRarityById: {
      341130: 'Foil',
      344066: 'R+',
      347724: 'GD01 Release Event',
      400390: 'Non-Foil',
    },
    slugById: {
      341280: '341280-unicorn-beta',
      341130: '341130-unicorn-foil',
      344066: '344066-unicorn-r-plus',
      347724: '347724-unicorn-event',
      400390: '400390-unicorn-reprint',
    },
  });

  assert.equal(printings.length, 5);
  const byId = new Map(printings.map((p) => [p.printing_id, p]));

  assert.equal(byId.get('GD01-005').badge.text, 'GD01');
  assert.equal(byId.get('GD01-005_p1').badge.text, 'R+');
  assert.equal(byId.get('GD01-005_beta').badge.text, 'BETA');
  assert.equal(byId.get('GD01-005_event').badge.type, 'event');
  assert.equal(byId.get('GD01-005_reprint').badge.text, 'RP');
});

test('extractCtRarityFromHtml reads rarity badge from title', () => {
  const html = '<h2>Unicorn<small class="ml-2">(<!-- -->R+<!-- -->)</small></h2>';
  assert.equal(extractCtRarityFromHtml(html), 'R+');
});

test('plusBadgeFromRarity and computeBadge', () => {
  assert.equal(plusBadgeFromRarity('LR'), 'LR+');
  assert.deepEqual(computeBadge({ kind: 'reprint', setCode: 'GD01' }), { type: 'set', text: 'RP' });
  assert.deepEqual(computeBadge({ kind: 'event' }), { type: 'event', text: null });
});

test('cardBaseId strips printing suffixes', () => {
  const cardBaseId = (code) => code.replace(/_(?:p\d+|beta|reprint|event|stp|winner|championship|other\d*)$/i, '');
  assert.equal(cardBaseId('GD01-005_p1'), 'GD01-005');
  assert.equal(cardBaseId('GD01-005_beta'), 'GD01-005');
  assert.equal(cardBaseId('GD01-005_event'), 'GD01-005');
  assert.equal(cardBaseId('GD01-005_reprint'), 'GD01-005');
});

test('resolvePrintingKind distinguishes base and alt in same expansion', () => {
  assert.equal(resolvePrintingKind({
    expansion: 'GD-01: Newtype Rising',
    collector_number: 'GD01-005',
    officialSetCode: 'GD01',
    officialSetName: baseCard.set_name,
  }), 'base');
  assert.equal(resolvePrintingKind({
    expansion: 'GD-01: Newtype Rising',
    collector_number: 'GD01-005a',
    officialSetCode: 'GD01',
    officialSetName: baseCard.set_name,
  }), 'alt');
});

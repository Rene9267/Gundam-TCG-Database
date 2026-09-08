const EVENT_EXPANSION_RE = /release event|store tournament|winner pack|championship|judge promo|gundam promo|newtype challenge|premium card collection/i;
const BETA_EXPANSION_RE = /^edition beta$/i;
const REPRINT_EXPANSION_RE = /^reprints$/i;

export function parseVersionSelectOptions(html) {
  if (!html) return [];
  const options = [];
  const re = /<option[^>]*value="(\d+)"[^>]*>([^<]+)<\/option>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = m[2].replace(/\s+/g, ' ').trim();
    const hashIdx = text.lastIndexOf('#');
    if (hashIdx === -1) continue;
    const expansion = text.slice(0, hashIdx).trim();
    const collector_number = text.slice(hashIdx + 1).trim();
    if (!expansion || !collector_number) continue;
    options.push({
      cardtrader_id: parseInt(m[1], 10),
      expansion,
      collector_number,
    });
  }
  return options;
}

export function extractCtRarityFromHtml(html) {
  if (!html) return null;
  const m = html.match(/<h2[^>]*>[\s\S]*?<small[^>]*>\(\s*(?:<!--\s*-->)?([^<]+?)(?:<!--\s*-->)?\s*\)<\/small>/i);
  return m ? m[1].trim() : null;
}

export function extractSlugFromHtml(html) {
  if (!html) return null;
  const m = html.match(/property="og:url"\s+content="[^"]*\/cards\/([^"?]+)/i);
  return m ? m[1].trim() : null;
}

export function expansionKind(expansion) {
  const e = (expansion || '').trim();
  if (BETA_EXPANSION_RE.test(e)) return 'beta';
  if (REPRINT_EXPANSION_RE.test(e)) return 'reprint';
  if (EVENT_EXPANSION_RE.test(e)) return 'event';
  return 'set';
}

export function normalizeSetCodeFromExpansion(expansion) {
  const m = (expansion || '').match(/\b(GD|ST|EB|PC)\s*-?\s*0?(\d+)/i);
  if (!m) return null;
  return `${m[1].toUpperCase()}${m[2].padStart(2, '0')}`;
}

export function collectorAltSuffix(collectorNumber) {
  const m = (collectorNumber || '').match(/[a-z]+$/i);
  if (!m) return null;
  const suffix = m[0].toLowerCase();
  if (suffix.length === 1 && suffix >= 'a' && suffix <= 'z') {
    return suffix.charCodeAt(0) - 'a'.charCodeAt(0) + 1;
  }
  return null;
}

export function stripCollectorSuffix(collectorNumber) {
  return (collectorNumber || '').replace(/[a-z]+$/i, '');
}

export function plusBadgeFromRarity(rarity) {
  const r = (rarity || '').trim();
  if (!r) return 'R+';
  if (r.includes('++')) return r;
  if (r.endsWith('+')) return r;
  return `${r}+`;
}

export function computeBadge({ kind, ctRarity, setCode, expansion }) {
  if (kind === 'beta') return { type: 'set', text: 'BETA' };
  if (kind === 'reprint') return { type: 'set', text: 'RP' };
  if (kind === 'event') return { type: 'event', text: null };
  if (ctRarity && /\+\+/.test(ctRarity)) return { type: 'rarity', text: ctRarity.replace(/\s+/g, '') };
  if (ctRarity && /\+/.test(ctRarity)) return { type: 'rarity', text: ctRarity.replace(/\s+/g, '') };
  if (kind === 'alt') {
    const inferred = plusBadgeFromRarity(ctRarity);
    return { type: 'rarity', text: inferred };
  }
  const code = setCode || normalizeSetCodeFromExpansion(expansion) || 'SET';
  return { type: 'set', text: code };
}

export function resolvePrintingKind({ expansion, collector_number, officialSetCode, officialSetName }) {
  const expKind = expansionKind(expansion);
  if (expKind === 'beta') return 'beta';
  if (expKind === 'reprint') return 'reprint';
  if (expKind === 'event') return 'event';

  const expSet = normalizeSetCodeFromExpansion(expansion);
  const officialExpName = (officialSetName || '').replace(/\[.*?\]$/, '').trim().toLowerCase();
  const expansionLower = (expansion || '').trim().toLowerCase();
  const sameSet = (officialSetCode && expSet === officialSetCode)
    || expansionLower.includes(officialExpName)
    || expansionLower.includes((officialSetCode || '').toLowerCase());

  if (!sameSet) return 'other';

  const altIdx = collectorAltSuffix(collector_number);
  if (altIdx != null) return 'alt';
  return 'base';
}

export function resolvePrintingId(baseCode, kind, collector_number, altIdx, usedIds) {
  if (kind === 'base') return baseCode;
  if (kind === 'alt') {
    const idx = altIdx || 1;
    return `${baseCode}_p${idx}`;
  }
  const suffix = kind === 'other' ? 'other' : kind;
  let candidate = `${baseCode}_${suffix}`;
  let n = 2;
  while (usedIds.has(candidate)) {
    candidate = `${baseCode}_${suffix}${n}`;
    n += 1;
  }
  return candidate;
}

export function buildPrintingsFromVersions({
  versions,
  baseCard,
  ctRarityById = {},
  slugById = {},
}) {
  const baseCode = baseCard.card_code;
  const usedIds = new Set();
  const printings = [];

  const sorted = [...versions].sort((a, b) => {
    const order = { base: 0, alt: 1, beta: 2, event: 3, reprint: 4, other: 5 };
    const ka = resolvePrintingKind({
      expansion: a.expansion,
      collector_number: a.collector_number,
      officialSetCode: baseCard.set_code,
      officialSetName: baseCard.set_name,
    });
    const kb = resolvePrintingKind({
      expansion: b.expansion,
      collector_number: b.collector_number,
      officialSetCode: baseCard.set_code,
      officialSetName: baseCard.set_name,
    });
    return (order[ka] ?? 9) - (order[kb] ?? 9);
  });

  for (const v of sorted) {
    const kind = resolvePrintingKind({
      expansion: v.expansion,
      collector_number: v.collector_number,
      officialSetCode: baseCard.set_code,
      officialSetName: baseCard.set_name,
    });
    const altIdx = kind === 'alt' ? collectorAltSuffix(v.collector_number) : null;
    const printing_id = resolvePrintingId(baseCode, kind, v.collector_number, altIdx, usedIds);
    usedIds.add(printing_id);

    const ctRarity = ctRarityById[v.cardtrader_id]
      || (kind === 'alt' ? plusBadgeFromRarity(baseCard.rarity) : null);
    const badge = computeBadge({
      kind,
      ctRarity,
      setCode: baseCard.set_code,
      expansion: v.expansion,
    });

    printings.push({
      printing_id,
      kind,
      badge,
      ct_rarity: ctRarity || null,
      collector_number: v.collector_number,
      expansion: v.expansion,
      cardtrader_id: v.cardtrader_id,
      cardtrader_slug: slugById[v.cardtrader_id] || String(v.cardtrader_id),
    });
  }

  return printings;
}

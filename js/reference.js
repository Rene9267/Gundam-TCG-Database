let refManifest = null;
const loadedSets = new Set();
let versionsByBaseId = {};

function setSortPrefix(setCode) {
  if (setCode.startsWith('ST')) return 0;
  if (setCode.startsWith('GD')) return 1;
  if (setCode.startsWith('EB')) return 2;
  if (setCode.startsWith('PC')) return 3;
  return 2;
}

function sortSetNames(names) {
  return names.sort((a, b) => {
    const aCode = a.match(/\[(\w+)\]/)?.[1] || '';
    const bCode = b.match(/\[(\w+)\]/)?.[1] || '';
    const aNum = parseInt(aCode.replace(/\D/g, ''), 10) || 0;
    const bNum = parseInt(bCode.replace(/\D/g, ''), 10) || 0;
    const aPref = setSortPrefix(aCode);
    const bPref = setSortPrefix(bCode);
    return aPref !== bPref ? aPref - bPref : aNum - bNum;
  });
}

function cardBaseId(cardCode) {
  return cardCode.replace(/_(?:p\d+|beta|reprint|event|stp|winner|championship|other\d*)$/i, '');
}

function buildPrintingRef(baseRc, printing) {
  const official = refCardByCode[printing.printing_id];
  if (official) {
    return {
      ...official,
      printing,
      badge: printing.badge,
      cardtrader_id: printing.cardtrader_id || official.cardtrader_id,
      cardtrader_slug: printing.cardtrader_slug || official.cardtrader_slug,
    };
  }
  return {
    card_code: printing.printing_id,
    card_name: baseRc.card_name,
    set_name: baseRc.set_name,
    set_code: baseRc.set_code,
    rarity: baseRc.rarity,
    color: baseRc.color,
    card_type: baseRc.card_type,
    level: baseRc.level,
    cost: baseRc.cost,
    cardtrader_id: printing.cardtrader_id,
    cardtrader_slug: printing.cardtrader_slug,
    printing,
    badge: printing.badge,
    _virtual: true,
  };
}

function getBaseRefCard(cardCode) {
  if (!cardCode) return null;
  const baseId = cardBaseId(cardCode);
  return refCardByCode[baseId] || refCardByCode[cardCode] || null;
}

function classifyCardVariant(rc) {
  const isRT = isTokenOrResource(rc.card_code);
  if (isRT) {
    if (/_p\d+$/.test(rc.card_code)) return 'altart';
    return 'resource';
  }
  const info = cardAltInfo[rc.card_code];
  if (info && info.isAltArt) return 'altart';
  if (rc.card_code.includes('_p') || rc.card_code.split('-')[0] !== rc.set_code) return 'altart';
  return 'base';
}

function pickCanonicalResourceCard(cards) {
  if (!cards.length) return null;
  const plain = cards.find(c => !/_p\d+$/.test(c.card_code));
  return plain || cards.slice().sort((a, b) => a.card_code.localeCompare(b.card_code))[0];
}

function mergeRefCards(cards) {
  for (const rc of cards) {
    refCards.push(rc);
    refCardByCode[rc.card_code] = rc;
    const baseId = cardBaseId(rc.card_code);
    if (!versionsByBaseId[baseId]) versionsByBaseId[baseId] = [];
    if (!versionsByBaseId[baseId].some(v => v.card_code === rc.card_code)) {
      versionsByBaseId[baseId].push(rc);
    }
  }
}

function computeSetDataFromManifest() {
  if (!refManifest || !refManifest.sets) return;
  setTotals = {};
  const names = [];
  for (const s of refManifest.sets) {
    setTotals[s.set_name] = s.total;
    names.push(s.set_name);
  }
  setOrder = sortSetNames(names);
  cardAltInfo = {};
  nameFirstSet = {};
}

async function loadReferenceManifest() {
  try {
    const res = await fetch('reference/index.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    refManifest = await res.json();
    computeSetDataFromManifest();
  } catch (err) {
    console.warn('Impossibile caricare reference/index.json:', err.message);
  }
}

async function loadSetReference(setCode) {
  if (!setCode || loadedSets.has(setCode)) return;
  try {
    const res = await fetch('reference/' + setCode + '.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const cards = await res.json();
    mergeRefCards(cards);
    loadedSets.add(setCode);
    rebuildAltInfo();
  } catch (err) {
    console.warn('Impossibile caricare reference/' + setCode + '.json:', err.message);
  }
}

function rebuildAltInfo() {
  const sorted = [...refCards].sort((a, b) => {
    const aP = a.set_code.startsWith('ST') ? 0 : 1;
    const bP = b.set_code.startsWith('ST') ? 0 : 1;
    if (aP !== bP) return aP - bP;
    return a.set_code.localeCompare(b.set_code);
  });
  nameFirstSet = {};
  for (const c of sorted) {
    if (!nameFirstSet[c.card_name]) nameFirstSet[c.card_name] = c.set_code;
  }
  cardAltInfo = {};
  for (const c of refCards) {
    const first = nameFirstSet[c.card_name] || '';
    cardAltInfo[c.card_code] = {
      isAltArt: first !== '' && first !== c.set_code,
      originalSet: first !== '' && first !== c.set_code ? first : null,
    };
  }
}

async function ensureSetLoaded(setCode) {
  if (!setCode) return;
  await loadSetReference(setCode);
  const entry = refManifest?.sets?.find(s => s.set_code === setCode);
  if (entry?.cross_ref_sets) {
    await Promise.all(entry.cross_ref_sets.map(code => loadSetReference(code)));
  }
}

async function loadReferenceCards() {
  await loadReferenceManifest();
}

function getAltVersions(cardCode) {
  if (!cardCode) return [];
  const baseId = cardBaseId(cardCode);
  const baseRc = refCardByCode[baseId];
  if (baseRc?.printings?.length) {
    return baseRc.printings.map((p) => buildPrintingRef(baseRc, p));
  }
  return versionsByBaseId[baseId] || [];
}

function resolveRefCard(cardCode) {
  if (!cardCode) return null;
  return refCardByCode[cardCode] || getAltVersions(cardCode).find((v) => v.card_code === cardCode) || null;
}

// ============ Configurazione Supabase ============
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yeP5henLm-YdNtkwCFuV0Q_tE1koERf';


// ============ Reference Cards (database mastro) ============
let refCards = [];
let refCardByCode = {};
let setTotals = {};
let setOrder = [];

// Alt Art: nome → prima espansione in cui è apparso
let nameFirstSet = {};
// CardCode → { isAltArt, originalSet }
let cardAltInfo = {};
// Set di card_code che sono T-* o R-*
const isTokenOrResource = (code) => code.startsWith('T-') || code.startsWith('R-');

function computeSetData() {
  // Raggruppa per set_name (es. "Heroic Beginnings [ST01]")
  const groups = {};
  for (const rc of refCards) {
    if (!groups[rc.set_name]) groups[rc.set_name] = 0;
    groups[rc.set_name]++;
  }
  // Ordine: ST → GD (numerico)
  setOrder = Object.keys(groups).sort((a, b) => {
    const aCode = a.match(/\[(\w+)\]/)?.[1] || '';
    const bCode = b.match(/\[(\w+)\]/)?.[1] || '';
    const aNum = parseInt(aCode.replace(/\D/g, ''), 10) || 0;
    const bNum = parseInt(bCode.replace(/\D/g, ''), 10) || 0;
    const aPref = aCode.startsWith('ST') ? 0 : 1;
    const bPref = bCode.startsWith('ST') ? 0 : 1;
    return aPref !== bPref ? aPref - bPref : aNum - bNum;
  });
  setTotals = groups;
  // Mappa card_code → ref card
  refCardByCode = {};
  for (const rc of refCards) {
    refCardByCode[rc.card_code] = rc;
  }
  // Costruisci mappa: prima espansione per ogni nome carta
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
  // Mappa alt art per card_code
  cardAltInfo = {};
  for (const c of refCards) {
    const first = nameFirstSet[c.card_name] || '';
    cardAltInfo[c.card_code] = {
      isAltArt: first !== '' && first !== c.set_code,
      originalSet: first !== '' && first !== c.set_code ? first : null,
    };
  }
}

async function loadReferenceCards() {
  try {
    const res = await fetch('reference_cards.json');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    refCards = await res.json();
    computeSetData();
  } catch (err) {
    console.warn('Impossibile caricare reference_cards.json:', err.message);
  }
}

// ============ State ============
let allCards = [];

// ============ Cards CRUD (fetch diretto) ============
const SUPABASE_HEADERS = {
  'apikey': SUPABASE_ANON_KEY,
  'Authorization': 'Bearer ' + SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
};

async function loadCards() {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?select=*&order=created_at.desc', {
    headers: SUPABASE_HEADERS,
  });
  if (!r.ok) throw new Error('GET /cards ' + r.status);
  return r.json();
}

async function addCard(card) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST',
    headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(card),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('POST /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function updateCard(id, updates) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
    method: 'PATCH',
    headers: { ...SUPABASE_HEADERS, 'Prefer': 'return=representation' },
    body: JSON.stringify(updates),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('PATCH /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function deleteCard(id) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
    method: 'DELETE',
    headers: SUPABASE_HEADERS,
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE /cards ' + r.status + ': ' + text.slice(0, 200));
  }
}

// ============ UI Helpers ============
function showSection(id) {
  document.querySelectorAll('#splash-section, #app-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showView(id) {
  document.querySelectorAll('#view-dashboard, #view-collection').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function switchTab(tab) {
  document.querySelectorAll('.bottom-nav-item').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById('bottom-' + tab);
  if (btn) btn.classList.add('active');
  if (tab === 'dashboard') showView('view-dashboard');
  else showView('view-collection');
}

function rarityColor(rarity) {
  const map = {
    'Common': 'text-gray-500',
    'Uncommon': 'text-green-600',
    'Rare': 'text-blue-600',
    'Super Rare': 'text-purple-600',
    'Secret Rare': 'text-yellow-600',
    'Promo': 'text-orange-600'
  };
  return map[rarity] || 'text-gray-500';
}

function imageOrFallback(url, name) {
  if (!url) return `<div class="card-img-fallback w-full aspect-[3/4]">🃏</div>`;
  return `<img src="${url}" alt="${name}" class="w-full aspect-[3/4] object-cover" loading="lazy" onerror="this.outerHTML='<div class=\\'card-img-fallback w-full aspect-[3/4]\\'>🃏</div>'">`;
}

function setGroup(setName) {
  const code = setName.match(/\[(\w+)\]/)?.[1] || '';
  if (code.startsWith('ST')) return 'st';
  return 'gd';
}

// ============ Dashboard — Stats ============
function renderDashboardStats() {
  const uniqueCodes = new Set(allCards.map(c => c.card_code));
  document.getElementById('stat-total-cards').textContent = allCards.length;
  document.getElementById('stat-unique-cards').textContent = uniqueCodes.size;
}

// ============ Dashboard — Ultime Aggiunte (Horizontal Scroll) ============
function renderLatestHorizontal() {
  const scroll = document.getElementById('latest-scroll');
  const empty = document.getElementById('latest-empty');
  const latest = allCards.slice(0, 10);

  if (!latest.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const items = latest.map(c => `
    <article class="min-w-[130px] w-[130px] snap-start flex-shrink-0 relative cursor-pointer group latest-entry" data-code="${c.card_code}">
      <div class="aspect-[2.5/3.5] bg-primary-light rounded-lg overflow-hidden border border-secondary-light/50 relative shadow-sm">
        ${imageOrFallback(c.image_url, c.card_name)}
        <div class="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/60 via-black/20 to-transparent">
          <p class="text-[9px] font-mono text-white/90 truncate">${c.card_code}</p>
        </div>
      </div>
    </article>
  `).join('');

  scroll.innerHTML = items + '<div class="w-3 flex-shrink-0"></div>';

  scroll.querySelectorAll('.latest-entry').forEach(el => {
    el.addEventListener('click', () => {
      const code = el.dataset.code;
      const rc = refCardByCode[code];
      if (rc) openSheet(rc);
    });
  });
}

// ============ Dashboard — Completamento Espansioni (Vertical List) ============
function renderExpansionsList() {
  const container = document.getElementById('expansions-list');
  const empty = document.getElementById('expansions-empty');

  const ownedMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
  }

  const ownedSets = setOrder.filter(s => ownedMap[s] && ownedMap[s].size > 0);
  const top3 = ownedSets.slice(-3);

  if (!top3.length) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const items = top3.map(setName => {
    const total = setTotals[setName] || 0;
    const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
    const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
    const r = 34;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;
    const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
    const cleanName = setName.replace(/\s*\[.*?\]/, '');

    return `
      <div class="exp-entry bg-white rounded-xl border border-secondary-light/60 p-3 flex items-center justify-between hover:shadow-sm transition cursor-pointer shadow-sm" data-set="${setName}">
        <div class="flex items-center gap-3">
          <div class="relative w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="transparent" r="${r}" stroke="#eef0f4" stroke-width="8"></circle>
              <circle cx="50" cy="50" fill="transparent" r="${r}"
                stroke="#9ca3af" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${circumference}" stroke-dashoffset="${owned > 0 ? offset : circumference}"
                style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 0.35s"></circle>
            </svg>
            <span class="absolute text-[10px] font-bold font-heading text-primary">${pct}%</span>
          </div>
          <div>
            <p class="text-sm font-semibold text-primary">${cleanName}</p>
            <div class="flex gap-2 items-center mt-0.5">
              <span class="font-mono text-[10px] px-1 border border-secondary-light rounded text-secondary">${setCode}</span>
              <span class="font-mono text-[10px] text-secondary/60">${owned}/${total}</span>
            </div>
          </div>
        </div>
        <span class="material-symbols-outlined text-secondary">chevron_right</span>
      </div>
    `;
  }).join('');

  container.innerHTML = items;

  container.querySelectorAll('.exp-entry').forEach(el => {
    el.addEventListener('click', () => {
      const setName = el.dataset.set;
      if (currentColTab !== 'cards') switchColTab('cards');
      currentColTab = 'cards';
      document.getElementById('col-set-filter').value = setName;
      document.getElementById('col-search').value = '';
      for (const k of Object.keys(activeFilters)) activeFilters[k] = k === 'base';
      document.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('active', activeFilters[b.dataset.filter]));
      switchTab('collection');
      renderCollection(filterCollection());
    });
  });
}

// ============ Variant filter state ============
const activeFilters = { base: true, altart: false, resources: false };

function getSetCodeFromFilter() {
  const setFilter = document.getElementById('col-set-filter').value;
  return setFilter.match(/\[(\w+)\]/)?.[1] || '';
}

function toggleVariantFilter(filterName) {
  activeFilters[filterName] = !activeFilters[filterName];
  document.querySelectorAll('.variant-btn').forEach(b => {
    b.classList.toggle('active', activeFilters[b.dataset.filter]);
  });
  if (currentColTab !== 'stats') renderCollection(filterCollection());
}

function setAllFilters(val) {
  for (const k of Object.keys(activeFilters)) activeFilters[k] = val;
  document.querySelectorAll('.variant-btn').forEach(b => {
    b.classList.toggle('active', activeFilters[b.dataset.filter]);
  });
  if (currentColTab !== 'stats') renderCollection(filterCollection());
}

// ============ Collection ============
function renderCollection(cards) {
  const grid = document.getElementById('collection-grid');
  const empty = document.getElementById('collection-empty');
  const summary = document.getElementById('collection-summary');

  if (!cards.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    summary.textContent = '';
    return;
  }

  empty.classList.add('hidden');
  const total = cards.length;
  const owned = cards.filter(c => !c.isMissing).length;
  const missing = total - owned;
  summary.textContent = `${owned}/${total} carte possedute${missing > 0 ? ` (${missing} mancanti)` : ''}`;

  grid.innerHTML = cards.map(c => {
    const isPlayset = c.quantity >= 4;
    const isMissing = c.isMissing;
    return `
    <div class="card-entry relative cursor-pointer${isMissing ? ' card-missing' : ''}${isPlayset ? ' card-playset' : ''}" data-id="${c.id}" data-code="${c.card_code}">
      <div class="card-img-wrapper ${isMissing ? 'grayscale' : ''}">
        ${imageOrFallback(c.image_url, c.card_name)}
      </div>
      ${isPlayset ? '<span class="playset-diamond"></span>' : ''}
      ${isMissing ? '<div class="missing-overlay"><span>+</span></div>' : ''}
      <div class="card-label">
        <div class="card-label-row">
          <div class="min-w-0 flex-1">
            <div class="card-label-name">${c.card_name}</div>
            <div class="card-label-code">${c.card_code}</div>
          </div>
          ${!isMissing ? `<div class="qty-badge">${c.quantity}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  // Click su qualsiasi carta → apre bottom sheet
  grid.querySelectorAll('.card-entry').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.missing-overlay')) return;
      const code = el.dataset.code;
      const rc = refCardByCode[code];
      if (rc) openSheet(rc);
    });
  });

  // Click sul "+" overlay → apre bottom sheet
  grid.querySelectorAll('.card-missing .missing-overlay').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      const entry = el.closest('.card-entry');
      if (!entry) return;
      const code = entry.dataset.code;
      const rc = refCardByCode[code];
      if (rc) openSheet(rc);
    });
  });
}

function populateSetFilter() {
  const sel = document.getElementById('col-set-filter');
  const prevValue = sel.value;
  const sets = setOrder.length ? setOrder : [];
  const extra = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].filter(s => sets.indexOf(s) === -1);
  const allSets = [...sets, ...extra];
  sel.innerHTML = allSets.map(s => `<option value="${s}">${s}</option>`).join('');
  // Preserve previous selection or auto-select first set
  if (allSets.includes(prevValue)) sel.value = prevValue;
  else if (allSets.length) sel.value = allSets[0];
}

function filterCollection() {
  const query = document.getElementById('col-search').value.toLowerCase();
  const setFilter = document.getElementById('col-set-filter').value;

  // Se nessun filtro set → mostra solo carte possedute
  if (!setFilter) {
    return allCards.filter(c => {
      return !query ||
        c.card_name.toLowerCase().includes(query) ||
        c.card_code.toLowerCase().includes(query);
    });
  }

  // Filtro set attivo → mostra TUTTE le carte di reference + owned
  const currentSetCode = getSetCodeFromFilter();
  let refs;
  if (currentSetCode) {
    // Carte nel set + carte originarie di questo set ristampate altrove (es. GD01-100_p5 in GD03)
    refs = refCards.filter(rc =>
      rc.set_name === setFilter ||
      (rc.card_code.startsWith(currentSetCode) && rc.set_code !== currentSetCode)
    );
  } else {
    refs = refCards.filter(rc => rc.set_name === setFilter);
  }

  // Applica variant filter multi-selezione
  refs = refs.filter(rc => {
    const isRT = isTokenOrResource(rc.card_code);
    // Alt Art: _p O ristampa cross-set (card_code prefix ≠ set_code)
    const isAltArt = !isRT && (rc.card_code.includes('_p') || rc.card_code.split('-')[0] !== rc.set_code);
    const isBase = !isRT && !isAltArt;

    if (isRT) return activeFilters.resources;
    if (isAltArt) return activeFilters.altart;
    if (isBase) return activeFilters.base;
    return activeFilters.base; // fallback
  });

  // Ordina per card_code
  refs.sort((a, b) => a.card_code.localeCompare(b.card_code));

  const ownedMap = {};
  for (const c of allCards) {
    if (c.set_name === setFilter || (currentSetCode && c.card_code.startsWith(currentSetCode))) {
      ownedMap[c.card_code] = c;
    }
  }

  return refs.map(rc => {
    const owned = ownedMap[rc.card_code];
    return {
      id: owned?.id || null,
      card_code: rc.card_code,
      card_name: rc.card_name,
      set_name: rc.set_name,
      set_code: rc.set_code,
      image_url: rc.image_url,
      quantity: owned?.quantity || 0,
      rarity: owned?.rarity || null,
      isMissing: !owned,
    };
  }).filter(c => {
    if (!query) return true;
    return c.card_name.toLowerCase().includes(query) ||
           c.card_code.toLowerCase().includes(query);
  });
}

// ============ Collection Tab State ============
let currentColTab = 'cards'; // 'cards' | 'stats'

function switchColTab(tab) {
  currentColTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === tab);
    if (b.dataset.view === tab) {
      b.className = 'tab-btn active px-4 py-2 text-sm font-semibold border-b-2 transition text-primary border-primary';
    } else {
      b.className = 'tab-btn px-4 py-2 text-sm font-semibold border-b-2 transition text-secondary border-transparent hover:text-primary';
    }
  });

  const setFilter = document.getElementById('col-set-filter').value;
  const statsEl = document.getElementById('collection-stats');
  const cardsContent = document.getElementById('cards-content');

  if (tab === 'stats') {
    renderSetStatistics(setFilter);
    cardsContent.classList.add('hidden');
    statsEl.classList.remove('hidden');
  } else {
    statsEl.classList.add('hidden');
    cardsContent.classList.remove('hidden');
    renderCollection(filterCollection());
  }
}

// ============ Set Statistics ============
function renderSetStatistics(setName) {
  const container = document.getElementById('stats-content');
  const currentSetCode = setName.match(/\[(\w+)\]/)?.[1] || '';

  // Raccogli reference cards per questo set (stessa logica di filterCollection)
  const refs = refCards.filter(rc =>
    rc.set_name === setName ||
    (rc.card_code.startsWith(currentSetCode) && rc.set_code !== currentSetCode)
  );

  // Categorizza
  const baseCards = [];
  const altCards = [];
  const resTokens = [];

  for (const rc of refs) {
    const isRT = isTokenOrResource(rc.card_code);
    const isAltArt = !isRT && (rc.card_code.includes('_p') || rc.card_code.split('-')[0] !== rc.set_code);
    if (isRT) resTokens.push(rc);
    else if (isAltArt) altCards.push(rc);
    else baseCards.push(rc);
  }

  // Owned map per questo set
  const ownedMap = {};
  for (const c of allCards) {
    if (c.set_name === setName || (currentSetCode && c.card_code.startsWith(currentSetCode))) {
      ownedMap[c.card_code] = c;
    }
  }

  const totalOwned = Object.keys(ownedMap).reduce((sum, code) => sum + (ownedMap[code]?.quantity || 0), 0);
  const totalOwnedCards = Object.keys(ownedMap).length;

  function calcStats(cards) {
    const total = cards.length;
    const owned = cards.filter(c => ownedMap[c.card_code]).length;
    const x4 = cards.filter(c => (ownedMap[c.card_code]?.quantity || 0) >= 4).length;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    const pct4 = total > 0 ? Math.round((x4 / total) * 100) : 0;
    return { total, owned, x4, pct, pct4 };
  }

  function statCard(label, stats, barColor) {
    return `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${stats.pct}%</div>
        <div class="stat-sub">${stats.owned}/${stats.total} carte possedute</div>
        <div class="stat-bar">
          <div class="stat-bar-fill ${barColor}" style="width:${stats.pct}%"></div>
        </div>
        <div class="mt-3 pt-2 border-t border-gray-100">
          <div class="flex justify-between text-xs">
            <span class="text-secondary">Play set (x4)</span>
            <span class="font-semibold text-primary">${stats.pct4}% <span class="text-secondary font-normal">(${stats.x4}/${stats.total})</span></span>
          </div>
        </div>
      </div>`;
  }

  const baseStats = calcStats(baseCards);
  const altStats = calcStats(altCards);
  const rtStats = calcStats(resTokens);

  container.innerHTML = `
    <div class="col-span-full">
      <div class="stat-total-owned">
        <div class="stat-label">Carte possedute in questo set</div>
        <div class="stat-big">${totalOwned}</div>
        <div class="stat-sub">${totalOwnedCards} carte uniche</div>
      </div>
    </div>
    ${baseCards.length ? statCard('Set Base', baseStats, 'stat-bar-yellow') : ''}
    ${altCards.length ? statCard('Alt Art', altStats, 'stat-bar-blue') : ''}
    ${resTokens.length ? statCard('Risorse / Token', rtStats, 'stat-bar-green') : ''}
  `;
}

// ============ Bottom Sheet ============
let editingCardId = null;
let currentSheetCard = null;
let pendingSheetQty = 0;

function getAltVersions(cardName) {
  if (!cardName) return [];
  return refCards.filter(rc => rc.card_name === cardName);
}

function populateAltVersions(cardName, currentCode) {
  const container = document.getElementById('sheet-versions');
  const versions = getAltVersions(cardName);
  if (versions.length < 2) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = versions.map(v => {
    const isActive = v.card_code === currentCode;
    const isAlt = v.card_code.includes('_p') || v.card_code.split('-')[0] !== v.set_code;
    return `<button class="version-dot w-3 h-3 rounded-full transition border border-white shadow-sm${isActive ? ' version-dot-active' : ''}${isAlt ? ' version-dot-alt' : ' version-dot-base'}" data-code="${v.card_code}" title="${v.card_code}${v.set_code !== currentCode?.split('-')[0] ? ' [' + v.set_code + ']' : ''}"></button>`;
  }).join('');

  // Click su dot → salva quantità corrente, carica altra versione
  container.querySelectorAll('.version-dot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentSheetCard) {
        saveSheetQuantity(pendingSheetQty).catch(() => {});
      }
      const code = btn.dataset.code;
      const rc = refCardByCode[code];
      if (rc) loadSheetCard(rc);
    });
  });
}

function loadSheetCard(rc) {
  // Trova owned data
  const owned = allCards.find(c => c.card_code === rc.card_code && c.set_name === rc.set_name);
  const card = {
    id: owned?.id || null,
    card_code: rc.card_code,
    card_name: rc.card_name,
    set_name: rc.set_name,
    set_code: rc.set_code,
    image_url: rc.image_url,
    quantity: owned?.quantity || 0,
    rarity: owned?.rarity || null,
  };
  editingCardId = card.id;
  currentSheetCard = card;

  const img = document.getElementById('sheet-image');
  img.src = card.image_url || '';
  img.style.display = '';
  img.onerror = () => { img.style.display = 'none'; };
  img.onload = () => { img.style.display = ''; };

  document.getElementById('sheet-name').textContent = card.card_name;
  document.getElementById('sheet-code').textContent = card.card_code;
  document.getElementById('sheet-set').textContent = card.set_name || '';

  pendingSheetQty = card.quantity || 0;
  document.getElementById('sheet-qty-display').textContent = pendingSheetQty;

  populateAltVersions(card.card_name, card.card_code);
  updateCardtraderLink(card.card_code);
}

function updateCardtraderLink(cardCode) {
  const link = document.getElementById('sheet-cardtrader');
  const rc = refCardByCode[cardCode];
  if (rc && rc.cardtrader_slug) {
    link.href = `https://www.cardtrader.com/it/cards/${rc.cardtrader_slug}`;
  } else {
    const query = cardCode.replace(/-/g, '+');
    link.href = `https://www.cardtrader.com/it/cards?search=${query}`;
  }
}

async function saveSheetQuantity(newQty) {
  const errEl = document.getElementById('sheet-error');
  errEl.classList.add('hidden');
  if (!currentSheetCard || !currentSheetCard.card_code) return;
  try {
    if (editingCardId) {
      if (newQty <= 0) {
        await deleteCard(editingCardId);
      } else {
        await updateCard(editingCardId, { quantity: newQty });
      }
    } else if (newQty > 0) {
      const cardData = {
        card_name: currentSheetCard.card_name,
        card_code: currentSheetCard.card_code,
        set_name: currentSheetCard.set_name || null,
        rarity: currentSheetCard.rarity || null,
        quantity: newQty,
        image_url: currentSheetCard.image_url || null,
      };
      await addCard(cardData);
    }
    await refreshCards();
  } catch (err) {
    errEl.textContent = err.message || 'Errore.';
    errEl.classList.remove('hidden');
  }
}

function openSheet(card) {
  if (!card) return;
  const rc = refCardByCode[card.card_code];
  if (rc) {
    const sheet = document.getElementById('card-sheet');
    const panel = document.getElementById('sheet-panel');
    sheet.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    panel.style.transform = 'translateY(100%)';
    panel.getBoundingClientRect();
    panel.style.transform = 'translateY(0)';
    loadSheetCard(rc);
  }
}

function closeSheet() {
  // Salva la quantità prima di chiudere
  if (currentSheetCard) {
    saveSheetQuantity(pendingSheetQty).catch(() => {});
  }
  const panel = document.getElementById('sheet-panel');
  panel.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('card-sheet').classList.add('hidden');
    document.body.classList.remove('sheet-open');
    editingCardId = null;
    currentSheetCard = null;
    pendingSheetQty = 0;
  }, 250);
}

// ============ Refresh ============
async function refreshCards() {
  try {
    allCards = await loadCards();
    renderDashboardStats();
    renderLatestHorizontal();
    renderExpansionsList();
    populateSetFilter();
    renderCollection(filterCollection());
  } catch (err) {
    console.error('Errore caricamento carte:', err);
  }
}

// ============ Start ============
async function startApp() {
  const errEl = document.getElementById('start-error');
  errEl.classList.add('hidden');
  document.getElementById('start-btn').disabled = true;
  document.getElementById('start-btn').textContent = 'Connessione...';

  try {
    if (!SUPABASE_ANON_KEY) {
      throw new Error('Manca la chiave API. Inseriscila in app.js:3.');
    }
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        // Timeout di sicurezza: se SW non si attiva in 3s, procedi comunque
        setTimeout(resolve, 3000);
      });
    }
    await loadReferenceCards();
    await refreshCards();
    showSection('app-section');
    switchTab('dashboard');
    document.getElementById('bottom-dashboard').classList.add('active');
  } catch (err) {
    errEl.textContent = err.message;
    errEl.classList.remove('hidden');
    document.getElementById('start-btn').disabled = false;
    document.getElementById('start-btn').textContent = 'AVVIA';
  }
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', () => {
  // Start button
  document.getElementById('start-btn').addEventListener('click', startApp);

  // Bottom navigation
  document.getElementById('bottom-dashboard').addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('bottom-collection').addEventListener('click', () => {
    if (currentColTab !== 'cards') switchColTab('cards');
    currentColTab = 'cards';
    switchTab('collection');
  });

  // Decks / Profilo → coming soon
  document.getElementById('bottom-decks').addEventListener('click', () => {
    const btn = document.getElementById('bottom-decks');
    btn.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach(b => { if (b !== btn) b.classList.remove('active'); });
    showView('view-dashboard');
  });

  document.getElementById('bottom-profile').addEventListener('click', () => {
    const btn = document.getElementById('bottom-profile');
    btn.classList.add('active');
    document.querySelectorAll('.bottom-nav-item').forEach(b => { if (b !== btn) b.classList.remove('active'); });
    showView('view-dashboard');
  });

  // "Vedi tutte" on dashboard
  document.getElementById('latest-view-all').addEventListener('click', () => {
    if (currentColTab !== 'cards') switchColTab('cards');
    currentColTab = 'cards';
    switchTab('collection');
  });

  // Bottom Sheet events
  document.getElementById('sheet-overlay').addEventListener('click', closeSheet);

  document.getElementById('sheet-qty-minus').addEventListener('click', () => {
    if (pendingSheetQty > 0) {
      pendingSheetQty--;
      document.getElementById('sheet-qty-display').textContent = pendingSheetQty;
    }
  });

  document.getElementById('sheet-qty-plus').addEventListener('click', () => {
    pendingSheetQty++;
    document.getElementById('sheet-qty-display').textContent = pendingSheetQty;
  });

  // Collection filters
  let searchTimeout;
  document.getElementById('col-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (currentColTab === 'stats') switchColTab('cards');
      else renderCollection(filterCollection());
    }, 250);
  });

  document.getElementById('col-set-filter').addEventListener('change', () => {
    for (const k of Object.keys(activeFilters)) activeFilters[k] = k === 'base';
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('active', activeFilters[b.dataset.filter]));
    if (currentColTab === 'stats') switchColTab('cards');
    else renderCollection(filterCollection());
  });

  // Tab switching
  document.getElementById('tab-cards').addEventListener('click', () => switchColTab('cards'));
  document.getElementById('tab-stats').addEventListener('click', () => switchColTab('stats'));

  // Variant filter buttons (toggle)
  document.querySelectorAll('.variant-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleVariantFilter(btn.dataset.filter));
  });

  // Select All / Deselect All
  document.getElementById('select-all-btn').addEventListener('click', () => setAllFilters(true));
  document.getElementById('deselect-all-btn').addEventListener('click', () => setAllFilters(false));
});

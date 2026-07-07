// ============ Collection Overview ============

function renderCollectionOverview() {
  const decksContainer = document.getElementById('decks-list');
  const expansionsContainer = document.getElementById('expansions-grid');
  const decksEmpty = document.getElementById('decks-empty');
  const expansionsEmpty = document.getElementById('expansions-empty-overview');

  const ownedMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
  }

  const stSets = [];
  const gdEbSets = [];

  for (const setName of setOrder) {
    const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
    if (setCode.startsWith('ST')) {
      stSets.push(setName);
    } else {
      gdEbSets.push(setName);
    }
  }

  if (stSets.length) {
    decksEmpty.classList.add('hidden');
    decksContainer.innerHTML = stSets.map(setName => buildOverviewItem(setName, ownedMap)).join('');
    attachOverviewClick(decksContainer);
  } else {
    decksEmpty.classList.remove('hidden');
    decksContainer.innerHTML = '';
  }

  if (gdEbSets.length) {
    expansionsEmpty.classList.add('hidden');
    expansionsContainer.innerHTML = gdEbSets.map(setName => buildOverviewItem(setName, ownedMap)).join('');
    attachOverviewClick(expansionsContainer);
  } else {
    expansionsEmpty.classList.remove('hidden');
    expansionsContainer.innerHTML = '';
  }

  document.querySelectorAll('.col-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = btn.dataset.target;
      const target = document.getElementById(targetId);
      const emptyId = targetId === 'decks-list' ? 'decks-empty' : 'expansions-empty-overview';
      const emptyEl = document.getElementById(emptyId);
      const isCollapsed = btn.classList.toggle('collapsed');
      if (isCollapsed) {
        target.classList.add('hidden');
        if (emptyEl) emptyEl.classList.add('hidden');
      } else {
        const hasItems = target.children.length > 0;
        if (hasItems) {
          target.classList.remove('hidden');
        } else if (emptyEl) {
          emptyEl.classList.remove('hidden');
        }
      }
    });
  });
}

function buildOverviewItem(setName, ownedMap) {
  const total = setTotals[setName] || 0;
  const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
  const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
  const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
  const cleanName = setName.replace(/\s*\[.*?\]/, '');
  const r = 34;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;

  return `
    <div class="col-set-entry rounded-xl border p-3" data-set="${escapeHtml(setName)}" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.12);">
      <div class="flex items-center gap-3">
        <div class="relative w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
          <svg class="w-full h-full" viewBox="0 0 100 100">
            <circle cx="50" cy="50" fill="transparent" r="${r}" stroke="rgba(255,255,255,0.1)" stroke-width="8"></circle>
            <circle cx="50" cy="50" fill="transparent" r="${r}"
              stroke="#fb2f38" stroke-width="8" stroke-linecap="round"
              stroke-dasharray="${circumference}" stroke-dashoffset="${pct > 0 ? offset : circumference}"
              style="transform:rotate(-90deg);transform-origin:50% 50%"></circle>
          </svg>
          <span class="absolute text-[10px] font-bold font-heading" style="color:rgba(255,255,255,0.9)">${pct}%</span>
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate" style="color:#fff">${escapeHtml(cleanName)}</p>
          <div class="flex gap-2 items-center mt-0.5">
            <span class="font-mono text-[10px] px-1 border rounded" style="border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6)">${escapeHtml(setCode)}</span>
            <span class="font-mono text-[10px]" style="color:rgba(255,255,255,0.5)">${owned}/${total}</span>
          </div>
        </div>
      </div>
    </div>`;
}

function attachOverviewClick(container) {
  container.querySelectorAll('.col-set-entry').forEach(el => {
    el.addEventListener('click', () => {
      const setName = el.dataset.set;
      showCollectionDetail(setName);
    });
  });
}

function showCollectionDetail(setName) {
  document.getElementById('collection-overview').classList.add('hidden');
  document.getElementById('collection-detail').classList.remove('hidden');

  document.getElementById('col-set-filter').value = setName;
  document.getElementById('col-search').value = '';
  for (const k of Object.keys(activeFilters)) activeFilters[k] = k === 'base';
  activeFilters.resources = false;
  syncFilterUI();

  currentColTab = 'cards';
  document.querySelectorAll('.tab-btn').forEach(b => {
    const tab = b.dataset.view;
    if (tab === 'cards') {
      b.className = 'tab-btn active px-4 py-2 text-sm font-semibold border-b-2 transition text-white border-b-white';
    } else {
      b.className = 'tab-btn px-4 py-2 text-sm font-semibold border-b-2 transition text-white/60 border-transparent hover:text-white';
    }
  });

  document.getElementById('collection-stats').classList.add('hidden');
  document.getElementById('cards-content').classList.remove('hidden');
  renderCollection(filterCollection());
}

function showCollectionOverview() {
  document.getElementById('collection-detail').classList.add('hidden');
  document.getElementById('collection-overview').classList.remove('hidden');
  renderCollectionOverview();
}

const activeFilters = { base: true, altart: false, resources: false };

// Filtri tipo/colore/livello/costo rimossi: reference_cards.json non contiene ancora quei campi

function getSetCodeFromFilter() {
  const setFilter = document.getElementById('col-set-filter').value;
  return setFilter.match(/\[(\w+)\]/)?.[1] || '';
}

function enforceFilterFallback() {
  if (!activeFilters.base && !activeFilters.altart && !activeFilters.resources) {
    activeFilters.base = true;
  }
}

function syncFilterUI() {
  document.querySelectorAll('#filter-drawer .variant-btn').forEach(b => {
    b.classList.toggle('active', activeFilters[b.dataset.filter]);
  });
}

function toggleVariantFilter(filterName) {
  if (filterName === 'resources') {
    if (activeFilters.resources) {
      activeFilters.resources = false;
      activeFilters.altart = false;
    } else {
      activeFilters.base = false;
      activeFilters.altart = false;
      activeFilters.resources = true;
    }
  } else if (filterName === 'altart') {
    activeFilters.altart = !activeFilters.altart;
    activeFilters.resources = false;
  } else if (filterName === 'base') {
    if (activeFilters.base) {
      if (!activeFilters.altart && !activeFilters.resources) {
        syncFilterUI();
        return;
      }
      activeFilters.base = false;
    } else {
      activeFilters.base = true;
    }
  }

  enforceFilterFallback();
  syncFilterUI();
  if (currentColTab !== 'stats') renderCollection(filterCollection());
}

function resetFilters() {
  activeFilters.base = true;
  activeFilters.altart = false;
  activeFilters.resources = false;
  document.querySelectorAll('#filter-drawer .variant-btn').forEach(b => {
    b.classList.toggle('active', activeFilters[b.dataset.filter]);
  });


  closeFilterDrawer();
  if (currentColTab !== 'stats') renderCollection(filterCollection());
}

function openFilterDrawer() {
  const panel = document.getElementById('filter-drawer-panel');
  const drawer = document.getElementById('filter-drawer');
  drawer.classList.remove('hidden');
  drawer.getBoundingClientRect();
  panel.style.transform = 'translateX(0)';
}

function closeFilterDrawer() {
  const panel = document.getElementById('filter-drawer-panel');
  panel.style.transform = 'translateX(100%)';
  setTimeout(() => {
    document.getElementById('filter-drawer').classList.add('hidden');
  }, 200);
}

function initFilterDrawer() {
  // Nessun altro setup: i filtri tipo/colore/livello/costo sono stati rimossi
  // perché reference_cards.json non contiene ancora quei campi.
}

function openFirstRefCard() {
  const setFilter = document.getElementById('col-set-filter').value;
  if (setFilter) {
    const ref = refCards.find(rc => rc.set_name === setFilter);
    if (ref) openSheet(ref);
  }
}

function renderCollection(cards) {
  const grid = document.getElementById('collection-grid');
  const empty = document.getElementById('collection-empty');
  const summary = document.getElementById('collection-summary');

  if (!cards.length) {
    empty.classList.add('hidden');
    summary.textContent = '';
    grid.innerHTML = Array.from({length:6}, (_,i) => `
      <div class="card-placeholder" data-idx="${i}">
        <div class="plus-icon">+</div>
        <div class="plus-label">Premi qui per<br>aggiungere la tua carta</div>
      </div>
    `).join('');
    grid.querySelectorAll('.card-placeholder').forEach(el => {
      el.addEventListener('click', () => openFirstRefCard());
    });
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
    <div class="card-entry relative cursor-pointer${isMissing ? ' card-missing' : ''}${isPlayset ? ' card-playset' : ''}" data-id="${escapeHtml(c.id)}" data-code="${escapeHtml(c.card_code)}">
      ${!isMissing ? '<div class="absolute top-0 left-0 right-0 h-[3px] bg-[#fb2f38] z-10 rounded-t-lg"></div>' : ''}
      <div class="card-img-wrapper ${isMissing ? 'grayscale' : ''}">
        ${imageOrFallback(getCardImageUrl(c.card_code), c.card_name)}
      </div>
      ${isPlayset ? '<span class="playset-diamond"></span>' : ''}
      ${isMissing ? '<div class="missing-overlay"><span>+</span></div>' : ''}
      <div class="card-label">
        <div class="card-label-row">
          <div class="min-w-0 flex-1">
            <div class="card-label-name">${escapeHtml(c.card_name)}</div>
            <div class="card-label-code">${escapeHtml(c.card_code)}</div>
          </div>
          ${!isMissing ? `<div class="qty-badge">${escapeHtml(c.quantity)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.card-entry').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.missing-overlay')) return;
      const code = el.dataset.code;
      const rc = refCardByCode[code];
      if (rc) openSheet(rc);
    });
  });

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
  if (allSets.includes(prevValue)) sel.value = prevValue;
  else if (allSets.length) sel.value = allSets[0];
}

function filterCollection() {
  const query = document.getElementById('col-search').value.toLowerCase();
  const setFilter = document.getElementById('col-set-filter').value;

  if (!setFilter) {
    return allCards.filter(c => {
      return !query ||
        c.card_name.toLowerCase().includes(query) ||
        c.card_code.toLowerCase().includes(query);
    });
  }

  const currentSetCode = getSetCodeFromFilter();
  let refs;
  if (currentSetCode) {
    refs = refCards.filter(rc =>
      rc.set_name === setFilter ||
      (rc.card_code.startsWith(currentSetCode) && rc.set_code !== currentSetCode)
    );
  } else {
    refs = refCards.filter(rc => rc.set_name === setFilter);
  }

  refs = refs.filter(rc => {
    const isRT = isTokenOrResource(rc.card_code);
    const isAltArt = !isRT && (rc.card_code.includes('_p') || rc.card_code.split('-')[0] !== rc.set_code);
    const isBase = !isRT && !isAltArt;

    if (isRT) return activeFilters.resources;
    if (isAltArt) {
      if (!activeFilters.altart) return false;
      if (currentSetCode) return rc.card_code.startsWith(currentSetCode);
      return true;
    }
    if (isBase) return activeFilters.base;
    return activeFilters.base;
  });

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
      quantity: owned?.quantity || 0,
      rarity: owned?.rarity || null,
      card_type: rc.card_type || null,
      color: rc.color || null,
      level: rc.level != null ? rc.level : null,
      cost: rc.cost != null ? rc.cost : null,
      isMissing: !owned,
    };
  }).filter(c => {
    if (!query) return true;
    return c.card_name.toLowerCase().includes(query) ||
           c.card_code.toLowerCase().includes(query);
  });
}

function switchColTab(tab) {
  currentColTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === tab);
    if (b.dataset.view === tab) {
      b.className = 'tab-btn active px-4 py-2 text-sm font-semibold border-b-2 transition text-white border-b-white';
    } else {
      b.className = 'tab-btn px-4 py-2 text-sm font-semibold border-b-2 transition text-white/60 border-transparent hover:text-white';
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

function renderSetStatistics(setName) {
  const container = document.getElementById('stats-content');
  const currentSetCode = setName.match(/\[(\w+)\]/)?.[1] || '';

  const refs = refCards.filter(rc =>
    rc.set_name === setName ||
    (rc.card_code.startsWith(currentSetCode) && rc.set_code !== currentSetCode)
  );

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

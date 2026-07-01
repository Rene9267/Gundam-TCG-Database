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
    <div class="card-entry relative cursor-pointer${isMissing ? ' card-missing' : ''}${isPlayset ? ' card-playset' : ''}" data-id="${c.id}" data-code="${c.card_code}">
      ${!isMissing ? '<div class="absolute top-0 left-0 right-0 h-[3px] bg-[#fb2f38] z-10 rounded-t-lg"></div>' : ''}
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
    if (isAltArt) return activeFilters.altart;
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

let collectionGridDelegationReady = false;

function initCollectionGridDelegation() {
  if (collectionGridDelegationReady) return;
  const grid = document.getElementById('collection-grid');
  if (!grid) return;
  collectionGridDelegationReady = true;

  grid.addEventListener('click', (e) => {
    const placeholder = e.target.closest('.card-placeholder');
    if (placeholder) {
      openFirstRefCard();
      return;
    }
    const overlay = e.target.closest('.missing-overlay');
    if (overlay) {
      e.stopPropagation();
      const entry = overlay.closest('.card-entry');
      if (!entry) return;
      const code = entry.dataset.code;
      const rc = refCardByCode[code];
      if (rc) openSheet(rc);
      return;
    }
    const entry = e.target.closest('.card-entry');
    if (!entry) return;
    const code = entry.dataset.code;
    const rc = refCardByCode[code];
    if (rc) openSheet(rc);
  });
}

function openFirstRefCard() {
  const setFilter = document.getElementById('col-set-filter').value;
  if (setFilter) {
    const ref = refCards.find(rc => rc.set_name === setFilter);
    if (ref) openSheet(ref);
  }
}

function renderCollectionPagination(totalCards, pageCount) {
  const pager = document.getElementById('collection-pagination');
  if (!pager) return;
  if (pageCount <= 1) {
    pager.classList.add('hidden');
    pager.innerHTML = '';
    return;
  }
  pager.classList.remove('hidden');
  const start = collectionPage * COLLECTION_PAGE_SIZE + 1;
  const end = Math.min((collectionPage + 1) * COLLECTION_PAGE_SIZE, totalCards);
  pager.innerHTML = `
    <button type="button" id="col-page-prev" class="px-3 py-1.5 text-xs rounded-lg border border-white/20 text-white/80 disabled:opacity-40" ${collectionPage === 0 ? 'disabled' : ''}>Prec</button>
    <span class="text-xs text-white/60 font-mono">${start}-${end} / ${totalCards}</span>
    <button type="button" id="col-page-next" class="px-3 py-1.5 text-xs rounded-lg border border-white/20 text-white/80 disabled:opacity-40" ${collectionPage >= pageCount - 1 ? 'disabled' : ''}>Succ</button>
  `;
  document.getElementById('col-page-prev')?.addEventListener('click', () => {
    if (collectionPage > 0) {
      collectionPage--;
      renderCollection(filterCollection());
    }
  });
  document.getElementById('col-page-next')?.addEventListener('click', () => {
    if (collectionPage < pageCount - 1) {
      collectionPage++;
      renderCollection(filterCollection());
    }
  });
}

function renderCollection(cards) {
  initCollectionGridDelegation();
  const grid = document.getElementById('collection-grid');
  const empty = document.getElementById('collection-empty');
  const summary = document.getElementById('collection-summary');

  const levelMin = Number(document.getElementById('level-min')?.value) || 1;
  const levelMax = Number(document.getElementById('level-max')?.value) || 10;
  const costMin = Number(document.getElementById('cost-min')?.value) || 0;
  const costMax = Number(document.getElementById('cost-max')?.value) || 10;

  const filtersActive =
    (document.getElementById('col-search')?.value || '').trim() !== '' ||
    !activeFilters.base || activeFilters.altart || activeFilters.resources ||
    Object.values(cardTypeFilters).some(Boolean) ||
    Object.values(colorFilters).some(Boolean) ||
    levelMin > 1 || levelMax < 10 || costMin > 0 || costMax < 10;

  if (!cards.length) {
    empty.classList.add('hidden');
    summary.textContent = '';
    renderCollectionPagination(0, 0);
    if (filtersActive) {
      grid.innerHTML = `<div class="col-span-2 md:col-span-4 text-center py-10 text-white/60 text-sm">Nessuna carta corrisponde ai filtri</div>`;
      return;
    }
    grid.innerHTML = Array.from({length:6}, (_,i) => `
      <div class="card-placeholder" data-idx="${i}">
        <div class="plus-icon">+</div>
        <div class="plus-label">Premi qui per<br>aggiungere la tua carta</div>
      </div>
    `).join('');
    return;
  }

  empty.classList.add('hidden');
  const total = cards.length;
  const owned = cards.filter(c => !c.isMissing).length;
  const missing = total - owned;
  summary.textContent = `${owned}/${total} carte possedute${missing > 0 ? ` (${missing} mancanti)` : ''}`;

  const pageCount = Math.ceil(total / COLLECTION_PAGE_SIZE);
  if (collectionPage >= pageCount) collectionPage = pageCount - 1;
  if (collectionPage < 0) collectionPage = 0;
  const pageCards = cards.slice(
    collectionPage * COLLECTION_PAGE_SIZE,
    (collectionPage + 1) * COLLECTION_PAGE_SIZE
  );

  grid.innerHTML = pageCards.map(c => {
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

  renderCollectionPagination(total, pageCount);
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
    collectionPage = 0;
    renderCollection(filterCollection());
  }
}

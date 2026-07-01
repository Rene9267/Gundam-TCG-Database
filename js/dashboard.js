function renderDashboardStats() {
  document.getElementById('stat-total-cards').textContent = allCards.length;
}

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
    <article class="min-w-[225px] w-[225px] snap-start flex-shrink-0 relative cursor-pointer group latest-entry" data-code="${c.card_code}">
      <div class="aspect-[5/7] rounded-lg overflow-hidden border relative shadow-sm" style="background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.15)">
        ${imageOrFallback(c.image_url, c.card_name)}
        <div class="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p class="text-[9px] font-mono text-white/80 truncate">${c.card_code}</p>
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

function renderExpansionsList() {
  const container = document.getElementById('expansions-list');
  const empty = document.getElementById('expansions-empty');

  const ownedMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
  }

  const last4 = setOrder.slice(-4);

  empty.classList.add('hidden');

  const items = last4.map(setName => {
    const total = setTotals[setName] || 0;
    const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
    const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
    const r = 34;
    const circumference = 2 * Math.PI * r;
    const offset = circumference - (pct / 100) * circumference;
    const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
    const cleanName = setName.replace(/\s*\[.*?\]/, '');

    return `
      <div class="exp-entry rounded-xl border p-3 flex items-center justify-between hover:shadow-sm transition cursor-pointer shadow-sm" data-set="${setName}" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.12);">
        <div class="flex items-center gap-3">
          <div class="relative w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
            <svg class="w-full h-full" viewBox="0 0 100 100">
              <circle cx="50" cy="50" fill="transparent" r="${r}" stroke="rgba(255,255,255,0.1)" stroke-width="8"></circle>
              <circle cx="50" cy="50" fill="transparent" r="${r}"
                stroke="#fb2f38" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${circumference}" stroke-dashoffset="${pct > 0 ? offset : circumference}"
                style="transform:rotate(-90deg);transform-origin:50% 50%;transition:stroke-dashoffset 0.35s"></circle>
            </svg>
            <span class="absolute text-[10px] font-bold font-heading" style="color:rgba(255,255,255,0.9)">${pct}%</span>
          </div>
          <div>
            <p class="text-sm font-semibold" style="color:#fff">${cleanName}</p>
            <div class="flex gap-2 items-center mt-0.5">
              <span class="font-mono text-[10px] px-1 border rounded" style="border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6)">${setCode}</span>
              <span class="font-mono text-[10px]" style="color:rgba(255,255,255,0.5)">${owned}/${total}</span>
            </div>
          </div>
        </div>
        <svg viewBox="0 0 24 24" width="18" height="18" fill="rgba(255,255,255,0.3)"><path d="M9.29 6.71a.996.996 0 000 1.41L13.17 12l-3.88 3.88a.996.996 0 101.41 1.41l4.59-4.59a.996.996 0 000-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z"/></svg>
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

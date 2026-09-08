function renderDashboardStats() {
  const el = document.getElementById('stat-total-cards');
  if (el) el.textContent = allCards.length;
}

function renderLatestHorizontal() {
  const scroll = document.getElementById('latest-scroll');
  const empty = document.getElementById('latest-empty');
  if (!scroll || !empty) return;
  const latest = allCards.slice(0, 10);

  if (!latest.length) {
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');

  const items = latest.map(c => `
    <article class="min-w-[225px] w-[225px] snap-start flex-shrink-0 relative cursor-pointer group latest-entry" data-code="${escapeHtml(c.card_code)}">
      <div class="aspect-[5/7] rounded-lg overflow-hidden border relative shadow-sm" style="background:rgba(255,255,255,0.12);border-color:rgba(255,255,255,0.15)">
        ${imageOrFallback(getCardImageUrl(c.card_code), c.card_name)}
        <div class="absolute bottom-0 left-0 right-0 p-1.5 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
          <p class="text-[9px] font-mono text-white/80 truncate">${escapeHtml(c.card_code)}</p>
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
  if (!container || !empty) return;

  const ownedMap = {};
  const setLastModified = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
    const ts = c.updated_at || c.created_at;
    if (ts && (!setLastModified[key] || ts > setLastModified[key])) {
      setLastModified[key] = ts;
    }
  }

  const active = setOrder.filter(s => ownedMap[s] && ownedMap[s].size > 0);
  active.sort((a, b) => {
    const ta = setLastModified[a] || '';
    const tb = setLastModified[b] || '';
    return tb.localeCompare(ta);
  });
  const top = active.slice(0, 4);

  if (!top.length) {
    empty.classList.remove('hidden');
    container.innerHTML = '';
    return;
  }
  empty.classList.add('hidden');

  container.innerHTML = top.map(setName => {
    const total = setTotals[setName] || 0;
    const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
    return `
      <div class="exp-entry rounded-xl border p-3 flex items-center justify-between hover:shadow-sm transition cursor-pointer shadow-sm" data-set="${escapeHtml(setName)}" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.12);">
        ${renderSetProgressCard(setName, owned, total, 'w-full', true)}
      </div>`;
  }).join('');

  container.querySelectorAll('.exp-entry').forEach(el => {
    el.addEventListener('click', () => {
      const setName = el.dataset.set;
      switchTab('collection', setName);
    });
  });
}

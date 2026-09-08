const activeFilters = { base: true, altart: false, resources: false };
const cardTypeFilters = { unit: false, pilot: false, command: false, base: false };
const colorFilters = { white: false, blue: false, green: false, red: false, purple: false };

const chipFill = {
  white:  { bg: '#e5e7eb', text: '#111827', border: '#e5e7eb' },
  blue:   { bg: '#2563eb', text: '#ffffff', border: '#2563eb' },
  green:  { bg: '#16a34a', text: '#ffffff', border: '#16a34a' },
  red:    { bg: '#dc2626', text: '#ffffff', border: '#dc2626' },
  purple: { bg: '#9333ea', text: '#ffffff', border: '#9333ea' },
};

let filterSliderTimeout = null;

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
    if (b.dataset.filter) {
      b.classList.toggle('active', activeFilters[b.dataset.filter]);
    }
    if (b.dataset.ctype) {
      b.classList.toggle('active', cardTypeFilters[b.dataset.ctype]);
    }
  });
  document.querySelectorAll('#filter-drawer .color-chip').forEach(b => {
    const active = !!colorFilters[b.dataset.color];
    b.classList.toggle('active', active);
    const cfg = chipFill[b.dataset.color];
    if (active && cfg) {
      b.style.background = cfg.bg;
      b.style.color = cfg.text;
      b.style.borderColor = cfg.border;
    } else {
      b.style.background = '';
      b.style.color = '';
      b.style.borderColor = '';
    }
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
  if (currentColTab !== 'stats') {
    collectionPage = 0;
    renderCollection(filterCollection());
  }
}

function resetCollectionFilters() {
  const search = document.getElementById('col-search');
  if (search) search.value = '';
  activeFilters.base = true;
  activeFilters.altart = false;
  activeFilters.resources = false;
  Object.keys(cardTypeFilters).forEach(k => cardTypeFilters[k] = false);
  Object.keys(colorFilters).forEach(k => colorFilters[k] = false);
  const sliderDefaults = { 'level-min': 1, 'level-max': 10, 'cost-min': 0, 'cost-max': 10 };
  Object.keys(sliderDefaults).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = sliderDefaults[id];
  });
  updateRangeLabels();
  closeFilterDrawer();
  syncFilterUI();
  collectionPage = 0;
}

function resetFilters() {
  resetCollectionFilters();
  if (currentColTab !== 'stats') renderCollection(filterCollection());
}

function toggleCategoryFilter(value, category) {
  const filters = category === 'type' ? cardTypeFilters : colorFilters;
  filters[value] = !filters[value];
  syncFilterUI();
  if (currentColTab !== 'stats') {
    collectionPage = 0;
    renderCollection(filterCollection());
  }
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

function updateRangeLabels() {
  const lm = document.getElementById('level-min');
  const lx = document.getElementById('level-max');
  const cm = document.getElementById('cost-min');
  const cx = document.getElementById('cost-max');
  const ll = document.getElementById('level-range-label');
  const cl = document.getElementById('cost-range-label');
  if (ll && lm && lx) ll.textContent = `${lm.value} - ${lx.value}`;
  if (cl && cm && cx) cl.textContent = `${cm.value} - ${cx.value}`;
}

function scheduleFilterRender() {
  clearTimeout(filterSliderTimeout);
  filterSliderTimeout = setTimeout(() => {
    if (currentColTab !== 'stats') {
      collectionPage = 0;
      renderCollection(filterCollection());
    }
  }, 200);
}

function initFilterDrawer() {
  document.querySelectorAll('#filter-drawer [data-ctype]').forEach(btn => {
    btn.addEventListener('click', () => toggleCategoryFilter(btn.dataset.ctype, 'type'));
  });
  document.querySelectorAll('#filter-drawer [data-color]').forEach(btn => {
    btn.addEventListener('click', () => toggleCategoryFilter(btn.dataset.color, 'color'));
  });

  ['level-min', 'level-max', 'cost-min', 'cost-max'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('mousedown', e => e.stopPropagation());
    el.addEventListener('mousemove', e => e.stopPropagation());
    el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
    el.addEventListener('touchmove', e => e.stopPropagation(), { passive: true });
    el.addEventListener('touchend', e => e.stopPropagation(), { passive: true });
    el.addEventListener('touchcancel', e => e.stopPropagation(), { passive: true });
    el.addEventListener('input', () => {
      updateRangeLabels();
      scheduleFilterRender();
    });
  });

  initFilterDrawerTouch();
  updateRangeLabels();

  document.querySelectorAll('.col-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const targetId = e.currentTarget.dataset.target;
      const target = document.getElementById(targetId);
      const emptyId = targetId === 'decks-list' ? 'decks-empty' : 'expansions-empty-overview';
      const emptyEl = document.getElementById(emptyId);
      const svg = btn.querySelector('svg');
      const isCollapsed = target.classList.contains('hidden');
      if (isCollapsed) {
        target.classList.remove('hidden');
        emptyEl?.classList.add('hidden');
        svg?.classList.remove('rotate-180');
      } else {
        target.classList.add('hidden');
        svg?.classList.add('rotate-180');
      }
    });
  });
}

function initFilterDrawerTouch() {
  const drawer = document.getElementById('filter-drawer');
  const panel = document.getElementById('filter-drawer-panel');
  if (!drawer || !panel) return;

  const SWIPE_THRESHOLD = 50;
  let startX = 0;
  let startY = 0;
  let dragging = false;

  drawer.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { dragging = false; return; }
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
  }, { passive: true });

  drawer.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy)) {
      e.preventDefault();
      panel.style.transition = 'none';
      panel.style.transform = `translateX(${Math.max(0, dx)}px)`;
    }
  }, { passive: false });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    panel.style.transition = '';
    if (dx > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      closeFilterDrawer();
    } else {
      panel.style.transform = 'translateX(0)';
    }
    startX = 0;
    startY = 0;
  };
  drawer.addEventListener('touchend', endDrag, { passive: true });
  drawer.addEventListener('touchcancel', endDrag, { passive: true });
}

function updateSetHeader() {
  const sel = document.getElementById('col-set-filter');
  const titleEl = document.getElementById('col-current-title');
  const codeEl = document.getElementById('col-set-code');
  if (!sel || !titleEl) return;
  const full = sel.value || '';
  const code = full.match(/\[(\w+)\]/)?.[1] || '';
  titleEl.textContent = full;
  if (codeEl) codeEl.textContent = code;
}

function populateSetFilter() {
  const sel = document.getElementById('col-set-filter');
  const prevValue = sel.value;
  const sets = setOrder.length ? setOrder : [];
  const extra = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].filter(s => sets.indexOf(s) === -1);
  const allSets = [...sets, ...extra];
  sel.innerHTML = allSets.map(s => {
    const esc = escapeHtml(s);
    return `<option value="${esc}" title="${esc}">${esc}</option>`;
  }).join('');
  if (allSets.includes(prevValue)) sel.value = prevValue;
  else if (allSets.length) sel.value = allSets[0];
  updateSetHeader();
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
    if (activeFilters.resources && !activeFilters.altart) {
      if (!isTokenOrResource(rc.card_code)) return false;
      return true;
    }
    const variant = classifyCardVariant(rc);
    if (variant === 'resource') return activeFilters.resources;
    if (variant === 'altart') {
      if (!activeFilters.altart) return false;
      if (currentSetCode) return rc.card_code.startsWith(currentSetCode);
      return true;
    }
    return activeFilters.base;
  });

  if (activeFilters.resources && !activeFilters.altart) {
    const byBase = new Map();
    for (const rc of refs) {
      const baseId = cardBaseId(rc.card_code);
      const group = byBase.get(baseId) || [];
      group.push(rc);
      byBase.set(baseId, group);
    }
    const keep = new Set();
    for (const group of byBase.values()) {
      const canonical = pickCanonicalResourceCard(group);
      if (canonical) keep.add(canonical.card_code);
    }
    refs = refs.filter(rc => keep.has(rc.card_code));
  }

  const anyTypeActive = Object.values(cardTypeFilters).some(Boolean);
  if (anyTypeActive) {
    refs = refs.filter(rc => cardTypeFilters[rc.card_type?.toLowerCase()]);
  }

  const anyColorActive = Object.values(colorFilters).some(Boolean);
  if (anyColorActive) {
    refs = refs.filter(rc => colorFilters[rc.color?.toLowerCase()]);
  }

  const levelMin = Number(document.getElementById('level-min')?.value) || 1;
  const levelMax = Number(document.getElementById('level-max')?.value) || 10;
  const costMin = Number(document.getElementById('cost-min')?.value) || 0;
  const costMax = Number(document.getElementById('cost-max')?.value) || 10;
  if (levelMin > 1 || levelMax < 10 || costMin > 0 || costMax < 10) {
    refs = refs.filter(rc => {
      const lvl = rc.level != null ? rc.level : 0;
      const cst = rc.cost != null ? rc.cost : 0;
      if (lvl < levelMin || lvl > levelMax) return false;
      if (cst < costMin || cst > costMax) return false;
      return true;
    });
  }

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

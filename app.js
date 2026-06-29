// ============ Configurazione Supabase ============
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yeP5henLm-YdNtkwCFuV0Q_tE1koERf';

let _supabase = null;

// ============ Reference Cards (database mastro) ============
let refCards = [];
let refCardByCode = {};
let setTotals = {};
let setOrder = [];

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

// ============ Cards CRUD ============
async function loadCards() {
  if (!_supabase) return [];
  const { data, error } = await _supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addCard(card) {
  const { data, error } = await _supabase
    .from('cards')
    .insert([card])
    .select();
  if (error) throw error;
  return data[0];
}

async function updateCard(id, updates) {
  const { data, error } = await _supabase
    .from('cards')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
}

async function deleteCard(id) {
  const { error } = await _supabase
    .from('cards')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============ UI Helpers ============
function showSection(id) {
  document.querySelectorAll('#splash-section, #app-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showView(id) {
  document.querySelectorAll('#view-dashboard, #view-collection').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
  closeSidebar();
}

// Sidebar
function openSidebar() {
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebar-overlay').classList.remove('hidden');
}

function closeSidebar() {
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebar-overlay').classList.add('hidden');
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
  if (code.startsWith('GD')) return 'gd';
  return 'other';
}

// ============ Dashboard — Ultime Aggiunte ============
function renderLatest() {
  const grid = document.getElementById('latest-grid');
  const empty = document.getElementById('latest-empty');
  const latest = allCards.slice(0, 8);

  if (!latest.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = latest.map(c => `
    <div class="card-entry rounded-lg overflow-hidden shadow-sm">
      ${imageOrFallback(c.image_url, c.card_name)}
      <div class="p-3">
        <h3 class="font-semibold text-sm truncate text-gundam-dark" title="${c.card_name}">${c.card_name}</h3>
        <p class="text-xs text-gundam-muted truncate">${c.card_code}</p>
        ${c.set_name ? `<p class="text-xs text-gundam-muted/60 truncate mt-0.5">${c.set_name}</p>` : ''}
      </div>
    </div>
  `).join('');
}

// ============ Dashboard — Cerchi Completamento ============
function renderCompletionCircles() {
  const container = document.getElementById('completion-circles');

  // Raccogli le carte possedute per set (unique card_code)
  const ownedMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
  }

  const r = 50;
  const circumference = 2 * Math.PI * r;
  let lastGroup = null;

  if (!setOrder.length) return;

  const items = [];
  setOrder.forEach(setName => {
    const group = setGroup(setName);
    if (lastGroup && group !== lastGroup) {
      items.push(`<div class="col-span-full border-t border-gundam-red my-2"></div>`);
    }
    lastGroup = group;

    const total = setTotals[setName] || 0;
    const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
    const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
    const offset = circumference - (pct / 100) * circumference;
    const strokeColor = group === 'st' ? '#eab308' : '#2563eb';

    items.push(`
      <div class="set-circle flex flex-col items-center gap-1 py-2 cursor-pointer rounded-lg hover:bg-gray-50 transition" data-set="${setName}">
        <div class="relative w-[120px] h-[120px] flex items-center justify-center">
          <svg width="120" height="120" viewBox="0 0 120 120" class="completion-ring absolute inset-0">
            <circle cx="60" cy="60" r="${r}" class="completion-ring-bg" stroke-width="7"/>
            <circle cx="60" cy="60" r="${r}" class="completion-ring-fg"
              stroke-width="7"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${owned > 0 ? offset : circumference}"
              stroke="${strokeColor}"/>
          </svg>
          <span class="text-xl font-bold text-gundam-dark z-10">${pct}%</span>
        </div>
        <span class="text-sm text-gundam-muted text-center max-w-[120px] truncate leading-tight" title="${setName}">${setName}</span>
        <span class="text-xs text-gundam-muted/60">${owned}/${total}</span>
      </div>
    `);
  });

  container.innerHTML = items.join('');

  // Click sui cerchi → vai alla collezione filtrata per quel set
  container.querySelectorAll('.set-circle').forEach(el => {
    el.addEventListener('click', () => {
      const setName = el.dataset.set;
      document.getElementById('col-set-filter').value = setName;
      document.getElementById('col-search').value = '';
      // Attiva nav collezione nella sidebar
      document.querySelectorAll('.side-nav').forEach(n => {
        n.className = 'side-nav flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-gundam-muted hover:text-gundam-dark hover:bg-gray-50 transition';
      });
      document.getElementById('side-collection').className = 'side-nav active flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-gundam-yellow bg-yellow-50 transition';
      showView('view-collection');
      renderCollection(filterCollection());
    });
  });
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
    <div class="card-entry rounded-lg overflow-hidden shadow-sm relative${isMissing ? ' card-missing' : ''}" data-id="${c.id}" data-code="${c.card_code}">
      <div class="relative">
        <div class="card-img-wrapper ${isMissing ? 'grayscale' : ''}">
          ${imageOrFallback(c.image_url, c.card_name)}
        </div>
        ${isPlayset ? '<span class="playset-diamond"></span>' : ''}
        ${isMissing ? '<div class="missing-overlay"><span>+</span></div>' : ''}
      </div>
      <div class="px-3 pb-3 pt-2">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0 flex-1">
            <h3 class="font-semibold text-xs truncate text-gundam-dark" title="${c.card_name}">${c.card_name}</h3>
            <p class="text-[11px] text-gundam-muted truncate">${c.card_code}</p>
            ${isMissing ? '<span class="text-[10px] text-gundam-red font-medium">non posseduta</span>' :
              `<span class="text-[10px] font-medium ${rarityColor(c.rarity)}">${c.rarity || '—'}</span>`}
          </div>
          ${!isMissing ? `<div class="qty-quarter shrink-0">
            <span class="text-xs font-bold text-white leading-none">${c.quantity}</span>
          </div>` : ''}
        </div>
        <div class="flex gap-1.5 mt-2 justify-end">
          ${isMissing
            ? `<button class="col-add-missing text-[10px] bg-gundam-yellow hover:bg-yellow-500 text-white rounded px-1.5 py-0.5 transition" data-code="${c.card_code}" data-name="${c.card_name}" data-set="${c.set_name}" data-image="${c.image_url}">+ Aggiungi</button>`
            : `<button class="col-edit text-[10px] bg-gundam-blue hover:bg-gundam-blue-hover text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✎</button>
               <button class="col-delete text-[10px] bg-gundam-red hover:bg-gundam-red-hover text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✕</button>`
          }
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.col-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = allCards.find(c => c.id === btn.dataset.id);
      if (card) openModal(card);
    });
  });

  grid.querySelectorAll('.col-delete').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Eliminare questa carta dalla collezione?')) {
        deleteCard(btn.dataset.id).then(() => refreshCards());
      }
    });
  });

  // Aggiungi carte mancanti → apre modale pre-compilata
  grid.querySelectorAll('.col-add-missing').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = {
        card_code: btn.dataset.code,
        card_name: btn.dataset.name,
        set_name: btn.dataset.set,
        image_url: btn.dataset.image,
        rarity: '',
        quantity: 1,
      };
      openModal(card);
    });
  });

  // Click sul "+" overlay o sulla card mancante → apre modale
  grid.querySelectorAll('.card-missing .missing-overlay, .card-missing .card-img-wrapper').forEach(el => {
    el.addEventListener('click', (e) => {
      const entry = e.currentTarget.closest('.card-entry');
      if (!entry) return;
      const code = entry.dataset.code;
      const rc = refCardByCode[code];
      if (rc) {
        openModal({
          card_code: rc.card_code,
          card_name: rc.card_name,
          set_name: rc.set_name,
          image_url: rc.image_url,
          rarity: '',
          quantity: 1,
        });
      }
    });
  });
}

function populateSetFilter() {
  const sel = document.getElementById('col-set-filter');
  // Usa l'ordine da reference_cards (tutti i set, non solo quelli con carte possedute)
  const sets = setOrder.length ? setOrder : [];
  // Aggiungi eventuali set extra dai dati dell'utente non in reference_cards
  const extra = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].filter(s => sets.indexOf(s) === -1);
  const allSets = [...sets, ...extra];
  sel.innerHTML = '<option value="">Tutte le espansioni</option>' +
    allSets.map(s => `<option value="${s}">${s}</option>`).join('');
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
  const refs = refCards.filter(rc => rc.set_name === setFilter);
  const ownedMap = {};
  for (const c of allCards) {
    if (c.set_name === setFilter) {
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

// ============ Modal ============
let editingCardId = null;

function openModal(card) {
  editingCardId = card ? card.id : null;
  document.getElementById('modal-title').textContent = editingCardId ? 'Modifica Carta' : 'Aggiungi Carta';
  document.getElementById('field-card-name').value = card ? card.card_name : '';
  document.getElementById('field-card-code').value = card ? card.card_code : '';
  document.getElementById('field-set-name').value = card ? (card.set_name || '') : '';
  document.getElementById('field-rarity').value = card ? (card.rarity || '') : '';
  document.getElementById('field-quantity').value = card ? card.quantity : 1;
  document.getElementById('field-image-url').value = card ? (card.image_url || '') : '';
  document.getElementById('card-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  document.getElementById('card-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  editingCardId = null;
}

async function handleCardSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('form-error');
  errEl.classList.add('hidden');

  const cardData = {
    card_name: document.getElementById('field-card-name').value.trim(),
    card_code: document.getElementById('field-card-code').value.trim(),
    set_name: document.getElementById('field-set-name').value.trim() || null,
    rarity: document.getElementById('field-rarity').value || null,
    quantity: parseInt(document.getElementById('field-quantity').value, 10) || 1,
    image_url: document.getElementById('field-image-url').value.trim() || null
  };

  if (!cardData.card_name || !cardData.card_code) {
    errEl.textContent = 'Nome e Codice sono obbligatori.';
    errEl.classList.remove('hidden');
    return;
  }

  try {
    if (editingCardId) {
      await updateCard(editingCardId, cardData);
    } else {
      await addCard(cardData);
    }
    closeModal();
    await refreshCards();
  } catch (err) {
    errEl.textContent = err.message || 'Errore durante il salvataggio.';
    errEl.classList.remove('hidden');
  }
}

// ============ Refresh ============
async function refreshCards() {
  try {
    allCards = await loadCards();
    renderLatest();
    renderCompletionCircles();
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
    if (typeof supabase === 'undefined') {
      throw new Error('CDN Supabase non caricato. Verifica la connessione internet.');
    }
    if (!SUPABASE_ANON_KEY) {
      throw new Error('Manca la chiave API. Inseriscila in app.js:3.');
    }
    _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await loadReferenceCards();
    await refreshCards();
    showSection('app-section');
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

  // Esci button
  document.getElementById('logout-btn').addEventListener('click', () => {
    allCards = [];
    showSection('splash-section');
  });

  // Sidebar
  document.getElementById('hamburger-btn').addEventListener('click', openSidebar);
  document.getElementById('sidebar-close').addEventListener('click', closeSidebar);
  document.getElementById('sidebar-overlay').addEventListener('click', closeSidebar);

  // Sidebar navigation
  function activateSideNav(id) {
    document.querySelectorAll('.side-nav').forEach(el => {
      el.className = 'side-nav flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-gundam-muted hover:text-gundam-dark hover:bg-gray-50 transition';
    });
    const btn = document.getElementById(id);
    btn.className = 'side-nav active flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-semibold text-gundam-yellow bg-yellow-50 transition';
  }

  document.getElementById('side-dashboard').addEventListener('click', () => {
    activateSideNav('side-dashboard');
    showView('view-dashboard');
  });

  document.getElementById('side-collection').addEventListener('click', () => {
    activateSideNav('side-collection');
    showView('view-collection');
  });

  // FAB add
  document.getElementById('fab-add').addEventListener('click', () => openModal(null));

  // Modal events
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('card-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('card-modal')) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', handleCardSubmit);

  // Collection filters
  let searchTimeout;
  document.getElementById('col-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderCollection(filterCollection());
    }, 250);
  });

  document.getElementById('col-set-filter').addEventListener('change', () => {
    renderCollection(filterCollection());
  });
});

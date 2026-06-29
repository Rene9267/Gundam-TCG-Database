// ============ Configurazione Supabase ============
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_yeP5henLm-YdNtkwCFuV0Q_tE1koERf';

let _supabase = null;

// ============ Set Gundam TCG (dati ufficiali) ============
// ST = Starter Deck, GD = Booster Pack
// Totale carte per set (incluse varianti / alt art)
const SET_TOTALS = {
  // ── Starter Deck (ST) ──
  'ST01 Heroic Beginnings': 35,
  'ST02 Wings of Advance': 34,
  'ST03 Zeon\'s Rush': 34,
  'ST04 SEED Strike': 35,
  'ST05 Iron Bloom': 32,
  'ST06 Clan Unity': 32,
  'ST07 Celestial Drive': 32,
  'ST08 Flash of Radiance': 32,
  'ST09 Destiny Ignition': 39,
  // ── Booster Pack (GD) ──
  'GD01 Newtype Rising': 179,
  'GD02 Dual Impact': 187,
  'GD03 Steel Requiem': 202,
  'GD04 Phantom Aria': 144,
  // ── Extra / Altro ──
  'Beta Edition': 86,
  'Promo Cards': 109,
  'Basic Cards': 2,
};

// Ordine di visualizzazione: ST → GD → Altro
const SET_ORDER = Object.keys(SET_TOTALS);

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
  if (setName.startsWith('ST')) return 'st';
  if (setName.startsWith('GD')) return 'gd';
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

  const circumference = 2 * Math.PI * 40; // r=40

  container.innerHTML = SET_ORDER.map(setName => {
    const total = SET_TOTALS[setName];
    const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
    const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
    const offset = circumference - (pct / 100) * circumference;
    const group = setGroup(setName);
    const strokeColor = group === 'st' ? '#eab308' : group === 'gd' ? '#2563eb' : '#94a3b8';

    return `
      <div class="flex flex-col items-center gap-1">
        <div class="relative w-[100px] h-[100px] flex items-center justify-center">
          <svg width="100" height="100" viewBox="0 0 100 100" class="completion-ring absolute inset-0">
            <circle cx="50" cy="50" r="40" class="completion-ring-bg"/>
            <circle cx="50" cy="50" r="40" class="completion-ring-fg"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${owned > 0 ? offset : circumference}"
              stroke="${strokeColor}"/>
          </svg>
          <span class="text-lg font-bold text-gundam-dark z-10">${pct}%</span>
        </div>
        <span class="text-xs text-gundam-muted text-center max-w-[100px] truncate leading-tight" title="${setName}">${setName}</span>
        <span class="text-[10px] text-gundam-muted/60">${owned}/${total}</span>
      </div>
    `;
  }).join('');
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
  summary.textContent = `Mostrando ${cards.length} carta${cards.length !== 1 ? 'e' : ''}`;

  grid.innerHTML = cards.map(c => `
    <div class="card-entry rounded-lg overflow-hidden shadow-sm" data-id="${c.id}">
      ${imageOrFallback(c.image_url, c.card_name)}
      <div class="px-3 pb-3 pt-2">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="qty-diamond"></span>
          <span class="text-sm font-bold text-gundam-dark">${c.quantity}</span>
        </div>
        <h3 class="font-semibold text-xs truncate text-gundam-dark" title="${c.card_name}">${c.card_name}</h3>
        <p class="text-[11px] text-gundam-muted truncate">${c.card_code}</p>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-[10px] font-medium ${rarityColor(c.rarity)}">${c.rarity || '—'}</span>
          <div class="flex gap-1.5">
            <button class="col-edit text-[10px] bg-gundam-blue hover:bg-gundam-blue-hover text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✎</button>
            <button class="col-delete text-[10px] bg-gundam-red hover:bg-gundam-red-hover text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✕</button>
          </div>
        </div>
      </div>
    </div>
  `).join('');

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
}

function populateSetFilter() {
  const sel = document.getElementById('col-set-filter');
  // Mostra i set nell'ordine definito da SET_ORDER
  const available = SET_ORDER.filter(s => {
    // Mostra solo set che hanno match nei dati o tutti
    return allCards.some(c => c.set_name === s);
  });
  // Aggiungi anche eventuali set non in SET_TOTALS ma nei dati
  const extra = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].filter(s => !SET_TOTALS[s]);
  const allSets = [...available, ...extra.filter(s => available.indexOf(s) === -1)];
  sel.innerHTML = '<option value="">Tutte le espansioni</option>' +
    allSets.map(s => `<option value="${s}">${s}</option>`).join('');
}

function filterCollection() {
  const query = document.getElementById('col-search').value.toLowerCase();
  const setFilter = document.getElementById('col-set-filter').value;
  return allCards.filter(c => {
    const matchSearch = !query ||
      c.card_name.toLowerCase().includes(query) ||
      c.card_code.toLowerCase().includes(query);
    const matchSet = !setFilter || c.set_name === setFilter;
    return matchSearch && matchSet;
  });
}

// ============ Modal ============
let editingCardId = null;

function openModal(card) {
  editingCardId = card ? card.id : null;
  document.getElementById('modal-title').textContent = card ? 'Modifica Carta' : 'Aggiungi Carta';
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

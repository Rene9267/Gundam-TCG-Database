// ============ Configurazione Supabase ============
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = '';  // ← Inserisci qui la tua anon key

const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ Configurazione Set ============
const SET_TOTALS = {};

// ============ State ============
let allCards = [];

// ============ Cards CRUD ============
async function loadCards() {
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

// ============ Dashboard ============
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

function renderCompletionCircles() {
  const container = document.getElementById('completion-circles');
  const empty = document.getElementById('completion-empty');

  const setMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!setMap[key]) setMap[key] = new Set();
    setMap[key].add(c.card_code);
  }

  const entries = Object.entries(setMap);
  if (!entries.length) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  container.innerHTML = entries.map(([setName, codes]) => {
    const count = codes.size;
    const total = SET_TOTALS[setName];
    const hasTotal = total != null && total > 0;
    const pct = hasTotal ? Math.min(Math.round((count / total) * 100), 100) : 100;
    const circumference = 2 * Math.PI * 40;
    const offset = circumference - (pct / 100) * circumference;
    const label = hasTotal ? `${pct}%` : `${count}`;
    const sub = hasTotal ? `${count}/${total}` : `${count} unique`;

    return `
      <div class="flex flex-col items-center gap-1">
        <div class="relative w-[100px] h-[100px] flex items-center justify-center">
          <svg width="100" height="100" viewBox="0 0 100 100" class="completion-ring absolute inset-0">
            <circle cx="50" cy="50" r="40" class="completion-ring-bg"/>
            <circle cx="50" cy="50" r="40" class="completion-ring-fg"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${hasTotal ? offset : 0}"
              stroke="${hasTotal ? '#eab308' : '#2563eb'}"/>
          </svg>
          <span class="text-lg font-bold text-gundam-dark z-10">${label}</span>
        </div>
        <span class="text-xs text-gundam-muted text-center max-w-[100px] truncate" title="${setName}">${setName}</span>
        <span class="text-[10px] text-gundam-muted/60">${sub}</span>
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
  const sets = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tutte le espansioni</option>' +
    sets.map(s => `<option value="${s}">${s}</option>`).join('');
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

  try {
    await refreshCards();
    showSection('app-section');
  } catch (err) {
    errEl.textContent = 'Errore di connessione: ' + err.message;
    errEl.classList.remove('hidden');
  }
}

// ============ Init ============
document.addEventListener('DOMContentLoaded', () => {
  // Start button
  document.getElementById('start-btn').addEventListener('click', startApp);

  // Esci button (torna alla splash)
  document.getElementById('logout-btn').addEventListener('click', () => {
    allCards = [];
    showSection('splash-section');
  });

  // Navigation
  document.getElementById('nav-dashboard').addEventListener('click', () => {
    document.getElementById('nav-dashboard').className = 'nav-tab active px-5 py-3 text-sm font-semibold border-b-2 border-gundam-yellow text-gundam-yellow';
    document.getElementById('nav-collection').className = 'nav-tab px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gundam-muted hover:text-gundam-dark';
    showView('view-dashboard');
  });

  document.getElementById('nav-collection').addEventListener('click', () => {
    document.getElementById('nav-collection').className = 'nav-tab active px-5 py-3 text-sm font-semibold border-b-2 border-gundam-yellow text-gundam-yellow';
    document.getElementById('nav-dashboard').className = 'nav-tab px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gundam-muted hover:text-gundam-dark';
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

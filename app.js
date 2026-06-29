// ============ Configurazione Supabase ============
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = '';  // ← Inserisci qui la tua anon key

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ Configurazione Set (modifica qui i totali) ============
// Inserisci il nome esatto dell'espansione e il totale carte dell'intero set.
// Le espansioni non elencate mostreranno solo il conteggio senza percentuale.
const SET_TOTALS = {
  // Esempio: "Beta Booster": 120,
};

// ============ State ============
let currentUser = null;
let allCards = [];

// ============ Auth ============
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ============ Cards CRUD ============
async function loadCards() {
  const { data, error } = await supabase
    .from('cards')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

async function addCard(card) {
  const { data, error } = await supabase
    .from('cards')
    .insert([{ ...card, user_id: currentUser.id }])
    .select();
  if (error) throw error;
  return data[0];
}

async function updateCard(id, updates) {
  const { data, error } = await supabase
    .from('cards')
    .update(updates)
    .eq('id', id)
    .select();
  if (error) throw error;
  return data[0];
}

async function deleteCard(id) {
  const { error } = await supabase
    .from('cards')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============ UI Helpers ============
function showSection(id) {
  document.querySelectorAll('#auth-section, #dashboard-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showView(id) {
  document.querySelectorAll('#view-dashboard, #view-collection').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showError(el, msg) {
  el.textContent = msg;
  el.classList.remove('hidden');
}

function hideError(el) {
  el.classList.add('hidden');
}

function rarityColor(rarity) {
  const map = {
    'Common': 'text-gray-300',
    'Uncommon': 'text-green-400',
    'Rare': 'text-blue-400',
    'Super Rare': 'text-purple-400',
    'Secret Rare': 'text-yellow-400',
    'Promo': 'text-orange-400'
  };
  return map[rarity] || 'text-gray-300';
}

function imageOrFallback(url, name) {
  if (!url) return `<div class="card-img-fallback w-full aspect-[3/4]">🃏</div>`;
  return `<img src="${url}" alt="${name}" class="w-full aspect-[3/4] object-cover" loading="lazy" onerror="this.outerHTML='<div class=\\'card-img-fallback w-full aspect-[3/4]\\'>🃏</div>'">`;
}

// ============ Dashboard — Render Ultime Aggiunte ============
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
    <div class="card-entry bg-gundam-card rounded-lg overflow-hidden shadow-lg border border-gundam-blue/10">
      ${imageOrFallback(c.image_url, c.card_name)}
      <div class="p-3">
        <h3 class="font-semibold text-sm truncate text-gundam-white" title="${c.card_name}">${c.card_name}</h3>
        <p class="text-xs text-gundam-muted truncate">${c.card_code}</p>
        ${c.set_name ? `<p class="text-xs text-gundam-muted/60 truncate mt-0.5">${c.set_name}</p>` : ''}
      </div>
    </div>
  `).join('');
}

// ============ Dashboard — Render Cerchi Completamento ============
function renderCompletionCircles() {
  const container = document.getElementById('completion-circles');
  const empty = document.getElementById('completion-empty');

  // Raggruppa per set e conta carte uniche (per card_code)
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
    const circumference = 2 * Math.PI * 40; // r=40
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
              stroke="${hasTotal ? '#eab308' : '#3b82f6'}"/>
          </svg>
          <span class="text-lg font-bold text-gundam-white z-10">${label}</span>
        </div>
        <span class="text-xs text-gundam-muted text-center max-w-[100px] truncate" title="${setName}">${setName}</span>
        <span class="text-[10px] text-gundam-muted/60">${sub}</span>
      </div>
    `;
  }).join('');
}

// ============ Collection — Render Griglia ============
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
    <div class="card-entry bg-gundam-card rounded-lg overflow-hidden shadow-lg border border-gundam-blue/10" data-id="${c.id}">
      ${imageOrFallback(c.image_url, c.card_name)}
      <div class="px-3 pb-3 pt-2">
        <div class="flex items-center gap-2 mb-1.5">
          <span class="qty-diamond"></span>
          <span class="text-sm font-bold text-gundam-white">${c.quantity}</span>
        </div>
        <h3 class="font-semibold text-xs truncate text-gundam-white" title="${c.card_name}">${c.card_name}</h3>
        <p class="text-[11px] text-gundam-muted truncate">${c.card_code}</p>
        <div class="flex items-center justify-between mt-1.5">
          <span class="text-[10px] font-medium ${rarityColor(c.rarity)}">${c.rarity || '—'}</span>
          <div class="flex gap-1.5">
            <button class="col-edit text-[10px] bg-gundam-blue hover:bg-gundam-blue-hover text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✎</button>
            <button class="col-delete text-[10px] bg-red-700 hover:bg-red-600 text-white rounded px-1.5 py-0.5 transition" data-id="${c.id}">✕</button>
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

// ============ Modal ============
function openModal(card) {
  editingCardId = card ? card.id : null;
  document.getElementById('modal-title').textContent = card ? 'Modifica Carta' : 'Aggiungi Carta';
  document.getElementById('field-card-name').value = card ? card.card_name : '';
  document.getElementById('field-card-code').value = card ? card.card_code : '';
  document.getElementById('field-set-name').value = card ? (card.set_name || '') : '';
  document.getElementById('field-rarity').value = card ? (card.rarity || '') : '';
  document.getElementById('field-quantity').value = card ? card.quantity : 1;
  document.getElementById('field-image-url').value = card ? (card.image_url || '') : '';
  hideError(document.getElementById('form-error'));
  document.getElementById('card-modal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function closeModal() {
  document.getElementById('card-modal').classList.add('hidden');
  document.body.classList.remove('modal-open');
  editingCardId = null;
}

let editingCardId = null;

async function handleCardSubmit(e) {
  e.preventDefault();
  const errEl = document.getElementById('form-error');
  hideError(errEl);

  const cardData = {
    card_name: document.getElementById('field-card-name').value.trim(),
    card_code: document.getElementById('field-card-code').value.trim(),
    set_name: document.getElementById('field-set-name').value.trim() || null,
    rarity: document.getElementById('field-rarity').value || null,
    quantity: parseInt(document.getElementById('field-quantity').value, 10) || 1,
    image_url: document.getElementById('field-image-url').value.trim() || null
  };

  if (!cardData.card_name || !cardData.card_code) {
    showError(errEl, 'Nome e Codice sono obbligatori.');
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
    showError(errEl, err.message || 'Errore durante il salvataggio.');
  }
}

// ============ Popola filtro set ============
function populateSetFilter() {
  const sel = document.getElementById('col-set-filter');
  const sets = [...new Set(allCards.map(c => c.set_name).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Tutte le espansioni</option>' +
    sets.map(s => `<option value="${s}">${s}</option>`).join('');
}

// ============ Filtra collezione ============
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

// ============ Init ============
async function init() {
  // Auth state listener
  supabase.auth.onAuthStateChange((event, session) => {
    if (session) {
      currentUser = session.user;
      document.getElementById('user-email').textContent = currentUser.email;
      showSection('dashboard-section');
      refreshCards();
    } else {
      currentUser = null;
      allCards = [];
      showSection('auth-section');
    }
  });

  // Check existing session
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    document.getElementById('user-email').textContent = currentUser.email;
    showSection('dashboard-section');
    refreshCards();
  }

  // --- Login ---
  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    hideError(errEl);
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
      await login(email, password);
    } catch (err) {
      showError(errEl, err.message);
    }
  });

  // --- Logout ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
  });

  // --- Navigation ---
  document.getElementById('nav-dashboard').addEventListener('click', () => {
    document.getElementById('nav-dashboard').className = 'nav-tab active px-5 py-3 text-sm font-semibold border-b-2 border-gundam-yellow text-gundam-yellow';
    document.getElementById('nav-collection').className = 'nav-tab px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gundam-muted hover:text-gundam-white';
    showView('view-dashboard');
  });

  document.getElementById('nav-collection').addEventListener('click', () => {
    document.getElementById('nav-collection').className = 'nav-tab active px-5 py-3 text-sm font-semibold border-b-2 border-gundam-yellow text-gundam-yellow';
    document.getElementById('nav-dashboard').className = 'nav-tab px-5 py-3 text-sm font-semibold border-b-2 border-transparent text-gundam-muted hover:text-gundam-white';
    showView('view-collection');
  });

  // --- Add card (FAB) ---
  document.getElementById('fab-add').addEventListener('click', () => openModal(null));

  // --- Modal events ---
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('card-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('card-modal')) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', handleCardSubmit);

  // --- Collection filters ---
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
}

// ============ Start ============
document.addEventListener('DOMContentLoaded', init);

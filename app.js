// ============ Configurazione Supabase ============
// Sostituisci con i tuoi valori da: Supabase Dashboard → Settings → API
const SUPABASE_URL = 'https://zhrvhhzcsdadoolxqpro.supabase.co';
const SUPABASE_ANON_KEY = '';

const supabase = supabaseJs.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ============ State ============
let currentUser = null;
let allCards = [];
let editingCardId = null;

// ============ Auth ============
async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

async function register(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
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

// ============ Render Cards ============
function renderCards(cards) {
  const grid = document.getElementById('card-grid');
  const empty = document.getElementById('empty-state');

  if (!cards.length) {
    grid.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }

  empty.classList.add('hidden');
  grid.innerHTML = cards.map(c => `
    <div class="card-entry bg-gray-800 rounded-lg overflow-hidden shadow-lg" data-id="${c.id}">
      ${c.image_url
        ? `<img src="${c.image_url}" alt="${c.card_name}" class="w-full aspect-[3/4] object-cover" loading="lazy" onerror="this.parentElement.innerHTML='<div class=\\'card-img-fallback w-full aspect-[3/4]\\'>🃏</div>'">`
        : `<div class="card-img-fallback w-full aspect-[3/4]">🃏</div>`
      }
      <div class="p-3">
        <h3 class="font-semibold text-sm truncate" title="${c.card_name}">${c.card_name}</h3>
        <p class="text-xs text-gray-400 truncate">${c.card_code}</p>
        ${c.set_name ? `<p class="text-xs text-gray-500 truncate mt-0.5">${c.set_name}</p>` : ''}
        <div class="flex items-center justify-between mt-2">
          <span class="text-xs font-medium ${rarityColor(c.rarity)}">${c.rarity || '—'}</span>
          <span class="text-xs bg-gray-900 px-2 py-0.5 rounded">×${c.quantity}</span>
        </div>
        <div class="flex gap-2 mt-2">
          <button class="edit-btn flex-1 text-xs bg-blue-600 hover:bg-blue-700 rounded py-1 transition" data-id="${c.id}">Modifica</button>
          <button class="delete-btn flex-1 text-xs bg-red-700 hover:bg-red-600 rounded py-1 transition" data-id="${c.id}">Elimina</button>
        </div>
      </div>
    </div>
  `).join('');

  // Attach events to edit/delete buttons
  grid.querySelectorAll('.edit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const card = allCards.find(c => c.id === btn.dataset.id);
      if (card) openModal(card);
    });
  });

  grid.querySelectorAll('.delete-btn').forEach(btn => {
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

// ============ Search ============
function filterCards(query) {
  if (!query.trim()) return allCards;
  const q = query.toLowerCase();
  return allCards.filter(c =>
    c.card_name.toLowerCase().includes(q) ||
    c.card_code.toLowerCase().includes(q)
  );
}

// ============ Refresh ============
async function refreshCards() {
  try {
    allCards = await loadCards();
    const query = document.getElementById('search-input').value;
    renderCards(filterCards(query));
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

  // --- Auth events ---
  let isLoginMode = true;

  document.getElementById('auth-login-tab').addEventListener('click', () => {
    isLoginMode = true;
    document.getElementById('auth-login-tab').className = 'flex-1 py-2 text-center font-semibold border-b-2 border-red-500 text-white';
    document.getElementById('auth-register-tab').className = 'flex-1 py-2 text-center font-semibold border-b-2 border-gray-600 text-gray-400';
    document.getElementById('auth-submit').textContent = 'Accedi';
  });

  document.getElementById('auth-register-tab').addEventListener('click', () => {
    isLoginMode = false;
    document.getElementById('auth-login-tab').className = 'flex-1 py-2 text-center font-semibold border-b-2 border-gray-600 text-gray-400';
    document.getElementById('auth-register-tab').className = 'flex-1 py-2 text-center font-semibold border-b-2 border-red-500 text-white';
    document.getElementById('auth-submit').textContent = 'Registrati';
  });

  document.getElementById('auth-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = document.getElementById('auth-error');
    hideError(errEl);
    const email = document.getElementById('auth-email').value.trim();
    const password = document.getElementById('auth-password').value;

    try {
      if (isLoginMode) {
        await login(email, password);
      } else {
        const data = await register(email, password);
        if (data?.user?.identities?.length === 0) {
          showError(errEl, 'Email già registrata. Prova ad accedere.');
        } else {
          showError(errEl, 'Registrazione effettuata! Controlla la tua email per confermare.');
        }
      }
    } catch (err) {
      showError(errEl, err.message);
    }
  });

  // --- Logout ---
  document.getElementById('logout-btn').addEventListener('click', async () => {
    await logout();
  });

  // --- Add card button ---
  document.getElementById('add-card-btn').addEventListener('click', () => openModal(null));

  // --- Modal events ---
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-cancel').addEventListener('click', closeModal);
  document.getElementById('card-modal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('card-modal')) closeModal();
  });
  document.getElementById('card-form').addEventListener('submit', handleCardSubmit);

  // --- Search ---
  let searchTimeout;
  document.getElementById('search-input').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      renderCards(filterCards(document.getElementById('search-input').value));
    }, 250);
  });
}

// ============ Start ============
document.addEventListener('DOMContentLoaded', init);

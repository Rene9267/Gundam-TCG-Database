function toggleEye(inputId, eyeId) {
  const input = document.getElementById(inputId);
  const btn = document.getElementById(eyeId);
  if (input.type === 'password') {
    input.type = 'text';
    btn.classList.add('eye-active');
  } else {
    input.type = 'password';
    btn.classList.remove('eye-active');
  }
}

function showSection(id) {
  document.querySelectorAll('#splash-section, #app-section, #reset-section').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function showView(id) {
  document.querySelectorAll('#view-dashboard, #view-collection, #view-profile').forEach(el => el.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

function switchTab(tab) {
  if (tab === 'dashboard') showView('view-dashboard');
  else if (tab === 'profile') { showView('view-profile'); renderProfile(); }
  else showView('view-collection');
  closeMenu();
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
  if (!url) return `<div class="card-img-fallback w-full h-full text-2xl">🃏</div>`;
  return `<img src="${url}" alt="${name}" class="w-full h-full object-cover" loading="lazy" onerror="this.outerHTML='<div class=\\'card-img-fallback w-full h-full text-2xl\\'>🃏</div>'">`;
}

function setGroup(setName) {
  const code = setName.match(/\[(\w+)\]/)?.[1] || '';
  if (code.startsWith('ST')) return 'st';
  return 'gd';
}

function showToast(msg, isError = true) {
  const el = document.getElementById('auth-toast');
  el.textContent = msg;
  el.style.background = isError ? '#fb2f38' : '#22c55e';
  el.classList.remove('hidden', 'opacity-0', 'translate-y-[-10px]');
  el.classList.add('opacity-100', 'translate-y-0');
  clearTimeout(el._hide);
  el._hide = setTimeout(() => {
    el.classList.add('opacity-0', 'translate-y-[-10px]');
    el.classList.remove('opacity-100', 'translate-y-0');
  }, 3000);
}

function setLoading(v) {
  const btn = document.getElementById('auth-submit');
  btn.disabled = v;
  document.getElementById('auth-submit-text').classList.toggle('invisible', v);
  document.getElementById('auth-spinner').classList.toggle('invisible', !v);
}

function miniShimmer() {
  const overlay = document.getElementById('transition-overlay');
  overlay.classList.remove('opacity-0');
  overlay.classList.add('opacity-100');
  setTimeout(() => {
    overlay.classList.add('opacity-0');
    overlay.classList.remove('opacity-100');
  }, 250);
}

function clearAuthFields() {
  ['auth-email','auth-password','auth-confirm','auth-nickname','recover-email','recover-new-password','recover-confirm']
    .forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
}

const isTokenOrResource = (code) => code.startsWith('T-') || code.startsWith('R-');

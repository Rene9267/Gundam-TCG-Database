async function refreshCards() {
  try {
    allCards = await loadCards();
    renderDashboardStats();
    renderLatestHorizontal();
    renderExpansionsList();
    populateSetFilter();
    renderCollection(filterCollection());
  } catch (err) {
    console.error('Errore caricamento carte:', err);
  }
}

function playTransition() {
  return new Promise(resolve => {
    const overlay = document.getElementById('transition-overlay');
    const flash = document.getElementById('flash-green');
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    setTimeout(() => {
      flash.classList.remove('opacity-0');
      flash.classList.add('opacity-100');
    }, 1200);
    setTimeout(() => {
      flash.classList.add('opacity-0');
      flash.classList.remove('opacity-100');
      overlay.classList.add('opacity-0');
      overlay.classList.remove('opacity-100');
      resolve();
    }, 1800);
  });
}

async function enterApp() {
  try {
    if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
      await new Promise(resolve => {
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true });
        setTimeout(resolve, 3000);
      });
    }
    await loadReferenceCards();
    await refreshCards();
    await playTransition();
    showSection('app-section');
    renderProfile();
    switchTab('dashboard');
    document.getElementById('bottom-dashboard').classList.add('active');
  } catch (err) {
    document.getElementById('splash-error').textContent = err.message;
    document.getElementById('splash-error').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadSession();

  document.getElementById('auth-submit').addEventListener('click', handleAuthSubmit);
  document.getElementById('auth-email').addEventListener('keydown', e => { if (e.key === 'Enter') handleAuthSubmit(); });
  document.getElementById('auth-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleAuthSubmit(); });

  document.getElementById('auth-forgot').addEventListener('click', showRecoverForm);
  document.getElementById('auth-toggle-link').addEventListener('click', () => {
    if (authMode === 'login') switchToRegister();
    else switchToLogin();
  });

  document.getElementById('recover-back').addEventListener('click', showAuthFormFromRecover);
  document.getElementById('recover-submit').addEventListener('click', handleRecoverSubmit);
  document.getElementById('recover-done').addEventListener('click', () => { showAuthFormFromRecover(); });
  document.getElementById('recover-email').addEventListener('keydown', e => { if (e.key === 'Enter') handleRecoverSubmit(); });
  document.getElementById('recover-new-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleRecoverSubmit(); });
  document.getElementById('recover-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') handleRecoverSubmit(); });

  document.getElementById('reset-submit').addEventListener('click', handleResetSubmit);
  document.getElementById('reset-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleResetSubmit(); });
  document.getElementById('reset-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') handleResetSubmit(); });

  document.getElementById('eye-password').addEventListener('click', () => toggleEye('auth-password', 'eye-password'));
  document.getElementById('eye-confirm').addEventListener('click', () => toggleEye('auth-confirm', 'eye-confirm'));
  document.getElementById('eye-recover').addEventListener('click', () => toggleEye('recover-new-password', 'eye-recover'));
  document.getElementById('eye-recover-confirm').addEventListener('click', () => toggleEye('recover-confirm', 'eye-recover-confirm'));
  document.getElementById('eye-reset').addEventListener('click', () => toggleEye('reset-password', 'eye-reset'));
  document.getElementById('eye-reset-confirm').addEventListener('click', () => toggleEye('reset-confirm', 'eye-reset-confirm'));

  document.getElementById('auth-logout').addEventListener('click', async () => {
    await authSignOut();
    showAuthForm();
  });

  document.getElementById('auth-start').addEventListener('click', enterApp);

  document.getElementById('profile-logout').addEventListener('click', async () => {
    await authSignOut();
    showSection('splash-section');
    showAuthForm();
  });

  document.getElementById('profile-set-nickname').addEventListener('click', () => {
    document.getElementById('profile-nickname-input').classList.remove('hidden');
    document.getElementById('profile-set-nickname').classList.add('hidden');
    document.getElementById('profile-nickname-field').focus();
  });

  document.getElementById('profile-nickname-save').addEventListener('click', async () => {
    const val = document.getElementById('profile-nickname-field').value.trim();
    if (val) await saveNickname(val);
  });

  if (currentUser) {
    showAuthed();
  }

  document.getElementById('header-menu').addEventListener('click', openMenu);
  document.getElementById('menu-backdrop').addEventListener('click', closeMenu);
  document.getElementById('menu-close').addEventListener('click', closeMenu);
  document.getElementById('menu-dashboard').addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('menu-collection').addEventListener('click', () => {
    if (currentColTab !== 'cards') switchColTab('cards');
    currentColTab = 'cards';
    switchTab('collection');
  });
  document.getElementById('menu-decks').addEventListener('click', () => {
    switchTab('dashboard');
  });
  document.getElementById('menu-profile').addEventListener('click', () => {
    switchTab('profile');
  });
  document.getElementById('menu-logout').addEventListener('click', async () => {
    closeMenu();
    await authSignOut();
    showSection('splash-section');
    showAuthForm();
  });

  document.getElementById('latest-view-all').addEventListener('click', () => {
    if (currentColTab !== 'cards') switchColTab('cards');
    currentColTab = 'cards';
    switchTab('collection');
  });

  document.getElementById('sheet-overlay').addEventListener('click', closeSheet);

  document.getElementById('sheet-qty-minus').addEventListener('click', () => {
    if (pendingSheetQty > 0) {
      pendingSheetQty--;
      document.getElementById('sheet-qty-display').textContent = pendingSheetQty;
    }
  });

  document.getElementById('sheet-qty-plus').addEventListener('click', () => {
    pendingSheetQty++;
    document.getElementById('sheet-qty-display').textContent = pendingSheetQty;
  });

  let searchTimeout;
  document.getElementById('col-search').addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
      if (currentColTab === 'stats') switchColTab('cards');
      else renderCollection(filterCollection());
    }, 250);
  });

  document.getElementById('col-set-filter').addEventListener('change', () => {
    for (const k of Object.keys(activeFilters)) activeFilters[k] = k === 'base';
    document.querySelectorAll('.variant-btn').forEach(b => b.classList.toggle('active', activeFilters[b.dataset.filter]));
    if (currentColTab === 'stats') switchColTab('cards');
    else renderCollection(filterCollection());
  });

  document.getElementById('tab-cards').addEventListener('click', () => switchColTab('cards'));
  document.getElementById('tab-stats').addEventListener('click', () => switchColTab('stats'));

  document.querySelectorAll('.variant-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleVariantFilter(btn.dataset.filter));
  });

  document.getElementById('select-all-btn').addEventListener('click', () => setAllFilters(true));
  document.getElementById('deselect-all-btn').addEventListener('click', () => setAllFilters(false));

  const hash = window.location.hash;
  if (hash && hash.includes('type=recovery')) {
    const params = new URLSearchParams(hash.replace('#', ''));
    const recoveryToken = params.get('access_token');
    if (recoveryToken) {
      accessToken = recoveryToken;
      const saved = (() => { try { return JSON.parse(localStorage.getItem('pending_recovery')); } catch(_) { return null; } })();
      if (saved && saved.password) {
        (async () => {
          try {
            const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
              method: 'PUT',
              headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
              body: JSON.stringify({ password: saved.password }),
            });
            if (!res.ok) throw new Error('API error');
            try { localStorage.removeItem('pending_recovery'); } catch(_) {}
            window.location.hash = '';
            showToast('Password aggiornata! Ora accedi.', false);
          } catch (_) {
            document.getElementById('splash-section').classList.add('hidden');
            document.getElementById('reset-section').classList.remove('hidden');
          }
        })();
      } else {
        document.getElementById('splash-section').classList.add('hidden');
        document.getElementById('reset-section').classList.remove('hidden');
      }
    }
  }
});
async function refreshCards() {
  try {
    allCards = await loadCards();
    syncCardsUI();
  } catch (err) {
    console.error('Errore caricamento carte:', err);
    showToast('Errore caricamento collezione.', true);
  }
}

function syncCardsUI() {
  renderDashboardStats();
  renderLatestHorizontal();
  renderExpansionsList();
  populateSetFilter();
  const detail = document.getElementById('collection-detail');
  const overview = document.getElementById('collection-overview');
  if (!detail.classList.contains('hidden')) {
    if (currentColTab === 'stats') {
      renderSetStatistics(document.getElementById('col-set-filter').value);
    } else {
      renderCollection(filterCollection());
    }
  } else if (!overview.classList.contains('hidden')) {
    renderCollectionOverview();
  }
}

function playTransition() {
  return new Promise(resolve => {
    const overlay = document.getElementById('transition-overlay');
    overlay.classList.remove('opacity-0');
    overlay.classList.add('opacity-100');
    setTimeout(() => {
      overlay.classList.add('opacity-0');
      overlay.classList.remove('opacity-100');
      resolve();
    }, 500);
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
    const refPromise = loadReferenceCards();
    const cardsPromise = currentUser ? loadCards() : Promise.resolve([]);
    const [, cards] = await Promise.all([refPromise, cardsPromise]);
    if (!currentUser) return;
    allCards = cards;
    const transitionPromise = playTransition();
    showSection('app-section');
    renderProfile();
    sanitizeUrl();
    history.replaceState({ view: 'dashboard', set: null }, '', location.pathname);
    _applyView('dashboard');
    syncCardsUI();
    await transitionPromise;

  } catch (err) {
    document.getElementById('splash-error').textContent = err.message;
    document.getElementById('splash-error').classList.remove('hidden');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  loadSession();

  initFilterDrawer();
  initCollectionGridDelegation();

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

  document.getElementById('reset-submit').addEventListener('click', handleResetSubmit);
  document.getElementById('reset-password').addEventListener('keydown', e => { if (e.key === 'Enter') handleResetSubmit(); });
  document.getElementById('reset-confirm').addEventListener('keydown', e => { if (e.key === 'Enter') handleResetSubmit(); });

  document.getElementById('eye-password').addEventListener('click', () => {
    toggleEye('auth-password', 'eye-password');
    toggleEye('auth-confirm', 'eye-confirm');
  });
  document.getElementById('eye-confirm').addEventListener('click', () => {
    toggleEye('auth-password', 'eye-password');
    toggleEye('auth-confirm', 'eye-confirm');
  });
  document.getElementById('eye-reset').addEventListener('click', () => toggleEye('reset-password', 'eye-reset'));
  document.getElementById('eye-reset-confirm').addEventListener('click', () => toggleEye('reset-confirm', 'eye-reset-confirm'));

  document.getElementById('auth-logout').addEventListener('click', async () => {
    await authSignOut();
    history.replaceState(null, '', location.pathname);
    showAuthForm();
  });

  document.getElementById('auth-start').addEventListener('click', enterApp);

  document.getElementById('profile-logout').addEventListener('click', async () => {
    await authSignOut();
    history.replaceState(null, '', location.pathname);
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
    showAuthForm();
  }

  document.getElementById('header-menu').addEventListener('click', openMenu);
  document.getElementById('menu-backdrop').addEventListener('click', closeMenu);
  document.getElementById('menu-close').addEventListener('click', closeMenu);
  document.getElementById('menu-dashboard').addEventListener('click', () => switchTab('dashboard'));
  document.getElementById('menu-collection').addEventListener('click', () => {
    switchTab('collection');
  });
  document.getElementById('menu-profile').addEventListener('click', () => {
    switchTab('profile');
  });
  document.getElementById('menu-logout').addEventListener('click', async () => {
    closeMenu();
    await authSignOut();
    history.replaceState(null, '', location.pathname);
    showSection('splash-section');
    showAuthForm();
  });

  document.getElementById('menu-info').addEventListener('click', () => {
    closeMenu();
    setTimeout(() => openLegal(), 250);
  });
  document.getElementById('legal-close').addEventListener('click', closeLegal);
  document.getElementById('legal-backdrop').addEventListener('click', closeLegal);

  document.getElementById('latest-view-all').addEventListener('click', () => {
    switchTab('collection');
  });

  document.getElementById('col-back-btn').addEventListener('click', () => switchTab('collection'));

  document.getElementById('sheet-overlay').addEventListener('click', () => closeSheet());

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
      collectionPage = 0;
      if (currentColTab === 'stats') switchColTab('cards');
      else renderCollection(filterCollection());
    }, 250);
  });

  document.getElementById('col-set-filter').addEventListener('change', async () => {
    const setCode = getSetCodeFromFilter();
    await ensureSetLoaded(setCode);
    updateSetHeader();
    resetCollectionFilters();
    if (currentColTab === 'stats') switchColTab('cards');
    else renderCollection(filterCollection());
  });

  document.getElementById('tab-cards').addEventListener('click', () => switchColTab('cards'));
  document.getElementById('tab-stats').addEventListener('click', () => switchColTab('stats'));

  document.getElementById('filter-toggle-btn').addEventListener('click', openFilterDrawer);
  document.getElementById('filter-drawer-backdrop').addEventListener('click', closeFilterDrawer);
  document.getElementById('filter-drawer-arrow').addEventListener('click', closeFilterDrawer);

  document.querySelectorAll('#filter-drawer .variant-btn').forEach(btn => {
    btn.addEventListener('click', () => toggleVariantFilter(btn.dataset.filter));
  });

  document.getElementById('filter-reset').addEventListener('click', (e) => {
    e.preventDefault();
    resetFilters();
  });

  const fromHash = window._supabaseHashCallback ? await window._supabaseHashCallback : false;
  if (fromHash) {
    showAuthed();
  } else {
    const hash = window.location.hash;
    if (hash && hash.includes('type=recovery')) {
      const params = new URLSearchParams(hash.replace('#', ''));
      const recoveryToken = params.get('access_token');
      if (recoveryToken) {
        accessToken = recoveryToken;
        sanitizeUrl();
        document.getElementById('splash-section').classList.add('hidden');
        document.getElementById('reset-section').classList.remove('hidden');
      }
    }
  }
});

async function renderProfile() {
  if (!currentUser) return;
  const emailEl = document.getElementById('profile-email');
  const nicknameEl = document.getElementById('profile-nickname');
  const setNicknameBtn = document.getElementById('profile-set-nickname');
  const nicknameInput = document.getElementById('profile-nickname-input');
  const nicknameSaveBtn = document.getElementById('profile-nickname-save');

  let nickname = (currentUser.user_metadata || {}).nickname;
  if (nickname) {
    nicknameEl.textContent = nickname;
    nicknameEl.classList.remove('hidden');
    setNicknameBtn.classList.add('hidden');
    nicknameInput.classList.add('hidden');
    nicknameSaveBtn.classList.add('hidden');
  } else {
    nicknameEl.classList.add('hidden');
    setNicknameBtn.classList.remove('hidden');
    nicknameInput.classList.add('hidden');
    nicknameSaveBtn.classList.add('hidden');
  }
  emailEl.textContent = currentUser.email;
}

async function saveNickname(nickname) {
  if (!currentUser || !accessToken) return;
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: { nickname } }),
    });
    if (!res.ok) throw new Error('save failed');
    if (currentUser.user_metadata) currentUser.user_metadata.nickname = nickname;
    renderProfile();
  } catch (_) {
    showToast('Errore nel salvataggio del nickname.');
  }
}

function showAuthForm() {
  document.getElementById('auth-form').classList.remove('hidden');
  document.getElementById('auth-authed').classList.add('hidden');
}

function showAuthed() {
  document.getElementById('auth-form').classList.add('hidden');
  document.getElementById('auth-authed').classList.remove('hidden');
  if (currentUser) {
    document.getElementById('auth-user-email').textContent = currentUser.email;
  }
}

function switchToRegister() {
  clearAuthFields();
  authMode = 'register';
  document.getElementById('auth-submit-text').textContent = 'Registrati';
  document.getElementById('auth-email').placeholder = 'Email';
  document.getElementById('auth-nickname').classList.remove('hidden');
  document.getElementById('auth-confirm-group').classList.remove('hidden');
  document.getElementById('auth-toggle-link').textContent = 'Accedi';
  miniShimmer();
}

function switchToLogin() {
  clearAuthFields();
  authMode = 'login';
  document.getElementById('auth-submit-text').textContent = 'Accedi';
  document.getElementById('auth-email').placeholder = 'Email o Username';
  document.getElementById('auth-nickname').classList.add('hidden');
  document.getElementById('auth-confirm-group').classList.add('hidden');
  document.getElementById('auth-toggle-link').textContent = 'Registrati';
  miniShimmer();
}

async function handleAuthSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showToast('Inserisci email e password.'); return; }
  if (password.length < 6) { showToast('Password: almeno 6 caratteri.'); return; }

  if (authMode === 'register') {
    const confirm = document.getElementById('auth-confirm').value;
    if (password !== confirm) { showToast('Le password non coincidono.'); return; }
    const nickname = document.getElementById('auth-nickname').value.trim();
    if (!nickname) { showToast('Inserisci un nickname.'); return; }
  }

  setLoading(true);
  try {
    if (authMode === 'login') {
      const remember = document.getElementById('auth-remember').checked;
      await authSignIn(email, password, remember);
      showAuthed();
    } else {
      const nickname = document.getElementById('auth-nickname').value.trim();
      await authSignUp(email, password, nickname);
      showToast('Registrazione completata! Controlla la tua email.', false);
      switchToLogin();
    }
  } catch (err) {
    showToast(err.message === 'Invalid login credentials' ? 'Email o password errata.' : err.message);
  } finally {
    setLoading(false);
  }
}

function showRecoverForm() {
  miniShimmer();
  document.getElementById('auth-form').classList.add('hidden');
  document.getElementById('recover-form').classList.remove('hidden');
  document.getElementById('recover-email').value = document.getElementById('auth-email').value;
  document.getElementById('recover-new-password').value = '';
  document.getElementById('recover-confirm').value = '';
}

function showAuthFormFromRecover() {
  miniShimmer();
  document.getElementById('recover-form').classList.add('hidden');
  document.getElementById('recover-success').classList.add('hidden');
  document.getElementById('auth-form').classList.remove('hidden');
}

async function handleRecoverSubmit() {
  const email = document.getElementById('recover-email').value.trim();
  const pwd = document.getElementById('recover-new-password').value;
  const confirm = document.getElementById('recover-confirm').value;
  if (!email) { showToast('Inserisci la tua email.'); return; }
  if (!pwd || pwd.length < 6) { showToast('Password: almeno 6 caratteri.'); return; }
  if (pwd !== confirm) { showToast('Le password non coincidono.'); return; }

  const btn = document.getElementById('recover-submit');
  btn.disabled = true;
  document.getElementById('recover-submit-text').classList.add('invisible');
  document.getElementById('recover-spinner').classList.remove('invisible');

  try {
    const checkRes = await fetch(SUPABASE_URL + '/auth/v1/signup', {
      method: 'POST',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: '__chk_' + Date.now() + Math.random().toString(36).slice(2,6) }),
    });
    if (checkRes.ok) {
      const chkData = await checkRes.json();
      if (chkData.access_token) {
        fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'DELETE',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + chkData.access_token },
        }).catch(() => {});
      }
      showToast('Email non trovata. Verifica l\'indirizzo o registrati.');
      btn.disabled = false;
      document.getElementById('recover-submit-text').classList.remove('invisible');
      document.getElementById('recover-spinner').classList.add('invisible');
      return;
    }

    const checkData = await checkRes.json();
    const alreadyRegistered = checkData.msg === 'User already registered'
      || (checkData.error_description || '').includes('already registered')
      || (checkData.error || '').includes('already registered');

    if (!alreadyRegistered) {
      showToast('Email non trovata. Verifica l\'indirizzo o registrati.');
      btn.disabled = false;
      document.getElementById('recover-submit-text').classList.remove('invisible');
      document.getElementById('recover-spinner').classList.add('invisible');
      return;
    }

    try { localStorage.setItem('pending_recovery', JSON.stringify({ email, password: pwd })); } catch (_) {}

    await authFetch('/auth/v1/recover', { email });
    miniShimmer();
    document.getElementById('recover-form').classList.add('hidden');
    document.getElementById('recover-success').classList.remove('hidden');
  } catch (err) {
    showToast(err.message || 'Errore durante la verifica.');
  } finally {
    btn.disabled = false;
    document.getElementById('recover-submit-text').classList.remove('invisible');
    document.getElementById('recover-spinner').classList.add('invisible');
  }
}

async function handleResetSubmit() {
  const pwd = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  if (!pwd || pwd.length < 6) { showToast('Password: almeno 6 caratteri.'); return; }
  if (pwd !== confirm) { showToast('Le password non coincidono.'); return; }

  const btn = document.getElementById('reset-submit');
  btn.disabled = true;
  document.getElementById('reset-submit-text').classList.add('invisible');
  document.getElementById('reset-spinner').classList.remove('invisible');
  try {
    const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      method: 'PUT',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.msg || errData.error_description || errData.error || 'Richiesta fallita (' + res.status + ')');
    }
    showToast('Password aggiornata! Ora accedi.', false);
    showSection('splash-section');
    showAuthForm();
  } catch (err) {
    const msg = err.message || 'riprova';
    if (msg.includes('401') || msg.includes('unauthorized') || msg.includes('expired')) {
      showToast('Link scaduto. Richiedi un nuovo reset.', true);
    } else {
      showToast('Errore: ' + msg);
    }
  } finally {
    btn.disabled = false;
    document.getElementById('reset-submit-text').classList.remove('invisible');
    document.getElementById('reset-spinner').classList.add('invisible');
  }
}

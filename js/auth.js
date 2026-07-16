// Guard per prevenire submission concorrenti (Enter key bypassa il disable del bottone)
let isSubmitting = false;

// Mappa gli errori Supabase a messaggi generici italiani.
// Prevende account enumeration e information leakage via error messages.
function mapAuthError(err) {
  const msg = (err && err.message) ? String(err.message).toLowerCase() : '';
  if (msg.includes('invalid login credentials') || msg.includes('invalid credentials')) {
    return 'Email o password errata.';
  }
  if (msg.includes('user already registered') || msg.includes('already registered')) {
    return 'Questa email è già registrata. Prova ad accedere.';
  }
  if (msg.includes('email not confirmed') || msg.includes('email_not_confirmed')) {
    return 'Email non ancora confermata. Controlla la tua casella di posta.';
  }
  if (msg.includes('user not found')) {
    return 'Credenziali non valide.';
  }
  if (msg.includes('password should be at least') || msg.includes('weak password')) {
    return 'La password deve avere almeno 6 caratteri.';
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Troppi tentativi. Riprova tra qualche minuto.';
  }
  if (msg.includes('token') && (msg.includes('expired') || msg.includes('invalid'))) {
    return 'Sessione scaduta o non valida. Riprova.';
  }
  if (msg.includes('refresh') && msg.includes('token')) {
    return 'Sessione scaduta. Effettua di nuovo il login.';
  }
  if (msg.includes('error sending email') || msg.includes('email sending')) {
    return 'Errore nell\'invio dell\'email. Riprova più tardi.';
  }
  if (msg.includes('network') || msg.includes('failed to fetch')) {
    return 'Errore di rete. Controlla la connessione.';
  }
  return 'Si è verificato un errore. Riprova.';
}

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
  window._sessionExpiring = false;
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
  if (isSubmitting) return;
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

  isSubmitting = true;
  setLoading(true);
  try {
    if (authMode === 'login') {
      const remember = document.getElementById('auth-remember').checked;
      await authSignIn(email, password, remember);
      sanitizeUrl();
      enterApp();
    } else {
      const nickname = document.getElementById('auth-nickname').value.trim();
      await authSignUp(email, password, nickname);
      showToast('Registrazione completata! Controlla la tua email.', false);
      switchToLogin();
    }
  } catch (err) {
    showToast(mapAuthError(err));
  } finally {
    setLoading(false);
    isSubmitting = false;
  }
}

function showRecoverForm() {
  miniShimmer();
  document.getElementById('auth-form').classList.add('hidden');
  document.getElementById('recover-form').classList.remove('hidden');
  document.getElementById('recover-email').value = document.getElementById('auth-email').value;
}

function showAuthFormFromRecover() {
  miniShimmer();
  document.getElementById('recover-form').classList.add('hidden');
  document.getElementById('recover-success').classList.add('hidden');
  document.getElementById('auth-form').classList.remove('hidden');
}

async function handleRecoverSubmit() {
  if (isSubmitting) return;
  const email = document.getElementById('recover-email').value.trim();
  if (!email) { showToast('Inserisci la tua email.'); return; }

  isSubmitting = true;
  const btn = document.getElementById('recover-submit');
  btn.disabled = true;
  document.getElementById('recover-submit-text').classList.add('invisible');
  document.getElementById('recover-spinner').classList.remove('invisible');

  try {
    // Flusso standard Supabase: invia l'email di reset. Supabase non rivela
    // se l'email esiste (niente account enumeration) e non crea account spurii.
    await authFetch('/auth/v1/recover', { email, redirect_to: window.location.origin });
    miniShimmer();
    document.getElementById('recover-form').classList.add('hidden');
    document.getElementById('recover-success').classList.remove('hidden');
  } catch (err) {
    showToast(mapAuthError(err));
  } finally {
    btn.disabled = false;
    document.getElementById('recover-submit-text').classList.remove('invisible');
    document.getElementById('recover-spinner').classList.add('invisible');
    isSubmitting = false;
  }
}

async function handleResetSubmit() {
  if (isSubmitting) return;
  const pwd = document.getElementById('reset-password').value;
  const confirm = document.getElementById('reset-confirm').value;
  if (!pwd || pwd.length < 6) { showToast('Password: almeno 6 caratteri.'); return; }
  if (pwd !== confirm) { showToast('Le password non coincidono.'); return; }

  isSubmitting = true;
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
      throw new Error('reset failed (' + res.status + ')');
    }
    sanitizeUrl();
    showToast('Password aggiornata! Ora accedi.', false);
    showSection('splash-section');
    showAuthForm();
  } catch (err) {
    showToast(mapAuthError(err));
  } finally {
    btn.disabled = false;
    document.getElementById('reset-submit-text').classList.remove('invisible');
    document.getElementById('reset-spinner').classList.add('invisible');
    isSubmitting = false;
  }
}

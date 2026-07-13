let refreshToken = null;
let expiresAt = null;

function getAuthHeaders() {
  const headers = {
    'apikey': SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  };
  if (accessToken) {
    headers['Authorization'] = 'Bearer ' + accessToken;
  }
  return headers;
}

async function refreshUserSession() {
  if (!refreshToken) {
    clearSession();
    throw new Error('Refresh token assente, sessione non rinnovabile');
  }
  if (window._sessionExpiring) {
    await window._sessionExpiring;
    return;
  }
  window._sessionExpiring = (async () => {
    try {
      const data = await authFetch('/auth/v1/token?grant_type=refresh_token', { refresh_token: refreshToken });
      const remember = !!localStorage.getItem('supabase_user');
      saveSession(data.user, data.access_token, remember, data.refresh_token, data.expires_in);
      return data;
    } finally {
      window._sessionExpiring = null;
    }
  })();
  await window._sessionExpiring;
}

async function ensureValidSession() {
  if (expiresAt && Date.now() > expiresAt) {
    try {
      await refreshUserSession();
    } catch (_) {
      // Refresh fallito (es. refresh token assente al reload): redirect al login
      clearSession();
      closeSheet(true);
      showSection('splash-section');
      showAuthForm();
      throw new Error('Sessione scaduta');
    }
  }
}

function saveSession(user, token, remember = true, refresh_token, expires_in) {
  currentUser = user;
  accessToken = token;
  // Refresh token mantenuto SOLO in memoria: mai persistito in storage.
  // Un eventuale XSS può rubare solo l'access token (short-lived, ~1h),
  // non il refresh token (long-lived) che resta nel closure JS.
  // Trade-off: al reload della pagina con token scaduto, l'utente deve rifare login.
  refreshToken = refresh_token || null;
  if (expires_in) {
    expiresAt = Date.now() + expires_in * 1000;
  }
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem('supabase_user', JSON.stringify(user));
    store.setItem('supabase_token', token);
    if (expires_in) {
      store.setItem('supabase_expires_at', String(Date.now() + expires_in * 1000));
    }
    // Cleanup: rimuovi eventuale refresh token legacy da versioni precedenti
    localStorage.removeItem('supabase_refresh_token');
    sessionStorage.removeItem('supabase_refresh_token');
    if (!remember) {
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_expires_at');
    }
  } catch (_) {}
}

function clearSession() {
  currentUser = null;
  accessToken = null;
  refreshToken = null;
  expiresAt = null;
  try {
    localStorage.removeItem('supabase_user');
    localStorage.removeItem('supabase_token');
    localStorage.removeItem('supabase_refresh_token');
    localStorage.removeItem('supabase_expires_at');
    sessionStorage.removeItem('supabase_user');
    sessionStorage.removeItem('supabase_token');
    sessionStorage.removeItem('supabase_refresh_token');
    sessionStorage.removeItem('supabase_expires_at');
  } catch (_) {}
}

function loadSession() {
  try {
    let u, t, ea;
    u = localStorage.getItem('supabase_user');
    t = localStorage.getItem('supabase_token');
    ea = localStorage.getItem('supabase_expires_at');
    if (!u || !t) {
      u = sessionStorage.getItem('supabase_user');
      t = sessionStorage.getItem('supabase_token');
      ea = sessionStorage.getItem('supabase_expires_at');
    }
    // refreshToken NON viene caricato dal storage: resta null al reload.
    refreshToken = null;
    const parsedExpiry = ea ? Number(ea) : null;

    // Validazione scadenza: se il token è già scaduto (con 30s di buffer
    // di sicurezza), non caricare la sessione e pulisci lo storage.
    // Il refresh token non è disponibile dopo reload, quindi non possiamo
    // rinnovare — l'utente deve rifare login.
    const TOKEN_EXPIRY_BUFFER_MS = 30 * 1000;
    if (parsedExpiry && Date.now() + TOKEN_EXPIRY_BUFFER_MS > parsedExpiry) {
      clearSession();
      return;
    }

    if (u && t) {
      currentUser = JSON.parse(u);
      accessToken = t;
      expiresAt = parsedExpiry;
    }
    // Cleanup: rimuovi eventuale refresh token legacy da versioni precedenti
    localStorage.removeItem('supabase_refresh_token');
    sessionStorage.removeItem('supabase_refresh_token');
  } catch (_) {}
}

async function authFetch(path, body) {
  const r = await fetch(SUPABASE_URL + path, {
    method: 'POST',
    headers: { 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.msg || data.error_description || data.error || 'Errore');
  return data;
}

async function authSignUp(email, password, nickname) {
  const body = { email, password };
  if (nickname) body.data = { nickname };
  const data = await authFetch('/auth/v1/signup', body);
  if (data.access_token) {
    saveSession(data.user, data.access_token);
    if (nickname) {
      try {
        await fetch(SUPABASE_URL + '/auth/v1/user', {
          method: 'PUT',
          headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + data.access_token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: { nickname } }),
        });
      } catch (_) {}
    }
  }
  return data;
}

async function authSignIn(email, password, remember = true) {
  const data = await authFetch('/auth/v1/token?grant_type=password', { email, password });
  saveSession(data.user, data.access_token, remember, data.refresh_token, data.expires_in);
  return data;
}

async function authSignOut() {
  if (accessToken) {
    try {
      await fetch(SUPABASE_URL + '/auth/v1/logout', {
        method: 'POST',
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + accessToken },
      });
    } catch (_) {}
  }
  clearSession();
}

function handleHashCallback() {
  const hash = window.location.hash;
  if (!hash) return Promise.resolve(false);
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if (params.get('type') === 'recovery') return Promise.resolve(false);
  const hashAccessToken = params.get('access_token');
  const hashRefreshToken = params.get('refresh_token');
  const hashExpiresIn = params.get('expires_in');
  if (!hashAccessToken || !hashRefreshToken || !hashExpiresIn) return Promise.resolve(false);

  return (async () => {
    try {
      const res = await fetch(SUPABASE_URL + '/auth/v1/user', {
        headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': 'Bearer ' + hashAccessToken },
      });
      if (!res.ok) throw new Error('Recupero profilo utente fallito (' + res.status + ')');
      const user = await res.json();
      const expiresAt = Date.now() + Number(hashExpiresIn) * 1000;
      saveSession(user, hashAccessToken, true, hashRefreshToken, Number(hashExpiresIn));
      history.replaceState(null, '', window.location.pathname + window.location.search);
      return true;
    } catch (err) {
      clearSession();
      return false;
    }
  })();
}

window._supabaseHashCallback = handleHashCallback();

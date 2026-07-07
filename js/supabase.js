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
    await refreshUserSession();
  }
}

function saveSession(user, token, remember = true, refresh_token, expires_in) {
  currentUser = user;
  accessToken = token;
  refreshToken = refresh_token || null;
  if (expires_in) {
    expiresAt = Date.now() + expires_in * 1000;
  }
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem('supabase_user', JSON.stringify(user));
    store.setItem('supabase_token', token);
    if (refresh_token) {
      store.setItem('supabase_refresh_token', refresh_token);
    }
    if (expires_in) {
      store.setItem('supabase_expires_at', String(Date.now() + expires_in * 1000));
    }
    if (!remember) {
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
      localStorage.removeItem('supabase_refresh_token');
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
    let u, t, rt, ea;
    u = localStorage.getItem('supabase_user');
    t = localStorage.getItem('supabase_token');
    rt = localStorage.getItem('supabase_refresh_token');
    ea = localStorage.getItem('supabase_expires_at');
    if (!u || !t) {
      u = sessionStorage.getItem('supabase_user');
      t = sessionStorage.getItem('supabase_token');
      rt = sessionStorage.getItem('supabase_refresh_token');
      ea = sessionStorage.getItem('supabase_expires_at');
    }
    if (u && t) {
      currentUser = JSON.parse(u);
      accessToken = t;
    }
    refreshToken = rt || null;
    expiresAt = ea ? Number(ea) : null;
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

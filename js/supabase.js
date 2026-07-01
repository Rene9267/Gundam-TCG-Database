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

function saveSession(user, token, remember = true) {
  currentUser = user;
  accessToken = token;
  try {
    const store = remember ? localStorage : sessionStorage;
    store.setItem('supabase_user', JSON.stringify(user));
    store.setItem('supabase_token', token);
    if (!remember) {
      localStorage.removeItem('supabase_user');
      localStorage.removeItem('supabase_token');
    }
  } catch (_) {}
}

function clearSession() {
  currentUser = null;
  accessToken = null;
  try {
    localStorage.removeItem('supabase_user');
    localStorage.removeItem('supabase_token');
    sessionStorage.removeItem('supabase_user');
    sessionStorage.removeItem('supabase_token');
  } catch (_) {}
}

function loadSession() {
  try {
    let u, t;
    u = localStorage.getItem('supabase_user');
    t = localStorage.getItem('supabase_token');
    if (!u || !t) {
      u = sessionStorage.getItem('supabase_user');
      t = sessionStorage.getItem('supabase_token');
    }
    if (u && t) {
      currentUser = JSON.parse(u);
      accessToken = t;
    }
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
  saveSession(data.user, data.access_token, remember);
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

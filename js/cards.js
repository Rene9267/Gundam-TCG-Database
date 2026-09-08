const CARD_SELECT = 'id,card_code,card_name,set_name,quantity,rarity,updated_at';

async function handle401Fatal() {
  if (window._sessionExpiring) return;
  showToast('Sessione scaduta. Effettua di nuovo il login.', true);
  clearSession();
  closeSheet(true);
  showSection('splash-section');
  showAuthForm();
}

async function cardsFetch(url, options = {}, retried = false) {
  await ensureValidSession();
  const r = await fetch(url, {
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });
  if (r.status === 401 && !retried) {
    try {
      await refreshUserSession();
      return cardsFetch(url, options, true);
    } catch (_) {
      handle401Fatal();
      return null;
    }
  }
  if (r.status === 401) {
    handle401Fatal();
    return null;
  }
  return r;
}

async function loadCards() {
  if (!currentUser) return [];
  const r = await cardsFetch(
    SUPABASE_URL + '/rest/v1/cards?select=' + CARD_SELECT +
    '&user_id=eq.' + encodeURIComponent(currentUser.id) +
    '&order=updated_at.desc'
  );
  if (!r) return [];
  if (!r.ok) throw new Error('GET /cards ' + r.status);
  return r.json();
}

async function addCard(card) {
  if (!currentUser) return null;
  const r = await cardsFetch(SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST',
    headers: { 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...card, user_id: currentUser.id, updated_at: new Date().toISOString() }),
  });
  if (!r) return null;
  if (!r.ok) {
    const text = await r.text();
    throw new Error('POST /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function updateCard(id, updates) {
  if (!currentUser) return null;
  const r = await cardsFetch(
    SUPABASE_URL + '/rest/v1/cards?id=eq.' + encodeURIComponent(id) +
    '&user_id=eq.' + encodeURIComponent(currentUser.id),
    {
      method: 'PATCH',
      headers: { 'Prefer': 'return=representation' },
      body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
    }
  );
  if (!r) return null;
  if (!r.ok) {
    const text = await r.text();
    throw new Error('PATCH /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function deleteCard(id) {
  if (!currentUser) return;
  const r = await cardsFetch(
    SUPABASE_URL + '/rest/v1/cards?id=eq.' + encodeURIComponent(id) +
    '&user_id=eq.' + encodeURIComponent(currentUser.id),
    { method: 'DELETE' }
  );
  if (!r) return;
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE /cards ' + r.status + ': ' + text.slice(0, 200));
  }
}

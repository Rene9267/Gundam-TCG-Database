async function handle401() {
  if (window._sessionExpiring) return;
  try {
    await refreshUserSession();
    showToast('Sessione rinnovata. Riprova l\'operazione.', false);
  } catch (_) {
    showToast('Sessione scaduta. Effettua di nuovo il login.', true);
    clearSession();
    closeSheet(true);
    showSection('splash-section');
    showAuthForm();
  }
}

async function loadCards() {
  if (!currentUser) return [];
  await ensureValidSession();
  // Defense-in-depth: filtra per user_id anche se RLS è attivo
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?select=*&user_id=eq.' + encodeURIComponent(currentUser.id) + '&order=updated_at.desc', {
    headers: getAuthHeaders(),
  });
  if (r.status === 401) { handle401(); return []; }
  if (!r.ok) throw new Error('GET /cards ' + r.status);
  return r.json();
}

async function addCard(card) {
  if (!currentUser) return null;
  await ensureValidSession();
  // Defense-in-depth: imposta user_id dal client oltre al DEFAULT auth.uid()
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...card, user_id: currentUser.id, updated_at: new Date().toISOString() }),
  });
  if (r.status === 401) { handle401(); return null; }
  if (!r.ok) {
    const text = await r.text();
    throw new Error('POST /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function updateCard(id, updates) {
  if (!currentUser) return null;
  await ensureValidSession();
  // Defense-in-depth: filtra per user_id+id per modificare solo le proprie carte
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(currentUser.id), {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...updates, updated_at: new Date().toISOString() }),
  });
  if (r.status === 401) { handle401(); return null; }
  if (!r.ok) {
    const text = await r.text();
    throw new Error('PATCH /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function deleteCard(id) {
  if (!currentUser) return;
  await ensureValidSession();
  // Defense-in-depth: filtra per user_id+id per eliminare solo le proprie carte
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + encodeURIComponent(id) + '&user_id=eq.' + encodeURIComponent(currentUser.id), {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (r.status === 401) { handle401(); return; }
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE /cards ' + r.status + ': ' + text.slice(0, 200));
  }
}

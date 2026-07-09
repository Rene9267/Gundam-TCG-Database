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
  await ensureValidSession();
  // RLS su Supabase filtra automaticamente per auth.uid(): nessun filtro lato client necessario
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?select=*&order=updated_at.desc', {
    headers: getAuthHeaders(),
  });
  if (r.status === 401) { handle401(); return []; }
  if (!r.ok) throw new Error('GET /cards ' + r.status);
  return r.json();
}

async function addCard(card) {
  await ensureValidSession();
  // user_id NON viene più inviato dal client: lo imposta Supabase tramite la sessione (DEFAULT auth.uid())
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify({ ...card, updated_at: new Date().toISOString() }),
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
  await ensureValidSession();
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
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
  await ensureValidSession();
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (r.status === 401) { handle401(); return; }
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE /cards ' + r.status + ': ' + text.slice(0, 200));
  }
}

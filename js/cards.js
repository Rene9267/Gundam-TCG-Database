function userIdFilter() {
  return currentUser ? '&user_id=eq.' + currentUser.id : '';
}

async function loadCards() {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?select=*&order=created_at.desc' + userIdFilter(), {
    headers: getAuthHeaders(),
  });
  if (!r.ok) throw new Error('GET /cards ' + r.status);
  return r.json();
}

async function addCard(card) {
  const payload = currentUser ? { ...card, user_id: currentUser.id } : card;
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards', {
    method: 'POST',
    headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('POST /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function updateCard(id, updates) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
    method: 'PATCH',
    headers: { ...getAuthHeaders(), 'Prefer': 'return=representation' },
    body: JSON.stringify(updates),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('PATCH /cards ' + r.status + ': ' + text.slice(0, 200));
  }
  const data = await r.json();
  return data[0];
}

async function deleteCard(id) {
  const r = await fetch(SUPABASE_URL + '/rest/v1/cards?id=eq.' + id, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!r.ok) {
    const text = await r.text();
    throw new Error('DELETE /cards ' + r.status + ': ' + text.slice(0, 200));
  }
}

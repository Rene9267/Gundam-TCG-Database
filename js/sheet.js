function getAltVersions(cardName) {
  if (!cardName) return [];
  return refCards.filter(rc => rc.card_name === cardName);
}

function populateAltVersions(cardName, currentCode) {
  const container = document.getElementById('sheet-versions');
  const versions = getAltVersions(cardName);
  if (versions.length < 2) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = versions.map(v => {
    const isActive = v.card_code === currentCode;
    const isAlt = v.card_code.includes('_p') || v.card_code.split('-')[0] !== v.set_code;
    return `<button class="version-dot w-3 h-3 rounded-full transition border border-white shadow-sm${isActive ? ' version-dot-active' : ''}${isAlt ? ' version-dot-alt' : ' version-dot-base'}" data-code="${v.card_code}" title="${v.card_code}${v.set_code !== currentCode?.split('-')[0] ? ' [' + v.set_code + ']' : ''}"></button>`;
  }).join('');

  container.querySelectorAll('.version-dot').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentSheetCard) {
        saveSheetQuantity(pendingSheetQty).catch(() => {});
      }
      const code = btn.dataset.code;
      const rc = refCardByCode[code];
      if (rc) loadSheetCard(rc);
    });
  });
}

function loadSheetCard(rc) {
  const owned = allCards.find(c => c.card_code === rc.card_code && c.set_name === rc.set_name);
  const card = {
    id: owned?.id || null,
    card_code: rc.card_code,
    card_name: rc.card_name,
    set_name: rc.set_name,
    set_code: rc.set_code,
    image_url: rc.image_url,
    quantity: owned?.quantity || 0,
    rarity: owned?.rarity || null,
  };
  editingCardId = card.id;
  currentSheetCard = card;

  const img = document.getElementById('sheet-image');
  img.src = card.image_url || '';
  img.style.display = '';
  img.onerror = () => { img.style.display = 'none'; };
  img.onload = () => { img.style.display = ''; };

  document.getElementById('sheet-name').textContent = card.card_name;
  document.getElementById('sheet-code').textContent = card.card_code;
  document.getElementById('sheet-set').textContent = card.set_name || '';

  pendingSheetQty = card.quantity || 0;
  document.getElementById('sheet-qty-display').textContent = pendingSheetQty;

  populateAltVersions(card.card_name, card.card_code);
  updateCardtraderLink(card.card_code);
}

function updateCardtraderLink(cardCode) {
  const link = document.getElementById('sheet-cardtrader');
  const rc = refCardByCode[cardCode];
  if (rc && rc.cardtrader_slug) {
    link.href = `https://www.cardtrader.com/it/cards/${rc.cardtrader_slug}`;
  } else {
    const query = cardCode.replace(/-/g, '+');
    link.href = `https://www.cardtrader.com/it/cards?search=${query}`;
  }
}

async function saveSheetQuantity(newQty) {
  const errEl = document.getElementById('sheet-error');
  errEl.classList.add('hidden');
  if (!currentSheetCard || !currentSheetCard.card_code) return;
  try {
    if (editingCardId) {
      if (newQty <= 0) {
        await deleteCard(editingCardId);
      } else {
        await updateCard(editingCardId, { quantity: newQty });
      }
    } else if (newQty > 0) {
      const cardData = {
        card_name: currentSheetCard.card_name,
        card_code: currentSheetCard.card_code,
        set_name: currentSheetCard.set_name || null,
        rarity: currentSheetCard.rarity || null,
        quantity: newQty,
        image_url: currentSheetCard.image_url || null,
      };
      await addCard(cardData);
    }
    await refreshCards();
  } catch (err) {
    errEl.textContent = err.message || 'Errore.';
    errEl.classList.remove('hidden');
  }
}

function openSheet(card) {
  if (!card) return;
  const rc = refCardByCode[card.card_code];
  if (rc) {
    const sheet = document.getElementById('card-sheet');
    const panel = document.getElementById('sheet-panel');
    sheet.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    panel.style.transform = 'translateY(100%)';
    panel.getBoundingClientRect();
    panel.style.transform = 'translateY(0)';
    loadSheetCard(rc);
  }
}

function closeSheet() {
  if (currentSheetCard) {
    saveSheetQuantity(pendingSheetQty).catch(() => {});
  }
  const panel = document.getElementById('sheet-panel');
  panel.style.transform = 'translateY(100%)';
  setTimeout(() => {
    document.getElementById('card-sheet').classList.add('hidden');
    document.body.classList.remove('sheet-open');
    editingCardId = null;
    currentSheetCard = null;
    pendingSheetQty = 0;
  }, 250);
}

const variantOverrides = {
};

function getAltVersions(cardCode) {
  if (!cardCode) return [];
  const baseId = cardCode.replace(/_[a-z0-9]+$/, '');
  return refCards.filter(rc => {
    const rcBaseId = rc.card_code.replace(/_[a-z0-9]+$/, '');
    return rcBaseId === baseId;
  });
}

function populateAltVersions(cardCode) {
  const container = document.getElementById('sheet-versions');
  const versions = getAltVersions(cardCode);
  if (versions.length < 2) {
    container.innerHTML = '';
    container.classList.add('hidden');
    return;
  }
  container.classList.remove('hidden');
  container.innerHTML = versions.map(v => {
    const isActive = v.card_code === cardCode;
    const override = variantOverrides[v.card_code];
    if (override) {
      const cls = override === 'Base' ? 'version-dot-base' : 'version-dot-alt';
      return `<button class="version-dot${isActive ? ' version-dot-active' : ''} ${cls}" data-code="${v.card_code}" title="${v.card_code}">${override}</button>`;
    }
    const suffix = v.card_code.match(/_p(\d+)$/);
    const isBase = !suffix && v.card_code.split('-')[0] === v.set_code;
    let cls = 'version-dot-base';
    let label = 'Base';

    if (!isBase) {
      cls = 'version-dot-alt';
      if (suffix || v.rarity && v.rarity.includes('+')) {
        label = 'Plus';
      } else {
        label = 'Alt Art';
      }
    }

    return `<button class="version-dot${isActive ? ' version-dot-active' : ''} ${cls}" data-code="${v.card_code}" title="${v.card_code}">${label}</button>`;
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

  populateAltVersions(card.card_code);
  updateCardtraderLink(card.card_code);
  loadCardtraderPrices(rc);
}

function resolveCardtraderCard(rc) {
  if (rc.cardtrader_id) return rc;
  const base = rc.card_code.replace(/_[a-z0-9]+$/i, '');
  if (base !== rc.card_code) {
    const baseRc = refCardByCode[base];
    if (baseRc && baseRc.cardtrader_id) return baseRc;
  }
  return rc;
}

function updateCardtraderLink(cardCode) {
  const link = document.getElementById('sheet-cardtrader');
  const rc = resolveCardtraderCard(refCardByCode[cardCode]);
  if (rc && rc.cardtrader_slug) {
    link.href = `https://www.cardtrader.com/it/cards/${rc.cardtrader_slug}`;
  } else {
    const query = cardCode.replace(/-/g, '+');
    link.href = `https://www.cardtrader.com/it/cards?search=${query}`;
  }
}

async function loadCardtraderPrices(rc) {
  const ctr = document.getElementById('sheet-pricing-ctr');
  const minEl = document.getElementById('sheet-price-min');
  const avgEl = document.getElementById('sheet-price-avg');
  ctr.classList.add('hidden');
  const card = resolveCardtraderCard(rc);
  if (!card.cardtrader_id) return;
  const prices = await fetchCardtraderPrices(card.cardtrader_id);
  if (prices) {
    const sym = prices.currency === 'EUR' ? '€' : prices.currency === 'USD' ? '$' : prices.currency + ' ';
    const fmt = (v) => sym + v.toFixed(2);
    minEl.textContent = `Min ${fmt(prices.minPrice)}`;
    avgEl.textContent = `Media ${fmt(prices.avgPrice)}`;
    ctr.classList.remove('hidden');
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

function closeSheet(skipSave) {
  if (currentSheetCard && !skipSave) {
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

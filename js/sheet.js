function renderVersionDotContent(v) {
  const badge = v.badge || v.printing?.badge;
  if (!badge) return { cls: 'version-dot-base', html: '?' };
  if (badge.type === 'event') {
    return {
      cls: 'version-dot-event',
      html: '<img src="img/badges/gcg-event.svg" alt="" class="version-dot-icon" width="26" height="26">',
    };
  }
  if (badge.type === 'rarity') {
    const len = (badge.text || '').length;
    const sizeCls = len > 3 ? ' version-dot-text-sm' : '';
    return {
      cls: `version-dot-alt version-dot-rarity${sizeCls}`,
      html: escapeHtml(badge.text),
    };
  }
  const len = (badge.text || '').length;
  const sizeCls = len > 4 ? ' version-dot-text-sm' : '';
  return {
    cls: `version-dot-base version-dot-set${sizeCls}`,
    html: escapeHtml(badge.text),
  };
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
  container.innerHTML = versions.map((v) => {
    const isActive = v.card_code === cardCode;
    const { cls, html } = renderVersionDotContent(v);
    const title = v.printing?.expansion || v.card_code;
    return `<button type="button" class="version-dot${isActive ? ' version-dot-active' : ''} ${cls}" data-code="${escapeHtml(v.card_code)}" title="${escapeHtml(title)}">${html}</button>`;
  }).join('');

  container.querySelectorAll('.version-dot').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (currentSheetCard) {
        saveSheetQuantity(pendingSheetQty).catch(() => {});
      }
      const code = btn.dataset.code;
      const rc = resolveRefCard(code);
      if (rc) loadSheetCard(rc);
    });
  });
}

function loadSheetCard(rc) {
  const owned = allCards.find((c) => c.card_code === rc.card_code);
  const card = {
    id: owned?.id || null,
    card_code: rc.card_code,
    card_name: rc.card_name,
    set_name: rc.set_name,
    set_code: rc.set_code,
    quantity: owned?.quantity || 0,
    rarity: owned?.rarity || null,
  };
  editingCardId = card.id;
  currentSheetCard = card;

  const img = document.getElementById('sheet-image');
  img.src = getCardImageUrl(card.card_code) || '';
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
  const rc = resolveRefCard(cardCode) || resolveCardtraderCard(refCardByCode[cardCode]);
  if (rc && rc.cardtrader_slug) {
    link.href = `https://www.cardtrader.com/it/cards/${rc.cardtrader_slug}`;
  } else if (rc && rc.cardtrader_id) {
    link.href = `https://www.cardtrader.com/it/cards/${rc.cardtrader_id}`;
  } else {
    const query = cardCode.replace(/-/g, '+');
    link.href = `https://www.cardtrader.com/it/cards?search=${query}`;
  }
}

let _ctPriceLoadId = 0;

function setSheetPriceState({ showCtr, statusText, minText, avgText }) {
  const ctr = document.getElementById('sheet-pricing-ctr');
  const statusEl = document.getElementById('sheet-price-status');
  const minEl = document.getElementById('sheet-price-min');
  const avgEl = document.getElementById('sheet-price-avg');
  const sepEl = document.getElementById('sheet-price-sep');
  if (!ctr || !statusEl || !minEl || !avgEl || !sepEl) return;

  if (!showCtr) {
    ctr.classList.add('hidden');
    return;
  }

  ctr.classList.remove('hidden');
  const hasPrices = Boolean(minText && avgText);
  statusEl.classList.toggle('hidden', hasPrices);
  minEl.classList.toggle('hidden', !hasPrices);
  sepEl.classList.toggle('hidden', !hasPrices);
  avgEl.classList.toggle('hidden', !hasPrices);

  if (hasPrices) {
    minEl.textContent = minText;
    avgEl.textContent = avgText;
  } else {
    statusEl.textContent = statusText || '';
  }
}

async function loadCardtraderPrices(rc) {
  const loadId = ++_ctPriceLoadId;
  const card = resolveCardtraderCard(rc);
  if (!card.cardtrader_id) {
    setSheetPriceState({ showCtr: false });
    return;
  }

  setSheetPriceState({ showCtr: true, statusText: 'Prezzi…' });
  const result = await fetchCardtraderPrices(card.cardtrader_id);
  if (loadId !== _ctPriceLoadId) return;

  if (result.status === 'ok') {
    const sym = result.currency === 'EUR' ? '€' : result.currency === 'USD' ? '$' : result.currency + ' ';
    const fmt = (v) => sym + v.toFixed(2);
    setSheetPriceState({
      showCtr: true,
      minText: `Min ${fmt(result.minPrice)}`,
      avgText: `Media ${fmt(result.avgPrice)}`,
    });
    return;
  }

  const statusText = result.status === 'unauthenticated'
    ? 'Accedi per i prezzi'
    : result.status === 'no_listings'
      ? 'Nessuna offerta'
      : 'Prezzi non disponibili';
  setSheetPriceState({ showCtr: true, statusText });
}

function applySavedCard(saved, optimisticId) {
  if (!saved) return false;
  const optIdx = optimisticId
    ? allCards.findIndex(c => c.id === optimisticId)
    : allCards.findIndex(c => String(c.id).startsWith('optimistic-'));
  if (optIdx !== -1) {
    allCards[optIdx] = saved;
  } else {
    const existIdx = allCards.findIndex(c => c.id === saved.id);
    if (existIdx !== -1) {
      allCards[existIdx] = saved;
    } else {
      allCards.unshift(saved);
    }
  }
  editingCardId = saved.id;
  if (currentSheetCard) currentSheetCard.id = saved.id;
  return true;
}

async function saveSheetQuantity(newQty) {
  const errEl = document.getElementById('sheet-error');
  if (errEl) errEl.classList.add('hidden');
  if (!currentSheetCard || !currentSheetCard.card_code) return;

  const snapshot = JSON.parse(JSON.stringify(allCards));
  const optimisticId = editingCardId && String(editingCardId).startsWith('optimistic-') ? editingCardId : null;
  try {
    const now = new Date().toISOString();

    if (editingCardId && !String(editingCardId).startsWith('optimistic-')) {
      const idx = allCards.findIndex(c => c.id === editingCardId);
      if (newQty <= 0) {
        if (idx !== -1) allCards.splice(idx, 1);
        await deleteCard(editingCardId);
        editingCardId = null;
        if (currentSheetCard) currentSheetCard.id = null;
      } else {
        if (idx !== -1) {
          allCards[idx] = { ...allCards[idx], quantity: newQty, updated_at: now };
        }
        const saved = await updateCard(editingCardId, { quantity: newQty });
        if (saved && idx !== -1) allCards[idx] = saved;
        else if (!saved) await refreshCards();
      }
    } else if (newQty > 0) {
      const cardData = {
        card_name: currentSheetCard.card_name,
        card_code: currentSheetCard.card_code,
        set_name: currentSheetCard.set_name || null,
        rarity: currentSheetCard.rarity || null,
        quantity: newQty,
      };
      const tempId = 'optimistic-' + Date.now();
      allCards.unshift({
        id: tempId,
        ...cardData,
        updated_at: now,
      });
      const saved = await addCard(cardData);
      if (!applySavedCard(saved, tempId)) await refreshCards();
    } else if (optimisticId) {
      const idx = allCards.findIndex(c => c.id === optimisticId);
      if (idx !== -1) allCards.splice(idx, 1);
      editingCardId = null;
    }

    syncCardsUI();
  } catch (err) {
    allCards = JSON.parse(JSON.stringify(snapshot));
    syncCardsUI();
    console.error('Salvataggio carta fallito, rollback dello stato:', err);
    if (typeof showToast === 'function') showToast('Salvataggio fallito. Modifica annullata.', true);
    if (errEl) {
      errEl.textContent = err.message || 'Errore di rete. Modifica annullata.';
      errEl.classList.remove('hidden');
    }
  }
}

function openSheet(card) {
  if (!card) return;
  const setCode = card.set_code || (card.card_code && card.card_code.split('-')[0]);
  const doOpen = () => {
    const rc = refCardByCode[card.card_code] || card;
    initSheetSwipe();
    const sheet = document.getElementById('card-sheet');
    const panel = document.getElementById('sheet-panel');
    sheet.classList.remove('hidden');
    document.body.classList.add('sheet-open');
    panel.style.transform = 'translateY(100%)';
    panel.getBoundingClientRect();
    panel.style.transform = 'translateY(0)';
    loadSheetCard(rc);
  };
  if (setCode && !loadedSets.has(setCode)) {
    ensureSetLoaded(setCode).then(doOpen).catch(doOpen);
    return;
  }
  doOpen();
}

let sheetSwipeReady = false;
function initSheetSwipe() {
  if (sheetSwipeReady) return;
  const sheet = document.getElementById('card-sheet');
  const panel = document.getElementById('sheet-panel');
  if (!sheet || !panel) return;
  sheetSwipeReady = true;

  const SWIPE_THRESHOLD = 60;
  let startX = 0;
  let startY = 0;
  let startScroll = 0;
  let dragging = false;

  sheet.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) { dragging = false; return; }
    dragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    startScroll = panel.scrollTop;
  }, { passive: true });

  sheet.addEventListener('touchmove', (e) => {
    if (!dragging) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx) && dy > 0 && startScroll <= 0) {
      e.preventDefault();
      panel.style.transition = 'none';
      panel.style.transform = `translateY(${Math.max(0, dy)}px)`;
    }
  }, { passive: false });

  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    const t = e.changedTouches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    panel.style.transition = '';
    if (dy > SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx) && startScroll <= 0) {
      closeSheet();
    } else {
      panel.style.transform = 'translateY(0)';
    }
    startX = 0;
    startY = 0;
    startScroll = 0;
  };
  sheet.addEventListener('touchend', endDrag, { passive: true });
  sheet.addEventListener('touchcancel', endDrag, { passive: true });
}

function closeSheet(skipSave) {
  if (currentSheetCard && skipSave !== true) {
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

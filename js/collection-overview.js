function buildOverviewItem(setName, ownedMap) {
  const total = setTotals[setName] || 0;
  const owned = ownedMap[setName] ? ownedMap[setName].size : 0;
  return `
    <div class="col-set-entry rounded-xl border p-3 cursor-pointer" data-set="${escapeHtml(setName)}" style="background:rgba(255,255,255,0.1);border-color:rgba(255,255,255,0.12);">
      ${renderSetProgressCard(setName, owned, total)}
    </div>`;
}

function attachOverviewClick(container) {
  container.querySelectorAll('.col-set-entry').forEach(el => {
    el.addEventListener('click', () => {
      const setName = el.dataset.set;
      showCollectionDetail(setName);
    });
  });
}

function renderCollectionOverview() {
  const decksContainer = document.getElementById('decks-list');
  const expansionsContainer = document.getElementById('expansions-grid');
  const decksEmpty = document.getElementById('decks-empty');
  const expansionsEmpty = document.getElementById('expansions-empty-overview');

  const ownedMap = {};
  for (const c of allCards) {
    const key = c.set_name || 'Senza set';
    if (!ownedMap[key]) ownedMap[key] = new Set();
    ownedMap[key].add(c.card_code);
  }

  const stSets = [];
  const gdEbSets = [];

  for (const setName of setOrder) {
    const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
    if (setCode.startsWith('ST')) {
      stSets.push(setName);
    } else {
      gdEbSets.push(setName);
    }
  }

  if (stSets.length) {
    decksEmpty.classList.add('hidden');
    decksContainer.innerHTML = stSets.map(setName => buildOverviewItem(setName, ownedMap)).join('');
    attachOverviewClick(decksContainer);
  } else {
    decksEmpty.classList.remove('hidden');
    decksContainer.innerHTML = '';
  }

  if (gdEbSets.length) {
    expansionsEmpty.classList.add('hidden');
    expansionsContainer.innerHTML = gdEbSets.map(setName => buildOverviewItem(setName, ownedMap)).join('');
    attachOverviewClick(expansionsContainer);
  } else {
    expansionsEmpty.classList.remove('hidden');
    expansionsContainer.innerHTML = '';
  }
}

async function showCollectionDetail(setName) {
  const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
  await ensureSetLoaded(setCode);

  document.getElementById('collection-overview').classList.add('hidden');
  document.getElementById('collection-detail').classList.remove('hidden');

  document.getElementById('col-set-filter').value = setName;
  updateSetHeader();
  resetCollectionFilters();

  currentColTab = 'cards';
  document.querySelectorAll('.tab-btn').forEach(b => {
    const tab = b.dataset.view;
    if (tab === 'cards') {
      b.className = 'tab-btn active px-4 py-2 text-sm font-semibold border-b-2 transition text-white border-b-white';
    } else {
      b.className = 'tab-btn px-4 py-2 text-sm font-semibold border-b-2 transition text-white/60 border-transparent hover:text-white';
    }
  });

  document.getElementById('collection-stats').classList.add('hidden');
  document.getElementById('cards-content').classList.remove('hidden');
  renderCollection(filterCollection());
}

function showCollectionOverview() {
  document.getElementById('collection-detail').classList.add('hidden');
  document.getElementById('collection-overview').classList.remove('hidden');
  resetCollectionFilters();
  renderCollectionOverview();
}

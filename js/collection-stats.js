function renderSetStatistics(setName) {
  const container = document.getElementById('stats-content');
  const currentSetCode = setName.match(/\[(\w+)\]/)?.[1] || '';

  const refs = refCards.filter(rc =>
    rc.set_name === setName ||
    (rc.card_code.startsWith(currentSetCode) && rc.set_code !== currentSetCode)
  );

  const baseCards = [];
  const altCards = [];
  const resTokens = [];

  for (const rc of refs) {
    const variant = classifyCardVariant(rc);
    if (variant === 'resource') resTokens.push(rc);
    else if (variant === 'altart') altCards.push(rc);
    else baseCards.push(rc);
  }

  const ownedMap = {};
  for (const c of allCards) {
    if (c.set_name === setName || (currentSetCode && c.card_code.startsWith(currentSetCode))) {
      ownedMap[c.card_code] = c;
    }
  }

  const totalOwned = Object.keys(ownedMap).reduce((sum, code) => sum + (ownedMap[code]?.quantity || 0), 0);

  function calcStats(cards) {
    const total = cards.length;
    const owned = cards.filter(c => ownedMap[c.card_code]).length;
    const x4 = cards.filter(c => (ownedMap[c.card_code]?.quantity || 0) >= 4).length;
    const pct = total > 0 ? Math.round((owned / total) * 100) : 0;
    const pct4 = total > 0 ? Math.round((x4 / total) * 100) : 0;
    return { total, owned, x4, pct, pct4 };
  }

  function statCard(label, stats, barColor) {
    return `
      <div class="stat-card">
        <div class="stat-label">${label}</div>
        <div class="stat-value">${stats.pct}%</div>
        <div class="stat-sub">${stats.owned}/${stats.total} carte possedute</div>
        <div class="stat-bar">
          <div class="stat-bar-fill ${barColor}" style="width:${stats.pct}%"></div>
        </div>
        <div class="stat-bar-secondary">
          <div class="stat-bar-fill stat-bar-red" style="width:${stats.pct4}%"></div>
        </div>
        <div class="mt-3 pt-2 border-t border-gray-100">
          <div class="flex justify-between text-xs">
            <span class="text-secondary">Play set (x4)</span>
            <span class="font-semibold text-primary">${stats.pct4}% <span class="text-secondary font-normal">(${stats.x4}/${stats.total})</span></span>
          </div>
        </div>
      </div>`;
  }

  const baseStats = calcStats(baseCards);
  const altStats = calcStats(altCards);
  const rtStats = calcStats(resTokens);

  const subsets = [
    { label: 'Set Base', stats: baseStats, color: 'stat-bar-yellow' },
    { label: 'Alt', stats: altStats, color: 'stat-bar-blue' },
    { label: 'Risorse / Token', stats: rtStats, color: 'stat-bar-green' },
  ];
  const subsetCards = subsets
    .filter(s => s.stats.total > 0)
    .map(s => statCard(s.label, s.stats, s.color))
    .join('');

  container.innerHTML = `
    <div class="col-span-full">
      <div class="stat-total-owned">
        <div class="stat-label">Carte possedute in questo set</div>
        <div class="stat-big">${totalOwned}</div>
      </div>
    </div>
    ${subsetCards}
  `;
}

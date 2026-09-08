function renderSetProgressRing(pct, r = 34) {
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (pct / 100) * circumference;
  return `
    <div class="relative w-[44px] h-[44px] flex items-center justify-center flex-shrink-0">
      <svg class="w-full h-full" viewBox="0 0 100 100">
        <circle cx="50" cy="50" fill="transparent" r="${r}" stroke="rgba(255,255,255,0.1)" stroke-width="8"></circle>
        <circle cx="50" cy="50" fill="transparent" r="${r}"
          stroke="#fb2f38" stroke-width="8" stroke-linecap="round"
          stroke-dasharray="${circumference}" stroke-dashoffset="${pct > 0 ? offset : circumference}"
          style="transform:rotate(-90deg);transform-origin:50% 50%"></circle>
      </svg>
      <span class="absolute text-[10px] font-bold font-heading" style="color:rgba(255,255,255,0.9)">${pct}%</span>
    </div>`;
}

function renderSetProgressCard(setName, owned, total, extraClass = '', showChevron = false) {
  const pct = total > 0 ? Math.min(Math.round((owned / total) * 100), 100) : 0;
  const setCode = setName.match(/\[(\w+)\]/)?.[1] || '';
  const cleanName = setName.replace(/\s*\[.*?\]/, '');
  const chevron = showChevron
    ? '<svg viewBox="0 0 24 24" width="18" height="18" fill="rgba(255,255,255,0.3)"><path d="M9.29 6.71a.996.996 0 000 1.41L13.17 12l-3.88 3.88a.996.996 0 101.41 1.41l4.59-4.59a.996.996 0 000-1.41L10.7 6.7c-.38-.38-1.02-.38-1.41.01z"/></svg>'
    : '';

  const layout = showChevron
    ? `<div class="flex items-center justify-between ${extraClass}">`
    : `<div class="${extraClass}">`;
  const innerClose = showChevron ? '</div>' : '</div>';

  return `
    ${layout}
      <div class="flex items-center gap-3">
        ${renderSetProgressRing(pct)}
        <div class="${showChevron ? '' : 'min-w-0 flex-1'}">
          <p class="text-sm font-semibold ${showChevron ? '' : 'truncate'}" style="color:#fff">${escapeHtml(cleanName)}</p>
          <div class="flex gap-2 items-center mt-0.5">
            <span class="font-mono text-[10px] px-1 border rounded" style="border-color:rgba(255,255,255,0.15);color:rgba(255,255,255,0.6)">${escapeHtml(setCode)}</span>
            <span class="font-mono text-[10px]" style="color:rgba(255,255,255,0.5)">${owned}/${total}</span>
          </div>
        </div>
      </div>
      ${chevron}
    ${innerClose}`;
}

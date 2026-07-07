const MENU_ITEMS = ['dashboard', 'collection', 'decks', 'profile'];

function openMenu() {
  const modal = document.getElementById('menu-modal');
  const panel = document.getElementById('menu-panel');
  modal.style.display = 'block';
  setTimeout(() => {
    panel.style.transform = 'translateX(0)';
  }, 10);
}

function closeMenu() {
  const modal = document.getElementById('menu-modal');
  const panel = document.getElementById('menu-panel');
  panel.style.transform = 'translateX(-100%)';
  setTimeout(() => { modal.style.display = 'none'; }, 250);
}

function syncMenuActive(tab) {
  for (const id of MENU_ITEMS) {
    const el = document.getElementById('menu-' + id);
    if (!el) continue;
    if (id === tab) {
      el.classList.add('text-white', 'border-accent');
      el.classList.remove('text-white/60', 'border-transparent');
    } else {
      el.classList.add('text-white/60', 'border-transparent');
      el.classList.remove('text-white', 'border-accent');
    }
  }
}

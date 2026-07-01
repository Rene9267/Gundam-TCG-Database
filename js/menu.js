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

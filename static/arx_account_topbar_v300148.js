(() => {
  'use strict';
  document.addEventListener('pointerdown', (event) => {
    const open = document.querySelector('.arx-server-account-menu[open]');
    if (open && !open.contains(event.target)) open.removeAttribute('open');
  }, {passive:true});
})();

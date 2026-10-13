(() => {
  'use strict';

  const closeMenus = (except = null) => {
    document.querySelectorAll('.arx-language-menu[open], .arx-server-account-menu[open]')
      .forEach((menu) => {
        if (menu !== except) menu.removeAttribute('open');
      });
  };

  document.addEventListener('toggle', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLDetailsElement)) return;
    if (!target.matches('.arx-language-menu,.arx-server-account-menu')) return;
    if (target.open) closeMenus(target);
  }, true);

  document.addEventListener('pointerdown', (event) => {
    const open = document.querySelector('.arx-language-menu[open], .arx-server-account-menu[open]');
    if (open && !open.contains(event.target)) open.removeAttribute('open');
  }, {passive:true});

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-arx-language]');
    if (!button) return;

    const selector = document.getElementById('app-language');
    if (!(selector instanceof HTMLSelectElement) || selector.disabled) return;

    const language = button.dataset.arxLanguage || '';
    if (!language || selector.value === language) {
      button.closest('details')?.removeAttribute('open');
      return;
    }

    selector.value = language;
    button.closest('details')?.removeAttribute('open');
    selector.dispatchEvent(new Event('change', {bubbles:true}));
  });
})();

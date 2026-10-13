(() => {
  'use strict';

  document.addEventListener('pointerdown', (event) => {
    const menu = document.querySelector('.dashboard-language-menu-v300157[open]');
    if (menu && !menu.contains(event.target)) menu.removeAttribute('open');
  }, {passive:true});

  document.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dashboard-language]');
    if (!button) return;

    const selector = document.getElementById('app-language');
    if (!(selector instanceof HTMLSelectElement) || selector.disabled) return;

    const language = button.dataset.dashboardLanguage || '';
    if (!language || selector.value === language) {
      button.closest('details')?.removeAttribute('open');
      return;
    }

    selector.value = language;
    button.closest('details')?.removeAttribute('open');
    selector.dispatchEvent(new Event('change', {bubbles:true}));
  });
})();

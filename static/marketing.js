(() => {
  'use strict';
  document.addEventListener('DOMContentLoaded', () => {
    const toggle = document.querySelector('.marketing-menu-toggle');
    const links = document.querySelector('.marketing-links');
    if (toggle && links) {
      toggle.addEventListener('click', () => {
        const open = links.classList.toggle('open');
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      links.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
      }));
    }
  }, {once: true});
})();

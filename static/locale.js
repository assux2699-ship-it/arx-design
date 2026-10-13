/* Direct key lookup for newly rendered UI; existing DOM text is never scanned. */
(() => {
  'use strict';

  // ARX V300.174: enforce the same favicon on every ARX surface.
  // This is intentionally done in JS as well as HTML so pages that previously
  // lacked a direct <link rel="icon"> cannot fall back to the browser globe.
  (() => {
    const icons = [
      {rel: 'icon', type: 'image/png', sizes: '16x16', href: '/static/favicon-16x16.png?v=300175'},
      {rel: 'icon', type: 'image/png', sizes: '32x32', href: '/static/favicon-32x32.png?v=300175'},
      {rel: 'icon', type: 'image/png', sizes: '48x48', href: '/static/favicon-48x48.png?v=300175'},
      {rel: 'shortcut icon', href: '/static/favicon.ico?v=300175'},
      {rel: 'apple-touch-icon', sizes: '180x180', href: '/static/apple-touch-icon.png?v=300175'},
    ];

    const head = document.head || document.getElementsByTagName('head')[0];
    if (!head) return;

    head.querySelectorAll('link[rel~="icon"], link[rel="apple-touch-icon"]').forEach(node => {
      node.remove();
    });

    const assetBase = typeof window.ARX_ASSET_BASE === 'string' ? window.ARX_ASSET_BASE.replace(/\/$/, '') : '';
    for (const spec of icons) {
      const link = document.createElement('link');
      link.rel = spec.rel;
      if (spec.type) link.type = spec.type;
      if (spec.sizes) link.sizes = spec.sizes;
      link.href = assetBase + spec.href;
      head.appendChild(link);
    }
  })();

  try { localStorage.removeItem('arx.ui.language.v1'); } catch (_) {}
  const {language, messages} = JSON.parse(document.getElementById('arx-locale').textContent);
  const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
  const parameters = /(?<!\{)\{([A-Za-z_][A-Za-z_0-9]*)\}(?!\})/g;
  const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function t(key, values = {}) {
    if (!own(messages, key)) throw new Error(`Missing translation: ${language}.${key}`);
    const text = messages[key];
    const required = [...new Set([...text.matchAll(parameters)].map(match => match[1]))].sort();
    if (JSON.stringify(required) !== JSON.stringify(Object.keys(values).sort())) {
      throw new Error(`Invalid translation parameters: ${language}.${key}`);
    }
    return text.replace(/\{\{|\}\}|(?<!\{)\{([A-Za-z_][A-Za-z_0-9]*)\}(?!\})/g,
      (match, name) => match === '{{' ? '{' : match === '}}' ? '}' : String(values[name]));
  }
  Object.freeze(messages);
  window.ARXI18n = Object.freeze({language, t, html: (key, values) => escape(t(key, values)), escape});
  let languageSaveInFlight = false;
  document.addEventListener('change', async event => {
    const selector = event.target;
    if (!(selector instanceof HTMLSelectElement) || selector.id !== 'app-language') return;
    if (languageSaveInFlight || selector.disabled) return;

    const requestedLanguage = selector.value;
    languageSaveInFlight = true;
    selector.disabled = true;
    try {
      const response = await fetch('/api/ui-language', {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({language: requestedLanguage}),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok !== true || result.language !== requestedLanguage) {
        throw new Error(t('common.language_save_failed'));
      }
      window.location.reload();
    } catch (error) {
      languageSaveInFlight = false;
      selector.value = language;
      selector.disabled = false;
      window.alert(t('common.language_save_failed'));
    }
  });
})();

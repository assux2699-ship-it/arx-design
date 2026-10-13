/* Independent ARX login front-end: the customer runtime remains authoritative.
 * This file runs ONLY on website/app.py's public /login page.
 * No token/session parsing, OAuth callback handling or billing code belongs here.
 */
(() => {
  'use strict';
  if (window.ARXStandaloneLoginBound) return;
  const link = document.querySelector('a.discord-login-button[href]');
  if (!link) return;
  window.ARXStandaloneLoginBound = true;
  const freshOAuth = new URLSearchParams(window.location.search).get('refresh') === '1';
  let pending = false;

  async function fetchWithTimeout(path) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 4500);
    try {
      return await window.fetch(path, {
        method: 'GET',
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {'Accept': 'application/json'},
        signal: controller.signal,
      });
    } finally {
      window.clearTimeout(timer);
    }
  }

  async function panelSession() {
    try {
      // 200 means the user has a valid panel session, even if the Discord bot
      // itself is offline. 401 means the backend is alive but sign-in is needed.
      let response = await fetchWithTimeout('/api/bot/health');
      if (response.status === 404) {
        // An older panel build does not have the lightweight health route.
        response = await fetchWithTimeout('/api/status');
      }
      if (response.status === 200) return 'signed-in';
      if (response.status === 401) return 'signed-out';
      if (response.status === 502 || response.status === 503 || response.status === 504) {
        return 'maintenance';
      }
      // Preserve the existing OAuth server's behavior for unusual HTTP codes
      // such as rate limits, which must not be confused with maintenance.
      return 'unknown';
    } catch (_) {
      return 'maintenance';
    }
  }

  function continueSession() {
    // Equivalent to the old 8000 /login handler. "refresh=1" deliberately
    // starts reauthorization rather than silently opening the workspace.
    window.location.replace(freshOAuth ? '/oauth/start?refresh=1' : '/');
  }

  function showMaintenance() {
    const dialog = window.ARXBotMaintenance;
    if (dialog && typeof dialog.show === 'function') dialog.show();
  }

  // Never redirect automatically from /login to /. A session check may have
  // succeeded momentarily while / rejects or revalidates that same session;
  // automatic redirects can trap customers in an endless / <-> /login loop.
  // Resolve the session only after an explicit click.
  // If the customer API is down, the independent login screen stays available
  // and shows the mascot maintenance dialog instead of linking to a 502.
  link.addEventListener('click', event => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (pending) return;
    pending = true;
    link.setAttribute('aria-busy', 'true');
    void panelSession().then(state => {
      if (state === 'maintenance') {
        showMaintenance();
      } else if (state === 'signed-in') {
        continueSession();
      } else {
        window.location.assign(link.href);
      }
    }).finally(() => {
      pending = false;
      link.removeAttribute('aria-busy');
    });
  });
})();

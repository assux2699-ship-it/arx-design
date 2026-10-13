/* ARX customer-maintenance dialog. Never alters OAuth, billing or admin flows. */
(() => {
  'use strict';
  if (window.ARXBotMaintenance) return;

  const messages = {
    en: ['ARX Maintenance', 'We are performing maintenance on ARX. Please try your action again shortly. Your settings remain saved.', 'Understood'],
    tr: ['ARX Bakım Çalışması', 'ARX üzerinde bakım çalışması yapıyoruz. İşleminizi kısa bir süre sonra yeniden deneyebilirsiniz. Mevcut ayarlarınız korunuyor.', 'Anladım'],
    fr: ['Maintenance ARX', 'ARX fait actuellement l’objet d’une maintenance. Réessayez votre opération dans quelques instants. Vos paramètres sont conservés.', 'Compris'],
    es: ['Mantenimiento de ARX', 'Estamos realizando tareas de mantenimiento en ARX. Vuelve a intentarlo en unos momentos. Tus ajustes se conservan.', 'Entendido'],
    de: ['ARX-Wartung', 'ARX wird derzeit gewartet. Bitte versuchen Sie die Aktion in Kürze erneut. Ihre Einstellungen bleiben erhalten.', 'Verstanden'],
    ar: ['صيانة ARX', 'نجري حاليًا أعمال صيانة على ARX. يُرجى إعادة المحاولة بعد قليل. إعداداتك محفوظة.', 'حسنًا'],
    pt: ['Manutenção do ARX', 'Estamos realizando uma manutenção no ARX. Tente novamente em instantes. Suas configurações foram preservadas.', 'Entendi'],
    ja: ['ARX メンテナンス', '現在 ARX のメンテナンスを行っています。しばらくしてから再度お試しください。設定は保持されています。', '了解'],
    ru: ['Техническое обслуживание ARX', 'Сейчас в ARX проводятся технические работы. Повторите действие немного позже. Ваши настройки сохранены.', 'Понятно'],
    ko: ['ARX 점검 안내', '현재 ARX 점검을 진행 중입니다. 잠시 후 다시 시도해 주세요. 기존 설정은 유지됩니다.', '확인'],
    'pt-BR': ['Manutenção do ARX', 'Estamos realizando uma manutenção no ARX. Tente novamente daqui a pouco. Suas configurações estão preservadas.', 'Entendi'],
    pl: ['Prace konserwacyjne ARX', 'Trwają prace konserwacyjne ARX. Spróbuj ponownie za chwilę. Twoje ustawienia są zachowane.', 'Rozumiem'],
    it: ['Manutenzione ARX', 'Stiamo effettuando la manutenzione di ARX. Riprova tra poco. Le tue impostazioni sono al sicuro.', 'Ho capito'],
    'sv-SE': ['ARX-underhåll', 'ARX genomgår underhåll. Försök igen om en liten stund. Dina inställningar finns kvar.', 'Jag förstår'],
    nl: ['ARX-onderhoud', 'We voeren momenteel onderhoud uit aan ARX. Probeer het zo opnieuw. Je instellingen blijven bewaard.', 'Begrepen']
  };
  const dependsOnBot = path => (
    /^\/(?:guild|api\/guild|api\/guilds)\/\d+(?:\/|$)/.test(path)
    && !/^\/api\/guilds\/\d+\/language\/?$/.test(path)
    && !/^\/guild\/\d+\/premium-transfer\/?$/.test(path)
  );
  const guardedMethods = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
  const nativeFetch = window.fetch.bind(window);
  const replaying = new WeakSet();
  const pending = new WeakSet();
  let dialog;

  function language() {
    const active = String(window.ARXI18n?.language || document.documentElement.lang || 'en');
    return messages[active] ? active : 'en';
  }

  function openModal() {
    if (!document.body) return;
    if (!dialog || !dialog.isConnected) {
      dialog = document.createElement('dialog');
      dialog.className = 'arx-maintenance-dialog';
      dialog.setAttribute('aria-labelledby', 'arx-maintenance-title');
      dialog.setAttribute('aria-describedby', 'arx-maintenance-description');
      const symbol = document.createElement('img');
      symbol.className = 'arx-maintenance-symbol';
      const assetBase = typeof window.ARX_ASSET_BASE === 'string'
        ? window.ARX_ASSET_BASE.replace(/\/$/, '') : '';
      symbol.src = assetBase + '/static/arx_maintenance_cat.png?v=300286-cat-lite-2';
      symbol.onerror = () => {
        // Keep a branded mascot if a partial deployment is missing the lite art.
        symbol.onerror = null;
        symbol.src = assetBase + '/static/arx_brand_logo.png';
      };
      symbol.alt = '';
      symbol.width = 176;
      symbol.height = 172;
      symbol.decoding = 'async';
      const title = document.createElement('h2');
      title.id = 'arx-maintenance-title';
      const description = document.createElement('p');
      description.id = 'arx-maintenance-description';
      const accept = document.createElement('button');
      accept.type = 'button';
      accept.className = 'arx-maintenance-accept';
      accept.addEventListener('click', () => dialog.close());
      dialog.append(symbol, title, description, accept);
      document.body.append(dialog);
    }
    const translation = messages[language()];
    dialog.dir = document.documentElement.dir || 'ltr';
    dialog.querySelector('h2').textContent = translation[0];
    dialog.querySelector('p').textContent = translation[1];
    dialog.querySelector('button').textContent = translation[2];
    if (!dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    }
  }

  // Older running panels (before the maintenance endpoint was added) answer
  // /api/bot/health with 404. Read the already-existing authenticated system
  // status as a compatibility fallback; do not treat other HTTP failures as
  // evidence of maintenance.
  async function legacyHeartbeatMaintenance() {
    try {
      const response = await nativeFetch('/api/status', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {'Accept': 'application/json'},
      });
      if (!response.ok) return false;
      const payload = await response.json();
      const bot = payload?.systems?.bot;
      if (!bot || typeof bot.status_value !== 'string') return true;
      if (!bot.status_value.startsWith('online:')) return true;
      const raw = String(bot.updated_at || '').trim();
      const iso = /(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(raw)
        ? raw.replace(' ', 'T')
        : raw.replace(' ', 'T') + 'Z';
      const age = Date.now() - Date.parse(iso);
      return !Number.isFinite(age) || age < 0 || age >= 30000;
    } catch (_) {
      return false;
    }
  }

  async function botInMaintenance() {
    try {
      const response = await nativeFetch('/api/bot/health', {
        cache: 'no-store',
        credentials: 'same-origin',
        headers: {'Accept': 'application/json'},
      });
      if (response.status === 404) return legacyHeartbeatMaintenance();
      if (!response.ok) return false;
      const data = await response.json();
      return data.maintenance === true;
    } catch (_) {
      // If the entire panel is disconnected, a maintenance pop-up cannot
      // reliably explain the failure. Leave generic connection errors alone.
      return false;
    }
  }

  // AJAX requests that race with a bot shutdown get the same dialog, not a
  // generic browser alert. Only the maintenance response can trigger this.
  window.fetch = async function(...args) {
    const response = await nativeFetch(...args);
    if (response.status === 503 && response.headers.get('X-ARX-Maintenance') === 'bot') {
      openModal();
    }
    return response;
  };

  // Classic forms normally navigate to a 503 error page. Probe BEFORE sending
  // the mutation, and replay the submit only when the bot is running. Capture
  // on window so existing form handlers cannot queue an action first.
  window.addEventListener('submit', event => {
    const form = event.target;
    if (!(form instanceof HTMLFormElement) || replaying.has(form)) return;
    const method = String(form.method || 'GET').toUpperCase();
    let url;
    try { url = new URL(form.action, location.href); } catch (_) { return; }
    if (!guardedMethods.has(method) || url.origin !== location.origin || !dependsOnBot(url.pathname)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending.has(form)) return;
    pending.add(form);
    const submitter = event.submitter instanceof HTMLElement ? event.submitter : null;
    void botInMaintenance().then(maintenance => {
      if (maintenance) { openModal(); return; }
      if (!form.isConnected) return;
      replaying.add(form);
      try { form.requestSubmit(submitter && submitter.isConnected ? submitter : undefined); }
      finally { replaying.delete(form); }
    }).finally(() => pending.delete(form));
  }, true);

  // The main setup controls use JS fetch rather than HTML forms. Intercept
  // their click before the existing handler changes UI or creates a queue job.
  window.addEventListener('click', event => {
    const target = event.target instanceof Element
      ? event.target.closest('button.setup-button, button.setup-remove-button')
      : null;
    if (!target || replaying.has(target) || target.disabled) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (pending.has(target)) return;
    pending.add(target);
    void botInMaintenance().then(maintenance => {
      if (maintenance) { openModal(); return; }
      if (!target.isConnected || target.disabled) return;
      replaying.add(target);
      try { target.click(); } finally { replaying.delete(target); }
    }).finally(() => pending.delete(target));
  }, true);

  window.ARXBotMaintenance = Object.freeze({show: openModal, check: botInMaintenance});
})();

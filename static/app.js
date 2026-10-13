/* ARX V283 — re-runnable application bootstrap for persistent workspace navigation. */
(() => {
  const RUNTIME_KEY = '__arxAppRuntimeV283';
  function arxAppBoot() {
    const previous = window[RUNTIME_KEY];
    if (previous) {
      try { previous.controller?.abort(); } catch (_) {}
      try { for (const id of previous.intervals || []) clearInterval(id); } catch (_) {}
    }

    const controller = new AbortController();
    const intervals = new Set();
    window[RUNTIME_KEY] = {controller, intervals};

    const nativeAddEventListener = EventTarget.prototype.addEventListener;
    const nativeSetInterval = window.setInterval;
    const withAbortSignal = (options) => {
      if (options && typeof options === 'object' && options.signal) return options;
      if (typeof options === 'boolean') return {capture: options, signal: controller.signal};
      return {...(options || {}), signal: controller.signal};
    };

    EventTarget.prototype.addEventListener = function(type, listener, options) {
      return nativeAddEventListener.call(this, type, listener, withAbortSignal(options));
    };
    window.setInterval = function(...args) {
      const id = nativeSetInterval.apply(window, args);
      intervals.add(id);
      return id;
    };

    try {
      const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
      const t = window.ARXI18n.t;
      const currentUiLanguage = window.ARXI18n.language;

      // A setup action can already be in the queue when the bot exits. Check
      // offline state while polling so the UI never waits minutes without
      // explaining why. This does NOT claim to cancel an already queued job.
      async function showMaintenanceForWaitingAction(result, attempt, message, button, sibling) {
        if (!['pending', 'waiting', 'running'].includes(String(result?.status || ''))) return false;
        if (attempt % 3 !== 0) return false; // maximum one extra check / 6 s
        const api = window.ARXBotMaintenance;
        if (!api || typeof api.check !== 'function') return false;
        if (!await api.check()) return false;
        api.show();
        message.textContent = '';
        button.disabled = false;
        if (sibling) sibling.disabled = false;
        return true;
      }


      // V300.258: keep the Overview / General Community install artwork in sync
      // with the server-side setup state without requiring a manual F5.  The
      // action worker is authoritative, so after an install/remove completes we
      // fetch the current page uncached and copy only the setup-state visuals.
      async function refreshSetupVisualState() {
        if (!document.querySelector('.setup-package')) return false;
        try {
          const url = new URL(window.location.href);
          url.searchParams.set('_arx_setup_state', String(Date.now()));
          const response = await fetch(url.toString(), {
            method: 'GET',
            cache: 'no-store',
            credentials: 'same-origin',
            headers: {'Accept': 'text/html'},
          });
          if (!response.ok) return false;

          const html = await response.text();
          const freshDocument = new DOMParser().parseFromString(html, 'text/html');

          const currentOverview = document.querySelector('.overview-v300153-setup');
          const freshOverview = freshDocument.querySelector('.overview-v300153-setup');
          if (currentOverview && freshOverview) {
            currentOverview.className = freshOverview.className;
            currentOverview.innerHTML = freshOverview.innerHTML;
          }

          const currentGeneral = document.querySelector('[data-blueprint-card="general"]');
          const freshGeneral = freshDocument.querySelector('[data-blueprint-card="general"]');
          if (currentGeneral && freshGeneral) {
            currentGeneral.classList.toggle('is-installed', freshGeneral.classList.contains('is-installed'));
            const currentArt = currentGeneral.querySelector('.setup-state-art');
            const freshArt = freshGeneral.querySelector('.setup-state-art');
            if (currentArt && freshArt) currentArt.innerHTML = freshArt.innerHTML;
          }
          return true;
        } catch (_) {
          return false;
        }
      }

      const refreshSetupVisualStateSettled = async () => {
        await refreshSetupVisualState();
        // A short second pass covers the small window where the worker action is
        // completed but the setup summary has only just been committed.
        window.setTimeout(() => { void refreshSetupVisualState(); }, 900);
      };

      async function updateStatus() {
        const dot = document.querySelector('#status-dot');
        const label = document.querySelector('#system-text');
        if (!dot || !label) return;
        try {
          const response = await fetch('/api/status');
          const data = await response.json();
          const bot = data.systems.bot;
          const heartbeatAge = bot ? Date.now() - Date.parse(`${bot.updated_at.replace(' ', 'T')}Z`) : Infinity;
          const online = bot && bot.status_value.startsWith('online:') && heartbeatAge < 30000;
          const guildCount = online ? Number(bot.status_value.split(':')[1] || 0) : 0;
          dot.classList.toggle('online', online);
          label.textContent = online ? t("common.bot_online", {count: guildCount}) : t("common.bot_waiting");
        } catch (_) {
          label.textContent = t("common.panel_connection_unavailable");
        }
      }
      
      for (const link of document.querySelectorAll('.requires-guild')) {
        link.addEventListener('click', () => {
          const message = document.querySelector('#no-guild-message');
          if (message) {
            message.textContent = t("app.connect_arx_to_at_least_one_discord_server_before_opening_this_module");
            message.classList.add('attention');
            setTimeout(() => message.classList.remove('attention'), 1600);
          }
        });
      }
      
      for (const card of document.querySelectorAll('.guild-card')) {
        const guildId = card.dataset.guildId;
        const setupLanguage = card.querySelector('.setup-language');
        const button = card.querySelector('.setup-button');
        const message = card.querySelector('.action-message');
        if (!button || !message) continue;
      
        button.addEventListener('click', async () => {
          button.disabled = true;
          message.classList.remove('error');
          message.textContent = t("common.setup_sent_to_the_bot_action_queue");
          const response = await fetch(`/api/guilds/${guildId}/setup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({setup_language: setupLanguage?.value || 'en'}),
          });
          if (response.status === 503 && response.headers.get('X-ARX-Maintenance') === 'bot') {
            message.textContent = '';
            button.disabled = false;
            if (typeof removeButton !== 'undefined' && removeButton) removeButton.disabled = false;
            return;
          }
          if (!response.ok) {
            let detail = t("common.setup_could_not_be_started");
            try {
              const body = await response.json();
              if (body.detail) detail = body.detail;
            } catch (_) {}
            message.textContent = detail;
            message.classList.add('error');
            button.disabled = false;
            return;
          }
          const {action_id: actionId} = await response.json();
          for (let attempt = 0; attempt < 90; attempt++) {
            await sleep(2000);
            const result = await fetch(`/api/actions/${actionId}`).then(r => r.json());
            if (await showMaintenanceForWaitingAction(result, attempt, message, button, null)) return;
            if (result.status === 'completed') {
              const details = JSON.parse(result.result_json || '{}');
              const warning = details.warnings?.length ? t("app.warning_value0", {value0: (details.warnings.join(' / '))}) : '';
              message.textContent = t("app.completed_value0_created_value1_updated_value2_preserved_value3", {value0: (details.created || 0), value1: (details.updated || 0), value2: (details.reused || 0), value3: (warning)});
              button.textContent = t("common.update_setup");
              button.disabled = false;
              return;
            }
            if (result.status === 'failed') {
              message.textContent = t("app.error_value0", {value0: (result.error_text || t("app.the_operation_could_not_be_completed"))});
              message.classList.add('error');
              button.disabled = false;
              return;
            }
            message.textContent = result.status === 'running' ? t("common.arx_is_applying_the_selected_server_package") : t("common.waiting_for_bot_action");
          }
          message.textContent = t("common.the_operation_is_still_running_refresh_the_page_in_a_few_minutes");
          button.disabled = false;
        });
      }
      
      for (const panel of document.querySelectorAll('.setup-package')) {
        const authorize = panel.querySelector('[data-setup-authorize]');
        const featureInputs = [...panel.querySelectorAll('[data-setup-feature]')];
        const blueprintInputs = [...panel.querySelectorAll('[data-game-blueprint]')];
        const installButton = panel.querySelector('.setup-button');
        const removeButton = panel.querySelector('.setup-remove-button');
        const afkTimeout = panel.querySelector('.setup-afk-timeout');
      
        const applyAuthorizationGate = () => {
          const unlocked = Boolean(authorize?.checked);
          for (const input of featureInputs) {
            input.disabled = !unlocked;
            input.closest('.setup-option')?.classList.toggle('disabled', !unlocked);
          }
          for (const input of blueprintInputs) input.disabled = !unlocked;
          panel.querySelectorAll('[data-blueprint-card]').forEach(card => {
            card.classList.toggle('setup-gated-disabled', !unlocked);
            card.setAttribute('aria-disabled', String(!unlocked));
          });
          if (afkTimeout) afkTimeout.disabled = !unlocked;
          if (installButton) installButton.disabled = !unlocked;
          if (removeButton) removeButton.disabled = !unlocked;
          panel.classList.toggle('setup-authorized', unlocked);
        };
      
        authorize?.addEventListener('change', applyAuthorizationGate);
        applyAuthorizationGate();
      }
      
      for (const picker of document.querySelectorAll('[data-game-blueprint-picker]')) {
        const panel = picker.closest('.setup-package');
        const cards = [...picker.querySelectorAll('[data-blueprint-card]')];
        const radios = [...picker.querySelectorAll('[data-game-blueprint]')];
        const silkroadSmart = panel?.querySelector('[data-silkroad-smart-setup]');
        const setupLanguage = panel?.querySelector('.setup-language');
      
        const paint = () => {
          const selected = radios.find(input => input.checked);
          const isSilkroad = selected?.value === 'silkroad-community';
          for (const card of cards) {
            card.classList.toggle('selected', card.dataset.blueprintCard === selected?.value);
          }
          if (silkroadSmart) silkroadSmart.hidden = !isSilkroad;
          if (setupLanguage) {
            if (isSilkroad) {
              if (!setupLanguage.dataset.beforeSilkroad) setupLanguage.dataset.beforeSilkroad = setupLanguage.value || 'en';
              setupLanguage.value = 'en';
              setupLanguage.disabled = true;
              setupLanguage.closest('.setup-language-field')?.classList.add('silkroad-language-locked');
            } else {
              setupLanguage.disabled = false;
              const previous = setupLanguage.dataset.beforeSilkroad;
              if (previous) {
                setupLanguage.value = previous;
                delete setupLanguage.dataset.beforeSilkroad;
              }
              setupLanguage.closest('.setup-language-field')?.classList.remove('silkroad-language-locked');
            }
          }
        };
      
        const applyRecommendedPackage = input => {
          if (!panel || !input) return;
          const recommended = new Set(
            String(input.dataset.features || '')
              .split(',')
              .map(value => value.trim())
              .filter(Boolean)
          );
          const isGeneral = input.value === 'general';
      
          // "General" keeps the user's current module choices. Game templates are
          // one-click presets and therefore apply their recommended base package.
          if (!isGeneral) {
            panel.querySelectorAll('[data-setup-feature]').forEach(checkbox => {
              if (checkbox.dataset.setupFeature === 'music') {
                checkbox.checked = input.dataset.music === '1';
              } else {
                checkbox.checked = recommended.has(checkbox.dataset.setupFeature);
              }
            });
            const roles = panel.querySelector('[data-setup-feature="roles"]');
            roles?.dispatchEvent(new Event('change', {bubbles: true}));
          }
          paint();
        };
      
        radios.forEach(input => {
          input.addEventListener('change', () => {
            if (input.checked) applyRecommendedPackage(input);
          });
        });
        cards.forEach(card => {
          card.addEventListener('click', () => {
            const input = card.querySelector('[data-game-blueprint]');
            if (!input || input.disabled) return;
            if (!input.checked) {
              input.checked = true;
              input.dispatchEvent(new Event('change', {bubbles: true}));
            }
          });
        });
        paint();
      }
      
      for (const button of document.querySelectorAll('.setup-package .setup-button[data-guild-id]')) {
        button.addEventListener('click', async () => {
          const guildId = button.dataset.guildId;
          const panel = button.closest('.setup-package');
          const message = panel.querySelector('.action-message');
          const features = [...panel.querySelectorAll('[data-setup-feature]:checked')].map(input => input.dataset.setupFeature);
          const afkTimeout = Number(panel.querySelector('.setup-afk-timeout')?.value || 900);
          const selectedBlueprint = panel.querySelector('[data-game-blueprint]:checked');
          const gameBlueprintKey = selectedBlueprint?.value || null;
          const setupLanguage = gameBlueprintKey === 'silkroad-community'
            ? 'en'
            : (panel.querySelector('.setup-language')?.value || 'en');
          const authorized = Boolean(panel.querySelector('[data-setup-authorize]')?.checked);
      
          if (!authorized) {
            message.textContent = t("setup.authorize_arx_required");
            message.classList.add('error');
            return;
          }
      
          if (!features.length && (!gameBlueprintKey || gameBlueprintKey === 'general')) {
            message.textContent = t("setup.select_at_least_one_to_install");
            message.classList.add('error');
            return;
          }
      
          button.disabled = true;
          const removeButton = panel.querySelector('.setup-remove-button');
          if (removeButton) removeButton.disabled = true;
          message.classList.remove('error');
          message.textContent = t("common.setup_sent_to_the_bot_action_queue");
          const payload = {
            features,
            afk_timeout_seconds: afkTimeout,
            setup_language: setupLanguage,
            authorize_arx: true,
          };
          if (gameBlueprintKey) payload.game_blueprint_key = gameBlueprintKey;
          if (gameBlueprintKey === 'silkroad-community') {
            const silkroadOptions = {};
            panel.querySelectorAll('[data-silkroad-field]').forEach(input => {
              const key = input.dataset.silkroadField;
              if (!key) return;
              silkroadOptions[key] = input.type === 'checkbox' ? Boolean(input.checked) : input.value;
            });
            payload.silkroad_options = silkroadOptions;
          }
          const response = await fetch(`/api/guilds/${guildId}/setup`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(payload),
          });
          if (response.status === 503 && response.headers.get('X-ARX-Maintenance') === 'bot') {
            message.textContent = '';
            button.disabled = false;
            if (typeof removeButton !== 'undefined' && removeButton) removeButton.disabled = false;
            return;
          }
          if (!response.ok) {
            let detail = t("common.setup_could_not_be_started");
            try {
              const body = await response.json();
              if (body.detail) detail = body.detail;
            } catch (_) {}
            message.textContent = detail;
            message.classList.add('error');
            button.disabled = false;
            if (removeButton) removeButton.disabled = false;
            return;
          }
          const {action_id: actionId} = await response.json();
          for (let attempt = 0; attempt < 120; attempt++) {
            await sleep(2000);
            const result = await fetch(`/api/actions/${actionId}`).then(r => r.json());
            if (await showMaintenanceForWaitingAction(result, attempt, message, button, removeButton)) return;
            if (result.status === 'completed') {
              const detail = JSON.parse(result.result_json || '{}');
              const warning = detail.warnings?.length ? t("app.warning_value0", {value0: (detail.warnings.join(' / '))}) : '';
              message.textContent = t("app.completed_value0_created_value1_updated_value2_preserved_value3_remove", {value0: (detail.created || 0), value1: (detail.updated || 0), value2: (detail.reused || 0), value3: (detail.removed || 0), value4: (warning)});
              await refreshSetupVisualStateSettled();
              button.disabled = false;
              if (removeButton) removeButton.disabled = false;
              return;
            }
            if (result.status === 'failed') {
              message.textContent = t("app.error_value0", {value0: (result.error_text || t("app.the_operation_could_not_be_completed"))});
              message.classList.add('error');
              button.disabled = false;
              if (removeButton) removeButton.disabled = false;
              return;
            }
            message.textContent = result.status === 'running' ? t("common.arx_is_applying_the_selected_server_package") : t("common.waiting_for_bot_action");
          }
          message.textContent = t("common.the_operation_is_still_running_refresh_the_page_in_a_few_minutes");
          button.disabled = false;
          if (removeButton) removeButton.disabled = false;
        });
      }
      
      for (const button of document.querySelectorAll('.setup-package .setup-remove-button[data-guild-id]')) {
        button.addEventListener('click', async () => {
          const guildId = button.dataset.guildId;
          const panel = button.closest('.setup-package');
          const installButton = panel.querySelector('.setup-button');
          const message = panel.querySelector('.action-message');
          const features = [...panel.querySelectorAll('[data-setup-feature]:checked')].map(input => input.dataset.setupFeature);
          const setupLanguage = panel.querySelector('.setup-language')?.value || 'en';
          const authorized = Boolean(panel.querySelector('[data-setup-authorize]')?.checked);
      
          if (!authorized) {
            message.textContent = t("setup.authorize_arx_required");
            message.classList.add('error');
            return;
          }
      
          if (!features.length) {
            message.textContent = t("setup.select_at_least_one_to_remove");
            message.classList.add('error');
            return;
          }
          if (!window.confirm(t("setup.remove_selected_confirm"))) return;
      
          button.disabled = true;
          if (installButton) installButton.disabled = true;
          message.classList.remove('error');
          message.textContent = t("setup.removal_sent_to_bot");
      
          const response = await fetch(`/api/guilds/${guildId}/setup/remove`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({features, setup_language: setupLanguage, authorize_arx: true}),
          });
          if (response.status === 503 && response.headers.get('X-ARX-Maintenance') === 'bot') {
            message.textContent = '';
            button.disabled = false;
            if (installButton) installButton.disabled = false;
            return;
          }
          if (!response.ok) {
            let detail = t("setup.remove_failed");
            try {
              const body = await response.json();
              if (body.detail) detail = body.detail;
            } catch (_) {}
            message.textContent = detail;
            message.classList.add('error');
            button.disabled = false;
            if (installButton) installButton.disabled = false;
            return;
          }
      
          const {action_id: actionId} = await response.json();
          for (let attempt = 0; attempt < 120; attempt++) {
            await sleep(2000);
            const result = await fetch(`/api/actions/${actionId}`).then(r => r.json());
            if (await showMaintenanceForWaitingAction(result, attempt, message, button, installButton)) return;
            if (result.status === 'completed') {
              const detail = JSON.parse(result.result_json || '{}');
              const warning = detail.warnings?.length ? t("app.warning_value0", {value0: (detail.warnings.join(' / '))}) : '';
              message.textContent = t("setup.removed_summary", {count: (detail.removed || 0), warning});
              panel.querySelectorAll('[data-setup-feature]:checked').forEach(input => { input.checked = false; });
              await refreshSetupVisualStateSettled();
              button.disabled = false;
              if (installButton) installButton.disabled = false;
              return;
            }
            if (result.status === 'failed') {
              message.textContent = t("app.error_value0", {value0: (result.error_text || t("setup.remove_failed"))});
              message.classList.add('error');
              button.disabled = false;
              if (installButton) installButton.disabled = false;
              return;
            }
            message.textContent = result.status === 'running' ? t("setup.removing_selected") : t("common.waiting_for_bot_action");
          }
          message.textContent = t("common.the_operation_is_still_running_refresh_the_page_in_a_few_minutes");
          button.disabled = false;
          if (installButton) installButton.disabled = false;
        });
      }
      
      function initModerationEditors() {
        const parseList = hidden => {
          try {
            // Discord snowflake IDs are larger than JavaScript's safe integer range.
            // Preserve long numeric IDs as strings before JSON.parse so role/channel
            // labels can still be resolved exactly after a save + page reload.
            const raw = String(hidden?.value || '[]');
            const snowflakeSafe = raw.replace(/([\[,]\s*)(\d{16,})(?=\s*[,\]])/g, '$1"$2"');
            const parsed = JSON.parse(snowflakeSafe);
            return Array.isArray(parsed) ? parsed.map(value => String(value).trim()).filter(Boolean) : [];
          } catch (_) { return []; }
        };
        const unique = values => {
          const seen = new Set();
          return values.filter(value => {
            const key = String(value).trim().toLocaleLowerCase();
            if (!key || seen.has(key)) return false;
            seen.add(key); return true;
          });
        };
      
        document.querySelectorAll('[data-token-editor]').forEach(editor => {
          const hidden = editor.querySelector('input[type="hidden"]');
          const list = editor.querySelector('[data-token-list]');
          const input = editor.querySelector('[data-token-input]');
          const add = editor.querySelector('[data-token-add]');
          const status = editor.querySelector('[data-token-status]');
          const count = editor.closest('.moderation-subpanel')?.querySelector('[data-token-count]');
          let values = unique(parseList(hidden));
          const defaultStatus = status?.textContent || '';
      
          const sync = () => { if (hidden) hidden.value = JSON.stringify(values); };
          const render = () => {
            if (!list) return;
            list.replaceChildren();
            for (const value of values) {
              const chip = document.createElement('span'); chip.className = 'moderation-chip';
              const text = document.createElement('span'); text.textContent = value;
              const remove = document.createElement('button'); remove.type='button'; remove.title=t("app.remove"); remove.setAttribute('aria-label', t("app.remove_value0", {value0: (value)})); remove.textContent=t("app.symbol");
              remove.addEventListener('click', () => { values = values.filter(item => item !== value); sync(); render(); });
              chip.append(text, remove); list.append(chip);
            }
            if (!values.length) { const empty=document.createElement('small'); empty.className='moderation-chip-empty'; empty.textContent=t("app.no_records_yet"); list.append(empty); }
            if (count) count.textContent = t("module.value0_records", {value0: (values.length)});
            sync();
          };
          const addValues = raw => {
            const incoming = String(raw || '').split(/[\n,]+/).map(value => value.trim()).filter(Boolean);
            if (!incoming.length) return;
            const before = values.length;
            const existing = new Set(values.map(value => value.toLocaleLowerCase()));
            let duplicates = 0;
            for (const value of incoming) {
              const key = value.toLocaleLowerCase();
              if (existing.has(key)) { duplicates++; continue; }
              existing.add(key); values.push(value);
            }
            values = unique(values); sync(); render();
            if (status) {
              if (duplicates && values.length === before) status.textContent = t("app.this_entry_is_already_in_the_list");
              else if (duplicates) status.textContent = t("app.value0_entries_added_value1_duplicates_skipped", {value0: (values.length - before), value1: (duplicates)});
              else status.textContent = t("app.value0_entries_added", {value0: (values.length - before)});
              status.classList.toggle('duplicate', duplicates > 0 && values.length === before);
              setTimeout(() => { status.textContent = defaultStatus; status.classList.remove('duplicate'); }, 2200);
            }
            if (input) { input.value=''; input.focus(); }
          };
          add?.addEventListener('click', () => addValues(input?.value));
          input?.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addValues(input.value); }
          });
          editor.closest('form')?.addEventListener('submit', () => { if (input?.value.trim()) addValues(input.value); });
          render();
        });
      
        document.querySelectorAll('[data-multi-picker]').forEach(picker => {
          const hidden = picker.querySelector('input[type="hidden"]');
          const chips = picker.querySelector('[data-picker-chips]');
          const select = picker.querySelector('[data-picker-select]');
          let values = unique(parseList(hidden));
          const optionLabels = new Map(Array.from(select?.options || []).filter(option => option.value).map(option => [String(option.value), option.textContent?.trim() || String(option.value)]));
          const labelFor = value => {
            const key = String(value).trim();
            if (optionLabels.has(key)) return optionLabels.get(key);
            const matched = select?.querySelector(`option[value="${CSS.escape(key)}"]`)?.textContent?.trim();
            return matched || key;
          };
          const sync = () => { if (hidden) hidden.value = JSON.stringify(values); };
          const render = () => {
            if (!chips) return; chips.replaceChildren();
            for (const value of values) {
              const chip=document.createElement('span'); chip.className='moderation-chip picker-chip';
              const text=document.createElement('span'); text.textContent=labelFor(value);
              const remove=document.createElement('button'); remove.type='button'; remove.textContent=t("app.symbol"); remove.title=t("app.remove");
              remove.addEventListener('click',()=>{values=values.filter(item=>item!==value);sync();render();});
              chip.append(text,remove);chips.append(chip);
            }
            if (!values.length) { const empty=document.createElement('small');empty.className='moderation-chip-empty';empty.textContent=t("app.nothing_selected");chips.append(empty); }
            if (select) for (const option of select.options) option.disabled = !!option.value && values.includes(option.value);
            sync();
          };
          const addSelected=()=>{const value=String(select?.value||'');if(!value||values.includes(value))return;values.push(value);sync();render();if(select)select.value='';};
          select?.addEventListener('change',addSelected);
          render();
        });
      
        document.querySelectorAll('[data-moderation-rule]').forEach(form => {
          const mode=form.querySelector('[data-channel-mode]');
          const exclusions=form.querySelector('[data-channel-exclusions]');
          const syncScope=()=>{if(exclusions)exclusions.hidden=mode?.value!=='all_except';};
          mode?.addEventListener('change',syncScope); syncScope();
        });
      }
      
      function initTicketEditors() {
        document.querySelectorAll('[data-ticket-topic-editor]').forEach(editor => {
          const hidden = editor.querySelector('input[type="hidden"]');
          const list = editor.querySelector('[data-ticket-topic-list]');
          const add = editor.querySelector('[data-ticket-topic-add]');
          const status = editor.querySelector('[data-ticket-topic-status]');
          const count = editor.closest('form')?.querySelector('[data-ticket-topic-count]');
          let values = [];
          try {
            const parsed = JSON.parse(hidden?.value || '[]');
            if (Array.isArray(parsed)) values = parsed.map(value => String(value).slice(0, 100));
          } catch (_) { values = []; }
          values = values.slice(0, 25);
          if (!values.length) values = [''];
      
          const sync = () => {
            if (hidden) hidden.value = JSON.stringify(values);
            if (count) count.textContent = `${values.length} / 25`;
            if (add) add.disabled = values.length >= 25;
          };
          const render = () => {
            if (!list) return;
            list.replaceChildren();
            values.forEach((value, index) => {
              const row = document.createElement('div'); row.className = 'ticket-topic-row';
              const number = document.createElement('span'); number.className = 'ticket-topic-index'; number.textContent = String(index + 1).padStart(2, '0');
              const input = document.createElement('input'); input.type = 'text'; input.maxLength = 100; input.required = true; input.placeholder = t("app.example_technical_issue"); input.value = value;
              input.addEventListener('input', () => { values[index] = input.value; sync(); });
              const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'mini-danger ticket-topic-remove'; remove.textContent = t("app.symbol"); remove.title = t("app.remove_topic");
              remove.addEventListener('click', () => {
                values.splice(index, 1);
                if (!values.length) values.push('');
                render();
              });
              row.append(number, input, remove); list.append(row);
            });
            sync();
          };
          add?.addEventListener('click', () => {
            if (values.length >= 25) return;
            values.push(''); render();
            list?.lastElementChild?.querySelector('input')?.focus();
          });
          render();
        });
      
        document.querySelectorAll('[data-ticket-profile-form]').forEach(form => {
          const supportStatus = form.querySelector('[data-ticket-support-status]');
          const topicStatus = form.querySelector('[data-ticket-topic-status]');
          const formStatus = form.querySelector('[data-ticket-form-error]');
          const submitButton = form.querySelector('button.primary');
          const defaultTopicStatus = topicStatus?.textContent || t("module.you_can_add_up_to_25_topics");
      
          const clearServerErrors = () => {
            form.querySelectorAll('[data-ticket-field-error]').forEach(node => {
              node.textContent = '';
              node.hidden = true;
            });
            form.querySelectorAll('[aria-invalid="true"]').forEach(node => node.removeAttribute('aria-invalid'));
            if (formStatus) { formStatus.textContent = ''; formStatus.hidden = true; }
            if (supportStatus) { supportStatus.textContent = ''; supportStatus.classList.remove('error'); }
            if (topicStatus) { topicStatus.textContent = defaultTopicStatus; topicStatus.classList.remove('error'); }
          };
      
          const fieldErrorNode = field => {
            if (field === 'support_role_ids_json') return supportStatus;
            if (field === 'ticket_topics_json') return topicStatus;
            if (field === '__all__') return formStatus;
            let node = form.querySelector(`[data-ticket-field-error="${CSS.escape(field)}"]`);
            if (node) return node;
            const input = form.querySelector(`[name="${CSS.escape(field)}"]`);
            const label = input?.closest('label');
            if (!input || !label) return formStatus;
            node = document.createElement('small');
            node.className = 'ticket-inline-status error';
            node.dataset.ticketFieldError = field;
            label.append(node);
            return node;
          };
      
          form.addEventListener('input', event => {
            const field = event.target?.name;
            if (!field) return;
            event.target.removeAttribute?.('aria-invalid');
            const node = form.querySelector(`[data-ticket-field-error="${CSS.escape(field)}"]`);
            if (node) { node.textContent = ''; node.hidden = true; }
          });
      
          const showServerErrors = errors => {
            let firstInput = null;
            Object.entries(errors || {}).forEach(([field, message]) => {
              const node = fieldErrorNode(field);
              if (node) {
                node.textContent = String(message || t("app.check_this_field"));
                node.classList.add('error');
                node.hidden = false;
              }
              const input = field !== '__all__' ? form.querySelector(`[name="${CSS.escape(field)}"]`) : null;
              if (input) {
                input.setAttribute('aria-invalid', 'true');
                if (!firstInput) firstInput = input;
              } else if (field === 'support_role_ids_json' && !firstInput) {
                firstInput = form.querySelector('[data-multi-picker] select');
              } else if (field === 'ticket_topics_json' && !firstInput) {
                firstInput = form.querySelector('[data-ticket-topic-list] input');
              }
            });
            (firstInput || formStatus)?.scrollIntoView({behavior:'smooth', block:'center'});
            firstInput?.focus?.();
          };
      
          form.addEventListener('submit', async event => {
            clearServerErrors();
            const support = form.querySelector('input[name="support_role_ids_json"]');
            const topics = form.querySelector('input[name="ticket_topics_json"]');
            let supportValues = []; let topicValues = [];
            try { supportValues = JSON.parse(support?.value || '[]'); } catch (_) {}
            try { topicValues = JSON.parse(topics?.value || '[]'); } catch (_) {}
            const cleanedTopics = []; const seen = new Set();
            for (const raw of Array.isArray(topicValues) ? topicValues : []) {
              const value = String(raw || '').trim().slice(0, 100);
              const key = value.toLocaleLowerCase();
              if (!value || seen.has(key)) continue;
              seen.add(key); cleanedTopics.push(value);
              if (cleanedTopics.length >= 25) break;
            }
            if (topics) topics.value = JSON.stringify(cleanedTopics);
            if (!Array.isArray(supportValues) || !supportValues.length) {
              event.preventDefault();
              if (supportStatus) { supportStatus.textContent = t("app.add_at_least_one_support_role"); supportStatus.classList.add('error'); }
              form.querySelector('[data-multi-picker]')?.scrollIntoView({behavior:'smooth', block:'center'});
              return;
            }
            if (!cleanedTopics.length) {
              event.preventDefault();
              if (topicStatus) { topicStatus.textContent = t("app.enter_at_least_one_ticket_topic"); topicStatus.classList.add('error'); }
              return;
            }
      
            event.preventDefault();
            if (submitButton) submitButton.disabled = true;
            try {
              const response = await fetch(form.action, {
                method: 'POST',
                body: new FormData(form),
                headers: {'X-ARX-Form': 'ticket-profile', 'Accept': 'application/json'}
              });
              let payload = null;
              try { payload = await response.json(); } catch (_) {}
              if (!response.ok || !payload?.ok) {
                showServerErrors(payload?.errors || {__all__: t("app.could_not_save_the_profile_check_the_fields_and_try_again")});
                return;
              }
              window.location.assign(payload.redirect || form.action.replace(/\/profile$/, ''));
            } catch (_) {
              showServerErrors({__all__: t("app.could_not_reach_the_arx_panel_check_your_connection_and_try_again")});
            } finally {
              if (submitButton) submitButton.disabled = false;
            }
          });
        });
      
        document.querySelectorAll('[data-ticket-standard-thumbnail]').forEach(editor=>{
          const input=editor.querySelector('[data-ticket-standard-thumbnail-file]');
          const preview=editor.querySelector('[data-ticket-standard-thumbnail-preview]');
          let objectUrl='';
          input?.addEventListener('change',()=>{
            const file=input.files?.[0];if(!file||!preview)return;
            if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);
            preview.replaceChildren();const img=document.createElement('img');img.src=objectUrl;img.alt='';preview.append(img);
            const remove=editor.querySelector('input[name="remove_thumbnail_image"]');if(remove)remove.checked=false;
          });
        });
      }
      
      
      function initTicketPlusPreview() {
        document.querySelectorAll('[data-ticket-plus-form]').forEach(form => {
          const title = form.querySelector('[data-plus-title]');
          const description = form.querySelector('[data-plus-description]');
          const ctaTitle = form.querySelector('[data-plus-cta-title]');
          const ctaDescription = form.querySelector('[data-plus-cta-description]');
          const buttonLabel = form.querySelector('[data-plus-button-label]');
          const buttonEmoji = form.querySelector('[data-plus-button-emoji]');
          const buttonStyle = form.querySelector('[data-plus-button-style]');
          const accentColor = form.querySelector('[data-plus-accent-color]');
          const accentValue = form.querySelector('[data-plus-accent-value]');
          const heroLink = form.querySelector('[data-plus-hero-link]');
          const heroLinkLabel = form.querySelector('[data-plus-hero-link-label]');
          const footerMode = form.querySelector('[data-plus-footer-mode]');
          const footerText = form.querySelector('[data-plus-footer-text]');
          const heroFile = form.querySelector('[data-plus-hero-file]');
          const thumbFile = form.querySelector('[data-plus-thumbnail-file]');
          const removeHero = form.querySelector('input[name="remove_hero_image"]');
          const removeThumb = form.querySelector('input[name="remove_thumbnail_image"]');
      
          const previewRoot = document.querySelector('[data-plus-preview]');
          if (!previewRoot) return;
      
          const previewTitle = previewRoot.querySelector('[data-plus-preview-title]');
          const previewDescription = previewRoot.querySelector('[data-plus-preview-description]');
          const previewCtaTitle = previewRoot.querySelector('[data-plus-preview-cta-title]');
          const previewCtaDescription = previewRoot.querySelector('[data-plus-preview-cta-description]');
          const previewButton = previewRoot.querySelector('[data-plus-preview-button]');
          const previewButtonLabel = previewRoot.querySelector('[data-plus-preview-button-label]');
          const previewEmoji = previewRoot.querySelector('[data-plus-preview-emoji]');
          const previewFooter = previewRoot.querySelector('[data-plus-preview-footer]');
          const previewHero = previewRoot.querySelector('[data-plus-preview-hero]');
          const previewHeroAnchor = previewRoot.querySelector('[data-plus-preview-hero-anchor]');
          const previewLinkRow = previewRoot.querySelector('[data-plus-preview-link-row]');
          const previewLinkLabel = previewRoot.querySelector('[data-plus-preview-link-label]');
          const previewThumb = previewRoot.querySelector('[data-plus-preview-thumbnail]');
          const serverName = form.dataset.serverName || '';
      
          let heroObjectUrl = '';
          let thumbObjectUrl = '';
      
          const setImagePreview = (container, file, kind) => {
            if (!container) return;
            if (kind === 'hero' && heroObjectUrl) URL.revokeObjectURL(heroObjectUrl);
            if (kind === 'thumb' && thumbObjectUrl) URL.revokeObjectURL(thumbObjectUrl);
            const url = URL.createObjectURL(file);
            if (kind === 'hero') heroObjectUrl = url; else thumbObjectUrl = url;
            container.replaceChildren();
            const img = document.createElement('img');
            img.src = url;
            img.alt = '';
            container.append(img);
          };
      
          const setPlaceholder = (container, text) => {
            if (!container) return;
            container.replaceChildren();
            const span = document.createElement('span');
            span.textContent = text;
            container.append(span);
          };
      
          const sync = () => {
            if (previewTitle) previewTitle.textContent = title?.value?.trim() || t("common.ticket_setup_plus");
            if (previewDescription) previewDescription.textContent = description?.value?.trim() || '';
            if (previewCtaTitle) previewCtaTitle.textContent = ctaTitle?.value?.trim() || '';
            if (previewCtaDescription) previewCtaDescription.textContent = ctaDescription?.value?.trim() || '';
            if (previewButtonLabel) previewButtonLabel.textContent = buttonLabel?.value?.trim() || t("module.create_ticket");
            if (previewEmoji) previewEmoji.textContent = buttonEmoji?.value?.trim() || '';
            if (accentColor) {
              const value = accentColor.value || '#d946ef';
              previewRoot.style.setProperty('--ticket-plus-accent', value);
              if (accentValue) accentValue.textContent = value;
            }
      
            if (previewButton) {
              previewButton.classList.remove('preview-primary','preview-secondary','preview-success','preview-danger');
              previewButton.classList.add(`preview-${buttonStyle?.value || 'primary'}`);
            }
      
            const linkValue = heroLink?.value?.trim() || '';
            const linkLabelValue = heroLinkLabel?.value?.trim() || t("module.open_image_link");
            if (previewHeroAnchor) {
              if (/^https?:\/\//i.test(linkValue)) {
                previewHeroAnchor.href = linkValue;
                previewHeroAnchor.target = '_blank';
                previewHeroAnchor.rel = 'noopener noreferrer';
                previewHeroAnchor.classList.add('has-link');
              } else {
                previewHeroAnchor.removeAttribute('href');
                previewHeroAnchor.removeAttribute('target');
                previewHeroAnchor.removeAttribute('rel');
                previewHeroAnchor.classList.remove('has-link');
              }
            }
            if (previewLinkRow) previewLinkRow.hidden = !/^https?:\/\//i.test(linkValue);
            if (previewLinkLabel) previewLinkLabel.textContent = linkLabelValue;
      
            if (previewFooter) {
              const mode = footerMode?.value || 'hidden';
              const value =
                mode === 'hidden' ? '' :
                mode === 'custom' ? (footerText?.value?.trim() || '') :
                serverName;
              previewFooter.textContent = value;
              previewFooter.hidden = !value;
            }
          };
      
          [title, description, ctaTitle, ctaDescription, buttonLabel, buttonEmoji, heroLink, heroLinkLabel, footerText, accentColor].forEach(el => el?.addEventListener('input', sync));
          [buttonStyle, footerMode, accentColor].forEach(el => el?.addEventListener('change', sync));
      
          heroFile?.addEventListener('change', () => {
            const file = heroFile.files?.[0];
            if (!file) return;
            if (removeHero) removeHero.checked = false;
            setImagePreview(previewHero, file, 'hero');
          });
      
          thumbFile?.addEventListener('change', () => {
            const file = thumbFile.files?.[0];
            if (!file) return;
            if (removeThumb) removeThumb.checked = false;
            setImagePreview(previewThumb, file, 'thumb');
          });
      
          removeHero?.addEventListener('change', () => {
            if (removeHero.checked) setPlaceholder(previewHero, t("module.main_panel_image_preview"));
          });
          removeThumb?.addEventListener('change', () => {
            if (removeThumb.checked) setPlaceholder(previewThumb, '🖼');
          });
      
          sync();
        });
      }
      
      initModerationEditors();
      initTicketEditors();
      initTicketPlusPreview();
      updateStatus();
      setInterval(updateStatus, 10000);
      
      // Browser<->Discord live voice relay removed in V103. Bot Sohbeti is text-only.
      
      // ARX Discord-like Bot Sohbeti — canonical clean runtime.
      (() => {
        const root = document.getElementById('arxBotChat');
        if (!root) return;
      
        const guildId = root.dataset.guildId;
        const channelList = document.getElementById('arxBotChatChannels');
        const memberList = document.getElementById('arxBotChatMembers');
        const feed = document.getElementById('arxBotChatFeed');
        const workspace = document.getElementById('arxBotChatWorkspace');
        const threadPane = document.getElementById('arxBotChatThreadPane');
        const threadFeed = document.getElementById('arxBotChatThreadFeed');
        const threadTitle = document.getElementById('arxBotChatThreadTitle');
        const roomControlPanel = document.getElementById('arxBotChatRoomControl');
        const channelName = document.getElementById('arxBotChatChannelName');
        const channelIcon = document.getElementById('arxBotChatChannelIcon');
        const onlineCount = document.getElementById('arxBotChatOnlineCount');
        const liveState = document.getElementById('arxBotChatLiveState');
        const refreshButton = document.getElementById('arxBotChatRefresh');
        const composer = document.getElementById('arxBotChatComposer');
        const channelInput = document.getElementById('arxBotChatChannelInput');
        const textInput = document.getElementById('arxBotChatText');
        const imageInput = document.getElementById('arxBotChatImage');
        const uploadPreview = document.getElementById('arxBotChatUploadPreview');
        const sendButton = document.getElementById('arxBotChatSend');
        const emojiButton = document.getElementById('arxBotChatEmojiButton');
        const selfStatusDot = document.getElementById('arxBotChatSelfStatusDot');
        const selfStatusText = document.getElementById('arxBotChatSelfStatusText');
        const memberProfileDialog = document.getElementById('arxDiscordMemberProfile');
        const memberProfileCard = document.getElementById('arxDiscordMemberProfileCard');
        const memberProfileClose = document.getElementById('arxDiscordMemberProfileClose');
      
        let selectedChannel = String(root.dataset.channelId || '');
        let currentState = null;
        let stateRequestSerial = 0;
        let stateAbortController = null;
        let knownMemberVersion = -1;
        let cachedMemberGroups = [];
        let cachedOnlineCount = 0;
        const refreshedChannels = new Set();
        let lastRenderedChannel = selectedChannel;
        let lastMessageSignature = '';
        let lastForumSignature = '';
        let lastChannelSignature = '';
        let lastMemberSignature = '';
        let lastRoomSignature = '';
        let activeForumTagId = '';
        let contextMessage = null;
        let replyTarget = null;
        let forwardMessage = null;
        let pendingDeleteMessage = null;
        let forwardMembersCache = null;
        let forwardMembersLoadedAt = 0;
        const messageIndex = new Map();
        const forwardSelection = new Set();
      
        const setLive = (text, bad = false) => {
          if (!liveState) return;
          liveState.textContent = text;
          liveState.style.borderColor = bad ? '#773a3a' : '';
          liveState.style.background = bad ? '#321818' : '';
          liveState.style.color = bad ? '#ff9898' : '';
        };
      
        const localTime = value => {
          if (!value) return '';
          const raw = String(value);
          const iso = raw.includes('T') ? raw : `${raw.replace(' ', 'T')}Z`;
          const date = new Date(iso);
          return Number.isNaN(date.getTime()) ? raw : date.toLocaleString(currentUiLanguage, {day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit'});
        };

        const messageDay = value => {
          if(!value)return {key:'',label:''};
          const raw=String(value);const iso=raw.includes('T')?raw:`${raw.replace(' ','T')}Z`;const date=new Date(iso);
          if(Number.isNaN(date.getTime()))return {key:raw.slice(0,10),label:raw.slice(0,10)};
          const key=`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
          return {key,label:date.toLocaleDateString(currentUiLanguage,{year:'numeric',month:'long',day:'numeric'})};
        };

        const relativeTime = value => {
          if (!value) return '';
          const raw=String(value);
          const iso=raw.includes('T')?raw:`${raw.replace(' ','T')}Z`;
          const date=new Date(iso);
          if(Number.isNaN(date.getTime()))return raw;
          const seconds=Math.round((date.getTime()-Date.now())/1000);
          const abs=Math.abs(seconds);
          const rtf=new Intl.RelativeTimeFormat(currentUiLanguage,{numeric:'auto'});
          if(abs<60)return rtf.format(seconds,'second');
          if(abs<3600)return rtf.format(Math.round(seconds/60),'minute');
          if(abs<86400)return rtf.format(Math.round(seconds/3600),'hour');
          if(abs<604800)return rtf.format(Math.round(seconds/86400),'day');
          return date.toLocaleDateString(currentUiLanguage,{year:'numeric',month:'short',day:'numeric'});
        };
      
        const resolveMentionLabel = (kind, rawId) => {
          const id=String(rawId||'');
          if(kind==='channel'){
            for(const group of (currentState?.channel_groups||[])){
              const channel=(group.channels||[]).find(item=>String(item.channel_id||'')===id);
              if(channel)return `#${channel.name||'channel'}`;
            }
            return '#channel';
          }
          if(kind==='role'){
            const group=(cachedMemberGroups||[]).find(item=>String(item.key||'')===id);
            return `@${group?.name||'role'}`;
          }
          for(const group of (cachedMemberGroups||[])){
            const member=(group.members||[]).find(item=>String(item.user_id||'')===id);
            if(member)return `@${member.display_name||member.username||'user'}`;
          }
          return '@user';
        };

        const appendRichText = (target, text) => {
          const value = String(text || '');
          const token = /<(a?):([A-Za-z0-9_]+):(\d+)>|<@!?(\d+)>|<@&(\d+)>|<#(\d+)>|https?:\/\/[^\s<>]+|@everyone|@here/g;
          let cursor = 0;
          for (const match of value.matchAll(token)) {
            if (match.index > cursor) target.append(document.createTextNode(value.slice(cursor, match.index)));
            const part=match[0];
            if(match[3]){
              const img = document.createElement('img');
              img.className = 'discord-inline-emoji';
              img.src = `https://cdn.discordapp.com/emojis/${match[3]}.${match[1] ? 'gif' : 'png'}?size=48&quality=lossless`;
              img.alt = `:${match[2]}:`; img.title = `:${match[2]}:`; img.loading='lazy'; img.decoding='async';
              img.addEventListener('error',()=>img.remove(),{once:true});
              target.append(img);
            } else if(match[4]||match[5]||match[6]||part==='@everyone'||part==='@here'){
              const mention=document.createElement('span');mention.className='discord-mention';
              if(part==='@everyone'||part==='@here')mention.textContent=part;
              else if(match[4])mention.textContent=resolveMentionLabel('member',match[4]);
              else if(match[5])mention.textContent=resolveMentionLabel('role',match[5]);
              else mention.textContent=resolveMentionLabel('channel',match[6]);
              target.append(mention);
            } else {
              const link=document.createElement('a');link.href=part;link.target='_blank';link.rel='noopener noreferrer';link.textContent=part;target.append(link);
            }
            cursor = match.index + part.length;
          }
          if (cursor < value.length) target.append(document.createTextNode(value.slice(cursor)));
        };

        const appendDiscordInlineMarkdown = (target, text) => {
          const value = String(text || '');
          const token = /(\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|`[^`\n]+?`|\*[^*\n]+?\*)/g;
          let cursor = 0;
          for (const match of value.matchAll(token)) {
            if (match.index > cursor) appendRichText(target, value.slice(cursor, match.index));
            const part = match[0];
            let node;
            let inner=part;
            if(part.startsWith('**')){node=document.createElement('strong');inner=part.slice(2,-2);}
            else if(part.startsWith('__')){node=document.createElement('u');inner=part.slice(2,-2);}
            else if(part.startsWith('~~')){node=document.createElement('s');inner=part.slice(2,-2);}
            else if(part.startsWith('`')){node=document.createElement('code');inner=part.slice(1,-1);}
            else {node=document.createElement('em');inner=part.slice(1,-1);}
            appendRichText(node,inner); target.append(node);
            cursor = match.index + part.length;
          }
          if (cursor < value.length) appendRichText(target, value.slice(cursor));
        };

        const appendDiscordMarkdown = (target, text) => {
          const lines=String(text||'').split('\n');
          lines.forEach((line,index)=>{
            if(line.startsWith('> ')){
              const quote=document.createElement('span');quote.className='discord-markdown-quote';
              appendDiscordInlineMarkdown(quote,line.slice(2));target.append(quote);
            }else appendDiscordInlineMarkdown(target,line);
            if(index<lines.length-1)target.append(document.createElement('br'));
          });
        };
      
        const embedMediaUrl = raw => {
          if (!raw || typeof raw !== 'object') return '';
          return String(raw.url || raw.proxy_url || '');
        };
      
        const renderMessageEmbeds = (body, embeds) => {
          if (!Array.isArray(embeds) || !embeds.length) return;
          for (const embed of embeds) {
            if (!embed || typeof embed !== 'object') continue;
            const card = document.createElement('div');
            const providerName=String(embed.provider?.name||'');
            const embedType=String(embed.type||'').toLowerCase();
            const isVideoPreview=embedType==='video'||/youtube/i.test(providerName);
            card.className = `discord-message-embed${isVideoPreview?' is-video-preview':''}`;
            const colour = Number(embed.color || embed.colour || 0);
            if (Number.isFinite(colour) && colour > 0) card.style.setProperty('--embed-colour', `#${colour.toString(16).padStart(6,'0').slice(-6)}`);
      
            if(providerName){const provider=document.createElement('div');provider.className='discord-embed-provider';provider.textContent=providerName;card.append(provider);}

            const authorData = embed.author && typeof embed.author === 'object' ? embed.author : null;
            if (authorData?.name) {
              const author = document.createElement('div'); author.className='discord-embed-author';
              const icon = embedMediaUrl({url:authorData.icon_url, proxy_url:authorData.proxy_icon_url});
              if(icon){const img=document.createElement('img');img.src=icon;img.alt='';author.append(img);}
              const label=document.createElement(authorData.url?'a':'span');label.textContent=authorData.name;
              if(authorData.url){label.href=authorData.url;label.target='_blank';label.rel='noopener';}
              author.append(label);card.append(author);
            }
      
            if (embed.title) {
              const title = document.createElement(embed.url ? 'a' : 'div');
              title.className='discord-embed-title'; appendDiscordMarkdown(title, embed.title);
              if(embed.url){title.href=embed.url;title.target='_blank';title.rel='noopener';}
              card.append(title);
            }
            if (embed.description) {
              const desc=document.createElement('div');desc.className='discord-embed-description';appendDiscordMarkdown(desc,embed.description);card.append(desc);
            }
      
            if (Array.isArray(embed.fields) && embed.fields.length) {
              const fields=document.createElement('div');fields.className='discord-embed-fields';
              for(const field of embed.fields){
                if(!field)continue;
                const item=document.createElement('div');item.className=`discord-embed-field${field.inline?' inline':''}`;
                const name=document.createElement('strong');appendDiscordMarkdown(name,field.name||'');
                const value=document.createElement('div');appendDiscordMarkdown(value,field.value||'');
                item.append(name,value);fields.append(item);
              }
              card.append(fields);
            }
      
            const thumbnail=embedMediaUrl(embed.thumbnail);
            const image=embedMediaUrl(embed.image);
            const appendEmbedImage=(url,className)=>{
              if(!url)return;
              const img=document.createElement('img');img.className=className;img.src=url;img.loading='lazy';img.decoding='async';img.alt='';
              img.addEventListener('error',()=>img.remove(),{once:true});
              if(embed.url&&className.includes('discord-embed-image')){const link=document.createElement('a');link.className='discord-embed-media-link';link.href=embed.url;link.target='_blank';link.rel='noopener noreferrer';link.append(img);card.append(link);}
              else card.append(img);
            };
            if(isVideoPreview&&!image)appendEmbedImage(thumbnail,'discord-embed-image discord-embed-video-preview');
            else {appendEmbedImage(thumbnail,'discord-embed-thumbnail');appendEmbedImage(image,'discord-embed-image');}
      
            const footerData=embed.footer && typeof embed.footer === 'object' ? embed.footer : null;
            if(footerData?.text){
              const footer=document.createElement('div');footer.className='discord-embed-footer';
              const icon=embedMediaUrl({url:footerData.icon_url,proxy_url:footerData.proxy_icon_url});
              if(icon){const img=document.createElement('img');img.src=icon;img.alt='';footer.append(img);}
              const label=document.createElement('span');label.textContent=footerData.text;footer.append(label);card.append(footer);
            }
            body.append(card);
          }
        };
      
        const componentEmojiNode = emoji => {
          if(!emoji || typeof emoji!=='object') return null;
          const id=String(emoji.id||'');
          const name=String(emoji.name||'');
          if(id){
            const img=document.createElement('img');img.className='discord-component-emoji';img.alt=name?`:${name}:`:'';
            img.src=`https://cdn.discordapp.com/emojis/${id}.${emoji.animated?'gif':'png'}?size=40&quality=lossless`;return img;
          }
          if(name){const span=document.createElement('span');span.textContent=name;return span;}
          return null;
        };
      
        const renderMessageComponents = (body, rows) => {
          if(!Array.isArray(rows)||!rows.length)return;
          const wrap=document.createElement('div');wrap.className='discord-message-components';
          for(const row of rows){
            const rowNode=document.createElement('div');rowNode.className='discord-component-row';
            for(const component of (row?.components||[])){
              const style=Number(component.style||0);
              const isLink=style===5 && component.url;
              const node=document.createElement(isLink?'a':'button');
              node.className=`discord-component-button style-${style||2}`;
              if(isLink){node.href=component.url;node.target='_blank';node.rel='noopener';}
              else {node.type='button';node.dataset.discordCustomId=String(component.custom_id||'');node.title=t("app.this_discord_interaction_is_available_only_in_the_discord_client");}
              if(component.disabled)node.setAttribute('aria-disabled','true');
              const emoji=componentEmojiNode(component.emoji);if(emoji)node.append(emoji);
              const label=document.createElement('span');label.textContent=component.label||component.placeholder||t("common.button");node.append(label);
              rowNode.append(node);
            }
            if(rowNode.childElementCount)wrap.append(rowNode);
          }
          if(wrap.childElementCount)body.append(wrap);
        };
      
        const attachmentType = url => {
          const clean = String(url || '').split('?')[0].toLowerCase();
          if (/\.(png|jpe?g|gif|webp|avif)$/.test(clean)) return 'image';
          if (/\.(mp4|webm|mov|m4v)$/.test(clean)) return 'video';
          return 'file';
        };
      
        const renderMessages = (messages, target = feed, options = {}) => {
          if (!target) return;
          const includeForumBack = options.includeForumBack !== false;
          const shouldStick = lastRenderedChannel !== selectedChannel || (target.scrollHeight - target.scrollTop - target.clientHeight < 120);
          target.replaceChildren();
          messageIndex.clear();
          const selectedForum=currentState?.selected_forum;
          if(includeForumBack && selectedForum?.channel_id){
            const back=document.createElement('button');
            back.type='button';
            back.className='discord-forum-back';
            back.dataset.forumBack=String(selectedForum.channel_id);
            back.dataset.channelName=selectedForum.name||'';
            back.textContent=`▤ ${selectedForum.name||''}`;
            target.append(back);
          }
          if (!messages?.length) {
            const empty = document.createElement('div');
            empty.className = 'discord-chat-empty';
            const strong = document.createElement('strong');
            strong.textContent = `${currentState?.selected_channel?.channel_type==='thread'?'↳':'#'}${currentState?.selected_channel?.name || 'kanal'}`;
            const p = document.createElement('p');
            p.textContent = t("module.no_messages_recorded_for_this_channel_refresh_retrieves_the_latest_100");
            empty.append(strong, p);
            target.append(empty);
            lastRenderedChannel = selectedChannel;
            return;
          }
          let lastDayKey='';
          for (const message of messages) {
            if(message.deleted_at) continue;
            const day=messageDay(message.created_at);
            if(day.key&&day.key!==lastDayKey){
              const divider=document.createElement('div');divider.className='discord-date-divider';
              const label=document.createElement('span');label.textContent=day.label;divider.append(label);target.append(divider);lastDayKey=day.key;
            }
            const messageId=String(message.message_id||'');
            if(messageId)messageIndex.set(messageId,message);
            const row = document.createElement('article');
            row.className = `discord-message${message.pinned ? ' pinned' : ''}`;
            row.dataset.messageId=messageId;
            row.dataset.channelId=String(message.channel_id||selectedChannel||'');
            const avatar = document.createElement('div');
            avatar.className = 'discord-message-avatar';
            if (message.author_avatar_url) {
              const img = document.createElement('img'); img.src = message.author_avatar_url; img.alt = ''; avatar.append(img);
            } else {
              const fallback = document.createElement('span'); fallback.textContent = String(message.author_name || '?')[0].toUpperCase(); avatar.append(fallback);
            }
            const body = document.createElement('div'); body.className = 'discord-message-body';
            const reference=message.reference&&message.reference.message_id?message.reference:null;
            if(reference){
              const reply=document.createElement('button');reply.type='button';reply.className='discord-message-reply-ref';reply.dataset.replyReference=String(reference.message_id);
              const replyAuthor=document.createElement('strong');replyAuthor.textContent=reference.author_name||t("server.original_message");
              const replyText=document.createElement('span');
              const referenceText=reference.content||'';
              replyText.textContent=reference.missing&&!referenceText?t("app.original_message_not_loaded"):(referenceText.length>95?`${referenceText.slice(0,95)}…`:referenceText||t("app.go_to_message"));
              reply.append(replyAuthor,replyText);body.append(reply);
            }
            const meta = document.createElement('div'); meta.className = 'discord-message-meta';
            const author = document.createElement('strong'); author.textContent = message.author_name || t("module.unknown"); meta.append(author);
            if (message.is_bot) { const bot = document.createElement('em'); bot.textContent = 'APP'; meta.append(bot); }
            const time = document.createElement('time'); time.textContent = localTime(message.created_at); meta.append(time);
            if (message.edited_at) { const edited = document.createElement('small'); edited.textContent = t("module.edited"); meta.append(edited); }
            if (message.pinned) { const pinned = document.createElement('small'); pinned.className='discord-message-pinned'; pinned.textContent='📌'; pinned.title=t("app.pinned_message"); meta.append(pinned); }
            body.append(meta);
            const content = document.createElement('p');
            appendDiscordMarkdown(content, message.content || '');
            if (content.textContent || content.querySelector('img,a,.discord-mention')) body.append(content);
            renderMessageEmbeds(body, message.embeds || []);
            renderMessageComponents(body, message.components || []);
            if (Array.isArray(message.attachments) && message.attachments.length) {
              const media = document.createElement('div'); media.className = 'discord-message-media';
              const files = document.createElement('div'); files.className = 'discord-message-files';
              for (const url of message.attachments) {
                const type = attachmentType(url);
                if (type === 'image') {
                  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener';
                  const img = document.createElement('img'); img.src = url; img.loading = 'lazy'; img.decoding='async'; img.alt = '';
                  img.addEventListener('error',()=>a.remove(),{once:true});a.append(img); media.append(a);
                } else if (type === 'video') {
                  const video = document.createElement('video'); video.src = url; video.controls = true; video.preload = 'metadata'; media.append(video);
                } else {
                  const a = document.createElement('a'); a.href = url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = t("module.open_attachment"); files.append(a);
                }
              }
              if (media.childElementCount) body.append(media);
              if (files.childElementCount) body.append(files);
            }
            row.append(avatar, body); target.append(row);
          }
          if (shouldStick) requestAnimationFrame(() => { target.scrollTop = target.scrollHeight; });
          lastRenderedChannel = selectedChannel;
        };

        const appendForumTagLabel=(target,tag)=>{
          const emojiId=String(tag?.emoji_id||'');
          const emojiName=String(tag?.emoji_name||'');
          if(emojiId){const img=document.createElement('img');img.className='discord-forum-tag-emoji';img.src=`https://cdn.discordapp.com/emojis/${emojiId}.${tag?.emoji_animated?'gif':'png'}?size=32&quality=lossless`;img.alt=emojiName?`:${emojiName}:`:'';target.append(img);}
          else if(emojiName){const emoji=document.createElement('span');emoji.className='discord-forum-tag-emoji-text';emoji.textContent=emojiName;target.append(emoji);}
          const label=document.createElement('span');label.textContent=String(tag?.name||'');target.append(label);
        };
        const applyForumFilters=()=>{
          if(!feed)return;
          const search=feed.querySelector('[data-forum-search]');
          const query=String(search?.value||'').trim().toLocaleLowerCase(currentUiLanguage);
          feed.querySelectorAll('.discord-forum-post-card').forEach(card=>{
            const tagIds=String(card.dataset.tagIds||'').split(',').filter(Boolean);
            const matchesText=!query||String(card.dataset.searchText||'').includes(query);
            const matchesTag=!activeForumTagId||tagIds.includes(activeForumTagId);
            card.hidden=!(matchesText&&matchesTag);
          });
          feed.querySelectorAll('[data-forum-tag]').forEach(button=>button.classList.toggle('active',String(button.dataset.forumTag||'')===activeForumTagId));
        };

        const renderForumPosts = (posts, activeThreadId = '') => {
          if (!feed) return;
          feed.replaceChildren();
          const shell=document.createElement('div');
          shell.className='discord-forum-surface';
          const toolbar=document.createElement('div');
          toolbar.className='discord-forum-toolbar';
          const searchWrap=document.createElement('label');
          searchWrap.className='discord-forum-search';
          const searchIcon=document.createElement('span');searchIcon.textContent='⌕';
          const search=document.createElement('input');search.type='search';search.autocomplete='off';search.dataset.forumSearch='1';search.placeholder=t('module.search');
          searchWrap.append(searchIcon,search);
          toolbar.append(searchWrap);
          shell.append(toolbar);
          const filterbar=document.createElement('div');filterbar.className='discord-forum-filterbar';
          const sort=document.createElement('button');sort.type='button';sort.className='discord-forum-sort';sort.dataset.forumSort='newest';sort.textContent='↕';filterbar.append(sort);
          const forumTags=Array.isArray(currentState?.forum_tags)?currentState.forum_tags:[];
          if(activeForumTagId&&!forumTags.some(tag=>String(tag.id||'')===activeForumTagId))activeForumTagId='';
          for(const tag of forumTags){const tagId=String(tag.id||'');if(!tagId)continue;const chip=document.createElement('button');chip.type='button';chip.className=`discord-forum-tag${tagId===activeForumTagId?' active':''}`;chip.dataset.forumTag=tagId;appendForumTagLabel(chip,tag);filterbar.append(chip);}
          if(filterbar.childElementCount)shell.append(filterbar);
          const list=document.createElement('div');
          list.className='discord-forum-post-list';
          if(!Array.isArray(posts)||!posts.length){
            const empty=document.createElement('div');
            empty.className='discord-chat-empty discord-forum-empty';
            const strong=document.createElement('strong');
            strong.textContent=`▤ ${currentState?.selected_forum?.name||currentState?.selected_channel?.name||''}`;
            const p=document.createElement('p');
            p.textContent='—';
            empty.append(strong,p);
            list.append(empty);
          }else{
            for(const post of posts){
              const card=document.createElement('button');
              card.type='button';
              card.className=`discord-forum-post-card${String(post.channel_id||'')===String(activeThreadId||'')?' active':''}`;
              card.dataset.forumPost=String(post.channel_id||'');
              card.dataset.channelName=String(post.name||'');
              card.dataset.searchText=`${post.name||''} ${post.starter_author_name||''} ${post.starter_content||''}`.toLocaleLowerCase(currentUiLanguage);
              card.dataset.sortTime=String(Date.parse(String(post.last_message_at||post.created_at||''))||0);
              card.dataset.pinned=post.pinned?'1':'0';
              card.dataset.tagIds=(Array.isArray(post.tag_ids)?post.tag_ids:[]).map(String).join(',');
              const content=document.createElement('div');content.className='discord-forum-post-content';
              const badges=document.createElement('div');badges.className='discord-forum-post-badges';
              if(post.pinned){const pin=document.createElement('span');pin.className='discord-forum-pin';pin.textContent='◆';badges.append(pin);}
              for(const tag of (Array.isArray(post.tags)?post.tags:[])){const badge=document.createElement('span');badge.className='discord-forum-card-tag';appendForumTagLabel(badge,tag);badges.append(badge);}
              if(badges.childElementCount)content.append(badges);
              const title=document.createElement('strong');title.className='discord-forum-post-title';title.textContent=post.name||'';content.append(title);
              const preview=document.createElement('p');
              const raw=String(post.starter_content||'').replace(/\s+/g,' ').trim();
              if(post.starter_author_name){const author=document.createElement('b');author.textContent=`${post.starter_author_name}: `;preview.append(author);}
              preview.append(document.createTextNode(raw.length>240?`${raw.slice(0,240)}…`:raw));
              if(raw||post.starter_author_name)content.append(preview);
              const meta=document.createElement('div');meta.className='discord-forum-post-meta';
              const count=document.createElement('span');count.className='discord-forum-comment-count';count.textContent=`● ${Math.max(0,Number(post.message_count||0)-1)}`;meta.append(count);
              const stamp=post.last_message_at||post.created_at;
              if(stamp){const time=document.createElement('time');time.textContent=relativeTime(stamp);meta.append(time);}
              content.append(meta);card.append(content);
              if(post.thumbnail_url){const thumb=document.createElement('img');thumb.className='discord-forum-post-thumb';thumb.src=post.thumbnail_url;thumb.loading='lazy';thumb.alt='';card.append(thumb);}
              list.append(card);
            }
          }
          shell.append(list);feed.append(shell);
          applyForumFilters();
          feed.scrollTop=0;
          lastRenderedChannel=selectedChannel;
        };

        const renderChannels = groups => {
          if (!channelList) return;
          channelList.replaceChildren();
          if (!groups?.length) { const empty = document.createElement('div'); empty.className='discord-empty-side'; empty.textContent=t("module.discord_channels_have_not_been_synchronized_yet"); channelList.append(empty); return; }
          for (const group of groups) {
            const section = document.createElement('section'); section.className = 'discord-channel-group';
            const title = document.createElement('h3'); title.textContent = `⌄ ${group.name}`; section.append(title);
            for (const channel of group.channels || []) {
              if (channel.channel_type === 'text') {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = `discord-channel-row${String(channel.channel_id) === selectedChannel ? ' active' : ''}`;
                button.dataset.chatChannel = channel.channel_id;
                button.dataset.channelName = channel.name;
                button.dataset.channelType = channel.channel_type;
                const icon = document.createElement('span'); icon.textContent = '#';
                const name = document.createElement('b'); name.textContent = channel.name;
                button.append(icon, name);
                section.append(button);
              } else if (channel.channel_type === 'forum') {
                const button = document.createElement('button');
                button.type = 'button';
                const forumActive=String(channel.channel_id)===selectedChannel||String(currentState?.selected_forum?.channel_id||'')===String(channel.channel_id);
                button.className = `discord-channel-row forum${forumActive?' active':''}`;
                button.dataset.chatForum = channel.channel_id;
                button.dataset.channelName = channel.name;
                button.dataset.channelType = 'forum';
                const icon = document.createElement('span'); icon.textContent='▤';
                const name = document.createElement('b'); name.textContent = channel.name;
                button.append(icon, name); section.append(button);
              } else {
                const row = document.createElement('div');
                row.className = 'discord-channel-row voice';
                row.dataset.channelName = channel.name;
                const icon = document.createElement('span'); icon.textContent='◖';
                const name = document.createElement('b'); name.textContent = channel.name;
                row.append(icon, name); section.append(row);
              }
            }
            channelList.append(section);
          }
        };
      
        const renderMembers = groups => {
          if (!memberList) return;
          memberList.replaceChildren();
          if (!groups?.length) { const empty=document.createElement('div'); empty.className='discord-empty-side'; empty.textContent=t("module.no_online_members_visible"); memberList.append(empty); return; }
          for (const group of groups) {
            const section = document.createElement('section'); section.className='discord-member-group';
            const title=document.createElement('h3'); title.textContent=`${group.name} — ${(group.members||[]).length}`; if(group.colour)title.style.color=group.colour; section.append(title);
            for (const member of group.members || []) {
              const row=document.createElement('button'); row.type='button'; row.className='discord-member-row'; row.dataset.memberProfile=String(member.user_id||'');
              const avatar=document.createElement('div'); avatar.className='discord-member-avatar';
              if(member.avatar_url){const img=document.createElement('img');img.src=member.avatar_url;img.alt='';avatar.append(img);} else {const span=document.createElement('span');span.textContent=String(member.display_name||'?')[0].toUpperCase();avatar.append(span);}
              const status=document.createElement('i');status.className=member.presence||'online';avatar.append(status);
              const copy=document.createElement('div');const name=document.createElement('b');name.textContent=member.display_name||member.username||String(member.user_id);if(group.colour)name.style.color=group.colour;copy.append(name);
              if(member.is_bot){const badge=document.createElement('em');badge.textContent=t("common.bot");copy.append(badge);}
              const sub=document.createElement('small');sub.textContent=member.role_name||member.username||'';copy.append(sub);row.append(avatar,copy);section.append(row);
            }
            memberList.append(section);
          }
        };
      
        const profileText = (label, value) => {
          const row=document.createElement('div');row.className='discord-profile-info-row';
          const key=document.createElement('small');key.textContent=label;
          const val=document.createElement('strong');val.textContent=value||'—';
          row.append(key,val);return row;
        };
      
        const presenceLabel = value => ({online:t("module.online"),idle:t("module.idle"),dnd:t("module.do_not_disturb"),offline:t("member.offline"),invisible:t("module.invisible")})[value] || value || t("member.offline");
        const deviceLabel = value => ({desktop:t("app.desktop"),mobile:t("common.mobile"),web:t("common.web")})[value] || value;
        const activityLabel = value => ({custom:t("app.custom_status"),playing:t("module.playing"),streaming:t("module.streaming"),listening:t("module.listening"),watching:t("module.watching"),competing:t("module.competing")})[value] || value || t("module.activity");
      
        const renderMemberProfile = profile => {
          if(!memberProfileCard)return;
          memberProfileCard.replaceChildren();
          const close=document.createElement('button');close.type='button';close.className='discord-profile-close';close.textContent=t("app.symbol");close.setAttribute('aria-label',t("common.close"));close.addEventListener('click',()=>memberProfileDialog?.close());
          const banner=document.createElement('div');banner.className='discord-profile-banner';banner.style.background=profile.banner_url?`center/cover no-repeat url("${String(profile.banner_url).replaceAll('"','%22')}")`:profile.accent_colour||'#24262b';
          const avatarWrap=document.createElement('div');avatarWrap.className='discord-profile-avatar-wrap';
          const avatar=document.createElement('div');avatar.className='discord-profile-avatar';
          if(profile.avatar_url||profile.global_avatar_url){const img=document.createElement('img');img.src=profile.avatar_url||profile.global_avatar_url;img.alt='';avatar.append(img);}else{const span=document.createElement('span');span.textContent=String(profile.display_name||'?')[0].toUpperCase();avatar.append(span);}
          const dot=document.createElement('i');dot.className=profile.presence||'offline';avatar.append(dot);avatarWrap.append(avatar);
          const body=document.createElement('div');body.className='discord-profile-body';
          const title=document.createElement('div');title.className='discord-profile-title';const h=document.createElement('h3');h.textContent=profile.display_name||profile.username||profile.user_id;title.append(h);if(profile.is_bot){const badge=document.createElement('em');badge.textContent=t("common.bot");title.append(badge);}body.append(title);
          const user=document.createElement('p');user.className='discord-profile-username';user.textContent=`@${profile.username||profile.user_id}`;body.append(user);
          const statusLine=document.createElement('div');statusLine.className='discord-profile-status';const pdot=document.createElement('i');pdot.className=profile.presence||'offline';const ptext=document.createElement('span');ptext.textContent=presenceLabel(profile.presence);statusLine.append(pdot,ptext);body.append(statusLine);
          const clients=Object.entries(profile.client_status||{}).filter(([,v])=>v&&v!=='offline');
          if(clients.length){const devices=document.createElement('div');devices.className='discord-profile-devices';for(const [device,status] of clients){const chip=document.createElement('span');chip.textContent=`${deviceLabel(device)} · ${presenceLabel(status)}`;devices.append(chip);}body.append(devices);}
          const activities=document.createElement('div');activities.className='discord-profile-activities';
          for(const activity of profile.activities||[]){const item=document.createElement('div');item.className='discord-profile-activity';if(activity.emoji){const emoji=document.createElement('div');emoji.className='discord-profile-activity-emoji';if(activity.emoji.url){const img=document.createElement('img');img.src=activity.emoji.url;img.alt=activity.emoji.name||'';emoji.append(img);}else{emoji.textContent=activity.emoji.name||'';}if(activity.emoji.external){emoji.title=t("app.custom_emoji_from_another_server");emoji.classList.add('external');}item.append(emoji);}const copy=document.createElement('div');const kind=document.createElement('small');kind.textContent=activityLabel(activity.type);const main=document.createElement('strong');main.textContent=activity.details||activity.name||activity.state||t("module.activity");copy.append(kind,main);const extra=[activity.state,activity.album].filter(v=>v&&v!==main.textContent).join(' · ');if(extra){const sub=document.createElement('span');sub.textContent=extra;copy.append(sub);}item.append(copy);activities.append(item);}
          if(activities.childElementCount)body.append(activities);
          const sectionTitle=document.createElement('h4');sectionTitle.textContent=t("app.server_roles");body.append(sectionTitle);
          const roles=document.createElement('div');roles.className='discord-profile-roles';for(const role of profile.roles||[]){const chip=document.createElement('span');const color=document.createElement('i');color.style.background=role.colour||'#777';const label=document.createTextNode(role.name);chip.append(color,label);roles.append(chip);}if(!roles.childElementCount){const none=document.createElement('small');none.textContent=t("app.no_roles_found");roles.append(none);}body.append(roles);
          const info=document.createElement('div');info.className='discord-profile-info';info.append(profileText(t("app.joined_server"),profile.joined_at?localTime(profile.joined_at):t("module.unknown")),profileText(t("app.discord_account"),profile.account_created_at?localTime(profile.account_created_at):t("module.unknown")),profileText(t("module.discord_id"),profile.user_id));body.append(info);
          const actions=document.createElement('div');actions.className='discord-profile-actions';const detailed=document.createElement('a');detailed.href=profile.member_profile_url;detailed.textContent=t("app.open_arx_member_profile");actions.append(detailed);body.append(actions);
          memberProfileCard.append(close,banner,avatarWrap,body);
        };
      
        const waitProfileRefresh = async actionId => {
          if(!actionId)return;
          for(let attempt=0;attempt<25;attempt++){
            await new Promise(resolve=>setTimeout(resolve,220));
            const response=await fetch(`/api/guilds/${guildId}/actions/${encodeURIComponent(actionId)}`,{cache:'no-store'});
            if(!response.ok)continue;const result=await response.json();if(result.status==='completed'||result.status==='failed')return;
          }
        };
      
        const openMemberProfile = async userId => {
          if(!memberProfileDialog||!memberProfileCard||!userId)return;
          memberProfileCard.innerHTML=`<button type="button" class="discord-profile-close" aria-label="${ARXI18n.html("common.close")}">×</button><div class="discord-profile-loading">${ARXI18n.html("module.loading_discord_profile")}</div>`;
          memberProfileCard.querySelector('.discord-profile-close')?.addEventListener('click',()=>memberProfileDialog.close());
          if(!memberProfileDialog.open)memberProfileDialog.showModal();
          const getProfile=async()=>{const response=await fetch(`/api/guilds/${guildId}/bot-chat/member/${encodeURIComponent(userId)}`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||t("app.could_not_retrieve_profile"));renderMemberProfile(data);};
          try{await getProfile();}catch(error){memberProfileCard.replaceChildren();const box=document.createElement('div');box.className='discord-profile-loading error';box.textContent=String(error.message||t("app.could_not_retrieve_profile"));memberProfileCard.append(box);return;}
          try{const refresh=await fetch(`/api/guilds/${guildId}/member/${encodeURIComponent(userId)}/refresh`,{method:'POST',headers:{Accept:'application/json'}});if(refresh.ok){const data=await refresh.json();await waitProfileRefresh(data.action_id);await getProfile();}}catch(_){}
        };
      
      
        const waitForQueuedAction = async (actionId, failureText=t("app.action_failed")) => {
          for (let attempt=0; attempt<60; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 250));
            const response = await fetch(`/api/guilds/${guildId}/actions/${encodeURIComponent(actionId)}`, {cache:'no-store'});
            if (!response.ok) continue;
            const action = await response.json();
            if (action.status === 'completed') return action.result || {};
            if (action.status === 'failed') throw new Error(action.error || failureText);
          }
          throw new Error(t("app.action_timed_out"));
        };
      
        const copyToClipboard = async text => {
          const value=String(text||'');
          if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(value);return;}
          const helper=document.createElement('textarea');helper.value=value;helper.style.position='fixed';helper.style.opacity='0';document.body.append(helper);helper.select();document.execCommand('copy');helper.remove();
        };
      
        const jumpUrlFor = message => `https://discord.com/channels/${guildId}/${message.channel_id||selectedChannel}/${message.message_id}`;
      
        const replyBar=document.createElement('div');replyBar.className='discord-reply-bar';replyBar.hidden=true;
        const replyCopy=document.createElement('div');const replyLabel=document.createElement('small');replyLabel.textContent=t("app.replying");const replySummary=document.createElement('span');replyCopy.append(replyLabel,replySummary);
        const replyClose=document.createElement('button');replyClose.type='button';replyClose.textContent=t("app.symbol");replyClose.title=t("app.cancel_reply");replyBar.append(replyCopy,replyClose);composer?.prepend(replyBar);
        const clearReplyTarget=()=>{replyTarget=null;replyBar.hidden=true;replySummary.textContent='';};
        const setReplyTarget=message=>{replyTarget=message;const text=String(message.content||'').replace(/\s+/g,' ').trim();replySummary.textContent=`${message.author_name||t("module.unknown")} · ${text?(text.length>100?`${text.slice(0,100)}…`:text):t("app.attachment_media_message")}`;replyBar.hidden=false;textInput?.focus();};
        replyClose.addEventListener('click',clearReplyTarget);
      
        const contextMenu=document.createElement('div');contextMenu.className='discord-message-context';contextMenu.hidden=true;
        const contextItems=[
          ['reply','↩',t("app.reply")],['forward','↗',t("app.forward")],['copy','▣',t("app.copy_text")],['pin','⌖',t("app.pin_message")],['link','🔗',t("app.copy_message_link")],['delete','🗑',t("app.delete_message")]
        ];
        for(const [action,icon,label] of contextItems){const button=document.createElement('button');button.type='button';button.dataset.messageAction=action;if(action==='delete')button.className='danger';const i=document.createElement('i');i.textContent=icon;const span=document.createElement('span');span.textContent=label;button.append(i,span);contextMenu.append(button);if(action==='copy'||action==='pin')button.classList.add('context-divider-after');}
        document.body.append(contextMenu);
        const closeContextMenu=()=>{contextMenu.hidden=true;contextMessage=null;};
        const openContextMenu=(message,x,y)=>{
          contextMessage=message;const copyButton=contextMenu.querySelector('[data-message-action="copy"]');if(copyButton)copyButton.disabled=!String(message.content||'').length;
          const pinLabel=contextMenu.querySelector('[data-message-action="pin"] span');if(pinLabel)pinLabel.textContent=message.pinned?t("app.unpin"):t("app.pin_message");
          contextMenu.hidden=false;contextMenu.style.left='0px';contextMenu.style.top='0px';
          const rect=contextMenu.getBoundingClientRect();const left=Math.max(8,Math.min(x,window.innerWidth-rect.width-8));const top=Math.max(8,Math.min(y,window.innerHeight-rect.height-8));contextMenu.style.left=`${left}px`;contextMenu.style.top=`${top}px`;
        };
      
        const forwardDialog=document.createElement('dialog');forwardDialog.className='discord-forward-dialog';forwardDialog.innerHTML=`<div class="discord-forward-shell"><header><div><h3>${ARXI18n.html("app.forward_to")}</h3><p>${ARXI18n.html("app.select_one_or_more_members_of_this_server")}</p></div><button type="button" data-forward-close aria-label="${ARXI18n.html("common.close")}">×</button></header><div class="discord-forward-search"><span>⌕</span><input type="search" placeholder="${ARXI18n.html("module.search")}" autocomplete="off"></div><div class="discord-forward-members"></div><footer><div class="discord-forward-preview"><small>${ARXI18n.html("app.message_to_forward")}</small><span></span></div><div class="discord-forward-compose"><input maxlength="2000" placeholder="${ARXI18n.html("app.add_an_optional_message")}"><button type="button" data-forward-send disabled>${ARXI18n.html("common.send")} <b>➤</b></button></div><em class="discord-forward-status"></em></footer></div>`;document.body.append(forwardDialog);
        const forwardSearch=forwardDialog.querySelector('input[type="search"]');const forwardList=forwardDialog.querySelector('.discord-forward-members');const forwardPreview=forwardDialog.querySelector('.discord-forward-preview span');const forwardNote=forwardDialog.querySelector('.discord-forward-compose input');const forwardSend=forwardDialog.querySelector('[data-forward-send]');const forwardStatus=forwardDialog.querySelector('.discord-forward-status');
        const updateForwardSend=()=>{if(forwardSend){forwardSend.disabled=!forwardSelection.size;forwardSend.firstChild.textContent=forwardSelection.size?t("app.send_value0", {value0: (forwardSelection.size)}):t("app.send");}};
        const renderForwardMembers=()=>{
          if(!forwardList)return;forwardList.replaceChildren();const needle=String(forwardSearch?.value||'').trim().toLocaleLowerCase(currentUiLanguage);const rows=(forwardMembersCache||[]).filter(member=>!needle||`${member.display_name||''} ${member.username||''}`.toLocaleLowerCase(currentUiLanguage).includes(needle));
          if(!rows.length){const empty=document.createElement('div');empty.className='discord-forward-empty';empty.textContent=forwardMembersCache?.length?t("app.no_members_match_your_search"):t("app.no_available_recipients_in_this_server");forwardList.append(empty);return;}
          for(const member of rows){const row=document.createElement('button');row.type='button';row.className=`discord-forward-member${forwardSelection.has(String(member.user_id))?' selected':''}`;row.dataset.forwardMember=String(member.user_id);const avatar=document.createElement('div');avatar.className='discord-forward-avatar';if(member.avatar_url){const img=document.createElement('img');img.src=member.avatar_url;img.alt='';avatar.append(img);}else{const fallback=document.createElement('span');fallback.textContent=String(member.display_name||member.username||'?')[0].toUpperCase();avatar.append(fallback);}const presence=document.createElement('i');presence.className=member.presence||'offline';avatar.append(presence);const copy=document.createElement('div');const name=document.createElement('strong');name.textContent=member.display_name||member.username||String(member.user_id);const user=document.createElement('small');user.textContent=member.username?`@${member.username}`:'';copy.append(name,user);const check=document.createElement('span');check.className='discord-forward-check';check.textContent=forwardSelection.has(String(member.user_id))?'✓':'';row.append(avatar,copy,check);forwardList.append(row);}
        };
        const getForwardMembers=async()=>{if(forwardMembersCache&&Date.now()-forwardMembersLoadedAt<30000)return forwardMembersCache;const response=await fetch(`/api/guilds/${guildId}/bot-chat/forward-members`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||t("app.could_not_retrieve_server_members"));forwardMembersCache=Array.isArray(data.members)?data.members:[];forwardMembersLoadedAt=Date.now();return forwardMembersCache;};
        const openForwardDialog=async message=>{forwardMessage=message;forwardSelection.clear();if(forwardSearch)forwardSearch.value='';if(forwardNote)forwardNote.value='';if(forwardStatus)forwardStatus.textContent='';const preview=String(message.content||'').replace(/\s+/g,' ').trim();if(forwardPreview)forwardPreview.textContent=preview?(preview.length>140?`${preview.slice(0,140)}…`:preview):t("app.attachment_media_message");updateForwardSend();if(forwardList){forwardList.innerHTML=`<div class="discord-forward-empty">${ARXI18n.html("app.loading_server_members")}</div>`;}forwardDialog.showModal();try{await getForwardMembers();renderForwardMembers();forwardSearch?.focus();}catch(error){if(forwardList){forwardList.innerHTML='';const empty=document.createElement('div');empty.className='discord-forward-empty error';empty.textContent=error.message||t("app.could_not_load_members");forwardList.append(empty);}}};
        forwardSearch?.addEventListener('input',renderForwardMembers);
        forwardList?.addEventListener('click',event=>{const row=event.target.closest('[data-forward-member]');if(!row)return;const id=String(row.dataset.forwardMember||'');if(!id)return;if(forwardSelection.has(id))forwardSelection.delete(id);else if(forwardSelection.size<10)forwardSelection.add(id);renderForwardMembers();updateForwardSend();});
        forwardDialog.querySelector('[data-forward-close]')?.addEventListener('click',()=>forwardDialog.close());
        forwardDialog.addEventListener('click',event=>{if(event.target===forwardDialog)forwardDialog.close();});
      
        const deleteDialog=document.createElement('dialog');deleteDialog.className='discord-delete-dialog';deleteDialog.innerHTML=`<div><h3>${ARXI18n.html("app.delete_message_2")}</h3><p>${ARXI18n.html("app.this_permanently_deletes_the_message_from_the_discord_channel")}</p><section><button type="button" data-delete-cancel>${ARXI18n.html("common.cancel")}</button><button type="button" class="danger" data-delete-confirm>${ARXI18n.html("app.delete_message")}</button></section></div>`;document.body.append(deleteDialog);
        deleteDialog.querySelector('[data-delete-cancel]')?.addEventListener('click',()=>deleteDialog.close());
        deleteDialog.addEventListener('click',event=>{if(event.target===deleteDialog)deleteDialog.close();});
      
        const queueMessageAction=async(action,message,extra={})=>{
          const response=await fetch(`/api/guilds/${guildId}/bot-chat/message-action`,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({action,channel_id:String(message.channel_id||selectedChannel),message_id:String(message.message_id||''),...extra})});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||t("app.could_not_start_the_message_action"));return await waitForQueuedAction(data.action_id,t("app.the_message_action_failed"));
        };
      
        contextMenu.addEventListener('click',async event=>{const button=event.target.closest('[data-message-action]');if(!button||!contextMessage)return;const action=button.dataset.messageAction;const message=contextMessage;closeContextMenu();try{if(action==='reply'){setReplyTarget(message);return;}if(action==='forward'){await openForwardDialog(message);return;}if(action==='copy'){await copyToClipboard(message.content||'');setLive(t("app.text_copied"));return;}if(action==='link'){await copyToClipboard(jumpUrlFor(message));setLive(t("app.message_link_copied"));return;}if(action==='pin'){setLive(message.pinned?t("app.unpinning_message"):t("app.pinning_message"));const result=await queueMessageAction('toggle_pin',message);message.pinned=!!result.pinned;setLive(result.pinned?t("app.message_pinned"):t("app.message_unpinned"));await loadState();return;}if(action==='delete'){pendingDeleteMessage=message;deleteDialog.showModal();return;}}catch(error){setLive(error.message||t("app.message_action_error"),true);}});
      
        deleteDialog.querySelector('[data-delete-confirm]')?.addEventListener('click',async()=>{const message=pendingDeleteMessage;if(!message)return;const button=deleteDialog.querySelector('[data-delete-confirm]');button.disabled=true;try{setLive(t("app.deleting_message"));await queueMessageAction('delete',message);deleteDialog.close();pendingDeleteMessage=null;setLive(t("app.message_deleted"));await loadState();}catch(error){setLive(error.message||t("app.could_not_delete_message"),true);}finally{button.disabled=false;}});
      
        forwardSend?.addEventListener('click',async()=>{if(!forwardMessage||!forwardSelection.size)return;forwardSend.disabled=true;if(forwardStatus)forwardStatus.textContent=t("app.forwarding");try{const result=await queueMessageAction('forward',forwardMessage,{target_user_ids:[...forwardSelection],note:forwardNote?.value||''});const sent=Number(result.sent_count||0),failed=Number(result.failed_count||0);if(forwardStatus)forwardStatus.textContent=failed?t("app.forwarded_to_value0_members_failed_for_value1_members", {value0: (sent), value1: (failed)}):t("app.forwarded_to_value0_members", {value0: (sent)});setLive(failed?t("app.partially_forwarded"):t("app.message_forwarded"),!!failed);setTimeout(()=>forwardDialog.close(),failed?1500:450);}catch(error){if(forwardStatus)forwardStatus.textContent=error.message||t("app.could_not_forward_the_message");setLive(error.message||t("app.forwarding_error"),true);}finally{updateForwardSend();}});
      
        const bindMessageSurface=surface=>{
          surface?.addEventListener('contextmenu',event=>{const row=event.target.closest('.discord-message[data-message-id]');if(!row||row.classList.contains('deleted'))return;const message=messageIndex.get(String(row.dataset.messageId||''));if(!message)return;event.preventDefault();openContextMenu(message,event.clientX,event.clientY);});
          surface?.addEventListener('click',event=>{const reference=event.target.closest('[data-reply-reference]');if(!reference)return;const targetId=String(reference.dataset.replyReference||'');const target=[...surface.querySelectorAll('.discord-message[data-message-id]')].find(row=>String(row.dataset.messageId||'')===targetId);if(target){target.scrollIntoView({behavior:'smooth',block:'center'});target.classList.add('reply-highlight');setTimeout(()=>target.classList.remove('reply-highlight'),1200);}});
          surface?.addEventListener('scroll',closeContextMenu,{passive:true});
        };
        bindMessageSurface(feed);bindMessageSurface(threadFeed);
        document.addEventListener('pointerdown',event=>{if(!contextMenu.hidden&&!contextMenu.contains(event.target))closeContextMenu();});
        window.addEventListener('blur',closeContextMenu);window.addEventListener('resize',closeContextMenu);
        document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!contextMenu.hidden)closeContextMenu();});
      
        const queueRoomControl = async (room, operation, {targetId='', value=''}={}) => {
          const response = await fetch(`/api/guilds/${guildId}/bot-chat/room/${encodeURIComponent(room.voice_id)}/control`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body:JSON.stringify({operation, target_id:String(targetId||''), value:String(value??'')})
          });
          const data = await response.json().catch(()=>({}));
          if (!response.ok) throw new Error(data.detail || t("app.could_not_queue_the_room_action"));
          return await waitForQueuedAction(data.action_id, t("app.the_room_action_failed"));
        };
      
        const renderRoomControl = room => {
          if (!roomControlPanel) return;
          roomControlPanel.replaceChildren();
          if (!room) { roomControlPanel.classList.add('is-hidden'); return; }
          roomControlPanel.classList.remove('is-hidden');
          const labels = room.labels || {};
          const card = document.createElement('div'); card.className='discord-room-control-card';
          const title = document.createElement('strong'); title.textContent=labels.title || t("app.arx_room_controls");
          const owner = document.createElement('small'); owner.textContent=`${room.owner_name || ''}`;
          const desc = document.createElement('p'); desc.className='discord-room-control-description'; desc.textContent=String(labels.description||'').replaceAll('**','');
          const status = document.createElement('div'); status.className='discord-room-control-status';
          const actions = document.createElement('div'); actions.className='discord-room-control-actions';
          const run = async (operation, opts={}) => {
            status.classList.remove('error'); status.textContent='…';
            try { const result=await queueRoomControl(room,operation,opts); status.textContent=result.message||'✓'; await loadState(); }
            catch(error){status.classList.add('error');status.textContent=error.message||t("app.action_failed_2");}
          };
          const button = (label, operation, cls='') => {
            const el=document.createElement('button'); el.type='button'; el.textContent=label; el.className=`discord-room-button ${cls}`.trim();
            el.addEventListener('click',async()=>{
              let value='';
              if(operation==='rename'){value=prompt(labels.rename_prompt||t("app.new_room_name"),'')||'';if(!value.trim())return;}
              if(operation==='limit'){value=prompt(labels.limit_prompt||t("discord.room_limit_label"),String(0));if(value===null)return;}
              if(operation==='close'){const _confirmText=labels.close_confirm||t("app.close_this_room");if(!confirm(_confirmText))return;}
              el.disabled=true; try{await run(operation,{value});}finally{el.disabled=false;}
            });
            return el;
          };
          actions.append(
            button(labels.lock||t("discord.room_lock"),'lock','pair-lock'),
            button(labels.open||t("app.open"),'unlock','pair-lock'),
            button(labels.hide||t("discord.room_hide"),'hide','pair-visibility'),
            button(labels.show||t("app.show"),'show','pair-visibility'),
            button(labels.close||t("common.close"),'close','danger'),
            button(labels.rename||t("app.rename"),'rename','pair-edit'),
            button(labels.limit||t("app.user_limit"),'limit','pair-edit')
          );
          const selects=document.createElement('div'); selects.className='discord-room-control-selects';
          const memberOptions = Array.isArray(room.members) ? room.members.filter(m=>!m.is_bot) : [];
          const addSelect=(placeholder,operation)=>{
            const select=document.createElement('select'); const initial=document.createElement('option');initial.value='';initial.textContent=placeholder;initial.selected=true;initial.disabled=true;select.append(initial);
            for(const member of memberOptions){const option=document.createElement('option');option.value=String(member.user_id);option.textContent=member.display_name||member.username||String(member.user_id);select.append(option);}
            select.addEventListener('change',async()=>{const targetId=select.value;if(!targetId)return;select.disabled=true;try{await run(operation,{targetId});}finally{select.value='';select.disabled=false;}});
            return select;
          };
          selects.append(addSelect(labels.kick||t("app.kick_member_from_room"),'kick'),addSelect(labels.toggleban||t("app.ban_or_unban_member"),'toggleban'),addSelect(labels.transfer||t("app.transfer_ownership"),'transfer'));
          card.append(title,owner,desc,actions,selects,status); roomControlPanel.append(card);
        };
      
        const applyState = state => {
          if(Array.isArray(state.member_groups)) cachedMemberGroups=state.member_groups;
          if(state.online_count!==null&&state.online_count!==undefined) cachedOnlineCount=Number(state.online_count)||0;
          if(Number.isFinite(Number(state.member_version))) knownMemberVersion=Number(state.member_version);
          state.member_groups=cachedMemberGroups;
          state.online_count=cachedOnlineCount;
          currentState = state;
          selectedChannel = String(state.selected_channel_id || '');
          const selectedType=String(state.selected_channel?.channel_type||'');
          const channelChanged=lastRenderedChannel!==selectedChannel;
          const canSend=!!selectedChannel&&(selectedType==='text'||selectedType==='thread');
          root.dataset.channelId = selectedChannel;
          if (channelInput) channelInput.value = canSend?selectedChannel:'';
          const isForumThread=selectedType==='thread'&&!!state.selected_forum?.channel_id;
          const isForumSurface=selectedType==='forum'||isForumThread;
          root.classList.toggle('forum-surface',isForumSurface);
          root.classList.toggle('forum-thread-open',isForumThread);
          if (channelName) channelName.textContent = isForumThread?(state.selected_forum?.name||state.selected_channel?.name||t("module.select_channel")):(state.selected_channel?.name || t("module.select_channel"));
          if (channelIcon) channelIcon.textContent = isForumSurface?'▤':'#';
          if(threadPane)threadPane.hidden=!isForumThread;
          if(threadTitle)threadTitle.textContent=isForumThread?(state.selected_channel?.name||''):'';
          if (onlineCount) onlineCount.textContent = t("module.value0_online", {value0: (state.online_count || 0)});
          const botStatus = String(state.bot_profile?.status || 'online');
          const botStatusLabels = {online:t("module.online"), idle:t("module.idle"), dnd:t("module.do_not_disturb"), invisible:t("module.invisible")};
          if (selfStatusDot) selfStatusDot.className = botStatus;
          if (selfStatusText) selfStatusText.textContent = botStatusLabels[botStatus] || t("module.online");
          if (textInput) { textInput.disabled=!canSend; textInput.placeholder=canSend?t("module.send_a_message_as_arx_to_value0", {value0: (state.selected_channel?.name || 'kanal')}):t("app.select_a_text_channel_first"); }
          if (imageInput) imageInput.disabled=!canSend;
          if (emojiButton) emojiButton.disabled=!canSend;
          if (sendButton) sendButton.disabled=!canSend;
          composer?.classList.toggle('is-forum-view',selectedType==='forum');
          composer?.classList.toggle('is-thread-drawer',isForumThread);
          if(replyTarget&&String(replyTarget.channel_id||'')!==selectedChannel)clearReplyTarget();
          const channelSignature=JSON.stringify([selectedChannel,state.selected_forum||null,state.channel_groups||[]]);
          const memberSignature=JSON.stringify(cachedMemberGroups||[]);
          const roomSignature=JSON.stringify(state.room_control||null);
          const messageSignature=JSON.stringify((state.messages||[]).map(message=>[message.message_id||'',message.content||'',message.edited_at||'',message.deleted_at||'',!!message.pinned,message.author_name||'',message.author_avatar_url||'',message.attachments||[],message.embeds||[],message.components||[],message.reference||null]));
          const forumSignature=JSON.stringify([state.forum_tags||[],(state.forum_posts||[]).map(post=>[post.channel_id||'',post.name||'',post.starter_author_name||'',post.starter_content||'',post.thumbnail_url||'',!!post.pinned,post.tag_ids||[],post.last_message_at||'',post.message_count||0])]);
          if(channelSignature!==lastChannelSignature){renderChannels(state.channel_groups||[]);lastChannelSignature=channelSignature;}
          if(memberSignature!==lastMemberSignature){renderMembers(cachedMemberGroups||[]);lastMemberSignature=memberSignature;}
          if(roomSignature!==lastRoomSignature){renderRoomControl(state.room_control||null);lastRoomSignature=roomSignature;}
          if(selectedType==='forum'){
            if(forumSignature!==lastForumSignature||channelChanged){renderForumPosts(state.forum_posts||[]);lastForumSignature=forumSignature;}
          }else if(isForumThread){
            if(forumSignature!==lastForumSignature||channelChanged){renderForumPosts(state.forum_posts||[],selectedChannel);lastForumSignature=forumSignature;}
            if(messageSignature!==lastMessageSignature||channelChanged){renderMessages(state.messages||[],threadFeed,{includeForumBack:false});lastMessageSignature=messageSignature;}
          }else if(messageSignature!==lastMessageSignature||channelChanged){
            if(threadPane)threadPane.hidden=true;
            renderMessages(state.messages||[]);lastMessageSignature=messageSignature;
          }
          lastRenderedChannel=selectedChannel;
          setLive(t("module.arx_live"));
        };
      
        const loadState = async () => {
          const requestedChannel = selectedChannel;
          const requestSerial = ++stateRequestSerial;
          stateAbortController?.abort();
          const abortController=new AbortController();stateAbortController=abortController;
          try {
            const params=new URLSearchParams({channel_id:requestedChannel||'0'});
            if(knownMemberVersion>=0)params.set('member_version',String(knownMemberVersion));
            const response=await fetch(`/api/guilds/${guildId}/bot-chat/state?${params.toString()}`,{cache:'no-store',signal:abortController.signal});
            const state=await response.json();
            if(!response.ok)throw new Error(state.detail||t("app.could_not_load_bot_chat_data"));
            if(requestSerial !== stateRequestSerial || requestedChannel !== selectedChannel) return;
            applyState(state);
          } catch (error) {
            if(error?.name==='AbortError')return;
            if(requestSerial === stateRequestSerial) setLive(error.message||t("app.connection_error"),true);
          }
        };
      
        const queueRefresh = async (force = false) => {
          if (!selectedChannel || !refreshButton) return;
          const refreshKey=String(selectedChannel);
          if(!force&&refreshedChannels.has(refreshKey))return;
          refreshedChannels.add(refreshKey);
          refreshButton.classList.add('busy');
          try {
            const form=new FormData();form.set('channel_id',refreshKey);
            const response=await fetch(`/guild/${guildId}/bot-chat/refresh`,{method:'POST',headers:{'X-ARX-AJAX':'1'},body:form});
            if(!response.ok)throw new Error(t("app.could_not_queue_refresh"));
            setLive(t("app.refreshing"));setTimeout(loadState,900);setTimeout(loadState,2600);
          } catch (_) { if(!force)refreshedChannels.delete(refreshKey);setLive(t("app.refresh_error"),true); }
          finally { setTimeout(()=>refreshButton.classList.remove('busy'),700); }
        };
      
      
      
        memberList?.addEventListener('click', event => {
          const row=event.target.closest('[data-member-profile]');
          if(row)openMemberProfile(String(row.dataset.memberProfile||''));
        });
        channelList?.addEventListener('click', event => {
          const member=event.target.closest('[data-member-profile]');
          if(member){event.stopPropagation();openMemberProfile(String(member.dataset.memberProfile||''));}
        });
        memberProfileDialog?.addEventListener('click', event => { if(event.target===memberProfileDialog) memberProfileDialog.close(); });
      
        const selectChatTarget=async(targetId,targetName,targetType='text')=>{
          clearReplyTarget();
          selectedChannel=String(targetId||'');if(!selectedChannel)return;
          const canSend=targetType==='text'||targetType==='thread';
          if(channelInput)channelInput.value=canSend?selectedChannel:'';
          if(channelName)channelName.textContent=targetName||'kanal';
          if(channelIcon)channelIcon.textContent=targetType==='forum'?'▤':(targetType==='thread'?'↳':'#');
          if(textInput){textInput.disabled=!canSend;if(canSend)textInput.focus();}
          if(imageInput)imageInput.disabled=!canSend;
          if(emojiButton)emojiButton.disabled=!canSend;
          if(sendButton)sendButton.disabled=!canSend;
          const url=new URL(location.href);url.searchParams.set('channel_id',selectedChannel);history.replaceState({},'',url);
          channelList?.querySelectorAll('[data-chat-channel],[data-chat-forum]').forEach(row=>{
            const rowId=String(row.dataset.chatChannel||row.dataset.chatForum||'');
            row.classList.toggle('active',rowId===selectedChannel);
          });
          await loadState();
          void queueRefresh(false);
        };

        channelList?.addEventListener('click', async event => {
          const button=event.target.closest('[data-chat-channel],[data-chat-forum]'); if(!button)return;
          const targetId=button.dataset.chatChannel||button.dataset.chatForum||'';
          const targetType=button.dataset.channelType||(button.dataset.chatForum?'forum':'text');
          await selectChatTarget(targetId,button.dataset.channelName||'',targetType);
        });

        feed?.addEventListener('click',async event=>{
          const post=event.target.closest('[data-forum-post]');
          if(post){await selectChatTarget(post.dataset.forumPost||'',post.dataset.channelName||'','thread');return;}
          const back=event.target.closest('[data-forum-back]');
          if(back){await selectChatTarget(back.dataset.forumBack||'',back.dataset.channelName||'','forum');return;}
          const tag=event.target.closest('[data-forum-tag]');
          if(tag){activeForumTagId=activeForumTagId===String(tag.dataset.forumTag||'')?'':String(tag.dataset.forumTag||'');applyForumFilters();return;}
          const sort=event.target.closest('[data-forum-sort]');
          if(sort){
            const list=feed.querySelector('.discord-forum-post-list');if(!list)return;
            const next=sort.dataset.forumSort==='newest'?'oldest':'newest';sort.dataset.forumSort=next;
            const cards=[...list.querySelectorAll('.discord-forum-post-card')];
            cards.sort((a,b)=>{const pin=Number(b.dataset.pinned||0)-Number(a.dataset.pinned||0);if(pin)return pin;const av=Number(a.dataset.sortTime||0),bv=Number(b.dataset.sortTime||0);return next==='newest'?bv-av:av-bv;});
            cards.forEach(card=>list.append(card));
          }
        });
        feed?.addEventListener('input',event=>{
          const search=event.target.closest('[data-forum-search]');if(!search)return;applyForumFilters();
        });
        threadPane?.querySelector('[data-forum-thread-close]')?.addEventListener('click',async()=>{
          const forum=currentState?.selected_forum;if(!forum?.channel_id)return;
          await selectChatTarget(String(forum.channel_id),forum.name||'','forum');
        });
      
        refreshButton?.addEventListener('click',()=>queueRefresh(true));
      
        composer?.addEventListener('submit', async event => {
          event.preventDefault(); if(!selectedChannel)return;
          const hasText=!!textInput?.value.trim(),hasFile=!!imageInput?.files?.length;if(!hasText&&!hasFile)return;
          if(sendButton){sendButton.disabled=true;sendButton.textContent=t("app.sending");}
          try {
            const form=new FormData(composer);form.set('channel_id',selectedChannel);form.set('reply_to_message_id',replyTarget?.message_id||'');
            const response=await fetch(composer.action,{method:'POST',headers:{'X-ARX-AJAX':'1'},body:form});
            const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||t("app.could_not_send_the_message"));
            if(textInput){textInput.value='';textInput.style.height='44px';}if(imageInput)imageInput.value='';clearReplyTarget();renderUploadPreviews();setLive(t("app.sending_2"));
            setTimeout(loadState,700);setTimeout(loadState,2300);setTimeout(loadState,4200);
          } catch(error){setLive(error.message||t("app.send_error"),true);}
          finally {if(sendButton){const type=String(currentState?.selected_channel?.channel_type||'');sendButton.disabled=!(selectedChannel&&(type==='text'||type==='thread'));sendButton.textContent=t("common.send");}}
        });
      
        textInput?.addEventListener('keydown', event => { if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();composer?.requestSubmit();} });
        textInput?.addEventListener('input',()=>{textInput.style.height='44px';textInput.style.height=`${Math.min(132,Math.max(44,textInput.scrollHeight))}px`;});
        const replaceSelectedFiles = files => {
          if (!imageInput) return;
          const transfer = new DataTransfer();
          for (const file of files.slice(0, 10)) transfer.items.add(file);
          imageInput.files = transfer.files;
        };
      
        const renderUploadPreviews = () => {
          if (!uploadPreview || !imageInput) return;
          uploadPreview.querySelectorAll('img[data-object-url]').forEach(img => URL.revokeObjectURL(img.dataset.objectUrl));
          uploadPreview.replaceChildren();
          const files = [...(imageInput.files || [])].slice(0, 10);
          if (imageInput.files?.length > 10) replaceSelectedFiles(files);
          files.forEach((file, index) => {
            const card = document.createElement('div');
            card.className = 'discord-upload-card';
            card.title = file.name;
            const image = document.createElement('img');
            const objectUrl = URL.createObjectURL(file);
            image.src = objectUrl; image.alt = file.name; image.dataset.objectUrl = objectUrl;
            const remove = document.createElement('button');
            remove.type = 'button'; remove.className = 'discord-upload-remove'; remove.textContent = t("app.symbol"); remove.title = t("app.remove_this_image");
            remove.addEventListener('click', () => {
              const remaining = [...(imageInput.files || [])].filter((_, current) => current !== index);
              replaceSelectedFiles(remaining);
              renderUploadPreviews();
            });
            const label = document.createElement('span'); label.textContent = file.name;
            card.append(image, remove, label); uploadPreview.append(card);
          });
        };
      
        imageInput?.addEventListener('change', renderUploadPreviews);
      
        if (feed) requestAnimationFrame(()=>{feed.scrollTop=feed.scrollHeight;});
        if (threadFeed) requestAnimationFrame(()=>{threadFeed.scrollTop=threadFeed.scrollHeight;});
        loadState();
        setTimeout(()=>{ if(selectedChannel) void queueRefresh(false); },250);
        const timer=setInterval(()=>{if(document.visibilityState==='visible')loadState();},5000);
        window.addEventListener('pagehide',()=>{clearInterval(timer);},{once:true});
      })();
      
      // Critical Notifications: scalable server-side member search + verification card.
      (() => {
        const picker = document.querySelector('[data-critical-member-picker]');
        if (!picker) return;
      
        const guildId = String(picker.dataset.guildId || '');
        const form = picker.closest('form');
        const search = document.getElementById('arxCriticalMemberSearch');
        const memberId = document.getElementById('arxCriticalMemberId');
        const results = document.getElementById('arxCriticalMemberResults');
        const selected = document.getElementById('arxCriticalSelectedMember');
        const selectedWrap = document.getElementById('arxCriticalSelectedWrap');
        const addButton = document.getElementById('arxCriticalAddRecipient');
        const dialog = document.getElementById('arxCriticalMemberProfile');
        const card = document.getElementById('arxCriticalMemberProfileCard');
        if (!guildId || !search || !memberId || !results || !selected) return;
      
        let searchTimer = null;
        let requestSerial = 0;
        let selectedMember = null;
      
        const localTime = value => {
          if (!value) return t('module.unknown');
          const parsed = new Date(String(value).endsWith('Z') ? value : `${String(value).replace(' ', 'T')}Z`);
          return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString(currentUiLanguage || undefined);
        };
        const presenceLabel = value => ({online:t('module.online'),idle:t('module.idle'),dnd:t('module.do_not_disturb'),offline:t('member.offline'),invisible:t('module.invisible')})[value] || value || t('member.offline');
      
        const avatarNode = member => {
          const wrap=document.createElement('span');wrap.className='critical-search-avatar';
          if(member.avatar_url){const img=document.createElement('img');img.src=member.avatar_url;img.alt='';wrap.append(img);}
          else{wrap.textContent=String(member.display_name||member.username||'?')[0].toUpperCase();}
          const dot=document.createElement('i');dot.className=member.presence||'offline';wrap.append(dot);return wrap;
        };
      
        const closeResults = () => { results.hidden=true; results.replaceChildren(); };
        const eligibilityLabel = member => {
          if(member.critical_eligible)return {text:t('module.critical_candidate_ready'),kind:'ready'};
          if(!member.critical_is_admin)return {text:t('module.critical_candidate_admin_required'),kind:'blocked'};
          return {text:t('module.critical_candidate_dm_required'),kind:'waiting'};
        };
        const renderResults = members => {
          results.replaceChildren();
          if(!members.length){const empty=document.createElement('div');empty.className='critical-search-empty';empty.textContent=t('app.no_members_match_your_search');results.append(empty);results.hidden=false;return;}
          for(const member of members){
            const row=document.createElement('button');row.type='button';row.className=`critical-search-result${member.critical_eligible?'':' ineligible'}`;row.dataset.userId=String(member.user_id||'');
            const copy=document.createElement('span');copy.className='critical-search-copy';
            const name=document.createElement('strong');name.textContent=member.display_name||member.username||member.user_id;
            const meta=document.createElement('small');meta.textContent=`${member.username?`@${member.username} · `:''}${member.user_id}`;
            const status=eligibilityLabel(member);const badge=document.createElement('span');badge.className=`critical-search-status ${status.kind}`;badge.textContent=status.text;
            copy.append(name,meta);row.append(avatarNode(member),copy,badge);
            row.addEventListener('click',()=>{if(member.critical_eligible)selectMember(member);else openProfile(String(member.user_id||''));});results.append(row);
          }
          results.hidden=false;
        };
      
        const searchMembers = async () => {
          const query=search.value.trim();
          const serial=++requestSerial;
          if(query.length<2 && !(query.length>=15 && /^\d+$/.test(query))){closeResults();return;}
          try{
            const response=await fetch(`/api/guilds/${encodeURIComponent(guildId)}/members/search?q=${encodeURIComponent(query)}&limit=20&critical=1`,{cache:'no-store'});
            const data=await response.json().catch(()=>({}));
            if(serial!==requestSerial)return;
            if(!response.ok)throw new Error(data.detail||t('app.could_not_retrieve_server_members'));
            renderResults(Array.isArray(data.members)?data.members:[]);
          }catch(error){if(serial===requestSerial){results.replaceChildren();const empty=document.createElement('div');empty.className='critical-search-empty';empty.textContent=error.message||t('app.could_not_retrieve_server_members');results.append(empty);results.hidden=false;}}
        };
      
        const renderSelected = member => {
          selected.replaceChildren();selected.append(avatarNode(member));
          const copy=document.createElement('span');copy.className='critical-search-copy';
          const name=document.createElement('strong');name.textContent=member.display_name||member.username||member.user_id;
          const meta=document.createElement('small');meta.textContent=`${member.username?`@${member.username} · `:''}${member.user_id}`;
          copy.append(name,meta);const hint=document.createElement('em');hint.textContent=t('member_dialogs.view_profile').replace(/^\S+\s*/,'');selected.append(copy,hint);selected.hidden=false;if(selectedWrap)selectedWrap.hidden=false;if(addButton)addButton.disabled=false;
        };
      
        const profileText = (label,value) => {const row=document.createElement('div');row.className='discord-profile-info-row';const key=document.createElement('small');key.textContent=label;const val=document.createElement('strong');val.textContent=value||'—';row.append(key,val);return row;};
        const renderProfile = profile => {
          if(!card)return;card.replaceChildren();
          const close=document.createElement('button');close.type='button';close.className='discord-profile-close';close.textContent='×';close.setAttribute('aria-label',t('common.close'));close.addEventListener('click',()=>dialog?.close());
          const banner=document.createElement('div');banner.className='discord-profile-banner';banner.style.background=profile.banner_url?`center/cover no-repeat url("${String(profile.banner_url).replaceAll('"','%22')}")`:profile.accent_colour||'#24262b';
          const avatarWrap=document.createElement('div');avatarWrap.className='discord-profile-avatar-wrap';const avatar=document.createElement('div');avatar.className='discord-profile-avatar';
          if(profile.avatar_url||profile.global_avatar_url){const img=document.createElement('img');img.src=profile.avatar_url||profile.global_avatar_url;img.alt='';avatar.append(img);}else{const span=document.createElement('span');span.textContent=String(profile.display_name||'?')[0].toUpperCase();avatar.append(span);}const dot=document.createElement('i');dot.className=profile.presence||'offline';avatar.append(dot);avatarWrap.append(avatar);
          const body=document.createElement('div');body.className='discord-profile-body';const title=document.createElement('div');title.className='discord-profile-title';const h=document.createElement('h3');h.textContent=profile.display_name||profile.username||profile.user_id;title.append(h);body.append(title);
          const user=document.createElement('p');user.className='discord-profile-username';user.textContent=`@${profile.username||profile.user_id}`;body.append(user);
          const status=document.createElement('div');status.className='discord-profile-status';const pdot=document.createElement('i');pdot.className=profile.presence||'offline';const ptext=document.createElement('span');ptext.textContent=presenceLabel(profile.presence);status.append(pdot,ptext);body.append(status);
          const sectionTitle=document.createElement('h4');sectionTitle.textContent=t('app.server_roles');body.append(sectionTitle);const roles=document.createElement('div');roles.className='discord-profile-roles';
          for(const role of profile.roles||[]){const chip=document.createElement('span');const color=document.createElement('i');color.style.background=role.colour||'#777';chip.append(color,document.createTextNode(role.name));roles.append(chip);}if(!roles.childElementCount){const none=document.createElement('small');none.textContent=t('app.no_roles_found');roles.append(none);}body.append(roles);
          const info=document.createElement('div');info.className='discord-profile-info';info.append(profileText(t('app.joined_server'),profile.joined_at?localTime(profile.joined_at):t('module.unknown')),profileText(t('module.discord_id'),profile.user_id));body.append(info);
          const actions=document.createElement('div');actions.className='discord-profile-actions';const detailed=document.createElement('a');detailed.href=profile.member_profile_url;detailed.textContent=t('app.open_arx_member_profile');actions.append(detailed);body.append(actions);card.append(close,banner,avatarWrap,body);
        };
      
        const openProfile = async userId => {
          if(!dialog||!card||!userId)return;
          card.innerHTML=`<button type="button" class="discord-profile-close" aria-label="${t('common.close')}">×</button><div class="discord-profile-loading">${t('module.loading_discord_profile')}</div>`;
          card.querySelector('.discord-profile-close')?.addEventListener('click',()=>dialog.close());if(!dialog.open)dialog.showModal();
          try{const response=await fetch(`/api/guilds/${encodeURIComponent(guildId)}/member-card/${encodeURIComponent(userId)}`,{cache:'no-store'});const data=await response.json().catch(()=>({}));if(!response.ok)throw new Error(data.detail||t('app.could_not_retrieve_profile'));renderProfile(data);}catch(error){card.replaceChildren();const box=document.createElement('div');box.className='discord-profile-loading error';box.textContent=error.message||t('app.could_not_retrieve_profile');card.append(box);}
        };
      
        const selectMember = member => {
          selectedMember=member;memberId.value=String(member.user_id||'0');search.value=member.display_name||member.username||String(member.user_id);renderSelected(member);closeResults();openProfile(memberId.value);
        };
      
        search.addEventListener('input',()=>{memberId.value='0';selectedMember=null;selected.hidden=true;if(selectedWrap)selectedWrap.hidden=true;if(addButton)addButton.disabled=true;clearTimeout(searchTimer);searchTimer=setTimeout(searchMembers,220);});
        search.addEventListener('focus',()=>{if(search.value.trim().length>=2)searchMembers();});
        selected.addEventListener('click',()=>{if(selectedMember)openProfile(String(selectedMember.user_id||''));});
        dialog?.addEventListener('click',event=>{if(event.target===dialog)dialog.close();});
        document.addEventListener('click',event=>{if(!picker.contains(event.target))closeResults();});
        form?.addEventListener('submit',event=>{if(memberId.value==='0'){event.preventDefault();search.focus();search.setCustomValidity(t('module.select_member'));search.reportValidity();setTimeout(()=>search.setCustomValidity(''),0);}});
      })();
      
      // Bot Profile media editor: Discord-like fixed crop frame + queue completion tracking.
      (() => {
        const dialog = document.getElementById('arxProfileCropDialog');
        if (!dialog) return;
      
        const canvas = document.getElementById('arxCropCanvas');
        const stage = document.getElementById('arxCropStage');
        const zoomInput = document.getElementById('arxCropZoom');
        const title = document.getElementById('arxCropTitle');
        const gifNote = document.getElementById('arxCropGifNote');
        const ctx = canvas?.getContext('2d', {alpha:false});
        if (!canvas || !stage || !zoomInput || !ctx) return;
      
        const cropState = {
          input:null, image:null, objectUrl:null, kind:'avatar', zoom:1,
          offsetX:0, offsetY:0, accepted:false, dragging:false,
          pointerX:0, pointerY:0, startOffsetX:0, startOffsetY:0,
          rect:{x:145,y:45,w:510,h:510}, output:{w:640,h:640}, shape:'circle',
        };
      
        const configureCrop = kind => {
          cropState.kind = kind === 'banner' ? 'banner' : 'avatar';
          canvas.width = 800; canvas.height = 600;
          stage.classList.toggle('banner', cropState.kind === 'banner');
          stage.classList.toggle('avatar', cropState.kind === 'avatar');
          if (cropState.kind === 'banner') {
            cropState.rect = {x:80,y:187.0588235294,w:640,h:225.8823529412};
            cropState.output = {w:1020,h:360};
            cropState.shape = 'rect';
            title.textContent = t("app.adjust_banner_crop");
          } else {
            cropState.rect = {x:145,y:45,w:510,h:510};
            cropState.output = {w:640,h:640};
            cropState.shape = 'circle';
            title.textContent = t("app.adjust_avatar_crop");
          }
        };
      
        const imageTransform = () => {
          const image = cropState.image, rect = cropState.rect;
          if (!image) return null;
          const base = Math.max(rect.w / image.naturalWidth, rect.h / image.naturalHeight);
          const scale = base * cropState.zoom;
          const drawWidth = image.naturalWidth * scale;
          const drawHeight = image.naturalHeight * scale;
          const maxX = Math.max(0, (drawWidth - rect.w) / 2);
          const maxY = Math.max(0, (drawHeight - rect.h) / 2);
          cropState.offsetX = Math.max(-maxX, Math.min(maxX, cropState.offsetX));
          cropState.offsetY = Math.max(-maxY, Math.min(maxY, cropState.offsetY));
          const cx = rect.x + rect.w / 2, cy = rect.y + rect.h / 2;
          return {
            x:cx - drawWidth / 2 + cropState.offsetX,
            y:cy - drawHeight / 2 + cropState.offsetY,
            w:drawWidth, h:drawHeight,
          };
        };
      
        const drawFrame = () => {
          const rect = cropState.rect;
          ctx.save();
          ctx.fillStyle = 'rgba(5,6,8,.68)';
          ctx.beginPath();
          ctx.rect(0,0,canvas.width,canvas.height);
          if (cropState.shape === 'circle') {
            ctx.arc(rect.x + rect.w/2, rect.y + rect.h/2, rect.w/2, 0, Math.PI*2, true);
          } else {
            ctx.rect(rect.x,rect.y,rect.w,rect.h);
          }
          ctx.fill('evenodd');
          ctx.lineWidth = 7;
          ctx.strokeStyle = '#fff';
          ctx.beginPath();
          if (cropState.shape === 'circle') {
            ctx.arc(rect.x + rect.w/2, rect.y + rect.h/2, rect.w/2, 0, Math.PI*2);
          } else {
            ctx.rect(rect.x,rect.y,rect.w,rect.h);
          }
          ctx.stroke();
          ctx.restore();
        };
      
        const drawCrop = () => {
          ctx.fillStyle='#17191e'; ctx.fillRect(0,0,canvas.width,canvas.height);
          if (!cropState.image) return;
          const t=imageTransform(); if(!t)return;
          ctx.drawImage(cropState.image,t.x,t.y,t.w,t.h);
          drawFrame();
        };
      
        const exportCrop = callback => {
          const t=imageTransform(); if(!t||!cropState.image)return;
          const rect=cropState.rect, out=document.createElement('canvas');
          out.width=cropState.output.w; out.height=cropState.output.h;
          const outCtx=out.getContext('2d',{alpha:false});
          const sx=out.width/rect.w, sy=out.height/rect.h;
          outCtx.fillStyle='#000'; outCtx.fillRect(0,0,out.width,out.height);
          outCtx.drawImage(
            cropState.image,
            (t.x-rect.x)*sx,(t.y-rect.y)*sy,t.w*sx,t.h*sy,
          );
          out.toBlob(callback,'image/png',0.96);
        };
      
        const cleanupCrop = clearInput => {
          if (cropState.objectUrl) URL.revokeObjectURL(cropState.objectUrl);
          if (clearInput && cropState.input) cropState.input.value='';
          cropState.input=null; cropState.image=null; cropState.objectUrl=null;
          cropState.accepted=false; cropState.dragging=false;
        };
      
        const openCrop = (input,file,kind) => {
          configureCrop(kind);
          cropState.input=input; cropState.zoom=1; cropState.offsetX=0; cropState.offsetY=0; cropState.accepted=false;
          zoomInput.value='1';
          if(cropState.objectUrl)URL.revokeObjectURL(cropState.objectUrl);
          cropState.objectUrl=URL.createObjectURL(file);
          const image=new Image();
          image.onload=()=>{cropState.image=image;drawCrop();if(gifNote)gifNote.hidden=file.type!=='image/gif';dialog.showModal();};
          image.onerror=()=>{cleanupCrop(true);alert(t("app.could_not_read_the_image_choose_another_file"));};
          image.src=cropState.objectUrl;
        };
      
        document.querySelectorAll('[data-profile-crop]').forEach(input=>input.addEventListener('change',()=>{
          const file=input.files?.[0]; if(file)openCrop(input,file,input.dataset.profileCrop||'avatar');
        }));
      
        zoomInput.addEventListener('input',()=>{cropState.zoom=Math.max(1,Math.min(4,Number(zoomInput.value)||1));drawCrop();});
        stage.addEventListener('wheel',event=>{if(!cropState.image)return;event.preventDefault();const next=Math.max(1,Math.min(4,cropState.zoom+(event.deltaY<0?.08:-.08)));cropState.zoom=next;zoomInput.value=String(next);drawCrop();},{passive:false});
      
        canvas.addEventListener('pointerdown',event=>{
          if(!cropState.image)return;cropState.dragging=true;cropState.pointerX=event.clientX;cropState.pointerY=event.clientY;cropState.startOffsetX=cropState.offsetX;cropState.startOffsetY=cropState.offsetY;canvas.setPointerCapture(event.pointerId);canvas.classList.add('dragging');
        });
        canvas.addEventListener('pointermove',event=>{
          if(!cropState.dragging||!cropState.image)return;const bounds=canvas.getBoundingClientRect();const sx=canvas.width/Math.max(1,bounds.width),sy=canvas.height/Math.max(1,bounds.height);cropState.offsetX=cropState.startOffsetX+(event.clientX-cropState.pointerX)*sx;cropState.offsetY=cropState.startOffsetY+(event.clientY-cropState.pointerY)*sy;drawCrop();
        });
        const stopDrag=event=>{if(!cropState.dragging)return;cropState.dragging=false;canvas.classList.remove('dragging');try{canvas.releasePointerCapture(event.pointerId);}catch(_){}};
        canvas.addEventListener('pointerup',stopDrag);canvas.addEventListener('pointercancel',stopDrag);
      
        dialog.querySelector('[data-crop-reset]')?.addEventListener('click',()=>{cropState.zoom=1;cropState.offsetX=0;cropState.offsetY=0;zoomInput.value='1';drawCrop();});
        dialog.querySelectorAll('[data-crop-cancel]').forEach(button=>button.addEventListener('click',()=>dialog.close('cancel')));
        dialog.querySelector('[data-crop-apply]')?.addEventListener('click',()=>{
          if(!cropState.input||!cropState.image)return;
          exportCrop(blob=>{
            if(!blob||!cropState.input)return;const original=cropState.input.files?.[0];const baseName=String(original?.name||cropState.kind).replace(/\.[^.]+$/,'');const file=new File([blob],`${baseName}-${cropState.kind}-cropped.png`,{type:'image/png'});const transfer=new DataTransfer();transfer.items.add(file);cropState.input.files=transfer.files;cropState.accepted=true;dialog.close('apply');
          });
        });
        dialog.addEventListener('close',()=>{const keep=cropState.accepted||dialog.returnValue==='apply';cleanupCrop(!keep);});
      
        const waitForAction = async actionId => {
          for(let attempt=0;attempt<50;attempt++){
            await new Promise(resolve=>setTimeout(resolve,400));
            const response=await fetch(`/api/actions/${encodeURIComponent(actionId)}`,{cache:'no-store'});
            if(!response.ok)continue;const action=await response.json();
            if(action.status==='completed')return action;if(action.status==='failed')throw new Error(action.error_text||t("app.discord_profile_update_failed"));
          }
          throw new Error(t("app.the_action_is_waiting_in_the_discord_queue_try_again_in_a_few_seconds"));
        };
      
        document.querySelectorAll('[data-bot-media-form]').forEach(form=>{
          form.addEventListener('submit',async event=>{
            event.preventDefault();const button=form.querySelector('button[type="submit"], button:not([type])');const status=form.querySelector('.bot-media-action-status');const originalText=button?.textContent||'';
            if(button){button.disabled=true;button.textContent=t("app.applying_to_discord");}if(status){status.textContent=t("app.queuing_update");status.classList.remove('error');}
            try{
              const response=await fetch(form.action,{method:'POST',headers:{'X-ARX-AJAX':'1'},body:new FormData(form)});const body=await response.json().catch(()=>({}));if(!response.ok)throw new Error(body.detail||t("app.could_not_update_the_image"));if(status)status.textContent=t("app.completing_the_discord_action");await waitForAction(body.action_id);if(status)status.textContent=t("app.updated_refreshing_the_live_profile");const url=new URL(location.href);url.searchParams.set('media','updated');url.searchParams.set('_',String(Date.now()));setTimeout(()=>location.replace(url.toString()),250);
            }catch(error){if(status){status.textContent=error.message||t("app.could_not_update_the_image");status.classList.add('error');}if(button){button.disabled=false;button.textContent=originalText;}}
          });
        });
      })();
      
      /* V300.11.3 Red Carpet — draft library, Discord formatting tools and ARX color control. */
      (()=>{
        const root=document.getElementById('arxRedCarpet');
        if(!root)return;
        const guildId=String(root.dataset.guildId||'').trim();
        const blocksEl=root.querySelector('#redCarpetBlocks');
        const previewEl=root.querySelector('#redCarpetPreview');
        const channelEl=root.querySelector('#redCarpetChannel');
        const draftNameEl=root.querySelector('#redCarpetDraftName');
        const accentEnabledEl=root.querySelector('#redCarpetAccentEnabled');
        const accentColorEl=root.querySelector('#redCarpetAccentColor');
        const accentSwatchEl=root.querySelector('[data-red-carpet-color-swatch]');
        const accentCodeEl=root.querySelector('[data-red-carpet-color-code]');
        const spoilerEl=root.querySelector('#redCarpetSpoiler');
        const countEl=root.querySelector('#redCarpetComponentCount');
        const statusEl=root.querySelector('#redCarpetStatus');
        const metaEl=root.querySelector('#redCarpetMessageMeta');
        let dragIndex=-1;
        let busy=false;
        let draftId=Number(root.dataset.draftId||0);
        let config={version:1,accent_enabled:false,accent_color:'#5865F2',spoiler:false,blocks:[]};
        try{
          const parsed=JSON.parse(root.dataset.config||'{}');
          if(parsed&&typeof parsed==='object')config={...config,...parsed,blocks:Array.isArray(parsed.blocks)?parsed.blocks:[]};
        }catch(_){}

        const esc=value=>String(value??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const id=()=>`b${Date.now().toString(36)}${Math.random().toString(36).slice(2,7)}`;
        const componentCount=()=>1+config.blocks.reduce((total,block)=>{
          if(['text','media','separator'].includes(block.type))return total+1;
          if(block.type==='buttons')return total+1+(Array.isArray(block.buttons)?block.buttons.length:0);
          if(block.type==='select')return total+2;
          if(block.type==='section')return total+2+(block.thumbnail_url?1:0);
          return total;
        },0);
        const setStatus=(message,error=false)=>{
          if(!statusEl)return;
          statusEl.textContent=message||'';
          statusEl.classList.toggle('error',Boolean(error));
          statusEl.classList.toggle('success',Boolean(message)&&!error);
        };
        const defaultBlock=kind=>{
          if(kind==='text')return{id:id(),type:'text',content:`## ${t('red_carpet.default_title')}\n${t('red_carpet.default_body')}`};
          if(kind==='media')return{id:id(),type:'media',url:'',description:'',spoiler:false};
          if(kind==='separator')return{id:id(),type:'separator',divider:true,spacing:1};
          if(kind==='buttons')return{id:id(),type:'buttons',buttons:[{label:t('red_carpet.button_label_default'),url:'https://arxbot.dev',emoji:''}]};
          if(kind==='select')return{id:id(),type:'select',placeholder:t('red_carpet.select_placeholder'),options:[{label:t('red_carpet.option_label_default'),description:'',emoji:'',response:t('red_carpet.option_response_default')}]};
          return{id:id(),type:'section',content:`### ${t('red_carpet.section_title_default')}\n${t('red_carpet.section_body_default')}`,thumbnail_url:'',thumbnail_description:''};
        };
        const blockLabel=kind=>({text:t('red_carpet.text'),media:t('red_carpet.image'),separator:t('red_carpet.separator'),buttons:t('red_carpet.buttons'),select:t('red_carpet.select'),section:t('red_carpet.section')})[kind]||kind;
        const controls=index=>`<div class="red-carpet-block-controls"><button type="button" data-rc-move="up" data-index="${index}" title="${esc(t('red_carpet.move_up'))}">↑</button><button type="button" data-rc-move="down" data-index="${index}" title="${esc(t('red_carpet.move_down'))}">↓</button><button type="button" class="danger" data-rc-remove="${index}" title="${esc(t('red_carpet.remove'))}">×</button></div>`;
        const uploadField=(index,kind='media')=>`<div class="red-carpet-upload-row"><input type="file" accept="image/png,image/jpeg,image/gif,image/webp" data-rc-upload="${index}" data-rc-upload-kind="${kind}"><small>${esc(t('red_carpet.image_upload_help'))}</small></div>`;
        const formatToolbar=index=>`<div class="announcement-format-toolbar red-carpet-format-toolbar" aria-label="${esc(t('red_carpet.formatting_tools'))}"><button type="button" data-rc-format="bold" data-rc-index="${index}" title="${esc(t('diswiki.bold'))}"><b>B</b></button><button type="button" data-rc-format="italic" data-rc-index="${index}" title="${esc(t('diswiki.italic'))}"><i>I</i></button><button type="button" data-rc-format="underline" data-rc-index="${index}" title="${esc(t('diswiki.underline'))}"><u>U</u></button><button type="button" data-rc-format="strike" data-rc-index="${index}" title="${esc(t('diswiki.strikethrough'))}"><s>S</s></button><button type="button" data-rc-format="quote" data-rc-index="${index}" title="${esc(t('diswiki.quote'))}">❝</button><button type="button" data-rc-format="code" data-rc-index="${index}" title="${esc(t('diswiki.inline_code'))}">&lt;&gt;</button><button type="button" data-rc-format="spoiler" data-rc-index="${index}" title="${esc(t('diswiki.spoiler'))}">◉</button></div>`;
        const contentEditor=(block,index,rows)=>`<div class="red-carpet-content-field"><div class="red-carpet-content-head"><span>${esc(t('red_carpet.content'))}</span>${formatToolbar(index)}</div><textarea rows="${rows}" maxlength="4000" data-rc-block="${index}" data-rc-field="content">${esc(block.content||'')}</textarea></div>`;

        const renderBlock=(block,index)=>{
          const head=`<header class="red-carpet-block-head"><span class="red-carpet-drag" draggable="true" data-rc-drag="${index}" title="${esc(t('red_carpet.drag_to_reorder'))}">⠿</span><div><small>${index+1}</small><strong>${esc(blockLabel(block.type))}</strong></div>${controls(index)}</header>`;
          if(block.type==='text')return`<article class="red-carpet-block" data-rc-card="${index}">${head}${contentEditor(block,index,6)}</article>`;
          if(block.type==='media')return`<article class="red-carpet-block" data-rc-card="${index}">${head}${uploadField(index,'media')}<label><span>${esc(t('red_carpet.image_url'))}</span><input type="url" maxlength="2000" value="${esc(block.url||'')}" data-rc-block="${index}" data-rc-field="url" placeholder="https://..."></label><label><span>${esc(t('red_carpet.alt_text'))}</span><input type="text" maxlength="1024" value="${esc(block.description||'')}" data-rc-block="${index}" data-rc-field="description"></label><label class="red-carpet-inline-check"><input type="checkbox" ${block.spoiler?'checked':''} data-rc-block="${index}" data-rc-field="spoiler"><span>${esc(t('red_carpet.media_spoiler'))}</span></label></article>`;
          if(block.type==='separator')return`<article class="red-carpet-block" data-rc-card="${index}">${head}<div class="red-carpet-two-fields"><label class="red-carpet-inline-check"><input type="checkbox" ${block.divider!==false?'checked':''} data-rc-block="${index}" data-rc-field="divider"><span>${esc(t('red_carpet.divider'))}</span></label><label><span>${esc(t('red_carpet.spacing'))}</span><select data-rc-block="${index}" data-rc-field="spacing"><option value="1" ${Number(block.spacing)!==2?'selected':''}>${esc(t('red_carpet.small'))}</option><option value="2" ${Number(block.spacing)===2?'selected':''}>${esc(t('red_carpet.large'))}</option></select></label></div></article>`;
          if(block.type==='buttons'){
            const rows=(block.buttons||[]).map((button,buttonIndex)=>`<div class="red-carpet-nested-row"><label><span>${esc(t('red_carpet.button_label'))}</span><input type="text" maxlength="80" value="${esc(button.label||'')}" data-rc-block="${index}" data-rc-button="${buttonIndex}" data-rc-field="label"></label><label><span>${esc(t('red_carpet.button_url'))}</span><input type="url" maxlength="512" value="${esc(button.url||'')}" data-rc-block="${index}" data-rc-button="${buttonIndex}" data-rc-field="url"></label><label><span>${esc(t('red_carpet.emoji'))}</span><input type="text" maxlength="100" value="${esc(button.emoji||'')}" data-rc-block="${index}" data-rc-button="${buttonIndex}" data-rc-field="emoji"></label><button type="button" class="red-carpet-nested-remove" data-rc-remove-button="${index}:${buttonIndex}" aria-label="${esc(t('red_carpet.remove'))}">×</button></div>`).join('');
            return`<article class="red-carpet-block" data-rc-card="${index}">${head}<div class="red-carpet-nested-list">${rows}</div><button type="button" class="secondary red-carpet-add-nested" data-rc-add-button="${index}" ${(block.buttons||[]).length>=5?'disabled':''}>＋ ${esc(t('red_carpet.add_button'))}</button></article>`;
          }
          if(block.type==='select'){
            const rows=(block.options||[]).map((option,optionIndex)=>`<div class="red-carpet-option-row"><div class="red-carpet-option-grid"><label><span>${esc(t('red_carpet.option_label'))}</span><input type="text" maxlength="100" value="${esc(option.label||'')}" data-rc-block="${index}" data-rc-option="${optionIndex}" data-rc-field="label"></label><label><span>${esc(t('red_carpet.emoji'))}</span><input type="text" maxlength="100" value="${esc(option.emoji||'')}" data-rc-block="${index}" data-rc-option="${optionIndex}" data-rc-field="emoji"></label><label class="wide"><span>${esc(t('red_carpet.option_description'))}</span><input type="text" maxlength="100" value="${esc(option.description||'')}" data-rc-block="${index}" data-rc-option="${optionIndex}" data-rc-field="description"></label><label class="wide"><span>${esc(t('red_carpet.option_response'))}</span><textarea rows="2" maxlength="1900" data-rc-block="${index}" data-rc-option="${optionIndex}" data-rc-field="response">${esc(option.response||'')}</textarea></label></div><button type="button" class="red-carpet-nested-remove" data-rc-remove-option="${index}:${optionIndex}" aria-label="${esc(t('red_carpet.remove'))}">×</button></div>`).join('');
            return`<article class="red-carpet-block" data-rc-card="${index}">${head}<label><span>${esc(t('red_carpet.select_placeholder_label'))}</span><input type="text" maxlength="150" value="${esc(block.placeholder||'')}" data-rc-block="${index}" data-rc-field="placeholder"></label><div class="red-carpet-nested-list">${rows}</div><button type="button" class="secondary red-carpet-add-nested" data-rc-add-option="${index}" ${(block.options||[]).length>=25?'disabled':''}>＋ ${esc(t('red_carpet.add_option'))}</button><small class="red-carpet-help">${esc(t('red_carpet.select_response_help'))}</small></article>`;
          }
          return`<article class="red-carpet-block" data-rc-card="${index}">${head}${contentEditor(block,index,5)}<div class="red-carpet-two-fields"><label><span>${esc(t('red_carpet.thumbnail_url'))}</span><input type="url" maxlength="2000" value="${esc(block.thumbnail_url||'')}" data-rc-block="${index}" data-rc-field="thumbnail_url" placeholder="https://..."></label><label><span>${esc(t('red_carpet.alt_text'))}</span><input type="text" maxlength="1024" value="${esc(block.thumbnail_description||'')}" data-rc-block="${index}" data-rc-field="thumbnail_description"></label></div>${uploadField(index,'thumbnail')}</article>`;
        };

        const renderEditor=()=>{
          if(!blocksEl)return;
          blocksEl.innerHTML=config.blocks.length?config.blocks.map(renderBlock).join(''):`<div class="red-carpet-empty">${esc(t('red_carpet.empty_builder'))}</div>`;
          updateCount();
        };
        const markdown=value=>{
          let html=esc(value||'');
          html=html.replace(/```([\s\S]*?)```/g,'<pre><code>$1</code></pre>');
          html=html.replace(/`([^`\n]+)`/g,'<code>$1</code>');
          html=html.replace(/\*\*([^*\n]+)\*\*/g,'<strong>$1</strong>');
          html=html.replace(/__([^_\n]+)__/g,'<u>$1</u>');
          html=html.replace(/~~([^~\n]+)~~/g,'<s>$1</s>');
          html=html.replace(/\|\|([^|\n]+)\|\|/g,'<span class="rc-v2-spoiler">$1</span>');
          html=html.replace(/\*([^*\n]+)\*/g,'<em>$1</em>');
          html=html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,'<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
          const lines=html.split('\n').map(line=>{
            if(line.startsWith('### '))return`<h4>${line.slice(4)}</h4>`;
            if(line.startsWith('## '))return`<h3>${line.slice(3)}</h3>`;
            if(line.startsWith('# '))return`<h2>${line.slice(2)}</h2>`;
            if(line.startsWith('-# '))return`<small>${line.slice(3)}</small>`;
            if(line.startsWith('&gt; '))return`<blockquote>${line.slice(5)}</blockquote>`;
            return line||'<br>';
          });
          return lines.join('<br>');
        };
        const renderPreview=()=>{
          if(!previewEl)return;
          const body=config.blocks.map(block=>{
            if(block.type==='text')return`<div class="rc-v2-text">${markdown(block.content)}</div>`;
            if(block.type==='media')return block.url?`<figure class="rc-v2-media ${block.spoiler?'is-spoiler':''}"><img src="${esc(block.url)}" alt="${esc(block.description||'')}"></figure>`:'';
            if(block.type==='separator')return`<div class="rc-v2-separator spacing-${Number(block.spacing)===2?'large':'small'} ${block.divider===false?'no-line':''}"><span></span></div>`;
            if(block.type==='buttons')return`<div class="rc-v2-buttons">${(block.buttons||[]).map(button=>button.label&&button.url?`<span class="rc-v2-button">${esc(button.emoji||'')} ${esc(button.label)} ↗</span>`:'').join('')}</div>`;
            if(block.type==='select')return`<div class="rc-v2-select"><span>${esc(block.placeholder||t('red_carpet.select_placeholder'))}</span><b>⌄</b></div>`;
            if(block.type==='section')return`<div class="rc-v2-section"><div class="rc-v2-text">${markdown(block.content)}</div>${block.thumbnail_url?`<img src="${esc(block.thumbnail_url)}" alt="${esc(block.thumbnail_description||'')}">`:''}</div>`;
            return'';
          }).join('');
          previewEl.classList.toggle('has-accent',Boolean(config.accent_enabled));
          previewEl.classList.toggle('is-spoiler',Boolean(config.spoiler));
          previewEl.style.setProperty('--rc-accent',config.accent_color||'#5865F2');
          previewEl.innerHTML=body||`<div class="red-carpet-empty-preview">${esc(t('red_carpet.empty_preview'))}</div>`;
          previewEl.querySelectorAll('img').forEach(img=>img.addEventListener('error',()=>img.closest('figure')?.classList.add('is-broken'),{once:true}));
        };
        const updateCount=()=>{
          const count=componentCount();
          if(countEl){countEl.textContent=`${count} / 40`;countEl.classList.toggle('over-limit',count>40);}
          renderPreview();
        };
        const syncTop=()=>{
          config.accent_enabled=Boolean(accentEnabledEl?.checked);
          config.accent_color=String(accentColorEl?.value||'#5865F2').toUpperCase();
          if(accentSwatchEl)accentSwatchEl.style.setProperty('--announcement-picked-color',config.accent_color);
          if(accentCodeEl)accentCodeEl.textContent=config.accent_color;
          config.spoiler=Boolean(spoilerEl?.checked);
          updateCount();
        };
        const updateInput=field=>{
          const index=Number(field.dataset.rcBlock);
          if(!Number.isInteger(index)||!config.blocks[index])return;
          const block=config.blocks[index];
          const key=field.dataset.rcField;
          if(!key)return;
          let target=block;
          if(field.dataset.rcButton!==undefined){const i=Number(field.dataset.rcButton);if(!block.buttons?.[i])return;target=block.buttons[i];}
          if(field.dataset.rcOption!==undefined){const i=Number(field.dataset.rcOption);if(!block.options?.[i])return;target=block.options[i];}
          target[key]=field.type==='checkbox'?field.checked:(key==='spacing'?Number(field.value):field.value);
          updateCount();
        };
        const requestJson=async(url,options={})=>{
          const response=await fetch(url,{credentials:'same-origin',...options});
          const body=await response.json().catch(()=>({}));
          if(!response.ok)throw new Error(body.detail||body.error||t('red_carpet.failed'));
          return body;
        };
        const waitAction=async actionId=>{
          for(let attempt=0;attempt<75;attempt++){
            await sleep(650);
            const action=await requestJson(`/api/actions/${encodeURIComponent(actionId)}`,{cache:'no-store'});
            if(action.status==='completed')return action;
            if(action.status==='failed')throw new Error(action.error_text||t('red_carpet.failed'));
          }
          throw new Error(t('red_carpet.queue_timeout'));
        };
        const payload=()=>({draft_id:Number(draftId||0),draft_name:String(draftNameEl?.value||'').trim(),channel_id:String(channelEl?.value||'0'),config:{version:1,accent_enabled:Boolean(config.accent_enabled),accent_color:String(config.accent_color||'#5865F2'),spoiler:Boolean(config.spoiler),blocks:config.blocks}});
        const setBusy=value=>{
          busy=Boolean(value);
          root.querySelectorAll('[data-rc-save],[data-rc-publish],[data-rc-delete],[data-rc-delete-draft]').forEach(button=>button.disabled=busy);
        };
        const uploadImage=async(input,index,kind)=>{
          const file=input.files?.[0];
          if(!file||!config.blocks[index])return;
          const data=new FormData();data.append('image',file,file.name);
          setStatus(t('red_carpet.uploading'));
          try{
            const result=await requestJson(`/api/guilds/${encodeURIComponent(guildId)}/red-carpet/media`,{method:'POST',body:data});
            if(kind==='thumbnail')config.blocks[index].thumbnail_url=result.url||'';else config.blocks[index].url=result.url||'';
            renderEditor();renderPreview();setStatus(t('red_carpet.uploaded'));
          }catch(error){setStatus(error.message||t('red_carpet.failed'),true);input.value='';}
        };

        const applyFormat=(target,type)=>{
          if(!target)return;
          const value=String(target.value||'');
          const start=Number.isInteger(target.selectionStart)?target.selectionStart:value.length;
          const end=Number.isInteger(target.selectionEnd)?target.selectionEnd:start;
          const selected=value.slice(start,end);
          let replacement=selected;
          const wrap=(left,right=left)=>{const content=selected||t('red_carpet.format_placeholder');replacement=left+content+right;};
          if(type==='bold')wrap('**');
          else if(type==='italic')wrap('*');
          else if(type==='underline')wrap('__');
          else if(type==='strike')wrap('~~');
          else if(type==='spoiler')wrap('||');
          else if(type==='code'){const content=selected||t('red_carpet.format_placeholder');replacement=content.includes('\n')?'```\n'+content+'\n```':'`'+content.replace(/`/g,'ˋ')+'`';}
          else if(type==='quote'){
            const lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1;
            let lineEnd=value.indexOf('\n',end);if(lineEnd<0)lineEnd=value.length;
            const block=value.slice(lineStart,lineEnd);
            const quoted=block.split('\n').map(line=>line.startsWith('> ')?line:'> '+line).join('\n');
            target.value=(value.slice(0,lineStart)+quoted+value.slice(lineEnd)).slice(0,Number(target.maxLength||4000));
            target.focus();try{target.setSelectionRange(lineStart,lineStart+quoted.length);}catch(_){}
            target.dispatchEvent(new Event('input',{bubbles:true}));return;
          }
          const next=(value.slice(0,start)+replacement+value.slice(end)).slice(0,Number(target.maxLength||4000));
          target.value=next;const pos=Math.min(start+replacement.length,next.length);
          target.focus();try{target.setSelectionRange(pos,pos);}catch(_){}
          target.dispatchEvent(new Event('input',{bubbles:true}));
        };

        accentEnabledEl?.addEventListener('change',syncTop);
        accentColorEl?.addEventListener('input',syncTop);
        spoilerEl?.addEventListener('change',syncTop);
        blocksEl?.addEventListener('input',event=>updateInput(event.target));
        blocksEl?.addEventListener('change',event=>{
          const field=event.target;
          if(field.matches('[data-rc-upload]')){uploadImage(field,Number(field.dataset.rcUpload),field.dataset.rcUploadKind||'media');return;}
          updateInput(field);
        });
        blocksEl?.addEventListener('dragstart',event=>{
          const handle=event.target.closest('[data-rc-drag]');if(!handle)return;
          dragIndex=Number(handle.dataset.rcDrag);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',String(dragIndex));
          handle.closest('.red-carpet-block')?.classList.add('dragging');
        });
        blocksEl?.addEventListener('dragend',event=>{event.target.closest('.red-carpet-block')?.classList.remove('dragging');root.querySelectorAll('.red-carpet-block').forEach(card=>card.classList.remove('drag-over'));dragIndex=-1;});
        blocksEl?.addEventListener('dragover',event=>{const card=event.target.closest('[data-rc-card]');if(!card||dragIndex<0)return;event.preventDefault();root.querySelectorAll('.red-carpet-block').forEach(node=>node.classList.remove('drag-over'));card.classList.add('drag-over');});
        blocksEl?.addEventListener('drop',event=>{const card=event.target.closest('[data-rc-card]');if(!card||dragIndex<0)return;event.preventDefault();const target=Number(card.dataset.rcCard);if(!Number.isInteger(target)||target===dragIndex)return;const [item]=config.blocks.splice(dragIndex,1);config.blocks.splice(target,0,item);dragIndex=-1;renderEditor();});

        root.addEventListener('click',async event=>{
          const format=event.target.closest('[data-rc-format]');
          if(format){const index=Number(format.dataset.rcIndex);const target=blocksEl?.querySelector(`textarea[data-rc-block="${index}"][data-rc-field="content"]`);applyFormat(target,format.dataset.rcFormat||'');return;}
          const deleteDraft=event.target.closest('[data-rc-delete-draft]');
          if(deleteDraft&&!busy){
            const targetId=Number(deleteDraft.dataset.rcDeleteDraft||0);
            const name=String(deleteDraft.dataset.rcDeleteDraftName||'');
            if(!targetId||!window.confirm(`${t('red_carpet.delete_draft_confirm')}${name?'\n\n'+name:''}`))return;
            setBusy(true);setStatus(t('red_carpet.deleting_draft'));
            try{await requestJson(`/api/guilds/${encodeURIComponent(guildId)}/red-carpet/drafts/${encodeURIComponent(targetId)}`,{method:'DELETE'});setStatus(t('red_carpet.draft_deleted'));setTimeout(()=>{location.href=`/guild/${encodeURIComponent(guildId)}/red-carpet?new=1`;},300);}catch(error){setStatus(error.message||t('red_carpet.failed'),true);setBusy(false);}return;
          }
          const add=event.target.closest('[data-rc-add]');
          if(add){config.blocks.push(defaultBlock(add.dataset.rcAdd));renderEditor();setStatus('');return;}
          const remove=event.target.closest('[data-rc-remove]');
          if(remove){config.blocks.splice(Number(remove.dataset.rcRemove),1);renderEditor();return;}
          const move=event.target.closest('[data-rc-move]');
          if(move){const from=Number(move.dataset.index);const to=move.dataset.rcMove==='up'?from-1:from+1;if(to>=0&&to<config.blocks.length){[config.blocks[from],config.blocks[to]]=[config.blocks[to],config.blocks[from]];renderEditor();}return;}
          const addButton=event.target.closest('[data-rc-add-button]');
          if(addButton){const block=config.blocks[Number(addButton.dataset.rcAddButton)];if(block&&block.type==='buttons'&&(block.buttons||[]).length<5){block.buttons.push({label:t('red_carpet.button_label_default'),url:'https://arxbot.dev',emoji:''});renderEditor();}return;}
          const removeButton=event.target.closest('[data-rc-remove-button]');
          if(removeButton){const [bi,ii]=removeButton.dataset.rcRemoveButton.split(':').map(Number);config.blocks[bi]?.buttons?.splice(ii,1);renderEditor();return;}
          const addOption=event.target.closest('[data-rc-add-option]');
          if(addOption){const block=config.blocks[Number(addOption.dataset.rcAddOption)];if(block&&block.type==='select'&&(block.options||[]).length<25){block.options.push({label:t('red_carpet.option_label_default'),description:'',emoji:'',response:t('red_carpet.option_response_default')});renderEditor();}return;}
          const removeOption=event.target.closest('[data-rc-remove-option]');
          if(removeOption){const [bi,ii]=removeOption.dataset.rcRemoveOption.split(':').map(Number);config.blocks[bi]?.options?.splice(ii,1);renderEditor();return;}
          const save=event.target.closest('[data-rc-save]');
          if(save&&!busy){setBusy(true);setStatus(t('red_carpet.saving'));try{const result=await requestJson(`/api/guilds/${encodeURIComponent(guildId)}/red-carpet/save`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});draftId=Number(result.draft_id||draftId||0);root.dataset.draftId=String(draftId);setStatus(t('red_carpet.saved'));if(countEl)countEl.textContent=`${result.component_count??componentCount()} / 40`;setTimeout(()=>{location.href=`/guild/${encodeURIComponent(guildId)}/red-carpet?draft_id=${encodeURIComponent(draftId)}`;},300);}catch(error){setStatus(error.message||t('red_carpet.failed'),true);setBusy(false);}return;}
          const publish=event.target.closest('[data-rc-publish]');
          if(publish&&!busy){setBusy(true);setStatus(t('red_carpet.publishing'));try{const queued=await requestJson(`/api/guilds/${encodeURIComponent(guildId)}/red-carpet/publish`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload())});draftId=Number(queued.draft_id||draftId||0);root.dataset.draftId=String(draftId);const action=await waitAction(queued.action_id);let details={};try{details=JSON.parse(action.result_json||'{}');}catch(_){}setStatus(t('red_carpet.published'));if(metaEl&&details.message_id)metaEl.textContent=`${t('red_carpet.message_id')}: ${details.message_id}`;setTimeout(()=>{location.href=`/guild/${encodeURIComponent(guildId)}/red-carpet?draft_id=${encodeURIComponent(draftId)}`;},550);}catch(error){setStatus(error.message||t('red_carpet.failed'),true);setBusy(false);}return;}
          const del=event.target.closest('[data-rc-delete]');
          if(del&&!busy){if(!window.confirm(t('red_carpet.delete_confirm')))return;setBusy(true);setStatus(t('red_carpet.deleting'));try{const queued=await requestJson(`/api/guilds/${encodeURIComponent(guildId)}/red-carpet/delete`,{method:'POST'});await waitAction(queued.action_id);setStatus(t('red_carpet.deleted'));setTimeout(()=>location.reload(),450);}catch(error){setStatus(error.message||t('red_carpet.failed'),true);setBusy(false);}return;}
        });

        syncTop();
        renderEditor();
      })();

      (()=>{
        const nativeEmojiGrid=document.querySelector('[data-role-native-emojis]');
        const emojiDialog=document.getElementById('rolePanelEmojiDialog');
        const emojiInput=document.getElementById('rolePanelEmojiValue');
        let activeEmojiInput=emojiInput;
        let activeEmojiInsert=false;
        const emojiSearch=emojiDialog?.querySelector('.role-emoji-search');
        const customEmojiMatch=value=>String(value||'').trim().match(/^<(a?):([^:>]+):(\d+)>$/);
        const customEmojiImage=value=>{
          const match=customEmojiMatch(value);
          if(!match)return '';
          return `https://cdn.discordapp.com/emojis/${match[3]}.${match[1]?'gif':'png'}?size=64&quality=lossless`;
        };
        const renderRoleEmojiField=input=>{
          if(!input)return;
          const field=input.closest('.role-emoji-field');
          if(!field)return;
          let preview=field.querySelector('.role-emoji-selected-preview');
          const match=customEmojiMatch(input.value);
          if(!match){
            field.classList.remove('has-custom-emoji-preview');
            if(preview)preview.remove();
            return;
          }
          if(!preview){
            preview=document.createElement('span');
            preview.className='role-emoji-selected-preview';
            input.insertAdjacentElement('afterend',preview);
          }
          preview.innerHTML=`<img src="${customEmojiImage(input.value)}" alt=""><b>:${match[2]}:</b>`;
          field.classList.add('has-custom-emoji-preview');
        };
        const renderRoleEmojiNodes=()=>{
          document.querySelectorAll('[data-role-render-emoji]').forEach(node=>{
            const value=node.getAttribute('data-role-render-emoji')||'';
            const match=customEmojiMatch(value);
            if(!match){node.textContent=value;return;}
            node.innerHTML=`<img class="role-inline-custom-emoji" src="${customEmojiImage(value)}" alt=":${match[2]}:">`;
          });
        };
        document.querySelectorAll('.role-emoji-field input[name="emoji"]').forEach(input=>{
          renderRoleEmojiField(input);
          input.addEventListener('input',()=>renderRoleEmojiField(input));
        });
        renderRoleEmojiNodes();
        const nativeEmojis=[
          ['😀',t("app.smile")],['😂',t('emoji.joy')],['🤣',t('emoji.laughing')],['😊',t('emoji.smiling')],['😍',t("app.heart_eyes_2")],['🥰',t('emoji.love')],['😎',t('emoji.sunglasses')],['🤔',t("app.thinking")],['😅',t('emoji.sweat')],['😭',t("app.crying")],
          ['❤️',t('emoji.red_heart')],['💛',t("app.yellow_heart_2")],['💙',t("app.blue_heart")],['💜',t("app.purple_heart")],['🔥',t("app.fire")],['✨',t("app.sparkles")],['⭐',t("app.star")],['✅',t('emoji.check')],['❌',t("app.cross_mark")],['⚠️',t("app.warning")],
          ['👍',t("app.thumbs_up_2")],['👎',t("app.thumbs_down_2")],['🎉',t('emoji.confetti')],['🎮',t('emoji.game')],['🛡️',t('emoji.shield')],['⚔️',t("app.sword")],['🔒',t('emoji.locked')],['🔓',t("app.unlocked_padlock")],['👑',t("app.crown")],['💎',t('emoji.diamond')],
          ['🇹🇷',t("app.turkey")],['🇬🇧',t('emoji.uk')],['🇺🇸',t('emoji.us')],['🇩🇪',t('emoji.germany')],['🇫🇷',t('emoji.france')],['🇪🇸',t('emoji.spain')],['🇮🇹',t('emoji.italy')],['🇵🇱',t('emoji.poland')],['🇷🇴',t('emoji.romania')],['🇰🇷',t('emoji.korea')]
        ];
        const selectEmoji=value=>{
          if(activeEmojiInput){
            const emoji=String(value||'');
            if(activeEmojiInsert){
              const current=String(activeEmojiInput.value||'');
              const start=Number.isInteger(activeEmojiInput.selectionStart)?activeEmojiInput.selectionStart:current.length;
              const end=Number.isInteger(activeEmojiInput.selectionEnd)?activeEmojiInput.selectionEnd:start;
              const maxLength=Number(activeEmojiInput.maxLength||0);
              let next=current.slice(0,start)+emoji+current.slice(end);
              if(maxLength>0)next=next.slice(0,maxLength);
              activeEmojiInput.value=next;
              const cursor=Math.min(start+emoji.length,next.length);
              try{activeEmojiInput.setSelectionRange(cursor,cursor);}catch(_){}
              activeEmojiInput.dispatchEvent(new Event('input',{bubbles:true}));
              activeEmojiInput.focus();
            }else{
              activeEmojiInput.value=emoji;
              activeEmojiInput.dispatchEvent(new Event('input',{bubbles:true}));
            }
            renderRoleEmojiField(activeEmojiInput);
          }
          emojiDialog?.close();
          try{document.activeElement?.blur?.();}catch(_){}
        };
        if(nativeEmojiGrid){
          nativeEmojis.forEach(([value,name])=>{
            const button=document.createElement('button');button.type='button';button.className='role-emoji-option';button.dataset.roleEmoji=value;button.dataset.roleEmojiName=name;
            const glyph=document.createElement('span');glyph.className='role-native-emoji';glyph.textContent=value;
            const label=document.createElement('small');label.textContent=name;button.append(glyph,label);nativeEmojiGrid.append(button);
          });
        }
        emojiDialog?.addEventListener('click',event=>{const button=event.target.closest('[data-role-emoji]');if(button)selectEmoji(button.dataset.roleEmoji||'');});
        document.querySelectorAll('[data-role-emoji-open]').forEach(button=>button.addEventListener('click',()=>{const target=button.dataset.roleEmojiTarget||'';activeEmojiInput=target?document.getElementById(target):emojiInput;activeEmojiInsert=button.dataset.roleEmojiInsert==='1';emojiDialog?.showModal();}));
        document.querySelector('[data-role-emoji-close]')?.addEventListener('click',()=>emojiDialog?.close());
        emojiSearch?.addEventListener('input',()=>{
          const q=(emojiSearch.value||'').trim().toLocaleLowerCase(currentUiLanguage);
          emojiDialog?.querySelectorAll('.role-emoji-option').forEach(button=>{
            const hay=`${button.dataset.roleEmojiName||''} ${button.dataset.roleEmoji||''}`.toLocaleLowerCase(currentUiLanguage);
            button.hidden=Boolean(q&&!hay.includes(q));
          });
        });
      
        const nativeColor=document.querySelector('.role-color-native');
        const hexColor=document.querySelector('.role-color-hex');
        const setColor=value=>{
          const clean=String(value||'').replace('#','').toUpperCase();
          if(!/^[0-9A-F]{6}$/.test(clean))return;
          if(hexColor)hexColor.value=clean;if(nativeColor)nativeColor.value=`#${clean}`;
        };
        nativeColor?.addEventListener('input',()=>setColor(nativeColor.value));
        hexColor?.addEventListener('input',()=>setColor(hexColor.value));
        document.querySelectorAll('[data-role-color]').forEach(button=>button.addEventListener('click',()=>setColor(button.dataset.roleColor)));
      
        document.querySelectorAll('[data-role-button-edit-toggle]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.roleButtonEditToggle||'';const form=document.getElementById(`roleButtonEdit${id}`);if(form)form.hidden=!form.hidden;}));
        document.querySelectorAll('[data-role-button-edit-cancel]').forEach(button=>button.addEventListener('click',()=>{const id=button.dataset.roleButtonEditCancel||'';const form=document.getElementById(`roleButtonEdit${id}`);if(form)form.hidden=true;}));
      
        document.querySelectorAll('[data-role-image-editor]').forEach(editor=>{
          const input=editor.querySelector('input[type="file"]');const preview=editor.querySelector('.role-image-preview');let objectUrl='';
          input?.addEventListener('change',()=>{
            const file=input.files?.[0];if(!file||!preview)return;
            if(objectUrl)URL.revokeObjectURL(objectUrl);objectUrl=URL.createObjectURL(file);
            preview.innerHTML='';const img=document.createElement('img');img.src=objectUrl;img.alt=t("module.panel_thumbnail");preview.append(img);
          });
        });
      })();
      
      // ARX V300 announcement studio — normal/embed preview, flexible recurrence and reminder flow.
      function arxInitAnnouncementScheduler(){
        const form=document.getElementById('announcementCreateForm');
        if(!form)return;
        const main=document.getElementById('announcementRunAt');
        const timezoneInput=document.getElementById('announcementTimezone');
        const master=document.getElementById('announcementRemindersEnabled');
        const error=document.getElementById('announcementReminderError');
        const timeline=document.getElementById('announcementSchedulePreview');
        const summary=document.getElementById('announcementReminderSummary');
        const lead=document.getElementById('reminderLeadHours');
        const interval=document.getElementById('reminderIntervalMinutes');
        const repeat=document.getElementById('announcementRepeatMode');
        const weekly=document.getElementById('announcementWeeklyField');
        const monthly=document.getElementById('announcementMonthlyField');
        const monthlyHint=monthly?.querySelector('[data-announcement-monthly-hint]');
        const weekdaySelect=form.querySelector('select[name="repeat_weekday"]');
        const monthCards=[...form.querySelectorAll('[data-announcement-month-card]')];
        const monthCount=form.querySelector('[data-announcement-month-count]');
        const channelSelect=form.querySelector('select[name="channel_id"]');
        const titleInput=document.getElementById('announcementMessageTitle');
        const messageInput=document.getElementById('announcementMessageBody');
        const modeInputs=[...form.querySelectorAll('input[name="message_mode"]')];
        const embedSettings=form.querySelector('[data-announcement-embed-settings]');
        const normalMediaSection=form.querySelector('[data-announcement-normal-media]');
        const normalMediaMeta=document.querySelector('[data-announcement-normal-media-meta]');
        const embedAuthor=form.querySelector('input[name="embed_author"]');
        const embedTitle=form.querySelector('input[name="embed_title"]');
        const embedColor=form.querySelector('input[name="embed_color"]');
        const embedFooter=form.querySelector('input[name="embed_footer"]');
        const embedFooterIcon=form.querySelector('[data-announcement-footer-icon]');
        const colorCode=form.querySelector('[data-announcement-color-code]');
        const colorSwatch=form.querySelector('[data-announcement-color-swatch]');
        const normalPreview=document.getElementById('announcementNormalPreview');
        const embedPreview=document.getElementById('announcementEmbedPreview');
        const previewMessageTitle=document.querySelector('[data-announcement-preview-message-title]');
        const previewMessage=document.querySelector('[data-announcement-preview-message]');
        const previewEmbedMessageTitle=document.querySelector('[data-announcement-preview-embed-message-title]');
        const previewEmbedMessage=document.querySelector('[data-announcement-preview-embed-message]');
        const previewEmbedTitle=document.querySelector('[data-announcement-preview-title]');
        const previewEmbedAuthor=document.querySelector('[data-announcement-preview-author]');
        const previewEmbedFooter=document.querySelector('[data-announcement-preview-footer]');
        const previewEmbedFooterWrap=document.querySelector('[data-announcement-preview-footer-wrap]');
        const previewEmbedFooterIcon=document.querySelector('[data-announcement-preview-footer-icon]');
        const previewEmbed=document.querySelector('[data-announcement-preview-embed]');
        const previewChannel=document.querySelector('[data-announcement-preview-channel]');
        const previewImageCount=document.getElementById('announcementPreviewImageCount');
        const previewMedia=document.getElementById('announcementPreviewMedia');
        const imageCount=document.getElementById('announcementImageCount');
        const sectionList=document.getElementById('announcementSectionList');
        const sectionTemplate=document.getElementById('announcementSectionTemplate');
        const addSectionButton=document.getElementById('announcementAddSection');
        const previewSections=document.getElementById('announcementPreviewSections');
        const thumbInput=document.getElementById('announcementThumbnailInput');
        const heroInput=document.getElementById('announcementHeroInput');
        const thumbCardPreview=document.getElementById('announcementThumbPreview');
        const heroCardPreview=document.getElementById('announcementHeroPreview');
        const previewThumb=document.getElementById('announcementPreviewThumb');
        const previewHero=document.getElementById('announcementPreviewHero');
        let previewObjectUrl='';
        let thumbObjectUrl='';
        let heroObjectUrl='';

        const esc=(value)=>String(value??'').replace(/[&<>'"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[ch]));
        const selectedMode=()=>modeInputs.find(input=>input.checked)?.value||'normal';
        const safeUrl=value=>{const raw=String(value||'').trim();return /^https?:\/\//i.test(raw)?raw:'';};
        const detectTimezone=()=>{try{return Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';}catch(_){return 'UTC';}};
        if(timezoneInput&&!timezoneInput.value)timezoneInput.value=detectTimezone();
        const wallDate=()=>{
          const raw=String(main?.value||'');
          const m=raw.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
          if(!m)return null;
          return new Date(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]),Number(m[4]),Number(m[5]),0,0));
        };
        const formatWall=date=>{
          if(!(date instanceof Date)||Number.isNaN(date.getTime()))return '—';
          let label='—';
          try{label=new Intl.DateTimeFormat(currentUiLanguage,{timeZone:'UTC',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(date);}catch(_){label=date.toISOString().slice(0,16).replace('T',' ');}
          const zone=String(timezoneInput?.value||'UTC').trim()||'UTC';
          return label+' · '+zone;
        };
        const daysInMonth=(year,monthIndex)=>new Date(Date.UTC(year,monthIndex+1,0)).getUTCDate();
        const inlineMarkdown=raw=>{
          let safe=esc(raw);
          const tokens=[];
          safe=safe.replace(/`([^`\n]+)`/g,(_m,body)=>{const token='@@ARXCODE'+tokens.length+'@@';tokens.push('<code class="announcement-md-inline-code">'+body+'</code>');return token;});
          safe=safe.replace(/\|\|(.+?)\|\|/g,'<span class="announcement-md-spoiler">$1</span>');
          safe=safe.replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>');
          safe=safe.replace(/__(.+?)__/g,'<u>$1</u>');
          safe=safe.replace(/~~(.+?)~~/g,'<s>$1</s>');
          safe=safe.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g,'<em>$1</em>');
          tokens.forEach((html,index)=>{safe=safe.replace('@@ARXCODE'+index+'@@',html);});
          return safe;
        };
        const renderDiscordText=value=>{
          const rows=String(value??'').split('\n');let inBlock=false;const out=[];
          rows.forEach(rawLine=>{
            if(rawLine.trim().startsWith('```')){inBlock=!inBlock;out.push(inBlock?'<div class="announcement-md-codeblock">':'</div>');return;}
            if(inBlock){out.push('<div>'+esc(rawLine||' ')+'</div>');return;}
            if(/^>\s?/.test(rawLine))out.push('<div class="announcement-md-quote">'+inlineMarkdown(rawLine.replace(/^>\s?/,''))+'</div>');
            else if(rawLine==='')out.push('<div class="announcement-md-blank">&nbsp;</div>');
            else out.push('<div>'+inlineMarkdown(rawLine)+'</div>');
          });
          if(inBlock)out.push('</div>');return out.join('');
        };
        const setPreviewText=(node,value,hideEmpty=false)=>{if(!node)return;const raw=String(value||'');node.innerHTML=renderDiscordText(raw);if(hideEmpty)node.hidden=!raw.trim();};

        const applyFormat=(target,type)=>{
          if(!target)return;
          const value=String(target.value||'');
          const start=Number.isInteger(target.selectionStart)?target.selectionStart:value.length;
          const end=Number.isInteger(target.selectionEnd)?target.selectionEnd:start;
          const selected=value.slice(start,end);
          let replacement=selected;
          const wrap=(left,right=left)=>{const content=selected||t('announcement.format_placeholder');replacement=left+content+right;};
          if(type==='bold')wrap('**');
          else if(type==='italic')wrap('*');
          else if(type==='underline')wrap('__');
          else if(type==='strike')wrap('~~');
          else if(type==='spoiler')wrap('||');
          else if(type==='code'){const content=selected||t('announcement.format_placeholder');replacement=content.includes('\n')?'```\n'+content+'\n```':'`'+content.replace(/`/g,'ˋ')+'`';}
          else if(type==='quote'){
            const lineStart=value.lastIndexOf('\n',Math.max(0,start-1))+1;
            let lineEnd=value.indexOf('\n',end);if(lineEnd<0)lineEnd=value.length;
            const block=value.slice(lineStart,lineEnd);
            const quoted=block.split('\n').map(line=>line.startsWith('> ')?line:'> '+line).join('\n');
            target.value=(value.slice(0,lineStart)+quoted+value.slice(lineEnd)).slice(0,Number(target.maxLength||999999));
            target.focus();try{target.setSelectionRange(lineStart,lineStart+quoted.length);}catch(_){}
            target.dispatchEvent(new Event('input',{bubbles:true}));return;
          }
          const next=(value.slice(0,start)+replacement+value.slice(end)).slice(0,Number(target.maxLength||999999));
          target.value=next;const pos=Math.min(start+replacement.length,next.length);
          target.focus();try{target.setSelectionRange(pos,pos);}catch(_){}
          target.dispatchEvent(new Event('input',{bubbles:true}));
        };
        form.querySelectorAll('[data-format-toolbar]').forEach(toolbar=>toolbar.addEventListener('click',event=>{
          const button=event.target.closest('[data-format]');if(!button)return;
          applyFormat(document.getElementById(toolbar.dataset.target||''),button.dataset.format||'');
        }));

        const sectionRows=()=>sectionList?[...sectionList.querySelectorAll('[data-announcement-section]')]:[];
        const renderSections=()=>{
          if(!previewSections)return;const blocks=[];
          sectionRows().forEach((row,index)=>{
            const title=String(row.querySelector('[name="embed_section_title"]')?.value||'').trim();
            const titleUrl=safeUrl(row.querySelector('[name="embed_section_title_link"]')?.value);
            const body=String(row.querySelector('[name="embed_section_subtitle"]')?.value||'').trim();
            const bodyUrl=safeUrl(row.querySelector('[name="embed_section_subtitle_link"]')?.value);
            if(!title&&!body)return;
            const titleHtml=titleUrl&&title?'<a href="'+esc(titleUrl)+'" target="_blank" rel="noreferrer">'+inlineMarkdown(title)+'</a>':inlineMarkdown(title||t('announcement.section_title')+' '+(index+1));
            const bodyHtml=bodyUrl&&body?'<a href="'+esc(bodyUrl)+'" target="_blank" rel="noreferrer">'+inlineMarkdown(body)+'</a>':inlineMarkdown(body||'\u200b');
            blocks.push('<div class="announcement-preview-field"><strong>'+titleHtml+'</strong><p>'+bodyHtml+'</p></div>');
          });
          previewSections.innerHTML=blocks.join('');previewSections.hidden=!blocks.length;
        };
        const bindSection=row=>{
          row.querySelector('[data-remove-announcement-section]')?.addEventListener('click',()=>{row.remove();renderSections();});
          row.querySelectorAll('input').forEach(input=>input.addEventListener('input',renderSections));
        };
        addSectionButton?.addEventListener('click',()=>{
          if(!sectionTemplate||sectionRows().length>=8)return;
          sectionList.appendChild(sectionTemplate.content.cloneNode(true));
          bindSection(sectionList.lastElementChild);renderSections();
        });

        const bindEmbedMedia=(input,card,target,kind)=>{
          if(!input)return;
          input.addEventListener('change',()=>{
            const file=input.files?.[0];const current=kind==='thumb'?thumbObjectUrl:heroObjectUrl;
            if(current)URL.revokeObjectURL(current);
            if(!file){if(card)card.innerHTML='ARX';if(target){target.hidden=true;target.replaceChildren();}if(kind==='thumb')thumbObjectUrl='';else heroObjectUrl='';return;}
            const url=URL.createObjectURL(file);if(kind==='thumb')thumbObjectUrl=url;else heroObjectUrl=url;
            if(card)card.innerHTML='<img src="'+url+'" alt="">';
            if(target){target.hidden=false;target.innerHTML='<img src="'+url+'" alt="">';}
          });
        };
        bindEmbedMedia(thumbInput,thumbCardPreview,previewThumb,'thumb');
        bindEmbedMedia(heroInput,heroCardPreview,previewHero,'hero');

        const monthRows=()=>monthCards.map(card=>({
          card,
          month:Number(card.dataset.month||0),
          enabled:card.querySelector('[data-announcement-month-enabled]'),
          day:card.querySelector('[data-announcement-month-day]'),
          maxLabel:card.querySelector('[data-announcement-month-max]')
        })).filter(row=>row.month>=1&&row.month<=12);
        const monthTargetYear=(month)=>{
          const base=wallDate()||new Date();
          const baseYear=base.getUTCFullYear();
          const baseMonth=base.getUTCMonth()+1;
          return baseYear+(month<=baseMonth?1:0);
        };
        const syncMonthlyConstraints=()=>{
          const monthlyActive=(repeat?.value||'once')==='monthly';
          let enabledCount=0;
          monthRows().forEach(row=>{
            const maximum=daysInMonth(monthTargetYear(row.month),row.month-1);
            if(row.maxLabel)row.maxLabel.textContent=String(maximum);
            if(row.day){
              row.day.max=String(maximum);
              const numeric=Number(row.day.value||0);
              if(row.day.value!==''&&numeric>maximum)row.day.value=String(maximum);
              if(row.day.value!==''&&numeric<1)row.day.value='1';
            }
            if(row.enabled)row.enabled.disabled=!monthlyActive;
            const enabled=monthlyActive&&!!row.enabled?.checked;
            if(row.day){row.day.disabled=!enabled;row.day.required=enabled;}
            row.card.classList.toggle('active',enabled);
            row.card.classList.toggle('is-disabled',!monthlyActive);
            if(enabled)enabledCount+=1;
          });
          if(monthCount)monthCount.textContent=String(enabledCount);
          if(monthlyHint)monthlyHint.textContent=t('announcement.monthly_flexible_help');
        };
        const activeMonthlyRows=()=>monthRows().filter(row=>row.enabled?.checked);
        document.querySelectorAll('[data-open-datetime-picker]').forEach(button=>button.addEventListener('click',()=>{
          const input=document.getElementById(button.dataset.openDatetimePicker||'');
          if(!input)return;
          try{ if(typeof input.showPicker==='function') input.showPicker(); else input.focus(); }catch(_){ input.focus(); }
        }));

        const reminderOffsets=()=>{
          if(!master?.checked)return [];
          const hours=Math.max(.1,Math.min(168,Number(lead?.value||1)));
          const step=Math.max(1,Math.min(1440,Number(interval?.value||5)));
          const leadMinutes=Math.max(1,Math.round(hours*60));
          const values=[];
          for(let value=leadMinutes;value>0&&values.length<50;value-=step)values.push(value);
          return values;
        };

        const recurrenceSummary=()=>{
          const mode=repeat?.value||'once';
          if(mode==='daily')return t('module.every_day');
          if(mode==='weekly'){const label=weekdaySelect?.selectedOptions?.[0]?.textContent?.trim()||'';return t('module.every_week_on_value0',{value0:label});}
          if(mode==='monthly'){
            const selected=activeMonthlyRows().map(row=>{
              const label=row.card.querySelector('.announcement-month-name')?.textContent?.trim()||String(row.month);
              return label+' '+(row.day?.value||'—');
            });
            return selected.length?selected.join(' · '):t('announcement.monthly_select_at_least_one');
          }
          return t('module.once');
        };

        function syncRecurrence(){
          const mode=repeat?.value||'once';const weeklyActive=mode==='weekly';const monthlyActive=mode==='monthly';
          if(weekly)weekly.hidden=!weeklyActive;
          if(monthly)monthly.hidden=!monthlyActive;
          if(weekdaySelect){weekdaySelect.disabled=!weeklyActive;weekdaySelect.required=weeklyActive;}
          syncMonthlyConstraints();
        }

        function syncAnchorDefaults(){
          const md=wallDate();if(!md)return;
          if(weekdaySelect)weekdaySelect.value=String((md.getUTCDay()+6)%7);
          syncMonthlyConstraints();
        }

        function syncReminderState(){
          const enabled=!!master?.checked;
          if(lead)lead.disabled=!enabled;
          if(interval)interval.disabled=!enabled;
          master?.closest('.announcement-reminders')?.classList.toggle('is-disabled',!enabled);
        }

        function syncMessageMode(){
          const embed=selectedMode()==='embed';
          if(embedSettings)embedSettings.hidden=!embed;
          if(normalMediaSection)normalMediaSection.hidden=embed;
          if(normalMediaMeta)normalMediaMeta.hidden=embed;
          if(normalPreview)normalPreview.hidden=embed;
          if(embedPreview)embedPreview.hidden=!embed;
          if(previewMedia&&embed)previewMedia.hidden=true;
          modeInputs.forEach(input=>input.closest('label')?.classList.toggle('active',input.checked));
        }

        function syncDiscordPreview(){
          syncMessageMode();
          const title=String(titleInput?.value||'');
          const message=String(messageInput?.value||'');
          setPreviewText(previewMessageTitle,title,true);
          setPreviewText(previewMessage,message);
          setPreviewText(previewEmbedMessageTitle,title,true);
          setPreviewText(previewEmbedMessage,message);
          if(previewEmbedTitle)previewEmbedTitle.innerHTML=inlineMarkdown(embedTitle?.value?.trim()||t('module.announcement_and_event_calendar'));
          if(previewEmbedAuthor){previewEmbedAuthor.textContent=embedAuthor?.value?.trim()||'';previewEmbedAuthor.hidden=!previewEmbedAuthor.textContent;}
          if(previewEmbedFooter){previewEmbedFooter.textContent=embedFooter?.value?.trim()||'';}
          if(previewEmbedFooterIcon){const u=String(embedFooterIcon?.value||'').trim();previewEmbedFooterIcon.src=/^https?:\/\//i.test(u)?u:'';previewEmbedFooterIcon.hidden=!previewEmbedFooterIcon.src||!String(previewEmbedFooter?.textContent||'').trim();}
          if(previewEmbedFooterWrap)previewEmbedFooterWrap.hidden=!String(previewEmbedFooter?.textContent||'').trim();
          const color=/^#[0-9a-f]{6}$/i.test(embedColor?.value||'')?embedColor.value.toUpperCase():'#5865F2';
          if(previewEmbed)previewEmbed.style.setProperty('--announcement-embed-color',color);
          if(colorCode)colorCode.textContent=color;
          if(colorSwatch)colorSwatch.style.setProperty('--announcement-picked-color',color);
          const channelLabel=channelSelect?.selectedOptions?.[0]?.textContent?.trim()?.replace(/^#\s*/,'')||'—';
          if(previewChannel)previewChannel.textContent=channelSelect?.value?channelLabel:'—';
          renderSections();
        }

        function renderTimeline(){
          syncRecurrence();
          syncReminderState();
          const md=wallDate();
          const offsets=reminderOffsets();
          let invalid='';
          if((repeat?.value||'once')==='monthly'){
            const selected=activeMonthlyRows();
            if(!selected.length)invalid=t('announcement.monthly_select_at_least_one');
            if(!invalid){
              for(const row of selected){
                const maximum=Number(row.day?.max||31);
                const day=Number(row.day?.value||0);
                if(day<1||day>maximum){
                  const label=row.card.querySelector('.announcement-month-name')?.textContent?.trim()||String(row.month);
                  invalid=t('announcement.monthly_invalid_day',{value0:label,value1:maximum});
                  break;
                }
              }
            }
          }
          if(!invalid&&master?.checked&&!offsets.length)invalid=t('server.select_at_least_one_active_reminder_when_reminders_are_enabled');
          if(error){error.textContent=invalid;error.hidden=!invalid;}
          if(summary){
            if(!master?.checked) summary.textContent=t('module.reminders_are_disabled');
            else {
              const hours=Number(lead?.value||1);
              const step=Math.max(1,Number(interval?.value||5));
              summary.textContent=t('module.reminder_summary_value0_hours_value1_minutes_value2_times',{value0:hours,value1:step,value2:offsets.length});
            }
          }
          if(timeline){
            timeline.innerHTML='';
            if(md&&master?.checked){
              offsets.slice().reverse().forEach((mins,index)=>{
                const d=new Date(md.getTime()-mins*60000);
                const el=document.createElement('div');el.className='announcement-preview-event reminder';
                el.innerHTML=`<b>${esc(formatWall(d))}</b><span>${ARXI18n.html('app.reminder_value0',{value0:index+1})}</span>`;
                timeline.appendChild(el);
              });
            }
            if(md){
              const el=document.createElement('div');el.className='announcement-preview-event main';
              el.innerHTML=`<b>${esc(formatWall(md))}</b><span>${ARXI18n.html('app.main_announcement')} · ${esc(recurrenceSummary())}</span>`;
              timeline.appendChild(el);
            }
            if(!md)timeline.innerHTML=`<div class="empty compact">${ARXI18n.html('module.select_the_main_announcement_time_and_reminders')}</div>`;
          }
          return !invalid;
        }

        const fileInputs=()=>[...form.querySelectorAll('.announcement-image-slot input[type=file]')];
        function syncMediaPreview(){
          const files=fileInputs().map(input=>input.files?.[0]).filter(Boolean);
          const count=files.length;
          if(imageCount)imageCount.textContent=String(count);
          if(previewImageCount)previewImageCount.textContent=String(count);
          if(previewObjectUrl){URL.revokeObjectURL(previewObjectUrl);previewObjectUrl='';}
          if(!previewMedia)return;
          if(selectedMode()==='embed'||!files.length){
            previewMedia.hidden=true;
            previewMedia.replaceChildren();
            return;
          }
          previewObjectUrl=URL.createObjectURL(files[0]);
          previewMedia.hidden=false;
          previewMedia.innerHTML=`<img src="${previewObjectUrl}" alt=""><span>+${Math.max(0,count-1)}</span>`;
        }

        main?.addEventListener('change',()=>{syncAnchorDefaults();renderTimeline();});
        main?.addEventListener('input',()=>{syncAnchorDefaults();renderTimeline();});
        timezoneInput?.addEventListener('input',renderTimeline);
        timezoneInput?.addEventListener('change',renderTimeline);
        repeat?.addEventListener('change',()=>{syncRecurrence();renderTimeline();});
        weekdaySelect?.addEventListener('change',renderTimeline);
        monthRows().forEach(row=>{
          row.enabled?.addEventListener('change',()=>{syncMonthlyConstraints();renderTimeline();});
          row.day?.addEventListener('input',()=>{
            const maximum=Number(row.day?.max||31);
            const value=Number(row.day?.value||0);
            if(row.day&&row.day.value!==''&&value>maximum)row.day.value=String(maximum);
            if(row.day&&row.day.value!==''&&value<1)row.day.value='1';
            renderTimeline();
          });
          row.day?.addEventListener('change',renderTimeline);
        });
        master?.addEventListener('change',renderTimeline);
        lead?.addEventListener('input',renderTimeline);
        interval?.addEventListener('input',renderTimeline);
        channelSelect?.addEventListener('change',syncDiscordPreview);
        titleInput?.addEventListener('input',syncDiscordPreview);
        messageInput?.addEventListener('input',syncDiscordPreview);
        modeInputs.forEach(input=>input.addEventListener('change',()=>{syncDiscordPreview();syncMediaPreview();}));
        [embedAuthor,embedTitle,embedFooter,embedFooterIcon].filter(Boolean).forEach(input=>input.addEventListener('input',syncDiscordPreview));
        embedColor?.addEventListener('input',syncDiscordPreview);
        form.addEventListener('submit',event=>{
          const testAction=String(event.submitter?.formAction||'').endsWith('/announcements/test');
          if(!testAction&&!renderTimeline())event.preventDefault();
        });

        form.querySelectorAll('[data-image-slot]').forEach(slot=>{
          const input=slot.querySelector('input[type=file]');
          const previewEl=slot.querySelector('.announcement-image-preview');
          const clear=slot.querySelector('[data-clear-announcement-image]');
          input?.addEventListener('change',()=>{
            const file=input.files&&input.files[0];
            if(!file){syncMediaPreview();return;}
            const url=URL.createObjectURL(file);
            previewEl?.classList.add('has-image');
            if(previewEl){
              previewEl.innerHTML=`<img src="${url}" alt=""><small>${esc(file.name)}</small>`;
              previewEl.querySelector('img')?.addEventListener('load',()=>URL.revokeObjectURL(url),{once:true});
            }
            if(clear)clear.hidden=false;
            syncMediaPreview();
          });
          clear?.addEventListener('click',()=>{
            if(input)input.value='';
            previewEl?.classList.remove('has-image');
            const number=Number((input?.id.match(/\d+$/)||['1'])[0]);
            if(previewEl)previewEl.innerHTML=`<span>＋</span><b>${ARXI18n.html('module.image_value0',{value0:number})}</b><small>${ARXI18n.html('module.empty')}</small>`;
            clear.hidden=true;
            syncMediaPreview();
          });
        });

        syncMonthlyConstraints();
        syncRecurrence();
        syncReminderState();
        syncDiscordPreview();
        renderTimeline();
        syncMediaPreview();
      }
      if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',arxInitAnnouncementScheduler);else arxInitAnnouncementScheduler();
      
      // ARX Giveaway Studio — live preview, emoji picker and countdowns.
      (() => {
        const form = document.getElementById('giveawayCreateForm');
        const countdownNodes = [...document.querySelectorAll('[data-giveaway-countdown]')];
        const updateCountdowns = () => {
          const now = Math.floor(Date.now() / 1000);
          countdownNodes.forEach(node => {
            const end = Number(node.dataset.giveawayCountdown || 0);
            if (!end) return;
            let seconds = Math.max(0, end - now);
            if (seconds <= 0) { node.textContent = t("app.ending"); return; }
            const days = Math.floor(seconds / 86400); seconds %= 86400;
            const hours = Math.floor(seconds / 3600); seconds %= 3600;
            const mins = Math.floor(seconds / 60);
            if (days) node.textContent = t('duration.short_days', {days, hours, minutes:mins});
            else if (hours) node.textContent = t('duration.short_hours', {hours, minutes:mins});
            else node.textContent = t('duration.short_minutes', {minutes:Math.max(1,mins)});
          });
        };
        if (countdownNodes.length) { updateCountdowns(); setInterval(updateCountdowns, 1000); }
        if (!form) return;
      
        const byId = id => document.getElementById(id);
        const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
        const renderEmoji = value => {
          const raw = String(value || '').trim();
          const match = raw.match(/^<a?:([^:>]+):(\d+)>$/);
          if (!match) return esc(raw);
          const animated = raw.startsWith('<a:');
          return `<img class="giveaway-inline-emoji" src="https://cdn.discordapp.com/emojis/${match[2]}.${animated ? 'gif' : 'png'}?size=40&quality=lossless" alt="${esc(match[1])}">`;
        };
        const replaceVars = (text, values) => String(text || '').replace(/\{([a-z_]+)\}/gi, (all, key) => Object.prototype.hasOwnProperty.call(values, key) ? String(values[key]) : all);
        const renderDiscordPreviewText = value => {
          let safe = esc(String(value ?? ''));
          safe = safe.replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>');
          safe = safe.replace(/__(.+?)__/gs, '<u>$1</u>');
          safe = safe.replace(/~~(.+?)~~/gs, '<s>$1</s>');
          safe = safe.replace(/(?<!\*)\*([^*\n]+)\*(?!\*)/g, '<em>$1</em>');
          safe = safe.replace(/`([^`\n]+)`/g, '<code>$1</code>');
          // Discord clients render timestamp tags using the viewer's locale.
          // The preview follows the selected ARX locale/timezone when available.
          safe = safe.replace(/&lt;t:(\d{1,16}):([tTdDfFR])&gt;/g, (raw, ts, style) => {
            const seconds = Number(ts);
            const date = new Date(seconds * 1000);
            if (!Number.isFinite(seconds) || Number.isNaN(date.getTime())) return raw;
            if (style === 'R') {
              const delta = seconds - Math.floor(Date.now() / 1000);
              const abs = Math.abs(delta);
              let label;
              if (abs < 60) label = t("duration.less_than_a_minute");
              else if (abs < 3600) label = t("duration.short_minutes", {minutes: Math.max(1, Math.round(abs / 60))});
              else if (abs < 86400) label = t("duration.short_hours", {hours: Math.max(1, Math.round(abs / 3600)), minutes: 0});
              else label = t("duration.short_days", {days: Math.max(1, Math.round(abs / 86400)), hours: 0, minutes: 0});
              return `<span class="giveaway-preview-timestamp">${delta >= 0 ? '⏳ ' : ''}${esc(label)}</span>`;
            }
            const locale = document.documentElement.lang || currentUiLanguage || 'en';
            const timeZone = form.dataset.arxGiveawayTimezone || Intl.DateTimeFormat().resolvedOptions().timeZone;
            const formats = {
              t: {hour:'2-digit',minute:'2-digit'},
              T: {hour:'2-digit',minute:'2-digit',second:'2-digit'},
              d: {year:'numeric',month:'2-digit',day:'2-digit'},
              D: {year:'numeric',month:'long',day:'numeric'},
              f: {year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'},
              F: {weekday:'long',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit'}
            };
            try {
              const options = {...formats[style], calendar:'gregory', timeZone};
              const label = new Intl.DateTimeFormat(locale, options).format(date);
              return `<span class="giveaway-preview-timestamp" title="${esc(date.toISOString())}">${esc(label)}</span>`;
            } catch (_) {
              return `<span class="giveaway-preview-timestamp">${esc(date.toISOString().replace('T',' ').slice(0,16))} UTC</span>`;
            }
          });
          return safe.replace(/\n/g, '<br>');
        };
        const durationInput = byId('giveawayDuration');
        const timingWrap = form.querySelector('[data-giveaway-timing]');
        const exactToggle = byId('giveawayExactEndToggle');
        const timingModeInput = byId('giveawayTimingMode');
        const endLocalInput = byId('giveawayEndAtLocal');
        const endUtcInput = byId('giveawayEndAtUtc');
        const datePickerButton = byId('giveawayOpenDatePicker');
        const toLocalInputValue = date => {
          if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
          const pad=n=>String(n).padStart(2,'0');
          return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
        };
        const parseStoredUtc = raw => {
          const value=String(raw||'').trim();
          if(!value)return null;
          const iso=/[zZ]|[+-]\d\d:\d\d$/.test(value)?value:value.replace(' ','T')+'Z';
          const date=new Date(iso);
          return Number.isNaN(date.getTime())?null:date;
        };
        const initialStoredEnd = parseStoredUtc(timingWrap?.dataset.scheduledEndAt || timingWrap?.dataset.currentEndAt || '');
        if(endLocalInput && initialStoredEnd) endLocalInput.value=toLocalInputValue(initialStoredEnd);
        let previewEndTs = initialStoredEnd ? Math.floor(initialStoredEnd.getTime()/1000) : Math.floor(Date.now() / 1000) + Math.round(Math.max(1, Number(durationInput?.value || 60)) * 60);
        const syncEndAtUtc = () => {
          if(!endUtcInput)return false;
          if(!exactToggle?.checked){endUtcInput.value='';return true;}
          const date=endLocalInput?.value?new Date(endLocalInput.value):null;
          if(!date || Number.isNaN(date.getTime())){endUtcInput.value='';return false;}
          endUtcInput.value=date.toISOString();
          previewEndTs=Math.floor(date.getTime()/1000);
          return true;
        };
        const resetPreviewEnd = () => {
          if(exactToggle?.checked && syncEndAtUtc())return;
          previewEndTs = Math.floor(Date.now() / 1000) + Math.round(Math.max(1, Number(durationInput?.value || 60)) * 60);
        };
        const syncTimingMode = ({seedExact=false}={}) => {
          const exact=!!exactToggle?.checked;
          if(timingModeInput)timingModeInput.value=exact?'datetime':'duration';
          if(durationInput){durationInput.disabled=exact;durationInput.required=!exact;durationInput.closest('.giveaway-duration-field')?.classList.toggle('is-disabled',exact);}
          if(endLocalInput){
            endLocalInput.disabled=!exact;
            endLocalInput.required=exact;
            if(exact && seedExact && !endLocalInput.value){
              const seeded=new Date(Date.now()+Math.max(1,Number(durationInput?.value||60))*60000);
              seeded.setSeconds(0,0);
              endLocalInput.value=toLocalInputValue(seeded);
              // Programmatic value changes do not fire input/change events.
              // Notify the localized date facade and timezone synchronizer.
              endLocalInput.dispatchEvent(new Event('input', {bubbles:true}));
            }
          }
          if(datePickerButton)datePickerButton.disabled=!exact;
          timingWrap?.classList.toggle('exact-mode',exact);
          if(!exact) syncEndAtUtc();
          resetPreviewEnd();
          syncPreview();
        };
        const futureTs = () => {
          if(exactToggle?.checked && endUtcInput?.value){
            const exactDate=new Date(endUtcInput.value);
            if(!Number.isNaN(exactDate.getTime())) return Math.floor(exactDate.getTime()/1000);
          }
          return previewEndTs;
        };
        const formatPreviewRemaining = () => {
          let seconds=Math.max(0, futureTs()-Math.floor(Date.now()/1000));
          if(seconds<=0)return t('app.ending');
          const days=Math.floor(seconds/86400);seconds%=86400;
          const hours=Math.floor(seconds/3600);seconds%=3600;
          const mins=Math.floor(seconds/60);
          if(days)return t('duration.short_days',{days,hours,minutes:mins});
          if(hours)return t('duration.short_hours',{hours,minutes:mins});
          return t('duration.short_minutes',{minutes:Math.max(1,mins)});
        };
        const previewWinnerText = () => {
          const count=Math.max(1,Math.min(20,Number(byId('giveawayWinnerCount')?.value||1)));
          const winnerLabel=t("giveaway.winner");
          return Array.from({length:count},(_,index)=>{
            const position=index+1;
            const trophy=position<=3?'🏆 ':'';
            return `${trophy}**${position}. ${winnerLabel}:** @${winnerLabel} ${position}`;
          }).join('\n').replace(/^/, '\n');
        };
        const previewValues = () => {
          const channel = byId('giveawayChannel');
          const channelName = channel?.selectedOptions?.[0]?.textContent?.trim() || t("module.no_channel_selected");
          return {
            prize: byId('giveawayPrize')?.value || t("module.prize"),
            winner_count: byId('giveawayWinnerCount')?.value || '1',
            end_at: futureTs(),
            channel: channelName,
            server: t("module.server"),
            winner_text: previewWinnerText(),
            position: '1',
            winner: t("giveaway.winner"),
            game_master: t("app.game_master"),
          };
        };
        const syncPreview = () => {
          const values = previewValues();
          const title = byId('giveawayPreviewTitle');
          const body = byId('giveawayPreviewBody');
          const footer = byId('giveawayPreviewFooter');
          const footerIcon = byId('giveawayPreviewFooterIcon');
          const target = byId('giveawayPreviewChannel');
          const label = byId('giveawayPreviewButtonLabel');
          const emoji = byId('giveawayPreviewEmoji');
          const button = byId('giveawayPreviewJoin');
          const resultTitle = byId('giveawayResultPreviewTitle');
          const resultBody = byId('giveawayResultPreviewBody');
          const resultFooter = byId('giveawayResultPreviewFooter');
          const resultFooterIcon = byId('giveawayResultPreviewFooterIcon');
          const liveEmbed = byId('giveawayPreviewEmbed');
          const resultEmbed = byId('giveawayResultPreviewEmbed');
          const liveColor = byId('giveawayLiveEmbedColor');
          const resultColor = byId('giveawayAnnounceEmbedColor');
          const status = byId('giveawayPreviewStatus');
          if (title) title.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayTitle')?.value || '', values));
          if (body) body.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayLiveBody')?.value || '', values));
          if (footer) footer.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayFooter')?.value || '', values));
          if (footerIcon) footerIcon.hidden=!String(footerIcon.getAttribute('src')||'').trim()||!String(footer?.textContent||footer?.innerText||'').trim();
          if (target) target.textContent = byId('giveawayChannel')?.selectedOptions?.[0]?.textContent?.trim() || t("module.no_channel_selected");
          if (label) label.textContent = byId('giveawayButtonLabel')?.value || t("server.enter_giveaway");
          if (emoji) emoji.innerHTML = renderEmoji(byId('giveawayButtonEmoji')?.value || '');
          if (button) {
            button.classList.remove('primary','secondary','success','danger');
            button.classList.add(form.querySelector('input[name="button_style"]:checked')?.value || 'success');
          }
          if (resultTitle) resultTitle.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayAnnounceTitle')?.value || '', values));
          if (resultBody) resultBody.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayAnnounceBody')?.value || '', values));
          if (resultFooter) resultFooter.innerHTML = renderDiscordPreviewText(replaceVars(byId('giveawayAnnounceFooter')?.value || '', values));
          if (resultFooterIcon) resultFooterIcon.hidden=!String(resultFooterIcon.getAttribute('src')||'').trim()||!String(resultFooter?.textContent||resultFooter?.innerText||'').trim();
          if (liveEmbed && liveColor) liveEmbed.style.setProperty('--giveaway-embed-color', liveColor.value || '#5865F2');
          if (resultEmbed && resultColor) resultEmbed.style.setProperty('--giveaway-result-color', resultColor.value || '#F4C430');
          form.querySelectorAll('[data-giveaway-color-control]').forEach(control=>{
            const input=control.querySelector('input[type="color"]');
            const dot=control.querySelector('[data-giveaway-color-dot]');
            const text=control.querySelector('[data-giveaway-color-text]');
            if(!input)return;const color=String(input.value||'#5865F2').toUpperCase();
            if(dot)dot.style.background=color;if(text)text.textContent=color;
          });
          if (status) status.innerHTML = `👥 <strong>${esc(t('module.participants'))}:</strong> 0 ${esc(t('module.people'))} · ⏳ <strong>${esc(t('module.remaining'))}:</strong> ${esc(formatPreviewRemaining())}`;
        };
        durationInput?.addEventListener('input',()=>{if(!exactToggle?.checked){resetPreviewEnd();syncPreview();}});
        exactToggle?.addEventListener('change',()=>syncTimingMode({seedExact:true}));
        endLocalInput?.addEventListener('input',()=>{syncEndAtUtc();syncPreview();});
        endLocalInput?.addEventListener('change',()=>{syncEndAtUtc();syncPreview();});
        datePickerButton?.addEventListener('click',()=>{try{endLocalInput?.showPicker?.();}catch(_){endLocalInput?.focus();}});
        form.addEventListener('submit',()=>{syncEndAtUtc();},true);
        form.addEventListener('input', syncPreview);
        form.addEventListener('change', syncPreview);
        syncTimingMode({seedExact:true});
        syncEndAtUtc();
        syncPreview();
        setInterval(()=>{const status=byId('giveawayPreviewStatus');if(status)status.innerHTML=`👥 <strong>${esc(t('module.participants'))}:</strong> 0 ${esc(t('module.people'))} · ⏳ <strong>${esc(t('module.remaining'))}:</strong> ${esc(formatPreviewRemaining())}`;},1000);
      
        const giveawayMainMediaUrls = new Map();
        const wireGiveawayMainMedia = ({kind,inputId,previewId,embedId,nameId,removeId,toggleId}) => {
          const card=form.querySelector(`[data-giveaway-media-card="${kind}"]`);
          const input=byId(inputId),preview=byId(previewId),embed=byId(embedId),name=byId(nameId),remove=byId(removeId),serverToggle=byId(toggleId);
          if(!card||!input||!preview||!remove)return;
          const clearButton=card.querySelector('[data-giveaway-media-clear]');
          const customUrl=String(card.dataset.customUrl||'');
          const customName=String(card.dataset.customName||'');
          const serverUrl=String(serverToggle?.dataset.serverIconUrl||'');
          const setPreview=(target,url)=>{
            if(!target)return;
            if(target.tagName==='IMG'){
              if(url){target.src=url;target.hidden=false;}else{target.removeAttribute('src');target.hidden=true;}
              return;
            }
            if(url){target.hidden=false;target.innerHTML=`<img src="${url}" alt="">`;}
            else{target.hidden=true;target.replaceChildren();}
          };
          const setCard=(url)=>{preview.innerHTML=url?`<img src="${url}" alt="">`:'<span>ARX</span>';};
          const revokeObjectUrl=()=>{const oldUrl=giveawayMainMediaUrls.get(inputId);if(oldUrl){URL.revokeObjectURL(oldUrl);giveawayMainMediaUrls.delete(inputId);}};
          const syncMedia=()=>{
            let url='';let label=t('module.no_image_selected');
            const file=input.files?.[0];
            if(file){
              let objectUrl=giveawayMainMediaUrls.get(inputId);
              if(!objectUrl){objectUrl=URL.createObjectURL(file);giveawayMainMediaUrls.set(inputId,objectUrl);}
              url=objectUrl;label=file.name;
            }else if(serverToggle?.checked&&serverUrl){
              url=serverUrl;label=t('module.server_avatar');
            }else if(!remove.checked&&customUrl){
              url=customUrl;label=customName||t('module.current_image');
            }
            setCard(url);setPreview(embed,url);
            if(name)name.textContent=label;
            if(clearButton)clearButton.disabled=!url;
            syncPreview();
          };
          input.addEventListener('change',()=>{
            revokeObjectUrl();
            if(input.files?.[0]){if(serverToggle)serverToggle.checked=false;remove.checked=false;}
            syncMedia();
          });
          serverToggle?.addEventListener('change',()=>{
            if(serverToggle.checked){input.value='';revokeObjectUrl();remove.checked=false;}
            syncMedia();
          });
          clearButton?.addEventListener('click',()=>{
            input.value='';revokeObjectUrl();if(serverToggle)serverToggle.checked=false;remove.checked=true;syncMedia();
          });
          syncMedia();
        };
        wireGiveawayMainMedia({kind:'banner',inputId:'giveawayImage',previewId:'giveawayCreateImagePreview',embedId:'giveawayPreviewImage',nameId:'giveawayUploadName',removeId:'giveawayRemoveImage',toggleId:'giveawayImageServerIcon'});
        wireGiveawayMainMedia({kind:'thumbnail',inputId:'giveawayThumbnailImage',previewId:'giveawayThumbnailPreview',embedId:'giveawayPreviewThumb',nameId:'giveawayThumbnailName',removeId:'giveawayRemoveThumbnail',toggleId:'giveawayThumbnailServerIcon'});
        wireGiveawayMainMedia({kind:'footer',inputId:'giveawayFooterIconImage',previewId:'giveawayFooterIconCardPreview',embedId:'giveawayPreviewFooterIcon',nameId:'giveawayFooterIconName',removeId:'giveawayRemoveFooterIcon',toggleId:'giveawayFooterServerIcon'});

        const giveawayFooterMediaUrls = new Map();
        const bindGiveawayFooterMedia = ({inputId,cardPreviewId,embedImageId,nameId,removeName}) => {
          const input=byId(inputId),card=byId(cardPreviewId),embed=byId(embedImageId),name=byId(nameId);
          const clearObjectUrl=()=>{const old=giveawayFooterMediaUrls.get(inputId);if(old){URL.revokeObjectURL(old);giveawayFooterMediaUrls.delete(inputId);}};
          input?.addEventListener('change',()=>{
            const file=input.files?.[0];if(!file)return;clearObjectUrl();
            const url=URL.createObjectURL(file);giveawayFooterMediaUrls.set(inputId,url);
            if(card)card.innerHTML=`<img src="${url}" alt="">`;
            if(embed){embed.src=url;embed.hidden=false;}
            if(name)name.textContent=file.name;
            const remove=form.querySelector(`input[name="${removeName}"]`);if(remove)remove.checked=false;
            syncPreview();
          });
          form.querySelector(`input[name="${removeName}"]`)?.addEventListener('change',event=>{
            if(!event.target.checked)return;if(input)input.value='';clearObjectUrl();
            if(card)card.innerHTML='<span>ARX</span>';
            if(embed){embed.removeAttribute('src');embed.hidden=true;}
            if(name)name.textContent=t('module.no_image_selected');
            syncPreview();
          });
        };
        bindGiveawayFooterMedia({inputId:'giveawayAnnounceFooterIconImage',cardPreviewId:'giveawayAnnounceFooterIconCardPreview',embedImageId:'giveawayResultPreviewFooterIcon',nameId:'giveawayAnnounceFooterIconName',removeName:'remove_announce_footer_icon_image'});
        bindGiveawayFooterMedia({inputId:'giveawayEndedFooterIconImage',cardPreviewId:'giveawayEndedFooterIconCardPreview',embedImageId:'',nameId:'giveawayEndedFooterIconName',removeName:'remove_ended_footer_icon_image'});

        const resultMediaUrls = new Map();
        const bindResultMedia = ({inputId,cardPreviewId,embedPreviewId,nameId,removeName}) => {
          const input=byId(inputId),card=byId(cardPreviewId),embed=byId(embedPreviewId),name=byId(nameId);
          const clearObjectUrl=()=>{const old=resultMediaUrls.get(inputId);if(old){URL.revokeObjectURL(old);resultMediaUrls.delete(inputId);}};
          input?.addEventListener('change',()=>{
            const file=input.files?.[0];if(!file)return;clearObjectUrl();
            const url=URL.createObjectURL(file);resultMediaUrls.set(inputId,url);
            if(card)card.innerHTML=`<img src="${url}" alt="">`;
            if(embed){embed.hidden=false;embed.innerHTML=`<img src="${url}" alt="">`;}
            if(name)name.textContent=file.name;
            const remove=form.querySelector(`input[name="${removeName}"]`);if(remove)remove.checked=false;
          });
          form.querySelector(`input[name="${removeName}"]`)?.addEventListener('change',event=>{
            if(!event.target.checked)return;if(input)input.value='';clearObjectUrl();
            if(card)card.innerHTML='<span>ARX</span>';
            if(embed){embed.hidden=true;embed.replaceChildren();}
            if(name)name.textContent=t('module.no_image_selected');
          });
        };
        bindResultMedia({inputId:'giveawayResultThumbnailImage',cardPreviewId:'giveawayResultThumbnailCardPreview',embedPreviewId:'giveawayResultPreviewThumb',nameId:'giveawayResultThumbnailName',removeName:'remove_announce_thumbnail_image'});
        bindResultMedia({inputId:'giveawayWinnerImage',cardPreviewId:'giveawayWinnerImageCardPreview',embedPreviewId:'giveawayResultPreviewImage',nameId:'giveawayWinnerImageName',removeName:'remove_announce_image'});
      
        const dialog = byId('giveawayEmojiPickerDialog');
        const emojiInput = byId('giveawayButtonEmoji');
        const nativeGrid = byId('giveawayNativeEmojiGrid');
        const nativeEmojis = ['🎉','🎁','🏆','✨','🔥','💎','⭐','❤️','💜','💙','💚','🎮','🎟️','🥳','👑','🚀','⚡','🍀','🎯','💰','🪙','🎊','🎈','🤝','✅','🌟','🛡️','⚔️','🐉','🧧'];
        if (nativeGrid) {
          nativeGrid.innerHTML = nativeEmojis.map(value => `<button type="button" data-giveaway-emoji="${value}" data-giveaway-emoji-name="${value}"><span>${value}</span></button>`).join('');
        }
        byId('giveawayEmojiButton')?.addEventListener('click', () => dialog?.showModal());
        byId('giveawayEmojiClear')?.addEventListener('click', () => { if (emojiInput) emojiInput.value = ''; syncPreview(); });
        dialog?.querySelector('[data-giveaway-emoji-close]')?.addEventListener('click', () => dialog.close());
        dialog?.addEventListener('click', event => {
          const button = event.target.closest('[data-giveaway-emoji]');
          if (!button) return;
          if (emojiInput) emojiInput.value = button.dataset.giveawayEmoji || '';
          dialog.close(); syncPreview();
        });
        byId('giveawayEmojiPickerSearch')?.addEventListener('input', event => {
          const query = String(event.target.value || '').trim().toLocaleLowerCase(currentUiLanguage);
          dialog?.querySelectorAll('[data-giveaway-emoji]').forEach(button => {
            const haystack = `${button.dataset.giveawayEmojiName || ''} ${button.dataset.giveawayEmoji || ''}`.toLocaleLowerCase(currentUiLanguage);
            button.hidden = Boolean(query && !haystack.includes(query));
          });
        });
      })();
      
      
      // ARX Stream Alerts — mention/offline field visibility.
      (() => {
        const mentionMode = document.querySelector('[data-stream-mention-mode]');
        const roleField = document.querySelector('[data-stream-role-field]');
        const offlineToggle = document.querySelector('[data-stream-offline-toggle]');
        const offlineField = document.querySelector('[data-stream-offline-field]');
        const sync = () => {
          if (roleField && mentionMode) roleField.hidden = mentionMode.value !== 'role';
          if (offlineField && offlineToggle) offlineField.hidden = !offlineToggle.checked;
        };
        mentionMode?.addEventListener('change', sync);
        offlineToggle?.addEventListener('change', sync);
        sync();
      })();
      
      for (const form of document.querySelectorAll('form[data-confirm]:not([data-queue-form])')) { form.addEventListener('submit', event => { if (!window.confirm(form.dataset.confirm)) event.preventDefault(); }); }
      
      
      // ARX Members — debounced live server-side search for large guilds.
      (() => {
        const panel = document.querySelector('.member-list');
        const form = panel?.querySelector('form.member-search');
        const input = form?.querySelector('#member-query');
        if (!panel || !form || !input) return;
      
        const sortInput = form.querySelector('input[name="sort"]');
        let timer = 0;
        let controller = null;
        let requestSerial = 0;
        let composing = false;
      
        const buildUrl = (rawQuery) => {
          const url = new URL(form.action, window.location.origin);
          const query = String(rawQuery || '').trim();
          const sort = String(sortInput?.value || 'newest');
          if (query) url.searchParams.set('q', query);
          url.searchParams.set('sort', sort);
          return url;
        };
      
        const replaceOptional = (selector, incomingPanel) => {
          const current = panel.querySelector(selector);
          const incoming = incomingPanel.querySelector(selector);
          if (current && incoming) {
            current.replaceWith(incoming.cloneNode(true));
          } else if (current && !incoming) {
            current.remove();
          } else if (!current && incoming) {
            const tableWrap = panel.querySelector('.table-wrap');
            if (selector === '.member-pagination' && tableWrap) tableWrap.insertAdjacentElement('afterend', incoming.cloneNode(true));
          }
        };
      
        const syncClearLink = (incomingPanel) => {
          const incomingForm = incomingPanel.querySelector('form.member-search');
          const incomingClear = incomingForm?.querySelector('a.link-button');
          const currentClear = form.querySelector('a.link-button');
          if (currentClear && !incomingClear) currentClear.remove();
          else if (!currentClear && incomingClear) form.append(incomingClear.cloneNode(true));
          else if (currentClear && incomingClear) currentClear.replaceWith(incomingClear.cloneNode(true));
        };
      
        const runSearch = async (rawQuery, {pushUrl = true} = {}) => {
          clearTimeout(timer);
          const serial = ++requestSerial;
          controller?.abort();
          controller = new AbortController();
          const url = buildUrl(rawQuery);
          form.setAttribute('aria-busy', 'true');
          input.setAttribute('aria-busy', 'true');
      
          try {
            const response = await fetch(url, {
              cache: 'no-store',
              credentials: 'same-origin',
              headers: {'X-Requested-With': 'ARX-Live-Member-Search'},
              signal: controller.signal,
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            if (serial !== requestSerial) return;
            const parsed = new DOMParser().parseFromString(html, 'text/html');
            const incomingPanel = parsed.querySelector('.member-list');
            if (!incomingPanel) throw new Error('member-list fragment missing');
      
            const incomingMeta = incomingPanel.querySelector('.member-list-meta');
            const currentMeta = panel.querySelector('.member-list-meta');
            if (incomingMeta && currentMeta) currentMeta.replaceWith(incomingMeta.cloneNode(true));
      
            const incomingTable = incomingPanel.querySelector('.table-wrap');
            const currentTable = panel.querySelector('.table-wrap');
            if (incomingTable && currentTable) currentTable.replaceWith(incomingTable.cloneNode(true));
      
            const incomingSort = incomingPanel.querySelector('.member-sort');
            const currentSort = panel.querySelector('.member-sort');
            if (incomingSort && currentSort) currentSort.replaceWith(incomingSort.cloneNode(true));
      
            replaceOptional('.member-pagination', incomingPanel);
            syncClearLink(incomingPanel);
      
            if (pushUrl) window.history.replaceState({}, '', `${url.pathname}${url.search}`);
          } catch (error) {
            if (error?.name !== 'AbortError') {
              console.warn('ARX live member search failed; manual submit remains available.', error);
            }
          } finally {
            if (serial === requestSerial) {
              form.removeAttribute('aria-busy');
              input.removeAttribute('aria-busy');
            }
          }
        };
      
        const schedule = () => {
          if (composing) return;
          clearTimeout(timer);
          timer = window.setTimeout(() => runSearch(input.value), 280);
        };
      
        input.addEventListener('compositionstart', () => { composing = true; clearTimeout(timer); });
        input.addEventListener('compositionend', () => { composing = false; schedule(); });
        input.addEventListener('input', schedule);
        input.addEventListener('search', () => runSearch(input.value));
        form.addEventListener('submit', event => {
          event.preventDefault();
          runSearch(input.value);
        });
      })();
      
      // ARX V99 — Level/Rank member picker and destructive transfer confirmation.
      for (const picker of document.querySelectorAll('[data-level-member-picker]')) {
        const guildId = picker.dataset.guildId;
        const query = picker.querySelector('[data-level-member-query]');
        const hidden = picker.querySelector('[data-level-member-id]');
        const results = picker.querySelector('[data-level-member-results]');
        if (!guildId || !query || !hidden || !results) continue;
        let timer = 0;
        let serial = 0;
        const close = () => { results.hidden = true; results.replaceChildren(); };
        const render = members => {
          results.replaceChildren();
          if (!members.length) { close(); return; }
          for (const member of members) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'level-member-result';
            const avatar = member.avatar_url ? `<img src="${member.avatar_url}" alt="">` : '<span class="level-member-avatar">?</span>';
            const display = String(member.display_name || member.username || member.user_id || '');
            const username = String(member.username || '');
            button.innerHTML = `${avatar}<span><strong></strong><small></small></span>`;
            button.querySelector('strong').textContent = display;
            button.querySelector('small').textContent = `${username ? '@'+username+' · ' : ''}${member.user_id}`;
            button.addEventListener('click', () => {
              hidden.value = member.user_id;
              query.value = `${display} (${member.user_id})`;
              query.dataset.selectedId = member.user_id;
              close();
            });
            results.append(button);
          }
          results.hidden = false;
        };
        query.addEventListener('input', () => {
          hidden.value = '';
          query.dataset.selectedId = '';
          clearTimeout(timer);
          const value = query.value.trim();
          if (value.length < 2) { close(); return; }
          timer = setTimeout(async () => {
            const mine = ++serial;
            try {
              const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/members/search?q=${encodeURIComponent(value)}&limit=12`, {cache:'no-store'});
              const data = await response.json().catch(() => ({}));
              if (mine !== serial) return;
              if (!response.ok) throw new Error(data.detail || 'member search failed');
              render(Array.isArray(data.members) ? data.members : []);
            } catch (_) { if (mine === serial) close(); }
          }, 220);
        });
        query.addEventListener('blur', () => setTimeout(close, 180));
      }
      
      for (const form of document.querySelectorAll('.level-transfer-form[data-confirm]')) {
        form.addEventListener('submit', event => {
          if (!window.confirm(form.dataset.confirm || t('leveling.transfer_confirm'))) event.preventDefault();
        });
      }
      
      // ARX V100 — Level-up DM live preview
      (() => {
        const input = document.querySelector('[data-level-dm-template]');
        const preview = document.querySelector('[data-level-dm-preview]');
        if (!input || !preview) return;
        const sample = {
          '{member}': 'Alex',
          '{server}': 'ARX Community',
          '{level}': '25',
          '{old_level}': '24',
          '{levels_gained}': '1',
          '{total_xp}': '42,750',
          '{next_xp}': '1,950',
          '{rank}': '#7',
          '{role}': 'Member',
        };
        const render = () => {
          let text = (input.value || '').trim() || input.dataset.defaultTemplate || '';
          Object.entries(sample).forEach(([key, value]) => { text = text.split(key).join(value); });
          preview.textContent = text;
        };
        input.addEventListener('input', render);
        render();
      })();
      
      // ARX V102 — Level/Rank reward inventory, explicit XP operations and member info.
      (() => {
        const formatNumber = value => Number(value || 0).toLocaleString(document.documentElement.lang || undefined);
      
        async function loadLevelMemberInfo(picker, userId) {
          const targetId = picker.dataset.levelMemberInfoTarget;
          if (!targetId || !userId) return;
          const target = document.getElementById(targetId);
          const guildId = picker.dataset.guildId;
          if (!target || !guildId) return;
          target.classList.add('is-loading');
          try {
            const response = await fetch(`/api/guilds/${encodeURIComponent(guildId)}/leveling/member/${encodeURIComponent(userId)}`, {cache:'no-store'});
            const data = await response.json().catch(() => ({}));
            if (!response.ok) throw new Error(data.detail || 'member info failed');
            target.replaceChildren();
            const items = [
              [t('leveling.current_level'), `Lv. ${data.level}`],
              [t('leveling.level_progress_xp'), data.required_xp ? `${formatNumber(data.current_xp)} / ${formatNumber(data.required_xp)} XP` : t('leveling.rank_max_level')],
              [t('leveling.remaining_xp'), data.required_xp ? `${formatNumber(data.remaining_xp)} XP` : '—'],
              [t('leveling.server_rank'), `#${data.rank}`],
            ];
            for (const [label, value] of items) {
              const box = document.createElement('span');
              const small = document.createElement('small');
              const strong = document.createElement('strong');
              small.textContent = label;
              strong.textContent = value;
              box.append(small, strong);
              target.append(box);
            }
          } catch (_) {
            target.textContent = t('leveling.member_info_unavailable');
          } finally {
            target.classList.remove('is-loading');
          }
        }
      
        // The V99 picker is kept as the search source. Observe its hidden value so all
        // existing picker instances benefit without duplicating the member-search code.
        for (const picker of document.querySelectorAll('[data-level-member-picker][data-level-member-info-target]')) {
          const hidden = picker.querySelector('[data-level-member-id]');
          const query = picker.querySelector('[data-level-member-query]');
          if (!hidden) continue;
          let lastValue = hidden.value || '';
          const sync = () => {
            const next = hidden.value || '';
            if (next && next !== lastValue) loadLevelMemberInfo(picker, next);
            lastValue = next;
          };
          const observer = new MutationObserver(sync);
          observer.observe(hidden, {attributes:true, attributeFilter:['value']});
          // Programmatic .value changes do not emit mutation events, so watch picker clicks too.
          picker.addEventListener('click', event => {
            if (event.target.closest('.level-member-result')) setTimeout(() => loadLevelMemberInfo(picker, hidden.value), 0);
          });
          if (query) query.addEventListener('input', () => {
            if (!hidden.value) {
              const target = document.getElementById(picker.dataset.levelMemberInfoTarget || '');
              if (target) { target.replaceChildren(); const span = document.createElement('span'); span.textContent = t('leveling.select_member_for_info'); target.append(span); }
            }
          });
        }
      
        for (const form of document.querySelectorAll('[data-level-adjust-control]')) {
          const hidden = form.querySelector('[data-level-operation-input]');
          const input = form.querySelector('input[name="value"]');
          const prefix = form.querySelector('[data-level-value-prefix]');
          const buttons = [...form.querySelectorAll('[data-level-operation]')];
          if (!hidden || !input || !prefix || !buttons.length) continue;
          const maxLevel = Math.max(1, Number(form.dataset.maxLevel || 1000));
          const apply = operation => {
            hidden.value = operation;
            buttons.forEach(button => button.classList.toggle('is-active', button.dataset.levelOperation === operation));
            if (operation === 'remove_xp') prefix.textContent = '−';
            else if (operation === 'set_level') prefix.textContent = 'Lv.';
            else prefix.textContent = '+';
            input.min = '1';
            input.max = operation === 'set_level' ? String(maxLevel) : '1000000000';
            if (operation === 'set_level' && Number(input.value) > maxLevel) input.value = String(maxLevel);
            if (!input.value || Number(input.value) < 1) input.value = '1';
          };
          buttons.forEach(button => button.addEventListener('click', () => apply(button.dataset.levelOperation || 'add_xp')));
          apply(hidden.value || 'add_xp');
        }
      
        const sizeFiveRowViewport = (list, rowSelector) => {
          if (!list) return;
          const rows = [...list.querySelectorAll(rowSelector)];
          list.classList.toggle('is-five-row-scroll', rows.length > 5);
          if (!rows.length) { list.style.maxHeight = ''; return; }
          const visibleRows = rows.slice(0, Math.min(5, rows.length));
          const style = getComputedStyle(list);
          const gap = parseFloat(style.rowGap || style.gap || '0') || 0;
          const height = visibleRows.reduce((sum, row) => sum + row.getBoundingClientRect().height, 0) + gap * Math.max(0, visibleRows.length - 1);
          list.style.maxHeight = `${Math.ceil(height)}px`;
        };
      
        const roleRoadmap = document.querySelector('.level-roadmap-v2');
        if (roleRoadmap) {
          const resizeRoleRoadmap = () => sizeFiveRowViewport(roleRoadmap, '.level-roadmap-item');
          resizeRoleRoadmap();
          window.addEventListener('resize', resizeRoleRoadmap, {passive:true});
        }
      
        for (const form of document.querySelectorAll('[data-reward-code-form]')) {
          const list = form.querySelector('[data-reward-code-list]');
          const add = form.querySelector('[data-add-reward-code]');
          const counter = form.querySelector('[data-reward-code-count]');
          if (!list) continue;
          const update = () => {
            const rows = [...list.querySelectorAll('.level-reward-code-row')];
            if (counter) counter.textContent = String(rows.length);
            sizeFiveRowViewport(list, '.level-reward-code-row');
            for (const row of rows) {
              const remove = row.querySelector('[data-remove-reward-code]');
              if (!remove || remove.dataset.bound === '1') continue;
              remove.dataset.bound = '1';
              remove.addEventListener('click', () => {
                const current = [...list.querySelectorAll('.level-reward-code-row')];
                if (current.length <= 1) {
                  const input = row.querySelector('input[name="reward_code"]');
                  if (input) input.value = '';
                } else row.remove();
                update();
              });
            }
          };
          if (add) add.addEventListener('click', () => {
            const first = list.querySelector('.level-reward-code-row');
            if (!first) return;
            const row = first.cloneNode(true);
            const input = row.querySelector('input[name="reward_code"]');
            const remove = row.querySelector('[data-remove-reward-code]');
            if (input) input.value = '';
            if (remove) delete remove.dataset.bound;
            list.append(row);
            update();
            if (list.querySelectorAll('.level-reward-code-row').length > 5) list.scrollTop = list.scrollHeight;
            input?.focus();
          });
          update();
        }
      
        const rewardLog = document.querySelector('[data-level-reward-log]');
        if (rewardLog) {
          const search = rewardLog.querySelector('[data-reward-log-search]');
          const level = rewardLog.querySelector('[data-reward-log-level]');
          const role = rewardLog.querySelector('[data-reward-log-role]');
          const rows = [...rewardLog.querySelectorAll('[data-reward-log-row]')];
          const empty = rewardLog.querySelector('[data-reward-log-empty]');
          const apply = () => {
            const needle = (search?.value || '').trim().toLocaleLowerCase(document.documentElement.lang || undefined);
            const wantedLevel = level?.value || '';
            const wantedRole = role?.value || '';
            let visible = 0;
            for (const row of rows) {
              const member = String(row.dataset.member || '').toLocaleLowerCase(document.documentElement.lang || undefined);
              const show = (!needle || member.includes(needle)) && (!wantedLevel || row.dataset.level === wantedLevel) && (!wantedRole || row.dataset.role === wantedRole);
              row.hidden = !show;
              if (show) visible++;
            }
            if (empty) empty.hidden = visible !== 0 || rows.length === 0;
          };
          search?.addEventListener('input', apply);
          level?.addEventListener('change', apply);
          role?.addEventListener('change', apply);
          apply();
        }
      
        for (const form of document.querySelectorAll('.level-transfer-card[data-confirm], .level-transfer-form[data-confirm]')) {
          if (form.dataset.v102ConfirmBound === '1') continue;
          form.dataset.v102ConfirmBound = '1';
          form.addEventListener('submit', event => {
            if (!window.confirm(form.dataset.confirm || t('leveling.transfer_confirm'))) event.preventDefault();
          });
        }
      })();
      
      
      // V116: standard Ticket Setup embed colour picker.
      (() => {
        const normaliseHex = value => {
          let raw = String(value || '').trim().replace(/^#/, '').toUpperCase();
          if (!/^[0-9A-F]{6}$/.test(raw)) return null;
          return `#${raw}`;
        };
        document.querySelectorAll('[data-ticket-embed-color-editor]').forEach(editor => {
          const native = editor.querySelector('.ticket-embed-color-native');
          const hex = editor.querySelector('.ticket-embed-color-hex');
          const setColor = value => {
            const normalised = normaliseHex(value);
            if (!normalised) return false;
            if (native) native.value = normalised.toLowerCase();
            if (hex) hex.value = normalised;
            return true;
          };
          native?.addEventListener('input', () => setColor(native.value));
          hex?.addEventListener('input', () => {
            const raw = String(hex.value || '').trim();
            const prefixed = raw.startsWith('#') ? raw : `#${raw}`;
            if (normaliseHex(prefixed)) setColor(prefixed);
          });
          hex?.addEventListener('blur', () => { if (!setColor(hex.value)) setColor(native?.value || '#F1C40F'); });
          editor.querySelectorAll('[data-ticket-embed-color]').forEach(button => {
            button.addEventListener('click', () => setColor(button.dataset.ticketEmbedColor));
          });
          setColor(hex?.value || native?.value || '#F1C40F');
        });
      })();
      
      
      // V119: Standard Ticket Setup title/description emoji picker.
      (() => {
        const dialog = document.getElementById('ticketStandardEmojiDialog');
        if (!dialog) return;
        const search = dialog.querySelector('[data-ticket-emoji-search]');
        const nativeGrid = dialog.querySelector('[data-ticket-native-emojis]');
        let activeTarget = null;
        const nativeEmojis = ['😀','😂','🤣','😊','😍','🥰','😎','🤔','😅','😭','😡','🥳','👍','👎','👏','🙏','❤️','💛','💙','💜','🔥','✨','⭐','✅','❌','⚠️','🎉','🎁','🎮','🛡️','⚔️','🔒','🔓','👑','💎','📩','📌','📢','🧾','🎫','🆘'];
        const insertEmoji = value => {
          if (!activeTarget || !value) return;
          const max = Number(activeTarget.getAttribute('maxlength') || 4000);
          const current = activeTarget.value || '';
          const start = typeof activeTarget.selectionStart === 'number' ? activeTarget.selectionStart : current.length;
          const end = typeof activeTarget.selectionEnd === 'number' ? activeTarget.selectionEnd : start;
          const next = `${current.slice(0,start)}${value}${current.slice(end)}`.slice(0,max);
          activeTarget.value = next;
          const caret = Math.min(start + value.length, next.length);
          activeTarget.focus();
          try { activeTarget.setSelectionRange(caret, caret); } catch (_) {}
          activeTarget.dispatchEvent(new Event('input', {bubbles:true}));
          dialog.close();
        };
        if (nativeGrid && !nativeGrid.children.length) {
          nativeEmojis.forEach(value => {
            const button=document.createElement('button'); button.type='button'; button.className='role-emoji-option';
            button.dataset.ticketEmoji=value; button.dataset.ticketEmojiName=value;
            const glyph=document.createElement('span'); glyph.className='role-native-emoji'; glyph.textContent=value;
            button.append(glyph); nativeGrid.append(button);
          });
        }
        document.querySelectorAll('[data-ticket-emoji-open]').forEach(button => button.addEventListener('click', () => {
          activeTarget = document.getElementById(button.dataset.ticketEmojiTarget || '');
          if (!activeTarget) return;
          dialog.showModal();
          setTimeout(() => search?.focus(), 20);
        }));
        dialog.querySelector('[data-ticket-emoji-close]')?.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
          const button = event.target.closest('[data-ticket-emoji]');
          if (button) insertEmoji(button.dataset.ticketEmoji || '');
        });
        search?.addEventListener('input', () => {
          const q=(search.value || '').trim().toLocaleLowerCase(currentUiLanguage);
          dialog.querySelectorAll('[data-ticket-emoji]').forEach(button => {
            const hay=`${button.dataset.ticketEmojiName || ''} ${button.dataset.ticketEmoji || ''}`.toLocaleLowerCase(currentUiLanguage);
            button.hidden = !!q && !hay.includes(q);
          });
        });
      })();

      // ARX V290: one emoji affordance for every user-facing text field.
      // Technical identifiers, URLs, colour/code fields and dedicated emoji/raw
      // inputs intentionally stay untouched. The full Unicode catalog and guild
      // emojis are mounted lazily on first open so panel navigation stays fast.
      (() => {
        const main = document.querySelector('main[data-arx-workspace-main], main');
        const dialog = document.querySelector('[data-arx-global-emoji-dialog]');
        if (!main || !dialog || !window.ARXBotCommandsEmoji?.mount) return;

        const search = dialog.querySelector('[data-arx-global-emoji-search]');
        const nativeGrid = dialog.querySelector('[data-arx-global-native-emojis]');
        const serverGrid = dialog.querySelector('[data-arx-global-server-emojis]');
        const guildId = String(dialog.dataset.arxGuildId || '').trim();
        const chooseLabel = t('module.choose_emoji') || 'Emoji';
        let activeTarget = null;
        let catalogApi = null;
        let preparePromise = null;

        // ARX V291.2 — MEE6-style emoji affordance. The button keeps one
        // lightweight Twemoji face in grayscale at rest; each genuine mouse
        // entry swaps to a different preloaded face and CSS reveals its color.
        // No alternate gray image assets are required.
        const hoverFaceBase = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/svg/';
        const hoverFaceFiles = [
          '1f600.svg','1f60e.svg','1f913.svg','1f61d.svg','1f612.svg','1f601.svg',
          '1f609.svg','1f973.svg','1f60f.svg','1f920.svg','1f607.svg','1f642.svg'
        ];
        const hoverFaceSelector = [
          '.arx-inline-emoji-trigger', '.arx-auto-emoji-trigger',
          '[data-ticket-emoji-open]', '[data-role-emoji-open]',
          '[data-command-emoji-open]', '[data-arx-global-emoji-open]'
        ].join(',');
        for (const file of hoverFaceFiles) {
          const preload = new Image();
          preload.decoding = 'async';
          preload.src = hoverFaceBase + file;
        }
        const setHoverFace = (button, rotate = false) => {
          if (!(button instanceof HTMLElement)) return;
          const preserveLabel=button.dataset.arxEmojiPreserveLabel==='1';
          let img = preserveLabel ? button.querySelector('[data-arx-emoji-face]') : button.querySelector(':scope > img');
          if (!img) {
            img = document.createElement('img');
            img.alt = ''; img.draggable = false;
            if(preserveLabel){img.dataset.arxEmojiFace='1';button.prepend(img);}else button.replaceChildren(img);
          }
          let current = Number(button.dataset.arxHoverFaceIndex);
          if (!Number.isInteger(current) || current < 0 || current >= hoverFaceFiles.length) {
            current = Math.floor(Math.random() * hoverFaceFiles.length);
          } else if (rotate && hoverFaceFiles.length > 1) {
            let next = current;
            while (next === current) next = Math.floor(Math.random() * hoverFaceFiles.length);
            current = next;
          }
          button.dataset.arxHoverFaceIndex = String(current);
          button.classList.add('arx-emoji-hover-face');
          const nextSrc = hoverFaceBase + hoverFaceFiles[current];
          if (img.getAttribute('src') !== nextSrc) img.src = nextSrc;
        };
        const seedHoverFaces = root => {
          if (!(root instanceof Element || root instanceof Document)) return;
          if (root.matches?.(hoverFaceSelector)) setHoverFace(root);
          root.querySelectorAll?.(hoverFaceSelector).forEach(button => setHoverFace(button));
        };

        const excludedNames = new Set([
          'rank_command','leaderboard_command','command_name','reward_code','existing_code',
          'timezone','user_id','accent_color','color','emoji','button_emoji','source_input','stream_url','confirm_text'
        ]);
        const isTechnical = field => {
          if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) return true;
          if (field.disabled || field.readOnly || field.hidden || field.closest('[data-arx-no-emoji],.settings-page')) return true;
          if (field instanceof HTMLInputElement) {
            const type = String(field.type || 'text').toLowerCase();
            if (type !== 'text') return true;
            if (field.inputMode === 'numeric' || field.pattern === '[0-9]{15,22}') return true;
          }
          if (field.matches('.role-emoji-search,.giveaway-emoji-search,[data-ticket-emoji-search],[data-arx-global-emoji-search]')) return true;
          if (field.closest('.ticket-standard-control-label')) return true;
          if (field.closest('dialog')) return true;
          if (field.closest('.emoji-upload-card,#arxBotChatComposer')) return true;
          const name = String(field.name || '').trim().toLowerCase();
          const cls = String(field.className || '').toLowerCase();
          const placeholder = String(field.getAttribute('placeholder') || '').toLowerCase();
          if (excludedNames.has(name)) return true;
          if (/(^|_)(?:guild|channel|role|member|user|message|bot)_id$/.test(name)) return true;
          if (/(?:^|_)(?:url|token|secret|api_key|license_key|hex)$/.test(name)) return true;
          if (/(?:^|_)(?:color|colour)(?:_|$)/.test(name) || /color-hex|colour-hex/.test(cls)) return true;
          if (name.startsWith('panel_color_')) return true;
          if (/^(?:https?:\/\/|example\.com)/.test(placeholder)) return true;
          if (/search/.test(cls) || field.getAttribute('role') === 'searchbox') return true;
          return false;
        };

        const insertAtCaret = (field, value) => {
          if (!field || !value) return;
          const current = String(field.value || '');
          const start = Number.isInteger(field.selectionStart) ? field.selectionStart : current.length;
          const end = Number.isInteger(field.selectionEnd) ? field.selectionEnd : start;
          const max = Number(field.maxLength || 0);
          let next = current.slice(0, start) + value + current.slice(end);
          if (max > 0) next = next.slice(0, max);
          field.value = next;
          const caret = Math.min(start + value.length, next.length);
          try { field.setSelectionRange(caret, caret); } catch (_) {}
          field.dispatchEvent(new Event('input', {bubbles:true}));
          field.dispatchEvent(new Event('change', {bubbles:true}));
          field.focus();
        };

        const cacheRoot = window.__arxUniversalEmojiServerCache || (window.__arxUniversalEmojiServerCache = new Map());
        const getServerItems = async () => {
          if (!guildId) return [];
          const cached = cacheRoot.get(guildId);
          if (cached && Date.now() - cached.at < 60000) return cached.items;
          const response = await fetch(`/guild/${encodeURIComponent(guildId)}/emoji-picker-data`, {
            credentials:'same-origin', headers:{'Accept':'application/json'}
          });
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const data = await response.json();
          const items = Array.isArray(data.items) ? data.items : [];
          cacheRoot.set(guildId, {at:Date.now(), items});
          return items;
        };

        const prepareDialog = async () => {
          if (catalogApi) return catalogApi;
          if (preparePromise) return preparePromise;
          preparePromise = (async () => {
            dialog.setAttribute('aria-busy','true');
            let items = [];
            try { items = await getServerItems(); } catch (_) { items = []; }
            if (serverGrid) {
              serverGrid.replaceChildren();
              if (items.length) {
                for (const item of items) {
                  const button = document.createElement('button');
                  button.type = 'button';
                  button.className = 'role-emoji-option';
                  button.dataset.globalEmoji = String(item.value || '');
                  button.dataset.globalEmojiName = String(item.name || '');
                  const img = document.createElement('img');
                  img.src = String(item.url || '');
                  img.alt = `:${String(item.name || '')}:`;
                  img.loading = 'lazy'; img.decoding = 'async';
                  const small = document.createElement('small');
                  small.textContent = String(item.name || '');
                  button.append(img, small); serverGrid.append(button);
                }
              } else {
                const empty = document.createElement('span');
                empty.className = 'section-note'; empty.textContent = '—'; serverGrid.append(empty);
              }
            }
            catalogApi = window.ARXBotCommandsEmoji.mount({
              grid:nativeGrid, search, dataAttribute:'data-global-emoji', serverGrid
            });
            dialog.removeAttribute('aria-busy');
            return catalogApi;
          })().finally(() => { preparePromise = null; });
          return preparePromise;
        };

        const openFor = async field => {
          activeTarget = field;
          try { dialog.showModal(); } catch (_) { return; }
          if (search) search.value = '';
          try { await prepareDialog(); catalogApi?.reset?.(); } catch (_) {}
          setTimeout(() => search?.focus(), 0);
        };

        const normalizeExistingTrigger = field => {
          const host = field.closest('.arx-emoji-field-wrap,.role-emoji-field,.custom-command-input-with-action,.custom-command-textarea-wrap');
          const trigger = host?.querySelector(':scope > .arx-inline-emoji-trigger,:scope > .ticket-inline-emoji-button,:scope > .role-inline-emoji-button,:scope > .custom-command-emoji-open,:scope > .custom-command-emoji-floating');
          if (trigger && field instanceof HTMLTextAreaElement) host.classList.add('arx-emoji-textarea-wrap');
          return Boolean(trigger);
        };

        const enhance = field => {
          if (isTechnical(field) || field.dataset.arxEmojiEnhanced === '1') return;
          field.dataset.arxEmojiEnhanced = '1';
          if (normalizeExistingTrigger(field)) return;
          const parent = field.parentNode;
          if (!parent) return;
          const wrap = document.createElement('span');
          wrap.className = `arx-auto-emoji-wrap${field instanceof HTMLTextAreaElement ? ' arx-auto-emoji-textarea' : ''}`;
          parent.insertBefore(wrap, field);
          wrap.append(field);
          const button = document.createElement('button');
          button.type = 'button'; button.className = 'arx-auto-emoji-trigger';
          button.setAttribute('aria-label', chooseLabel); button.title = chooseLabel;
          button.dataset.arxGlobalEmojiOpen = '1';
          const img = document.createElement('img');
          img.src = '/static/emoji_categories/people.png'; img.alt = ''; img.draggable = false;
          button.append(img); wrap.append(button);
          setHoverFace(button);
        };

        const scan = root => {
          if (!(root instanceof Element || root instanceof Document)) return;
          if (root.matches?.('input,textarea')) enhance(root);
          root.querySelectorAll?.('input,textarea').forEach(enhance);
          seedHoverFaces(root);
        };
        scan(main);
        const observer = new MutationObserver(records => {
          for (const record of records) for (const node of record.addedNodes) if (node instanceof Element) scan(node);
        });
        observer.observe(main, {childList:true, subtree:true});
        controller.signal.addEventListener('abort', () => observer.disconnect(), {once:true});

        main.addEventListener('mouseover', event => {
          const button = event.target.closest?.(hoverFaceSelector);
          if (!button || !main.contains(button)) return;
          const from = event.relatedTarget;
          if (from instanceof Node && button.contains(from)) return;
          setHoverFace(button, true);
        });

        main.addEventListener('click', event => {
          const button = event.target.closest('[data-arx-global-emoji-open]');
          if (!button) return;
          const explicitTarget=String(button.dataset.arxGlobalEmojiTarget||'').trim();
          const field = (explicitTarget ? document.getElementById(explicitTarget) : null) || button.closest('.arx-auto-emoji-wrap')?.querySelector('input,textarea');
          if (field) openFor(field);
        });
        dialog.querySelector('[data-arx-global-emoji-close]')?.addEventListener('click', () => dialog.close());
        dialog.addEventListener('click', event => {
          const button = event.target.closest('[data-global-emoji]');
          if (!button || !activeTarget) return;
          insertAtCaret(activeTarget, button.dataset.globalEmoji || '');
          dialog.close();
        });
        dialog.addEventListener('close', () => { activeTarget = null; });
      })();


    } finally {
      EventTarget.prototype.addEventListener = nativeAddEventListener;
      window.setInterval = nativeSetInterval;
    }
  }

  window.ARXAppBoot = arxAppBoot;
  arxAppBoot();
})();

/* V300.1 DisWiki copy controls */
(() => {
  const writeClipboard = async (value) => {
    const text = String(value ?? "");
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }
    const helper = document.createElement("textarea");
    helper.value = text;
    helper.setAttribute("readonly", "");
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    helper.style.pointerEvents = "none";
    document.body.append(helper);
    helper.select();
    document.execCommand("copy");
    helper.remove();
  };

  document.addEventListener("click", async (event) => {
    const button = event.target.closest("[data-diswiki-copy]");
    if (!button) return;

    const example = button.closest(".diswiki-color-example, .diswiki-ansi-swatch");
    const source = example?.querySelector("[data-diswiki-copy-source]");
    const ansiCode = String(button.dataset.diswikiAnsi || "").trim();
    if (!source && !ansiCode) return;

    let value = source?.textContent || "";
    if (ansiCode) {
      const ansiText = String(button.dataset.diswikiAnsiText || "ARX");
      value = "```ansi\n\u001b[1;" + ansiCode + "m" + ansiText + "\u001b[0m\n```";
    }

    const defaultLabel = button.dataset.defaultLabel || button.textContent || "";
    button.dataset.defaultLabel = defaultLabel;
    try {
      await writeClipboard(value);
      button.textContent = button.dataset.copiedLabel || defaultLabel;
      button.classList.add("is-copied");
      window.setTimeout(() => {
        button.textContent = defaultLabel;
        button.classList.remove("is-copied");
      }, 1400);
    } catch (_) {
      button.textContent = defaultLabel;
      button.classList.remove("is-copied");
    }
  });
})();

/* V300.230 — Bot Profile attach/invite/admin live sync. Scoped to Bot Profile only. */
(() => {
  const ajaxHeaders = {"X-ARX-Bot-Profile-Ajax": "1", "X-Requested-With": "XMLHttpRequest"};
  let refreshPromise = null;
  const pollers = new Map();

  const roster = () => document.querySelector('[data-bot-profile-roster]');
  const guildId = () => Number(roster()?.dataset.guildId || 0);

  const refreshRoster = async () => {
    const current = roster();
    if (!current || refreshPromise) return refreshPromise;
    current.classList.add('is-refreshing');
    refreshPromise = (async () => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('_arx_bot_profile_refresh', String(Date.now()));
        const response = await fetch(url.toString(), {
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {"X-Requested-With": "XMLHttpRequest"}
        });
        if (!response.ok) return;
        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const incoming = doc.querySelector('[data-bot-profile-roster]');
        const mounted = roster();
        if (incoming && mounted) mounted.replaceWith(incoming);
      } catch (_) {
        // The existing page remains usable if a transient refresh request fails.
      } finally {
        roster()?.classList.remove('is-refreshing');
        refreshPromise = null;
      }
    })();
    return refreshPromise;
  };

  const fetchBotStatus = async (botUserId) => {
    const gid = guildId();
    if (!gid || !botUserId) return null;
    try {
      const response = await fetch(`/api/guild/${gid}/bots/${botUserId}/status?_=${Date.now()}`, {
        credentials: 'same-origin',
        cache: 'no-store',
        headers: {"X-Requested-With": "XMLHttpRequest"}
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (_) {
      return null;
    }
  };

  const startPoll = (botUserId, mode = 'guild') => {
    const key = `${botUserId}:${mode}`;
    if (pollers.has(key)) return;
    const started = Date.now();
    let lastSignature = '';
    const tick = async () => {
      if (!roster() || Date.now() - started > 120000) {
        clearInterval(timer);
        pollers.delete(key);
        return;
      }
      const state = await fetchBotStatus(botUserId);
      if (!state) return;
      if (state.linked !== false && state.state_known === false) return;
      const signature = [state.linked, state.in_guild, state.has_administrator, state.runtime_status, state.last_error || ''].join(':');
      if (signature !== lastSignature) {
        lastSignature = signature;
        await refreshRoster();
      }
      const complete = mode === 'admin'
        ? Boolean(state.in_guild && state.has_administrator)
        : Boolean(state.in_guild);
      if (complete || state.linked === false) {
        clearInterval(timer);
        pollers.delete(key);
        await refreshRoster();
      }
    };
    const timer = window.setInterval(tick, 1800);
    pollers.set(key, timer);
    window.setTimeout(tick, 350);
  };

  const attachAndAuthorize = async ({botUserId, attachUrl, fallbackInstallUrl}) => {
    if (!botUserId || !attachUrl) return;
    let popup = null;
    try { popup = window.open('about:blank', `arx-bot-install-${botUserId}`, 'popup,width=760,height=860'); } catch (_) {}
    try {
      const response = await fetch(attachUrl, {
        method: 'POST',
        credentials: 'same-origin',
        cache: 'no-store',
        headers: ajaxHeaders
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.ok) throw new Error(data.detail || 'attach_failed');
      const installUrl = String(data.install_url || fallbackInstallUrl || '').trim();
      if (data.install_required && installUrl && installUrl !== '#') {
        if (popup && !popup.closed) popup.location.href = installUrl;
        else window.location.assign(installUrl);
      } else if (popup && !popup.closed) {
        popup.close();
      }
      await refreshRoster();
      if (data.install_required) startPoll(botUserId, 'guild');
      else if (data.in_guild && !data.has_administrator) startPoll(botUserId, 'guild');
    } catch (_) {
      if (popup && !popup.closed) popup.close();
      await refreshRoster();
    }
  };

  document.addEventListener('submit', (event) => {
    if (event.defaultPrevented) return;
    const form = event.target.closest?.('form[data-managed-bot-attach]');
    if (!form || !roster()) return;
    event.preventDefault();
    const botUserId = Number(form.dataset.botUserId || 0);
    attachAndAuthorize({botUserId, attachUrl: form.action, fallbackInstallUrl: ''});
  });

  document.addEventListener('click', async (event) => {
    const availableInstall = event.target.closest?.('[data-managed-bot-install-and-attach]');
    if (availableInstall && roster()) {
      event.preventDefault();
      const botUserId = Number(availableInstall.dataset.botUserId || 0);
      await attachAndAuthorize({
        botUserId,
        attachUrl: availableInstall.dataset.attachUrl || '',
        fallbackInstallUrl: availableInstall.href || ''
      });
      return;
    }

    const install = event.target.closest?.('[data-managed-bot-install]');
    if (install && roster()) {
      const botUserId = Number(install.dataset.botUserId || 0);
      if (botUserId) startPoll(botUserId, 'guild');
      return;
    }

    const admin = event.target.closest?.('[data-managed-bot-admin]');
    if (admin && roster()) {
      const botUserId = Number(admin.dataset.botUserId || 0);
      if (botUserId) startPoll(botUserId, 'admin');
      return;
    }

    const arxDisconnectButton = event.target.closest?.('[data-bot-profile-roster] form[action$="/bots/arx/disconnect"] button');
    if (arxDisconnectButton && roster()) {
      event.preventDefault();
      const form = arxDisconnectButton.closest('form');
      if (!form) return;
      const confirmation = String(form.dataset.confirm || '').trim();
      if (confirmation && !window.confirm(confirmation)) return;
      arxDisconnectButton.disabled = true;
      try {
        await fetch(form.action, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: {"X-Requested-With": "XMLHttpRequest"}
        });
      } finally {
        await refreshRoster();
      }
      return;
    }

    const disconnectButton = event.target.closest?.('form[data-managed-bot-disconnect] button');
    if (disconnectButton && roster()) {
      event.preventDefault();
      const form = disconnectButton.closest('form[data-managed-bot-disconnect]');
      if (!form) return;
      const confirmation = String(form.dataset.confirm || '').trim();
      if (confirmation && !window.confirm(confirmation)) return;
      disconnectButton.disabled = true;
      try {
        await fetch(form.action, {
          method: 'POST',
          credentials: 'same-origin',
          cache: 'no-store',
          headers: ajaxHeaders
        });
      } finally {
        await refreshRoster();
      }
    }
  });

  let focusRefreshTimer = 0;
  const refreshAfterDiscord = () => {
    if (!roster()) return;
    window.clearTimeout(focusRefreshTimer);
    focusRefreshTimer = window.setTimeout(refreshRoster, 250);
  };
  window.addEventListener('focus', refreshAfterDiscord);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshAfterDiscord(); });
})();

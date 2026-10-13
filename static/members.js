(() => {
  'use strict';
  const t = window.ARXI18n.t;
  const currentUiLanguage = window.ARXI18n.language;
  const scope = document.querySelector('[data-guild-id].member-workspace, [data-guild-id].member-list');
  if (!scope) return;
  const gid = scope.dataset.guildId;
  const menu = document.getElementById('member-menu');
  const feedback = document.getElementById('member-feedback');
  let menuTrigger, queueBusy = false, pendingForm, profileEdited = false;
  scope.addEventListener('input', () => { profileEdited = true; });
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  const tell = (element, message, error = false) => {
    element.textContent = message;
    element.classList.toggle('error-text', error);
  };
  async function request(url, options = {}) {
    const response = await fetch(url, {...options, headers: {Accept: 'application/json', ...options.headers}});
    const data = await response.json();
    if (!response.ok) throw new Error(typeof data.detail === 'string' ? data.detail : t("members.could_not_complete_the_action_check_the_fields"));
    return data;
  }
  async function awaitAction(id, element) {
    for (let n = 0; n < 100; n++) {
      const data = await request(`/api/guilds/${gid}/actions/${id}`);
      if (data.status === 'failed') throw new Error(data.error || t("members.the_discord_action_failed"));
      if (data.status === 'completed') return data.result || {};
      tell(element, data.status === 'running' ? t("members.applying_the_discord_action") : t("members.waiting_for_arx"));
      await pause(900);
    }
    throw new Error(t("members.the_action_is_not_complete_yet_make_sure_arx_is_running_the_action_rem"));
  }
  function closeMenu(restoreFocus = false) {
    menu.hidden = true;
    if (menuTrigger) { menuTrigger.setAttribute('aria-expanded', 'false'); if (restoreFocus) menuTrigger.focus(); }
  }
  document.querySelectorAll('.member-trigger').forEach(button => button.addEventListener('click', event => {
    event.stopPropagation();
    const wasOpen = menuTrigger === button && !menu.hidden;
    closeMenu(); if (wasOpen) return;
    menuTrigger = button;
    // Discord snowflakes remain strings in the DOM and all URLs.
    document.getElementById('member-menu-profile').href = `/guild/${gid}/member/${button.dataset.userId}`;
    menu.hidden = false;
    const rect = button.getBoundingClientRect();
    menu.style.left = `${Math.max(8, Math.min(rect.left, innerWidth - menu.offsetWidth - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(rect.bottom + 7, innerHeight - menu.offsetHeight - 8))}px`;
    button.setAttribute('aria-expanded', 'true');
    menu.querySelector('a').focus();
  }));
  document.addEventListener('click', event => { if (!menu.contains(event.target)) closeMenu(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !menu.hidden) closeMenu(true); });
  window.addEventListener('resize', () => closeMenu());
  window.addEventListener('scroll', () => closeMenu(), true);
  document.querySelectorAll('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
  document.querySelectorAll('[data-open-dialog]').forEach(button => button.addEventListener('click', () => document.getElementById(button.dataset.openDialog).showModal()));
  function localTime(value) {
    if (!value) return '—';
    const iso = value.replace(' ', 'T');
    const date = new Date(/[Zz]$|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString(currentUiLanguage);
  }
  document.querySelectorAll('[data-local-time]').forEach(time => { time.textContent = localTime(time.dataset.localTime); });

  const ticketPanel = document.getElementById('ticket-conversation');
  const ticketFeed = document.getElementById('ticket-chat-feed');
  const ticketForm = document.getElementById('ticket-reply-form');
  const ticketText = document.getElementById('ticket-reply-text');
  const ticketButton = document.getElementById('ticket-reply-button');
  const ticketState = document.getElementById('ticket-conversation-state');
  const ticketSubtitle = document.getElementById('ticket-conversation-subtitle');
  const ticketFeedback = document.getElementById('ticket-feedback');
  let ticketTimer = null, ticketSignature = '';

  function renderTicketMessages(messages) {
    if (!ticketFeed) return;
    const signature = JSON.stringify(messages);
    if (signature === ticketSignature) return;
    const atBottom = ticketFeed.scrollHeight - ticketFeed.scrollTop - ticketFeed.clientHeight < 80;
    ticketSignature = signature;
    ticketFeed.replaceChildren();
    if (!messages.length) {
      const empty = document.createElement('div');
      empty.className = 'profile-empty';
      empty.textContent = t("member.no_messages_recorded_for_this_ticket");
      ticketFeed.append(empty);
      return;
    }
    for (const message of messages) {
      const article = document.createElement('article');
      article.className = `ticket-message ${message.is_bot ? 'bot' : (message.is_staff ? 'staff' : 'member')} ${message.deleted_at ? 'deleted' : ''}`;
      const meta = document.createElement('div'); meta.className = 'ticket-message-meta';
      const author = document.createElement('strong'); author.textContent = message.author_name || t("server.unknown_user"); meta.append(author);
      if (message.is_bot || message.is_staff) { const badge = document.createElement('span'); badge.textContent = message.is_bot ? t("common.bot") : t("member.staff"); meta.append(badge); }
      const time = document.createElement('time'); time.textContent = localTime(message.created_at); meta.append(time);
      const content = document.createElement('p'); content.textContent = message.deleted_at ? t("module.message_deleted") : (message.content || '—');
      article.append(meta, content);
      if (!message.deleted_at && Array.isArray(message.attachments) && message.attachments.length) {
        const attachments = document.createElement('div'); attachments.className = 'ticket-attachments';
        for (const item of message.attachments) {
          if (!item || !item.url) continue;
          let url; try { url = new URL(item.url); } catch { continue; }
          if (url.protocol !== 'https:') continue;
          const link = document.createElement('a'); link.href = url.href; link.target = '_blank'; link.rel = 'noopener'; link.textContent = item.name || t("member.attachment"); attachments.append(link);
        }
        if (attachments.childElementCount) article.append(attachments);
      }
      ticketFeed.append(article);
    }
    if (atBottom) ticketFeed.scrollTop = ticketFeed.scrollHeight;
  }

  function applyTicketState(ticket) {
    if (!ticketPanel || !ticketForm || !ticketText || !ticketButton || !ticketState) return;
    const open = ticket.status === 'open';
    ticketState.textContent = open ? t("module.open") : t("module.off");
    ticketState.classList.toggle('open', open); ticketState.classList.toggle('closed', !open);
    if (ticketSubtitle) ticketSubtitle.textContent = `${ticket.category_label || t("common.support")} · ${open ? t("member.open_conversation") : t("member.closed_conversation")}`;
    ticketText.disabled = !open; ticketText.required = open;
    ticketText.placeholder = open ? t("member.write_your_reply_as_a_staff_member") : t("member.this_ticket_is_closed_and_cannot_receive_replies");
    if (!open) ticketText.value = '';
    ticketButton.disabled = !open;
    ticketButton.textContent = open ? t("member.send_reply_to_discord") : t("member.this_ticket_is_closed_and_cannot_receive_replies_2");
    ticketButton.classList.toggle('primary', open); ticketButton.classList.toggle('ghost', !open);
    ticketForm.classList.toggle('ticket-closed-compose', !open);
  }

  async function refreshTicket() {
    if (!ticketPanel) return;
    const ticketId = ticketPanel.dataset.ticketId, userId = ticketPanel.dataset.ticketUserId;
    if (!ticketId || !userId) return;
    try {
      const data = await request(`/api/guilds/${gid}/member/${userId}/ticket/${ticketId}`);
      applyTicketState(data.ticket); renderTicketMessages(data.messages || []);
    } catch (error) { if (ticketFeedback) tell(ticketFeedback, error.message, true); }
  }

  if (ticketPanel) {
    refreshTicket();
    ticketTimer = setInterval(refreshTicket, 3000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshTicket(); });
  }
  ticketForm?.addEventListener('submit', async event => {
    event.preventDefault();
    if (!ticketText || !ticketButton || ticketButton.disabled) return;
    const message = ticketText.value.trim();
    if (!message) { tell(ticketFeedback, t("members.reply_cannot_be_empty"), true); return; }
    ticketButton.disabled = true;
    try {
      const queued = await request(ticketForm.action, {method:'POST', body:new FormData(ticketForm)});
      await awaitAction(queued.action_id, ticketFeedback);
      ticketText.value = '';
      tell(ticketFeedback, t("members.reply_sent_to_the_discord_ticket_channel"));
      await refreshTicket();
    } catch (error) {
      tell(ticketFeedback, error.message, true);
      await refreshTicket();
    } finally {
      if (ticketState?.classList.contains('open')) ticketButton.disabled = false;
    }
  });
  const moderationReasonToggle = document.getElementById('moderation-reason-enabled');
  const moderationReasonInput = document.getElementById('moderation-reason');
  const syncModerationReason = () => {
    if (!moderationReasonInput) return;
    const enabled = !!moderationReasonToggle?.checked;
    moderationReasonInput.disabled = !enabled;
    if (!enabled) moderationReasonInput.value = '';
  };
  moderationReasonToggle?.addEventListener('change', syncModerationReason);
  syncModerationReason();

  async function submitQueueForm(form) {
    if (queueBusy) return;
    queueBusy = true;
    const buttons = [...document.querySelectorAll('[data-queue-form] button')]; buttons.forEach(b => { b.disabled = true; });
    const body = new FormData(form);
    if (form.matches('[data-moderation-form]')) {
      const reasonEnabled = document.getElementById('moderation-reason-enabled')?.checked ?? false;
      const reason = reasonEnabled ? (document.getElementById('moderation-reason')?.value.trim() || '') : '';
      body.set('reason', reason);
    }
    try {
      const queued = await request(form.action, {method:'POST',body});
      const result = await awaitAction(queued.action_id, feedback);
      sessionStorage.setItem(`arx-member-result:${location.pathname}`, (result.warnings || []).join(' ') || t("members.action_completed"));
      location.reload();
    } catch (error) { tell(feedback, error.message, true); }
    finally { queueBusy = false; buttons.forEach(b => { b.disabled = false; }); }
  }
  const confirmDialog = document.getElementById('member-confirm');
  document.querySelectorAll('[data-queue-form]').forEach(form => form.addEventListener('submit', event => {
    event.preventDefault(); if (queueBusy) return;
    if (form.dataset.confirm) { pendingForm = form; document.getElementById('confirm-text').textContent = form.dataset.confirm; confirmDialog.showModal(); }
    else submitQueueForm(form);
  }));
  document.getElementById('confirm-apply').addEventListener('click', () => { const form = pendingForm; confirmDialog.close(); if (form) submitQueueForm(form); });
  confirmDialog.addEventListener('close', () => { pendingForm = null; });
  let refreshing = false;
  async function refreshProfile() {
    if (refreshing || queueBusy) return; refreshing = true;
    const button = document.querySelector('[data-refresh-profile]'); if (button) button.disabled = true;
    try { const queued = await request(`/api/guilds/${gid}/member/${scope.dataset.userId}/refresh`, {method:'POST'}); await awaitAction(queued.action_id, feedback); if (!confirmDialog.open && !queueBusy && !profileEdited) location.reload(); else tell(feedback, t("members.profile_refreshed_your_input_is_preserved_reload_the_page_to_see_the_l")); }
    catch (error) { tell(feedback, error.message, true); }
    finally { refreshing = false; if (button) button.disabled = false; }
  }
  document.querySelector('[data-refresh-profile]')?.addEventListener('click', refreshProfile);
  const previousResult = sessionStorage.getItem(`arx-member-result:${location.pathname}`);
  if (previousResult) { tell(feedback, previousResult); sessionStorage.removeItem(`arx-member-result:${location.pathname}`); }
  if (scope.dataset.autoRefresh === 'true') refreshProfile();
})();

/* ARX V300.302 – Presentation-only enhancement of subscription confirmation dialogs.
   No payment actions, API endpoints, renewal state, translations, or event handlers
   are replaced. This file must be included by the CURRENT templates/module.html. */
(() => {
  'use strict';
  if (window.__ARXSubscriptionModalVisualsV300302) return;
  window.__ARXSubscriptionModalVisualsV300302 = true;

  const IMG = Object.freeze({
    cancel: '/static/arx_subscription_renewal_cancel.png',
    resume: '/static/arx_subscription_renewal_continue.png'
  });
  // Titles/buttons use the existing translated text. These markers only distinguish
  // the two dialogs; they do not replace or translate UI copy.
  const WORDS = Object.freeze({
    resume: [
      'yenilemeyi devam', 'yenilemeyi etkin', 'yenilemeyi yeniden',
      'resume renewal', 'reactivate renewal', 'restart renewal', 'enable auto-renew',
      'renewal resume', 'continue renewal', 'restore renewal',
      'réactiver le renouvellement', 'reprendre le renouvellement',
      'reanudar la renovación', 'reactivar la renovación',
      'verlängerung fortsetzen', 'verlängerung reaktivieren',
      'retomar renovação', 'reativar renovação', 'retomar a renovação',
      'riprendi il rinnovo', 'riattiva il rinnovo',
      'återuppta förnyelsen', 'återaktivera förnyelsen',
      'hervat verlenging', 'verlenging hervatten', 'verlenging opnieuw activeren',
      'wznów odnawianie', 'włącz odnawianie',
      '再開', '更新を再開', '更新を有効', '갱신 재개', '갱신 다시',
      'возобновить продление', 'возобновить подписку',
      'استئناف التجديد', 'إعادة تفعيل التجديد', 'إعادة تنشيط التجديد'
    ],
    cancel: [
      'aboneliği sonlandır', 'otomatik yenilemeyi kapat', 'yenilemeyi iptal',
      'cancel subscription', 'stop renewal', 'cancel renewal', 'disable auto-renew',
      'end subscription', 'turn off renewal',
      'résilier l’abonnement', 'résilier abonnement', 'arrêter le renouvellement',
      'annuler le renouvellement', 'annuler l’abonnement',
      'cancelar suscripción', 'cancelar la suscripción', 'desactivar renovación',
      'kündigen', 'automatische verlängerung deaktivieren', 'verlängerung stoppen',
      'cancelar assinatura', 'cancelar a assinatura', 'desativar renovação',
      'annulla abbonamento', 'disattiva il rinnovo',
      'avsluta prenumerationen', 'stoppa förnyelse',
      'abonnement opzeggen', 'verlenging stoppen',
      'anuluj subskrypcję', 'wyłącz odnawianie',
      'サブスクリプションを解約', '更新を停止', '自動更新を停止',
      '구독 취소', '자동 갱신 중지', 'отменить подписку', 'отключить продление',
      'إلغاء الاشتراك', 'إيقاف التجديد', 'إلغاء التجديد'
    ]
  });

  const normalize = value => String(value || '').trim().toLocaleLowerCase();
  const isVisible = el => {
    if (!el || !el.isConnected || el.hidden || el.closest('[hidden],[inert]')) return false;
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  };
  const infer = value => {
    const t = normalize(value);
    if (!t) return null;
    if (WORDS.resume.some(phrase => t.includes(phrase))) return 'resume';
    if (WORDS.cancel.some(phrase => t.includes(phrase))) return 'cancel';
    return null;
  };
  let lastClickedIntent = null;
  let scheduled = false;

  document.addEventListener('click', event => {
    const button = event.target.closest?.('button,[role="button"]');
    if (!button) return;
    // Intent is recorded only for subscription controls inside settings,
    // never for arbitrary confirmations in other ARX modules.
    if (!button.closest('.settings-cancel-row,[class*="subscription-action"],[data-subscription-action]')) return;
    lastClickedIntent = infer(button.textContent || button.getAttribute('aria-label'));
    schedule();
  }, true);

  function findDialog(title) {
    let el = title;
    while (el && el !== document.body) {
      if (el.matches?.('dialog,[role="dialog"],[aria-modal="true"],.arx-confirm-modal,[class*="confirm-modal"],[class*="confirmation-modal"],[class*="confirm-dialog"],[class*="confirmation-dialog"],[class*="subscription-dialog"],[class*="subscription-modal"]')) return el;
      el = el.parentElement;
    }
    return null;
  }
  function getHeader(title, dialog) {
    const titleGroup = title.parentElement;
    const candidate = titleGroup?.parentElement;
    if (candidate && dialog.contains(candidate) && candidate !== dialog &&
        candidate.children.length >= 2 && candidate.children.length <= 4 &&
        !candidate.querySelector('button,input,textarea,form,p')) {
      const headings = candidate.querySelectorAll('h1,h2,h3,h4').length;
      if (headings === 1 && candidate.textContent.trim().length < 180) return {header:candidate, textGroup:titleGroup};
    }
    return {header:titleGroup, textGroup:null};
  }
  function stripOldIcon(header, textGroup) {
    for (const node of [...header.children]) {
      if (node === textGroup || node.classList.contains('arx-subscription-cat-illustration')) continue;
      if (node.contains(textGroup) || node.querySelector('button,a,input,textarea')) continue;
      const label = node.textContent.trim();
      const hasDecoration = node.matches?.('[class*="icon"],[class*="symbol"],[class*="emblem"]') || node.querySelector('svg,[class*="icon"],[class*="symbol"]') || /[◆♦◇⬥]/u.test(label);
      // The original 44x44 yellow diamond decoration has little/no readable text.
      if (label.length <= 3 && hasDecoration) node.remove();
    }
  }
  function centerActions(dialog) {
    const all = [...dialog.querySelectorAll('button')].filter(btn => isVisible(btn) &&
      !btn.closest('[hidden]') && !btn.matches('[aria-label="Close"],[data-close],.close,[class*="close"]') &&
      !/^[×✕x]$/i.test(btn.textContent.trim()));
    if (all.length < 2) return;
    const buttons = all.slice(-2);
    let actionParent = buttons[0].parentElement;
    if (actionParent !== buttons[1].parentElement) {
      while (actionParent && !actionParent.contains(buttons[1])) actionParent = actionParent.parentElement;
    }
    if (!actionParent || actionParent === dialog) return;
    if (!actionParent.classList.contains('arx-subscription-centered-actions')) {
      actionParent.classList.add('arx-subscription-centered-actions');
    }
  }
  function enhance(dialog, title, intent) {
    if (dialog.dataset.arxSubscriptionVisualKind === intent) {
      centerActions(dialog);
      return;
    }
    let {header, textGroup} = getHeader(title, dialog);
    if (!header) return;
    stripOldIcon(header, textGroup);
    if (!textGroup) {
      // The brand label and heading may be siblings rather than a text column.
      // Group them without recreating or translating the existing text.
      const wrapper = document.createElement('div');
      wrapper.className = 'arx-subscription-visual-titles';
      for (const child of [...header.children]) {
        if (child.nodeType === Node.ELEMENT_NODE && child.matches('h1,h2,h3,h4,small,span,[class*=\"eyebrow\"],[class*=\"title\"]')) {
          wrapper.appendChild(child);
        }
      }
      header.appendChild(wrapper);
      textGroup = wrapper;
    }
    const previous = header.querySelector(':scope > .arx-subscription-cat-illustration');
    if (previous) previous.remove();
    const image = document.createElement('img');
    image.className = 'arx-subscription-cat-illustration';
    image.src = IMG[intent];
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    image.loading = 'eager';
    image.decoding = 'async';
    header.prepend(image);
    header.classList.add('arx-subscription-illustrated-header');
    dialog.classList.add('arx-subscription-illustrated-dialog');
    dialog.dataset.arxSubscriptionVisualKind = intent;
    centerActions(dialog);
  }
  function scan() {
    scheduled = false;
    // Stay out of all other ARX modules and purchase dialogs.
    if (!/^\/guild\/\d+\/settings(?:\/|$)/.test(location.pathname)) return;
    const headings = document.querySelectorAll('h1,h2,h3,h4,[role="heading"]');
    for (const title of headings) {
      if (!isVisible(title)) continue;
      const dialog = findDialog(title);
      if (!dialog || !isVisible(dialog)) continue;
      // Confirmation dialogs show the ARX brand. Do not change unrelated dialogs.
      const headerText = title.parentElement?.textContent || '';
      if (!/ARX/i.test(headerText) && !/ARX/i.test(dialog.textContent.slice(0,70))) continue;
      const buttons = [...dialog.querySelectorAll('button')].map(x => x.textContent || '').join(' ');
      const intent = infer(title.textContent) || infer(buttons) || lastClickedIntent;
      if (!intent) continue;
      enhance(dialog, title, intent);
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(scan);
  }
  const css = `
    .arx-subscription-illustrated-header{display:flex!important;align-items:center!important;gap:14px!important;min-width:0!important;}
    .arx-subscription-illustrated-header>.arx-subscription-cat-illustration{width:112px!important;height:100px!important;object-fit:contain!important;flex:0 0 112px!important;display:block!important;max-width:none!important;background:transparent!important;box-shadow:none!important;}
    .arx-subscription-illustrated-header>:not(.arx-subscription-cat-illustration){min-width:0!important;}
    .arx-subscription-visual-titles{display:flex;flex-direction:column;gap:3px;}
    .arx-subscription-illustrated-dialog .arx-subscription-centered-actions{display:flex!important;flex-wrap:wrap!important;justify-content:center!important;align-items:center!important;gap:10px!important;margin-inline:auto!important;width:100%!important;}
    .arx-subscription-illustrated-dialog .arx-subscription-centered-actions>button{margin-inline:0!important;}
    @media(max-width:520px){
      .arx-subscription-illustrated-header{gap:10px!important;}
      .arx-subscription-illustrated-header>.arx-subscription-cat-illustration{width:82px!important;height:78px!important;flex-basis:82px!important;}
      .arx-subscription-illustrated-dialog .arx-subscription-centered-actions{gap:8px!important;}
      .arx-subscription-illustrated-dialog .arx-subscription-centered-actions>button{max-width:100%;}
    }`;
  const style = document.createElement('style');
  style.id = 'arx-subscription-modal-visuals-v300302';
  style.textContent = css;
  document.head.appendChild(style);
  new MutationObserver(schedule).observe(document.documentElement, {childList:true,subtree:true,attributes:true,attributeFilter:['open','hidden','style','class']});
  schedule();
})();

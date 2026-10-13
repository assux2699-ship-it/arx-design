/* ARX V300.287 — no duplicate checkout, no Lifetime purchase path. */
(function (global) {
  'use strict';
  function checkoutPayload(guildId, plan, period) {
    if (!/^[0-9]+$/.test(String(guildId)) || !['pro', 'premium_plus'].includes(plan) || !['monthly','yearly'].includes(period)) {
      throw new Error('invalid_checkout_selection');
    }
    return {guild_id: String(guildId), plan: plan, billing_period: period};
  }
  function paddlePayload(intent, guildId) {
    if (!intent || !/^pri_[a-z0-9_]+$/i.test(String(intent.price_id || '')) ||
        !['pro','premium_plus'].includes(intent.plan) || !intent.purchase_id || !intent.binding ||
        (typeof intent.user_id !== 'string' || !/^[0-9]+$/.test(intent.user_id))) throw new Error('invalid_checkout_intent');
    return {
      settings: {displayMode: 'overlay', theme: 'dark'},
      items: [{priceId: intent.price_id, quantity: 1}],
      customData: {
        arx_guild_id: String(guildId), arx_user_id: intent.user_id,
        arx_plan: intent.plan, arx_binding: intent.binding,
        arx_purchase_id: intent.purchase_id
      }
    };
  }
  function selectPrice(offers, plan, period) {
    return (offers || []).find(x => x && x.plan === plan && x.period === period && /^pri_/.test(x.price_id || '')) || null;
  }
  // Savings use cents so annual totals are exact, without floating point drift.
  const annualPricing = Object.freeze({
    pro: Object.freeze({monthlyCents: 399, yearlyCents: 2999}),
    premium_plus: Object.freeze({monthlyCents: 699, yearlyCents: 4999})
  });
  function annualSavings(plan) {
    const entry = annualPricing[plan];
    if (!entry) throw new Error('invalid_annual_plan');
    const twelveMonthsCents = entry.monthlyCents * 12;
    const savingsCents = twelveMonthsCents - entry.yearlyCents;
    return Object.freeze({
      amount: '$' + (savingsCents / 100).toFixed(2),
      percent: Math.round(100 * savingsCents / twelveMonthsCents),
      savingsCents
    });
  }
  function setup() {
    const dialog = document.getElementById('arxPurchaseDialog');
    const configNode = document.getElementById('arxPurchaseConfig');
    if (!dialog || !configNode) return;
    let config;
    try { config = JSON.parse(configNode.textContent); }
    catch (e) { console.error('ARX pricing configuration invalid', e); return; }
    const prices = config.offers || [];
    const feedback = dialog.querySelector('.arx-purchase-feedback');
    const heading = dialog.querySelector('[data-arx-guild-name]');
    let guild = null;
    let period = 'monthly';
    let paddleReady = false;
    // Baseline captions belong to the current storefront, not to a guild.
    // Subscriber management changes button.textContent in-place; preserve the
    // original translations so a later Free guild doesn't inherit that text.
    const purchaseLabels = new Map(Array.from(dialog.querySelectorAll('[data-arx-buy-plan]'),
      button => [button, button.textContent]));
    let selectionVersion = 0;
    function restorePurchaseLabels() {
      for (const [button, label] of purchaseLabels) {
        button.textContent = label;
        button.title = '';
      }
    }
    // The comparison stays non-modal for its entire lifetime. Native
    // showModal() moves it to the browser top layer, and closing that layer
    // when Paddle appears causes the black-to-bright background flash.
    const shade = document.createElement('div');
    shade.className = 'arx-purchase-screen-shade';
    shade.setAttribute('aria-hidden', 'true');
    document.body.appendChild(shade);
    let priorBodyOverflow = null;
    let pendingAnimation = 0;
    function openComparison() {
      if (dialog.open) return;
      priorBodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      dialog.show();
      dialog.scrollTop = 0;
      // Request a second frame so the opacity/position transitions animate
      // even when the modal opens on an otherwise idle tab.
      pendingAnimation = global.requestAnimationFrame(() => {
        pendingAnimation = global.requestAnimationFrame(() => {
          if (!dialog.open) return;
          shade.classList.add('is-visible');
          dialog.classList.add('arx-purchase-visible');
        });
      });
    }
    function dismissComparison() {
      ++selectionVersion;
      guild = null;
      global.cancelAnimationFrame(pendingAnimation);
      dialog.classList.remove('arx-purchase-visible');
      shade.classList.remove('is-visible');
      // Do not leave an invisible overlay that can block the page.
      dialog.close();
      document.body.style.overflow = priorBodyOverflow ?? '';
      priorBodyOverflow = null;
    }
    function message(text, level) {
      feedback.textContent = text || '';
      feedback.dataset.level = level || 'info';
    }
    function periodView() {
      dialog.querySelectorAll('[data-arx-period]').forEach(b => {
        b.setAttribute('aria-pressed', b.dataset.arxPeriod === period ? 'true' : 'false');
      });
      dialog.querySelectorAll('[data-arx-price-plan]').forEach(el => {
        const plan = el.dataset.arxPricePlan;
        const yearly = period === 'yearly';
        el.textContent = plan === 'pro' ? (yearly ? '$29.99' : '$3.99') : (yearly ? '$49.99' : '$6.99');
      });
      dialog.querySelectorAll('[data-arx-period-suffix]').forEach(el => {
        el.textContent = period === 'monthly' ? (config.text?.monthly || '/ month') : (config.text?.yearly || '/ year');
      });
      dialog.querySelectorAll('[data-arx-saving-plan]').forEach(el => {
        const yearly = period === 'yearly';
        el.hidden = !yearly;
        if (!yearly) { el.textContent = ''; return; }
        const saving = annualSavings(el.dataset.arxSavingPlan);
        const template = config.text?.annualSaving || 'Save {amount} vs. monthly billing ({percent}%)';
        el.textContent = template.replace('{amount}', saving.amount).replace('{percent}', String(saving.percent));
      });
      dialog.querySelectorAll('[data-arx-buy-plan]').forEach(button => {
        const available = !!(config.checkoutEnabled && selectPrice(prices, button.dataset.arxBuyPlan, period));
        // Only the current Free/first-purchase storefront may use the original
        // Buy captions. Existing subscribers retain the management labels.
        const gate = dialog.dataset.arxBillingGate;
        if (gate === 'checkout') {
          button.textContent = purchaseLabels.get(button) || button.textContent;
          button.disabled = !available;
          button.title = available ? '' :
            (config.text?.unavailable || 'This plan is not configured for checkout yet.');
        } else if (gate === 'loading') {
          // Never leak an old enabled subscriber button while fetching a new guild.
          button.disabled = true;
        }
      });
      // A manually granted, time-limited Premium tier can purchase its first
      // Paddle subscription, but may not repurchase its current tier. The
      // subscription controller alone knows those per-guild restrictions.
      // Reapply them after every generic checkout refresh (including the
      // finally block after Paddle.Checkout.open resolves).
      dialog.dispatchEvent(new Event('arx:purchase-view-updated'));
    }
    dialog.querySelectorAll('[data-arx-period]').forEach(button => button.addEventListener('click', () => {
      period = button.dataset.arxPeriod;
      periodView();
      message('');
    }));
    // After the management API determines that a server is Free, re-apply the
    // ordinary checkout configuration without opening a second subscription.
    dialog.addEventListener('arx:checkout-refresh', periodView);
    function showPricing(button) {
      ++selectionVersion;  // Invalidate unfinished intents for the previous guild.
      guild = button.dataset.guildId;
      dialog.dataset.arxBillingGuild = guild;
      restorePurchaseLabels();
      dialog.dataset.arxBillingGate =
        button.classList.contains('arx-existing-subscription') ? 'loading' : 'checkout';
      const card = button.closest('[data-guild-id]');
      const name = card?.querySelector('.server-card-copy h3')?.textContent?.trim() || guild;
      if (heading) heading.textContent = name;
      message('');
      periodView();
      openComparison();
    }
    document.querySelectorAll('.arx-premium-checkout').forEach(button => {
      button.addEventListener('click', () => showPricing(button));
    });
    function closePricing() { dismissComparison(); }
    dialog.querySelector('[data-arx-close]').addEventListener('click', closePricing);
    shade.addEventListener('click', () => {
      if (dialog.open && !dialog.classList.contains('arx-paddle-visible')) closePricing();
    });
    document.addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !dialog.open || dialog.classList.contains('arx-paddle-visible')) return;
      event.preventDefault();
      closePricing();
    });
    function initializePaddle() {
      if (paddleReady) return true;
      if (!global.Paddle || !config.clientToken) { message(config.text?.unavailable || 'Payment is not configured.', 'error'); return false; }
      try {
        if (config.sandbox) global.Paddle.Environment.set('sandbox');
        global.Paddle.Initialize({token: config.clientToken, eventCallback: event => {
          if (event?.name === 'checkout.error') {
            console.error('ARX Paddle checkout.error', event);
            dialog.classList.remove('arx-paddle-visible');
            message(config.text?.providerError || 'Paddle could not open checkout. Contact support and check the browser console.', 'error');
          } else if (event?.name === 'checkout.loaded' && dialog.open) {
            dialog.classList.add('arx-paddle-visible');
          } else if (event?.name === 'checkout.closed') {
            dialog.classList.remove('arx-paddle-visible');
          }
        }});
        paddleReady = true;
        return true;
      } catch (e) {
        console.error('ARX Paddle initialization failed', e);
        message(config.text?.providerError || 'Payment provider initialization failed.', 'error');
        return false;
      }
    }
    dialog.querySelectorAll('[data-arx-buy-plan]').forEach(button => button.addEventListener('click', async () => {
      const plan = button.dataset.arxBuyPlan;
      // Subscriber upgrades are handled by the authenticated management API.
      if (!guild || button.disabled || dialog.dataset.arxBillingGate !== 'checkout') return;
      const requestedGuild = guild;
      const requestedPeriod = period;
      const requestedVersion = selectionVersion;
      const isCurrent = () => requestedVersion === selectionVersion &&
        requestedGuild === guild && dialog.open &&
        dialog.dataset.arxBillingGate === 'checkout';
      if (!selectPrice(prices, plan, requestedPeriod)) {message(config.text?.unavailable || 'This billing plan is unavailable.', 'error'); return;}
      if (!initializePaddle()) return;
      button.disabled = true;
      message(config.text?.preparing || 'Preparing secure checkout...');
      try {
        const payload = checkoutPayload(requestedGuild, plan, requestedPeriod);
        const response = await fetch('/api/billing/checkout-intent', {
          method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'},
          body: JSON.stringify(payload)
        });
        if (!isCurrent()) return;  // Old request completed after switching servers.
        if (!response.ok) {
          let detail = '';
          try { detail = (await response.json()).detail || ''; } catch (_e) { /* no server detail */ }
          throw new Error('ARX checkout HTTP ' + response.status + ' ' + String(detail).slice(0,140));
        }
        const intent = await response.json();
        if (!isCurrent() || requestedPeriod !== period) return;
        if (intent.plan !== plan || intent.billing_period !== requestedPeriod ||
            intent.price_id !== selectPrice(prices, plan, requestedPeriod).price_id) throw new Error('ARX checkout price mismatch');
        const options = paddlePayload(intent, requestedGuild);
        if (!isCurrent()) return;
        await global.Paddle.Checkout.open(options);
        message('');
        // Leave the comparison dialog until checkout.loaded; Paddle can fail asynchronously.
      } catch (error) {
        if (!isCurrent()) return;
        console.error('ARX checkout failed', error);
        message(String(error.message || '').includes('existing_subscription_manage_required') ?
          (config.text?.existingSubscription || 'Manage your existing subscription instead of purchasing another.') :
          (config.text?.providerError || 'Unable to open checkout. Check your Paddle settings or contact support.'), 'error');
      } finally { if (isCurrent()) periodView(); }
    }));
    periodView();
  }
  global.ARXCheckoutUI = Object.freeze({checkoutPayload, paddlePayload, selectPrice, annualSavings});
  if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', setup);
})(typeof window === 'undefined' ? globalThis : window);
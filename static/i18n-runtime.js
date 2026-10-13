(() => {
  'use strict';

  const STORAGE_KEY = 'arx.ui.language.v1';
  const SUPPORTED = new Set(['en','fr','es','de','tr','ar','pt','ja','ru','ko']);
  const SOURCE_URL = '/static/i18n-sources.json?v=61';
  const BATCH_URL = '/api/i18n/batch';
  const CHUNK_SIZE = 70;
  const BASE_LANGUAGE = 'tr';

  let sourceSet = new Set();
  let currentLanguage = BASE_LANGUAGE;
  let pageTranslations = new Map();
  let generation = 0;
  let applying = 0;
  let observer = null;
  let nextId = 1;
  let mutationTimer = null;
  let switchInProgress = false;
  let lastSwitchSucceeded = true;

  const records = new Map();
  const attrs = new Map();

  const norm = v => String(v ?? '').replace(/\s+/g, ' ').trim();
  const normLang = raw => {
    if (!raw) return null;
    const tag = String(raw).trim().replace('_','-');
    const lower = tag.toLowerCase();
    if (lower === 'zh-tw' || lower === 'zh-hk' || lower.startsWith('zh-hant')) return 'ja';
    const base = lower.split('-')[0];
    return SUPPORTED.has(base) ? base : null;
  };
  const ignored = el => !el || !!el.closest('[data-i18n-ignore],code,pre,textarea,[contenteditable="true"],#app-language,.setup-language');
  const ws = v => ({leading:(String(v).match(/^\s*/)||[''])[0], trailing:(String(v).match(/\s*$/)||[''])[0]});

  function notice(message, kind='loading') {
    let el = document.getElementById('arx-i18n-notice');
    if (!message) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('div');
      el.id = 'arx-i18n-notice';
      el.style.cssText = [
        'position:fixed','right:20px','bottom:20px','z-index:999999',
        'max-width:min(420px,calc(100vw - 40px))','padding:12px 14px',
        'border-radius:10px','font:600 12px/1.4 Inter,Segoe UI,Arial,sans-serif',
        'box-shadow:0 10px 32px rgba(0,0,0,.35)','backdrop-filter:blur(10px)'
      ].join(';');
      document.body.appendChild(el);
    }
    el.style.background = kind === 'error' ? 'rgba(55,20,20,.96)' : 'rgba(17,19,23,.94)';
    el.style.border = kind === 'error' ? '1px solid #6b2f2f' : '1px solid #353a43';
    el.style.color = kind === 'error' ? '#ffaaaa' : '#e7e9ec';
    el.textContent = message;
  }

  function localResolve(source, language) {
    try {
      const v = window.ARX_UI_RESOLVE_SOURCE?.(source, language);
      return v ? norm(v) : null;
    } catch (_) {
      return null;
    }
  }

  function rememberText(node) {
    const el = node?.parentElement;
    if (!el || ignored(el) || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(el.tagName)) return;
    const source = norm(node.nodeValue);
    if (!source || !sourceSet.has(source)) return;
    const w = ws(node.nodeValue);
    records.set(node, {node, source, leading:w.leading, trailing:w.trailing, last:null});
  }

  function rememberAttrs(el) {
    if (!el || ignored(el)) return;
    if (!el.dataset.i18nPageId) el.dataset.i18nPageId = String(nextId++);
    const names = ['placeholder','aria-label','title','alt','data-i18n-confirm'];
    if (el.matches('input[type="button"],input[type="submit"],input[type="reset"]')) names.push('value');
    for (const attr of names) {
      const source = norm(el.getAttribute(attr) || '');
      if (!source || !sourceSet.has(source)) continue;
      attrs.set(`${el.dataset.i18nPageId}:${attr}`, {el, attr, source, last:null});
    }
  }

  function scan(root=document.body) {
    if (!root) return;
    if (root.nodeType === Node.TEXT_NODE) rememberText(root);
    const scope = root.nodeType === Node.ELEMENT_NODE ? root : document.body;
    if (scope.nodeType === Node.ELEMENT_NODE) rememberAttrs(scope);
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const el = node.parentElement;
        return (!el || ignored(el) || ['SCRIPT','STYLE','NOSCRIPT','TEXTAREA'].includes(el.tagName))
          ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      }
    });
    while (walker.nextNode()) rememberText(walker.currentNode);
    scope.querySelectorAll?.('[placeholder],[aria-label],[title],[alt],[data-i18n-confirm],input[type="button"],input[type="submit"],input[type="reset"]').forEach(rememberAttrs);
  }

  function collectSources() {
    const out = new Set();
    for (const [node, r] of [...records]) {
      if (!node?.isConnected) { records.delete(node); continue; }
      out.add(r.source);
    }
    for (const [key, r] of [...attrs]) {
      if (!r.el?.isConnected) { attrs.delete(key); continue; }
      out.add(r.source);
    }
    return [...out];
  }

  function applyMap(map) {
    applying++;
    try {
      for (const [node, r] of [...records]) {
        if (!node?.isConnected) { records.delete(node); continue; }
        const translated = map.get(r.source);
        if (!translated) continue;
        const value = `${r.leading}${translated}${r.trailing}`;
        r.last = norm(value);
        if (node.nodeValue !== value) node.nodeValue = value;
      }
      for (const [key, r] of [...attrs]) {
        if (!r.el?.isConnected) { attrs.delete(key); continue; }
        const translated = map.get(r.source);
        if (!translated) continue;
        r.last = translated;
        if (r.el.getAttribute(r.attr) !== translated) r.el.setAttribute(r.attr, translated);
      }
    } finally {
      queueMicrotask(() => { applying = Math.max(0, applying - 1); });
    }
  }

  async function fetchBatch(language, texts) {
    const response = await fetch(BATCH_URL, {
      method:'POST',
      credentials:'same-origin',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({language, texts}),
    });
    let data = {};
    try { data = await response.json(); } catch (_) {}
    if (!response.ok) throw new Error(data.detail || `Translation HTTP ${response.status}`);
    return data;
  }

  async function buildCurrentPage(language, myGeneration, onlySources=null) {
    scan(document.body);
    const sources = [...new Set(onlySources || collectSources())];
    const candidate = new Map();

    for (const source of sources) {
      const local = localResolve(source, language);
      if (local) candidate.set(source, local);
    }

    let missing = sources.filter(source => !candidate.has(source));

    // Base/source language is always identity. No network request is needed.
    if (language === BASE_LANGUAGE) {
      for (const source of missing) candidate.set(source, source);
      return {candidate, unresolved:[], sources};
    }

    const unresolved = [];
    for (let i=0; i<missing.length; i+=CHUNK_SIZE) {
      if (myGeneration !== generation) throw new Error('Language change superseded');
      const chunk = missing.slice(i, i+CHUNK_SIZE);
      notice(`ARX dil paketi: ${language} · ${Math.min(i+chunk.length, missing.length)}/${missing.length}`);
      const data = await fetchBatch(language, chunk);
      const translations = data.translations || {};
      const failed = new Set((data.unresolved || []).map(norm));
      for (const source of chunk) {
        const translated = norm(translations[source] || '');
        if (translated && !failed.has(source)) candidate.set(source, translated);
        else unresolved.push(source);
      }
    }

    return {
      candidate,
      unresolved:[...new Set(unresolved.filter(source => !candidate.has(source)))],
      sources
    };
  }

  async function setLanguage(language, {initial=false}={}) {
    const target = normLang(language) || BASE_LANGUAGE;
    const previousLanguage = currentLanguage;
    const previousTranslations = pageTranslations;
    const myGeneration = ++generation;

    switchInProgress = true;
    lastSwitchSucceeded = false;
    window.dispatchEvent(new CustomEvent('arx:i18n-pending', {detail:{language:target}}));

    try {
      notice(target === BASE_LANGUAGE
        ? 'ARX arayüz dili: Türkçe'
        : `ARX arayüz dili hazırlanıyor: ${target}`);

      const {candidate, unresolved, sources} = await buildCurrentPage(target, myGeneration);

      // A newer user selection cancels this result cleanly.
      if (myGeneration !== generation) return false;

      if (unresolved.length) {
        throw new Error(`${unresolved.length} sabit arayüz metni çevrilemedi. Tekrar denemek için dili yeniden seçin.`);
      }

      currentLanguage = target;
      pageTranslations = candidate;
      document.documentElement.lang = target;
      document.documentElement.dir = target === 'ar' ? 'rtl' : 'ltr';
      applyMap(pageTranslations);

      try { localStorage.setItem(STORAGE_KEY, target); } catch (_) {}
      const selector = document.querySelector('#app-language');
      if (selector) selector.value = target;

      lastSwitchSucceeded = true;
      notice('');
      window.dispatchEvent(new CustomEvent('arx:i18n-ready', {
        detail:{language:target, sourceCount:sources.length, owner:'i18n-runtime-v63'}
      }));
      return true;
    } catch (err) {
      if (myGeneration !== generation) return false;

      console.error('[ARX i18n v63]', err);
      currentLanguage = previousLanguage;
      pageTranslations = previousTranslations;
      document.documentElement.lang = previousLanguage;
      document.documentElement.dir = previousLanguage === 'ar' ? 'rtl' : 'ltr';

      const selector = document.querySelector('#app-language');
      if (selector) selector.value = previousLanguage;

      notice(`Dil değiştirilemedi: ${String(err?.message || err)}`, 'error');
      setTimeout(() => notice(''), initial ? 4500 : 7000);
      return false;
    } finally {
      if (myGeneration === generation) switchInProgress = false;
    }
  }

  async function translateNewContent() {
    if (!currentLanguage || switchInProgress || !lastSwitchSucceeded) return;
    scan(document.body);
    const newSources = collectSources().filter(source => !pageTranslations.has(source));
    if (!newSources.length) return;
    const myGeneration = generation;
    try {
      const {candidate, unresolved} = await buildCurrentPage(currentLanguage, myGeneration, newSources);
      if (myGeneration !== generation || unresolved.length) return;
      for (const [source, translated] of candidate) pageTranslations.set(source, translated);
      applyMap(pageTranslations);
      notice('');
    } catch (_) {}
  }

  function onMutations(mutations) {
    if (applying) return;
    let changed = false;
    for (const m of mutations) {
      if (m.type === 'childList') {
        for (const n of m.addedNodes) {
          if (n.nodeType === Node.ELEMENT_NODE || n.nodeType === Node.TEXT_NODE) {
            scan(n); changed = true;
          }
        }
      } else if (m.type === 'characterData') {
        const n = m.target;
        const cur = norm(n.nodeValue);
        const r = records.get(n);
        if (r && cur === r.last) continue;
        if (cur && sourceSet.has(cur)) { rememberText(n); changed = true; }
      } else if (m.type === 'attributes') {
        rememberAttrs(m.target); changed = true;
      }
    }
    if (changed) {
      clearTimeout(mutationTimer);
      mutationTimer = setTimeout(translateNewContent, 140);
    }
  }

  function installConfirm() {
    document.addEventListener('submit', event => {
      const form = event.target?.closest?.('form[data-i18n-confirm]');
      if (!form) return;
      if (form.dataset.i18nConfirmBypass === '1') {
        delete form.dataset.i18nConfirmBypass;
        return;
      }
      event.preventDefault();
      const source = norm(form.getAttribute('data-i18n-confirm') || '');
      const message = pageTranslations.get(source) || source;
      if (!window.confirm(message)) return;
      form.dataset.i18nConfirmBypass = '1';
      form.requestSubmit ? form.requestSubmit(event.submitter || undefined) : form.submit();
    }, true);
  }

  async function init() {
    try {
      const response = await fetch(SOURCE_URL, {cache:'no-store'});
      if (response.ok) sourceSet = new Set((await response.json()).map(norm));
    } catch (_) {}

    scan(document.body);
    installConfirm();

    observer = new MutationObserver(onMutations);
    observer.observe(document.body, {
      subtree:true, childList:true, characterData:true, attributes:true,
      attributeFilter:['placeholder','aria-label','title','alt','value','data-i18n-confirm']
    });

    const selector = document.querySelector('#app-language');
    const selected =
      normLang(localStorage.getItem(STORAGE_KEY)) ||
      normLang(selector?.value) ||
      normLang(navigator.language) ||
      BASE_LANGUAGE;

    if (selector) selector.value = selected;

    // Critical: install the handler before the initial translation starts.
    // If the initial request is slow, the user can immediately choose another
    // language; generation cancellation stops the previous request result.
    selector?.addEventListener('change', event => {
      const requested = normLang(event.target.value) || BASE_LANGUAGE;
      setLanguage(requested);
    });

    await setLanguage(selected, {initial:true});
  }

  window.ARXI18N = {
    setLanguage,
    apply:() => applyMap(pageTranslations),
    get language(){ return currentLanguage; },
    translate:source => pageTranslations.get(norm(source)) || norm(source),
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, {once:true});
  else init();
})();

(() => {
  'use strict';

  if (window.__ARXSystemTwemojiInstalled) return;
  window.__ARXSystemTwemojiInstalled = true;

  const ASSET_BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@17.0.3/assets/';
  const CUSTOM_EMOJI_RE = /<(a?):([A-Za-z0-9_]{2,32}):(\d{5,30})>/g;

  const style = document.createElement('style');
  style.id = 'arx-system-twemoji-style';
  style.textContent = `
    img.arx-twemoji,img.arx-discord-inline-emoji{
      width:1.16em;height:1.16em;margin:0 .035em;vertical-align:-.18em;
      object-fit:contain;display:inline-block;max-width:none;max-height:none;
      user-select:none;-webkit-user-drag:none
    }
    img.arx-discord-inline-emoji{border-radius:3px}
  `;
  document.head.appendChild(style);

  const BLOCKED = [
    'script','style','noscript','svg','canvas','textarea','input','select','option',
    'code','pre','kbd','samp','[contenteditable="true"]','[data-arx-no-twemoji]',
    '[data-arx-twemoji-done]','[data-arx-global-emoji-dialog]','.role-emoji-dialog',
    '.arx-twemoji','.arx-discord-inline-emoji'
  ].join(',');

  const nativeFallback = value => document.createTextNode(String(value || ''));

  const discordEmoji = (animated, name, id) => {
    const img = document.createElement('img');
    img.className = 'arx-discord-inline-emoji';
    img.src = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'webp'}?size=48&quality=lossless`;
    img.alt = `:${name}:`; img.title = `:${name}:`; img.draggable = false; img.decoding = 'async'; img.loading = 'lazy';
    img.addEventListener('error', () => { if (img.isConnected) img.replaceWith(nativeFallback(img.alt)); }, {once:true});
    return img;
  };

  const parserReady = () => Boolean(window.twemoji && typeof window.twemoji.parse === 'function' && typeof window.twemoji.test === 'function');

  const parseUnicode = (fragment, value) => {
    const text = String(value || '');
    if (!text) return;
    if (!parserReady()) { fragment.append(nativeFallback(text)); return; }
    let hasEmoji = false;
    try { hasEmoji = window.twemoji.test(text); } catch (_) { hasEmoji = false; }
    if (!hasEmoji) { fragment.append(nativeFallback(text)); return; }

    const holder = document.createElement('span');
    holder.textContent = text;
    try {
      window.twemoji.parse(holder, {
        base: ASSET_BASE,
        folder: 'svg',
        ext: '.svg',
        className: 'arx-twemoji',
        attributes: () => ({draggable:'false',decoding:'async'}),
        onerror() {
          if (!this?.isConnected) return;
          if (!this.dataset.arxPngFallback && this.src.includes('/assets/svg/')) {
            this.dataset.arxPngFallback = '1';
            this.src = this.src.replace('/assets/svg/', '/assets/72x72/').replace(/\.svg(?:\?.*)?$/i, '.png');
            return;
          }
          this.replaceWith(nativeFallback(this.alt || ''));
        }
      });
    } catch (_) {
      fragment.append(nativeFallback(text));
      return;
    }
    while (holder.firstChild) fragment.append(holder.firstChild);
  };

  const renderFragment = value => {
    const text = String(value ?? '');
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    CUSTOM_EMOJI_RE.lastIndex = 0;
    let match;
    while ((match = CUSTOM_EMOJI_RE.exec(text)) !== null) {
      parseUnicode(fragment, text.slice(cursor, match.index));
      fragment.append(discordEmoji(Boolean(match[1]), match[2], match[3]));
      cursor = match.index + match[0].length;
    }
    parseUnicode(fragment, text.slice(cursor));
    CUSTOM_EMOJI_RE.lastIndex = 0;
    return fragment;
  };

  const shouldSkip = node => Boolean(node?.parentElement?.closest(BLOCKED));

  const renderTextNode = node => {
    if (!(node instanceof Text) || shouldSkip(node)) return;
    const text = node.nodeValue || '';
    if (!text) return;
    CUSTOM_EMOJI_RE.lastIndex = 0;
    const hasCustom = CUSTOM_EMOJI_RE.test(text);
    CUSTOM_EMOJI_RE.lastIndex = 0;
    let hasUnicode = false;
    if (parserReady()) {
      try { hasUnicode = window.twemoji.test(text); } catch (_) { hasUnicode = false; }
    }
    if (!hasCustom && !hasUnicode) return;
    node.replaceWith(renderFragment(text));
  };

  const renderTree = root => {
    if (!root) return;
    if (root instanceof Text) { renderTextNode(root); return; }
    if (!(root instanceof Element || root instanceof Document || root instanceof DocumentFragment)) return;
    if (root instanceof Element && root.matches(BLOCKED)) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    let node;
    while ((node = walker.nextNode())) nodes.push(node);
    for (const item of nodes) renderTextNode(item);
  };

  const pending = new Set();
  let raf = 0;
  const flush = () => {
    raf = 0;
    const roots = [...pending]; pending.clear();
    for (const root of roots) if (root?.isConnected || root instanceof Document) renderTree(root);
  };
  const queue = root => {
    if (!root) return;
    pending.add(root);
    if (!raf) raf = requestAnimationFrame(flush);
  };

  let started = false;
  const start = () => {
    if (started) return;
    started = true;
    renderTree(document.body);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        if (record.type === 'characterData') queue(record.target);
        else for (const node of record.addedNodes || []) queue(node);
      }
    });
    observer.observe(document.body, {childList:true,subtree:true,characterData:true});
    window.ARXRenderTwemoji = (root = document.body) => renderTree(root);
  };

  // Defer scripts execute in order, but give the CDN parser a short grace period
  // before initial rendering. This also recovers from unusually slow cache/network.
  const waitForLateParser = (attempt = 0) => {
    if (parserReady()) { renderTree(document.body); return; }
    if (attempt >= 20) return;
    window.setTimeout(() => waitForLateParser(attempt + 1), 1000);
  };
  const boot = (attempt = 0) => {
    if (parserReady()) { start(); return; }
    if (attempt >= 40) { start(); waitForLateParser(); return; }
    window.setTimeout(() => boot(attempt + 1), 100);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => boot(), {once:true});
  else boot();
})();

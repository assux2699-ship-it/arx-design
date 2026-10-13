(() => {
  const grid = document.querySelector('[data-workspace-grid]');
  if (!grid) return;

  const userId = String(grid.dataset.workspaceUser || 'guest').trim() || 'guest';
  const storageKey = `arx.workspace-order.v1.${userId}`;
  const cardSelector = '[data-workspace-card][data-guild-id]';
  const interactiveSelector = 'a,button,input,select,textarea,label,option';

  const cards = () => Array.from(grid.querySelectorAll(cardSelector));
  const guildId = (card) => String(card?.dataset.guildId || '').trim();

  const readOrder = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(parsed)) return [];
      return parsed.map(String).filter(Boolean);
    } catch (_) {
      return [];
    }
  };

  const writeOrder = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(cards().map(guildId).filter(Boolean)));
    } catch (_) {
      // Storage may be unavailable in restrictive browser modes. Reordering still
      // works for the current page without breaking the workspace dashboard.
    }
  };

  const restoreOrder = () => {
    const saved = readOrder();
    if (!saved.length) return;

    const current = cards();
    const byId = new Map(current.map(card => [guildId(card), card]));
    const used = new Set();

    saved.forEach(id => {
      const card = byId.get(id);
      if (!card || used.has(id)) return;
      grid.appendChild(card);
      used.add(id);
    });

    current.forEach(card => {
      const id = guildId(card);
      if (!used.has(id)) grid.appendChild(card);
    });
  };

  restoreOrder();

  let dragged = null;
  let dragOverCard = null;

  const clearDragOver = () => {
    if (dragOverCard) dragOverCard.classList.remove('is-workspace-drag-over');
    dragOverCard = null;
  };

  grid.addEventListener('dragstart', (event) => {
    const card = event.target.closest(cardSelector);
    if (!card) return;

    // Buttons, selects and links must remain normal controls. Dragging starts
    // from the card surface itself instead of hijacking those controls.
    if (event.target.closest(interactiveSelector)) {
      event.preventDefault();
      return;
    }

    dragged = card;
    card.classList.add('is-workspace-dragging');
    grid.classList.add('is-workspace-sorting');

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', guildId(card));
    }
  });

  grid.addEventListener('dragenter', (event) => {
    if (!dragged) return;
    const target = event.target.closest(cardSelector);
    if (!target || target === dragged) return;

    event.preventDefault();
    clearDragOver();
    dragOverCard = target;
    target.classList.add('is-workspace-drag-over');

    const list = cards();
    const draggedIndex = list.indexOf(dragged);
    const targetIndex = list.indexOf(target);
    if (draggedIndex < 0 || targetIndex < 0) return;

    if (draggedIndex < targetIndex) {
      grid.insertBefore(dragged, target.nextSibling);
    } else {
      grid.insertBefore(dragged, target);
    }
  });

  grid.addEventListener('dragover', (event) => {
    if (!dragged) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
  });

  grid.addEventListener('drop', (event) => {
    if (!dragged) return;
    event.preventDefault();
    writeOrder();
    clearDragOver();
  });

  grid.addEventListener('dragend', () => {
    if (dragged) dragged.classList.remove('is-workspace-dragging');
    dragged = null;
    clearDragOver();
    grid.classList.remove('is-workspace-sorting');
    writeOrder();
  });

  // Explicitly keep nested controls non-draggable so clicking Manage/Premium
  // or selecting text does not unexpectedly start a card drag.
  grid.querySelectorAll('a,button,input,select,textarea').forEach(control => {
    control.setAttribute('draggable', 'false');
  });
})();

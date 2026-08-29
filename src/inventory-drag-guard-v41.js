(function (global) {
  'use strict';

  const DRAG_MIME = 'application/x-astraeon-item';
  const TOUCH_HOLD_MS = 240;
  let pointerDrag = null;
  let pointerTimer = 0;
  let pointerGhost = null;
  let pointerTarget = null;
  let suppressClickUntil = 0;

  function carriesInventoryItem(dataTransfer) {
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.includes(DRAG_MIME) || types.includes('text/astraeon-item') || types.includes('text/plain');
  }

  function inventoryDropTarget(event) {
    const target = event.target?.closest?.('#inventoryTrash,#inventoryGrid,#equipmentGrid .equipment-slot');
    return target || null;
  }

  function refFor(element) {
    if (element?.matches('.inventory-slot[data-index]')) return { source: 'inventory', index: Number(element.dataset.index) };
    if (element?.matches('.equipment-slot[data-slot]:not(.empty)')) return { source: 'equipment', slot: element.dataset.slot };
    return null;
  }

  function clearPointerTarget() {
    pointerTarget?.classList.remove('pointer-dragover');
    pointerTarget = null;
  }

  function finishPointerDrag(cancelled, event) {
    clearTimeout(pointerTimer);
    if (!pointerDrag) return;
    const drag = pointerDrag;
    pointerDrag = null;
    clearPointerTarget();
    pointerGhost?.remove();
    pointerGhost = null;
    document.body.classList.remove('inventory-pointer-dragging');
    document.querySelector('#inventoryTrash')?.classList.remove('drag-active', 'dragover');
    drag.element.classList.remove('dragging');
    drag.element.setAttribute('aria-grabbed', 'false');
    if (drag.active) suppressClickUntil = performance.now() + 450;
    if (cancelled || !drag.active || !event) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('#inventoryTrash,#inventoryGrid,#equipmentGrid .equipment-slot');
    const game = global.astraeon;
    if (!target || !game) return;
    if (target.id === 'inventoryTrash') game.discardInventoryRef?.(drag.ref);
    else if (target.id === 'inventoryGrid') {
      if (drag.ref.source === 'equipment') game.unequipItem?.(drag.ref.slot);
      else {
        const itemTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('.inventory-slot[data-index]');
        if (itemTarget) game.reorderInventoryItem?.(drag.ref.index, Number(itemTarget.dataset.index));
      }
    } else if (drag.ref.source === 'inventory') game.equipItem?.(Number(drag.ref.index), target.dataset.slot);
  }

  function activatePointerDrag() {
    if (!pointerDrag) return;
    pointerDrag.active = true;
    pointerDrag.element.classList.add('dragging');
    pointerDrag.element.setAttribute('aria-grabbed', 'true');
    pointerGhost = pointerDrag.element.cloneNode(true);
    pointerGhost.className = `${pointerDrag.element.className} inventory-pointer-ghost`;
    pointerGhost.removeAttribute('id');
    document.body.appendChild(pointerGhost);
    document.body.classList.add('inventory-pointer-dragging');
    document.querySelector('#inventoryTrash')?.classList.add('drag-active');
  }

  document.addEventListener('pointerdown', event => {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return;
    const element = event.target?.closest?.('.inventory-slot[data-index],.equipment-slot[data-slot]:not(.empty)');
    const ref = refFor(element);
    if (!ref) return;
    finishPointerDrag(true);
    pointerDrag = { pointerId: event.pointerId, element, ref, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, active: false };
    pointerTimer = setTimeout(activatePointerDrag, TOUCH_HOLD_MS);
  }, true);

  document.addEventListener('pointermove', event => {
    if (!pointerDrag || pointerDrag.pointerId !== event.pointerId) return;
    pointerDrag.x = event.clientX;
    pointerDrag.y = event.clientY;
    if (!pointerDrag.active) {
      if (Math.hypot(event.clientX - pointerDrag.startX, event.clientY - pointerDrag.startY) > 12) finishPointerDrag(true);
      return;
    }
    event.preventDefault();
    if (pointerGhost) pointerGhost.style.setProperty('transform', `translate3d(${event.clientX + 14}px,${event.clientY + 14}px,0)`, 'important');
    const nextTarget = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('#inventoryTrash,#inventoryGrid,#equipmentGrid .equipment-slot');
    if (nextTarget !== pointerTarget) {
      clearPointerTarget();
      pointerTarget = nextTarget || null;
      pointerTarget?.classList.add('pointer-dragover');
    }
  }, { capture: true, passive: false });

  document.addEventListener('pointerup', event => {
    if (pointerDrag?.pointerId === event.pointerId) finishPointerDrag(false, event);
  }, true);
  document.addEventListener('pointercancel', event => {
    if (pointerDrag?.pointerId === event.pointerId) finishPointerDrag(true, event);
  }, true);
  document.addEventListener('click', event => {
    if (performance.now() < suppressClickUntil && event.target?.closest?.('.inventory-slot,.equipment-slot')) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  }, true);

  document.addEventListener('dragenter', event => {
    const target = inventoryDropTarget(event);
    if (!target || !carriesInventoryItem(event.dataTransfer)) return;
    event.preventDefault();
    if (target.id === 'inventoryTrash') target.classList.add('dragover');
  }, true);

  document.addEventListener('dragover', event => {
    const target = inventoryDropTarget(event);
    if (!target || !carriesInventoryItem(event.dataTransfer)) return;
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
    if (target.id === 'inventoryTrash') target.classList.add('dragover');
  }, true);

  document.addEventListener('drop', event => {
    document.querySelector('#inventoryTrash')?.classList.remove('dragover', 'drag-active');
  }, true);

  document.addEventListener('dragend', () => {
    document.querySelector('#inventoryTrash')?.classList.remove('dragover', 'drag-active');
  }, true);

  global.AstraeonInventoryDragGuardV41 = { carriesInventoryItem, touchHoldMs: TOUCH_HOLD_MS };
})(window);

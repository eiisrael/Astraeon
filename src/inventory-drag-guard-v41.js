(function (global) {
  'use strict';

  const DRAG_MIME = 'application/x-astraeon-item';

  function carriesInventoryItem(dataTransfer) {
    if (!dataTransfer) return false;
    const types = Array.from(dataTransfer.types || []);
    return types.includes(DRAG_MIME) || types.includes('text/astraeon-item') || types.includes('text/plain');
  }

  function inventoryDropTarget(event) {
    const target = event.target?.closest?.('#inventoryTrash,#inventoryGrid,#equipmentGrid .equipment-slot');
    return target || null;
  }

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

  global.AstraeonInventoryDragGuardV41 = { carriesInventoryItem };
})(window);

(function (global) {
  'use strict';

  const EXTRA_SLOTS = ['pet', 'cloak', 'offhand', 'legs', 'necklace'];
  const SLOT_LAYOUT = {
    pet:      { label: 'Pet', icon: '✦', category: 'accessory' },
    head:     { label: 'Helm', icon: '♜', category: 'armor' },
    cloak:    { label: 'Manto', icon: '◈', category: 'realm' },
    weapon:   { label: 'Arma 1', icon: '⚔', category: 'weapon' },
    chest:    { label: 'Peito / Armadura', icon: '◈', category: 'armor' },
    offhand:  { label: 'Arma 2 / Escudo', icon: '◐', category: 'weapon' },
    hands:    { label: 'Luva / Armadura', icon: '✦', category: 'armor' },
    legs:     { label: 'Calça / Armadura', icon: '♜', category: 'armor' },
    boots:    { label: 'Bota / Armadura', icon: '⌁', category: 'armor' },
    necklace: { label: 'Colar', icon: '◇', category: 'accessory' },
    relic:    { label: 'Pingente', icon: '✧', category: 'accessory' },
    ring:     { label: 'Anel', icon: '◌', category: 'accessory' },
    amulet:   { label: 'Amuleto', icon: '◇', category: 'accessory' }
  };

  const SLOT_IDS = Object.keys(SLOT_LAYOUT);
  let installed = false;

  function normalizeItem(A, raw) {
    if (!raw) return null;
    const item = A.normalizeLegacyItem ? A.normalizeLegacyItem(raw) : { ...raw };
    if (!item) return null;
    // Compatibilidade com o catálogo anterior: Manto do Caminhante era salvo como peitoral.
    if (item.id === 'wanderer_cloak') item.slot = 'cloak';
    return item;
  }

  function replaceSlotMeta(A) {
    if (!A?.slots) return;
    for (const key of Object.keys(A.slots)) delete A.slots[key];
    for (const [id, info] of Object.entries(SLOT_LAYOUT)) {
      A.slots[id] = { label: info.label, icon: info.icon };
    }
    if (A.items?.wanderer_cloak) A.items.wanderer_cloak.slot = 'cloak';
  }

  function ensureEquipment(game, A, rawEquipment) {
    const current = game.equipment && typeof game.equipment === 'object' ? game.equipment : {};
    const next = {};
    for (const slot of SLOT_IDS) next[slot] = current[slot] || null;

    if (rawEquipment && typeof rawEquipment === 'object') {
      for (const slot of SLOT_IDS) {
        if (rawEquipment[slot]) next[slot] = normalizeItem(A, rawEquipment[slot]);
      }
    }

    // Migra um Manto equipado no antigo slot de peitoral sem perder o item.
    if (!next.cloak && next.chest?.id === 'wanderer_cloak') {
      next.cloak = next.chest;
      next.cloak.slot = 'cloak';
      next.chest = null;
    }

    for (const slot of SLOT_IDS) {
      if (next[slot]?.id === 'wanderer_cloak') next[slot].slot = 'cloak';
    }
    game.equipment = next;
  }

  function loadRawSave() {
    try {
      const key = global.AstraeonWorld?.STORAGE_SAVE;
      return key ? JSON.parse(localStorage.getItem(key) || 'null') : null;
    } catch (_) {
      return null;
    }
  }

  function categoryFor(slot) {
    return SLOT_LAYOUT[slot]?.category || 'armor';
  }

  function decorateDom(game) {
    const panel = document.querySelector('#inventoryPanel .inventory-v4');
    panel?.classList.add('inventory-standard-v43');

    document.querySelectorAll('#equipmentGrid .equipment-slot').forEach(slot => {
      const id = slot.dataset.slot;
      slot.dataset.category = categoryFor(id);
      slot.dataset.layoutSlot = id || '';
      const label = SLOT_LAYOUT[id]?.label;
      const small = slot.querySelector(':scope > small');
      if (small && label && small.textContent !== label) small.textContent = label;
    });

    const equipmentTitle = document.querySelector('.equipment-column .inventory-column-title small');
    if (equipmentTitle) equipmentTitle.textContent = 'grade padrão · arraste · equipe · inspecione';
    const backpackHint = document.querySelector('.backpack-title small');
    if (backpackHint) backpackHint.textContent = '25 espaços fixos · grade 5×5';
  }

  function install() {
    // A estrutura visual não depende do estado do personagem. Aplicá-la já na
    // primeira passagem evita que o painel herde por alguns frames o layout
    // legado enquanto o runtime do inventário termina de iniciar.
    decorateDom();
    if (installed) return;
    const game = global.astraeon;
    const A = global.AstraeonItems;
    if (!game?.inventoryV4Installed || !A?.slots) {
      setTimeout(install, 60);
      return;
    }
    installed = true;

    replaceSlotMeta(A);
    ensureEquipment(game, A, loadRawSave()?.equipment);

    const previousRender = game.renderInventory.bind(game);
    const previousStart = game.startNew.bind(game);
    const previousContinue = game.continueGame.bind(game);
    const previousItemTypeLabel = game.itemTypeLabel?.bind(game);

    game.itemTypeLabel = function (item) {
      if (item?.type === 'equipment' && SLOT_LAYOUT[item.slot]) return SLOT_LAYOUT[item.slot].label;
      return previousItemTypeLabel ? previousItemTypeLabel(item) : 'Item';
    };

    game.equipItem = function (index, forcedSlot) {
      const source = this.inventory?.[Number(index)];
      const item = normalizeItem(A, source);
      if (!item || item.type !== 'equipment') {
        this.toast?.('Este item não pode ser equipado.');
        return false;
      }

      const targetSlot = forcedSlot || item.slot;
      if (!SLOT_LAYOUT[targetSlot]) {
        this.toast?.('Slot de equipamento inválido.');
        return false;
      }
      if (item.slot !== targetSlot) {
        this.toast?.(`Esse item pertence ao slot ${SLOT_LAYOUT[item.slot]?.label || 'correto'}.`);
        return false;
      }

      const requirement = this.getItemRequirementStatus?.(item);
      if (requirement && !requirement.ok) {
        const reason = !requirement.classOk ? 'classe incompatível' : !requirement.levelOk ? `nível ${requirement.requiredLevel} necessário` : 'pontos de atributo insuficientes';
        this.toast?.(`${item.name}: ${reason}.`);
        this.beep?.(120, .05, .018);
        return false;
      }

      ensureEquipment(this, A);
      const old = this.equipment[targetSlot];
      this.inventory.splice(Number(index), 1);
      if (old) this.inventory.push(old);
      this.equipment[targetSlot] = item;
      this.discoveredItems?.add?.(item.id);
      this.selectedInventoryRef = { source: 'equipment', slot: targetSlot };
      this.recalculateEquipmentStats?.();
      this.renderInventory?.();
      this.save?.();
      this.toast?.(`${item.name} equipado.`);
      this.beep?.(690, .05, .022);
      return true;
    };

    game.unequipItem = function (slot) {
      ensureEquipment(this, A);
      const item = this.equipment?.[slot];
      if (!item) return false;
      const capacity = Number(this.backpackCapacity || global.AstraeonInventoryV4?.CAPACITY || 25);
      if ((this.inventory?.length || 0) >= capacity) {
        this.toast?.('A mochila está cheia. Libere um espaço antes de desequipar.');
        return false;
      }
      this.inventory.push(item);
      this.equipment[slot] = null;
      this.selectedInventoryRef = { source: 'inventory', index: this.inventory.length - 1 };
      this.recalculateEquipmentStats?.();
      this.renderInventory?.();
      this.save?.();
      this.toast?.(`${item.name} voltou para a mochila.`);
      return true;
    };

    game.renderInventory = function (...args) {
      ensureEquipment(this, A);
      const result = previousRender(...args);
      decorateDom(this);
      return result;
    };

    game.startNew = function (...args) {
      const result = previousStart(...args);
      replaceSlotMeta(A);
      ensureEquipment(this, A);
      this.renderInventory?.();
      this.save?.();
      return result;
    };

    game.continueGame = function (...args) {
      const raw = loadRawSave();
      const result = previousContinue(...args);
      replaceSlotMeta(A);
      ensureEquipment(this, A, raw?.equipment);
      this.recalculateEquipmentStats?.();
      this.renderInventory?.();
      return result;
    };

    game.renderInventory();
    global.AstraeonInventoryLayoutV43 = { SLOT_LAYOUT, SLOT_IDS, EXTRA_SLOTS };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window);

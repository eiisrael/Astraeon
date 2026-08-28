(function (global) {
  'use strict';

  const W = global.AstraeonWorld;
  let A = null;
  let V3 = null;
  const CAPACITY = 25;
  const LONG_PRESS_MS = 3000;
  const ALL_CLASSES = ['Warrior', 'Mage', 'Archer', 'Assassin', 'Paladine'];
  const CLASS_LABELS = {
    Warrior: 'Guerreiro', Mage: 'Mago', Archer: 'Arqueiro', Assassin: 'Assassino', Paladine: 'Paladino'
  };
  const STAT_LABELS = {
    power: 'Poder', defense: 'Defesa', maxHp: 'Vida', maxMana: 'Mana', speed: 'Velocidade', range: 'Alcance', crit: 'Crítico'
  };
  const SLOT_CATEGORY = {
    weapon: 'weapon', head: 'armor', chest: 'armor', hands: 'armor', boots: 'armor',
    ring: 'accessory', amulet: 'accessory', relic: 'realm'
  };
  const RARITY_LABELS = {
    common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário'
  };

  let installed = false;
  let tooltip = null;
  let inspectSheet = null;
  let tooltipRef = null;
  let longPressTimer = 0;
  let longPressElement = null;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isCoarsePointer() {
    return !!global.matchMedia?.('(pointer:coarse)').matches || document.body.classList.contains('touch-forced');
  }

  function itemArt(item) {
    if (typeof V3?.artFor === 'function') return V3.artFor(item);
    const img = String(item?.icon || '◇');
    if (img.includes('<img')) {
      const match = img.match(/src=["']([^"']+)/i);
      if (match) return match[1];
    }
    return '';
  }

  function itemIconMarkup(item) {
    const src = itemArt(item);
    if (src) return `<img class="item-art-img" src="${src}" alt="">`;
    return `<span class="inventory-rune">${String(item?.icon || '◇').replace(/<[^>]+>/g, '') || '◇'}</span>`;
  }

  function rarityLabel(item) {
    return RARITY_LABELS[item?.rarity] || 'Comum';
  }

  function slotLabel(item) {
    if (typeof global.astraeon?.itemTypeLabel === 'function') return global.astraeon.itemTypeLabel(item);
    return item?.type === 'equipment' ? 'Equipamento' : item?.type === 'consumable' ? 'Consumível' : item?.type === 'material' ? 'Material' : 'Item';
  }

  function inferredRequiredStats(item) {
    if (!item || item.type !== 'equipment') return {};
    const explicit = item.requiredStats || item.requirements?.stats;
    if (explicit && typeof explicit === 'object') return { ...explicit };

    const allowed = Array.isArray(item.allowedClasses) ? item.allowedClasses : [];
    if (allowed.length !== 1) return {};
    const level = Math.max(1, Number(item.requiredLevel ?? item.level ?? 1) || 1);
    const cls = allowed[0];
    if (cls === 'Warrior') return { power: Math.round(14 + Math.max(0, level - 1) * .8) };
    if (cls === 'Mage') return { maxMana: Math.round(120 + Math.max(0, level - 1) * 4) };
    if (cls === 'Archer') return { range: Math.round(200 + Math.max(0, level - 1) * 2) };
    if (cls === 'Assassin') return { speed: Math.round(180 + Math.max(0, level - 1) * 1.5) };
    if (cls === 'Paladine') return { defense: Math.round(6 + Math.max(0, level - 1) * .35) };
    return {};
  }

  function formatStatValue(key, value) {
    if (key === 'crit') return `${Math.round(Number(value || 0) * 1000) / 10}%`;
    return String(Math.round(Number(value || 0)));
  }

  function requirementStatus(game, item) {
    const player = game?.player || {};
    const allowed = Array.isArray(item?.allowedClasses) && item.allowedClasses.length ? item.allowedClasses : ALL_CLASSES;
    const requiredLevel = Math.max(1, Number(item?.requiredLevel ?? item?.level ?? 1) || 1);
    const classOk = item?.type !== 'equipment' || allowed.includes(player.classId);
    const levelOk = item?.type !== 'equipment' || Number(player.level || 1) >= requiredLevel;
    const requiredStats = inferredRequiredStats(item);
    const stats = Object.entries(requiredStats).map(([key, required]) => {
      const current = Number(player[key]) || 0;
      return { key, label: STAT_LABELS[key] || key, required: Number(required) || 0, current, ok: current >= Number(required || 0) };
    });
    const statsOk = stats.every(x => x.ok);
    return { allowed, requiredLevel, classOk, levelOk, stats, statsOk, ok: classOk && levelOk && statsOk };
  }

  function requirementsMarkup(game, item) {
    if (!item || item.type !== 'equipment') {
      return '<div class="requirement-row ok"><span>✓</span><div><b>Sem requisitos de equipamento</b><small>Pode ser usado diretamente da mochila.</small></div></div>';
    }
    const req = requirementStatus(game, item);
    const classText = req.allowed.map(c => CLASS_LABELS[c] || c).join(' · ');
    const rows = [
      `<div class="requirement-row ${req.classOk ? 'ok' : 'blocked'}"><span>${req.classOk ? '✓' : '×'}</span><div><b>Classe</b><small>${classText}</small></div></div>`,
      `<div class="requirement-row ${req.levelOk ? 'ok' : 'blocked'}"><span>${req.levelOk ? '✓' : '×'}</span><div><b>Nível necessário</b><small>Nv. ${req.requiredLevel} · atual Nv. ${Number(game.player?.level || 1)}</small></div></div>`
    ];
    if (req.stats.length) {
      req.stats.forEach(stat => {
        rows.push(`<div class="requirement-row ${stat.ok ? 'ok' : 'blocked'}"><span>${stat.ok ? '✓' : '×'}</span><div><b>${stat.label}</b><small>${formatStatValue(stat.key, stat.current)} / ${formatStatValue(stat.key, stat.required)} pontos</small></div></div>`);
      });
    } else {
      rows.push('<div class="requirement-row ok"><span>✓</span><div><b>Pontos necessários</b><small>Sem requisito adicional de atributos.</small></div></div>');
    }
    return rows.join('');
  }

  function statsMarkup(game, item) {
    const stats = typeof game?.itemStatsText === 'function' ? game.itemStatsText(item) : [];
    if (!stats.length) return '<span class="item-stat neutral">Sem bônus de combate</span>';
    return stats.map(text => `<span class="item-stat">${text}</span>`).join('');
  }

  function ensureFloatingUi() {
    if (!tooltip) {
      tooltip = document.createElement('section');
      tooltip.id = 'inventoryItemTooltip';
      tooltip.className = 'inventory-item-tooltip hidden';
      tooltip.setAttribute('role', 'tooltip');
      document.body.appendChild(tooltip);
    }
    if (!inspectSheet) {
      inspectSheet = document.createElement('section');
      inspectSheet.id = 'inventoryInspectSheet';
      inspectSheet.className = 'inventory-inspect-sheet hidden';
      inspectSheet.innerHTML = '<div class="inspect-backdrop"></div><div class="inspect-card"></div>';
      document.body.appendChild(inspectSheet);
      inspectSheet.querySelector('.inspect-backdrop')?.addEventListener('click', hideInspectSheet);
    }
  }

  function inspectMarkup(game, item, includeActions = false, ref = null) {
    const compatible = requirementStatus(game, item).ok;
    const actionText = item?.type === 'equipment' ? (ref?.source === 'equipment' ? 'Desequipar' : 'Equipar') : item?.type === 'consumable' ? 'Usar' : '';
    return `
      <div class="inspect-head" data-rarity="${item?.rarity || 'common'}">
        <div class="inspect-art">${itemIconMarkup(item)}</div>
        <div class="inspect-title"><small>${rarityLabel(item)} · ${slotLabel(item)}</small><h3>${item?.name || 'Item'}</h3><span>${item?.description || 'Item encontrado em Astraeon.'}</span></div>
        ${includeActions ? '<button class="inspect-close" type="button" aria-label="Fechar">×</button>' : ''}
      </div>
      <div class="inspect-section"><b>Atributos</b><div class="inspect-stats">${statsMarkup(game, item)}</div></div>
      <div class="inspect-section"><b>Requisitos</b><div class="inspect-requirements">${requirementsMarkup(game, item)}</div></div>
      ${includeActions ? `<div class="inspect-actions">${actionText ? `<button class="inventory-action primary inspect-primary" type="button" ${item?.type === 'equipment' && !compatible && ref?.source !== 'equipment' ? 'disabled' : ''}>${item?.type === 'equipment' && !compatible && ref?.source !== 'equipment' ? 'Requisitos não atendidos' : actionText}</button>` : ''}<button class="inventory-action danger inspect-discard" type="button">Descartar</button></div>` : ''}
    `;
  }

  function positionTooltip(x, y) {
    if (!tooltip || tooltip.classList.contains('hidden')) return;
    const pad = 14;
    const rect = tooltip.getBoundingClientRect();
    let left = x + 18;
    let top = y + 14;
    if (left + rect.width > innerWidth - pad) left = x - rect.width - 18;
    if (top + rect.height > innerHeight - pad) top = innerHeight - rect.height - pad;
    tooltip.style.left = `${Math.max(pad, Math.round(left))}px`;
    tooltip.style.top = `${Math.max(pad, Math.round(top))}px`;
  }

  function showTooltip(game, item, ref, x, y) {
    if (isCoarsePointer()) return;
    ensureFloatingUi();
    tooltipRef = ref;
    tooltip.innerHTML = inspectMarkup(game, item, false, ref);
    tooltip.classList.remove('hidden');
    positionTooltip(x, y);
  }

  function hideTooltip() {
    if (!tooltip) return;
    tooltip.classList.add('hidden');
    tooltipRef = null;
  }

  function showInspectSheet(game, item, ref) {
    ensureFloatingUi();
    hideTooltip();
    const card = inspectSheet.querySelector('.inspect-card');
    card.innerHTML = inspectMarkup(game, item, true, ref);
    inspectSheet.classList.remove('hidden');
    document.body.classList.add('inventory-inspecting');
    card.querySelector('.inspect-close')?.addEventListener('click', hideInspectSheet);
    card.querySelector('.inspect-primary')?.addEventListener('click', () => {
      if (item.type === 'equipment') {
        if (ref?.source === 'equipment') game.unequipItem(ref.slot);
        else if (ref?.source === 'inventory') game.equipItem(ref.index);
      } else if (item.type === 'consumable' && ref?.source === 'inventory') {
        game.useInventoryItem(ref.index);
      }
      hideInspectSheet();
    });
    card.querySelector('.inspect-discard')?.addEventListener('click', () => {
      hideInspectSheet();
      game.discardInventoryRef?.(ref);
    });
  }

  function hideInspectSheet() {
    if (!inspectSheet) return;
    inspectSheet.classList.add('hidden');
    document.body.classList.remove('inventory-inspecting');
  }

  function cancelLongPress() {
    clearTimeout(longPressTimer);
    longPressTimer = 0;
    longPressElement?.classList.remove('longpress-arming');
    longPressElement = null;
  }

  function bindInspectEvents(game, element, item, ref) {
    element.addEventListener('mouseenter', event => showTooltip(game, item, ref, event.clientX, event.clientY));
    element.addEventListener('mousemove', event => positionTooltip(event.clientX, event.clientY));
    element.addEventListener('mouseleave', hideTooltip);

    element.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && !isCoarsePointer()) return;
      cancelLongPress();
      longPressElement = element;
      element.classList.add('longpress-arming');
      longPressTimer = global.setTimeout(() => {
        element.classList.remove('longpress-arming');
        longPressTimer = 0;
        longPressElement = null;
        try { navigator.vibrate?.(28); } catch (_) {}
        showInspectSheet(game, item, ref);
      }, LONG_PRESS_MS);
    }, { passive: true });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => element.addEventListener(type, cancelLongPress, { passive: true }));
  }

  function bindDragSource(element, ref) {
    element.draggable = true;
    element.addEventListener('dragstart', event => {
      event.dataTransfer.setData('text/astraeon-item', JSON.stringify(ref));
      event.dataTransfer.effectAllowed = 'move';
      document.querySelector('#inventoryTrash')?.classList.add('drag-active');
    });
    element.addEventListener('dragend', () => document.querySelector('#inventoryTrash')?.classList.remove('drag-active', 'dragover'));
  }

  function setSelected(game, ref) {
    game.selectedInventoryRef = ref;
    game.renderInventory?.();
  }

  function sameRef(a, b) {
    if (!a || !b || a.source !== b.source) return false;
    return a.source === 'equipment' ? a.slot === b.slot : a.index === b.index;
  }

  function install(game) {
    if (installed || !game || !A || !V3) return false;
    installed = true;
    game.inventoryV4Installed = true;
    game.backpackCapacity = CAPACITY;
    ensureFloatingUi();
    document.querySelector('#inventoryLegacyItemListCompat')?.remove();

    const originalEquipItem = game.equipItem.bind(game);
    const originalStartNew = game.startNew.bind(game);
    const originalContinue = game.continueGame.bind(game);
    const originalTogglePanel = game.togglePanel.bind(game);

    game.getItemRequirementStatus = function (item) {
      return requirementStatus(this, item);
    };

    game.canEquipRequirements = function (item) {
      return requirementStatus(this, item).ok;
    };

    game.equipItem = function (index, forcedSlot) {
      const item = this.inventory?.[index];
      if (item?.type === 'equipment') {
        const req = requirementStatus(this, item);
        if (!req.ok) {
          const reason = !req.classOk ? 'classe incompatível' : !req.levelOk ? `nível ${req.requiredLevel} necessário` : 'pontos de atributo insuficientes';
          this.toast?.(`${item.name}: ${reason}.`);
          this.beep?.(120, .05, .018);
          return false;
        }
      }
      return originalEquipItem(index, forcedSlot);
    };

    game.discardInventoryRef = function (ref) {
      if (!ref) return false;
      let item = null;
      if (ref.source === 'inventory') item = this.inventory?.[ref.index] || null;
      if (ref.source === 'equipment') item = this.equipment?.[ref.slot] || null;
      if (!item) return false;
      const qty = item.qty && item.qty > 1 ? ` x${item.qty}` : '';
      const confirmed = global.confirm(`Descartar ${item.name}${qty}?\n\nEsta ação não pode ser desfeita.`);
      if (!confirmed) return false;

      if (ref.source === 'inventory') {
        this.inventory.splice(ref.index, 1);
      } else if (ref.source === 'equipment') {
        this.equipment[ref.slot] = null;
        this.recalculateEquipmentStats?.();
      }
      if (sameRef(this.selectedInventoryRef, ref)) this.selectedInventoryRef = null;
      this.renderInventory?.();
      this.save?.();
      this.toast?.(`${item.name} foi descartado.`);
      this.beep?.(96, .055, .018);
      return true;
    };

    game.renderItemDetails = function (root) {
      if (!root) return;
      const item = this.getSelectedItem?.();
      if (!item) {
        root.dataset.rarity = 'common';
        root.innerHTML = '<div class="item-details-empty"><strong>Inspecione seu equipamento</strong><span>No desktop, passe o mouse sobre um item. No mobile, pressione um item por 3 segundos para abrir os atributos e requisitos.</span></div>';
        return;
      }
      const ref = this.selectedInventoryRef;
      const req = requirementStatus(this, item);
      const equipped = ref?.source === 'equipment';
      root.dataset.rarity = item.rarity || 'common';
      root.innerHTML = `
        <div class="detail-title"><span class="detail-icon">${itemIconMarkup(item)}</span><div><small>${rarityLabel(item)} · ${slotLabel(item)}</small><h3>${item.name}</h3></div></div>
        <p>${item.description || 'Item encontrado em Astraeon.'}</p>
        <div class="detail-stats">${statsMarkup(this, item)}</div>
        <div class="detail-requirements">${requirementsMarkup(this, item)}</div>
        <div class="detail-actions">
          ${item.type === 'equipment' ? `<button class="inventory-action primary detail-primary" type="button" ${!equipped && !req.ok ? 'disabled' : ''}>${equipped ? 'Desequipar' : req.ok ? 'Equipar' : 'Requisitos não atendidos'}</button>` : ''}
          ${item.type === 'consumable' && ref?.source === 'inventory' ? '<button class="inventory-action primary detail-primary" type="button">Usar</button>' : ''}
          <button class="inventory-action danger detail-discard" type="button">Descartar</button>
        </div>`;
      root.querySelector('.detail-primary')?.addEventListener('click', () => {
        if (item.type === 'equipment') {
          if (equipped) this.unequipItem(ref.slot);
          else this.equipItem(ref.index);
        } else if (item.type === 'consumable' && ref?.source === 'inventory') this.useInventoryItem(ref.index);
      });
      root.querySelector('.detail-discard')?.addEventListener('click', () => this.discardInventoryRef(ref));
    };

    game.renderInventory = function () {
      if (!this.player) return;
      this.backpackCapacity = CAPACITY;
      const grid = document.querySelector('#inventoryGrid');
      const equipmentGrid = document.querySelector('#equipmentGrid');
      const stats = document.querySelector('#equipmentStats');
      const details = document.querySelector('#itemDetails');
      const meta = document.querySelector('#inventoryMeta');
      const counter = document.querySelector('#backpackCounter');
      if (!grid || !equipmentGrid) return;

      this.inventory = (this.inventory || []).map(A.normalizeLegacyItem).filter(Boolean);
      const className = CLASS_LABELS[this.player.classId] || this.player.classId;
      if (meta) meta.innerHTML = `<span>${className}</span><b>Nv. ${this.player.level}</b><b>${this.inventory.length}/${CAPACITY} slots</b><b>${this.gold} ouro</b>`;
      if (counter) counter.textContent = `${this.inventory.length}/${CAPACITY}`;

      const portrait = document.querySelector('.equipment-portrait');
      const cls = W?.CLASS_DATA?.[this.player.classId];
      if (portrait && cls) {
        portrait.style.setProperty('--portrait', `url("Assets/Classes/${cls.sprite}")`);
        portrait.dataset.class = this.player.classId;
        portrait.innerHTML = `<span>${className}</span><small>${this.player.name} · Nv. ${this.player.level}</small>`;
      }

      equipmentGrid.innerHTML = '';
      Object.entries(A.slots || {}).forEach(([slotId, info]) => {
        const item = this.equipment?.[slotId] || null;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `equipment-slot slot-${slotId}`;
        el.dataset.slot = slotId;
        el.dataset.category = SLOT_CATEGORY[slotId] || 'armor';
        if (item) {
          const req = requirementStatus(this, item);
          el.dataset.rarity = item.rarity || 'common';
          el.classList.toggle('class-locked', !req.ok);
          el.innerHTML = `<small>${info.label}</small><strong>${itemIconMarkup(item)}</strong><span>${item.name}</span>`;
          el.classList.toggle('selected', sameRef(this.selectedInventoryRef, { source: 'equipment', slot: slotId }));
          el.addEventListener('click', () => setSelected(this, { source: 'equipment', slot: slotId }));
          el.addEventListener('dblclick', () => this.unequipItem(slotId));
          el.addEventListener('contextmenu', event => { event.preventDefault(); this.unequipItem(slotId); });
          const ref = { source: 'equipment', slot: slotId };
          bindInspectEvents(this, el, item, ref);
          bindDragSource(el, ref);
        } else {
          el.classList.add('empty');
          el.innerHTML = `<small>${info.label}</small><strong>${info.icon}</strong><span>Vazio</span>`;
        }
        el.addEventListener('dragover', event => {
          if (event.dataTransfer.types.includes('text/astraeon-item')) {
            event.preventDefault();
            el.classList.add('dragover');
          }
        });
        el.addEventListener('dragleave', () => el.classList.remove('dragover'));
        el.addEventListener('drop', event => {
          event.preventDefault();
          el.classList.remove('dragover');
          try {
            const data = JSON.parse(event.dataTransfer.getData('text/astraeon-item'));
            if (data.source === 'inventory') this.equipItem(data.index, slotId);
          } catch (_) {}
        });
        equipmentGrid.appendChild(el);
      });

      const bonuses = this.getEquipmentBonuses?.() || {};
      if (stats) stats.innerHTML = `
        <div><span>Poder</span><b>${this.player.power}<i>+${bonuses.power || 0}</i></b></div>
        <div><span>Defesa</span><b>${this.player.defense}<i>+${bonuses.defense || 0}</i></b></div>
        <div><span>Vida</span><b>${this.player.maxHp}<i>+${bonuses.maxHp || 0}</i></b></div>
        <div><span>Mana</span><b>${this.player.maxMana}<i>+${bonuses.maxMana || 0}</i></b></div>
        <div><span>Velocidade</span><b>${this.player.speed}<i>+${bonuses.speed || 0}</i></b></div>
        <div><span>Crítico</span><b>${Math.round(this.player.crit * 100)}%<i>+${((bonuses.crit || 0) * 100).toFixed(1)}%</i></b></div>`;

      const search = String(this.inventorySearch || '').trim().toLowerCase();
      const filter = this.inventoryFilter || 'all';
      const visible = this.inventory.map((item, index) => ({ item, index })).filter(({ item }) => {
        const filterOk = filter === 'all' || item.type === filter;
        if (!filterOk) return false;
        if (!search) return true;
        return `${item.name || ''} ${item.description || ''} ${item.slot || ''}`.toLowerCase().includes(search);
      });

      grid.innerHTML = '';
      visible.forEach(({ item, index }) => {
        const ref = { source: 'inventory', index };
        const req = requirementStatus(this, item);
        const slot = document.createElement('button');
        slot.type = 'button';
        slot.className = 'inventory-slot item-card-slot';
        slot.dataset.index = String(index);
        slot.dataset.rarity = item.rarity || 'common';
        slot.dataset.category = item.type === 'equipment' ? (SLOT_CATEGORY[item.slot] || 'armor') : item.type;
        slot.classList.toggle('selected', sameRef(this.selectedInventoryRef, ref));
        slot.classList.toggle('class-locked', item.type === 'equipment' && !req.ok);
        slot.innerHTML = `<strong>${itemIconMarkup(item)}</strong><span>${item.name}</span>${item.qty ? `<em>${item.qty}</em>` : ''}${item.type === 'equipment' && !req.ok ? '<i class="req-lock">!</i>' : ''}`;
        slot.addEventListener('click', () => setSelected(this, ref));
        slot.addEventListener('dblclick', () => item.type === 'equipment' ? this.equipItem(index) : item.type === 'consumable' ? this.useInventoryItem(index) : null);
        slot.addEventListener('contextmenu', event => {
          event.preventDefault();
          if (item.type === 'equipment') this.equipItem(index);
          else if (item.type === 'consumable') this.useInventoryItem(index);
        });
        bindInspectEvents(this, slot, item, ref);
        bindDragSource(slot, ref);
        grid.appendChild(slot);
      });

      const filteredOutCount = Math.max(0, this.inventory.length - visible.length);
      for (let i = 0; i < filteredOutCount; i++) {
        const reserved = document.createElement('button');
        reserved.type = 'button';
        reserved.className = 'inventory-slot filtered-out';
        reserved.disabled = true;
        reserved.title = 'Slot ocupado por item oculto pelo filtro atual';
        reserved.innerHTML = '<span class="empty-rune">◦</span>';
        grid.appendChild(reserved);
      }
      const emptyCount = Math.max(0, CAPACITY - this.inventory.length);
      for (let i = 0; i < emptyCount; i++) {
        const empty = document.createElement('button');
        empty.type = 'button';
        empty.className = 'inventory-slot empty';
        empty.disabled = true;
        empty.innerHTML = '<span class="empty-rune">·</span>';
        grid.appendChild(empty);
      }
      grid.ondragover = event => {
        if (event.dataTransfer.types.includes('text/astraeon-item')) event.preventDefault();
      };
      grid.ondrop = event => {
        event.preventDefault();
        try {
          const data = JSON.parse(event.dataTransfer.getData('text/astraeon-item'));
          if (data.source === 'equipment') this.unequipItem(data.slot);
        } catch (_) {}
      };

      const trash = document.querySelector('#inventoryTrash');
      if (trash) {
        trash.ondragover = event => {
          if (!event.dataTransfer.types.includes('text/astraeon-item')) return;
          event.preventDefault();
          trash.classList.add('dragover');
        };
        trash.ondragleave = () => trash.classList.remove('dragover');
        trash.ondrop = event => {
          event.preventDefault();
          trash.classList.remove('dragover', 'drag-active');
          try { this.discardInventoryRef(JSON.parse(event.dataTransfer.getData('text/astraeon-item'))); } catch (_) {}
        };
        trash.onclick = () => {
          if (!this.selectedInventoryRef) {
            this.toast?.('Selecione um item ou arraste-o até a lixeira.');
            return;
          }
          this.discardInventoryRef(this.selectedInventoryRef);
        };
      }

      this.renderItemDetails(details);
      document.querySelector('.backpack-column')?.classList.toggle('bag-full', this.inventory.length >= CAPACITY);
    };

    game.startNew = function (...args) {
      const result = originalStartNew(...args);
      this.backpackCapacity = CAPACITY;
      this.renderInventory?.();
      return result;
    };
    game.continueGame = function (...args) {
      const result = originalContinue(...args);
      this.backpackCapacity = CAPACITY;
      if ((this.inventory?.length || 0) > CAPACITY) {
        const overflow = this.inventory.splice(CAPACITY);
        overflow.forEach((item, index) => this.pickups?.push?.({
          type: 'loot', x: this.player.x + (index % 3 - 1) * 14, y: this.player.y + Math.floor(index / 3) * 12,
          value: item, life: 90, persistent: true, blockedByCapacity: true
        }));
      }
      this.renderInventory?.();
      return result;
    };
    game.togglePanel = function (panel) {
      const result = originalTogglePanel(panel);
      if (panel === this.ui.inventoryPanel) {
        hideTooltip();
        hideInspectSheet();
        if (!panel.classList.contains('hidden')) {
          this.backpackCapacity = CAPACITY;
          this.renderInventory?.();
        }
      }
      return result;
    };

    document.querySelector('#inventorySearch')?.addEventListener('input', event => {
      game.inventorySearch = event.target.value;
      game.renderInventory?.();
    });
    document.querySelectorAll('[data-inventory-filter]').forEach(button => button.addEventListener('click', () => {
      game.inventoryFilter = button.dataset.inventoryFilter;
      document.querySelectorAll('[data-inventory-filter]').forEach(x => x.classList.toggle('active', x === button));
      game.renderInventory?.();
    }));

    game.renderInventory?.();
    global.AstraeonInventoryV4 = { CAPACITY, LONG_PRESS_MS, requirementStatus };
    return true;
  }

  function waitForRuntime() {
    if (installed) return;
    const game = global.astraeon;
    const itemsApi = global.AstraeonItems;
    const itemsV3 = global.AstraeonItemsV3;
    if (game && itemsApi && itemsV3 && game.systemsV30BInstalled) {
      A = itemsApi;
      V3 = itemsV3;
      install(game);
      return;
    }
    global.setTimeout(waitForRuntime, 60);
  }

  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', waitForRuntime, { once: true });
  else waitForRuntime();
})(window);

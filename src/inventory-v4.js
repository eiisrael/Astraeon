(function (global) {
  'use strict';

  const W = global.AstraeonWorld;
  let A = null;
  let V3 = null;

  const CAPACITY = 25;
  const INSPECT_HOLD_MS = 1000;
  const DRAG_MIME = 'application/x-astraeon-item';
  const ALL_CLASSES = ['Warrior', 'Mage', 'Archer', 'Assassin', 'Paladine'];

  const CLASS_LABELS = {
    Warrior: 'Guerreiro', Mage: 'Mago', Archer: 'Arqueiro', Assassin: 'Assassino', Paladine: 'Paladino'
  };
  const STAT_LABELS = {
    power: 'Poder', defense: 'Defesa', maxHp: 'Vida', maxMana: 'Mana', speed: 'Velocidade', range: 'Alcance', crit: 'Crítico',
    strength: 'Força', magic: 'Magia', dexterity: 'Destreza', heal: 'Cura', mana: 'Mana', healPct: 'Cura %', manaPct: 'Mana %'
  };
  const SLOT_CATEGORY = {
    pet: 'companion', head: 'armor', cloak: 'armor', weapon: 'weapon', chest: 'armor', offhand: 'weapon',
    hands: 'armor', legs: 'armor', boots: 'armor', necklace: 'accessory', ring: 'accessory', amulet: 'accessory', relic: 'realm'
  };
  const RARITY_LABELS = {
    common: 'Comum', uncommon: 'Incomum', rare: 'Raro', epic: 'Épico', legendary: 'Lendário'
  };
  const DEFAULT_PURCHASE_VALUE = {
    common: 90, uncommon: 180, rare: 420, epic: 980, legendary: 2400
  };

  let installed = false;
  let tooltip = null;
  let tooltipSourceElement = null;
  let armed = null;
  let armTimer = 0;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function isCoarsePointer() {
    return !!global.matchMedia?.('(pointer:coarse)').matches || document.body.classList.contains('touch-forced');
  }

  function hasFinePointer() {
    return !!global.matchMedia?.('(any-pointer:fine)').matches || !global.matchMedia?.('(pointer:coarse)').matches;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    })[char]);
  }

  function itemArt(item) {
    if (typeof V3?.artFor === 'function') return V3.artFor(item);
    const icon = String(item?.icon || '◇');
    if (icon.includes('<img')) {
      const match = icon.match(/src=["']([^"']+)/i);
      if (match) return match[1];
    }
    return '';
  }

  function itemIconMarkup(item) {
    const src = itemArt(item);
    if (src) return `<img class="item-art-img" src="${escapeHtml(src)}" draggable="false" alt="">`;
    const glyph = String(item?.icon || '◇').replace(/<[^>]+>/g, '') || '◇';
    return `<span class="inventory-rune">${escapeHtml(glyph)}</span>`;
  }

  function rarityLabel(item) {
    return RARITY_LABELS[item?.rarity] || 'Comum';
  }

  function itemTypeLabel(game, item) {
    if (typeof game?.itemTypeLabel === 'function') return game.itemTypeLabel(item);
    if (item?.type === 'equipment') return 'Equipamento';
    if (item?.type === 'consumable') return 'Consumível';
    if (item?.type === 'material') return 'Material';
    return 'Item';
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
    const n = Number(value) || 0;
    if (key === 'crit') return `${Math.round(n * 1000) / 10}%`;
    if (key.endsWith('Pct')) return `${Math.round(n * 10) / 10}%`;
    return String(Math.round(n));
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
      const requiredValue = Number(required) || 0;
      return {
        key, label: STAT_LABELS[key] || key, required: requiredValue, current, ok: current >= requiredValue
      };
    });
    const statsOk = stats.every(row => row.ok);
    return { allowed, requiredLevel, classOk, levelOk, stats, statsOk, ok: classOk && levelOk && statsOk };
  }

  function purchaseValue(item) {
    const candidates = [item?.buyPrice, item?.purchasePrice, item?.shopPrice, item?.price];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) return value;
    }
    const base = DEFAULT_PURCHASE_VALUE[item?.rarity] || DEFAULT_PURCHASE_VALUE.common;
    const level = Math.max(1, Number(item?.level || item?.requiredLevel || 1) || 1);
    const typeMultiplier = item?.type === 'equipment' ? 1.2 : item?.type === 'consumable' ? .7 : .9;
    return Math.max(10, Math.round(base * typeMultiplier * (1 + Math.max(0, level - 1) * .08)));
  }

  function saleValue(item) {
    return Math.max(1, Math.floor(purchaseValue(item) * .10));
  }

  function attributeRows(game, item) {
    const rows = [];
    const seen = new Set();
    const push = (label, value, key = label) => {
      if (value === undefined || value === null || value === '' || seen.has(key)) return;
      seen.add(key);
      rows.push({ label, value: String(value) });
    };

    Object.entries(item?.stats || {}).forEach(([key, value]) => {
      if (!Number(value)) return;
      const sign = Number(value) > 0 ? '+' : '';
      push(STAT_LABELS[key] || key, `${sign}${formatStatValue(key, value)}`, `stat:${key}`);
    });
    if (Number(item?.heal) > 0) push('Cura', `+${Math.round(Number(item.heal))}`, 'heal');
    if (Number(item?.mana) > 0) push('Mana restaurada', `+${Math.round(Number(item.mana))}`, 'mana');
    if (Number(item?.healPct) > 0) push('Cura percentual', `+${formatStatValue('healPct', item.healPct)}`, 'healPct');
    if (Number(item?.manaPct) > 0) push('Mana percentual', `+${formatStatValue('manaPct', item.manaPct)}`, 'manaPct');
    if (Number(item?.qty) > 1) push('Quantidade', `x${Math.round(Number(item.qty))}`, 'qty');

    if (!rows.length && typeof game?.itemStatsText === 'function') {
      (game.itemStatsText(item) || []).forEach((text, index) => push('Bônus', text, `fallback:${index}`));
    }
    return rows;
  }

  function requirementsMarkup(game, item) {
    const req = requirementStatus(game, item);
    const classes = req.allowed.map(cls => CLASS_LABELS[cls] || cls).join(' · ');
    const rows = [
      `<div class="requirement-row ${req.classOk ? 'ok' : 'blocked'}"><span>${req.classOk ? '✓' : '×'}</span><div><b>Classes</b><small>${escapeHtml(classes)}</small></div></div>`
    ];

    if (item?.type === 'equipment') {
      rows.push(`<div class="requirement-row ${req.levelOk ? 'ok' : 'blocked'}"><span>${req.levelOk ? '✓' : '×'}</span><div><b>Nível</b><small>Necessário ${req.requiredLevel} · atual ${Math.max(1, Number(game?.player?.level || 1))}</small></div></div>`);
      if (req.stats.length) {
        req.stats.forEach(stat => rows.push(
          `<div class="requirement-row ${stat.ok ? 'ok' : 'blocked'}"><span>${stat.ok ? '✓' : '×'}</span><div><b>${escapeHtml(stat.label)}</b><small>${escapeHtml(formatStatValue(stat.key, stat.current))} / ${escapeHtml(formatStatValue(stat.key, stat.required))} pontos</small></div></div>`
        ));
      } else {
        rows.push('<div class="requirement-row ok"><span>✓</span><div><b>Pontos</b><small>Sem requisito adicional</small></div></div>');
      }
    } else {
      rows.push('<div class="requirement-row ok"><span>✓</span><div><b>Uso</b><small>Sem restrição de equipamento</small></div></div>');
    }
    return rows.join('');
  }

  function attributesMarkup(game, item) {
    const rows = attributeRows(game, item);
    if (!rows.length) return '<div class="inspect-attribute neutral"><span>Combate</span><b>Sem bônus</b></div>';
    return rows.map(row => `<div class="inspect-attribute"><span>${escapeHtml(row.label)}</span><b>${escapeHtml(row.value)}</b></div>`).join('');
  }

  function ensureFloatingUi() {
    if (!tooltip) {
      tooltip = document.createElement('section');
      tooltip.id = 'inventoryItemTooltip';
      tooltip.className = 'inventory-item-tooltip hidden';
      tooltip.setAttribute('role', 'dialog');
      tooltip.setAttribute('aria-label', 'Informações do item');
      document.body.appendChild(tooltip);
    }
  }

  function inspectMarkup(game, item) {
    const req = requirementStatus(game, item);
    const classNames = req.allowed.map(cls => CLASS_LABELS[cls] || cls).join(' · ');
    return `
      <div class="inspect-head" data-rarity="${escapeHtml(item?.rarity || 'common')}">
        <div class="inspect-art">${itemIconMarkup(item)}</div>
        <div class="inspect-title">
          <small>${escapeHtml(rarityLabel(item))} · ${escapeHtml(itemTypeLabel(game, item))}</small>
          <h3>${escapeHtml(item?.name || 'Item')}</h3>
          <span>${escapeHtml(item?.description || 'Item encontrado em Astraeon.')}</span>
        </div>
      </div>
      <div class="inspect-quick-meta">
        <span><small>CLASSES</small><b>${escapeHtml(classNames)}</b></span>
        <span><small>NÍVEL</small><b>${item?.type === 'equipment' ? escapeHtml(req.requiredLevel) : '—'}</b></span>
        <span class="sell"><small>VALOR DE VENDA</small><b>${saleValue(item)} ouro</b></span>
      </div>
      <div class="inspect-section">
        <b>Atributos do item</b>
        <div class="inspect-attributes">${attributesMarkup(game, item)}</div>
      </div>
      <div class="inspect-section">
        <b>Requisitos de uso</b>
        <div class="inspect-requirements">${requirementsMarkup(game, item)}</div>
      </div>
    `;
  }

  function positionTooltip(x, y) {
    if (!tooltip || tooltip.classList.contains('hidden')) return;
    const pad = 12;
    tooltip.style.transform = 'none';
    const rect = tooltip.getBoundingClientRect();
    const scale = Math.min(1, (innerWidth - pad * 2) / rect.width, (innerHeight - pad * 2) / rect.height);
    const width = rect.width * scale;
    const height = rect.height * scale;
    let left = x + 16;
    let top = y + 12;
    if (left + width > innerWidth - pad) left = x - width - 16;
    if (top + height > innerHeight - pad) top = innerHeight - height - pad;
    tooltip.style.left = `${Math.max(pad, Math.round(left))}px`;
    tooltip.style.top = `${Math.max(pad, Math.round(top))}px`;
    tooltip.style.transform = scale < 1 ? `scale(${scale})` : 'none';
  }

  function showTooltip(game, element, item, x, y) {
    ensureFloatingUi();
    tooltip.innerHTML = inspectMarkup(game, item);
    tooltip.dataset.rarity = item?.rarity || 'common';
    tooltipSourceElement = element;
    tooltip.classList.remove('hidden');
    positionTooltip(x, y);
  }

  function hideTooltip() {
    tooltip?.classList.add('hidden');
    tooltipSourceElement = null;
  }

  function clearArming() {
    if (armTimer) global.clearTimeout(armTimer);
    armTimer = 0;
    if (armed?.element) {
      armed.element.classList.remove('inspect-arming', 'inspect-arming-press');
      armed.element.style.removeProperty('--inspect-arm-duration');
    }
    armed = null;
  }

  function beginArming(game, element, item, delay, x, y) {
    clearArming();
    armed = { game, element, item, x, y, startX: x, startY: y };
    element.style.setProperty('--inspect-arm-duration', `${delay}ms`);
    element.classList.add('inspect-arming', 'inspect-arming-press');
    armTimer = global.setTimeout(() => {
      const snapshot = armed;
      clearArming();
      if (!snapshot) return;
      if (snapshot.pointerType !== 'mouse') {
        try { navigator.vibrate?.(24); } catch (_) {}
      }
      showTooltip(snapshot.game, snapshot.element, snapshot.item, snapshot.x, snapshot.y);
    }, delay);
  }

  function bindInspectEvents(game, element, item) {
    element.addEventListener('pointerleave', event => {
      if (armed?.element === element) clearArming();
      if (event.pointerType === 'mouse' && tooltipSourceElement === element) hideTooltip();
    });

    element.addEventListener('pointerdown', event => {
      if (event.button != null && event.button !== 0) return;
      beginArming(game, element, item, INSPECT_HOLD_MS, event.clientX, event.clientY);
      if (armed) armed.pointerType = event.pointerType || 'mouse';
    }, { passive: true });
    element.addEventListener('pointermove', event => {
      if (armed?.element !== element) return;
      if (Math.hypot(event.clientX - armed.startX, event.clientY - armed.startY) > 5) clearArming();
    }, { passive: true });
    ['pointerup', 'pointercancel'].forEach(type => element.addEventListener(type, () => {
      if (armed?.element === element) clearArming();
    }, { passive: true }));
  }

  function parseDragRef(dataTransfer) {
    if (!dataTransfer) return null;
    for (const type of [DRAG_MIME, 'text/astraeon-item', 'text/plain']) {
      try {
        const raw = dataTransfer.getData(type);
        if (!raw) continue;
        const parsed = JSON.parse(raw);
        if (parsed?.source === 'inventory' || parsed?.source === 'equipment') return parsed;
      } catch (_) {}
    }
    return null;
  }

  function bindDragSource(game, element, ref) {
    // O modo de toque pode permanecer ativo em notebooks híbridos. O mouse
    // continua sendo uma origem de drag válida quando qualquer ponteiro fino existe.
    element.draggable = hasFinePointer();
    element.setAttribute('aria-grabbed', 'false');
    element.querySelectorAll('img').forEach(img => {
      img.draggable = false;
      img.setAttribute('draggable', 'false');
    });
    element.addEventListener('dragstart', event => {
      if (!event.dataTransfer) return;
      clearArming();
      hideTooltip();
      const raw = JSON.stringify(ref);
      try { event.dataTransfer.setData(DRAG_MIME, raw); } catch (_) {}
      try { event.dataTransfer.setData('text/astraeon-item', raw); } catch (_) {}
      try { event.dataTransfer.setData('text/plain', raw); } catch (_) {}
      event.dataTransfer.effectAllowed = 'move';
      game.selectedInventoryRef = ref;
      element.classList.add('dragging');
      element.setAttribute('aria-grabbed', 'true');
      document.querySelector('#inventoryTrash')?.classList.add('drag-active');
    });
    element.addEventListener('dragend', () => {
      element.classList.remove('dragging');
      element.setAttribute('aria-grabbed', 'false');
      document.querySelector('#inventoryTrash')?.classList.remove('drag-active', 'dragover');
    });
  }

  function sameRef(a, b) {
    if (!a || !b || a.source !== b.source) return false;
    return a.source === 'equipment' ? a.slot === b.slot : Number(a.index) === Number(b.index);
  }

  function selectRef(game, ref) {
    game.selectedInventoryRef = ref;
    game.renderInventory?.();
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
    game.getItemSaleValue = function (item) {
      return saleValue(item);
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
      if (ref.source === 'inventory') item = this.inventory?.[Number(ref.index)] || null;
      if (ref.source === 'equipment') item = this.equipment?.[ref.slot] || null;
      if (!item) {
        this.toast?.('O item não está mais disponível.');
        return false;
      }

      const qty = Number(item.qty) > 1 ? ` x${Math.round(Number(item.qty))}` : '';
      const confirmed = global.confirm(`Descartar ${item.name}${qty}?\n\nEsta ação não pode ser desfeita.`);
      if (!confirmed) return false;

      if (ref.source === 'inventory') {
        this.inventory.splice(Number(ref.index), 1);
      } else {
        this.equipment[ref.slot] = null;
        this.recalculateEquipmentStats?.();
      }

      if (sameRef(this.selectedInventoryRef, ref)) this.selectedInventoryRef = null;
      hideTooltip();
      this.renderInventory?.();
      this.save?.();
      this.toast?.(`${item.name} foi descartado.`);
      this.beep?.(96, .055, .018);
      return true;
    };

    game.reorderInventoryItem = function (fromIndex, toIndex) {
      const from = Number(fromIndex);
      let to = Number(toIndex);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 0 || to < 0 || from >= (this.inventory?.length || 0) || to >= (this.inventory?.length || 0) || from === to) return false;
      const [item] = this.inventory.splice(from, 1);
      to = Math.min(to, this.inventory.length);
      this.inventory.splice(to, 0, item);
      this.selectedInventoryRef = { source: 'inventory', index: to };
      this.renderInventory?.();
      this.save?.();
      this.toast?.(`${item.name} foi movido na mochila.`);
      return true;
    };

    game.renderItemDetails = function (root) {
      if (!root) return;
      const item = this.getSelectedItem?.();
      if (!item) {
        root.innerHTML = '<span>Pressione e segure um item por 1 segundo para inspecionar.</span>';
        return;
      }
      root.innerHTML = inspectMarkup(this, item);
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
      const className = CLASS_LABELS[this.player.classId] || this.player.classId || 'Viajante';
      if (meta) meta.innerHTML = `<span>${escapeHtml(className)}</span><b>Nv. ${Math.max(1, Number(this.player.level || 1))}</b><b>${this.inventory.length}/${CAPACITY}</b><b>${Math.round(Number(this.gold || 0))} ouro</b>`;
      if (counter) counter.textContent = `${this.inventory.length}/${CAPACITY}`;

      const portrait = document.querySelector('.equipment-portrait');
      const cls = W?.CLASS_DATA?.[this.player.classId];
      if (portrait && cls) {
        portrait.style.setProperty('--portrait', `url("Assets/Classes/${cls.sprite}")`);
        portrait.dataset.class = this.player.classId;
        portrait.innerHTML = `<span>${escapeHtml(className)}</span><small>${escapeHtml(this.player.name || 'Viajante')} · Nv. ${Math.max(1, Number(this.player.level || 1))}</small>`;
      }

      equipmentGrid.innerHTML = '';
      Object.entries(A.slots || {}).forEach(([slotId, info]) => {
        const item = this.equipment?.[slotId] || null;
        const el = document.createElement('button');
        el.type = 'button';
        el.className = `equipment-slot slot-${slotId}`;
        el.dataset.slot = slotId;
        el.dataset.category = SLOT_CATEGORY[slotId] || 'armor';
        el.removeAttribute('title');

        if (item) {
          const req = requirementStatus(this, item);
          const ref = { source: 'equipment', slot: slotId };
          el.dataset.rarity = item.rarity || 'common';
          el.classList.toggle('class-locked', !req.ok);
          el.classList.toggle('selected', sameRef(this.selectedInventoryRef, ref));
          el.innerHTML = `<small>${escapeHtml(info.label)}</small><strong>${itemIconMarkup(item)}</strong><span>${escapeHtml(item.name)}</span><i class="inspect-progress" aria-hidden="true"></i>`;
          el.setAttribute('aria-label', `${item.name}, ${rarityLabel(item)}`);
          el.addEventListener('click', () => selectRef(this, ref));
          el.addEventListener('dblclick', () => this.unequipItem(slotId));
          el.addEventListener('contextmenu', event => {
            event.preventDefault();
            if (!isCoarsePointer()) this.unequipItem(slotId);
          });
          bindInspectEvents(this, el, item);
          bindDragSource(this, el, ref);
        } else {
          el.classList.add('empty');
          el.innerHTML = `<small>${escapeHtml(info.label)}</small><strong>${escapeHtml(info.icon || '◇')}</strong><span>Vazio</span>`;
          el.draggable = false;
        }

        el.addEventListener('dragover', event => {
          if (!parseDragRef(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          el.classList.add('dragover');
        });
        el.addEventListener('dragleave', () => el.classList.remove('dragover'));
        el.addEventListener('drop', event => {
          const data = parseDragRef(event.dataTransfer);
          if (!data) return;
          event.preventDefault();
          el.classList.remove('dragover');
          if (data.source === 'inventory') this.equipItem(Number(data.index), slotId);
        });
        equipmentGrid.appendChild(el);
      });

      const bonuses = this.getEquipmentBonuses?.() || {};
      if (stats) stats.innerHTML = `
        <div><span>Poder</span><b>${Math.round(Number(this.player.power || 0))}<i>+${Math.round(Number(bonuses.power || 0))}</i></b></div>
        <div><span>Defesa</span><b>${Math.round(Number(this.player.defense || 0))}<i>+${Math.round(Number(bonuses.defense || 0))}</i></b></div>
        <div><span>Vida</span><b>${Math.round(Number(this.player.maxHp || 0))}<i>+${Math.round(Number(bonuses.maxHp || 0))}</i></b></div>
        <div><span>Mana</span><b>${Math.round(Number(this.player.maxMana || 0))}<i>+${Math.round(Number(bonuses.maxMana || 0))}</i></b></div>
        <div><span>Vel.</span><b>${Math.round(Number(this.player.speed || 0))}<i>+${Math.round(Number(bonuses.speed || 0))}</i></b></div>
        <div><span>Crítico</span><b>${Math.round(Number(this.player.crit || 0) * 100)}%<i>+${(Number(bonuses.crit || 0) * 100).toFixed(1)}%</i></b></div>`;

      const search = String(this.inventorySearch || '').trim().toLowerCase();
      const filter = this.inventoryFilter || 'all';
      const visible = this.inventory.map((item, index) => ({ item, index })).filter(({ item }) => {
        if (filter !== 'all' && item.type !== filter) return false;
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
        slot.removeAttribute('title');
        slot.innerHTML = `<strong>${itemIconMarkup(item)}</strong>${Number(item.qty) > 1 ? `<em>${Math.round(Number(item.qty))}</em>` : ''}${item.type === 'equipment' && !req.ok ? '<i class="req-lock">!</i>' : ''}<i class="inspect-progress" aria-hidden="true"></i>`;
        slot.setAttribute('aria-label', `${item.name}, ${rarityLabel(item)}`);
        slot.addEventListener('click', () => selectRef(this, ref));
        slot.addEventListener('dblclick', () => item.type === 'equipment' ? this.equipItem(index) : item.type === 'consumable' ? this.useInventoryItem(index) : null);
        slot.addEventListener('contextmenu', event => {
          event.preventDefault();
          if (isCoarsePointer()) return;
          if (item.type === 'equipment') this.equipItem(index);
          else if (item.type === 'consumable') this.useInventoryItem(index);
        });
        bindInspectEvents(this, slot, item);
        bindDragSource(this, slot, ref);
        grid.appendChild(slot);
      });

      const occupiedHidden = Math.max(0, this.inventory.length - visible.length);
      for (let i = 0; i < occupiedHidden; i++) {
        const reserved = document.createElement('button');
        reserved.type = 'button';
        reserved.className = 'inventory-slot filtered-out';
        reserved.disabled = true;
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
        if (!parseDragRef(event.dataTransfer)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
      };
      grid.ondrop = event => {
        const data = parseDragRef(event.dataTransfer);
        if (!data) return;
        event.preventDefault();
        if (data.source === 'equipment') this.unequipItem(data.slot);
        if (data.source === 'inventory') {
          const target = event.target?.closest?.('.inventory-slot[data-index]');
          if (target) this.reorderInventoryItem(Number(data.index), Number(target.dataset.index));
        }
      };

      const trash = document.querySelector('#inventoryTrash');
      if (trash) {
        trash.ondragenter = event => {
          if (!parseDragRef(event.dataTransfer)) return;
          event.preventDefault();
          trash.classList.add('dragover');
        };
        trash.ondragover = event => {
          if (!parseDragRef(event.dataTransfer)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'move';
          trash.classList.add('dragover');
        };
        trash.ondragleave = event => {
          if (!trash.contains(event.relatedTarget)) trash.classList.remove('dragover');
        };
        trash.ondrop = event => {
          const data = parseDragRef(event.dataTransfer);
          if (!data) return;
          event.preventDefault();
          event.stopPropagation();
          trash.classList.remove('dragover', 'drag-active');
          this.discardInventoryRef(data);
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
          type: 'loot',
          x: this.player.x + (index % 3 - 1) * 14,
          y: this.player.y + Math.floor(index / 3) * 12,
          value: item,
          life: 90,
          persistent: true,
          blockedByCapacity: true
        }));
      }
      this.renderInventory?.();
      return result;
    };

    game.togglePanel = function (panel) {
      const result = originalTogglePanel(panel);
      if (panel === this.ui.inventoryPanel) {
        clearArming();
        hideTooltip();
        if (!panel.classList.contains('hidden')) {
          this.backpackCapacity = CAPACITY;
          this.renderInventory?.();
          requestAnimationFrame(() => {
            const layout = panel.querySelector('.inventory-layout');
            if (layout) layout.scrollTop = 0;
            panel.querySelectorAll('.equipment-column,.backpack-column').forEach(column => { column.scrollTop = 0; });
          });
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
    document.addEventListener('pointerdown', event => {
      if (!tooltip || tooltip.classList.contains('hidden')) return;
      if (!tooltipSourceElement?.contains(event.target)) hideTooltip();
    }, true);
    document.addEventListener('pointermove', event => {
      if (event.pointerType === 'mouse' && tooltipSourceElement && !tooltipSourceElement.contains(event.target)) hideTooltip();
    }, true);
    document.addEventListener('click', event => {
      if (!tooltip || tooltip.classList.contains('hidden') || !tooltipSourceElement?.contains(event.target)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
    global.addEventListener('blur', hideTooltip);
    global.addEventListener('astraeon:inventory-drag-start', () => { clearArming(); hideTooltip(); });

    global.AstraeonInventoryV4 = { CAPACITY, INSPECT_HOLD_MS, requirementStatus, saleValue };
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

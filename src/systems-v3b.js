(function () {
  'use strict';

  const W = window.AstraeonWorld;
  const A = window.AstraeonItems;
  const V3 = window.AstraeonItemsV3;
  const BACKPACK_CAPACITY = 30;
  const STAMINA_MAX = 100;
  const STAMINA_DRAIN = 24;
  const STAMINA_REGEN = 19;
  const STAMINA_DELAY = .65;
  const SPRINT_MULTIPLIER = 1.55;
  const MOB_DISPLAY_NAMES = Object.freeze({
    Slime:'Slime', Wolf:'Lobo', Globin:'Goblin', Orc:'Orc', Troll:'Troll', Pig_Monster:'Monstro Javali',
    Golem_Gelo:'Golem de Gelo', Spider:'Aranha', zombie:'Zumbi', sombra:'Sombra', Caveira:'Caveira',
    Squelleton:'Esqueleto', Draconato:'Draconato'
  });

  function getMobDisplayLevel(mob, data) {
    const explicit = Number(mob?.level);
    if (Number.isFinite(explicit) && explicit >= 1) return Math.max(1,Math.round(explicit));
    const baseHp = Math.max(1,Number(data?.hp) || 1);
    const scaledHp = Math.max(1,Number(mob?.maxHp) || baseHp);
    return Math.max(1,Math.round(1 + ((scaledHp / baseHp) - 1) / .08));
  }

  function install() {
    const game = window.astraeon;
    if (!game || !W || !A || game.systemsV30BInstalled) return;
    game.systemsV30BInstalled = true;

    game.backpackCapacity = BACKPACK_CAPACITY;
    game.staminaMax = STAMINA_MAX;
    game.stamina = Number.isFinite(game.stamina) ? game.stamina : STAMINA_MAX;
    game.staminaRecoveryDelay = 0;
    game.sprinting = false;
    game.lastFullWarningAt = 0;
    game.lootArtCache = new Map();

    const staminaFill = document.querySelector('#staminaFill');
    const staminaText = document.querySelector('#staminaText');
    const lootWarning = document.querySelector('#lootWarning');

    const originalUpdate = game.update.bind(game);
    const originalSave = game.save.bind(game);
    const originalStartNew = game.startNew.bind(game);
    const originalContinue = game.continueGame.bind(game);
    const originalGainXp = game.gainXp.bind(game);
    const originalRenderInventory = game.renderInventory.bind(game);
    const originalAddInventoryItem = game.addInventoryItem?.bind(game);
    const originalUnequipItem = game.unequipItem?.bind(game);
    const originalKillMob = game.killMob.bind(game);
    const originalDrawMobs = game.drawMobs.bind(game);

    game.updateStaminaUI = function () {
      const max = Math.max(1,this.staminaMax || STAMINA_MAX);
      const value = Math.max(0,Math.min(max,Number(this.stamina)||0));
      if (staminaFill) staminaFill.style.width = `${value / max * 100}%`;
      if (staminaText) staminaText.textContent = `${Math.round(value)} / ${max}`;
      document.body.classList.toggle('is-sprinting', !!this.sprinting);
      document.body.classList.toggle('stamina-empty', value <= .5);
    };

    game.isBackpackFull = function () {
      return (this.inventory?.length || 0) >= (this.backpackCapacity || BACKPACK_CAPACITY);
    };

    game.canStoreItem = function (raw) {
      const item = A.normalizeLegacyItem?.(raw) || raw;
      if (!item) return false;
      if (item.stackable && this.inventory?.some(x => x?.id === item.id && x.stackable)) return true;
      return !this.isBackpackFull();
    };

    game.notifyBackpackFull = function (raw) {
      const now = performance.now();
      if (now - (this.lastFullWarningAt || 0) < 1500) return;
      this.lastFullWarningAt = now;
      const item = A.normalizeLegacyItem?.(raw) || raw || {};
      const count = this.inventory?.length || 0;
      if (lootWarning) {
        const art = V3?.artFor && item ? V3.artFor(item) : '';
        lootWarning.innerHTML = `${art ? `<img src="${art}" alt="">` : '<span class="loot-warning-icon">!</span>'}<div><b>Mochila cheia · ${count}/${this.backpackCapacity}</b><span>${item.name ? `${item.name} permanece no chão.` : 'O item permanece no chão.'} Libere um espaço para coletar.</span></div>`;
        lootWarning.classList.remove('show');
        void lootWarning.offsetWidth;
        lootWarning.classList.add('show');
        clearTimeout(this.lootWarningTimer);
        this.lootWarningTimer = setTimeout(() => lootWarning.classList.remove('show'), 3300);
      }
      this.toast?.('Mochila cheia — o item permanece no chão.');
      this.beep?.(105,.07,.024);
    };

    if (originalAddInventoryItem) {
      game.addInventoryItem = function (raw, options={}) {
        if (!this.canStoreItem(raw)) {
          if (!options.silent) this.notifyBackpackFull(raw);
          return false;
        }
        return originalAddInventoryItem(raw);
      };
    }

    if (originalUnequipItem) {
      game.unequipItem = function (slot) {
        if (this.equipment?.[slot] && this.isBackpackFull()) {
          this.notifyBackpackFull(this.equipment[slot]);
          return false;
        }
        return originalUnequipItem(slot);
      };
    }

    game.update = function (dt) {
      const p = this.player;
      if (!p) return originalUpdate(dt);

      const moving = this.keys?.has('w') || this.keys?.has('a') || this.keys?.has('s') || this.keys?.has('d') ||
        this.keys?.has('arrowup') || this.keys?.has('arrowdown') || this.keys?.has('arrowleft') || this.keys?.has('arrowright');
      const wantsSprint = moving && this.keys?.has('shift') && this.stamina > .35;
      this.sprinting = !!wantsSprint;

      if (this.sprinting) {
        this.stamina = Math.max(0,this.stamina - STAMINA_DRAIN * dt);
        this.staminaRecoveryDelay = STAMINA_DELAY;
      } else {
        this.staminaRecoveryDelay = Math.max(0,(this.staminaRecoveryDelay || 0) - dt);
        if (this.staminaRecoveryDelay <= 0) this.stamina = Math.min(this.staminaMax,this.stamina + STAMINA_REGEN * dt);
      }

      const normalSpeed = p.speed;
      if (this.sprinting) p.speed = Math.round(normalSpeed * SPRINT_MULTIPLIER);
      try { originalUpdate(dt); }
      finally { p.speed = normalSpeed; }

      if (this.stamina <= .35) this.sprinting = false;
      this.updateStaminaUI();
    };

    game.gainXp = function (amount) {
      const before = this.player?.level || 1;
      originalGainXp(amount);
      const after = this.player?.level || before;
      if (after > before) {
        this.stamina = this.staminaMax;
        this.staminaRecoveryDelay = 0;
        this.updateStaminaUI();
        this.toast?.(`Nível ${after}! Vida, mana e stamina restauradas.`);
      }
    };

    game.updatePickups = function (dt) {
      for (const pickup of this.pickups) {
        if (!pickup.persistent) pickup.life -= dt;
        const distance = W.dist(pickup.x,pickup.y,this.player.x,this.player.y);
        const canCollect = pickup.type === 'gold' || this.canStoreItem(pickup.value);

        if (distance < 84 && canCollect) {
          const d = Math.max(1,distance);
          pickup.x += (this.player.x - pickup.x) / d * 220 * dt;
          pickup.y += (this.player.y - pickup.y) / d * 220 * dt;
        }

        if (distance < 22) {
          if (pickup.type === 'gold') {
            this.gold += pickup.value;
            pickup.life = -1;
            this.beep?.(720,.035,.018);
          } else if (this.canStoreItem(pickup.value)) {
            const added = this.addInventoryItem(pickup.value,{silent:true});
            if (added) {
              pickup.life = -1;
              pickup.persistent = false;
              pickup.blockedByCapacity = false;
              this.beep?.(840,.04,.021);
              this.toast?.(`${pickup.value?.name || 'Item'} coletado.`);
              this.renderInventory?.();
            }
          } else {
            pickup.persistent = true;
            pickup.blockedByCapacity = true;
            pickup.life = Math.max(pickup.life || 0,90);
            this.notifyBackpackFull(pickup.value);
          }
        }
      }
      this.pickups = this.pickups.filter(x => x.persistent || x.life > 0);
    };

    game.killMob = function (mob) {
      originalKillMob(mob);
      const capacity = this.backpackCapacity || BACKPACK_CAPACITY;
      if ((this.inventory?.length || 0) > capacity) {
        const overflow = this.inventory.splice(capacity);
        overflow.forEach((item,index) => this.pickups.push({
          type:'loot', x:(mob?.x || this.player.x) + (index%3-1)*14, y:(mob?.y || this.player.y) + Math.floor(index/3)*12,
          value:item, life:90, persistent:true, blockedByCapacity:true
        }));
        if (overflow.length) this.notifyBackpackFull(overflow[0]);
      }
    };

    game.renderInventory = function () {
      originalRenderInventory();
      const meta = document.querySelector('#inventoryMeta');
      if (meta && this.player) {
        const count = this.inventory?.length || 0;
        const full = count >= this.backpackCapacity;
        meta.insertAdjacentHTML('beforeend',`<b class="bag-capacity ${full?'full':''}">${count}/${this.backpackCapacity} slots</b>`);
      }
      document.querySelector('.backpack-column')?.classList.toggle('bag-full',this.isBackpackFull());
    };

    game.drawMobs = function (ctx) {
      originalDrawMobs(ctx);
      if (!this.player) return;
      const visible = this.mobs.filter(m => !m.dead && Math.abs(m.x - this.player.x) < this.viewW * .8 + 400 && Math.abs(m.y - this.player.y) < this.viewH * .8 + 400);
      for (const mob of visible) {
        if (!(mob.aggro || mob.hit > 0 || mob.hp < mob.maxHp)) continue;
        const data = W.MOB_DATA[mob.type] || {};
        const name = MOB_DISPLAY_NAMES[mob.type] || data.name || String(mob.type || 'Criatura').replaceAll('_',' ');
        const level = getMobDisplayLevel(mob,data);
        const label = `${name} • Nv. ${level}`;
        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '700 9px Inter, sans-serif';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,.78)';
        ctx.strokeText(label,mob.x,mob.y - 47);
        ctx.fillStyle = '#f3ead8';
        ctx.fillText(label,mob.x,mob.y - 47);
        ctx.restore();
      }
    };

    game.drawPickups = function (ctx) {
      const t = performance.now() * .004;
      for (const pickup of this.pickups) {
        const bob = Math.sin(t + pickup.x * .03) * 3;
        ctx.save();
        ctx.translate(pickup.x,pickup.y + bob);

        if (pickup.type === 'gold') {
          ctx.shadowBlur = 14; ctx.shadowColor = '#f0c75a';
          ctx.fillStyle = '#e9b844'; ctx.beginPath(); ctx.arc(0,0,5,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = '#fff0a2'; ctx.lineWidth = 1; ctx.stroke();
          ctx.fillStyle = '#6e4313'; ctx.font = '700 7px serif'; ctx.textAlign = 'center'; ctx.fillText('A',0,2.5);
          ctx.restore();
          continue;
        }

        const item = pickup.value || {};
        const rarity = item.rarity || 'common';
        const color = {common:'#c1bbae',uncommon:'#79c992',rare:'#70a9ed',epic:'#c47bf0',legendary:'#f0bd4e'}[rarity] || '#c1bbae';
        const beam = rarity === 'legendary' ? 72 : rarity === 'epic' ? 54 : rarity === 'rare' ? 38 : 0;
        if (beam) {
          const g = ctx.createLinearGradient(0,-beam,0,10);
          g.addColorStop(0,'rgba(255,255,255,0)');
          g.addColorStop(1,color);
          ctx.globalAlpha = .18; ctx.fillStyle = g; ctx.fillRect(-7,-beam,14,beam + 12); ctx.globalAlpha = 1;
        }
        ctx.shadowBlur = pickup.blockedByCapacity ? 20 : 13;
        ctx.shadowColor = pickup.blockedByCapacity ? '#ff6c55' : color;
        ctx.fillStyle = '#0c0a08'; ctx.strokeStyle = pickup.blockedByCapacity ? '#ff6c55' : color; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.roundRect(-17,-17,34,34,8); ctx.fill(); ctx.stroke();

        if (V3?.artFor) {
          const key = `${item.id || item.name || 'item'}:${rarity}`;
          let img = this.lootArtCache.get(key);
          if (!img) {
            img = new Image();
            img.src = V3.artFor(item);
            this.lootArtCache.set(key,img);
          }
          if (img.complete && img.naturalWidth) ctx.drawImage(img,-14,-14,28,28);
        }

        const near = W.dist(pickup.x,pickup.y,this.player.x,this.player.y) < 135;
        if (near || pickup.blockedByCapacity) {
          ctx.shadowBlur = 5; ctx.shadowColor = '#000';
          ctx.textAlign = 'center'; ctx.font = '700 10px Inter, sans-serif'; ctx.fillStyle = pickup.blockedByCapacity ? '#ff9b86' : color;
          ctx.fillText(item.name || 'Item',0,-25);
          if (pickup.blockedByCapacity) {
            ctx.font = '700 8px Inter, sans-serif'; ctx.fillStyle = '#ffd1c8'; ctx.fillText('MOCHILA CHEIA',0,-36);
          }
        }
        ctx.restore();
      }
    };

    game.save = function () {
      originalSave();
      if (!this.player) return;
      try {
        const data = JSON.parse(localStorage.getItem(W.STORAGE_SAVE) || '{}');
        data.systemsVersion = '3.0-B';
        data.stamina = Number(this.stamina) || 0;
        data.staminaMax = this.staminaMax || STAMINA_MAX;
        data.backpackCapacity = this.backpackCapacity || BACKPACK_CAPACITY;
        data.groundLoot = (this.pickups || []).filter(x => x.type === 'loot' && x.persistent).slice(-60).map(x => ({
          type:'loot',x:x.x,y:x.y,value:x.value,life:90,persistent:true,blockedByCapacity:true
        }));
        localStorage.setItem(W.STORAGE_SAVE,JSON.stringify(data));
      } catch (_) {}
    };

    game.startNew = function () {
      originalStartNew();
      if (!this.player) return;
      this.backpackCapacity = BACKPACK_CAPACITY;
      this.staminaMax = STAMINA_MAX;
      this.stamina = STAMINA_MAX;
      this.staminaRecoveryDelay = 0;
      this.sprinting = false;
      this.updateStaminaUI();
      this.renderInventory?.();
      this.save();
    };

    game.continueGame = function () {
      let raw = null;
      try { raw = JSON.parse(localStorage.getItem(W.STORAGE_SAVE) || 'null'); } catch (_) {}
      originalContinue();
      if (!this.player) return;
      this.backpackCapacity = Number(raw?.backpackCapacity) || BACKPACK_CAPACITY;
      this.staminaMax = Number(raw?.staminaMax) || STAMINA_MAX;
      this.stamina = Number.isFinite(raw?.stamina) ? Math.max(0,Math.min(this.staminaMax,raw.stamina)) : this.staminaMax;
      this.staminaRecoveryDelay = 0;
      if (Array.isArray(raw?.groundLoot)) {
        const existing = new Set((this.pickups || []).map(x => `${x.x}:${x.y}:${x.value?.uid || x.value?.id || ''}`));
        raw.groundLoot.forEach(x => {
          const key = `${x.x}:${x.y}:${x.value?.uid || x.value?.id || ''}`;
          if (!existing.has(key)) this.pickups.push({...x,life:90,persistent:true,blockedByCapacity:true});
        });
      }
      this.updateStaminaUI();
      this.renderInventory?.();
    };

    game.updateStaminaUI();
    game.renderInventory?.();
  }

  window.addEventListener('DOMContentLoaded',install);
})();

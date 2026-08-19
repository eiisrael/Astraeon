(function () {
  'use strict';
  const W = window.AstraeonWorld;
  if (!W) throw new Error('AstraeonWorld não carregado.');

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));

  class AstraeonGame {
    constructor() {
      this.canvas = $('#world');
      this.ctx = this.canvas.getContext('2d');
      this.mapCanvas = $('#minimapCanvas');
      this.mctx = this.mapCanvas.getContext('2d');
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.running = false;
      this.paused = false;
      this.last = performance.now();
      this.keys = new Set();
      this.mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
      this.camera = { x: 0, y: 0, shake: 0 };
      this.effects = [];
      this.particles = [];
      this.mobs = [];
      this.pickups = [];
      this.images = new Map();
      this.cooldowns = [0, 0, 0, 0, 0];
      this.lastBiome = null;
      this.weatherClock = 0;
      this.worldClock = 0.24;
      this.saveClock = 0;
      this.quest = { kills: 0, goal: 12, biomes: new Set(), reward: false };
      this.selectedClass = 'Warrior';
      this.inventory = [];
      this.gold = 0;
      this.audio = null;
      this.ui = this.cacheUI();
      this.bindUI();
      this.bindInput();
      this.resize();
      this.renderClassCards();
      this.renderBiomePreview();
      this.preloadSprites();
      requestAnimationFrame((t) => this.frame(t));
    }

    cacheUI() {
      return {
        startScreen: $('#startScreen'), classScreen: $('#classScreen'), pauseScreen: $('#pauseScreen'),
        inventoryPanel: $('#inventoryPanel'), mapPanel: $('#mapPanel'), helpPanel: $('#helpPanel'),
        seed: $('#seedInput'), name: $('#charName'), toast: $('#toast'), biomeChip: $('#biomeChip'),
        biomeBanner: $('#biomeBanner'), hp: $('#hpFill'), mp: $('#mpFill'), xp: $('#xpFill'),
        hpText: $('#hpText'), mpText: $('#mpText'), level: $('#levelText'), char: $('#charText'),
        gold: $('#goldText'), kills: $('#killText'), questText: $('#questText'), questFill: $('#questFill'),
        invGrid: $('#inventoryGrid'), invMeta: $('#inventoryMeta'), mapLegend: $('#mapLegend'),
        hotbar: $('#hotbar'), clock: $('#clockText'), climate: $('#climateText')
      };
    }

    bindUI() {
      $('#newGameBtn').addEventListener('click', () => this.openClassSelect());
      $('#continueBtn').addEventListener('click', () => this.continueGame());
      $('#editorBtn').addEventListener('click', () => { location.href = 'game-editor.html'; });
      $('#backStartBtn').addEventListener('click', () => this.showOnly(this.ui.startScreen));
      $('#beginBtn').addEventListener('click', () => this.startNew());
      $('#resumeBtn').addEventListener('click', () => this.togglePause(false));
      $('#saveQuitBtn').addEventListener('click', () => { this.save(); this.running = false; this.showOnly(this.ui.startScreen); });
      $('#inventoryBtn').addEventListener('click', () => this.togglePanel(this.ui.inventoryPanel));
      $('#mapBtn').addEventListener('click', () => this.togglePanel(this.ui.mapPanel));
      $('#helpBtn').addEventListener('click', () => this.togglePanel(this.ui.helpPanel));
      $$('.panelClose').forEach(btn => btn.addEventListener('click', () => btn.closest('.overlay-panel').classList.add('hidden')));
      window.addEventListener('resize', () => this.resize());
    }

    bindInput() {
      window.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        this.keys.add(key);
        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(key)) e.preventDefault();
        if (!this.running) return;
        if (key === 'escape') this.togglePause();
        if (key === 'i') this.togglePanel(this.ui.inventoryPanel);
        if (key === 'm') this.togglePanel(this.ui.mapPanel);
        if (key === 'h') this.togglePanel(this.ui.helpPanel);
        if ('12345'.includes(key)) this.castSkill(Number(key) - 1);
        if (key === ' ') this.basicAttack();
      });
      window.addEventListener('keyup', e => this.keys.delete(e.key.toLowerCase()));
      this.canvas.addEventListener('mousemove', e => {
        const r = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - r.left;
        this.mouse.y = e.clientY - r.top;
      });
      this.canvas.addEventListener('mousedown', e => {
        if (e.button !== 0 || !this.running || this.paused) return;
        this.mouse.down = true;
        this.basicAttack();
      });
      window.addEventListener('mouseup', () => this.mouse.down = false);
    }

    resize() {
      const r = this.canvas.getBoundingClientRect();
      this.canvas.width = Math.max(1, Math.floor(r.width * this.dpr));
      this.canvas.height = Math.max(1, Math.floor(r.height * this.dpr));
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.viewW = r.width; this.viewH = r.height;
      this.mapCanvas.width = 196 * this.dpr;
      this.mapCanvas.height = 196 * this.dpr;
      this.mctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }

    showOnly(screen) {
      [this.ui.startScreen, this.ui.classScreen, this.ui.pauseScreen].forEach(s => s.classList.add('hidden'));
      if (screen) screen.classList.remove('hidden');
    }

    togglePanel(panel) {
      panel.classList.toggle('hidden');
      if (panel === this.ui.inventoryPanel && !panel.classList.contains('hidden')) this.renderInventory();
      if (panel === this.ui.mapPanel && !panel.classList.contains('hidden')) this.renderBigMap();
    }

    renderClassCards() {
      const wrap = $('#classGrid');
      wrap.innerHTML = '';
      Object.entries(W.CLASS_DATA).forEach(([id, c]) => {
        const card = document.createElement('button');
        card.className = 'class-card' + (id === this.selectedClass ? ' active' : '');
        card.dataset.class = id;
        card.innerHTML = `<img src="Assets/Classes/${c.sprite}" alt=""><span><strong>${c.name}</strong><small>${this.classTagline(id)}</small></span><em style="--class:${c.color}">ATQ ${c.power} · VEL ${c.speed}</em>`;
        card.addEventListener('click', () => {
          this.selectedClass = id;
          $$('.class-card').forEach(x => x.classList.toggle('active', x === card));
          $('#classDescription').textContent = this.classDescription(id);
        });
        wrap.appendChild(card);
      });
      $('#classDescription').textContent = this.classDescription(this.selectedClass);
    }

    classTagline(id) {
      return ({ Warrior: 'Linha de frente e controle', Mage: 'Explosão arcana à distância', Archer: 'Precisão, alcance e mobilidade', Assassin: 'Crítico, velocidade e execução', Paladine: 'Defesa, cura e luz' })[id];
    }

    classDescription(id) {
      return ({
        Warrior: 'Resistente e direto. Domina grupos próximos com ruptura e impacto.',
        Mage: 'Controla espaço com magia de longo alcance, nova e teleporte.',
        Archer: 'Mantém distância, marca alvos e castiga áreas com chuva de flechas.',
        Assassin: 'Especialista em dano crítico, reposicionamento e finalizações rápidas.',
        Paladine: 'Mistura proteção, cura e investidas; a opção mais segura para explorar.'
      })[id];
    }

    renderBiomePreview() {
      const wrap = $('#biomePreview');
      wrap.innerHTML = W.BIOME_ORDER.map(id => {
        const b = W.BIOMES[id];
        return `<div class="biome-preview" style="--b:${b.ground[1]};--a:${b.accent}"><b>${b.icon} ${b.name}</b><small>${b.climate}</small></div>`;
      }).join('');
    }

    preloadSprites() {
      const paths = [];
      Object.values(W.CLASS_DATA).forEach(x => paths.push(`Assets/Classes/${x.sprite}`));
      Object.values(W.MOB_DATA).forEach(x => paths.push(`Assets/Mob/${x.sprite}`));
      paths.forEach(src => {
        const img = new Image(); img.src = src;
        img.onload = () => this.images.set(src, img);
      });
    }

    openClassSelect() {
      this.showOnly(this.ui.classScreen);
      this.ui.seed.value = `ASTRA-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
    }

    startNew() {
      const classId = this.selectedClass;
      const c = W.CLASS_DATA[classId];
      const seed = (this.ui.seed.value || 'ASTRAEON-2').trim();
      this.world = W.generateWorld({ seed });
      const spawn = this.findSafeSpawn(Math.floor(this.world.width / 2), Math.floor(this.world.height / 2));
      this.player = {
        name: (this.ui.name.value || 'Viajante').trim().slice(0, 18), classId,
        x: spawn.x * W.TILE + W.TILE / 2, y: spawn.y * W.TILE + W.TILE / 2,
        hp: c.hp, maxHp: c.hp, mana: c.mana, maxMana: c.mana, level: 1, xp: 0, xpNext: 100,
        power: c.power, defense: c.defense, speed: c.speed, range: c.range, crit: c.crit,
        attackCd: 0, invuln: 0, facing: 1
      };
      this.gold = 16; this.inventory = this.starterInventory(classId);
      this.quest = { kills: 0, goal: 12, biomes: new Set(), reward: false };
      this.cooldowns.fill(0); this.effects.length = 0; this.pickups.length = 0; this.mobs.length = 0;
      this.spawnInitialMobs();
      this.running = true; this.paused = false; this.lastBiome = null;
      this.showOnly(null);
      this.ensureAudio();
      this.toast('ASTRAEON 2.0 · O mundo desperta');
      this.updateUI();
    }

    continueGame() {
      try {
        const save = JSON.parse(localStorage.getItem(W.STORAGE_SAVE) || 'null');
        if (!save || !save.player) { this.toast('Nenhum save 2.0 encontrado.'); return; }
        this.selectedClass = save.player.classId || 'Warrior';
        this.world = W.generateWorld({ seed: save.seed || 'ASTRAEON-2' });
        this.player = Object.assign({}, save.player);
        this.gold = save.gold || 0;
        this.inventory = Array.isArray(save.inventory) ? save.inventory : [];
        this.quest = { kills: save.quest?.kills || 0, goal: 12, biomes: new Set(save.quest?.biomes || []), reward: !!save.quest?.reward };
        this.mobs = [];
        this.spawnInitialMobs();
        this.running = true; this.paused = false; this.showOnly(null); this.ensureAudio();
        this.toast('Jornada restaurada.'); this.updateUI();
      } catch (_) { this.toast('Save inválido. Inicie uma nova jornada.'); }
    }

    save() {
      if (!this.running || !this.player || !this.world) return;
      const data = {
        version: W.VERSION, seed: this.world.seedText, player: this.player, gold: this.gold, inventory: this.inventory,
        quest: { kills: this.quest.kills, biomes: Array.from(this.quest.biomes), reward: this.quest.reward }
      };
      localStorage.setItem(W.STORAGE_SAVE, JSON.stringify(data));
    }

    starterInventory(classId) {
      const names = { Warrior: 'Espada de Astrium', Mage: 'Cetro de Lúmen', Archer: 'Arco de Éter', Assassin: 'Lâminas do Vazio', Paladine: 'Maça Solar' };
      return [
        { name: names[classId], rarity: 'rare', type: 'Arma', power: 4 },
        { name: 'Poção Rubra', rarity: 'common', type: 'Consumível', heal: 45, qty: 3 },
        { name: 'Fragmento Astral', rarity: 'uncommon', type: 'Material', qty: 2 }
      ];
    }

    findSafeSpawn(cx, cy) {
      for (let r = 0; r < 18; r++) {
        for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
          const t = this.world.get(cx + dx, cy + dy);
          if (t && !t.blocked && t.kind !== 'water') return t;
        }
      }
      return this.world.get(48, 48);
    }

    spawnInitialMobs() {
      const rng = W.mulberry32(this.world.seed + 12345);
      const desired = 56;
      let attempts = 0;
      while (this.mobs.length < desired && attempts++ < 1000) {
        const tx = 4 + Math.floor(rng() * (this.world.width - 8));
        const ty = 4 + Math.floor(rng() * (this.world.height - 8));
        const tile = this.world.get(tx, ty);
        if (!tile || tile.blocked || tile.kind === 'water') continue;
        if (W.dist(tx, ty, this.world.width / 2, this.world.height / 2) < 7) continue;
        const pool = W.BIOMES[tile.biome].mobs;
        const type = W.pick(rng, pool);
        this.addMob(type, tx * W.TILE + W.TILE / 2, ty * W.TILE + W.TILE / 2, tile.biome, rng);
      }
      this.world.spawns.forEach(s => {
        if (W.MOB_DATA[s.type] && this.world.get(s.x, s.y)) this.addMob(s.type, s.x * W.TILE + W.TILE / 2, s.y * W.TILE + W.TILE / 2, this.world.get(s.x, s.y).biome, rng);
      });
    }

    addMob(type, x, y, biome, rng = Math.random) {
      const d = W.MOB_DATA[type] || W.MOB_DATA.Slime;
      const scale = 1 + Math.max(0, this.player?.level - 1 || 0) * .08;
      this.mobs.push({
        id: `${type}-${Math.random().toString(36).slice(2)}`, type, biome, x, y, homeX: x, homeY: y,
        hp: Math.round(d.hp * scale), maxHp: Math.round(d.hp * scale), power: Math.round(d.power * scale),
        speed: d.speed, xp: Math.round(d.xp * scale), gold: d.gold, attackCd: rng() * .7, aggro: false,
        hit: 0, dead: false, wobble: rng() * Math.PI * 2
      });
    }

    frame(t) {
      const dt = Math.min(.034, Math.max(0, (t - this.last) / 1000));
      this.last = t;
      if (this.running && !this.paused) this.update(dt);
      this.draw();
      requestAnimationFrame((n) => this.frame(n));
    }

    update(dt) {
      const p = this.player;
      p.attackCd = Math.max(0, p.attackCd - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      for (let i = 0; i < this.cooldowns.length; i++) this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
      this.worldClock = (this.worldClock + dt / 170) % 1;
      this.weatherClock += dt; this.saveClock += dt;
      if (this.saveClock > 12) { this.saveClock = 0; this.save(); }

      let dx = 0, dy = 0;
      if (this.keys.has('w') || this.keys.has('arrowup')) dy--;
      if (this.keys.has('s') || this.keys.has('arrowdown')) dy++;
      if (this.keys.has('a') || this.keys.has('arrowleft')) dx--;
      if (this.keys.has('d') || this.keys.has('arrowright')) dx++;
      if (dx || dy) {
        const len = Math.hypot(dx, dy); dx /= len; dy /= len;
        p.facing = dx ? Math.sign(dx) : p.facing;
        this.moveEntity(p, dx * p.speed * dt, dy * p.speed * dt, 10);
      }
      p.mana = Math.min(p.maxMana, p.mana + dt * 4.4);

      this.camera.x += (p.x - this.viewW / 2 - this.camera.x) * Math.min(1, dt * 7);
      this.camera.y += (p.y - this.viewH / 2 - this.camera.y) * Math.min(1, dt * 7);
      this.camera.x = W.clamp(this.camera.x, 0, this.world.width * W.TILE - this.viewW);
      this.camera.y = W.clamp(this.camera.y, 0, this.world.height * W.TILE - this.viewH);
      this.mouse.worldX = this.mouse.x + this.camera.x;
      this.mouse.worldY = this.mouse.y + this.camera.y;

      this.updateBiome();
      this.updateMobs(dt);
      this.updatePickups(dt);
      this.updateEffects(dt);
      this.updateWeather(dt);
      this.updateUI();
    }

    moveEntity(e, dx, dy, radius = 9) {
      const tryX = e.x + dx;
      if (!this.isBlocked(tryX, e.y, radius)) e.x = tryX;
      const tryY = e.y + dy;
      if (!this.isBlocked(e.x, tryY, radius)) e.y = tryY;
    }

    isBlocked(x, y, r) {
      const maxX = this.world.width * W.TILE, maxY = this.world.height * W.TILE;
      if (x - r < 0 || y - r < 0 || x + r >= maxX || y + r >= maxY) return true;
      const pts = [[x-r,y-r],[x+r,y-r],[x-r,y+r],[x+r,y+r]];
      return pts.some(([px, py]) => {
        const t = this.world.tileAtPixel(px, py);
        return !t || t.blocked;
      });
    }

    updateBiome() {
      const tile = this.world.tileAtPixel(this.player.x, this.player.y);
      if (!tile) return;
      const b = W.BIOMES[tile.biome];
      if (tile.biome !== this.lastBiome) {
        this.lastBiome = tile.biome;
        this.ui.biomeBanner.innerHTML = `<strong>${b.icon} ${b.name}</strong><span>${b.climate} · ${b.feature}</span>`;
        this.ui.biomeBanner.classList.add('show');
        setTimeout(() => this.ui.biomeBanner.classList.remove('show'), 2600);
      }
      this.ui.biomeChip.textContent = `${b.icon} ${b.name}`;
      this.ui.biomeChip.style.setProperty('--accent', b.accent);
      this.ui.climate.textContent = b.climate;
    }

    updateMobs(dt) {
      const p = this.player;
      for (const m of this.mobs) {
        if (m.dead) continue;
        m.attackCd = Math.max(0, m.attackCd - dt); m.hit = Math.max(0, m.hit - dt); m.wobble += dt * 2.4;
        const d = W.dist(m.x, m.y, p.x, p.y);
        if (d < 300) m.aggro = true;
        if (d > 520) m.aggro = false;
        let tx = m.homeX, ty = m.homeY;
        if (m.aggro) { tx = p.x; ty = p.y; }
        else {
          tx += Math.cos(m.wobble * .63) * 48;
          ty += Math.sin(m.wobble * .47) * 48;
        }
        const dd = W.dist(m.x, m.y, tx, ty);
        if (dd > (m.aggro ? 34 : 10)) {
          const vx = (tx - m.x) / dd, vy = (ty - m.y) / dd;
          this.moveEntity(m, vx * m.speed * dt, vy * m.speed * dt, 9);
        }
        if (m.aggro && d < 34 && m.attackCd <= 0) {
          m.attackCd = 1.05 + Math.random() * .4;
          this.damagePlayer(Math.max(1, m.power - p.defense));
        }
      }
      const living = this.mobs.filter(m => !m.dead).length;
      if (living < 44) this.respawnAroundPlayer(4);
    }

    respawnAroundPlayer(count) {
      const rng = Math.random;
      for (let i = 0; i < count; i++) {
        for (let tries = 0; tries < 30; tries++) {
          const angle = rng() * Math.PI * 2, rad = 460 + rng() * 420;
          const x = W.clamp(this.player.x + Math.cos(angle) * rad, 36, this.world.width * W.TILE - 36);
          const y = W.clamp(this.player.y + Math.sin(angle) * rad, 36, this.world.height * W.TILE - 36);
          const tile = this.world.tileAtPixel(x, y);
          if (!tile || tile.blocked || tile.kind === 'water') continue;
          const type = W.pick(rng, W.BIOMES[tile.biome].mobs);
          this.addMob(type, x, y, tile.biome, rng); break;
        }
      }
    }

    damagePlayer(amount) {
      if (this.player.invuln > 0) return;
      this.player.hp -= amount; this.player.invuln = .22; this.camera.shake = 7;
      this.floatText(this.player.x, this.player.y - 20, `-${amount}`, '#ff7685'); this.beep(92, .04, .025);
      if (this.player.hp <= 0) this.playerDeath();
    }

    playerDeath() {
      this.player.hp = this.player.maxHp;
      this.player.mana = this.player.maxMana;
      const t = this.findSafeSpawn(Math.floor(this.world.width / 2), Math.floor(this.world.height / 2));
      this.player.x = t.x * W.TILE + W.TILE / 2; this.player.y = t.y * W.TILE + W.TILE / 2;
      this.gold = Math.max(0, this.gold - Math.ceil(this.gold * .08));
      this.toast('Você foi resgatado pelo Santuário Astral.');
    }

    basicAttack() {
      if (!this.running || this.paused || this.player.attackCd > 0) return;
      const p = this.player;
      let target = this.closestMobTo(this.mouse.worldX, this.mouse.worldY, 70);
      if (!target) target = this.closestMobTo(p.x, p.y, p.range);
      if (!target || W.dist(p.x, p.y, target.x, target.y) > p.range) {
        this.effects.push({ type: 'slash', x: this.mouse.worldX, y: this.mouse.worldY, life: .16, max: .16, color: '#b8d9ff' });
        p.attackCd = .22; return;
      }
      p.attackCd = .48;
      const crit = Math.random() < p.crit;
      const dmg = Math.round(p.power * (.82 + Math.random() * .36) * (crit ? 1.75 : 1));
      this.hitMob(target, dmg, crit);
      this.effects.push({ type: p.range > 100 ? 'projectile' : 'slash', x: p.x, y: p.y, tx: target.x, ty: target.y, life: .22, max: .22, color: W.CLASS_DATA[p.classId].color });
      this.beep(crit ? 540 : 340, .035, .02);
    }

    castSkill(index) {
      if (!this.running || this.paused || this.cooldowns[index] > 0) return;
      const p = this.player, costs = [10, 20, 18, 24, 42], cds = [2.2, 5, 7, 7.5, 13];
      if (p.mana < costs[index]) { this.toast('Mana insuficiente.'); return; }
      p.mana -= costs[index]; this.cooldowns[index] = cds[index];
      const c = W.CLASS_DATA[p.classId];
      if (index === 0) {
        const target = this.closestMobTo(this.mouse.worldX, this.mouse.worldY, 90) || this.closestMobTo(p.x, p.y, p.range * 1.2);
        if (target && W.dist(p.x, p.y, target.x, target.y) < p.range * 1.35) this.hitMob(target, Math.round(p.power * 1.55), Math.random() < p.crit + .1);
        this.effects.push({ type: 'burst', x: target?.x || p.x, y: target?.y || p.y, life: .36, max: .36, color: c.color, radius: 54 });
      } else if (index === 1) {
        this.areaDamage(p.x, p.y, p.classId === 'Archer' || p.classId === 'Mage' ? 170 : 110, Math.round(p.power * 1.25));
        this.effects.push({ type: 'ring', x: p.x, y: p.y, life: .52, max: .52, color: c.color, radius: 170 });
      } else if (index === 2) {
        p.invuln = 1.2; p.hp = Math.min(p.maxHp, p.hp + (p.classId === 'Paladine' ? 52 : 24));
        this.effects.push({ type: 'shield', x: p.x, y: p.y, life: 1.2, max: 1.2, color: c.color, radius: 34 });
      } else if (index === 3) {
        const vx = this.mouse.worldX - p.x, vy = this.mouse.worldY - p.y, d = Math.max(1, Math.hypot(vx, vy));
        const step = p.classId === 'Mage' || p.classId === 'Assassin' ? 145 : 95;
        this.moveEntity(p, vx / d * step, vy / d * step, 10);
        this.effects.push({ type: 'trail', x: p.x, y: p.y, life: .45, max: .45, color: c.color, radius: 70 });
      } else {
        this.areaDamage(this.mouse.worldX, this.mouse.worldY, 205, Math.round(p.power * 2.1));
        this.effects.push({ type: 'nova', x: this.mouse.worldX, y: this.mouse.worldY, life: .8, max: .8, color: c.color, radius: 210 });
        this.camera.shake = 9;
      }
      this.beep(650 + index * 95, .08, .035);
    }

    areaDamage(x, y, radius, amount) {
      for (const m of this.mobs) if (!m.dead && W.dist(x, y, m.x, m.y) <= radius) this.hitMob(m, amount, Math.random() < this.player.crit * .6);
    }

    closestMobTo(x, y, radius) {
      let best = null, bestD = radius;
      for (const m of this.mobs) {
        if (m.dead) continue;
        const d = W.dist(x, y, m.x, m.y);
        if (d < bestD) { bestD = d; best = m; }
      }
      return best;
    }

    hitMob(m, amount, crit) {
      if (!m || m.dead) return;
      m.hp -= amount; m.hit = .18; m.aggro = true;
      this.floatText(m.x, m.y - 24, `${crit ? '✦ ' : ''}${amount}`, crit ? '#ffd86b' : '#eef6ff');
      if (m.hp <= 0) this.killMob(m);
    }

    killMob(m) {
      m.dead = true;
      this.quest.kills++;
      this.quest.biomes.add(m.biome);
      this.gainXp(m.xp);
      const g = Math.floor(m.gold[0] + Math.random() * (m.gold[1] - m.gold[0] + 1));
      this.pickups.push({ type: 'gold', x: m.x, y: m.y, value: g, life: 18 });
      if (Math.random() < .18) this.pickups.push({ type: 'loot', x: m.x + 9, y: m.y - 5, value: this.rollLoot(m), life: 22 });
      this.effects.push({ type: 'burst', x: m.x, y: m.y, life: .5, max: .5, color: W.BIOMES[m.biome].accent, radius: 46 });
      if (!this.quest.reward && this.quest.kills >= this.quest.goal && this.quest.biomes.size >= 3) {
        this.quest.reward = true; this.gold += 120; this.inventory.push({ name: 'Núcleo de Astra', rarity: 'legendary', type: 'Artefato', power: 12 });
        this.toast('Missão concluída · +120 ouro · Núcleo de Astra');
      }
    }

    rollLoot(m) {
      const r = Math.random();
      const rarity = r > .965 ? 'legendary' : r > .82 ? 'rare' : r > .5 ? 'uncommon' : 'common';
      const names = ['Lâmina Rúnica', 'Manto do Caminhante', 'Anel de Éter', 'Botas de Caçador', 'Talismã Climático', 'Fragmento de Núcleo'];
      return { name: names[Math.floor(Math.random() * names.length)], rarity, type: 'Equipamento', power: 1 + Math.floor(Math.random() * (this.player.level + 4)) };
    }

    gainXp(amount) {
      const p = this.player; p.xp += amount;
      while (p.xp >= p.xpNext) {
        p.xp -= p.xpNext; p.level++; p.xpNext = Math.round(p.xpNext * 1.32);
        p.maxHp += 14; p.maxMana += 8; p.power += 2; p.defense += p.level % 2; p.hp = p.maxHp; p.mana = p.maxMana;
        this.toast(`Nível ${p.level}! Seu vínculo astral cresceu.`); this.beep(880, .16, .05);
      }
    }

    updatePickups(dt) {
      for (const p of this.pickups) {
        p.life -= dt;
        if (W.dist(p.x, p.y, this.player.x, this.player.y) < 80) {
          const d = Math.max(1, W.dist(p.x, p.y, this.player.x, this.player.y));
          p.x += (this.player.x - p.x) / d * 220 * dt;
          p.y += (this.player.y - p.y) / d * 220 * dt;
        }
        if (W.dist(p.x, p.y, this.player.x, this.player.y) < 20) {
          if (p.type === 'gold') this.gold += p.value; else this.inventory.push(p.value);
          p.life = -1; this.beep(p.type === 'gold' ? 720 : 840, .035, .018);
        }
      }
      this.pickups = this.pickups.filter(x => x.life > 0);
    }

    floatText(x, y, text, color) { this.effects.push({ type: 'text', x, y, text, color, life: .72, max: .72 }); }

    updateEffects(dt) {
      for (const e of this.effects) e.life -= dt;
      this.effects = this.effects.filter(e => e.life > 0);
      this.camera.shake = Math.max(0, this.camera.shake - dt * 32);
    }

    updateWeather(dt) {
      const biome = this.lastBiome || 'forest';
      const type = W.BIOMES[biome].weather;
      const rate = type === 'snow' || type === 'rain' ? 18 : 9;
      if (this.particles.length < 130 && Math.random() < dt * rate) {
        this.particles.push({
          type, x: Math.random() * this.viewW, y: -15, vx: (Math.random() - .5) * (type === 'dust' ? 52 : 25),
          vy: type === 'snow' ? 34 + Math.random() * 30 : type === 'rain' ? 240 + Math.random() * 110 : 48 + Math.random() * 50,
          life: 4 + Math.random() * 4, size: 1 + Math.random() * 3
        });
      }
      for (const p of this.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt; }
      this.particles = this.particles.filter(p => p.life > 0 && p.y < this.viewH + 40);
    }

    draw() {
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.viewW || 1, this.viewH || 1);
      if (!this.world || !this.player) {
        this.drawStartBackdrop(); return;
      }
      const shakeX = this.camera.shake ? (Math.random() - .5) * this.camera.shake : 0;
      const shakeY = this.camera.shake ? (Math.random() - .5) * this.camera.shake : 0;
      ctx.save(); ctx.translate(-this.camera.x + shakeX, -this.camera.y + shakeY);
      this.drawTerrain(ctx);
      this.drawPickups(ctx);
      this.drawMobs(ctx);
      this.drawPlayer(ctx);
      this.drawEffects(ctx);
      ctx.restore();
      this.drawAtmosphere(ctx);
      this.drawWeather(ctx);
      this.drawMinimap();
    }

    drawStartBackdrop() {
      const ctx = this.ctx, w = this.viewW || innerWidth, h = this.viewH || innerHeight;
      const g = ctx.createRadialGradient(w * .48, h * .38, 10, w * .5, h * .5, Math.max(w, h) * .72);
      g.addColorStop(0, '#182749'); g.addColorStop(.48, '#091326'); g.addColorStop(1, '#03060d');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      const t = performance.now() * .00008;
      for (let i = 0; i < 55; i++) {
        const x = ((i * 193.17 + t * 6000) % (w + 100)) - 50;
        const y = (i * i * 31.7) % h;
        ctx.globalAlpha = .18 + (i % 7) * .04; ctx.fillStyle = i % 5 ? '#7aa8ff' : '#f2cf77';
        ctx.beginPath(); ctx.arc(x, y, 1 + i % 3 * .4, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    drawTerrain(ctx) {
      const ts = W.TILE;
      const sx = Math.max(0, Math.floor(this.camera.x / ts) - 2), sy = Math.max(0, Math.floor(this.camera.y / ts) - 2);
      const ex = Math.min(this.world.width, Math.ceil((this.camera.x + this.viewW) / ts) + 2), ey = Math.min(this.world.height, Math.ceil((this.camera.y + this.viewH) / ts) + 2);
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        const tile = this.world.get(x, y), b = W.BIOMES[tile.biome], px = x * ts, py = y * ts;
        let base = b.ground[tile.variant];
        if (tile.kind === 'water') base = b.water;
        if (tile.kind === 'ice') base = '#91becd';
        if (tile.kind === 'sand') base = '#a87a42';
        if (tile.kind === 'rock') base = '#555157';
        if (tile.kind === 'road') base = tile.biome === 'frost' ? '#9eabae' : '#6c5c4a';
        ctx.fillStyle = base; ctx.fillRect(px, py, ts + 1, ts + 1);
        const n = W.valueNoise(x * 7.1, y * 9.3, this.world.seed + 88);
        ctx.globalAlpha = .12 + n * .08; ctx.fillStyle = n > .5 ? b.detail : b.edge;
        ctx.fillRect(px + 3 + n * 10, py + 4 + ((n * 31) % 18), 3 + n * 7, 2);
        ctx.globalAlpha = 1;
        if (tile.kind === 'water') this.drawWater(ctx, px, py, ts, b, n);
        if (tile.kind === 'road') this.drawRoad(ctx, px, py, ts, n);
        if (tile.object) this.drawFeature(ctx, tile, px, py, ts);
      }
    }

    drawWater(ctx, x, y, s, b, n) {
      ctx.strokeStyle = 'rgba(210,245,255,.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 5, y + 9 + n * 12); ctx.quadraticCurveTo(x + s*.5, y + 5, x + s - 5, y + 10 + n * 9); ctx.stroke();
    }

    drawRoad(ctx, x, y, s, n) {
      ctx.fillStyle = 'rgba(235,214,174,.13)';
      ctx.beginPath(); ctx.arc(x + 8 + n * 16, y + 12, 2.5, 0, Math.PI * 2); ctx.arc(x + 25, y + 26 - n * 10, 1.7, 0, Math.PI * 2); ctx.fill();
    }

    drawFeature(ctx, tile, x, y, s) {
      const b = W.BIOMES[tile.biome], cx = x + s / 2, by = y + s - 4;
      ctx.save();
      if (tile.object === 'tree' || tile.object === 'ancientTree' || tile.object === 'pine') {
        ctx.fillStyle = tile.object === 'pine' ? '#31565b' : '#193322'; ctx.fillRect(cx - 3, by - 17, 6, 16);
        ctx.fillStyle = tile.object === 'pine' ? '#618b82' : (tile.object === 'ancientTree' ? '#3d7750' : '#4e8959');
        ctx.beginPath(); ctx.arc(cx, by - 24, tile.object === 'ancientTree' ? 16 : 12, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = .45; ctx.fillStyle = b.accent; ctx.beginPath(); ctx.arc(cx - 5, by - 29, 4, 0, Math.PI * 2); ctx.fill();
      } else if (tile.object === 'cactus') {
        ctx.strokeStyle = '#4d7451'; ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(cx, by); ctx.lineTo(cx, by - 25); ctx.moveTo(cx, by - 13); ctx.lineTo(cx - 8, by - 18); ctx.moveTo(cx, by - 17); ctx.lineTo(cx + 8, by - 22); ctx.stroke();
      } else if (tile.object === 'reed') {
        ctx.strokeStyle = '#7f9d63'; ctx.lineWidth = 2; for (let i=-2;i<=2;i++) { ctx.beginPath(); ctx.moveTo(cx+i*3,by); ctx.lineTo(cx+i*4,by-14-Math.abs(i)*2); ctx.stroke(); }
      } else if (tile.object === 'crystal') {
        ctx.fillStyle = '#a9ebf6'; ctx.globalAlpha = .82; ctx.beginPath(); ctx.moveTo(cx,by-29); ctx.lineTo(cx+9,by-5); ctx.lineTo(cx,by); ctx.lineTo(cx-8,by-5); ctx.closePath(); ctx.fill();
      } else if (tile.object === 'ruin' || tile.object === 'obelisk') {
        ctx.fillStyle = tile.object === 'obelisk' ? '#665b58' : '#536351'; ctx.fillRect(cx - 8, by - 27, 16, 27); ctx.fillStyle = b.accent; ctx.globalAlpha=.42; ctx.fillRect(cx-2,by-20,4,8);
      } else {
        ctx.fillStyle = tile.object === 'sunrock' ? '#7c5736' : '#56504d';
        ctx.beginPath(); ctx.ellipse(cx, by - 6, 13, 9, -.2, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }

    drawMobs(ctx) {
      const list = this.mobs.filter(m => !m.dead && Math.abs(m.x - this.player.x) < this.viewW * .8 + 400 && Math.abs(m.y - this.player.y) < this.viewH * .8 + 400).sort((a,b) => a.y-b.y);
      for (const m of list) {
        const d = W.MOB_DATA[m.type], src = `Assets/Mob/${d.sprite}`, img = this.images.get(src);
        ctx.save(); ctx.translate(m.x, m.y); if (m.hit > 0) { ctx.globalAlpha = .68; ctx.scale(1.08, .92); }
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.beginPath(); ctx.ellipse(0, 11, 13, 5, 0, 0, Math.PI*2); ctx.fill();
        if (img) ctx.drawImage(img, -22, -35, 44, 44); else { ctx.fillStyle = d.color; ctx.beginPath(); ctx.arc(0,-7,15,0,Math.PI*2); ctx.fill(); }
        ctx.restore();
        if (m.aggro || m.hit > 0 || m.hp < m.maxHp) {
          ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(m.x - 18, m.y - 42, 36, 4);
          ctx.fillStyle = '#ef6674'; ctx.fillRect(m.x - 18, m.y - 42, 36 * Math.max(0, m.hp / m.maxHp), 4);
        }
      }
    }

    drawPlayer(ctx) {
      const p = this.player, c = W.CLASS_DATA[p.classId], src = `Assets/Classes/${c.sprite}`, img = this.images.get(src);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.beginPath(); ctx.ellipse(0, 12, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      if (p.invuln > 0) { ctx.strokeStyle = c.color; ctx.globalAlpha = .55 + Math.sin(performance.now()*.03)*.18; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,-8,24,0,Math.PI*2); ctx.stroke(); ctx.globalAlpha = 1; }
      if (img) { ctx.save(); if (p.facing < 0) ctx.scale(-1,1); ctx.drawImage(img, -24, -39, 48, 48); ctx.restore(); }
      else { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(0,-8,16,0,Math.PI*2); ctx.fill(); }
      ctx.restore();
      ctx.textAlign = 'center'; ctx.font = '600 11px Inter, sans-serif'; ctx.fillStyle = '#f3f7ff'; ctx.fillText(p.name, p.x, p.y - 46);
    }

    drawPickups(ctx) {
      for (const p of this.pickups) {
        const bob = Math.sin(performance.now()*.005 + p.x)*3;
        ctx.save(); ctx.translate(p.x, p.y + bob); ctx.shadowBlur = 12; ctx.shadowColor = p.type === 'gold' ? '#ffd66c' : '#8edcff';
        ctx.fillStyle = p.type === 'gold' ? '#ffd66c' : '#8edcff'; ctx.beginPath(); ctx.arc(0,0,p.type==='gold'?4:6,0,Math.PI*2); ctx.fill(); ctx.restore();
      }
    }

    drawEffects(ctx) {
      for (const e of this.effects) {
        const t = 1 - e.life / e.max;
        ctx.save(); ctx.globalAlpha = Math.max(0, 1 - t); ctx.strokeStyle = e.color || '#fff'; ctx.fillStyle = e.color || '#fff';
        if (e.type === 'text') {
          ctx.globalAlpha = e.life / e.max; ctx.font = '700 13px Inter,sans-serif'; ctx.textAlign = 'center'; ctx.fillText(e.text, e.x, e.y - t * 24);
        } else if (e.type === 'ring' || e.type === 'nova' || e.type === 'burst' || e.type === 'shield' || e.type === 'trail') {
          ctx.lineWidth = e.type === 'nova' ? 5 : 3; const r = (e.radius || 48) * (e.type === 'shield' ? 1 : (.18 + t * .82));
          ctx.beginPath(); ctx.arc(e.x, e.y, r, 0, Math.PI * 2); ctx.stroke();
          ctx.globalAlpha *= .12; ctx.beginPath(); ctx.arc(e.x,e.y,r*.72,0,Math.PI*2); ctx.fill();
        } else if (e.type === 'projectile') {
          const q = W.clamp(t * 1.6, 0, 1), x = W.lerp(e.x,e.tx,q), y = W.lerp(e.y,e.ty,q);
          ctx.shadowBlur=12;ctx.shadowColor=e.color;ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fill();
        } else {
          ctx.lineWidth=3;ctx.beginPath();ctx.arc(e.x,e.y,18+t*25,-.8,.8);ctx.stroke();
        }
        ctx.restore();
      }
    }

    drawAtmosphere(ctx) {
      const b = W.BIOMES[this.lastBiome || 'forest'];
      ctx.fillStyle = b.fog; ctx.fillRect(0,0,this.viewW,this.viewH);
      const hour = this.worldClock * 24;
      let darkness = 0;
      if (hour < 5) darkness = .38 - hour * .03;
      else if (hour > 19) darkness = Math.min(.34, (hour - 19) * .07);
      if (darkness > 0) {
        ctx.save(); ctx.fillStyle = `rgba(8,15,35,${darkness})`; ctx.fillRect(0,0,this.viewW,this.viewH);
        const px = this.player.x - this.camera.x, py = this.player.y - this.camera.y;
        const g = ctx.createRadialGradient(px,py,35,px,py,210); g.addColorStop(0,'rgba(255,220,145,.13)');g.addColorStop(1,'rgba(255,220,145,0)');ctx.fillStyle=g;ctx.fillRect(px-220,py-220,440,440);ctx.restore();
      }
      const vg = ctx.createRadialGradient(this.viewW*.5,this.viewH*.46,this.viewH*.18,this.viewW*.5,this.viewH*.46,Math.max(this.viewW,this.viewH)*.72);
      vg.addColorStop(.55,'rgba(0,0,0,0)');vg.addColorStop(1,'rgba(0,0,0,.38)');ctx.fillStyle=vg;ctx.fillRect(0,0,this.viewW,this.viewH);
    }

    drawWeather(ctx) {
      for (const p of this.particles) {
        ctx.save(); ctx.globalAlpha = Math.min(.55, p.life * .18);
        if (p.type === 'rain') { ctx.strokeStyle='#a8d9e7';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-3,p.y-11);ctx.stroke(); }
        else if (p.type === 'snow') { ctx.fillStyle='#f4fbff';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill(); }
        else if (p.type === 'leaves') { ctx.fillStyle='#91bb72';ctx.translate(p.x,p.y);ctx.rotate(p.y*.03);ctx.fillRect(-2,-1,5,2); }
        else if (p.type === 'dust') { ctx.fillStyle='#d7ac6c';ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill(); }
        else { ctx.fillStyle='#e28b5b';ctx.fillRect(p.x,p.y,2,2); }
        ctx.restore();
      }
    }

    drawMinimap() {
      if (!this.world || !this.player) return;
      const ctx = this.mctx, size = 196, sx = size / this.world.width, sy = size / this.world.height;
      ctx.clearRect(0,0,size,size);
      const step = 2;
      for (let y=0;y<this.world.height;y+=step) for(let x=0;x<this.world.width;x+=step){
        const t=this.world.get(x,y),b=W.BIOMES[t.biome];ctx.fillStyle=t.kind==='water'?b.water:b.ground[1];ctx.fillRect(x*sx,y*sy,step*sx+1,step*sy+1);
      }
      ctx.fillStyle='#ffd86b';ctx.beginPath();ctx.arc(this.player.x/(W.TILE*this.world.width)*size,this.player.y/(W.TILE*this.world.height)*size,3.5,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1;ctx.strokeRect(this.camera.x/(W.TILE*this.world.width)*size,this.camera.y/(W.TILE*this.world.height)*size,this.viewW/(W.TILE*this.world.width)*size,this.viewH/(W.TILE*this.world.height)*size);
    }

    renderBigMap() {
      const c = $('#bigMapCanvas'), ctx = c.getContext('2d'), size = 620; c.width=size;c.height=size;
      const sx=size/this.world.width,sy=size/this.world.height;
      for(let y=0;y<this.world.height;y++)for(let x=0;x<this.world.width;x++){const t=this.world.get(x,y),b=W.BIOMES[t.biome];ctx.fillStyle=t.kind==='water'?b.water:b.ground[t.variant];ctx.fillRect(x*sx,y*sy,sx+1,sy+1);}
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(this.player.x/(W.TILE*this.world.width)*size,this.player.y/(W.TILE*this.world.height)*size,5,0,Math.PI*2);ctx.fill();
      this.ui.mapLegend.innerHTML = W.BIOME_ORDER.map(id=>{const b=W.BIOMES[id];return `<span><i style="background:${b.ground[1]}"></i>${b.name}</span>`}).join('');
    }

    renderInventory() {
      this.ui.invMeta.textContent = `${this.inventory.length} itens · ${this.gold} ouro`;
      this.ui.invGrid.innerHTML = '';
      const total = Math.max(24, Math.ceil((this.inventory.length + 1) / 6) * 6);
      for (let i=0;i<total;i++) {
        const item=this.inventory[i],slot=document.createElement('button');slot.className='inventory-slot';
        if(item){slot.dataset.rarity=item.rarity||'common';slot.innerHTML=`<strong>${this.itemIcon(item)}</strong><span>${item.name}</span>${item.qty?`<em>${item.qty}</em>`:''}`;slot.title=`${item.type||'Item'}${item.power?` · +${item.power} poder`:''}`;if(item.heal)slot.addEventListener('click',()=>this.usePotion(i));}
        else slot.classList.add('empty');
        this.ui.invGrid.appendChild(slot);
      }
    }

    itemIcon(item){if(item.heal)return'♥';if(item.type==='Material')return'◆';if(item.rarity==='legendary')return'✦';if(item.type==='Arma')return'⚔';return'◇';}
    usePotion(i){const item=this.inventory[i];if(!item||!item.heal)return;this.player.hp=Math.min(this.player.maxHp,this.player.hp+item.heal);item.qty=(item.qty||1)-1;if(item.qty<=0)this.inventory.splice(i,1);this.renderInventory();this.toast('Poção utilizada.');}

    updateUI() {
      const p=this.player;if(!p)return;
      this.ui.hp.style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;this.ui.mp.style.width=`${Math.max(0,p.mana/p.maxMana*100)}%`;this.ui.xp.style.width=`${p.xp/p.xpNext*100}%`;
      this.ui.hpText.textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;this.ui.mpText.textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;this.ui.level.textContent=`Nv. ${p.level}`;this.ui.char.textContent=`${p.name} · ${W.CLASS_DATA[p.classId].name}`;
      this.ui.gold.textContent=this.gold;this.ui.kills.textContent=this.quest.kills;
      const done=this.quest.kills>=this.quest.goal&&this.quest.biomes.size>=3;
      this.ui.questText.textContent=done?'Convergência estabilizada':`Elimine ${this.quest.goal} criaturas e explore 3 biomas · ${this.quest.kills}/${this.quest.goal} · ${this.quest.biomes.size}/3`;
      this.ui.questFill.style.width=`${Math.min(100,((this.quest.kills/this.quest.goal)*.7+(this.quest.biomes.size/3)*.3)*100)}%`;
      const hour=Math.floor(this.worldClock*24),min=Math.floor((this.worldClock*24-hour)*60);this.ui.clock.textContent=`${String(hour).padStart(2,'0')}:${String(min).padStart(2,'0')}`;
      $$('#hotbar .skill').forEach((el,i)=>{const cd=this.cooldowns[i];el.classList.toggle('cooling',cd>0);el.querySelector('.cd').textContent=cd>0?cd.toFixed(cd>1?0:1):'';});
    }

    togglePause(force) {
      if (!this.running) return;
      this.paused = typeof force === 'boolean' ? force : !this.paused;
      this.ui.pauseScreen.classList.toggle('hidden', !this.paused);
    }

    toast(text) {
      this.ui.toast.textContent=text;this.ui.toast.classList.add('show');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>this.ui.toast.classList.remove('show'),2600);
    }

    ensureAudio(){try{if(!this.audio)this.audio=new(window.AudioContext||window.webkitAudioContext)();if(this.audio.state==='suspended')this.audio.resume();}catch(_){}}
    beep(freq,duration=.04,gain=.02){if(!this.audio)return;try{const o=this.audio.createOscillator(),g=this.audio.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(gain,this.audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,this.audio.currentTime+duration);o.connect(g).connect(this.audio.destination);o.start();o.stop(this.audio.currentTime+duration);}catch(_){}}
  }

  window.addEventListener('DOMContentLoaded', () => { window.astraeon = new AstraeonGame(); });
})();

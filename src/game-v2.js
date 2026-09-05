(function () {
  'use strict';
  const W = window.AstraeonWorld;
  if (!W) throw new Error('AstraeonWorld não carregado.');

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const TERRAIN_CHUNK_TILES = 12;
  const TERRAIN_CHUNK_OVERLAP = 1;
  const WATER_VISUALS = Object.freeze({
    baseTint: '#3f8992',
    deepTint: '#2e717e',
    shallowTint: '#72b5b9',
    surfaceTint: '#8ac9cd',
    highlightTint: '#d9f4f2',
    rippleTint: '#bde8e8',
    edgeTint: 'rgba(22,66,78,.26)',
    baseSpeed: .00022,
    highlightSpeed: .00038,
    rippleSpeed: .00029,
    noiseScale: .047,
    distortion: 1.6,
    surfaceOpacity: .13,
    highlightOpacity: .24,
    rippleOpacity: .12,
    toneScale: .008,
    textureNoise: .12,
    edgeBlend: .8,
    edgeInset: .055,
    edgeRadius: .16,
    isolatedRadius: .35,
    desktopQuality: 1,
    mobileQuality: .58,
    reducedMotionScale: .32
  });
  const MAP_STYLE = Object.freeze({
    forest: { light:'rgba(155,205,126,.12)', shade:'rgba(4,20,13,.18)', texture:'#86b875', trunk:'#4b3322', trunkLight:'#8a6140', crown:'#376e45', crownLight:'#70a964' },
    steppe: { light:'rgba(255,211,124,.13)', shade:'rgba(64,35,16,.17)', texture:'#d3a35c', trunk:'#775033', trunkLight:'#b38250', crown:'#62824b', crownLight:'#9eb66a' },
    frost: { light:'rgba(244,253,255,.25)', shade:'rgba(45,77,94,.14)', texture:'#f1fbff', trunk:'#43545a', trunkLight:'#879ba0', crown:'#497776', crownLight:'#91b7ac' },
    swamp: { light:'rgba(151,178,112,.10)', shade:'rgba(5,19,15,.24)', texture:'#799362', trunk:'#40382a', trunkLight:'#74664a', crown:'#3c6140', crownLight:'#6f8d59' },
    highland: { light:'rgba(206,191,173,.12)', shade:'rgba(24,20,22,.22)', texture:'#a18e7b', trunk:'#51423a', trunkLight:'#8a6d5c', crown:'#555f4d', crownLight:'#818a67' }
  });

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
      this.zoom = 1;
      this.zoomTarget = 1;
      this.zoomMin = .72;
      this.zoomMax = 1.32;
      this.zoomPointers = new Map();
      this.pinchZoom = null;
      this.effects = [];
      this.particles = [];
      this.mobs = [];
      this.pickups = [];
      this.images = new Map();
      this.imageLoads = new Map();
      this.imageRetryAt = new Map();
      this.terrainVisualCache = { world: null, chunks: new Map() };
      this.waterTileVisualCache = { world: null, tiles: new Map() };
      const mobileWater = typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 760px), (pointer: coarse)').matches;
      const reducedWaterMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      this.waterVisualQuality = mobileWater ? WATER_VISUALS.mobileQuality : WATER_VISUALS.desktopQuality;
      this.waterMotionScale = reducedWaterMotion ? WATER_VISUALS.reducedMotionScale : 1;
      this.classSpritePaths = new Map(Object.entries(W.CLASS_DATA).map(([id, data]) => [id, `Assets/Classes/${data.sprite}`]));
      this.mobSpritePaths = new Map(Object.entries(W.MOB_DATA).map(([id, data]) => [id, `Assets/Mob/${data.sprite}`]));
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
        biomeBanner: $('#biomeBanner'), hp: $('#hpFill'), mp: $('#mpFill'), xp: $('#xpFill'), xpText: $('#xpText'), portrait: $('#playerHudPortrait'),
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
        if (window.AstraeonInputGuardV1?.blocksPanelHotkeys(e)) return;
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
      this.canvas.addEventListener('wheel', e => {
        if (!this.running || this.paused) return;
        e.preventDefault();
        const factor = Math.exp(-W.clamp(e.deltaY, -120, 120) * .00135);
        this.setZoomTarget(this.zoomTarget * factor);
      }, { passive: false });
      this.canvas.addEventListener('pointerdown', e => {
        if (e.pointerType === 'mouse' || !this.running || this.paused) return;
        this.zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.zoomPointers.size === 2) {
          const points = Array.from(this.zoomPointers.values());
          this.pinchZoom = { distance: Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y)), zoom: this.zoomTarget };
        }
      }, { passive: true });
      this.canvas.addEventListener('pointermove', e => {
        if (!this.zoomPointers.has(e.pointerId)) return;
        this.zoomPointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (this.zoomPointers.size < 2 || !this.pinchZoom) return;
        const points = Array.from(this.zoomPointers.values());
        const distance = Math.max(1, Math.hypot(points[1].x - points[0].x, points[1].y - points[0].y));
        this.setZoomTarget(this.pinchZoom.zoom * distance / this.pinchZoom.distance);
        e.preventDefault();
      }, { passive: false });
      const finishZoomPointer = e => {
        this.zoomPointers.delete(e.pointerId);
        if (this.zoomPointers.size < 2) this.pinchZoom = null;
      };
      this.canvas.addEventListener('pointerup', finishZoomPointer, { passive: true });
      this.canvas.addEventListener('pointercancel', finishZoomPointer, { passive: true });
      window.addEventListener('mouseup', () => this.mouse.down = false);
    }

    setZoomTarget(value) {
      this.zoomTarget = W.clamp(Number(value) || 1, this.zoomMin, this.zoomMax);
    }

    visibleWorldWidth() { return (this.viewW || innerWidth) / Math.max(.01, this.zoom || 1); }
    visibleWorldHeight() { return (this.viewH || innerHeight) / Math.max(.01, this.zoom || 1); }

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
      [...this.classSpritePaths.values(), ...this.mobSpritePaths.values()].forEach(src => this.loadSprite(src));
    }

    loadSprite(src) {
      if (!src || this.images.has(src) || this.imageLoads.has(src)) return this.images.get(src) || null;
      if ((this.imageRetryAt.get(src) || 0) > performance.now()) return null;
      const img = new Image();
      this.imageLoads.set(src, img);
      img.onload = () => {
        this.imageLoads.delete(src);
        this.imageRetryAt.delete(src);
        if (img.naturalWidth > 0 && img.naturalHeight > 0) this.images.set(src, img);
      };
      img.onerror = () => {
        this.imageLoads.delete(src);
        this.imageRetryAt.set(src, performance.now() + 1500);
      };
      img.src = src;
      return null;
    }

    spriteImage(src) {
      return this.images.get(src) || this.loadSprite(src);
    }

    openClassSelect() {
      this.showOnly(this.ui.classScreen);
      this.ui.seed.value = `ASTRAEON-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
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
        const terrainSpeed=p.speed*this.terrainSpeedMultiplier(p);
        this.moveEntity(p, dx * terrainSpeed * dt, dy * terrainSpeed * dt, 10);
      }
      p.mana = Math.min(p.maxMana, p.mana + dt * 4.4);

      const previousZoom = this.zoom;
      const playerScreenX = (p.x - this.camera.x) * previousZoom;
      const playerScreenY = (p.y - this.camera.y) * previousZoom;
      this.zoom += (this.zoomTarget - this.zoom) * (1 - Math.exp(-dt * 6));
      if (Math.abs(this.zoomTarget - this.zoom) < .0005) this.zoom = this.zoomTarget;
      const visibleW = this.visibleWorldWidth(), visibleH = this.visibleWorldHeight();
      const zoomChanged = Math.abs(this.zoom - previousZoom) > .00001;
      if (zoomChanged) {
        this.camera.x = p.x - playerScreenX / this.zoom;
        this.camera.y = p.y - playerScreenY / this.zoom;
      } else {
        this.camera.x += (p.x - visibleW / 2 - this.camera.x) * Math.min(1, dt * 7);
        this.camera.y += (p.y - visibleH / 2 - this.camera.y) * Math.min(1, dt * 7);
      }
      this.camera.x = W.clamp(this.camera.x, 0, Math.max(0, this.world.width * W.TILE - visibleW));
      this.camera.y = W.clamp(this.camera.y, 0, Math.max(0, this.world.height * W.TILE - visibleH));
      this.mouse.worldX = this.mouse.x / this.zoom + this.camera.x;
      this.mouse.worldY = this.mouse.y / this.zoom + this.camera.y;

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

    terrainSpeedMultiplier(entity) {
      const tile=this.world?.tileAtPixel?.(entity?.x,entity?.y);
      return tile?.kind === 'water' ? .55 : 1;
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
          this.damagePlayer(Math.max(1, m.power - p.defense), m);
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

    damagePlayer(amount, source = null) {
      if (this.player.invuln > 0) return;
      this.player.hp -= amount; this.player.invuln = .22; this.camera.shake = 7;
      if (this.settingsV3?.damage !== false) this.incomingDamage(source, amount);
      this.beep(92, .04, .025);
      if (this.player.hp <= 0) this.playerDeath();
    }

    incomingDamagePosition(effect) {
      const nx = Number.isFinite(Number(effect?.nx)) ? Number(effect.nx) : 0;
      const ny = Number.isFinite(Number(effect?.ny)) ? Number(effect.ny) : -1;
      const length = Math.max(1, Math.hypot(nx, ny));
      const radius = 31;
      return {
        x: this.player.x + nx / length * radius,
        y: this.player.y - 8 + ny / length * radius
      };
    }

    incomingDamage(source, amount) {
      const target = this.player;
      const sx = Number(source?.x), sy = Number(source?.y);
      if (!Number.isFinite(sx) || !Number.isFinite(sy)) return;
      const dx = sx - target.x, dy = sy - target.y, distance = Math.max(1, Math.hypot(dx, dy));
      const nx = dx / distance, ny = dy / distance;
      this.effects.push({
        type: 'incoming-damage', sourceId: source?.id || null,
        nx, ny, angle: Math.atan2(ny, nx), text: `-${amount}`, color: '#ff4358', life: .58, max: .58
      });
    }

    playerDeath() {
      this.player.hp = this.player.maxHp;
      this.player.mana = this.player.maxMana;
      const t = this.findSafeSpawn(Math.floor(this.world.width / 2), Math.floor(this.world.height / 2));
      this.player.x = t.x * W.TILE + W.TILE / 2; this.player.y = t.y * W.TILE + W.TILE / 2;
      this.gold = Math.max(0, this.gold - Math.ceil(this.gold * .08));
      this.toast('Você foi resgatado pelo Santuário Astral.');
    }

    basicAttackEffect(aim) {
      const p = this.player, color = W.CLASS_DATA[p.classId]?.color || '#ffffff';
      return window.AstraeonCombatEffectsV1?.create?.(p, aim, color) || {
        type: p.range > 100 ? 'projectile' : 'slash', x: p.x, y: p.y,
        tx: aim.x, ty: aim.y, life: .22, max: .22, color
      };
    }

    basicAttack() {
      if (!this.running || this.paused || this.player.attackCd > 0) return;
      window.AstraeonProductionV6?.activity?.();
      const p = this.player;
      let target = this.closestMobTo(this.mouse.worldX, this.mouse.worldY, 70);
      if (!target) target = this.closestMobTo(p.x, p.y, p.range);
      if (!target || W.dist(p.x, p.y, target.x, target.y) > p.range) {
        this.effects.push(this.basicAttackEffect({ x: this.mouse.worldX, y: this.mouse.worldY }));
        p.attackCd = .22; return;
      }
      p.attackCd = .48;
      const crit = Math.random() < p.crit;
      const dmg = Math.round(p.power * (.82 + Math.random() * .36) * (crit ? 1.75 : 1));
      this.hitMob(target, dmg, crit);
      this.effects.push(this.basicAttackEffect(target));
      this.beep(crit ? 540 : 340, .035, .02);
    }

    castSkill(index) {
      if (!this.running || this.paused || this.cooldowns[index] > 0) return;
      const p = this.player, costs = [10, 20, 18, 24, 42], cds = [2.2, 5, 7, 7.5, 13];
      if (p.mana < costs[index]) { this.toast('Mana insuficiente.'); return; }
      window.AstraeonProductionV6?.activity?.();
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
        this.quest.reward = true; this.gold += 120; this.inventory.push({ name: 'Núcleo de Astraeon', rarity: 'legendary', type: 'Artefato', power: 12 });
        this.toast('Missão concluída · +120 ouro · Núcleo de Astraeon');
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
      ctx.save();ctx.translate(shakeX,shakeY);ctx.scale(this.zoom || 1,this.zoom || 1);ctx.translate(-this.camera.x,-this.camera.y);
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

    terrainBase(tile, biome) {
      if (tile.kind === 'water') return WATER_VISUALS.baseTint;
      if (tile.kind === 'ice') return '#91becd';
      if (tile.kind === 'sand') return '#a87a42';
      if (tile.kind === 'rock') return '#555157';
      if (tile.kind === 'road') return tile.biome === 'frost' ? '#9eabae' : '#6c5c4a';
      return biome.ground[tile.variant];
    }

    terrainNoise(tile, salt = 0) {
      return W.valueNoise(tile.x * 7.13 + salt * .017, tile.y * 9.31 - salt * .013, this.world.seed + 88 + salt);
    }

    waterTileVisual(tile) {
      if (this.waterTileVisualCache.world !== this.world) this.waterTileVisualCache = { world: this.world, tiles: new Map() };
      const key = tile.y * this.world.width + tile.x;
      if (this.waterTileVisualCache.tiles.has(key)) return this.waterTileVisualCache.tiles.get(key);
      const a = this.terrainNoise(tile, 133), b = this.terrainNoise(tile, 257), c = this.terrainNoise(tile, 389), d = this.terrainNoise(tile, 521);
      const visual = {
        phaseA: (a + tile.x * WATER_VISUALS.noiseScale) * Math.PI * 2,
        phaseB: (b + tile.y * WATER_VISUALS.noiseScale) * Math.PI * 2,
        phaseC: (c + (tile.x - tile.y) * WATER_VISUALS.noiseScale * .5) * Math.PI * 2,
        anchorX: .32 + b * .36,
        anchorY: .32 + c * .36,
        angle: (d - .5) * Math.PI * 1.55,
        depthGate: a,
        detailGate: b,
        rippleGate: d,
        curve: (c - .5) * 4,
        tone: this.waterToneTexture(tile)
      };
      this.waterTileVisualCache.tiles.set(key, visual);
      return visual;
    }

    waterToneTexture(tile) {
      // World-space samples and a one-pixel gutter keep adjacent tiles seamless.
      // This runs only when the terrain cache is built, never in the animation loop.
      const step=3, side=W.TILE/step+2, canvas=document.createElement('canvas');
      canvas.width=side;canvas.height=side;
      const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(side,side);
      const deep=parseInt(WATER_VISUALS.deepTint.slice(1),16),shallow=parseInt(WATER_VISUALS.shallowTint.slice(1),16);
      for(let py=0;py<side;py++)for(let px=0;px<side;px++){
        const wx=tile.x*W.TILE+(px-.5)*step,wy=tile.y*W.TILE+(py-.5)*step;
        const broad=W.fbm(wx*WATER_VISUALS.toneScale,wy*WATER_VISUALS.toneScale*.8,this.world.seed+6209);
        const fine=W.fbm(wx*.075,wy*.11,this.world.seed+7919);
        const tone=W.clamp(.12+broad*.78+(fine-.5)*WATER_VISUALS.textureNoise,0,1),offset=(py*side+px)*4;
        pixels.data[offset]=W.lerp(deep>>16,shallow>>16,tone);
        pixels.data[offset+1]=W.lerp((deep>>8)&255,(shallow>>8)&255,tone);
        pixels.data[offset+2]=W.lerp(deep&255,shallow&255,tone);
        pixels.data[offset+3]=255;
      }
      ctx.putImageData(pixels,0,0);
      return canvas;
    }

    drawWaterTileBase(ctx, tile, biome, x, y, size) {
      const north=this.world.get(tile.x,tile.y-1),east=this.world.get(tile.x+1,tile.y),south=this.world.get(tile.x,tile.y+1),west=this.world.get(tile.x-1,tile.y);
      const edgeN=!north||north.kind!=='water',edgeE=!east||east.kind!=='water',edgeS=!south||south.kind!=='water',edgeW=!west||west.kind!=='water';
      const inset=size*WATER_VISUALS.edgeInset;
      const radius=size*(edgeN&&edgeE&&edgeS&&edgeW?WATER_VISUALS.isolatedRadius:WATER_VISUALS.edgeRadius);
      const left=x+(edgeW?inset:-.5),top=y+(edgeN?inset:-.5),right=x+size-(edgeE?inset:-.5),bottom=y+size-(edgeS?inset:-.5);
      const topLeft=edgeN&&edgeW?radius:0,topRight=edgeN&&edgeE?radius:0,bottomRight=edgeS&&edgeE?radius:0,bottomLeft=edgeS&&edgeW?radius:0;
      ctx.fillStyle=biome.ground[tile.variant];ctx.fillRect(x,y,size+1,size+1);
      ctx.fillStyle=WATER_VISUALS.baseTint;ctx.beginPath();ctx.moveTo(left+topLeft,top);ctx.lineTo(right-topRight,top);
      if(topRight)ctx.quadraticCurveTo(right,top,right,top+topRight);else ctx.lineTo(right,top);
      ctx.lineTo(right,bottom-bottomRight);if(bottomRight)ctx.quadraticCurveTo(right,bottom,right-bottomRight,bottom);else ctx.lineTo(right,bottom);
      ctx.lineTo(left+bottomLeft,bottom);if(bottomLeft)ctx.quadraticCurveTo(left,bottom,left,bottom-bottomLeft);else ctx.lineTo(left,bottom);
      ctx.lineTo(left,top+topLeft);if(topLeft)ctx.quadraticCurveTo(left,top,left+topLeft,top);else ctx.lineTo(left,top);ctx.closePath();
      ctx.save();ctx.clip();
      const tone=this.waterTileVisual(tile).tone,gutter=1-.5/3,span=size/3+1/3;
      ctx.imageSmoothingEnabled=true;
      ctx.drawImage(tone,gutter,gutter,span,span,x-.5,y-.5,size+1,size+1);
      this.drawShoreline(ctx,tile,x,y,size);
      ctx.restore();
    }

    drawTerrainRelief(ctx, x, y, size, eastSlope, southSlope) {
      const band = Math.max(4, size * .14);
      if (Math.abs(eastSlope) > .035) {
        const edge = ctx.createLinearGradient(x + size - band, y, x + size, y);
        edge.addColorStop(0, 'rgba(0,0,0,0)');
        edge.addColorStop(1, eastSlope > 0 ? 'rgba(5,8,8,.10)' : 'rgba(255,244,210,.045)');
        ctx.fillStyle = edge;ctx.fillRect(x + size - band, y, band, size);
      }
      if (Math.abs(southSlope) > .035) {
        const edge = ctx.createLinearGradient(x, y + size - band, x, y + size);
        edge.addColorStop(0, 'rgba(0,0,0,0)');
        edge.addColorStop(1, southSlope > 0 ? 'rgba(4,7,8,.11)' : 'rgba(255,244,210,.04)');
        ctx.fillStyle = edge;ctx.fillRect(x, y + size - band, size, band);
      }
    }

    drawTerrainTexture(ctx, tile, biome, x, y, size) {
      const style = MAP_STYLE[tile.biome] || MAP_STYLE.forest;
      const n = this.terrainNoise(tile, 17), n2 = this.terrainNoise(tile, 91);
      const water = tile.kind === 'water';
      ctx.save();
      if (water) {
        this.drawWaterTileBase(ctx, tile, biome, x, y, size);
      } else {
        ctx.fillStyle = this.terrainBase(tile, biome);
        ctx.fillRect(x, y, size + 1, size + 1);
        const light = ctx.createLinearGradient(x, y, x + size, y + size);
        light.addColorStop(0, style.light); light.addColorStop(.48, 'rgba(255,255,255,0)'); light.addColorStop(1, style.shade);
        ctx.globalAlpha = .66;ctx.fillStyle = light;ctx.fillRect(x, y, size + 1, size + 1);ctx.globalAlpha = 1;

        const relief = (Number(tile.elevation) || .5) - .5;
        ctx.globalAlpha = Math.min(.13, Math.abs(relief) * .27);
        ctx.fillStyle = relief > 0 ? '#fff3d2' : '#02080a';
        ctx.fillRect(x, y, size + 1, size + 1);
        ctx.globalAlpha = 1;

        const east = this.world.get(tile.x + 1, tile.y), south = this.world.get(tile.x, tile.y + 1);
        const eastSlope = east ? (Number(tile.elevation) || 0) - (Number(east.elevation) || 0) : 0;
        const southSlope = south ? (Number(tile.elevation) || 0) - (Number(south.elevation) || 0) : 0;
        this.drawTerrainRelief(ctx, x, y, size, eastSlope, southSlope);
      }

      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (!water) {
        if (tile.kind === 'ice') {
          ctx.strokeStyle = 'rgba(231,251,255,.25)'; ctx.lineWidth = .7; ctx.beginPath();
          ctx.moveTo(x + 4 + n * 7, y + 5); ctx.lineTo(x + 15, y + 15 + n2 * 5); ctx.lineTo(x + 11, y + 25); ctx.moveTo(x + 15, y + 15 + n2 * 5); ctx.lineTo(x + 28, y + 11); ctx.stroke();
        } else if (tile.kind === 'road') {
          this.drawRoad(ctx, x, y, size, n);
        } else if (tile.kind === 'rock') {
          ctx.strokeStyle = 'rgba(28,25,27,.28)'; ctx.lineWidth = 1; ctx.beginPath();ctx.moveTo(x + 3, y + 27 - n * 9);ctx.lineTo(x + 13, y + 18);ctx.lineTo(x + 22, y + 22 + n2 * 4);ctx.lineTo(x + 34, y + 10);ctx.stroke();
        } else if (tile.biome === 'forest' || tile.biome === 'swamp') {
          ctx.strokeStyle = style.texture; ctx.globalAlpha = .32; ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) { const gx=x+5+((n*43+i*11)%27), gy=y+12+((n2*37+i*7)%20);ctx.beginPath();ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx-1,gy-4-n2*3,gx-3+n*5,gy-7-n*3);ctx.moveTo(gx,gy);ctx.quadraticCurveTo(gx+1,gy-4,gx+4-n2*3,gy-6);ctx.stroke(); }
        } else if (tile.biome === 'steppe') {
          ctx.strokeStyle = style.texture; ctx.globalAlpha = .28; ctx.lineWidth = .8;
          for (let i=0;i<2;i++){const gx=x+7+((n*37+i*17)%24),gy=y+18+((n2*29+i*9)%15);ctx.beginPath();ctx.moveTo(gx,gy);ctx.lineTo(gx-2,gy-5-n*3);ctx.moveTo(gx,gy);ctx.lineTo(gx+3,gy-4-n2*3);ctx.stroke();}
        } else if (tile.biome === 'frost') {
          ctx.fillStyle = style.texture; ctx.globalAlpha = .25;ctx.beginPath();ctx.arc(x+7+n*20,y+9+n2*17,1.1,0,Math.PI*2);ctx.arc(x+25-n2*8,y+25-n*9,.8,0,Math.PI*2);ctx.fill();
        } else {
          ctx.fillStyle = style.texture; ctx.globalAlpha = .22;ctx.beginPath();ctx.arc(x+7+n*22,y+9+n2*19,1.3,0,Math.PI*2);ctx.arc(x+26-n2*9,y+27-n*11,.9,0,Math.PI*2);ctx.fill();
        }
        ctx.globalAlpha = .18 + n * .08; ctx.fillStyle = n > .5 ? biome.detail : biome.edge;
        ctx.fillRect(x + 3 + n * 10, y + 4 + ((n * 31) % 18), 3 + n * 7, 1.4);
      }
      ctx.restore();
    }

    drawShoreline(ctx, tile, x, y, size) {
      if (tile.kind !== 'water') return;
      const sides = [[0,-1,x,y,x+size,y], [1,0,x+size,y,x+size,y+size], [0,1,x,y+size,x+size,y+size], [-1,0,x,y,x,y+size]];
      ctx.save();
      for (let i=0;i<sides.length;i++) {
        const [dx,dy,x1,y1,x2,y2] = sides[i];
        const neighbor = this.world.get(tile.x + dx, tile.y + dy);
        if (!neighbor || neighbor.kind === 'water') continue;
        const inset=size*WATER_VISUALS.edgeInset,band=size*.24;
        const sx=x1-dx*inset,sy=y1-dy*inset;
        const gradient=ctx.createLinearGradient(sx,sy,sx-dx*band,sy-dy*band);
        gradient.addColorStop(0,WATER_VISUALS.edgeTint);gradient.addColorStop(1,'rgba(22,66,78,0)');
        ctx.fillStyle=gradient;ctx.globalAlpha=WATER_VISUALS.edgeBlend;
        ctx.fillRect(x,y,size+1,size+1);
      }
      ctx.restore();
    }

    terrainChunk(chunkX, chunkY) {
      if (this.terrainVisualCache.world !== this.world) this.terrainVisualCache = { world: this.world, chunks: new Map() };
      const key = `${chunkX},${chunkY}`;
      if (this.terrainVisualCache.chunks.has(key)) return this.terrainVisualCache.chunks.get(key);
      const size = W.TILE, startX = chunkX * TERRAIN_CHUNK_TILES, startY = chunkY * TERRAIN_CHUNK_TILES;
      const renderStartX=Math.max(0,startX-TERRAIN_CHUNK_OVERLAP),renderStartY=Math.max(0,startY-TERRAIN_CHUNK_OVERLAP);
      const renderEndX=Math.min(this.world.width,startX+TERRAIN_CHUNK_TILES+TERRAIN_CHUNK_OVERLAP),renderEndY=Math.min(this.world.height,startY+TERRAIN_CHUNK_TILES+TERRAIN_CHUNK_OVERLAP);
      const tilesWide=renderEndX-renderStartX,tilesHigh=renderEndY-renderStartY;
      const canvas = document.createElement('canvas');canvas.width = tilesWide * size;canvas.height = tilesHigh * size;
      const chunkCtx = canvas.getContext('2d');chunkCtx.imageSmoothingEnabled = true;
      for (let y = 0; y < tilesHigh; y++) for (let x = 0; x < tilesWide; x++) {
        const tile = this.world.get(renderStartX + x, renderStartY + y), biome = W.BIOMES[tile.biome];
        this.drawTerrainTexture(chunkCtx, tile, biome, x * size, y * size, size);
      }
      const chunk = { canvas, x:renderStartX * size, y:renderStartY * size };
      this.terrainVisualCache.chunks.set(key, chunk);return chunk;
    }

    drawTerrain(ctx) {
      const size = W.TILE;
      const sx = Math.max(0, Math.floor(this.camera.x / size) - 2), sy = Math.max(0, Math.floor(this.camera.y / size) - 2);
      const ex = Math.min(this.world.width, Math.ceil((this.camera.x + this.visibleWorldWidth()) / size) + 2), ey = Math.min(this.world.height, Math.ceil((this.camera.y + this.visibleWorldHeight()) / size) + 2);
      const chunkStartX = Math.floor(sx / TERRAIN_CHUNK_TILES), chunkStartY = Math.floor(sy / TERRAIN_CHUNK_TILES);
      const chunkEndX = Math.ceil(ex / TERRAIN_CHUNK_TILES), chunkEndY = Math.ceil(ey / TERRAIN_CHUNK_TILES);
      ctx.save();ctx.imageSmoothingEnabled = true;
      for (let cy=chunkStartY;cy<chunkEndY;cy++) for(let cx=chunkStartX;cx<chunkEndX;cx++) { const chunk=this.terrainChunk(cx,cy);ctx.drawImage(chunk.canvas,chunk.x,chunk.y); }
      ctx.restore();
      const waterNow=performance.now();
      for (let y = sy; y < ey; y++) for (let x = sx; x < ex; x++) {
        const tile = this.world.get(x, y), px = x * size, py = y * size;
        if (tile.kind === 'water') this.drawWater(ctx, tile, px, py, size, waterNow);
        if (tile.object) this.drawFeature(ctx, tile, px, py, size);
      }
    }

    drawWater(ctx, tile, x, y, size, now) {
      const visual=this.waterTileVisual(tile),motion=this.waterMotionScale,quality=this.waterVisualQuality;
      const showSurface=visual.depthGate>.52+(1-quality)*.25;
      const showHighlight=visual.detailGate>.7+(1-quality)*.22;
      const showRipple=visual.rippleGate>.86+(1-quality)*.1;
      if(!showSurface&&!showHighlight&&!showRipple)return;
      const baseTime=now*WATER_VISUALS.baseSpeed*motion*(.8+visual.detailGate*.4)+visual.phaseA;
      const highlightTime=now*WATER_VISUALS.highlightSpeed*motion*(.9+visual.rippleGate*.3)+visual.phaseB;
      const rippleTime=now*WATER_VISUALS.rippleSpeed*motion*(.8+visual.depthGate*.35)+visual.phaseC;
      const cx=x+size*visual.anchorX,cy=y+size*visual.anchorY;
      ctx.save();ctx.lineCap='round';ctx.lineJoin='round';

      if(showSurface){
        const driftX=(Math.sin(baseTime)+Math.cos(baseTime*.61+visual.phaseB)*.38)*WATER_VISUALS.distortion;
        const driftY=(Math.cos(baseTime*.79)+Math.sin(baseTime*.53+visual.phaseC)*.32)*WATER_VISUALS.distortion;
        const flow=.5+.5*Math.sin(baseTime*.73+visual.phaseC),angle=visual.angle*.35+Math.sin(baseTime*.31+visual.phaseB)*.12;
        const ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux,len=size*(.12+visual.detailGate*.09),bend=(visual.curve*.28+Math.sin(baseTime*.47+visual.phaseC))*WATER_VISUALS.distortion;
        ctx.strokeStyle=WATER_VISUALS.surfaceTint;ctx.globalAlpha=WATER_VISUALS.surfaceOpacity*(.48+flow*.35);ctx.lineWidth=2+visual.rippleGate*.45;ctx.beginPath();
        ctx.moveTo(cx+driftX-ux*len*.5,cy+driftY-uy*len*.5);ctx.quadraticCurveTo(cx+driftX+vx*bend,cy+driftY+vy*bend,cx+driftX+ux*len*.5,cy+driftY+uy*len*.5);ctx.stroke();
      }

      if(showHighlight){
        const shimmer=.5+.5*Math.sin(highlightTime),angle=visual.angle*.22+Math.sin(highlightTime*.43)*.12;
        const ux=Math.cos(angle),uy=Math.sin(angle),vx=-uy,vy=ux,len=size*(.16+visual.depthGate*.13),bend=visual.curve+Math.sin(highlightTime*.71)*1.4;
        const hx=x+size*(.3+visual.rippleGate*.4)-Math.sin(highlightTime*.7)*WATER_VISUALS.distortion,hy=y+size*(.3+visual.depthGate*.4)+Math.cos(highlightTime*.57)*WATER_VISUALS.distortion*.45;
        ctx.strokeStyle=WATER_VISUALS.highlightTint;ctx.globalAlpha=WATER_VISUALS.highlightOpacity*(.38+shimmer*.48);ctx.lineWidth=.65+visual.rippleGate*.3;ctx.beginPath();
        ctx.moveTo(hx-ux*len*.5,hy-uy*len*.5);ctx.quadraticCurveTo(hx+vx*bend,hy+vy*bend,hx+ux*len*.5,hy+uy*len*.5);ctx.stroke();
      }

      if(showRipple){
        const rx=cx+Math.cos(rippleTime*.63)*WATER_VISUALS.distortion*.5,ry=cy-Math.sin(rippleTime*.81)*WATER_VISUALS.distortion;
        const length=size*(.22+visual.depthGate*.15),bend=Math.sin(rippleTime+visual.phaseA)*1.4+visual.curve;
        ctx.strokeStyle=WATER_VISUALS.rippleTint;ctx.globalAlpha=WATER_VISUALS.rippleOpacity*(.5+.3*Math.sin(rippleTime*.73));ctx.lineWidth=.8;ctx.beginPath();
        ctx.moveTo(rx-length*.5,ry+1);ctx.bezierCurveTo(rx-length*.18,ry-bend,rx+length*.16,ry+bend*.6,rx+length*.5,ry-1);ctx.stroke();
      }
      ctx.restore();
    }

    drawRoad(ctx, x, y, size, noise) {
      ctx.save();ctx.fillStyle='rgba(238,218,177,.14)';ctx.strokeStyle='rgba(44,34,26,.22)';ctx.lineWidth=.7;
      for(let i=0;i<3;i++){const px=x+6+((noise*41+i*13)%26),py=y+7+((noise*29+i*11)%24),r=1.2+((noise+i*.31)%1)*1.5;ctx.beginPath();ctx.ellipse(px,py,r*1.5,r,-.2,0,Math.PI*2);ctx.fill();ctx.stroke();}
      ctx.globalAlpha=.16;ctx.beginPath();ctx.moveTo(x,y+size*.2+noise*5);ctx.quadraticCurveTo(x+size*.5,y+size*.34,x+size,y+size*.24-noise*3);ctx.stroke();ctx.restore();
    }

    drawFeature(ctx, tile, x, y, size) {
      const biome = W.BIOMES[tile.biome], style = MAP_STYLE[tile.biome] || MAP_STYLE.forest;
      const cx = x + size / 2, baseY = y + size - 4, noise = this.terrainNoise(tile, 501);
      ctx.save();ctx.lineJoin='round';ctx.lineCap='round';
      ctx.fillStyle='rgba(2,5,6,.28)';ctx.beginPath();ctx.ellipse(cx+2,baseY,11+(tile.object==='ancientTree'?5:0),3.5,0,0,Math.PI*2);ctx.fill();

      if (tile.object === 'tree' || tile.object === 'ancientTree') {
        const ancient=tile.object==='ancientTree', radius=ancient?17:13, trunkTop=baseY-(ancient?25:20);
        ctx.fillStyle=style.trunk;ctx.beginPath();ctx.moveTo(cx-5,baseY);ctx.lineTo(cx-3,trunkTop);ctx.lineTo(cx+4,trunkTop-1);ctx.lineTo(cx+6,baseY);ctx.lineTo(cx+1,baseY-3);ctx.lineTo(cx-1,baseY);ctx.closePath();ctx.fill();
        ctx.strokeStyle=style.trunkLight;ctx.globalAlpha=.62;ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(cx-1,baseY-2);ctx.lineTo(cx,trunkTop+2);ctx.stroke();ctx.globalAlpha=1;
        const crown=ctx.createRadialGradient(cx-5,baseY-31,2,cx+2,baseY-25,radius+5);crown.addColorStop(0,style.crownLight);crown.addColorStop(.55,style.crown);crown.addColorStop(1,'rgba(10,30,20,.98)');ctx.fillStyle=crown;ctx.strokeStyle='rgba(7,20,14,.55)';ctx.lineWidth=1.2;
        ctx.beginPath();ctx.arc(cx-7,baseY-25,radius*.68,0,Math.PI*2);ctx.arc(cx+7,baseY-25,radius*.72,0,Math.PI*2);ctx.arc(cx,baseY-34,radius*.76,0,Math.PI*2);ctx.arc(cx,baseY-20,radius*.78,0,Math.PI*2);ctx.fill();ctx.stroke();
        ctx.fillStyle=biome.accent;ctx.globalAlpha=.30;ctx.beginPath();ctx.arc(cx-7,baseY-35,3.5+noise*2,0,Math.PI*2);ctx.arc(cx+4,baseY-30,2.4,0,Math.PI*2);ctx.fill();
      } else if (tile.object === 'pine') {
        ctx.fillStyle=style.trunk;ctx.fillRect(cx-2.5,baseY-20,5,20);ctx.fillStyle='rgba(12,35,34,.95)';ctx.strokeStyle='rgba(3,17,18,.5)';
        for(let i=0;i<3;i++){const top=baseY-38+i*8,half=8+i*3;ctx.beginPath();ctx.moveTo(cx,top);ctx.lineTo(cx-half,top+16);ctx.lineTo(cx+half,top+16);ctx.closePath();ctx.fill();ctx.stroke();}
        ctx.strokeStyle=style.crownLight;ctx.globalAlpha=.45;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,baseY-37);ctx.lineTo(cx-7,baseY-23);ctx.stroke();
      } else if (tile.object === 'cactus') {
        ctx.strokeStyle='#3d6548';ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(cx,baseY);ctx.lineTo(cx,baseY-28);ctx.moveTo(cx,baseY-15);ctx.lineTo(cx-8,baseY-19);ctx.lineTo(cx-8,baseY-24);ctx.moveTo(cx,baseY-20);ctx.lineTo(cx+8,baseY-24);ctx.lineTo(cx+8,baseY-28);ctx.stroke();
        ctx.strokeStyle='#8baa68';ctx.lineWidth=1.2;ctx.beginPath();ctx.moveTo(cx-2,baseY-2);ctx.lineTo(cx-2,baseY-27);ctx.stroke();
      } else if (tile.object === 'reed') {
        for(let i=-3;i<=3;i++){const lean=(i%2?1:-1)*(2+noise*2),height=11+((i*i+noise*9)%8);ctx.strokeStyle=i%2?'#8ca36b':'#627c51';ctx.lineWidth=1.4;ctx.beginPath();ctx.moveTo(cx+i*2.3,baseY);ctx.quadraticCurveTo(cx+i*2.3+lean*.4,baseY-height*.55,cx+i*2.3+lean,baseY-height);ctx.stroke();if(i%2===0){ctx.fillStyle='#745f3e';ctx.beginPath();ctx.ellipse(cx+i*2.3+lean,baseY-height-1,1.2,3,.2,0,Math.PI*2);ctx.fill();}}
      } else if (tile.object === 'crystal') {
        ctx.shadowBlur=10;ctx.shadowColor=biome.accent;ctx.fillStyle='rgba(132,218,237,.88)';ctx.beginPath();ctx.moveTo(cx,baseY-31);ctx.lineTo(cx+9,baseY-6);ctx.lineTo(cx+2,baseY);ctx.lineTo(cx-9,baseY-6);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
        ctx.fillStyle='rgba(230,255,255,.72)';ctx.beginPath();ctx.moveTo(cx,baseY-29);ctx.lineTo(cx+1,baseY-3);ctx.lineTo(cx-5,baseY-8);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(28,109,144,.42)';ctx.beginPath();ctx.moveTo(cx+1,baseY-3);ctx.lineTo(cx+9,baseY-6);ctx.lineTo(cx,baseY-29);ctx.closePath();ctx.fill();
      } else if (tile.object === 'ruin' || tile.object === 'obelisk') {
        const obelisk=tile.object==='obelisk',top=baseY-(obelisk?31:25),half=obelisk?7:9;ctx.fillStyle=obelisk?'#625953':'#52604f';ctx.beginPath();ctx.moveTo(cx-(obelisk?2:half),top);ctx.lineTo(cx+half,top+(obelisk?8:2));ctx.lineTo(cx+half-1,baseY);ctx.lineTo(cx-half,baseY);ctx.closePath();ctx.fill();
        ctx.fillStyle='rgba(214,196,164,.16)';ctx.beginPath();ctx.moveTo(cx-half+2,top+3);ctx.lineTo(cx,top+5);ctx.lineTo(cx-1,baseY-3);ctx.lineTo(cx-half+1,baseY);ctx.closePath();ctx.fill();ctx.strokeStyle='rgba(22,25,22,.42)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-2,top+9);ctx.lineTo(cx+3,top+15);ctx.lineTo(cx-1,top+21);ctx.stroke();
        ctx.fillStyle=biome.accent;ctx.globalAlpha=.42;ctx.fillRect(cx-1.5,baseY-19,3,8);
      } else {
        const sunrock=tile.object==='sunrock';ctx.fillStyle=sunrock?'#775137':'#514e50';ctx.strokeStyle='rgba(24,20,20,.55)';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx-14,baseY-4);ctx.lineTo(cx-10,baseY-13);ctx.lineTo(cx-1,baseY-17);ctx.lineTo(cx+11,baseY-12);ctx.lineTo(cx+14,baseY-4);ctx.lineTo(cx+8,baseY);ctx.lineTo(cx-9,baseY);ctx.closePath();ctx.fill();ctx.stroke();
        ctx.fillStyle=sunrock?'rgba(224,157,83,.30)':'rgba(201,194,188,.22)';ctx.beginPath();ctx.moveTo(cx-9,baseY-12);ctx.lineTo(cx-1,baseY-16);ctx.lineTo(cx+4,baseY-10);ctx.lineTo(cx-4,baseY-7);ctx.closePath();ctx.fill();ctx.fillStyle='rgba(17,17,18,.24)';ctx.beginPath();ctx.moveTo(cx+4,baseY-10);ctx.lineTo(cx+11,baseY-11);ctx.lineTo(cx+13,baseY-4);ctx.lineTo(cx+7,baseY-1);ctx.closePath();ctx.fill();
      }
      ctx.restore();
    }

    drawMobs(ctx) {
      const list = this.mobs.filter(m => !m.dead && Math.abs(m.x - this.player.x) < this.viewW * .8 + 400 && Math.abs(m.y - this.player.y) < this.viewH * .8 + 400).sort((a,b) => a.y-b.y);
      for (const m of list) {
        const d = W.MOB_DATA[m.type] || W.MOB_DATA.Slime, src = this.mobSpritePaths.get(m.type) || `Assets/Mob/${d.sprite}`, img = this.spriteImage(src);
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
      const p = this.player, c = W.CLASS_DATA[p.classId], src = this.classSpritePaths.get(p.classId) || `Assets/Classes/${c.sprite}`, img = this.spriteImage(src);
      ctx.save(); ctx.translate(p.x, p.y);
      ctx.fillStyle = 'rgba(0,0,0,.33)'; ctx.beginPath(); ctx.ellipse(0, 12, 15, 5, 0, 0, Math.PI * 2); ctx.fill();
      if (img) { ctx.save(); if (p.facing < 0) ctx.scale(-1,1); ctx.drawImage(img, -24, -39, 48, 48); ctx.restore(); }
      else { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(0,-8,16,0,Math.PI*2); ctx.fill(); }
      if (p.invuln > 0) { ctx.save(); ctx.strokeStyle = c.color; ctx.globalAlpha = .72 + Math.sin(performance.now()*.03)*.18; ctx.lineWidth = 2.25; ctx.shadowBlur = 7; ctx.shadowColor = c.color; ctx.beginPath(); ctx.arc(0,-15,23.5,0,Math.PI*2); ctx.stroke(); ctx.restore(); }
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
        } else if (e.type === 'incoming-damage') {
          const { x, y } = this.incomingDamagePosition(e);
          const alpha = Math.min(1, t * 8, (1 - t) * 3.2);
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.save();ctx.translate(x,y);ctx.rotate(e.angle || 0);ctx.strokeStyle=e.color;ctx.lineWidth=4.5;ctx.lineCap='round';ctx.shadowBlur=12;ctx.shadowColor=e.color;ctx.beginPath();ctx.arc(0,0,17,-1.05,1.05);ctx.stroke();ctx.lineWidth=1.5;ctx.globalAlpha*=.55;ctx.beginPath();ctx.arc(0,0,23,-.82,.82);ctx.stroke();ctx.restore();
          const labelX=x+(Number(e.nx)||0)*14,labelY=y+(Number(e.ny)||0)*14-t*5;ctx.globalAlpha=Math.max(0,alpha);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 12px Inter,sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(45,4,9,.85)';ctx.strokeText(e.text,labelX,labelY);ctx.fillStyle='#ffd8d8';ctx.fillText(e.text,labelX,labelY);
        } else if (e.type === 'class-basic-attack') {
          window.AstraeonCombatEffectsV1?.draw?.(ctx, e, t);
        } else if (e.type === 'class-skill') {
          window.AstraeonSkillEffectsV2?.draw?.(ctx, e, t);
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
        const px = (this.player.x - this.camera.x) * this.zoom, py = (this.player.y - this.camera.y) * this.zoom;
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
      ctx.strokeStyle='rgba(255,255,255,.28)';ctx.lineWidth=1;ctx.strokeRect(this.camera.x/(W.TILE*this.world.width)*size,this.camera.y/(W.TILE*this.world.height)*size,this.visibleWorldWidth()/(W.TILE*this.world.width)*size,this.visibleWorldHeight()/(W.TILE*this.world.height)*size);
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
      const xpPercent=Math.max(0,Math.min(100,p.xp/p.xpNext*100));this.ui.hp.style.width=`${Math.max(0,p.hp/p.maxHp*100)}%`;this.ui.mp.style.width=`${Math.max(0,p.mana/p.maxMana*100)}%`;this.ui.xp.style.width=`${xpPercent}%`;if(this.ui.xpText)this.ui.xpText.textContent=`${Math.floor(xpPercent)}%`;
      this.ui.hpText.textContent=`${Math.ceil(p.hp)} / ${p.maxHp}`;this.ui.mpText.textContent=`${Math.floor(p.mana)} / ${p.maxMana}`;this.ui.level.textContent=`Nv. ${p.level}`;this.ui.char.textContent=`${p.name} · ${W.CLASS_DATA[p.classId].name}`;
      if(this.ui.portrait&&this.ui.portrait.dataset.classId!==p.classId){this.ui.portrait.dataset.classId=p.classId;this.ui.portrait.src=`Assets/Classes/${W.CLASS_DATA[p.classId].sprite}`;this.ui.portrait.alt=`Retrato de ${W.CLASS_DATA[p.classId].name}`;}
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

  window.addEventListener('DOMContentLoaded', () => {
    window.astraeon = new AstraeonGame();
    window.AstraeonEntityCollisionV1?.install?.(window.astraeon);
  });
})();

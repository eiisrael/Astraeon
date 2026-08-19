(function (global) {
  'use strict';

  const VERSION = '2.0.0';
  const TILE = 36;
  const WORLD_W = 96;
  const WORLD_H = 96;
  const STORAGE_WORLD = 'astraeon:v2:world';
  const STORAGE_SAVE = 'astraeon:v2:save';

  const BIOMES = {
    forest: {
      id: 'forest', name: 'Bosque de Lúmen', climate: 'Temperado úmido', icon: '✦',
      ground: ['#183d2b', '#1f4d34', '#24583a', '#2b6541'], detail: '#5f9c63', edge: '#0e251b',
      water: '#224b5b', accent: '#89d69a', fog: 'rgba(85,130,100,.10)', weather: 'leaves',
      mobs: ['Slime', 'Wolf', 'Globin'], resource: 'Madeira antiga', feature: 'Árvores monumentais e clareiras luminescentes'
    },
    steppe: {
      id: 'steppe', name: 'Ermos de Solvar', climate: 'Árido e quente', icon: '☀',
      ground: ['#79532e', '#8a6031', '#9a6e39', '#ab7b40'], detail: '#d1a35c', edge: '#4a321d',
      water: '#397b84', accent: '#ffc76c', fog: 'rgba(214,154,70,.08)', weather: 'dust',
      mobs: ['Orc', 'Troll', 'Pig_Monster'], resource: 'Minério solar', feature: 'Planícies abertas, ravinas e pedras queimadas'
    },
    frost: {
      id: 'frost', name: 'Véu de Nivora', climate: 'Glacial', icon: '❄',
      ground: ['#b8ced8', '#c7dbe2', '#d4e6eb', '#9fb9c5'], detail: '#edf8fb', edge: '#657d89',
      water: '#6da4bb', accent: '#baf4ff', fog: 'rgba(195,230,245,.12)', weather: 'snow',
      mobs: ['Golem_Gelo', 'Wolf', 'Draconato'], resource: 'Cristal de gelo', feature: 'Neve azulada, lagos congelados e formações cristalinas'
    },
    swamp: {
      id: 'swamp', name: 'Pântano de Umbria', climate: 'Úmido e sombrio', icon: '☾',
      ground: ['#293a2f', '#314735', '#3b523d', '#455c43'], detail: '#739063', edge: '#17231c',
      water: '#345b52', accent: '#9ad07a', fog: 'rgba(90,120,85,.16)', weather: 'rain',
      mobs: ['Spider', 'zombie', 'sombra'], resource: 'Fibra espectral', feature: 'Água rasa, névoa e ruínas semi-afundadas'
    },
    highland: {
      id: 'highland', name: 'Altos de Cinza', climate: 'Rochoso e ventoso', icon: '▲',
      ground: ['#4b4745', '#57514e', '#615a56', '#6d645e'], detail: '#9b8d7e', edge: '#2b2928',
      water: '#425e68', accent: '#e5a772', fog: 'rgba(145,125,110,.08)', weather: 'embers',
      mobs: ['Caveira', 'Squelleton', 'Draconato'], resource: 'Rocha astral', feature: 'Escarpas, ruínas antigas e fissuras vulcânicas'
    }
  };

  const BIOME_ORDER = ['forest', 'steppe', 'frost', 'swamp', 'highland'];
  const ANCHORS = [
    { x: .18, y: .28, biome: 'forest' },
    { x: .78, y: .34, biome: 'steppe' },
    { x: .52, y: .10, biome: 'frost' },
    { x: .22, y: .78, biome: 'swamp' },
    { x: .76, y: .78, biome: 'highland' }
  ];

  const CLASS_DATA = {
    Warrior: { name: 'Guerreiro', sprite: 'Warrior.png', color: '#ff956a', hp: 190, mana: 70, speed: 178, power: 18, defense: 7, range: 58, crit: .08, skills: ['Golpe Astral', 'Ruptura', 'Bastião', 'Impacto', 'Ímpeto'] },
    Mage: { name: 'Mago', sprite: 'Mage.png', color: '#8fbbff', hp: 118, mana: 180, speed: 168, power: 24, defense: 2, range: 230, crit: .12, skills: ['Orbe Arcano', 'Nova', 'Égide', 'Teleporte', 'Cometa'] },
    Archer: { name: 'Arqueiro', sprite: 'Archer.png', color: '#95e881', hp: 138, mana: 120, speed: 188, power: 20, defense: 3, range: 260, crit: .18, skills: ['Flecha Solar', 'Rajada', 'Evasão', 'Armadilha', 'Chuva Astral'] },
    Assassin: { name: 'Assassino', sprite: 'Assassin.png', color: '#cc8cff', hp: 128, mana: 130, speed: 205, power: 22, defense: 2, range: 74, crit: .25, skills: ['Corte Sombrio', 'Passo Vazio', 'Marca', 'Dança de Lâminas', 'Execução'] },
    Paladine: { name: 'Paladino', sprite: 'Paladine.png', color: '#ffd66b', hp: 172, mana: 120, speed: 170, power: 17, defense: 8, range: 74, crit: .10, skills: ['Luz Jurada', 'Consagração', 'Muralha', 'Investida', 'Julgamento'] }
  };

  const MOB_DATA = {
    Slime: { sprite: 'Slime.png', hp: 42, power: 6, speed: 76, xp: 16, gold: [1, 5], color: '#7adf92' },
    Wolf: { sprite: 'Wolf.png', hp: 58, power: 8, speed: 112, xp: 24, gold: [2, 8], color: '#c0c9d0' },
    Globin: { sprite: 'Globin.png', hp: 66, power: 9, speed: 88, xp: 28, gold: [3, 10], color: '#86b96c' },
    Orc: { sprite: 'Orc.png', hp: 88, power: 12, speed: 82, xp: 38, gold: [4, 14], color: '#91ad63' },
    Troll: { sprite: 'Troll.png', hp: 126, power: 15, speed: 62, xp: 54, gold: [7, 18], color: '#7c9f65' },
    Pig_Monster: { sprite: 'Pig_Monster.png', hp: 74, power: 10, speed: 92, xp: 31, gold: [3, 11], color: '#cc9477' },
    Golem_Gelo: { sprite: 'Golem_Gelo.png', hp: 138, power: 15, speed: 54, xp: 62, gold: [8, 22], color: '#b9ecf5' },
    Spider: { sprite: 'Spider.png', hp: 54, power: 9, speed: 105, xp: 27, gold: [2, 9], color: '#8e7588' },
    zombie: { sprite: 'zombie.png', hp: 82, power: 11, speed: 58, xp: 35, gold: [3, 12], color: '#7f9b78' },
    sombra: { sprite: 'sombra.png', hp: 70, power: 14, speed: 98, xp: 44, gold: [5, 16], color: '#7e6cb5' },
    Caveira: { sprite: 'Caveira.png', hp: 76, power: 12, speed: 90, xp: 37, gold: [4, 12], color: '#e9e2d4' },
    Squelleton: { sprite: 'Squelleton.png', hp: 96, power: 13, speed: 78, xp: 43, gold: [5, 15], color: '#d9d1bd' },
    Draconato: { sprite: 'Draconato.png', hp: 168, power: 18, speed: 74, xp: 78, gold: [10, 28], color: '#c48263' }
  };

  function hashString(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a |= 0;
      a = a + 0x6D2B79F5 | 0;
      let t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function valueNoise(x, y, seed) {
    const n = Math.sin((x * 127.1 + y * 311.7 + seed * .00013)) * 43758.5453123;
    return n - Math.floor(n);
  }

  function smoothNoise(x, y, seed) {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const n00 = valueNoise(x0, y0, seed), n10 = valueNoise(x0 + 1, y0, seed);
    const n01 = valueNoise(x0, y0 + 1, seed), n11 = valueNoise(x0 + 1, y0 + 1, seed);
    const a = n00 + (n10 - n00) * sx;
    const b = n01 + (n11 - n01) * sx;
    return a + (b - a) * sy;
  }

  function fbm(x, y, seed) {
    let total = 0, amp = .5, freq = 1, sum = 0;
    for (let i = 0; i < 4; i++) {
      total += smoothNoise(x * freq, y * freq, seed + i * 977) * amp;
      sum += amp;
      amp *= .5; freq *= 2;
    }
    return total / sum;
  }

  function biomeAt(x, y, width, height, seed) {
    const nx = x / Math.max(1, width - 1), ny = y / Math.max(1, height - 1);
    const warpX = (fbm(nx * 3.2, ny * 3.2, seed + 101) - .5) * .16;
    const warpY = (fbm(nx * 3.2, ny * 3.2, seed + 303) - .5) * .16;
    let best = ANCHORS[0], bestD = Infinity;
    for (const a of ANCHORS) {
      const dx = nx + warpX - a.x, dy = ny + warpY - a.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = a; }
    }
    return best.biome;
  }

  function roadDistance(nx, ny) {
    const cx = .5, cy = .51;
    const radial = Math.abs(Math.hypot(nx - cx, ny - cy) - .115);
    const cross = Math.min(Math.abs(nx - cx), Math.abs(ny - cy));
    return Math.min(radial, cross * .68);
  }

  function buildTile(x, y, width, height, seed, overrides) {
    const key = `${x},${y}`;
    const override = overrides && overrides[key];
    const defaultBiome = biomeAt(x, y, width, height, seed);
    const biome = override && override.biome ? override.biome : defaultBiome;
    const cfg = BIOMES[biome] || BIOMES.forest;
    const nx = x / width, ny = y / height;
    const elevation = fbm(x * .055, y * .055, seed + 777);
    const moisture = fbm(x * .072, y * .072, seed + 3333);
    const detail = fbm(x * .18, y * .18, seed + 9191);
    const road = roadDistance(nx, ny) < .0085 && !(x < 3 || y < 3 || x > width - 4 || y > height - 4);

    let kind = 'ground';
    let blocked = false;
    if (!road) {
      if (biome === 'swamp' && moisture > .67) { kind = 'water'; blocked = moisture > .82; }
      else if (biome === 'frost' && moisture > .77) { kind = 'ice'; blocked = false; }
      else if (biome === 'steppe' && elevation < .23) { kind = 'sand'; }
      else if (biome === 'highland' && elevation > .78) { kind = 'rock'; blocked = true; }
      else if (biome === 'forest' && moisture > .81) { kind = 'water'; blocked = true; }
    } else {
      kind = 'road';
    }

    let object = null;
    if (!road && !blocked && kind !== 'water') {
      const chance = valueNoise(x * 9.17, y * 7.73, seed + 444);
      if (biome === 'forest' && chance > .88) object = chance > .965 ? 'ancientTree' : 'tree';
      if (biome === 'steppe' && chance > .945) object = chance > .98 ? 'cactus' : 'sunrock';
      if (biome === 'frost' && chance > .93) object = chance > .978 ? 'crystal' : 'pine';
      if (biome === 'swamp' && chance > .94) object = chance > .982 ? 'ruin' : 'reed';
      if (biome === 'highland' && chance > .92) object = chance > .975 ? 'obelisk' : 'boulder';
      if (['tree', 'ancientTree', 'sunrock', 'crystal', 'pine', 'ruin', 'boulder', 'obelisk'].includes(object)) blocked = true;
    }

    if (override) {
      if (typeof override.blocked === 'boolean') blocked = override.blocked;
      if (typeof override.object === 'string') object = override.object || null;
      if (override.kind) kind = override.kind;
    }

    const variant = Math.floor(detail * cfg.ground.length) % cfg.ground.length;
    return { x, y, biome, kind, blocked, object, variant, elevation, moisture, key };
  }

  function generateWorld(options = {}) {
    const seedText = String(options.seed || 'ASTRAEON-2');
    const seed = hashString(seedText);
    const width = options.width || WORLD_W;
    const height = options.height || WORLD_H;
    const custom = options.custom || loadWorldDesign();
    const overrides = custom && custom.overrides ? custom.overrides : {};
    const tiles = new Array(width * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        tiles[y * width + x] = buildTile(x, y, width, height, seed, overrides);
      }
    }
    const spawns = custom && Array.isArray(custom.spawns) ? custom.spawns.slice() : [];
    return {
      version: VERSION,
      seedText, seed, width, height, tileSize: TILE, tiles, spawns,
      get(x, y) {
        if (x < 0 || y < 0 || x >= width || y >= height) return null;
        return tiles[y * width + x];
      },
      tileAtPixel(px, py) { return this.get(Math.floor(px / TILE), Math.floor(py / TILE)); },
      pixelCenter(x, y) { return { x: x * TILE + TILE / 2, y: y * TILE + TILE / 2 }; }
    };
  }

  function loadWorldDesign() {
    try {
      const raw = localStorage.getItem(STORAGE_WORLD);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.version ? parsed : null;
    } catch (_) { return null; }
  }

  function saveWorldDesign(design) {
    localStorage.setItem(STORAGE_WORLD, JSON.stringify(design));
  }

  function makeDefaultDesign(seedText = 'ASTRAEON-2') {
    return { version: VERSION, seed: seedText, width: WORLD_W, height: WORLD_H, overrides: {}, spawns: [], notes: 'Mapa Astraeon 2.0' };
  }

  function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
  function randomRange(rng, min, max) { return min + (max - min) * rng(); }
  function pick(rng, list) { return list[Math.floor(rng() * list.length) % list.length]; }

  global.AstraeonWorld = {
    VERSION, TILE, WORLD_W, WORLD_H, STORAGE_WORLD, STORAGE_SAVE,
    BIOMES, BIOME_ORDER, CLASS_DATA, MOB_DATA,
    hashString, mulberry32, valueNoise, fbm, biomeAt, generateWorld,
    loadWorldDesign, saveWorldDesign, makeDefaultDesign,
    clamp, lerp, dist, randomRange, pick
  };
})(window);

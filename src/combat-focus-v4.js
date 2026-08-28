(function (global) {
  'use strict';

  const W = global.AstraeonWorld;
  if (!W) return;

  const DISPLAY_NAMES = Object.freeze({
    Slime: 'Slime', Wolf: 'Lobo', Globin: 'Goblin', Orc: 'Orc', Troll: 'Troll',
    Pig_Monster: 'Monstro Javali', Golem_Gelo: 'Golem de Gelo', Spider: 'Aranha',
    zombie: 'Zumbi', sombra: 'Sombra', Caveira: 'Caveira', Squelleton: 'Esqueleto',
    Draconato: 'Draconato'
  });

  const HOVER_RADIUS = 31;
  const JUMP_DURATION = 260;
  const TARGET_COLOR = '#f2c65d';
  const HOVER_COLOR = '#bcecff';
  let installed = false;
  let waiting = false;

  function displayName(mob) {
    const data = W.MOB_DATA?.[mob?.type] || {};
    return DISPLAY_NAMES[mob?.type] || data.name || String(mob?.type || 'Criatura').replaceAll('_', ' ');
  }

  function displayLevel(mob) {
    const explicit = Number(mob?.level);
    if (Number.isFinite(explicit) && explicit >= 1) return Math.max(1, Math.round(explicit));
    const data = W.MOB_DATA?.[mob?.type] || {};
    const baseHp = Math.max(1, Number(data.hp) || 1);
    const maxHp = Math.max(1, Number(mob?.maxHp) || baseHp);
    return Math.max(1, Math.round(1 + ((maxHp / baseHp) - 1) / .08));
  }

  function injectStyles() {
    if (document.querySelector('style[data-combat-focus-v4]')) return;
    const style = document.createElement('style');
    style.dataset.combatFocusV4 = '1';
    style.textContent = `
      #world.mob-focus-hover{cursor:crosshair}
      .mob-target-panel{position:fixed;z-index:24;left:50%;top:42px;transform:translate(-50%,-8px);width:min(520px,calc(100vw - 36px));display:grid;grid-template-columns:58px minmax(0,1fr) auto;gap:12px;align-items:center;padding:10px 12px;border:1px solid rgba(242,198,93,.34);border-radius:12px;background:linear-gradient(180deg,rgba(17,16,12,.96),rgba(7,10,12,.94));box-shadow:0 16px 50px rgba(0,0,0,.58),inset 0 1px rgba(255,255,255,.035),0 0 28px rgba(242,198,93,.06);backdrop-filter:blur(10px);color:#f5ead2;opacity:1;transition:opacity .16s ease,transform .16s ease;pointer-events:auto}
      .mob-target-panel.hidden{display:none!important}.mob-target-panel.is-entering{transform:translate(-50%,0)}
      .mob-target-portrait{width:58px;height:58px;display:grid;place-items:center;border:1px solid rgba(242,198,93,.25);border-radius:10px;background:radial-gradient(circle at 50% 38%,rgba(242,198,93,.13),rgba(5,8,10,.8));overflow:hidden;box-shadow:inset 0 0 22px rgba(0,0,0,.35)}
      .mob-target-portrait img{width:50px;height:50px;object-fit:contain;image-rendering:auto;filter:drop-shadow(0 5px 6px rgba(0,0,0,.65))}
      .mob-target-copy{min-width:0}.mob-target-eyebrow{display:flex;align-items:center;gap:7px;margin-bottom:2px;color:#c59e4e;font-size:8px;font-weight:900;letter-spacing:.16em;text-transform:uppercase}.mob-target-eyebrow::before{content:'';width:6px;height:6px;border-radius:50%;background:#e7bd58;box-shadow:0 0 10px rgba(231,189,88,.7)}
      .mob-target-title{display:flex;align-items:center;gap:8px;min-width:0}.mob-target-title strong{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font:700 15px Georgia,serif;color:#fff2d2;text-shadow:0 1px 8px rgba(0,0,0,.75)}.mob-target-level{flex:0 0 auto;padding:3px 7px;border:1px solid rgba(242,198,93,.25);border-radius:999px;background:rgba(242,198,93,.08);color:#f4d579;font-size:9px;font-weight:900}
      .mob-target-hp-row{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:7px;color:#a99f8d;font-size:9px}.mob-target-hp-row b{color:#e9dfcc;font-size:9px}
      .mob-target-hp-track{position:relative;height:9px;margin-top:4px;overflow:hidden;border:1px solid rgba(255,255,255,.1);border-radius:999px;background:#16080b;box-shadow:inset 0 1px 4px rgba(0,0,0,.8)}.mob-target-hp-fill{height:100%;width:100%;border-radius:inherit;background:linear-gradient(90deg,#b93646,#ef6674 58%,#ff8a8e);box-shadow:0 0 10px rgba(239,102,116,.3);transition:width .12s linear}.mob-target-hp-shine{position:absolute;inset:1px 2px auto;height:2px;border-radius:999px;background:rgba(255,255,255,.24);pointer-events:none}
      .mob-target-close{align-self:start;width:25px;height:25px;display:grid;place-items:center;border:1px solid rgba(255,255,255,.08);border-radius:7px;background:rgba(255,255,255,.03);color:#8e8779;font:700 14px/1 sans-serif;cursor:pointer}.mob-target-close:hover{border-color:rgba(242,198,93,.3);color:#f0d47f;background:rgba(242,198,93,.06)}
      @media(max-width:900px) and (min-width:621px) and (pointer:fine){
        .mob-target-panel{left:auto;right:12px;top:12px;transform:translateY(-8px);width:min(420px,calc(100vw - 376px))}
        .mob-target-panel.is-entering{transform:translateY(0)}
      }
      @media(pointer:coarse){
        .mob-target-panel{grid-template-columns:46px minmax(0,1fr) auto;gap:8px;padding:8px 9px}
        .mob-target-portrait{width:46px;height:46px}.mob-target-portrait img{width:40px;height:40px}.mob-target-title strong{font-size:13px}.mob-target-hp-row{margin-top:5px}
      }
      @media(pointer:coarse) and (orientation:landscape) and (min-width:601px){
        .mob-target-panel{left:auto;right:max(8px,env(safe-area-inset-right));top:max(7px,env(safe-area-inset-top));transform:translateY(-8px);width:min(420px,calc(100vw - 390px))}
        .mob-target-panel.is-entering{transform:translateY(0)}
      }
      @media(max-width:620px) and (pointer:fine), (pointer:coarse) and (orientation:portrait), (pointer:coarse) and (orientation:landscape) and (max-width:600px){
        .mob-target-panel{top:max(116px,calc(env(safe-area-inset-top) + 108px));left:calc((100vw - 132px)/2);right:auto;transform:translate(-50%,-8px);width:min(420px,calc(100vw - 148px));grid-template-columns:46px minmax(0,1fr) auto;gap:8px;padding:8px 9px}
        .mob-target-panel.is-entering{transform:translate(-50%,0)}
        .mob-target-portrait{width:46px;height:46px}.mob-target-portrait img{width:40px;height:40px}.mob-target-title strong{font-size:13px}.mob-target-hp-row{margin-top:5px}
        .hide-minimap .mob-target-panel{left:50%;width:min(420px,calc(100vw - 18px))}
      }
      @media(max-height:470px) and (pointer:coarse) and (orientation:landscape) and (min-width:601px){
        .mob-target-panel{grid-template-columns:42px minmax(0,1fr) auto;gap:7px;padding:7px 8px}
        .mob-target-portrait{width:42px;height:42px}.mob-target-portrait img{width:37px;height:37px}.mob-target-eyebrow{font-size:7px}.mob-target-title strong{font-size:12px}.mob-target-hp-row{margin-top:3px}.mob-target-hp-track{height:8px;margin-top:3px}
      }
    `;
    document.head.appendChild(style);
  }

  function ensurePanel() {
    let root = document.querySelector('#mobTargetPanel');
    if (root) return root;
    root = document.createElement('section');
    root.id = 'mobTargetPanel';
    root.className = 'mob-target-panel hidden';
    root.setAttribute('aria-live', 'polite');
    root.innerHTML = `
      <div class="mob-target-portrait"><img id="mobTargetPortrait" alt=""></div>
      <div class="mob-target-copy">
        <div class="mob-target-eyebrow">Alvo selecionado</div>
        <div class="mob-target-title"><strong id="mobTargetName">Criatura</strong><span id="mobTargetLevel" class="mob-target-level">Nv. 1</span></div>
        <div class="mob-target-hp-row"><span>VIDA</span><b id="mobTargetHpText">0 / 0</b></div>
        <div id="mobTargetHpTrack" class="mob-target-hp-track" role="progressbar" aria-label="Vida do alvo"><div id="mobTargetHpFill" class="mob-target-hp-fill"></div><i class="mob-target-hp-shine"></i></div>
      </div>
      <button id="mobTargetClose" class="mob-target-close" type="button" aria-label="Limpar alvo">×</button>`;
    document.body.appendChild(root);
    return root;
  }

  function pointerWorld(game, event) {
    const rect = game.canvas.getBoundingClientRect();
    return {
      x: event.clientX - rect.left + game.camera.x,
      y: event.clientY - rect.top + game.camera.y
    };
  }

  function mobAt(game, x, y, radius = HOVER_RADIUS) {
    let best = null;
    let bestDistance = radius;
    for (const mob of game.mobs || []) {
      if (!mob || mob.dead) continue;
      const distance = Math.hypot(mob.x - x, mob.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = mob;
      }
    }
    return best;
  }

  function triggerJump(state, mob, amplitude) {
    if (!mob?.id) return;
    state.jumps.set(mob.id, { start: performance.now(), amplitude, duration: JUMP_DURATION });
  }

  function jumpOffset(state, mob, now) {
    const jump = state.jumps.get(mob?.id);
    if (!jump) return 0;
    const t = (now - jump.start) / jump.duration;
    if (t >= 1) {
      state.jumps.delete(mob.id);
      return 0;
    }
    if (t <= 0) return 0;
    return Math.sin(Math.PI * t) * jump.amplitude;
  }

  function setTarget(game, state, mob, jump = true) {
    if (!mob || mob.dead) return;
    state.selected = mob;
    if (jump) triggerJump(state, mob, 8.5);
    updatePanel(game, state);
  }

  function clearTarget(state) {
    state.selected = null;
    document.querySelector('#mobTargetPanel')?.classList.add('hidden');
  }

  function updatePanel(game, state) {
    const mob = state.selected;
    const root = ensurePanel();
    if (!mob || mob.dead || !Array.isArray(game.mobs) || !game.mobs.includes(mob)) {
      state.selected = null;
      root.classList.add('hidden');
      return;
    }

    const data = W.MOB_DATA?.[mob.type] || {};
    const hp = Math.max(0, Math.round(Number(mob.hp) || 0));
    const maxHp = Math.max(1, Math.round(Number(mob.maxHp) || Number(data.hp) || 1));
    const pct = Math.max(0, Math.min(100, hp / maxHp * 100));
    const portrait = root.querySelector('#mobTargetPortrait');
    const name = root.querySelector('#mobTargetName');
    const level = root.querySelector('#mobTargetLevel');
    const hpText = root.querySelector('#mobTargetHpText');
    const hpFill = root.querySelector('#mobTargetHpFill');
    const hpTrack = root.querySelector('#mobTargetHpTrack');

    if (portrait) {
      portrait.src = `Assets/Mob/${data.sprite || ''}`;
      portrait.alt = displayName(mob);
    }
    if (name) name.textContent = displayName(mob);
    if (level) level.textContent = `Nv. ${displayLevel(mob)}`;
    if (hpText) hpText.textContent = `${hp} / ${maxHp}`;
    if (hpFill) hpFill.style.width = `${pct}%`;
    if (hpTrack) {
      hpTrack.setAttribute('aria-valuemin', '0');
      hpTrack.setAttribute('aria-valuemax', String(maxHp));
      hpTrack.setAttribute('aria-valuenow', String(hp));
    }

    root.classList.remove('hidden');
    root.classList.add('is-entering');
  }

  function drawUnderlay(ctx, mob, selected) {
    if (!mob || mob.dead) return;
    const now = performance.now();
    const wave = (Math.sin(now * .009) + 1) * .5;
    const pulse = selected ? 1 + wave * .18 : 1 + wave * .07;
    const color = selected ? TARGET_COLOR : HOVER_COLOR;
    const alpha = selected ? .34 + wave * .24 : .14 + wave * .08;

    ctx.save();
    ctx.translate(mob.x, mob.y + 11);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = color;
    ctx.globalAlpha = alpha;
    ctx.lineWidth = selected ? 2.2 : 1.3;
    ctx.shadowBlur = selected ? 15 : 8;
    ctx.shadowColor = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, selected ? 24 : 19, selected ? 8.5 : 6.5, 0, 0, Math.PI * 2);
    ctx.stroke();
    if (selected) {
      ctx.globalAlpha *= .32;
      ctx.beginPath();
      ctx.ellipse(0, 0, 31, 11, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawOverlay(ctx, mob, selected) {
    if (!mob || mob.dead || !selected) return;
    const now = performance.now();
    const wave = (Math.sin(now * .01) + 1) * .5;
    const top = -34 - wave * 2;

    ctx.save();
    ctx.translate(mob.x, mob.y);
    ctx.fillStyle = TARGET_COLOR;
    ctx.globalAlpha = .72 + wave * .25;
    ctx.shadowBlur = 12;
    ctx.shadowColor = TARGET_COLOR;
    ctx.beginPath();
    ctx.moveTo(0, top - 8);
    ctx.lineTo(-5, top - 1);
    ctx.lineTo(5, top - 1);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function installNow() {
    const game = global.astraeon;
    if (installed || !game?.canvas || typeof game.drawMobs !== 'function') return false;
    installed = true;
    injectStyles();
    const panel = ensurePanel();
    const state = { hovered: null, selected: null, jumps: new Map() };
    game.mobCombatFocusV4 = state;

    panel.querySelector('#mobTargetClose')?.addEventListener('click', () => clearTarget(state));

    game.canvas.addEventListener('mousemove', (event) => {
      if (!game.running || game.paused) return;
      const point = pointerWorld(game, event);
      game.mouse.worldX = point.x;
      game.mouse.worldY = point.y;
      const next = mobAt(game, point.x, point.y);
      if (next !== state.hovered) {
        state.hovered = next;
        if (next) triggerJump(state, next, 5.2);
      }
      game.canvas.classList.toggle('mob-focus-hover', !!next);
    });

    game.canvas.addEventListener('mouseleave', () => {
      state.hovered = null;
      game.canvas.classList.remove('mob-focus-hover');
    });

    game.canvas.addEventListener('mousedown', (event) => {
      if (event.button !== 0 || !game.running || game.paused) return;
      const point = pointerWorld(game, event);
      const mob = mobAt(game, point.x, point.y, 38);
      if (mob) setTarget(game, state, mob, true);
    });

    const originalBasicAttack = game.basicAttack.bind(game);
    game.basicAttack = function (...args) {
      const pointerTarget = mobAt(this, this.mouse.worldX, this.mouse.worldY, 72);
      if (pointerTarget) setTarget(this, state, pointerTarget, true);
      return originalBasicAttack(...args);
    };

    const originalDrawMobs = game.drawMobs.bind(game);
    game.drawMobs = function (ctx) {
      if (state.selected?.dead) state.selected = null;
      const now = performance.now();
      const moved = [];

      for (const mob of this.mobs || []) {
        if (!mob || mob.dead) continue;
        const offset = jumpOffset(state, mob, now);
        if (offset <= .01) continue;
        moved.push([mob, mob.y]);
        mob.y -= offset;
      }

      if (state.hovered && state.hovered !== state.selected) drawUnderlay(ctx, state.hovered, false);
      if (state.selected) drawUnderlay(ctx, state.selected, true);

      try {
        originalDrawMobs(ctx);
        if (state.hovered && state.hovered !== state.selected) drawOverlay(ctx, state.hovered, false);
        if (state.selected) drawOverlay(ctx, state.selected, true);
      } finally {
        for (const [mob, y] of moved) mob.y = y;
      }

      updatePanel(this, state);
    };

    const originalKillMob = game.killMob.bind(game);
    game.killMob = function (mob, ...args) {
      const wasSelected = state.selected === mob;
      const result = originalKillMob(mob, ...args);
      if (wasSelected) clearTarget(state);
      if (state.hovered === mob) state.hovered = null;
      return result;
    };

    return true;
  }

  function installWhenReady() {
    if (installed || waiting) return true;
    waiting = true;
    const started = performance.now();
    const tick = () => {
      if (global.astraeon?.canvas && (document.body.classList.contains('astraeon-online-controller-ready') || performance.now() - started > 1800)) {
        waiting = false;
        installNow();
        return;
      }
      if (performance.now() - started < 6000) setTimeout(tick, 60);
      else waiting = false;
    };
    tick();
  }

  global.AstraeonCombatFocusV4 = { install: installWhenReady };
  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', installWhenReady, { once: true });
  else installWhenReady();
})(window);
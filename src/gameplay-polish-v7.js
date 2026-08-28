(function (global) {
  'use strict';

  const STORAGE_KEY = 'astraeon:v7:mobile-skill-layout';
  const HOLD_MS = 5000;
  const MOVE_THRESHOLD = 12;
  const MIN_SCALE = 0.72;
  const MAX_SCALE = 1.85;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  let installed = false;
  let skillState = null;
  let holdTimer = 0;
  let holdRaf = 0;
  const pointers = new Map();

  function isEditableTarget(target) {
    return !!target?.closest?.('input,textarea,select,[contenteditable="true"],#onlineAccountPanel,#npcDialogue');
  }

  function expandChatNow() {
    const chat = document.querySelector('#onlineChat');
    const input = document.querySelector('#onlineChatInput');
    if (!chat) return false;

    try { global.AstraeonOnlineControllerV4?.openChat?.(true); } catch (_) {}
    chat.classList.remove('collapsed', 'collapsed-mobile', 'chat-pro-collapsed');
    chat.dataset.chatCollapsed = 'false';

    const toggle = document.querySelector('#onlineChatToggle');
    if (toggle) {
      toggle.textContent = '▾';
      toggle.setAttribute('aria-expanded', 'true');
      toggle.setAttribute('aria-label', 'Minimizar chat');
      toggle.title = 'Minimizar chat';
    }

    if (input && input.dataset.accountBlocked !== 'true') {
      input.disabled = false;
      requestAnimationFrame(() => input.focus({ preventScroll: true }));
    }
    return true;
  }

  function installChatEnterFallback() {
    if (global.__astraeonChatEnterV7) return;
    global.__astraeonChatEnterV7 = true;
    global.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.repeat) return;
      const active = document.activeElement;
      if (active?.closest?.('#onlineChat')) return;
      if (isEditableTarget(active)) return;
      const game = global.astraeon;
      if (!game?.running || game.paused) return;

      if (expandChatNow()) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      let attempts = 0;
      const retry = () => {
        attempts += 1;
        if (expandChatNow() || attempts >= 20) return;
        setTimeout(retry, 75);
      };
      retry();
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }

  function sunState(game) {
    const clock = ((Number(game?.worldClock) || 0) % 1 + 1) % 1;
    const dawn = 0.22;
    const dusk = 0.78;
    const progress = clamp((clock - dawn) / (dusk - dawn), 0, 1);
    const daylight = clock >= dawn && clock <= dusk;
    const altitude = daylight ? Math.sin(progress * Math.PI) : 0;
    const intensity = daylight ? clamp(0.08 + altitude * 0.22, 0, 0.30) : 0;
    const horizontal = (0.5 - progress) * 2;
    const length = daylight ? 10 + (1 - altitude) * 34 : 0;
    return {
      clock, daylight, progress, altitude, intensity,
      shadowX: horizontal * length,
      shadowY: (0.38 + (1 - altitude) * 0.62) * length,
      screenX: 0.06 + progress * 0.88,
      screenY: 0.085 - altitude * 0.045,
      warmth: daylight ? clamp(0.04 + (1 - altitude) * 0.10, 0.04, 0.14) : 0
    };
  }

  function drawRigidbodyShadow(ctx, object) {
    const game = global.astraeon;
    const sun = sunState(game);
    if (!sun.daylight || sun.intensity <= 0.01 || !ctx || !object) return;

    const x = Number(object.x) || 0;
    const y = Number(object.y) || 0;
    const width = Math.max(8, Number(object.width) || 36);
    const height = Math.max(8, Number(object.height) || 36);
    const rotation = (Number(object.rotation) || 0) * Math.PI / 180;
    const opacity = clamp(Number(object.opacity ?? 1), 0, 1);
    const sizeFactor = clamp((width + height) / 96, 0.55, 2.6);
    const dx = sun.shadowX * sizeFactor;
    const dy = sun.shadowY * sizeFactor;
    const shape = object.shape || 'ellipse';

    ctx.save();
    ctx.translate(x + dx, y + dy);
    ctx.rotate(rotation);
    ctx.globalAlpha = sun.intensity * opacity;
    ctx.fillStyle = 'rgba(3,5,8,.72)';

    if (shape === 'circle' || shape === 'ellipse') {
      ctx.beginPath();
      ctx.ellipse(0, 0, width * 0.54, Math.max(4, height * 0.22), 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (shape === 'diamond') {
      const hw = width * 0.48, hh = Math.max(5, height * 0.24);
      ctx.beginPath();
      ctx.moveTo(0, -hh); ctx.lineTo(hw, 0); ctx.lineTo(0, hh); ctx.lineTo(-hw, 0); ctx.closePath();
      ctx.fill();
    } else {
      const h = Math.max(5, height * 0.28);
      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') ctx.roundRect(-width * 0.48, -h / 2, width * 0.96, h, Math.min(6, h / 2));
      else ctx.rect(-width * 0.48, -h / 2, width * 0.96, h);
      ctx.fill();
    }

    ctx.globalAlpha *= 0.34;
    ctx.translate(dx * 0.08, dy * 0.08);
    ctx.scale(1.08, 1.12);
    ctx.beginPath();
    ctx.ellipse(0, 0, width * 0.55, Math.max(5, height * 0.23), 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function installSunLighting(game) {
    if (!game || game.sunLightingV7Installed) return;
    game.sunLightingV7Installed = true;
    game.getSunState = function () { return sunState(this); };
    game.drawRigidbodyShadow = drawRigidbodyShadow;

    const originalTerrain = typeof game.drawTerrain === 'function' ? game.drawTerrain.bind(game) : null;
    if (originalTerrain) {
      game.drawTerrain = function (ctx) {
        const result = originalTerrain(ctx);
        let sceneObjects = global.AstraeonProductionV6?.state?.design?.sceneObjects;
        if (!Array.isArray(sceneObjects)) {
          try { sceneObjects = global.AstraeonWorld?.loadWorldDesign?.()?.sceneObjects; } catch (_) { sceneObjects = null; }
        }
        if (Array.isArray(sceneObjects) && this.player) {
          for (const object of sceneObjects) {
            if (!object || object.visible === false) continue;
            const rigid = object.rigidbody === true || object.rigidbody === 'true' || object.collision === true || object.collision === 'true' || object.physics?.rigidbody === true;
            if (!rigid) continue;
            const ox = Number(object.x) || 0, oy = Number(object.y) || 0;
            if (Math.abs(ox - this.player.x) > this.viewW + 600 || Math.abs(oy - this.player.y) > this.viewH + 600) continue;
            this.drawRigidbodyShadow?.(ctx, {
              x: ox, y: oy, width: object.width, height: object.height, rotation: object.rotation,
              shape: object.shape, opacity: object.opacity
            });
          }
        }
        return result;
      };
    }

    const originalFeature = typeof game.drawFeature === 'function' ? game.drawFeature.bind(game) : null;
    if (originalFeature) {
      game.drawFeature = function (ctx, tile, x, y, size) {
        if (tile?.object && tile?.blocked) {
          const object = String(tile.object);
          const tall = ['tree', 'ancientTree', 'pine', 'cactus', 'obelisk', 'ruin', 'crystal'].includes(object);
          this.drawRigidbodyShadow?.(ctx, {
            x: x + size / 2,
            y: y + size * 0.76,
            width: tall ? size * 0.78 : size * 0.72,
            height: tall ? size * 1.05 : size * 0.58,
            shape: object === 'crystal' ? 'diamond' : 'ellipse',
            opacity: 0.92
          });
        }
        return originalFeature(ctx, tile, x, y, size);
      };
    }

    const originalAtmosphere = typeof game.drawAtmosphere === 'function' ? game.drawAtmosphere.bind(game) : null;
    if (originalAtmosphere) {
      game.drawAtmosphere = function (ctx) {
        originalAtmosphere(ctx);
        const sun = this.getSunState?.();
        if (!sun?.daylight) return;
        const w = this.viewW || innerWidth;
        const h = this.viewH || innerHeight;
        const x = w * sun.screenX;
        const y = h * sun.screenY;

        ctx.save();
        const wash = ctx.createLinearGradient(0, 0, w, h * 0.35);
        wash.addColorStop(0, `rgba(255,178,92,${sun.warmth * 0.22})`);
        wash.addColorStop(0.5, `rgba(255,226,157,${sun.warmth * 0.09})`);
        wash.addColorStop(1, 'rgba(255,231,173,0)');
        ctx.fillStyle = wash;
        ctx.fillRect(0, 0, w, Math.min(h * 0.34, 220));

        const glow = ctx.createRadialGradient(x, y, 2, x, y, 46 + (1 - sun.altitude) * 20);
        glow.addColorStop(0, 'rgba(255,247,193,.82)');
        glow.addColorStop(0.12, 'rgba(255,213,108,.58)');
        glow.addColorStop(0.45, 'rgba(255,174,70,.14)');
        glow.addColorStop(1, 'rgba(255,174,70,0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, 68, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };
    }
  }

  function loadSkillLayout() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return data && typeof data === 'object' ? data : {};
    } catch (_) { return {}; }
  }

  function saveSkillLayout(layout) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(layout)); } catch (_) {}
  }

  function layoutForButton(button) {
    const index = String(button.dataset.skill || '0');
    const saved = loadSkillLayout()[index];
    if (!saved) return { dx: 0, dy: 0, scale: 1 };
    return {
      dx: clamp(Number(saved.dx) || 0, -1, 1) * innerWidth,
      dy: clamp(Number(saved.dy) || 0, -1, 1) * innerHeight,
      scale: clamp(Number(saved.scale) || 1, MIN_SCALE, MAX_SCALE)
    };
  }

  function applySkillLayout(button, data) {
    button.style.setProperty('--skill-user-dx', `${Math.round(data.dx)}px`);
    button.style.setProperty('--skill-user-dy', `${Math.round(data.dy)}px`);
    button.style.setProperty('--skill-user-scale', String(data.scale));
    button.classList.toggle('skill-user-positioned', Math.abs(data.dx) > 0.5 || Math.abs(data.dy) > 0.5 || Math.abs(data.scale - 1) > 0.01);
  }

  function persistButton(button, data) {
    const layout = loadSkillLayout();
    layout[String(button.dataset.skill || '0')] = {
      dx: clamp(data.dx / Math.max(1, innerWidth), -1, 1),
      dy: clamp(data.dy / Math.max(1, innerHeight), -1, 1),
      scale: clamp(data.scale, MIN_SCALE, MAX_SCALE)
    };
    saveSkillLayout(layout);
  }

  function clearHoldTimer() {
    if (holdTimer) clearTimeout(holdTimer);
    holdTimer = 0;
    if (holdRaf) cancelAnimationFrame(holdRaf);
    holdRaf = 0;
  }

  function clearSkillState({ keepLayout = true } = {}) {
    clearHoldTimer();
    const state = skillState;
    if (!state) return;
    state.button.classList.remove('skill-config-arming', 'skill-config-editing');
    state.button.style.removeProperty('--skill-config-progress');
    document.body.classList.remove('mobile-skill-config-active');
    if (state.armed && keepLayout) {
      persistButton(state.button, state.current);
      applySkillLayout(state.button, state.current);
    }
    skillState = null;
    pointers.clear();
  }

  function updateChargeVisual() {
    if (!skillState || skillState.armed) return;
    const elapsed = performance.now() - skillState.startedAt;
    const progress = clamp(elapsed / HOLD_MS, 0, 1);
    skillState.button.style.setProperty('--skill-config-progress', String(progress));
    if (progress < 1) holdRaf = requestAnimationFrame(updateChargeVisual);
  }

  function beginEditMode() {
    if (!skillState || !pointers.has(skillState.primaryId)) return;
    skillState.armed = true;
    skillState.button.classList.remove('skill-config-arming');
    skillState.button.classList.add('skill-config-editing');
    document.body.classList.add('mobile-skill-config-active');
    try { navigator.vibrate?.([45, 35, 45]); } catch (_) {}
    global.astraeon?.toast?.('Ajuste de habilidade: arraste para mover; use dois dedos para redimensionar.');
  }

  function pinchDistance() {
    const values = Array.from(pointers.values());
    if (values.length < 2) return 0;
    return Math.hypot(values[0].x - values[1].x, values[0].y - values[1].y);
  }

  function startPinchIfNeeded() {
    if (!skillState?.armed || pointers.size < 2) return;
    skillState.pinchStartDistance = Math.max(1, pinchDistance());
    skillState.pinchStartScale = skillState.current.scale;
  }

  function updateEditedButton(event) {
    if (!skillState?.armed) return;
    if (pointers.size >= 2) {
      if (!skillState.pinchStartDistance) startPinchIfNeeded();
      const distance = Math.max(1, pinchDistance());
      skillState.current.scale = clamp(skillState.pinchStartScale * (distance / skillState.pinchStartDistance), MIN_SCALE, MAX_SCALE);
      applySkillLayout(skillState.button, skillState.current);
      return;
    }

    if (event.pointerId !== skillState.primaryId) return;
    const dx = event.clientX - skillState.startPointerX;
    const dy = event.clientY - skillState.startPointerY;
    const candidateX = skillState.startLayout.dx + dx;
    const candidateY = skillState.startLayout.dy + dy;
    const startRect = skillState.startRect;
    const minShiftX = 8 - startRect.left;
    const maxShiftX = innerWidth - 8 - startRect.right;
    const minShiftY = 8 - startRect.top;
    const maxShiftY = innerHeight - 8 - startRect.bottom;
    skillState.current.dx = clamp(candidateX, skillState.startLayout.dx + minShiftX, skillState.startLayout.dx + maxShiftX);
    skillState.current.dy = clamp(candidateY, skillState.startLayout.dy + minShiftY, skillState.startLayout.dy + maxShiftY);
    applySkillLayout(skillState.button, skillState.current);
  }

  function mobileSkillButton(target) {
    return target?.closest?.('#mobileControls [data-skill]') || null;
  }

  function installMobileSkillCustomization() {
    if (global.__astraeonMobileSkillsV7) return;
    global.__astraeonMobileSkillsV7 = true;

    const applySaved = () => document.querySelectorAll('#mobileControls [data-skill]').forEach(button => applySkillLayout(button, layoutForButton(button)));
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', applySaved, { once: true });
    else applySaved();
    global.addEventListener('resize', applySaved);

    document.addEventListener('pointerdown', (event) => {
      if (skillState?.armed && event.pointerId !== skillState.primaryId && event.pointerType !== 'mouse') {
        pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        startPinchIfNeeded();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const button = mobileSkillButton(event.target);
      if (!button) return;
      const touchLike = event.pointerType !== 'mouse' || document.body.classList.contains('touch-forced');
      if (!touchLike) return;

      clearSkillState({ keepLayout: true });
      const startLayout = layoutForButton(button);
      const rect = button.getBoundingClientRect();
      skillState = {
        button,
        primaryId: event.pointerId,
        startedAt: performance.now(),
        startPointerX: event.clientX,
        startPointerY: event.clientY,
        startRect: rect,
        startLayout: { ...startLayout },
        current: { ...startLayout },
        armed: false,
        movedBeforeArm: false,
        pinchStartDistance: 0,
        pinchStartScale: startLayout.scale
      };
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      button.classList.add('skill-config-arming');
      button.style.setProperty('--skill-config-progress', '0');
      holdTimer = setTimeout(beginEditMode, HOLD_MS);
      holdRaf = requestAnimationFrame(updateChargeVisual);
      try { button.setPointerCapture?.(event.pointerId); } catch (_) {}
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    document.addEventListener('pointermove', (event) => {
      if (!skillState || !pointers.has(event.pointerId)) return;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

      if (!skillState.armed && event.pointerId === skillState.primaryId) {
        const moved = Math.hypot(event.clientX - skillState.startPointerX, event.clientY - skillState.startPointerY);
        if (moved > MOVE_THRESHOLD) {
          skillState.movedBeforeArm = true;
          clearHoldTimer();
          skillState.button.classList.remove('skill-config-arming');
        }
      } else if (skillState.armed) {
        updateEditedButton(event);
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);

    const finishPointer = (event, cancelled = false) => {
      if (!skillState || !pointers.has(event.pointerId)) return;
      const wasPrimary = event.pointerId === skillState.primaryId;
      pointers.delete(event.pointerId);

      if (skillState.armed && !wasPrimary) {
        skillState.pinchStartDistance = 0;
        skillState.pinchStartScale = skillState.current.scale;
      } else if (wasPrimary) {
        const state = skillState;
        const shouldCast = !state.armed && !state.movedBeforeArm && !cancelled;
        if (state.armed) {
          persistButton(state.button, state.current);
          global.astraeon?.toast?.('Posição da habilidade salva.');
        }
        clearSkillState({ keepLayout: true });
        if (shouldCast) global.astraeon?.castSkill?.(Number(state.button.dataset.skill));
      }

      event.preventDefault();
      event.stopImmediatePropagation();
    };

    document.addEventListener('pointerup', event => finishPointer(event, false), true);
    document.addEventListener('pointercancel', event => finishPointer(event, true), true);
  }

  function install() {
    const game = global.astraeon;
    if (!game || installed) return false;
    installed = true;
    installSunLighting(game);
    installMobileSkillCustomization();
    document.body.classList.add('astraeon-gameplay-polish-v7');
    return true;
  }

  function waitForGame() {
    if (install()) return;
    setTimeout(waitForGame, 60);
  }

  installChatEnterFallback();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', waitForGame, { once: true });
  else waitForGame();

  global.AstraeonGameplayPolishV7 = { sunState, drawRigidbodyShadow, expandChatNow, HOLD_MS };
})(window);

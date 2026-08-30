(function (global) {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const MAX_WAIT_MS = 15000;
  const MIN_SPRINT_MULTIPLIER = 1.70;
  const CHAT_POSITION_KEY = 'astraeon:v4:chat-position-v2';
  const PLAYER_PANEL_STATE_KEY = 'astraeon:v4:player-panel-collapsed';
  const CHAT_EDGE = 8;
  const MOB_DISPLAY_NAMES = Object.freeze({
    Slime:'Slime', Wolf:'Lobo', Globin:'Goblin', Orc:'Orc', Troll:'Troll', Pig_Monster:'Monstro Javali',
    Golem_Gelo:'Golem de Gelo', Spider:'Aranha', zombie:'Zumbi', sombra:'Sombra', Caveira:'Caveira',
    Squelleton:'Esqueleto', Draconato:'Draconato'
  });
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  let installed = false;
  let sessionTimer = null;
  let chatPlacementRaf = 0;
  let chatResizeObserver = null;
  let chatClassObserver = null;

  function appendLocalSystem(text) {
    const box = $('#onlineChatMessages');
    if (!box) return;
    const row = document.createElement('div');
    row.className = 'online-chat-line system';
    const head = document.createElement('div');
    const name = document.createElement('b');
    const time = document.createElement('time');
    const body = document.createElement('span');
    name.textContent = 'Sistema';
    time.textContent = new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    body.textContent = text;
    head.append(name, time);
    row.append(head, body);
    box.appendChild(row);
    while (box.children.length > 90) box.firstElementChild.remove();
    box.scrollTop = box.scrollHeight;
  }

  function openAccount(message) {
    const panel = $('#onlineAccountPanel');
    panel?.classList.remove('hidden');
    const msg = $('#onlineAuthMessage');
    if (msg && message) {
      msg.textContent = message;
      msg.dataset.type = 'error';
    }
  }

  function openChat(focus = true) {
    if (global.AstraeonChatControllerV5?.open) {
      global.AstraeonChatControllerV5.open(focus);
      return;
    }
    const chat = $('#onlineChat');
    const input = $('#onlineChatInput');
    if (!chat || !input) return;
    chat.classList.remove('collapsed', 'collapsed-mobile', 'chat-pro-collapsed');
    chat.dataset.chatCollapsed = 'false';
    queueChatPlacement();
    if (focus) {
      input.disabled = false;
      requestAnimationFrame(() => input.focus());
    }
  }

  function chatMode() {
    const touch = document.body.classList.contains('touch-forced') || !!global.matchMedia?.('(pointer:coarse)').matches;
    if (!touch) return 'desktop';
    return innerWidth > innerHeight ? 'touch-landscape' : 'touch-portrait';
  }

  function loadChatPositions() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CHAT_POSITION_KEY) || '{}');
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (_) {
      return {};
    }
  }

  function defaultChatPosition(rect, mode) {
    if (mode === 'touch-landscape') {
      const leftControlsEdge = Math.min(174, Math.max(150, innerWidth * .22));
      const rightControlsWidth = Math.min(208, Math.max(178, innerWidth * .25));
      const rightControlsEdge = innerWidth - rightControlsWidth;
      const corridorWidth = Math.max(0, rightControlsEdge - leftControlsEdge);
      const x = corridorWidth >= rect.width
        ? leftControlsEdge + (corridorWidth - rect.width) / 2
        : (innerWidth - rect.width) / 2;
      return { x, y: innerHeight - rect.height - 16 };
    }
    if (mode === 'touch-portrait') {
      return { x: 8, y: innerHeight - rect.height - 170 };
    }
    return { x: 12, y: innerHeight - rect.height - 44 };
  }

  function applyChatPosition(preferSaved = true) {
    const chat = $('#onlineChat');
    if (!chat || chat.classList.contains('chat-dragging')) return;
    const rect = chat.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mode = chatMode();
    const maxX = Math.max(CHAT_EDGE, innerWidth - rect.width - CHAT_EDGE);
    const maxY = Math.max(CHAT_EDGE, innerHeight - rect.height - CHAT_EDGE);
    const saved = preferSaved ? loadChatPositions()[mode] : null;
    let position;

    if (saved && Number.isFinite(Number(saved.x)) && Number.isFinite(Number(saved.y))) {
      position = {
        x: CHAT_EDGE + clamp(Number(saved.x), 0, 1) * Math.max(0, maxX - CHAT_EDGE),
        y: CHAT_EDGE + clamp(Number(saved.y), 0, 1) * Math.max(0, maxY - CHAT_EDGE)
      };
      chat.dataset.userPosition = 'true';
    } else {
      position = defaultChatPosition(rect, mode);
      chat.dataset.userPosition = 'false';
    }

    chat.style.left = `${Math.round(clamp(position.x, CHAT_EDGE, maxX))}px`;
    chat.style.top = `${Math.round(clamp(position.y, CHAT_EDGE, maxY))}px`;
    chat.style.right = 'auto';
    chat.style.bottom = 'auto';
    chat.style.transform = 'none';
    chat.style.translate = 'none';
    chat.dataset.positionMode = mode;
  }

  function queueChatPlacement(preferSaved = true) {
    if (chatPlacementRaf) cancelAnimationFrame(chatPlacementRaf);
    chatPlacementRaf = requestAnimationFrame(() => {
      chatPlacementRaf = requestAnimationFrame(() => {
        chatPlacementRaf = 0;
        applyChatPosition(preferSaved);
      });
    });
  }

  function saveChatPosition(chat) {
    const rect = chat.getBoundingClientRect();
    const maxX = Math.max(1, innerWidth - rect.width - CHAT_EDGE * 2);
    const maxY = Math.max(1, innerHeight - rect.height - CHAT_EDGE * 2);
    const positions = loadChatPositions();
    positions[chatMode()] = {
      x: clamp((rect.left - CHAT_EDGE) / maxX, 0, 1),
      y: clamp((rect.top - CHAT_EDGE) / maxY, 0, 1)
    };
    localStorage.setItem(CHAT_POSITION_KEY, JSON.stringify(positions));
    chat.dataset.userPosition = 'true';
  }

  function installChatDrag() {
    const chat = $('#onlineChat');
    const header = chat?.querySelector(':scope > header');
    if (!chat || !header || chat.dataset.dragReady === 'true') return;
    chat.dataset.dragReady = 'true';
    chat.classList.add('online-chat-draggable');
    header.title = 'Arraste esta barra para mover o chat';

    let drag = null;
    header.addEventListener('pointerdown', (event) => {
      if (event.pointerType === 'mouse' && event.button !== 0) return;
      if (event.target.closest('button,input,textarea,select,a,label')) return;
      const rect = chat.getBoundingClientRect();
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        left: rect.left,
        top: rect.top
      };
      chat.style.left = `${Math.round(rect.left)}px`;
      chat.style.top = `${Math.round(rect.top)}px`;
      chat.style.right = 'auto';
      chat.style.bottom = 'auto';
      chat.style.transform = 'none';
      chat.style.translate = 'none';
      chat.classList.add('chat-dragging');
      header.setPointerCapture?.(event.pointerId);
      event.preventDefault();
    });

    header.addEventListener('pointermove', (event) => {
      if (!drag || drag.pointerId !== event.pointerId) return;
      const rect = chat.getBoundingClientRect();
      const maxX = Math.max(CHAT_EDGE, innerWidth - rect.width - CHAT_EDGE);
      const maxY = Math.max(CHAT_EDGE, innerHeight - rect.height - CHAT_EDGE);
      const x = clamp(drag.left + event.clientX - drag.startX, CHAT_EDGE, maxX);
      const y = clamp(drag.top + event.clientY - drag.startY, CHAT_EDGE, maxY);
      chat.style.left = `${Math.round(x)}px`;
      chat.style.top = `${Math.round(y)}px`;
      event.preventDefault();
    });

    const finishDrag = (event) => {
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      try { header.releasePointerCapture?.(drag.pointerId); } catch (_) {}
      drag = null;
      chat.classList.remove('chat-dragging');
      saveChatPosition(chat);
    };
    header.addEventListener('pointerup', finishDrag);
    header.addEventListener('pointercancel', finishDrag);

    chatResizeObserver = new ResizeObserver(() => {
      if (chat.dataset.chatStateChanging !== 'true') queueChatPlacement();
    });
    chatResizeObserver.observe(chat);
    global.addEventListener('resize', () => queueChatPlacement());
    global.visualViewport?.addEventListener('resize', () => queueChatPlacement());
    queueChatPlacement();
  }

  function addLaunchers() {
    const utility = document.querySelector('.utility-stack');
    if (utility && !$('#chatBtn')) {
      const button = document.createElement('button');
      button.id = 'chatBtn';
      button.className = 'icon-btn online-chat-launcher';
      button.title = 'Chat mundial (Enter)';
      button.setAttribute('aria-label', 'Abrir chat mundial');
      button.textContent = '✦';
      button.addEventListener('click', () => openChat(true));
      utility.prepend(button);
    }

    const mobile = document.querySelector('#mobileControls .touch-actions');
    if (mobile && !$('#touchChat')) {
      const button = document.createElement('button');
      button.id = 'touchChat';
      button.className = 'touch-chat';
      button.innerHTML = '✦<small>Chat</small>';
      button.addEventListener('pointerdown', (event) => {
        event.preventDefault();
        openChat(true);
      });
      mobile.prepend(button);
    }
  }

  function keepGuestChatUsable(state) {
    const input = $('#onlineChatInput');
    const send = $('#onlineChatForm button[type="submit"]');
    if (!input || !send) return;

    const refresh = () => {
      const authenticated = !!state.session;
      const blocked = input.dataset.accountBlocked === 'true' || send.dataset.accountBlocked === 'true';
      if (!blocked) {
        if (input.disabled) input.disabled = false;
        if (send.disabled) send.disabled = false;
      }
      input.dataset.authenticated = authenticated ? 'true' : 'false';
      send.dataset.authenticated = authenticated ? 'true' : 'false';
      input.placeholder = authenticated
        ? 'Mensagem para o mundo...'
        : 'Digite sua mensagem — o login será solicitado ao enviar';
      input.setAttribute('aria-label', authenticated ? 'Mensagem do chat mundial' : 'Chat mundial; login necessário para enviar');
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(input, { attributes: true, attributeFilter: ['disabled', 'data-account-blocked'] });
    observer.observe(send, { attributes: true, attributeFilter: ['disabled', 'data-account-blocked'] });
    sessionTimer = setInterval(refresh, 700);
  }

  function installKeyboard(state) {
    global.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      const game = global.astraeon;
      const active = document.activeElement;
      if (active?.closest?.('#onlineChat')) return;
      if (active?.closest?.('#onlineAccountPanel,#npcDialogue')) return;
      if (!game?.running || game.paused) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      openChat(true);
      if (!state.session) {
        const status = $('#onlineChatStatus');
        if (status) status.textContent = 'login necessário para enviar';
      }
    }, true);
  }

  function installRightMouseGuard() {
    document.addEventListener('contextmenu', (event) => {
      event.preventDefault();
    }, true);

    document.addEventListener('auxclick', (event) => {
      if (event.button === 2) event.preventDefault();
    }, true);
  }

  function installSprintFix() {
    const game = global.astraeon;
    if (!game || game.sprintV42Fixed) return;
    game.sprintV42Fixed = true;

    const originalUpdate = game.update.bind(game);
    game.update = function (dt) {
      const p = this.player;
      if (!p) return originalUpdate(dt);

      const moving = this.keys?.has('w') || this.keys?.has('a') || this.keys?.has('s') || this.keys?.has('d') ||
        this.keys?.has('arrowup') || this.keys?.has('arrowdown') || this.keys?.has('arrowleft') || this.keys?.has('arrowright');
      const wantsSprint = !!(moving && this.keys?.has('shift') && Number(this.stamina) > .35);
      const baseSpeed = Math.max(0, Number(p.speed) || 0);
      const beforeX = p.x;
      const beforeY = p.y;

      originalUpdate(dt);

      if (!wantsSprint || !this.sprinting || !this.player || baseSpeed <= 0 || dt <= 0) return;
      const dx = this.player.x - beforeX;
      const dy = this.player.y - beforeY;
      const actualDistance = Math.hypot(dx, dy);
      if (actualDistance <= .001) return;

      const configured = Number(this.adminSprintMultiplier);
      const multiplier = Number.isFinite(configured)
        ? Math.max(MIN_SPRINT_MULTIPLIER, configured)
        : MIN_SPRINT_MULTIPLIER;
      const desiredDistance = baseSpeed * dt * multiplier;
      const missingDistance = desiredDistance - actualDistance;

      if (missingDistance > .05) {
        this.moveEntity(
          this.player,
          dx / actualDistance * missingDistance,
          dy / actualDistance * missingDistance,
          10
        );
      }
    };
  }

  function installPlayerFacingFix() {
    const game = global.astraeon;
    if (!game || game.playerFacingV42Fixed || typeof game.drawPlayer !== 'function') return;
    game.playerFacingV42Fixed = true;
    const originalDrawPlayer = game.drawPlayer.bind(game);
    game.drawPlayer = function (ctx) {
      const player = this.player;
      const facing = Number(player?.facing);
      if (!player || !Number.isFinite(facing) || facing === 0) return originalDrawPlayer(ctx);
      const storedFacing = player.facing;
      player.facing = -facing;
      try {
        return originalDrawPlayer(ctx);
      } finally {
        if (this.player === player) player.facing = storedFacing;
      }
    };
  }

  function installPlayerPanelToggle() {
    const card = $('.player-card');
    if (!card || card.dataset.collapseReady === 'true') return;
    card.dataset.collapseReady = 'true';

    const button = document.createElement('button');
    button.id = 'playerPanelToggle';
    button.className = 'player-panel-toggle';
    button.type = 'button';
    card.appendChild(button);

    const apply = (collapsed, persist = false) => {
      card.classList.toggle('player-panel-collapsed', collapsed);
      button.textContent = collapsed ? '›' : '‹';
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? 'Abrir informações do personagem' : 'Recolher informações do personagem');
      button.title = collapsed ? 'Abrir informações do personagem' : 'Recolher informações do personagem';
      if (persist) {
        try { localStorage.setItem(PLAYER_PANEL_STATE_KEY, collapsed ? '1' : '0'); } catch (_) {}
      }
    };

    let collapsed = false;
    try { collapsed = localStorage.getItem(PLAYER_PANEL_STATE_KEY) === '1'; } catch (_) {}
    apply(collapsed);

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      apply(!card.classList.contains('player-panel-collapsed'), true);
    });
  }

  function mobLevel(mob, data) {
    const explicit = Number(mob?.level);
    if (Number.isFinite(explicit) && explicit >= 1) return Math.max(1, Math.round(explicit));
    const baseHp = Math.max(1, Number(data?.hp) || 1);
    const scaledHp = Math.max(1, Number(mob?.maxHp) || baseHp);
    return Math.max(1, Math.round(1 + ((scaledHp / baseHp) - 1) / .08));
  }

  function installMobLabels() {
    const game = global.astraeon;
    const W = global.AstraeonWorld;
    if (!game || !W || game.mobLabelsV42Installed || typeof game.drawMobs !== 'function') return;
    game.mobLabelsV42Installed = true;

    const originalDrawMobs = game.drawMobs.bind(game);
    game.drawMobs = function (ctx) {
      originalDrawMobs(ctx);
      if (!this.player || !Array.isArray(this.mobs)) return;

      const visible = this.mobs.filter((mob) =>
        !mob.dead &&
        Math.abs(mob.x - this.player.x) < this.viewW * .8 + 400 &&
        Math.abs(mob.y - this.player.y) < this.viewH * .8 + 400
      );

      for (const mob of visible) {
        if (!(mob.aggro || mob.hit > 0 || mob.hp < mob.maxHp)) continue;
        const data = W.MOB_DATA[mob.type] || {};
        const name = MOB_DISPLAY_NAMES[mob.type] || data.name || String(mob.type || 'Criatura').replaceAll('_', ' ');
        const label = `${name} • Nv. ${mobLevel(mob, data)}`;

        ctx.save();
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.font = '700 9px Inter, sans-serif';
        ctx.lineWidth = 3;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = 'rgba(0,0,0,.82)';
        ctx.strokeText(label, mob.x, mob.y - 47);
        ctx.fillStyle = '#f3ead8';
        ctx.fillText(label, mob.x, mob.y - 47);
        ctx.restore();
      }
    };
  }

  function installGuestSubmitGuard(state) {
    const form = $('#onlineChatForm');
    if (!form) return;
    form.addEventListener('submit', (event) => {
      if (state.session && state.client) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      const input = $('#onlineChatInput');
      const text = input?.value.trim();
      if (!text) return;
      appendLocalSystem('Para enviar mensagens ao chat mundial, entre ou crie uma conta online.');
      openAccount('Faça login ou cadastre uma conta para enviar mensagens ao chat mundial.');
    }, true);
  }

  function install(mp) {
    if (installed || !mp?.state) return;
    installed = true;
    const state = mp.state;
    addLaunchers();
    keepGuestChatUsable(state);
    installKeyboard(state);
    installRightMouseGuard();
    installSprintFix();
    installPlayerFacingFix();
    installPlayerPanelToggle();
    installMobLabels();
    installGuestSubmitGuard(state);
    installChatDrag();
    document.body.classList.add('astraeon-online-controller-ready');
  }

  function waitForRuntime() {
    const started = Date.now();
    const tick = () => {
      const mp = global.AstraeonMultiplayerV4;
      if (mp?.state && $('#onlineChat')) {
        install(mp);
        return;
      }
      if (Date.now() - started < MAX_WAIT_MS) setTimeout(tick, 80);
      else console.warn('[Astraeon Online 4.2] Multiplayer runtime não ficou disponível para o controlador de chat.');
    };
    tick();
  }

  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', waitForRuntime);
  else waitForRuntime();

  global.addEventListener('beforeunload', () => {
    if (sessionTimer) clearInterval(sessionTimer);
    if (chatPlacementRaf) cancelAnimationFrame(chatPlacementRaf);
    chatResizeObserver?.disconnect();
    chatClassObserver?.disconnect();
  });

  global.AstraeonOnlineControllerV4 = { openChat };
})(window);

(function (global) {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const MAX_WAIT_MS = 15000;
  const MIN_SPRINT_MULTIPLIER = 1.70;
  let installed = false;
  let sessionTimer = null;

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
    const chat = $('#onlineChat');
    const input = $('#onlineChatInput');
    if (!chat || !input) return;
    chat.classList.remove('collapsed', 'collapsed-mobile');
    if (focus) {
      input.disabled = false;
      requestAnimationFrame(() => input.focus());
    }
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
    installGuestSubmitGuard(state);
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
  });

  global.AstraeonOnlineControllerV4 = { openChat };
})(window);

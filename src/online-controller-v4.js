(function (global) {
  'use strict';

  const $ = (s) => document.querySelector(s);
  const MAX_WAIT_MS = 15000;
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
      if (input.disabled) input.disabled = false;
      if (send.disabled) send.disabled = false;
      input.dataset.authenticated = authenticated ? 'true' : 'false';
      send.dataset.authenticated = authenticated ? 'true' : 'false';
      input.placeholder = authenticated
        ? 'Mensagem para o mundo...'
        : 'Digite sua mensagem — o login será solicitado ao enviar';
      input.setAttribute('aria-label', authenticated ? 'Mensagem do chat mundial' : 'Chat mundial; login necessário para enviar');
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(input, { attributes: true, attributeFilter: ['disabled'] });
    observer.observe(send, { attributes: true, attributeFilter: ['disabled'] });
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

  function addDiagnostics(state) {
    const card = document.querySelector('#onlineAccountPanel .online-account-card');
    if (!card || $('#onlineRuntimeHealth')) return;

    const health = document.createElement('section');
    health.id = 'onlineRuntimeHealth';
    health.className = 'online-runtime-health';
    health.innerHTML = `
      <header><b>Diagnóstico Online</b><button id="onlineHealthRefresh" type="button">Atualizar</button></header>
      <div class="online-health-grid">
        <span>Configuração <b data-health="config">verificando</b></span>
        <span>Autenticação <b data-health="auth">desconectado</b></span>
        <span>Realtime <b data-health="realtime">offline</b></span>
        <span>Banco <b data-health="database">Supabase</b></span>
      </div>
      <small>Banco: Supabase → Table Editor → <code>profiles</code>, <code>player_saves</code> e <code>chat_messages</code>. O esquema versionado está em <code>supabase/migrations/001_astraeon_online.sql</code>.</small>`;
    card.appendChild(health);

    function refresh() {
      const config = health.querySelector('[data-health="config"]');
      const auth = health.querySelector('[data-health="auth"]');
      const realtime = health.querySelector('[data-health="realtime"]');
      const database = health.querySelector('[data-health="database"]');
      const enabled = !!state.config?.enabled;
      if (config) {
        config.textContent = enabled ? 'ativa' : 'não configurada';
        config.dataset.state = enabled ? 'ok' : 'warn';
      }
      if (auth) {
        auth.textContent = state.session ? (state.profile?.username || 'conectado') : 'desconectado';
        auth.dataset.state = state.session ? 'ok' : 'warn';
      }
      if (realtime) {
        realtime.textContent = String(state.channelStatus || 'OFFLINE').toLowerCase();
        realtime.dataset.state = state.channelStatus === 'ONLINE' ? 'ok' : state.channelStatus === 'ERROR' ? 'error' : 'warn';
      }
      if (database) {
        database.textContent = enabled ? 'configurado via /api/config' : 'aguardando Vercel + Supabase';
        database.dataset.state = enabled ? 'ok' : 'warn';
      }
    }

    $('#onlineHealthRefresh')?.addEventListener('click', refresh);
    setInterval(refresh, 1000);
    refresh();
  }

  function install(mp) {
    if (installed || !mp?.state) return;
    installed = true;
    const state = mp.state;
    addLaunchers();
    keepGuestChatUsable(state);
    installKeyboard(state);
    installGuestSubmitGuard(state);
    addDiagnostics(state);
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
      else console.warn('[Astraeon Online 4.1] Multiplayer runtime não ficou disponível para o controlador de chat.');
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

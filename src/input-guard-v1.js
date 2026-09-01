(function (global) {
  'use strict';

  const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable="true"],#onlineAccountPanel,#npcDialogue';
  const UX_STYLE = 'src/online-ux-final-v1.css?v=1.0.0';
  const AUTH_RETRY_MS = 50;
  const $ = selector => document.querySelector(selector);
  let authRetryTimer = 0;

  function installCriticalBootGuard() {
    document.body?.classList.add('astraeon-auth-booting');
    if (document.querySelector('style[data-astraeon-auth-critical-v1]')) return;
    const style = document.createElement('style');
    style.dataset.astraeonAuthCriticalV1 = '1';
    style.textContent = 'body.astraeon-auth-booting #gameRoot,body.astraeon-login-required #gameRoot{visibility:hidden!important;pointer-events:none!important}body:not(.game-running) #hud{display:none!important}';
    document.head.appendChild(style);
  }

  function loadStyle(source, dataKey) {
    if (document.querySelector(`link[data-${dataKey}]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = source;
    link.setAttribute(`data-${dataKey}`, '1');
    document.head.appendChild(link);
  }

  function isEditable(target) {
    return !!target?.closest?.(EDITABLE_SELECTOR);
  }

  function isChatCollapsed(chat) {
    if (!chat) return true;
    if (chat.dataset.chatCollapsed === 'true') return true;
    if (chat.dataset.chatCollapsed === 'false') return false;
    return chat.classList.contains('collapsed') ||
      chat.classList.contains('collapsed-mobile') ||
      chat.classList.contains('chat-pro-collapsed');
  }

  function isChatEngaged() {
    const chat = $('#onlineChat');
    if (!chat) return false;
    const input = $('#onlineChatInput');
    const collapsed = isChatCollapsed(chat);
    if (!collapsed && document.activeElement?.closest?.('#onlineChat')) return true;
    if (String(input?.value || '').length > 0) return true;
    return !collapsed;
  }

  function blocksPanelHotkeys(event) {
    return isEditable(event?.target) || isEditable(document.activeElement) || isChatEngaged();
  }

  function rewriteHudTip() {
    const tip = $('.hud-tip');
    if (!tip) return;
    tip.textContent = String(tip.textContent || '')
      .replace(/\s*·\s*ESC\s+pausar/ig, '')
      .replace(/ESC\s+pausar/ig, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function lockPauseRuntime() {
    const game = global.astraeon;
    if (!game || game.onlineNoPauseV1Installed || typeof game.togglePause !== 'function') return false;
    game.onlineNoPauseV1Installed = true;
    const originalTogglePause = game.togglePause.bind(game);
    game.togglePause = function (force) {
      if (this.running) {
        this.paused = false;
        this.ui?.pauseScreen?.classList.add('hidden');
        return false;
      }
      return originalTogglePause(force);
    };
    return true;
  }

  function blockOnlineEscapePause(event) {
    if (String(event?.key || '').toLowerCase() !== 'escape') return;
    const game = global.astraeon;
    if (!game?.running) return;
    if (isEditable(event.target) || isEditable(document.activeElement) || isChatEngaged()) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    game.keys?.delete?.('escape');
    game.paused = false;
    game.ui?.pauseScreen?.classList.add('hidden');
  }

  function syncOnlineLoginGate() {
    clearTimeout(authRetryTimer);
    const body = document.body;
    const mp = global.AstraeonMultiplayerV4?.state;
    const panel = $('#onlineAccountPanel');
    if (!body || !mp || !panel || mp.config === null) {
      authRetryTimer = global.setTimeout(syncOnlineLoginGate, AUTH_RETRY_MS);
      return;
    }

    if (mp.session) {
      body.classList.remove('astraeon-auth-booting', 'astraeon-login-required');
      body.classList.add('astraeon-session-ready');
      panel.classList.add('hidden');
      return;
    }

    if (mp.config?.enabled && mp.channelStatus === 'CONNECTING') {
      authRetryTimer = global.setTimeout(syncOnlineLoginGate, AUTH_RETRY_MS);
      return;
    }

    body.classList.remove('astraeon-auth-booting', 'astraeon-session-ready');
    if (mp.config?.enabled) {
      body.classList.add('astraeon-login-required');
      panel.classList.remove('hidden');
    } else {
      body.classList.remove('astraeon-login-required');
    }

    authRetryTimer = global.setTimeout(syncOnlineLoginGate, 180);
  }

  function loadRuntime({ globalName, source, dataKey }) {
    if (global[globalName]) return;
    if (typeof document.createElement !== 'function' || !document.head?.appendChild) return;
    if (document.querySelector?.(`script[data-${dataKey}]`)) return;
    const script = document.createElement('script');
    script.src = source;
    script.async = false;
    script.setAttribute(`data-${dataKey}`, '1');
    document.head.appendChild(script);
  }

  function loadSafetyRuntimes() {
    loadStyle(UX_STYLE, 'astraeon-online-ux-final-v1');
    loadRuntime({
      globalName: 'AstraeonCombatUxGuardV1',
      source: 'src/combat-ux-guard-v1.js?v=1.0.0',
      dataKey: 'astraeon-combat-ux-guard-v1'
    });
    loadRuntime({
      globalName: 'AstraeonDeathPenaltyV1',
      source: 'src/death-penalty-v1.js?v=1.0.0',
      dataKey: 'astraeon-death-penalty-v1'
    });
    loadRuntime({
      globalName: 'AstraeonMenuBootGuardV1',
      source: 'src/menu-boot-guard-v1.js?v=1.0.0',
      dataKey: 'astraeon-menu-boot-guard-v1'
    });
    rewriteHudTip();
    lockPauseRuntime();
    syncOnlineLoginGate();
  }

  installCriticalBootGuard();
  loadStyle(UX_STYLE, 'astraeon-online-ux-final-v1');
  global.addEventListener('keydown', blockOnlineEscapePause, true);

  global.AstraeonInputGuardV1 = Object.freeze({
    isEditable,
    isChatCollapsed,
    isChatEngaged,
    blocksPanelHotkeys,
    blockOnlineEscapePause,
    lockPauseRuntime,
    syncOnlineLoginGate
  });

  if (document.readyState === 'loading' && typeof global.addEventListener === 'function') {
    global.addEventListener('DOMContentLoaded', loadSafetyRuntimes, { once: true });
  } else loadSafetyRuntimes();

  const runtimeRetry = global.setInterval(() => {
    rewriteHudTip();
    if (lockPauseRuntime()) global.clearInterval(runtimeRetry);
  }, 80);
})(window);

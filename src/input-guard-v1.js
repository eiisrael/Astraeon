(function (global) {
  'use strict';

  const EDITABLE_SELECTOR = 'input,textarea,select,[contenteditable="true"],#onlineAccountPanel,#npcDialogue';
  const $ = selector => document.querySelector(selector);

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

  function loadCombatUxGuard() {
    if (global.AstraeonCombatUxGuardV1) return;
    if (typeof document.createElement !== 'function' || !document.head?.appendChild) return;
    if (document.querySelector?.('script[data-astraeon-combat-ux-guard-v1]')) return;
    const script = document.createElement('script');
    script.src = 'src/combat-ux-guard-v1.js?v=1.0.0';
    script.async = false;
    script.dataset.astraeonCombatUxGuardV1 = '1';
    document.head.appendChild(script);
  }

  global.AstraeonInputGuardV1 = Object.freeze({
    isEditable,
    isChatCollapsed,
    isChatEngaged,
    blocksPanelHotkeys
  });

  if (document.readyState === 'loading' && typeof global.addEventListener === 'function') {
    global.addEventListener('DOMContentLoaded', loadCombatUxGuard, { once: true });
  } else loadCombatUxGuard();
})(window);

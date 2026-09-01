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
  }

  global.AstraeonInputGuardV1 = Object.freeze({
    isEditable,
    isChatCollapsed,
    isChatEngaged,
    blocksPanelHotkeys
  });

  if (document.readyState === 'loading' && typeof global.addEventListener === 'function') {
    global.addEventListener('DOMContentLoaded', loadSafetyRuntimes, { once: true });
  } else loadSafetyRuntimes();
})(window);

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

  global.AstraeonInputGuardV1 = Object.freeze({
    isEditable,
    isChatCollapsed,
    isChatEngaged,
    blocksPanelHotkeys
  });
})(window);

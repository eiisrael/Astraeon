(function (global) {
  'use strict';

  const RETRY_MS = 50;
  let retryTimer = 0;
  let ready = false;

  function modernMenuReady() {
    const body = document.body;
    const newButton = document.querySelector?.('#newGameBtn');
    if (!body || !newButton) return false;
    return body.classList.contains('astraeon-menu-v62') &&
      !!document.querySelector?.('#cinematicWorldStage') &&
      !!document.querySelector?.('#chooseCharacterBtn') &&
      !!document.querySelector?.('#accountInfoStartBtn') &&
      String(newButton.textContent || '').includes('Criar Personagem');
  }

  function check() {
    if (ready) return true;
    if (modernMenuReady()) {
      ready = true;
      clearTimeout(retryTimer);
      retryTimer = 0;
      document.body?.classList.add('astraeon-main-menu-ready');
      return true;
    }
    clearTimeout(retryTimer);
    retryTimer = global.setTimeout(check, RETRY_MS);
    return false;
  }

  global.AstraeonMenuBootGuardV1 = Object.freeze({
    RETRY_MS,
    modernMenuReady,
    check,
    get ready() { return ready; }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', check, { once: true });
  } else check();
})(window);

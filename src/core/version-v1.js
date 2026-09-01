(function (global) {
  'use strict';
  const VERSION = Object.freeze({
    game: '4.4.0',
    admin: '6.4.0',
    security: '8.0.0',
    protocol: '1.0.0',
    database: 23,
    authority: '1.0.0'
  });
  const labels = Object.freeze({
    game: `ASTRAEON ONLINE ${VERSION.game}`,
    admin: `ASTRAEON · ADMIN STUDIO ${VERSION.admin}`
  });

  function apply() {
    document.documentElement.dataset.astraeonVersion = VERSION.game;
    const title = document.title;
    if (/ASTRAEON ONLINE/i.test(title)) {
      document.title = title.replace(/ASTRAEON ONLINE(?:\s+\d+(?:\.\d+)*)?/i, labels.game);
    }
    document.querySelectorAll('.world-status .chip, #startScreen .eyebrow').forEach(node => {
      if (/ASTRAEON ONLINE\s+\d/i.test(node.textContent || '')) {
        node.textContent = (node.textContent || '').replace(/ASTRAEON ONLINE\s+\d+(?:\.\d+)*/i, labels.game);
      }
    });
    const meta = document.querySelector('meta[name="astraeon-version"]') || document.createElement('meta');
    meta.name = 'astraeon-version';
    meta.content = VERSION.game;
    if (!meta.parentNode) document.head.appendChild(meta);
  }

  global.AstraeonVersionV1 = { ...VERSION, labels, apply };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply, { once: true });
  else apply();
})(window);

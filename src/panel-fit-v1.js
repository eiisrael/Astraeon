(function (global) {
  'use strict';

  const MIN_SCALE = .32;
  const MAX_SCALE = 1.15;
  const VIEWPORT_GAP = 20;
  const PANEL_DEFINITIONS = [
    ['.overlay-panel', ':scope > .overlay-card'],
    ['.skills-player-panel', ':scope > .skills-player-card'],
    ['.skills-merchant-panel', ':scope > .skills-master-workspace'],
    ['.npc-dialogue', ':scope > .npc-dialogue-card']
  ];
  let frame = 0;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function calculateScale(width, height, availableWidth, availableHeight, preferred = 1) {
    const values = [width, height, availableWidth, availableHeight, preferred].map(Number);
    if (values.some(value => !Number.isFinite(value) || value <= 0)) return 1;
    return clamp(Math.min(values[4], values[2] / values[0], values[3] / values[1]), MIN_SCALE, MAX_SCALE);
  }

  function preferredScale() {
    const cssValue = global.getComputedStyle?.(document.documentElement).getPropertyValue('--ui-scale');
    const parsed = Number.parseFloat(cssValue);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  }

  function isVisible(host) {
    if (!host || host.classList.contains('hidden')) return false;
    const style = global.getComputedStyle?.(host);
    return !style || (style.display !== 'none' && style.visibility !== 'hidden');
  }

  function fit(host, target) {
    if (!isVisible(host) || !target) return null;
    host.classList.add('panel-fit-host');
    target.classList.add('panel-fit-surface');
    target.style.setProperty('--panel-fit-scale', '1');
    target.style.setProperty('max-height', 'none', 'important');
    target.style.setProperty('overflow', 'hidden', 'important');

    const width = Math.max(1, target.offsetWidth, target.scrollWidth);
    const height = Math.max(1, target.offsetHeight, target.scrollHeight);
    const safeWidth = Math.max(1, global.innerWidth - VIEWPORT_GAP * 2);
    const safeHeight = Math.max(1, global.innerHeight - VIEWPORT_GAP * 2);
    const scale = calculateScale(width, height, safeWidth, safeHeight, preferredScale());
    target.style.setProperty('--panel-fit-scale', scale.toFixed(4));
    host.dataset.panelFitScale = scale.toFixed(4);
    host.dataset.panelFitSize = `${Math.round(width)}x${Math.round(height)}`;
    return scale;
  }

  function fitAll() {
    for (const [hostSelector, targetSelector] of PANEL_DEFINITIONS) {
      for (const host of document.querySelectorAll(hostSelector)) fit(host, host.querySelector(targetSelector));
    }
  }

  function schedule() {
    global.cancelAnimationFrame?.(frame);
    frame = global.requestAnimationFrame?.(() => {
      fitAll();
      frame = global.requestAnimationFrame?.(fitAll) || 0;
    }) || 0;
  }

  function install() {
    if (document.documentElement.dataset.panelFitV1 === '1') return;
    document.documentElement.dataset.panelFitV1 = '1';
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    global.addEventListener('resize', schedule, { passive: true });
    global.addEventListener('orientationchange', schedule, { passive: true });
    document.addEventListener('input', event => {
      if (event.target?.id === 'uiScaleRange') schedule();
    });
    document.addEventListener('change', schedule);
    schedule();
  }

  global.AstraeonPanelFitV1 = { calculateScale, fit, fitAll, install, schedule };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install, { once: true });
  else install();
})(window);

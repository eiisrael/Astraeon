(function () {
  'use strict';

  const STORAGE = 'astraeon:v3a:settings';
  const defaults = { uiScale:100, weather:true, damage:true, minimap:true, compact:false, touch:false };

  function installChatEnterBridge() {
    if (window.__astraeonChatEnterV7) return;
    window.__astraeonChatEnterV7 = true;
    window.addEventListener('keydown', event => {
      if (event.key !== 'Enter' || event.repeat) return;
      const active = document.activeElement;
      if (active?.closest?.('#onlineChat')) return;
      if (active?.closest?.('input,textarea,select,[contenteditable="true"],#onlineAccountPanel,#npcDialogue')) return;
      const game = window.astraeon;
      if (!game?.running || game.paused) return;
      const open = () => {
        const chat = document.getElementById('onlineChat');
        const input = document.getElementById('onlineChatInput');
        if (!chat) return false;
        try { window.AstraeonOnlineControllerV4?.openChat?.(true); } catch (_) {}
        chat.classList.remove('collapsed','collapsed-mobile','chat-pro-collapsed');
        chat.dataset.chatCollapsed = 'false';
        const toggle = document.getElementById('onlineChatToggle');
        if (toggle) { toggle.textContent = '▾'; toggle.setAttribute('aria-expanded','true'); }
        if (input && input.dataset.accountBlocked !== 'true') { input.disabled = false; requestAnimationFrame(() => input.focus({preventScroll:true})); }
        return true;
      };
      if (!open()) {
        let tries = 0;
        const retry = () => { if (open() || ++tries >= 20) return; setTimeout(retry,75); };
        retry();
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    }, true);
  }
  installChatEnterBridge();

  function ensureV3CAssets() {
    if (!document.querySelector('link[data-astraeon-typography-v3c]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'src/typography-v3c.css'; link.dataset.astraeonTypographyV3c = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-astraeon-production-v6]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'src/production-v6.css'; link.dataset.astraeonProductionV6 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('link[data-astraeon-gameplay-polish-v7]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = 'src/gameplay-polish-v7.css'; link.dataset.astraeonGameplayPolishV7 = '1';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-astraeon-admin-runtime-v3c]')) {
      const script = document.createElement('script');
      script.src = 'src/admin-runtime-v3c.js'; script.dataset.astraeonAdminRuntimeV3c = '1';
      script.addEventListener('load',()=>window.AstraeonAdminRuntime?.install?.());
      document.head.appendChild(script);
    }
    for (const [src,key] of [['src/gameplay-polish-v7.js','gameplayPolishV7'],['src/production-runtime-v6.js','productionRuntimeV6'],['src/character-system-v6.js','characterSystemV6'],['src/worldmaps-runtime-v61.js','worldMapsRuntimeV61'],['src/server-config-v62.js','serverConfigV62'],['src/menu-cinematic-v62.js','menuCinematicV62']]) {
      if (document.querySelector(`script[data-${key}]`)) continue;
      const script=document.createElement('script');script.src=src;script.async=false;script.dataset[key]='1';document.head.appendChild(script);
    }
  }
  ensureV3CAssets();

  function loadSettings() {
    try { return {...defaults,...JSON.parse(localStorage.getItem(STORAGE)||'{}')}; }
    catch (_) { return {...defaults}; }
  }
  function saveSettings(settings) {
    try { localStorage.setItem(STORAGE,JSON.stringify(settings)); } catch (_) {}
  }

  function install() {
    const game = window.astraeon;
    if (!game || game.uiV30AInstalled) return;
    game.uiV30AInstalled = true;
    const settings = loadSettings();
    game.settingsV3 = settings;

    const panel = document.querySelector('#settingsPanel');
    const scale = document.querySelector('#uiScaleRange');
    const scaleValue = document.querySelector('#uiScaleValue');
    const weather = document.querySelector('#weatherToggle');
    const damage = document.querySelector('#damageToggle');
    const minimap = document.querySelector('#minimapToggle');
    const compact = document.querySelector('#compactToggle');
    const touch = document.querySelector('#touchToggle');

    function apply() {
      document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale / 100));
      document.body.classList.toggle('hide-minimap', !settings.minimap);
      document.body.classList.toggle('compact-ui', !!settings.compact);
      document.body.classList.toggle('touch-forced', !!settings.touch);
      if (scale) scale.value = settings.uiScale;
      if (scaleValue) scaleValue.textContent = `${settings.uiScale}%`;
      if (weather) weather.checked = settings.weather;
      if (damage) damage.checked = settings.damage;
      if (minimap) minimap.checked = settings.minimap;
      if (compact) compact.checked = settings.compact;
      if (touch) touch.checked = settings.touch;
      saveSettings(settings);
    }

    function openSettings() { panel?.classList.remove('hidden'); apply(); }
    document.querySelector('#settingsBtn')?.addEventListener('click', openSettings);
    document.querySelector('#settingsStartBtn')?.addEventListener('click', openSettings);
    document.querySelector('#settingsPauseBtn')?.addEventListener('click', openSettings);

    scale?.addEventListener('input', e => { settings.uiScale = Number(e.target.value)||100; apply(); });
    weather?.addEventListener('change', e => { settings.weather = e.target.checked; apply(); });
    damage?.addEventListener('change', e => { settings.damage = e.target.checked; apply(); });
    minimap?.addEventListener('change', e => { settings.minimap = e.target.checked; apply(); });
    compact?.addEventListener('change', e => { settings.compact = e.target.checked; apply(); });
    touch?.addEventListener('change', e => { settings.touch = e.target.checked; apply(); });

    document.querySelector('#resetSettingsBtn')?.addEventListener('click', () => {
      Object.assign(settings,defaults); apply(); game.toast?.('Configurações restauradas.');
    });
    document.querySelector('#fullscreenBtn')?.addEventListener('click', async () => {
      try {
        if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
        else await document.exitFullscreen();
      } catch (_) { game.toast?.('Tela cheia indisponível neste navegador.'); }
    });

    const originalDrawWeather = game.drawWeather?.bind(game);
    if (originalDrawWeather) game.drawWeather = function (ctx) {
      if (this.settingsV3?.weather !== false) originalDrawWeather(ctx);
    };
    const originalFloatText = game.floatText?.bind(game);
    if (originalFloatText) game.floatText = function (...args) {
      if (this.settingsV3?.damage !== false) originalFloatText(...args);
    };

    const tabs = Array.from(document.querySelectorAll('[data-inv-tab]'));
    const panels = Array.from(document.querySelectorAll('[data-inv-panel]'));
    function setInventoryTab(name) {
      tabs.forEach(btn => btn.classList.toggle('active',btn.dataset.invTab===name));
      panels.forEach(p => p.classList.toggle('mobile-active',p.dataset.invPanel===name));
    }
    tabs.forEach(btn => btn.addEventListener('click',()=>setInventoryTab(btn.dataset.invTab)));
    setInventoryTab('equipment');

    const inventoryPanel = document.querySelector('#inventoryPanel');
    const observer = new MutationObserver(() => {
      if (inventoryPanel && !inventoryPanel.classList.contains('hidden') && innerWidth <= 760) {
        setInventoryTab(tabs.find(x=>x.classList.contains('active'))?.dataset.invTab || 'equipment');
      }
    });
    if (inventoryPanel) observer.observe(inventoryPanel,{attributes:true,attributeFilter:['class']});

    const held = new Set();
    function holdKey(key,on) {
      if (!key) return;
      if (on) { held.add(key); game.keys?.add(key); }
      else { held.delete(key); game.keys?.delete(key); }
    }
    document.querySelectorAll('#mobileControls [data-key]').forEach(btn => {
      const key = btn.dataset.key;
      const down = e => { e.preventDefault(); holdKey(key,true); btn.classList.add('pressed'); };
      const up = e => { e.preventDefault(); holdKey(key,false); btn.classList.remove('pressed'); };
      btn.addEventListener('pointerdown',down,{passive:false});
      btn.addEventListener('pointerup',up,{passive:false});
      btn.addEventListener('pointercancel',up,{passive:false});
      btn.addEventListener('pointerleave',e=>{if(e.buttons)up(e);},{passive:false});
    });
    window.addEventListener('blur',()=>{held.forEach(k=>game.keys?.delete(k));held.clear();});

    document.querySelector('#touchAttack')?.addEventListener('pointerdown',e=>{e.preventDefault();game.basicAttack?.();});
    document.querySelector('#touchInventory')?.addEventListener('pointerdown',e=>{e.preventDefault();game.togglePanel?.(game.ui.inventoryPanel);});
    document.querySelectorAll('#mobileControls [data-skill]').forEach(btn=>btn.addEventListener('pointerdown',e=>{
      e.preventDefault(); game.castSkill?.(Number(btn.dataset.skill));
    }));

    const originalStartNew = game.startNew.bind(game);
    const originalContinue = game.continueGame.bind(game);
    game.startNew = function () { originalStartNew(); document.body.classList.add('game-running'); window.AstraeonAdminRuntime?.install?.(); };
    game.continueGame = function () { originalContinue(); if(this.running) document.body.classList.add('game-running'); window.AstraeonAdminRuntime?.install?.(); };

    window.addEventListener('resize',()=> {
      if (innerWidth > 760) panels.forEach(p=>p.classList.remove('mobile-active'));
      else setInventoryTab(tabs.find(x=>x.classList.contains('active'))?.dataset.invTab || 'equipment');
    });

    apply();
  }

  window.addEventListener('DOMContentLoaded',install);
})();

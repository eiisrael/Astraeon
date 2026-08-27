(function (global) {
  'use strict';
  // Diagnóstico profissional do Editor, mundo e infraestrutura online.

  let installed = false;
  const $ = (s) => document.querySelector(s);

  function patchTitles() {
    const button = $('#adminOpenBtn');
    if (button) {
      button.textContent = 'Admin Studio';
      button.title = 'Abrir painel administrativo (F10)';
    }
    const panel = $('#adminPanel');
    if (!panel) return;
    panel.classList.add('admin-studio-v4');
    const title = panel.querySelector('.admin-head-copy b');
    const subtitle = panel.querySelector('.admin-head-copy small');
    if (title) title.textContent = 'ASTRAEON · ADMIN STUDIO 4.1';
    if (subtitle) subtitle.textContent = 'Balanceamento, personagem, mundo, dados locais e diagnóstico da infraestrutura online.';
    const brand = document.querySelector('.brand small');
    if (brand) brand.textContent = 'Admin Studio 4.1 · World & Balance';
    document.title = 'ASTRAEON — Admin Studio 4.1';
  }

  async function getOnlineStatus() {
    try {
      const response = await fetch('/api/config', { cache: 'no-store', headers: { Accept: 'application/json' } });
      if (!response.ok) return { enabled: false, reason: `HTTP ${response.status}` };
      const config = await response.json();
      return {
        enabled: !!config?.enabled,
        project: config?.supabaseUrl ? new URL(config.supabaseUrl).hostname : null,
        topic: config?.realtimeTopic || null
      };
    } catch (_) {
      return { enabled: false, reason: 'Executando fora do Vercel ou /api/config indisponível' };
    }
  }

  function worldStats() {
    const W = global.AstraeonWorld;
    const editor = global.astraeonEditor;
    const design = W?.loadWorldDesign?.() || editor?.design || {};
    return {
      seed: design.seed || '—',
      overrides: Object.keys(design.overrides || {}).length,
      spawns: Array.isArray(design.spawns) ? design.spawns.length : 0
    };
  }

  async function decorateDashboard() {
    const content = $('#adminContent');
    const page = content?.querySelector('.admin-page.active');
    if (!page || !page.querySelector('.admin-page-head')) return;
    const heading = page.querySelector('.admin-page-head h3')?.textContent || '';
    if (!heading.toLocaleLowerCase('pt-BR').includes('visão geral') && !heading.toLocaleLowerCase('pt-BR').includes('visao geral')) return;
    if (page.querySelector('.studio-dashboard-addon')) return;

    const world = worldStats();
    const online = await getOnlineStatus();
    if (!page.isConnected || page.querySelector('.studio-dashboard-addon')) return;

    const addon = document.createElement('div');
    addon.className = 'studio-dashboard-addon';
    addon.innerHTML = `
      <section class="studio-diagnostic-card" data-state="ok">
        <span>Mundo</span><b>${escapeHtml(world.seed)}</b><small>${world.overrides} tiles editados · ${world.spawns} spawns manuais</small>
      </section>
      <section class="studio-diagnostic-card" data-state="${online.enabled ? 'ok' : 'warn'}">
        <span>Infraestrutura online</span><b>${online.enabled ? 'Supabase configurado' : 'Modo local / não configurado'}</b><small>${escapeHtml(online.project || online.reason || 'Configure Vercel + Supabase')}</small>
      </section>
      <section class="studio-diagnostic-card" data-state="ok">
        <span>Banco de jogadores</span><b>profiles · player_saves · chat_messages</b><small>Schema: supabase/migrations/001_astraeon_online.sql</small>
      </section>`;
    page.insertBefore(addon, page.querySelector('.admin-grid') || page.children[1]);
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function bindEditorStateMirror() {
    const saveState = $('#saveState');
    const mirror = $('#studioDirtyState');
    if (!saveState || !mirror) return;
    const sync = () => {
      mirror.textContent = saveState.textContent || 'Pronto';
      const dirty = /não salvas|nao salvas/i.test(saveState.textContent || '');
      mirror.style.color = dirty ? '#e7bd6e' : '#82c79a';
    };
    new MutationObserver(sync).observe(saveState, { childList: true, characterData: true, subtree: true });
    sync();
  }

  function install() {
    if (installed) return;
    const panel = $('#adminPanel');
    const editor = global.astraeonEditor;
    if (!panel || !editor) {
      setTimeout(install, 80);
      return;
    }
    installed = true;
    patchTitles();
    bindEditorStateMirror();

    const content = $('#adminContent');
    if (content) {
      const observer = new MutationObserver(() => {
        patchTitles();
        void decorateDashboard();
      });
      observer.observe(content, { childList: true, subtree: true });
    }

    $('#adminOpenBtn')?.addEventListener('click', () => setTimeout(() => void decorateDashboard(), 0));
    global.addEventListener('keydown', (event) => {
      if (event.key === 'F10') setTimeout(() => void decorateDashboard(), 0);
    });
    void decorateDashboard();
  }

  if (document.readyState === 'loading') global.addEventListener('DOMContentLoaded', install);
  else install();
})(window);

(function(global){
'use strict';
let installed=false;
const $=s=>document.querySelector(s);

function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));}

function patchTitles(){
  const panel=$('#adminPanel');
  const hiddenButton=$('#adminOpenBtn');
  if(hiddenButton){hiddenButton.textContent='Admin Studio';hiddenButton.title='Abrir Central Administrativa (F10)';}
  if(panel){
    panel.classList.remove('admin-studio-v4');panel.classList.add('admin-studio-v5');
    const title=panel.querySelector('.admin-head-copy b'),subtitle=panel.querySelector('.admin-head-copy small');
    if(title)title.textContent='ASTRAEON · ADMIN STUDIO 5.0';
    if(subtitle)subtitle.textContent='Central administrativa: balanceamento, jogadores, mensagens, mundo e publicação.';
  }
  const brand=document.querySelector('.studio-brand small');if(brand)brand.textContent='Admin Studio 5.0 · World Production';
  document.title='ASTRAEON — Admin Studio 5.0';
}

async function getOnlineStatus(){
  try{
    const response=await fetch('/api/config',{cache:'no-store',headers:{Accept:'application/json'}});
    if(!response.ok)return{enabled:false,reason:`HTTP ${response.status}`};
    const config=await response.json();
    return{enabled:!!config?.enabled,project:config?.supabaseUrl?new URL(config.supabaseUrl).hostname:null,topic:config?.realtimeTopic||null};
  }catch(_){return{enabled:false,reason:'API local indisponível'};}
}

function worldStats(){
  const editor=global.astraeonEditor,W=global.AstraeonWorld,design=editor?.design||W?.loadWorldDesign?.()||{};
  const validation=editor?.validateDesign?.()||{errors:[],warnings:[]};
  return{
    seed:design.seed||'—',overrides:Object.keys(design.overrides||{}).length,spawns:Array.isArray(design.spawns)?design.spawns.length:0,
    errors:validation.errors?.length||0,warnings:validation.warnings?.length||0,exportLinked:!!editor?.exportFileHandle,autoExport:editor?.autoExport!==false
  };
}

async function decorateDashboard(){
  const content=$('#adminContent'),page=content?.querySelector('.admin-page.active');if(!page||!page.querySelector('.admin-page-head'))return;
  const heading=(page.querySelector('.admin-page-head h3')?.textContent||'').toLocaleLowerCase('pt-BR');
  if(!heading.includes('visão geral')&&!heading.includes('visao geral'))return;
  page.querySelector('.studio-dashboard-addon')?.remove();page.querySelector('.studio-dashboard-actions')?.remove();
  const world=worldStats(),online=await getOnlineStatus();if(!page.isConnected)return;
  const validationState=world.errors?'error':world.warnings?'warn':'ok';
  const addon=document.createElement('div');addon.className='studio-dashboard-addon';addon.innerHTML=`
    <section class="studio-diagnostic-card" data-state="ok"><span>Mundo</span><b>${escapeHtml(world.seed)}</b><small>${world.overrides} overrides · ${world.spawns} spawns</small></section>
    <section class="studio-diagnostic-card" data-state="${validationState}"><span>Validação</span><b>${world.errors?`${world.errors} erro(s)`:world.warnings?`${world.warnings} aviso(s)`:'Mapa saudável'}</b><small>Seed, coordenadas, mobs, colisões e overrides</small></section>
    <section class="studio-diagnostic-card" data-state="${world.autoExport?'ok':'warn'}"><span>Publicação</span><b>${world.exportLinked?'Arquivo vinculado':world.autoExport?'Download no salvar':'Exportação manual'}</b><small>${world.autoExport?'Autoexport ativo':'Autoexport desativado'}</small></section>
    <section class="studio-diagnostic-card" data-state="${online.enabled?'ok':'warn'}"><span>Infraestrutura</span><b>${online.enabled?'Supabase conectado':'Modo local'}</b><small>${escapeHtml(online.project||online.reason||'Configure Vercel + Supabase')}</small></section>`;
  page.insertBefore(addon,page.querySelector('.admin-grid')||page.children[1]);

  const actions=document.createElement('div');actions.className='studio-dashboard-actions';actions.innerHTML='<button data-studio-action="validate" class="admin-btn">Validar mapa</button><button data-studio-action="save" class="admin-btn primary">Salvar + exportar</button><button data-studio-action="focus" class="admin-btn">Voltar ao Editor</button><button data-studio-action="play" class="admin-btn success">▶ Testar jogo</button>';
  actions.addEventListener('click',async event=>{
    const action=event.target.closest('[data-studio-action]')?.dataset.studioAction,editor=global.astraeonEditor;if(!action||!editor)return;
    if(action==='validate'){editor.validateAndRender?.(true);void decorateDashboard();}
    if(action==='save'){await editor.save?.({exportFile:true});void decorateDashboard();}
    if(action==='focus'){$('#adminPanel')?.classList.add('hidden');$('#studioAdminLauncher')?.classList.remove('active');}
    if(action==='play'){await editor.save?.({exportFile:true,quiet:true});location.href='index.html';}
  });
  addon.after(actions);
}

function bindEditorStateMirror(){
  const saveState=$('#saveState'),mirror=$('#studioDirtyState');if(!saveState||!mirror)return;
  const sync=()=>{mirror.textContent=saveState.textContent||'Pronto';mirror.dataset.state=/erro/i.test(saveState.textContent||'')?'error':/pendente/i.test(saveState.textContent||'')?'warn':'ok';};
  new MutationObserver(sync).observe(saveState,{childList:true,characterData:true,subtree:true});sync();
}

function bindLauncher(){
  const launcher=$('#studioAdminLauncher'),hidden=$('#adminOpenBtn'),panel=$('#adminPanel');if(!launcher||!hidden||!panel)return;
  launcher.onclick=()=>{hidden.click();launcher.classList.add('active');setTimeout(()=>void decorateDashboard(),0);};
  $('#adminClose')?.addEventListener('click',()=>launcher.classList.remove('active'));
  global.addEventListener('keydown',event=>{
    if(event.key==='F10'){event.preventDefault();if(panel.classList.contains('hidden'))launcher.click();else{$('#adminClose')?.click();launcher.classList.remove('active');}}
    if(event.key==='Escape'&&!panel.classList.contains('hidden')){$('#adminClose')?.click();launcher.classList.remove('active');}
  },true);
}

function install(){
  if(installed)return;const panel=$('#adminPanel'),editor=global.astraeonEditor;if(!panel||!editor){setTimeout(install,80);return;}
  installed=true;patchTitles();bindEditorStateMirror();bindLauncher();
  const content=$('#adminContent');if(content)new MutationObserver(()=>{patchTitles();void decorateDashboard();}).observe(content,{childList:true,subtree:true});
  $('#adminOpenBtn')?.addEventListener('click',()=>setTimeout(()=>void decorateDashboard(),0));
  void decorateDashboard();
  global.dispatchEvent(new CustomEvent('astraeon:studio-ready',{detail:{version:'5.0'}}));
}

if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',install);else install();
global.AstraeonAdminStudioV5={install,decorateDashboard};
})(window);
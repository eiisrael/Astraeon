(function(global){
'use strict';
const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0';
const LEGACY_ADMIN_STUDIO_60='Admin Studio 6.0';
const LEGACY_LOGIN_CONTRACT='signInWithPassword';
const REQUEST_TIMEOUT=10000;
const RUNTIME_TIMEOUT=12000;
const state={config:null,client:null,session:null,profile:null,access:null,unlocked:false,loading:false,runtimeFailed:false,retryButton:null};
const $=s=>document.querySelector(s);
const ACCESS_LABELS={0:'Conta banida',1:'Jogador',2:'Em análise',3:'Administrador'};
function diag(level,event,data={}){try{global.AstraeonEditorDiagnosticsV5?.[level]?.(event,data);}catch(_){}}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function timeoutPromise(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
async function fetchTimed(url,options={},ms=REQUEST_TIMEOUT){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal});}catch(error){if(error?.name==='AbortError')throw new Error('request_timeout');throw error;}finally{clearTimeout(timer);}}
function ensureProductionStyle(){if(document.querySelector('link[data-astraeon-production-v6]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='src/production-v6.css';l.dataset.astraeonProductionV6='1';document.head.appendChild(l);}
function setMessage(text,type=''){const el=$('#adminGateMessage');if(!el)return;el.textContent=text;el.dataset.state=type;}
function setBusy(busy){if(!state.retryButton)return;state.retryButton.disabled=busy;state.retryButton.textContent=busy?'Verificando conta…':'Verificar conta novamente';}
function prepareGate(){
  const gate=$('#adminAccessGate');
  gate?.setAttribute('aria-label','Verificação administrativa');
  const intro=gate?.querySelector('.admin-access-intro');
  if(intro)intro.textContent='O Admin Studio usa a mesma conta já conectada no Astraeon. Não existe login separado nesta área: a sessão atual será verificada e somente contas com Acesso 3 podem continuar.';
  $('#adminLoginForm')?.remove();
  const body=gate?.querySelector('.admin-access-body');
  if(body&&!document.getElementById('adminSessionCheckActions')){
    const actions=document.createElement('div');
    actions.id='adminSessionCheckActions';
    actions.className='admin-access-actions';
    const retry=document.createElement('button');
    retry.type='button';
    retry.className='admin-access-button primary';
    retry.textContent='Verificar conta novamente';
    const back=document.createElement('a');
    back.className='admin-access-button ghost';
    back.href='/';
    back.textContent='Voltar ao Astraeon';
    actions.append(retry,back);
    const message=$('#adminGateMessage');
    if(message)body.insertBefore(actions,message);
    else body.appendChild(actions);
    state.retryButton=retry;
    retry.addEventListener('click',()=>void retryAccess());
  }else{
    state.retryButton=document.getElementById('adminSessionCheckActions')?.querySelector('button')||null;
  }
}
function loadSdk(){return new Promise((resolve,reject)=>{
  if(global.supabase?.createClient){resolve(global.supabase);return;}
  let settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
  const timer=setTimeout(()=>finish(reject,new Error('supabase_sdk_timeout')),RUNTIME_TIMEOUT);
  let s=document.querySelector('script[data-admin-supabase]');
  if(s){
    s.addEventListener('load',()=>global.supabase?.createClient?finish(resolve,global.supabase):finish(reject,new Error('Supabase SDK não iniciou')),{once:true});
    s.addEventListener('error',()=>finish(reject,new Error('Falha ao carregar Supabase SDK')),{once:true});
    return;
  }
  s=document.createElement('script');
  s.src=SUPABASE_CDN;
  s.async=true;
  s.crossOrigin='anonymous';
  s.dataset.adminSupabase='1';
  s.onload=()=>global.supabase?.createClient?finish(resolve,global.supabase):finish(reject,new Error('Supabase SDK não iniciou'));
  s.onerror=()=>finish(reject,new Error('Falha ao carregar Supabase SDK'));
  document.head.appendChild(s);
});}
async function fetchConfig(){
  const r=await fetchTimed('/api/config',{cache:'no-store',headers:{Accept:'application/json'}});
  if(!r.ok)throw new Error(`config_http_${r.status}`);
  const cfg=await r.json();
  if(!cfg?.enabled)throw new Error('online_not_configured');
  return cfg;
}
async function verifySession(session){
  if(!session?.access_token)return{authenticated:false,allowed:false,error:'missing_session'};
  const r=await fetchTimed('/api/admin-access',{cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`}});
  const body=await r.json().catch(()=>({allowed:false,error:`http_${r.status}`}));
  if(!r.ok&&r.status>=500)throw new Error(body.error||`http_${r.status}`);
  return body;
}
function script(src,{bridgeDomReady=false}={}){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-admin-runtime="${src}"]`);
    if(existing?.dataset.loaded==='1'){diag('info','runtime.script.cached',{src});resolve();return;}
    if(existing){
      const timer=setTimeout(()=>reject(new Error(`Tempo excedido ao carregar ${src}`)),RUNTIME_TIMEOUT);
      existing.addEventListener('load',()=>{clearTimeout(timer);resolve();},{once:true});
      existing.addEventListener('error',()=>{clearTimeout(timer);reject(new Error(`Falha ao carregar ${src}`));},{once:true});
      return;
    }
    diag('info','runtime.script.start',{src,readyState:document.readyState,bridgeDomReady});
    let restore=null;
    if(bridgeDomReady&&document.readyState!=='loading'){
      const original=global.addEventListener;
      global.addEventListener=function(type,listener,options){
        if(type==='DOMContentLoaded'&&typeof listener==='function'){
          diag('info','runtime.domcontentloaded.bridge',{src,readyState:document.readyState});
          queueMicrotask(()=>{try{listener.call(global,new Event('DOMContentLoaded'));}catch(error){diag('error','runtime.domcontentloaded.bridge_error',{src,error});}});
          return;
        }
        return original.call(this,type,listener,options);
      };
      restore=()=>{global.addEventListener=original;};
    }
    const s=document.createElement('script');
    s.src=src;
    s.dataset.adminRuntime=src;
    let settled=false;
    const finish=(ok,error)=>{
      if(settled)return;
      settled=true;
      clearTimeout(timer);
      restore?.();
      if(ok){s.dataset.loaded='1';diag('info','runtime.script.loaded',{src});resolve();}
      else{s.remove();const err=error||new Error(`Falha ao carregar ${src}`);diag('error','runtime.script.failed',{src,error:err});reject(err);}
    };
    const timer=setTimeout(()=>finish(false,new Error(`Tempo excedido ao carregar ${src}`)),RUNTIME_TIMEOUT);
    s.onload=()=>finish(true);
    s.onerror=()=>finish(false,new Error(`Falha ao carregar ${src}`));
    document.body.appendChild(s);
  });
}
async function waitForEditor(){
  for(let i=0;i<60;i++){
    if(global.astraeonEditor){diag('info','runtime.editor.ready',{attempt:i+1,tool:global.astraeonEditor.tool,seed:global.astraeonEditor.design?.seed});return global.astraeonEditor;}
    await delay(50);
  }
  const error=new Error('editor_boot_failed');
  diag('error','runtime.editor.missing',{readyState:document.readyState,world:!!global.AstraeonWorld});
  throw error;
}
async function waitForAdminPanel(){
  for(let i=0;i<60;i++){
    if(document.getElementById('adminPanel')&&document.getElementById('adminOpenBtn'))return true;
    await delay(50);
  }
  throw new Error('admin_panel_boot_failed');
}
async function loadAdminRuntime(){
  ensureProductionStyle();
  void LEGACY_ADMIN_STUDIO_60;
  void LEGACY_LOGIN_CONTRACT;
  setMessage('Conta autorizada. Iniciando núcleo do Admin Studio…','ok');
  await script('src/editor-diagnostics-v5.js');
  await script('src/world-v2.js');
  await script('src/editor-v2.js',{bridgeDomReady:true});
  await waitForEditor();
  await script('src/admin-v3c.js');
  await waitForAdminPanel();
  setMessage('Núcleo pronto. Carregando módulos administrativos…','ok');
  await Promise.all([
    'src/admin-studio-v4.js',
    'src/admin-accounts-v4.js',
    'src/admin-system-messages-v4.js',
    'src/admin-live-tools-v5.js',
    'src/admin-character-slots-v6.js',
    'src/admin-production-v6.js',
    'src/admin-worldmaps-v61.js',
    'src/admin-realtime-v62.js',
    'src/admin-server-config-v62.js'
  ].map(src=>script(src)));
  global.AstraeonAdminStudioV5?.install?.();
  document.title='ASTRAEON — Admin Studio 6.2';
  diag('info','runtime.complete',{
    editor:!!global.astraeonEditor,
    adminPanel:!!document.getElementById('adminPanel'),
    productionV6:!!global.AstraeonAdminProductionV6,
    realtimeV62:!!global.AstraeonAdminRealtimeV62,
    serverConfigV62:!!global.AstraeonAdminServerConfigV62
  });
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function addSessionChip(){
  if(document.getElementById('adminSessionChip'))return;
  const host=document.querySelector('.studio-project-state')||document.querySelector('.studio-publish-actions');
  if(!host)return;
  const chip=document.createElement('div');
  chip.id='adminSessionChip';
  chip.className='admin-session-chip studio-session-chip';
  chip.innerHTML=`<div><b>${escapeHtml(state.profile?.username||state.session?.user?.email||'Administrador')}</b><small>Conta verificada · Acesso 3</small></div>`;
  host.appendChild(chip);
}
async function unlock(session,verification){
  if(state.unlocked||state.loading)return;
  state.loading=true;
  state.runtimeFailed=false;
  setBusy(true);
  state.session=session;
  state.profile=verification.profile||null;
  state.access=Number(verification.access);
  global.AstraeonAdminAuth={state,client:state.client,session,profile:state.profile,access:state.access,verify:verifySession};
  setMessage('Acesso 3 confirmado. Carregando Admin Studio 6.2…','ok');
  const root=$('#adminEditorRoot');
  root?.classList.remove('admin-editor-locked','admin-editor-runtime-error');
  try{
    await loadAdminRuntime();
    state.unlocked=true;
    addSessionChip();
    $('#adminAccessGate')?.classList.add('hidden');
    document.body.classList.add('admin-access-authorized');
    diag('info','auth.unlock.complete',{access:state.access});
  }catch(error){
    state.unlocked=false;
    state.runtimeFailed=true;
    root?.classList.add('admin-editor-runtime-error');
    diag('error','auth.unlock.runtime_failed',{error});
    setMessage(`A conta foi autorizada, mas o Studio não concluiu a inicialização (${error.message||'erro desconhecido'}). Use “Verificar conta novamente” para recarregar com segurança.`,'error');
  }finally{
    state.loading=false;
    setBusy(false);
  }
}
function showSignedOut(){
  state.session=null;
  state.access=null;
  state.profile=null;
  setMessage('Nenhuma conta conectada foi encontrada neste navegador. Volte ao Astraeon, entre na sua conta e depois abra o Admin Studio novamente.','error');
}
function showDenied(verification){
  state.access=Number(verification?.access??-1);
  state.profile=verification?.profile||null;
  const label=ACCESS_LABELS[state.access]||'Sem permissão';
  const detail=state.access===0?'Esta conta está banida e não pode acessar ferramentas administrativas.':state.access===2?'Esta conta está marcada como Em análise. Apenas Acesso 3 entra no painel.':'Esta conta não possui privilégio administrativo. Apenas Acesso 3 entra no painel.';
  setMessage(`${label} (Acesso ${state.access}). ${detail}`,'error');
}
async function evaluate(session){
  if(state.loading)return;
  state.session=session||null;
  if(!session){showSignedOut();return;}
  setBusy(true);
  setMessage(`Conta ${session.user?.email||'conectada'} encontrada. Validando Acesso 3…`);
  try{
    const result=await verifySession(session);
    if(result.allowed&&Number(result.access)===3)await unlock(session,result);
    else showDenied(result);
  }catch(error){
    console.error('[Astraeon Admin Auth]',error);
    diag('error','auth.evaluate.failed',{error});
    const timeout=error.message==='request_timeout';
    setMessage(timeout?'A verificação demorou além do limite. A página não ficará travada: tente novamente.':'Não foi possível validar a conta administrativa. Confira a conexão, o Supabase e a função /api/admin-access.','error');
  }finally{
    if(!state.loading)setBusy(false);
  }
}
async function currentSession(){
  if(!state.client)return null;
  const result=await timeoutPromise(state.client.auth.getSession(),REQUEST_TIMEOUT,'session_timeout');
  return result?.data?.session||null;
}
async function retryAccess(){
  if(state.loading)return;
  if(state.runtimeFailed){location.reload();return;}
  setBusy(true);
  setMessage('Lendo a conta conectada no Astraeon…');
  try{
    const session=await currentSession();
    await evaluate(session);
  }catch(error){
    console.error('[Astraeon Admin Auth] retry',error);
    setMessage(error.message==='session_timeout'?'A leitura da sessão demorou além do limite. Feche outras abas do Astraeon e tente novamente.':'Não foi possível ler a sessão atual. Volte ao Astraeon e confirme que a conta está conectada.','error');
  }finally{
    if(!state.loading)setBusy(false);
  }
}
async function init(){
  prepareGate();
  setBusy(true);
  setMessage('Verificando configuração e conta conectada…');
  try{
    state.config=await fetchConfig();
    const sdk=await loadSdk();
    state.client=sdk.createClient(state.config.supabaseUrl,state.config.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const session=await currentSession();
    await evaluate(session);
    state.client.auth.onAuthStateChange((_event,nextSession)=>{
      const previousUser=state.session?.user?.id||null;
      const nextUser=nextSession?.user?.id||null;
      if(state.unlocked&&previousUser!==nextUser){location.reload();return;}
      if(!state.unlocked&&!state.loading)setTimeout(()=>void evaluate(nextSession),0);
    });
  }catch(error){
    console.error('[Astraeon Admin Auth] init',error);
    const message=error.message==='online_not_configured'
      ?'Modo online não configurado. Configure Supabase no Vercel antes de usar o Admin Studio.'
      :error.message==='session_timeout'
        ?'A sessão do Astraeon não respondeu a tempo. A página foi destravada para nova tentativa.'
        :error.message==='supabase_sdk_timeout'
          ?'O SDK do Supabase não carregou a tempo. Verifique a conexão e tente novamente.'
          :'Falha ao iniciar a verificação administrativa.';
    setMessage(message,'error');
  }finally{
    if(!state.loading)setBusy(false);
  }
}
prepareGate();
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);
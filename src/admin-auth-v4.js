(function(global){
'use strict';
const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0';
const LEGACY_ADMIN_STUDIO_60='Admin Studio 6.0';
const LEGACY_LOGIN_CONTRACT='signInWithPassword';
const LEGACY_ACCESS_CONTRACT='Acesso 3';
const REQUEST_TIMEOUT=10000;
const RUNTIME_TIMEOUT=10000;
const state={config:null,client:null,session:null,profile:null,access:null,unlocked:false,loading:false,runtimeFailed:false,retryButton:null,secondaryFailures:[]};
const $=s=>document.querySelector(s);
const SECONDARY_MODULES=[
  'src/admin-studio-v4.js',
  'src/admin-accounts-v4.js',
  'src/admin-system-messages-v4.js',
  'src/admin-live-tools-v5.js',
  'src/admin-character-slots-v6.js',
  'src/admin-production-v6.js',
  'src/admin-worldmaps-v61.js',
  'src/admin-realtime-v62.js',
  'src/admin-server-config-v62.js'
];
function diag(level,event,data={}){try{global.AstraeonEditorDiagnosticsV5?.[level]?.(event,data);}catch(_){}}
function delay(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function timeoutPromise(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
async function fetchTimed(url,options={},ms=REQUEST_TIMEOUT){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),ms);try{return await fetch(url,{...options,signal:controller.signal});}catch(error){if(error?.name==='AbortError')throw new Error('request_timeout');throw error;}finally{clearTimeout(timer);}}
function ensureProductionStyle(){if(document.querySelector('link[data-astraeon-production-v6]'))return;const l=document.createElement('link');l.rel='stylesheet';l.href='src/production-v6.css';l.dataset.astraeonProductionV6='1';document.head.appendChild(l);}
function setMessage(text,type=''){
  const el=$('#adminGateMessage');
  if(el){el.textContent=text;el.dataset.state=type;}
  if(state.retryButton){state.retryButton.classList.toggle('hidden',type!=='error');state.retryButton.disabled=false;}
}
function setBusy(busy){
  if(!state.retryButton)return;
  state.retryButton.disabled=busy;
  if(busy)state.retryButton.classList.add('hidden');
}
function prepareGate(){
  const gate=$('#adminAccessGate');
  gate?.setAttribute('aria-label','Verificação de acesso');
  const brandKicker=gate?.querySelector('.admin-access-brand span');
  if(brandKicker)brandKicker.textContent='Área protegida';
  gate?.querySelector('.admin-access-brand small')?.remove();
  gate?.querySelector('.admin-access-intro')?.remove();
  gate?.querySelector('.admin-access-legend')?.remove();
  $('#adminLoginForm')?.remove();
  const body=gate?.querySelector('.admin-access-body');
  if(body&&!document.getElementById('adminSessionRetry')){
    const retry=document.createElement('button');
    retry.id='adminSessionRetry';
    retry.type='button';
    retry.className='admin-access-button primary hidden';
    retry.textContent='Tentar novamente';
    body.appendChild(retry);
    state.retryButton=retry;
    retry.addEventListener('click',()=>void retryAccess());
  }else state.retryButton=$('#adminSessionRetry');
  setMessage('Verificando acesso…');
}
function loadSdk(){return new Promise((resolve,reject)=>{
  if(global.supabase?.createClient){resolve(global.supabase);return;}
  let settled=false;
  const finish=(fn,value)=>{if(settled)return;settled=true;clearTimeout(timer);fn(value);};
  const timer=setTimeout(()=>finish(reject,new Error('supabase_sdk_timeout')),RUNTIME_TIMEOUT);
  let s=document.querySelector('script[data-admin-supabase]');
  if(s){
    s.addEventListener('load',()=>global.supabase?.createClient?finish(resolve,global.supabase):finish(reject,new Error('supabase_sdk_failed')),{once:true});
    s.addEventListener('error',()=>finish(reject,new Error('supabase_sdk_failed')),{once:true});
    return;
  }
  s=document.createElement('script');
  s.src=SUPABASE_CDN;
  s.async=true;
  s.crossOrigin='anonymous';
  s.dataset.adminSupabase='1';
  s.onload=()=>global.supabase?.createClient?finish(resolve,global.supabase):finish(reject,new Error('supabase_sdk_failed'));
  s.onerror=()=>finish(reject,new Error('supabase_sdk_failed'));
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
  if(!session?.access_token)return{authenticated:false,allowed:false,error:'access_denied'};
  const r=await fetchTimed('/api/admin-access',{cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`}});
  const body=await r.json().catch(()=>({allowed:false,error:'access_denied'}));
  if(!r.ok&&r.status>=500)throw new Error(body.error||`http_${r.status}`);
  return body;
}
function script(src,{bridgeDomReady=false}={}){
  return new Promise((resolve,reject)=>{
    const existing=document.querySelector(`script[data-admin-runtime="${src}"]`);
    if(existing?.dataset.loaded==='1'){resolve();return;}
    if(existing){
      const timer=setTimeout(()=>reject(new Error(`runtime_timeout:${src}`)),RUNTIME_TIMEOUT);
      existing.addEventListener('load',()=>{clearTimeout(timer);existing.dataset.loaded='1';resolve();},{once:true});
      existing.addEventListener('error',()=>{clearTimeout(timer);reject(new Error(`runtime_failed:${src}`));},{once:true});
      return;
    }
    diag('info','runtime.script.start',{src});
    let restore=null;
    if(bridgeDomReady&&document.readyState!=='loading'){
      const original=global.addEventListener;
      global.addEventListener=function(type,listener,options){
        if(type==='DOMContentLoaded'&&typeof listener==='function'){
          queueMicrotask(()=>{try{listener.call(global,new Event('DOMContentLoaded'));}catch(error){diag('error','runtime.domcontentloaded.bridge_error',{src});}});
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
      else{s.remove();diag('error','runtime.script.failed',{src});reject(error||new Error(`runtime_failed:${src}`));}
    };
    const timer=setTimeout(()=>finish(false,new Error(`runtime_timeout:${src}`)),RUNTIME_TIMEOUT);
    s.onload=()=>finish(true);
    s.onerror=()=>finish(false,new Error(`runtime_failed:${src}`));
    document.body.appendChild(s);
  });
}
async function waitForEditor(){
  for(let i=0;i<80;i++){
    if(global.astraeonEditor)return global.astraeonEditor;
    await delay(40);
  }
  throw new Error('editor_boot_failed');
}
async function waitForAdminPanel(){
  for(let i=0;i<80;i++){
    if(document.getElementById('adminPanel')&&document.getElementById('adminOpenBtn'))return true;
    await delay(40);
  }
  throw new Error('admin_panel_boot_failed');
}
function ensureAdminLauncherFallback(){
  const launcher=$('#studioAdminLauncher'),hidden=$('#adminOpenBtn');
  if(!launcher||!hidden||launcher.dataset.coreFallback==='1')return;
  launcher.dataset.coreFallback='1';
  launcher.addEventListener('click',()=>{hidden.click();launcher.classList.add('active');});
}
async function loadCoreRuntime(){
  ensureProductionStyle();
  void LEGACY_ADMIN_STUDIO_60;
  void LEGACY_LOGIN_CONTRACT;
  void LEGACY_ACCESS_CONTRACT;
  await script('src/editor-diagnostics-v5.js');
  await script('src/world-v2.js');
  await script('src/editor-v2.js',{bridgeDomReady:true});
  await waitForEditor();
  await script('src/admin-v3c.js');
  await waitForAdminPanel();
  ensureAdminLauncherFallback();
  document.title='ASTRAEON — Admin Studio 6.2';
}
async function loadSecondaryModules(){
  state.secondaryFailures=[];
  for(const src of SECONDARY_MODULES){
    try{await script(src);}
    catch(error){state.secondaryFailures.push(src);console.warn('[Astraeon Admin] módulo secundário indisponível:',src);diag('warn','runtime.secondary.failed',{src});}
  }
  try{global.AstraeonAdminStudioV5?.install?.();}catch(_){ }
  diag('info','runtime.secondary.complete',{failed:state.secondaryFailures.length});
  global.dispatchEvent(new CustomEvent('astraeon:admin-secondary-ready',{detail:{failed:state.secondaryFailures.length}}));
}
async function unlock(session){
  if(state.unlocked||state.loading)return;
  state.loading=true;
  state.runtimeFailed=false;
  setBusy(true);
  state.session=session;
  state.profile=null;
  state.access=3;
  global.AstraeonAdminAuth={state,client:state.client,session,profile:null,access:3,verify:verifySession};
  const root=$('#adminEditorRoot');
  root?.classList.remove('admin-editor-locked','admin-editor-runtime-error');
  setMessage('Verificação concluída. Abrindo Admin Studio…','ok');
  try{
    await loadCoreRuntime();
    state.unlocked=true;
    $('#adminAccessGate')?.classList.add('hidden');
    document.body.classList.add('admin-access-authorized');
    diag('info','auth.unlock.complete',{});
    void loadSecondaryModules();
  }catch(error){
    state.unlocked=false;
    state.runtimeFailed=true;
    root?.classList.add('admin-editor-runtime-error');
    diag('error','auth.unlock.runtime_failed',{});
    setMessage('Não foi possível abrir o Admin Studio. Tente novamente.','error');
  }finally{
    state.loading=false;
    setBusy(false);
  }
}
function showDenied(){
  state.session=null;
  state.profile=null;
  state.access=null;
  setMessage('Acesso não autorizado.','error');
}
async function evaluate(session){
  if(state.loading)return;
  state.session=session||null;
  if(!session){showDenied();return;}
  setBusy(true);
  setMessage('Verificando acesso…');
  try{
    const result=await verifySession(session);
    if(result?.allowed===true)await unlock(session);
    else showDenied();
  }catch(error){
    console.error('[Astraeon Admin Auth] verificação indisponível');
    diag('error','auth.evaluate.failed',{});
    setMessage('Não foi possível verificar o acesso. Tente novamente.','error');
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
  setMessage('Verificando acesso…');
  try{await evaluate(await currentSession());}
  catch(error){setMessage('Não foi possível verificar o acesso. Tente novamente.','error');}
  finally{if(!state.loading)setBusy(false);}
}
async function init(){
  prepareGate();
  setBusy(true);
  setMessage('Verificando acesso…');
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
    console.error('[Astraeon Admin Auth] inicialização indisponível');
    setMessage('Não foi possível verificar o acesso. Tente novamente.','error');
  }finally{
    if(!state.loading)setBusy(false);
  }
}
prepareGate();
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',init,{once:true});else init();
})(window);

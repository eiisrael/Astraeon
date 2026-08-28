(function(global){
'use strict';
const SUPABASE_CDN='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.91.0';
const state={config:null,client:null,session:null,profile:null,access:null,unlocked:false};
const $=s=>document.querySelector(s);
const ACCESS_LABELS={0:'Conta banida',1:'Jogador',2:'Em análise',3:'Administrador'};

function setMessage(text,type=''){
  const el=$('#adminGateMessage');if(!el)return;
  el.textContent=text;el.dataset.state=type;
}
function setBusy(busy){const btn=$('#adminLoginSubmit');if(btn){btn.disabled=busy;btn.textContent=busy?'Verificando…':'Entrar no Admin Studio';}}
function loadSdk(){return new Promise((resolve,reject)=>{if(global.supabase?.createClient){resolve(global.supabase);return;}let s=document.querySelector('script[data-admin-supabase]');if(s){s.addEventListener('load',()=>resolve(global.supabase),{once:true});s.addEventListener('error',reject,{once:true});return;}s=document.createElement('script');s.src=SUPABASE_CDN;s.async=true;s.crossOrigin='anonymous';s.dataset.adminSupabase='1';s.onload=()=>global.supabase?.createClient?resolve(global.supabase):reject(new Error('Supabase SDK não iniciou'));s.onerror=reject;document.head.appendChild(s);});}
async function fetchConfig(){const r=await fetch('/api/config',{cache:'no-store',headers:{Accept:'application/json'}});if(!r.ok)throw new Error(`config_http_${r.status}`);const cfg=await r.json();if(!cfg?.enabled)throw new Error('online_not_configured');return cfg;}
async function verifySession(session){
  if(!session?.access_token)return {authenticated:false,allowed:false,error:'missing_session'};
  const r=await fetch('/api/admin-access',{cache:'no-store',headers:{Accept:'application/json',Authorization:`Bearer ${session.access_token}`}});
  const body=await r.json().catch(()=>({allowed:false,error:`http_${r.status}`}));
  if(!r.ok&&r.status>=500)throw new Error(body.error||`http_${r.status}`);
  return body;
}
function script(src){return new Promise((resolve,reject)=>{if(document.querySelector(`script[data-admin-runtime="${src}"]`)){resolve();return;}const s=document.createElement('script');s.src=src;s.dataset.adminRuntime=src;s.onload=resolve;s.onerror=()=>reject(new Error(`Falha ao carregar ${src}`));document.body.appendChild(s);});}
async function loadAdminRuntime(){
  for(const src of ['src/world-v2.js','src/editor-v2.js','src/admin-v3c.js','src/admin-studio-v4.js','src/admin-accounts-v4.js','src/admin-system-messages-v4.js'])await script(src);
}
function addSessionChip(){
  if(document.getElementById('adminSessionChip'))return;
  const actions=document.querySelector('.studio-publish-actions');if(!actions)return;
  const chip=document.createElement('div');chip.id='adminSessionChip';chip.className='admin-session-chip';chip.innerHTML=`<div><b>${escapeHtml(state.profile?.username||'Administrador')}</b><small>Acesso 3 · sessão protegida</small></div><button type="button" title="Encerrar sessão Admin">Sair</button>`;
  chip.querySelector('button').addEventListener('click',logout);
  actions.prepend(chip);
}
function escapeHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
async function unlock(session,verification){
  if(state.unlocked)return;
  state.session=session;state.profile=verification.profile||null;state.access=Number(verification.access);state.unlocked=true;
  global.AstraeonAdminAuth={state,client:state.client,session,profile:state.profile,access:state.access,verify:verifySession};
  setMessage('Acesso administrativo confirmado. Carregando ferramentas…','ok');
  const root=$('#adminEditorRoot');root?.classList.remove('admin-editor-locked');
  await loadAdminRuntime();
  addSessionChip();
  $('#adminAccessGate')?.classList.add('hidden');
  document.body.classList.add('admin-access-authorized');
}
function showDenied(verification){
  state.access=Number(verification?.access??-1);state.profile=verification?.profile||null;
  const label=ACCESS_LABELS[state.access]||'Sem permissão';
  const detail=state.access===0?'Esta conta está banida e não pode acessar ferramentas administrativas.':state.access===2?'Esta conta está marcada como Em análise. Apenas Acesso 3 entra no painel.':'Esta conta não possui privilégio administrativo. Apenas Acesso 3 entra no painel.';
  setMessage(`${label} (Acesso ${state.access}). ${detail}`,'error');
  $('#adminGateLogout')?.classList.remove('hidden');
}
async function evaluate(session){
  state.session=session||null;
  if(!session){setMessage('Entre com uma conta que possua Acesso 3 no Supabase.');$('#adminGateLogout')?.classList.add('hidden');return;}
  setMessage('Validando sessão e nível de acesso…');
  try{const result=await verifySession(session);if(result.allowed&&Number(result.access)===3)await unlock(session,result);else showDenied(result);}catch(error){console.error('[Astraeon Admin Auth]',error);setMessage('Não foi possível validar o acesso administrativo. Confira /api/admin-access e a migration 002.','error');}
}
async function login(event){
  event.preventDefault();if(!state.client)return;
  const email=$('#adminLoginEmail').value.trim(),password=$('#adminLoginPassword').value;
  setBusy(true);setMessage('Autenticando…');
  try{const {data,error}=await state.client.auth.signInWithPassword({email,password});if(error){setMessage('Login recusado. Confira e-mail, senha e confirmação da conta.','error');return;}await evaluate(data.session);}finally{setBusy(false);}
}
async function logout(){try{await state.client?.auth.signOut();}finally{location.reload();}}
async function init(){
  $('#adminLoginForm')?.addEventListener('submit',login);
  $('#adminGateLogout')?.addEventListener('click',logout);
  try{
    state.config=await fetchConfig();
    const sdk=await loadSdk();
    state.client=sdk.createClient(state.config.supabaseUrl,state.config.supabaseKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
    const {data}=await state.client.auth.getSession();
    await evaluate(data.session);
    state.client.auth.onAuthStateChange((_event,session)=>{if(!state.unlocked)setTimeout(()=>evaluate(session),0);});
  }catch(error){console.error('[Astraeon Admin Auth] init',error);setMessage(error.message==='online_not_configured'?'Modo online não configurado. Configure Supabase no Vercel antes de usar o Admin Studio.':'Falha ao iniciar autenticação administrativa.','error');}
}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',init);else init();
})(window);

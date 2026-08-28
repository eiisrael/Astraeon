(function(global){
'use strict';
const PENDING_KEY='astraeon:v4:pending-confirmation';
const SHOWN_KEY='astraeon:v4:confirmation-shown';
const ACCESS_LABELS={0:'Banido',1:'Jogador',2:'Em análise',3:'Admin'};
const ACCESS_CLASS={0:'danger',1:'player',2:'review',3:'admin'};
let installed=false;
let accessTimer=null;
const $=s=>document.querySelector(s);

function safeEmail(value){return String(value||'').trim().toLowerCase().slice(0,160);}
function pendingEmail(){try{return safeEmail(localStorage.getItem(PENDING_KEY));}catch(_){return '';}}
function rememberPending(){
  const form=$('#onlineRegisterForm');
  if(!form||form.dataset.confirmationHook==='1')return;
  form.dataset.confirmationHook='1';
  form.addEventListener('submit',()=>{
    const email=safeEmail($('#onlineRegisterEmail')?.value);
    if(email)try{localStorage.setItem(PENDING_KEY,email);sessionStorage.removeItem(SHOWN_KEY);}catch(_){}
  },true);
}
function ensureAccessBadge(){
  const profile=$('#onlineAuthMember .online-profile-card');
  if(!profile||$('#onlineAccessBadge'))return;
  const badge=document.createElement('span');
  badge.id='onlineAccessBadge';
  badge.className='online-access-badge player';
  badge.textContent='Acesso 1 · Jogador';
  profile.appendChild(badge);
}
function setAccessBadge(access){
  ensureAccessBadge();
  const badge=$('#onlineAccessBadge');
  if(!badge)return;
  const value=Number.isInteger(Number(access))?Number(access):1;
  badge.className=`online-access-badge ${ACCESS_CLASS[value]||'player'}`;
  badge.textContent=`Acesso ${value} · ${ACCESS_LABELS[value]||'Jogador'}`;
}
function showConfirmationSuccess(state){
  if(!state?.session?.user?.email_confirmed_at)return;
  const pending=pendingEmail();
  if(!pending||pending!==safeEmail(state.session.user.email))return;
  try{if(sessionStorage.getItem(SHOWN_KEY)==='1')return;}catch(_){}
  const panel=$('#onlineAccountPanel');
  const msg=$('#onlineAuthMessage');
  panel?.classList.remove('hidden');
  if(msg){msg.textContent='Conta confirmada com sucesso. Seja bem-vindo!';msg.dataset.type='ok';}
  global.astraeon?.toast?.('Conta confirmada com sucesso. Seja bem-vindo!');
  try{sessionStorage.setItem(SHOWN_KEY,'1');localStorage.removeItem(PENDING_KEY);}catch(_){}
}
async function syncAccess(mp){
  const state=mp?.state;
  if(!state?.client||!state.session?.user)return;
  const {data,error}=await state.client.from('profiles').select('access').eq('id',state.session.user.id).maybeSingle();
  if(error||!data)return;
  const access=Number(data.access??1);
  if(state.profile)state.profile.access=access;
  setAccessBadge(access);
  showConfirmationSuccess(state);
  if(access===0){
    mp.disconnectWorld?.();
    if(state.ui?.chatInput)state.ui.chatInput.disabled=true;
    if(state.ui?.chatSend)state.ui.chatSend.disabled=true;
    const push=$('#onlineCloudPush'),pull=$('#onlineCloudPull');
    if(push)push.disabled=true;if(pull)pull.disabled=true;
    const msg=$('#onlineAuthMessage');
    if(msg){msg.textContent='Esta conta está banida (Acesso 0). Recursos online foram bloqueados.';msg.dataset.type='error';}
  }
}
function install(mp){
  if(installed||!mp?.state)return;
  installed=true;
  rememberPending();
  ensureAccessBadge();
  const state=mp.state;
  const tick=()=>{rememberPending();void syncAccess(mp);};
  tick();
  accessTimer=setInterval(tick,1600);
  global.addEventListener('beforeunload',()=>{if(accessTimer)clearInterval(accessTimer);},{once:true});
}
function wait(){
  const mp=global.AstraeonMultiplayerV4;
  if(mp?.state&&$('#onlineAccountPanel')){install(mp);return;}
  setTimeout(wait,100);
}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',wait);else wait();
global.AstraeonAccountStatusV4={install};
})(window);

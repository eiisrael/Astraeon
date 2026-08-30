(function(global){
'use strict';
const CHAT_LIMIT=64;
const BUBBLE_MS=1500;
const EMPTY_IDLE_MS=5000;
const SYSTEM_REFRESH_MS=60000;
const SYSTEM_TICK_MS=1000;
const CONNECT_NOTICE='Você entrou no mundo online de Astra.';
const STAMINA_MAX_FALLBACK=100;
const STAMINA_DRAIN_FALLBACK=24;
const STAMINA_REGEN_FALLBACK=19;
const STAMINA_DELAY_FALLBACK=.65;
const MIN_SPRINT_MULTIPLIER=1.70;
let installed=false;
let mpState=null;
let rowsObserver=null;
let schedulerRefreshTimer=null;
let schedulerTickTimer=null;
let sprintKeyDown=false;
let managedJoinShown=false;
let emptyIdleTimer=null;
const profileCache=new Map();
const schedules=new Map();
const ownBubble={text:'',until:0};
const $=s=>document.querySelector(s);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function textOfRow(row){return row?.querySelector(':scope > span')?.textContent?.trim()||'';}
function appendSystemRow(text,id=`sys-local-${Date.now()}-${Math.random()}`){
  const box=$('#onlineChatMessages');
  if(!box||!text)return;
  if(mpState?.messageIds?.has?.(String(id)))return;
  mpState?.messageIds?.add?.(String(id));
  const row=document.createElement('div');row.className='online-chat-line system';row.dataset.localSystem='1';
  const head=document.createElement('div'),name=document.createElement('b'),time=document.createElement('time'),body=document.createElement('span');
  name.textContent='Sistema';time.textContent=new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});body.textContent=String(text).slice(0,180);
  head.append(name,time);row.append(head,body);box.appendChild(row);while(box.children.length>90)box.firstElementChild.remove();box.scrollTop=box.scrollHeight;
}

function updateCounter(){const input=$('#onlineChatInput'),counter=$('#onlineChatCounter');if(!input||!counter)return;const n=Array.from(input.value||'').length;counter.textContent=`${n}/${CHAT_LIMIT}`;counter.classList.toggle('near-limit',n>=56);counter.classList.toggle('at-limit',n>=CHAT_LIMIT);}
function clearChatView(){const box=$('#onlineChatMessages');if(!box)return;box.innerHTML='';mpState?.messageIds?.clear?.();}
function exportChat(){
  const rows=Array.from(document.querySelectorAll('#onlineChatMessages .online-chat-line'));
  const lines=rows.map(row=>{const time=row.querySelector('time')?.textContent?.trim()||'--:--';const name=row.querySelector('b')?.textContent?.trim()||'Sistema';const adm=row.querySelector('.online-chat-adm-tag')?'[ADM] ':'';const body=textOfRow(row);return `[${time}] ${adm}${name}: ${body}`;});
  const blob=new Blob([lines.join('\n')||'Chat de Astra sem mensagens visíveis.'],{type:'text/plain;charset=utf-8'});const url=URL.createObjectURL(blob);const a=document.createElement('a');const stamp=new Date().toISOString().replace(/[:.]/g,'-');a.href=url;a.download=`astraeon-chat-${stamp}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}

function setCollapsed(chat,collapsed,{focus=false}={}){
  if(!chat)return;
  const hadExplicitTop=chat.style.top&&chat.style.top!=='auto';
  const bottomEdge=hadExplicitTop?chat.getBoundingClientRect().bottom:0;
  chat.dataset.chatStateChanging='true';
  chat.classList.toggle('chat-pro-collapsed',!!collapsed);chat.classList.remove('collapsed','collapsed-mobile');chat.dataset.chatCollapsed=collapsed?'true':'false';
  const toggle=$('#onlineChatToggle');if(toggle){toggle.textContent=collapsed?'▸':'▾';toggle.setAttribute('aria-expanded',collapsed?'false':'true');toggle.setAttribute('aria-label',collapsed?'Abrir chat':'Minimizar chat');toggle.title=collapsed?'Abrir chat':'Minimizar chat';}
  if(hadExplicitTop&&bottomEdge){const rect=chat.getBoundingClientRect(),edge=8;chat.style.top=`${Math.round(clamp(bottomEdge-rect.height,edge,Math.max(edge,innerHeight-rect.height-edge)))}px`;}
  const input=$('#onlineChatInput');
  if(collapsed){$('#onlineChatSettingsBox')?.classList.add('hidden');clearTimeout(emptyIdleTimer);emptyIdleTimer=null;if(document.activeElement===input)input.blur();}
  else{scheduleEmptyCollapse();if(focus&&input&&input.dataset.accountBlocked!=='true'){input.disabled=false;requestAnimationFrame(()=>input.focus({preventScroll:true}));}}
  requestAnimationFrame(()=>requestAnimationFrame(()=>{delete chat.dataset.chatStateChanging;}));
}
function scheduleEmptyCollapse(){
  clearTimeout(emptyIdleTimer);emptyIdleTimer=null;
  const chat=$('#onlineChat'),input=$('#onlineChatInput');
  if(!chat||chat.classList.contains('chat-pro-collapsed')||String(input?.value||'').trim())return;
  emptyIdleTimer=setTimeout(()=>{if(!String(input?.value||'').trim())setCollapsed(chat,true);},EMPTY_IDLE_MS);
}
function openChat(focus=true){setCollapsed($('#onlineChat'),false,{focus});}
function collapseChat(){setCollapsed($('#onlineChat'),true);}
function toggleChat(focus=false){const chat=$('#onlineChat');if(chat)setCollapsed(chat,!chat.classList.contains('chat-pro-collapsed'),{focus});}
function installChatBehavior(){
  const chat=$('#onlineChat'),input=$('#onlineChatInput'),form=$('#onlineChatForm');if(!chat||!input||!form||chat.dataset.behaviorV5==='true')return;chat.dataset.behaviorV5='true';
  input.addEventListener('input',()=>{updateCounter();if(String(input.value||'').trim())clearTimeout(emptyIdleTimer);else scheduleEmptyCollapse();});
  input.addEventListener('keydown',event=>{if(event.key!=='Enter'||event.isComposing)return;if(!String(input.value||'').trim()){event.preventDefault();event.stopImmediatePropagation();collapseChat();}},true);
  form.addEventListener('submit',()=>setTimeout(scheduleEmptyCollapse,0));
  chat.addEventListener('pointerdown',()=>{if(!String(input.value||'').trim())scheduleEmptyCollapse();},{passive:true});
}
function installProfessionalCollapse(){
  const chat=$('#onlineChat'),toggle=$('#onlineChatToggle'),input=$('#onlineChatInput');if(!chat||!toggle||chat.dataset.proCollapse==='true')return;chat.dataset.proCollapse='true';
  const initial=chat.classList.contains('collapsed')||chat.classList.contains('collapsed-mobile');
  setCollapsed(chat,initial);
  toggle.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();toggleChat(false);},{capture:true});
  input?.addEventListener('focus',()=>{if(chat.classList.contains('chat-pro-collapsed'))openChat(false);else scheduleEmptyCollapse();});
  $('#onlineChatSettings')?.addEventListener('click',()=>{if(chat.classList.contains('chat-pro-collapsed'))openChat(false);else scheduleEmptyCollapse();},{capture:true});
}

function enhanceSettings(){
  const settings=$('#onlineChatSettingsBox'),form=$('#onlineChatForm'),input=$('#onlineChatInput');if(!settings||!form||!input||settings.dataset.chatTools==='true')return;settings.dataset.chatTools='true';
  input.maxLength=CHAT_LIMIT;input.setAttribute('maxlength',String(CHAT_LIMIT));
  let counter=$('#onlineChatCounter');if(!counter){counter=document.createElement('output');counter.id='onlineChatCounter';counter.className='online-chat-counter';counter.setAttribute('aria-live','polite');form.insertBefore(counter,form.querySelector('button[type="submit"]'));}
  input.addEventListener('input',updateCounter);updateCounter();
  const actions=document.createElement('div');actions.className='online-chat-settings-actions';actions.innerHTML='<button id="onlineChatClear" type="button">Limpar chat</button><button id="onlineChatExport" type="button">Exportar chat</button>';
  settings.appendChild(actions);$('#onlineChatClear')?.addEventListener('click',clearChatView);$('#onlineChatExport')?.addEventListener('click',exportChat);
}

function profileMeta(username){
  const key=String(username||'').trim().toLowerCase();if(!key||!mpState?.client||!mpState?.session)return Promise.resolve({access:1,display_name:username,username});if(profileCache.has(key))return profileCache.get(key);
  const pending=(async()=>{try{const {data,error}=await mpState.client.from('profiles').select('username,display_name,access').ilike('username',username).limit(1).maybeSingle();if(error||!data)return{access:1,display_name:username,username};return{access:Number(data.access)||1,display_name:String(data.display_name||data.username||username).slice(0,24),username:data.username||username};}catch(_){return{access:1,display_name:username,username};}})();profileCache.set(key,pending);return pending;
}
async function decoratePlayerRow(row){
  if(!row||row.dataset.profileChecked==='true'||row.classList.contains('system'))return;row.dataset.profileChecked='true';const head=row.querySelector(':scope > div'),name=head?.querySelector('b');if(!head||!name)return;
  const loginName=name.textContent?.trim()||'';const meta=await profileMeta(loginName);if(!row.isConnected)return;
  const ownLogin=String(mpState?.profile?.username||'').toLowerCase(),isOwn=!!ownLogin&&ownLogin===loginName.toLowerCase();const localCharacter=isOwn?String(global.astraeon?.player?.name||'').trim():'';const displayName=(localCharacter||meta.display_name||loginName||'Viajante').slice(0,24);name.textContent=displayName;
  if(meta.access===3&&!row.querySelector('.online-chat-adm-tag')){const tag=document.createElement('span');tag.className='online-chat-adm-tag';tag.textContent='[ADM]';head.insertBefore(tag,name);}
}

async function emitManagedJoinMessages(){
  if(!mpState?.client||!mpState?.session)return;
  try{
    const {data,error}=await mpState.client.from('system_messages').select('id,body,message_kind,enabled,sort_order').eq('enabled',true).eq('message_kind','on_join').order('sort_order',{ascending:true}).order('id',{ascending:true});
    if(error){console.warn('[Astraeon Chat] mensagens de entrada indisponíveis',error.message);return;}
    for(const row of data||[])appendSystemRow(row.body,`managed-join-${row.id}`);
  }catch(error){console.warn('[Astraeon Chat] mensagens de entrada',error);}
}
function processChatRow(row){
  if(!(row instanceof HTMLElement)||!row.classList.contains('online-chat-line'))return;
  if(row.classList.contains('system')&&textOfRow(row)===CONNECT_NOTICE){row.remove();if(!managedJoinShown){managedJoinShown=true;void emitManagedJoinMessages();}return;}
  void decoratePlayerRow(row);
}
function installRowsObserver(){
  const box=$('#onlineChatMessages');if(!box||rowsObserver)return;Array.from(box.children).forEach(processChatRow);rowsObserver=new MutationObserver(records=>records.forEach(record=>record.addedNodes.forEach(node=>processChatRow(node))));rowsObserver.observe(box,{childList:true});
}

function drawBubble(ctx,x,y,text){
  if(!text)return;ctx.save();ctx.font='600 10px Inter, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';const words=String(text).split(/\s+/);const maxW=210,lines=[];let current='';for(const word of words){const test=current?`${current} ${word}`:word;if(ctx.measureText(test).width<=maxW||!current)current=test;else{lines.push(current);current=word;if(lines.length===2)break;}}if(current&&lines.length<2)lines.push(current);if(lines.length===2&&words.join(' ')!==lines.join(' ')){let last=lines[1];while(ctx.measureText(`${last}…`).width>maxW&&last.length>1)last=last.slice(0,-1);lines[1]=`${last}…`;}
  const width=Math.min(230,Math.max(58,...lines.map(line=>ctx.measureText(line).width+20)));const height=lines.length*14+12;const left=x-width/2,top=y-height;ctx.fillStyle='rgba(7,12,15,.92)';ctx.strokeStyle='rgba(118,214,255,.35)';ctx.lineWidth=1;ctx.shadowBlur=10;ctx.shadowColor='rgba(0,0,0,.55)';ctx.beginPath();ctx.roundRect(left,top,width,height,8);ctx.fill();ctx.stroke();ctx.shadowBlur=0;ctx.fillStyle='#eef7f7';lines.forEach((line,i)=>ctx.fillText(line,x,top+9+i*14));ctx.fillStyle='rgba(7,12,15,.92)';ctx.strokeStyle='rgba(118,214,255,.35)';ctx.beginPath();ctx.moveTo(x-5,y);ctx.lineTo(x+5,y);ctx.lineTo(x,y+6);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
function installOwnBubble(){
  const game=global.astraeon;if(!game||game.chatBubbleV43Installed||typeof game.drawPlayer!=='function')return;game.chatBubbleV43Installed=true;const original=game.drawPlayer.bind(game);game.drawPlayer=function(ctx){const result=original(ctx);if(this.player&&ownBubble.text&&performance.now()<ownBubble.until)drawBubble(ctx,this.player.x,this.player.y-58,ownBubble.text);return result;};
}
function installSubmitCapture(){
  const form=$('#onlineChatForm'),input=$('#onlineChatInput');if(!form||!input||form.dataset.chatSubmitV43==='true')return;form.dataset.chatSubmitV43='true';form.addEventListener('submit',event=>{const text=String(input.value||'').trim();if(Array.from(text).length>CHAT_LIMIT){event.preventDefault();event.stopImmediatePropagation();appendSystemRow(`O limite do chat é ${CHAT_LIMIT} caracteres.`);return;}if(text&&mpState?.session){ownBubble.text=text;ownBubble.until=performance.now()+BUBBLE_MS;}setTimeout(updateCounter,0);},true);
}

function scheduleNext(row,now=Date.now()){
  const minutes=Number(row.interval_minutes)||10,step=minutes*60000,anchor=Date.parse(row.updated_at||row.created_at)||now;const jumps=Math.max(1,Math.floor((now-anchor)/step)+1);return anchor+jumps*step;
}
async function refreshSchedules(){
  if(!mpState?.client||!mpState?.session)return;try{const {data,error}=await mpState.client.from('system_messages').select('id,body,message_kind,interval_minutes,enabled,sort_order,created_at,updated_at').eq('enabled',true).eq('message_kind','periodic').order('sort_order',{ascending:true}).order('id',{ascending:true});if(error)return;const incoming=new Set();for(const row of data||[]){incoming.add(String(row.id));const signature=`${row.body}|${row.interval_minutes}|${row.updated_at}`;const existing=schedules.get(String(row.id));if(existing?.signature===signature)continue;schedules.set(String(row.id),{...row,signature,nextAt:scheduleNext(row)});}for(const id of Array.from(schedules.keys()))if(!incoming.has(id))schedules.delete(id);}catch(_){}
}
function tickSchedules(){const now=Date.now();for(const item of schedules.values()){if(now<item.nextAt)continue;appendSystemRow(item.body,`scheduled-${item.id}-${item.nextAt}`);const step=Math.max(5,Number(item.interval_minutes)||10)*60000;while(item.nextAt<=now)item.nextAt+=step;}}
function installSystemScheduler(){if(schedulerRefreshTimer)return;void refreshSchedules();schedulerRefreshTimer=setInterval(refreshSchedules,SYSTEM_REFRESH_MS);schedulerTickTimer=setInterval(tickSchedules,SYSTEM_TICK_MS);}

function updateStaminaUi(game){const max=Math.max(1,Number(game.staminaMax)||STAMINA_MAX_FALLBACK),value=clamp(Number(game.stamina)||0,0,max);const fill=$('#staminaFill'),text=$('#staminaText');if(fill)fill.style.width=`${value/max*100}%`;if(text)text.textContent=`${Math.round(value)} / ${Math.round(max)}`;document.body.classList.toggle('is-sprinting',!!game.sprinting);document.body.classList.toggle('stamina-empty',value<=.5);}
function installSprintRuntime(){
  const game=global.astraeon;if(!game||game.sprintV43Installed)return;game.sprintV43Installed=true;
  global.addEventListener('keydown',e=>{if(e.key==='Shift')sprintKeyDown=true;},true);global.addEventListener('keyup',e=>{if(e.key==='Shift')sprintKeyDown=false;},true);global.addEventListener('blur',()=>{sprintKeyDown=false;});
  const original=game.update.bind(game);game.update=function(dt){const p=this.player;if(!p)return original(dt);this.staminaMax=Math.max(1,Number(this.staminaMax)||STAMINA_MAX_FALLBACK);if(!Number.isFinite(Number(this.stamina)))this.stamina=this.staminaMax;const moving=!!(this.keys?.has('w')||this.keys?.has('a')||this.keys?.has('s')||this.keys?.has('d')||this.keys?.has('arrowup')||this.keys?.has('arrowdown')||this.keys?.has('arrowleft')||this.keys?.has('arrowright'));const shift=!!(sprintKeyDown||this.keys?.has('shift'));const beforeX=p.x,beforeY=p.y,beforeStamina=Number(this.stamina)||0,baseSpeed=Math.max(0,Number(p.speed)||0);original(dt);const afterStamina=Number(this.stamina)||0;const wants=!!(moving&&shift&&beforeStamina>.35);if(wants){this.sprinting=true;const drain=Math.max(0,Number(this.adminStaminaDrain)||STAMINA_DRAIN_FALLBACK)*dt;if(afterStamina>=beforeStamina-.001)this.stamina=Math.max(0,beforeStamina-drain);this.staminaRecoveryDelay=Math.max(0,Number(this.adminStaminaDelay)||STAMINA_DELAY_FALLBACK);const dx=this.player.x-beforeX,dy=this.player.y-beforeY,actual=Math.hypot(dx,dy),multiplier=Math.max(MIN_SPRINT_MULTIPLIER,Number(this.adminSprintMultiplier)||MIN_SPRINT_MULTIPLIER),desired=baseSpeed*dt*multiplier;if(actual>.001&&desired>actual+.02)this.moveEntity(this.player,dx/actual*(desired-actual),dy/actual*(desired-actual),10);if(this.stamina<=.35)this.sprinting=false;}else if(!this.systemsV30BInstalled){this.sprinting=false;this.staminaRecoveryDelay=Math.max(0,(Number(this.staminaRecoveryDelay)||0)-dt);if(this.staminaRecoveryDelay<=0)this.stamina=Math.min(this.staminaMax,(Number(this.stamina)||0)+Math.max(0,Number(this.adminStaminaRegen)||STAMINA_REGEN_FALLBACK)*dt);}this.stamina=clamp(Number(this.stamina)||0,0,this.staminaMax);if(typeof this.updateStaminaUI==='function')this.updateStaminaUI();else updateStaminaUi(this);};
}

function install(mp){
  if(installed||!mp?.state)return;installed=true;mpState=mp.state;enhanceSettings();installProfessionalCollapse();installChatBehavior();installRowsObserver();installSubmitCapture();installOwnBubble();installSystemScheduler();installSprintRuntime();document.body.classList.add('astraeon-chat-v43-ready');
}
function wait(){const started=Date.now();const tick=()=>{const mp=global.AstraeonMultiplayerV4;if(mp?.state&&$('#onlineChat')){install(mp);return;}if(Date.now()-started<15000)setTimeout(tick,80);};tick();}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',wait);else wait();
global.addEventListener('beforeunload',()=>{rowsObserver?.disconnect();if(schedulerRefreshTimer)clearInterval(schedulerRefreshTimer);if(schedulerTickTimer)clearInterval(schedulerTickTimer);});
global.AstraeonChatControllerV5={open:openChat,collapse:collapseChat,toggle:toggleChat,scheduleEmptyCollapse,isCollapsed:()=>$('#onlineChat')?.classList.contains('chat-pro-collapsed')!==false};
global.AstraeonChatSystemV4={install,refreshSchedules,emitManagedJoinMessages,clearChatView,exportChat};
})(window);

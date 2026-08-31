(function(global){
'use strict';
let installed=false,mpState=null,systemTimer=null,mobTimer=null,systemObserver=null;
const W=global.AstraeonWorld;
const $=s=>document.querySelector(s);
const systemStyles=new Map();
const mobConfigs=new Map();
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));

function injectStyles(){if(document.getElementById('astraeonLiveV5Styles'))return;const s=document.createElement('style');s.id='astraeonLiveV5Styles';s.textContent=`
#systemAnnouncementV5{position:fixed;z-index:43;left:50%;top:clamp(118px,17vh,168px);transform:translate(-50%,-8px);width:min(720px,68vw);pointer-events:none;text-align:center;opacity:0;transition:opacity .28s ease,transform .34s cubic-bezier(.2,.75,.2,1);filter:drop-shadow(0 4px 10px rgba(0,0,0,.65))}
#systemAnnouncementV5.show{opacity:1;transform:translate(-50%,0)}
#systemAnnouncementV5 .system-announcement-text{display:inline-block;position:relative;max-width:100%;padding:8px 34px 10px;font-size:var(--sys-size,24px);font-family:var(--sys-font,Inter,sans-serif);font-weight:600;line-height:1.15;color:var(--sys-color,#ffd34f);text-shadow:0 2px 4px rgba(0,0,0,.9);white-space:normal}
#systemAnnouncementV5 .system-announcement-text:before,#systemAnnouncementV5 .system-announcement-text:after{content:"";position:absolute;top:50%;width:min(28vw,220px);height:1px;background:linear-gradient(90deg,transparent,var(--sys-color,#ffd34f));opacity:.92}
#systemAnnouncementV5 .system-announcement-text:before{right:100%;transform:translateY(5px)}#systemAnnouncementV5 .system-announcement-text:after{left:100%;transform:translateY(5px) scaleX(-1)}
#systemAnnouncementV5 .system-announcement-gem{display:block;margin:0 auto -3px;width:5px;height:5px;background:var(--sys-color,#ffd34f);transform:rotate(45deg);box-shadow:0 0 9px var(--sys-color,#ffd34f)}
@media(max-width:760px){#systemAnnouncementV5{top:96px;width:64vw;max-width:520px}#systemAnnouncementV5 .system-announcement-text{padding:6px 20px 8px;font-size:min(var(--sys-size,22px),22px)}#systemAnnouncementV5 .system-announcement-text:before,#systemAnnouncementV5 .system-announcement-text:after{width:min(15vw,90px)}}
@media(max-height:460px){#systemAnnouncementV5{top:86px}}
`;document.head.appendChild(s);}
function ensureAnnouncement(){let el=$('#systemAnnouncementV5');if(el)return el;el=document.createElement('div');el.id='systemAnnouncementV5';el.setAttribute('aria-live','polite');el.innerHTML='<span class="system-announcement-gem"></span><div class="system-announcement-text"></div>';document.body.appendChild(el);return el;}
function showSystemMessage(row){if(!row?.body)return;const el=ensureAnnouncement(),text=el.querySelector('.system-announcement-text');el.style.setProperty('--sys-size',`${clamp(Number(row.font_size)||24,12,48)}px`);el.style.setProperty('--sys-font',String(row.font_family||'Inter, sans-serif'));el.style.setProperty('--sys-color',/^#[0-9a-f]{6}$/i.test(String(row.color||''))?row.color:'#ffd34f');text.textContent=String(row.body).slice(0,160);el.classList.remove('show');void el.offsetWidth;el.classList.add('show');clearTimeout(el._hideTimer);el._hideTimer=setTimeout(()=>el.classList.remove('show'),6200);}
async function refreshSystemStyles(){if(!mpState?.client||!mpState?.session)return;try{const{data,error}=await mpState.client.from('system_messages').select('id,body,enabled,font_size,font_family,color').eq('enabled',true);if(error)return;systemStyles.clear();for(const row of data||[])systemStyles.set(String(row.body),row);}catch(_){}}
function processSystemNode(node){if(!(node instanceof HTMLElement)||!node.classList.contains('system'))return;const body=node.querySelector(':scope > span')?.textContent?.trim();if(!body)return;const row=systemStyles.get(body);if(row){showSystemMessage(row);return;}setTimeout(async()=>{await refreshSystemStyles();const found=systemStyles.get(body);if(found)showSystemMessage(found);},80);}
function installSystemObserver(){const box=$('#onlineChatMessages');if(!box||systemObserver)return;Array.from(box.children).forEach(processSystemNode);systemObserver=new MutationObserver(rs=>rs.forEach(r=>r.addedNodes.forEach(processSystemNode)));systemObserver.observe(box,{childList:true});void refreshSystemStyles();systemTimer=setInterval(refreshSystemStyles,30000);}

function normalizedStats(row){const s=row?.stats||{};return{hp:Math.max(1,Number(s.hp)||1),power:Math.max(0,Number(s.power)||0),speed:Math.max(0,Number(s.speed)||0),xp:Math.max(0,Number(s.xp)||0),gold:Array.isArray(s.gold)&&s.gold.length>=2?[Math.max(0,Number(s.gold[0])||0),Math.max(0,Number(s.gold[1])||0)]:[0,0]};}
function applyMobConfigs(rows){mobConfigs.clear();for(const row of rows||[]){mobConfigs.set(row.mob_type,row);if(!W?.MOB_DATA?.[row.mob_type]||row.enabled===false)continue;const s=normalizedStats(row);Object.assign(W.MOB_DATA[row.mob_type],s);}}
async function refreshMobConfigs(){if(!mpState?.client||!mpState?.session)return;try{const{data,error}=await mpState.client.from('mob_configs').select('mob_type,display_name,enabled,stats,drops,updated_at').order('mob_type');if(error)return;applyMobConfigs(data||[]);}catch(_){}}
function configuredDrop(row){const d=Array.isArray(row?.drops)?row.drops:[];return d.filter(x=>x&&String(x.name||'').trim()).map(x=>({name:String(x.name).slice(0,60),rarity:['common','uncommon','rare','legendary'].includes(x.rarity)?x.rarity:'common',type:String(x.type||'Equipamento').slice(0,32),power:Math.max(0,Number(x.power)||0),qty:Math.max(1,Math.floor(Number(x.qty)||1)),chance:clamp(Number(x.chance)||0,0,100)}));}
function installMobDrops(game){if(!game||game.liveMobDropsV5||typeof game.killMob!=='function')return;game.liveMobDropsV5=true;const original=game.killMob.bind(game);game.killMob=function(mob){const before=this.pickups?.length||0,result=original(mob),cfg=mobConfigs.get(mob?.type),drops=configuredDrop(cfg);if(!drops.length)return result;const created=this.pickups.slice(before);for(const p of created.filter(p=>p.type==='loot')){const i=this.pickups.indexOf(p);if(i>=0)this.pickups.splice(i,1);}let offset=0;for(const drop of drops){if(Math.random()*100>drop.chance)continue;const value={name:drop.name,rarity:drop.rarity,type:drop.type,power:drop.power,qty:drop.qty};this.pickups.push({type:'loot',x:(mob?.x||this.player?.x||0)+offset*9,y:(mob?.y||this.player?.y||0)-5,value,life:24});offset++;}return result;};}

function installBodies(game){if(!game||game.rigidbodyV5Installed)return;game.rigidbodyV5Installed=true;global.AstraeonEntityCollisionV1?.install?.(game);}

function install(mp){if(installed)return;installed=true;mpState=mp?.state||global.AstraeonMultiplayerV4?.state||null;injectStyles();const game=global.astraeon;installMobDrops(game);installBodies(game);installSystemObserver();void refreshMobConfigs();mobTimer=setInterval(refreshMobConfigs,30000);document.body.classList.add('astraeon-live-v5-ready');}
function wait(){const started=Date.now();const tick=()=>{if(global.astraeon&&global.AstraeonMultiplayerV4?.state){install(global.AstraeonMultiplayerV4);return;}if(Date.now()-started<15000)setTimeout(tick,80);};tick();}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',wait);else wait();
global.addEventListener('beforeunload',()=>{systemObserver?.disconnect();if(systemTimer)clearInterval(systemTimer);if(mobTimer)clearInterval(mobTimer);});
global.AstraeonLiveRuntimeV5={install,showSystemMessage,refreshMobConfigs,refreshSystemStyles,mobConfigs};
})(window);

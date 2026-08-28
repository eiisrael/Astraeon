(function(global){
'use strict';
const STORAGE='astraeon:v3c:admin';
const BASE_LOOT_CHANCE=.18;
const finite=(v,f=0)=>Number.isFinite(Number(v))?Number(v):f;
function defaults(){return{version:'3.0-C',enabled:true,gameplay:{godMode:false,damageMultiplier:1,damageTakenMultiplier:1,xpMultiplier:1,goldMultiplier:1,lootChance:.18,backpackCapacity:30,staminaMax:100,staminaDrain:24,staminaRegen:19,staminaDelay:.65,sprintMultiplier:1.55},classes:{},mobs:{},items:{},biomes:{}}}
function deepMerge(a,b){if(!b||typeof b!=='object')return a;for(const[k,v]of Object.entries(b)){if(v&&typeof v==='object'&&!Array.isArray(v)&&a[k]&&typeof a[k]==='object'&&!Array.isArray(a[k]))deepMerge(a[k],v);else a[k]=v;}return a;}
function load(){try{return deepMerge(defaults(),JSON.parse(localStorage.getItem(STORAGE)||'{}'));}catch(_){return defaults();}}
function ensureOnlineV4(){
 if(!document.querySelector('link[data-astraeon-online-v4]')){const link=document.createElement('link');link.rel='stylesheet';link.href='src/online-v4.css';link.dataset.astraeonOnlineV4='1';document.head.appendChild(link);}
 const scripts=[['src/world-online-v4.js','AstraeonOnlineWorld'],['src/npcs-v4.js','AstraeonNPCsV4'],['src/multiplayer-v4.js','AstraeonMultiplayerV4'],['src/account-status-v4.js','AstraeonAccountStatusV4']];
 let chain=Promise.resolve();
 scripts.forEach(([src,name])=>{chain=chain.then(()=>new Promise(resolve=>{if(global[name]){global[name].install?.(global.AstraeonMultiplayerV4);resolve();return;}let s=document.querySelector(`script[data-online-src="${src}"]`);if(s){s.addEventListener('load',()=>{global[name]?.install?.(global.AstraeonMultiplayerV4);resolve();},{once:true});return;}s=document.createElement('script');s.src=src;s.dataset.onlineSrc=src;s.onload=()=>{global[name]?.install?.(global.AstraeonMultiplayerV4);resolve();};s.onerror=()=>{console.warn('[Astraeon Online] falha ao carregar',src);resolve();};document.head.appendChild(s);}));});
 return chain;
}
ensureOnlineV4();
function install(){
 const game=global.astraeon,W=global.AstraeonWorld,A=global.AstraeonItems;if(!game||!W||game.adminV30CInstalled)return false;game.adminV30CInstalled=true;
 const cfg=load();game.adminConfigV3C=cfg;
 document.title='ASTRAEON 3.0-C — Hardcore Admin';
 document.querySelectorAll('.world-status .chip').forEach(ch=>{if(ch.textContent.includes('ASTRAEON'))ch.textContent='ASTRAEON 3.0-C'});
 const eyebrow=document.querySelector('#startScreen .eyebrow');if(eyebrow)eyebrow.textContent='Hardcore Remaster 3.0-C · Admin, balanceamento e tipografia responsiva';
 if(!cfg.enabled)return true;
 for(const[id,ov]of Object.entries(cfg.classes||{}))if(W.CLASS_DATA[id])Object.assign(W.CLASS_DATA[id],ov);
 for(const[id,ov]of Object.entries(cfg.mobs||{}))if(W.MOB_DATA[id])Object.assign(W.MOB_DATA[id],ov);
 for(const[id,ov]of Object.entries(cfg.biomes||{}))if(W.BIOMES[id])Object.assign(W.BIOMES[id],ov);
 if(A?.items)for(const[id,ov]of Object.entries(cfg.items||{})){const item=A.items[id];if(!item)continue;if(ov.stats)item.stats={...(item.stats||{}),...ov.stats};Object.entries(ov).forEach(([k,v])=>{if(k!=='stats')item[k]=v});}
 const g=cfg.gameplay||{};
 function applyState(){
  this.backpackCapacity=Math.max(1,Math.floor(Number(g.backpackCapacity)||30));
  this.staminaMax=Math.max(1,Number(g.staminaMax)||100);
  this.stamina=Math.max(0,Math.min(this.staminaMax,Number.isFinite(this.stamina)?this.stamina:this.staminaMax));
  this.adminSprintMultiplier=Math.max(.1,Number(g.sprintMultiplier)||1.55);
  this.adminStaminaDrain=Math.max(0,Number(g.staminaDrain)||24);
  this.adminStaminaRegen=Math.max(0,Number(g.staminaRegen)||19);
  this.adminStaminaDelay=Math.max(0,Number(g.staminaDelay)||.65);
  this.updateStaminaUI?.();this.renderInventory?.();
 }
 const originalUpdate=game.update.bind(game),originalDamagePlayer=game.damagePlayer.bind(game),originalHitMob=game.hitMob.bind(game),originalGainXp=game.gainXp.bind(game),originalKillMob=game.killMob.bind(game),originalStartNew=game.startNew.bind(game),originalContinue=game.continueGame.bind(game);
 game.update=function(dt){
  if(!this.player)return originalUpdate(dt);
  const bx=this.player.x,by=this.player.y,bs=Number(this.stamina)||0;
  originalUpdate(dt);
  const sprinting=!!this.sprinting,after=Number(this.stamina)||0;
  if(sprinting){
   const desired=this.adminStaminaDrain*dt;
   this.stamina=Math.max(0,Math.min(this.staminaMax,bs-desired));
   this.staminaRecoveryDelay=this.adminStaminaDelay;
   const factor=this.adminSprintMultiplier/1.55;
   if(Math.abs(factor-1)>.001){const dx=this.player.x-bx,dy=this.player.y-by;this.moveEntity(this.player,dx*(factor-1),dy*(factor-1),10);}
  }else if(after>bs){
   const observed=after-bs;if(observed>0)this.stamina=Math.min(this.staminaMax,bs+observed*(this.adminStaminaRegen/19));
  }
  this.stamina=Math.max(0,Math.min(this.staminaMax,this.stamina));this.updateStaminaUI?.();
 };
 game.damagePlayer=function(amount){if(g.godMode){this.floatText?.(this.player.x,this.player.y-25,'IMUNE','#ffd86b');return;}return originalDamagePlayer(Math.max(0,Math.round((Number(amount)||0)*finite(g.damageTakenMultiplier,1))))};
 game.hitMob=function(mob,amount,crit){return originalHitMob(mob,Math.max(0,Math.round((Number(amount)||0)*finite(g.damageMultiplier,1))),crit)};
 game.gainXp=function(amount){return originalGainXp(Math.max(0,Math.round((Number(amount)||0)*finite(g.xpMultiplier,1))))};
 game.killMob=function(mob){
  const before=this.pickups.length;originalKillMob(mob);const created=this.pickups.slice(before),goldMult=Math.max(0,finite(g.goldMultiplier,1));created.filter(x=>x.type==='gold').forEach(x=>x.value=Math.max(0,Math.round((Number(x.value)||0)*goldMult)));
  const target=Math.max(0,Math.min(1,Number(g.lootChance)));const loot=created.find(x=>x.type==='loot');
  if(target<BASE_LOOT_CHANCE&&loot&&Math.random()>target/BASE_LOOT_CHANCE){const i=this.pickups.indexOf(loot);if(i>=0)this.pickups.splice(i,1)}
  else if(target>BASE_LOOT_CHANCE&&!loot&&Math.random()<(target-BASE_LOOT_CHANCE)/(1-BASE_LOOT_CHANCE)){this.pickups.push({type:'loot',x:(mob?.x||this.player.x)+9,y:(mob?.y||this.player.y)-5,value:this.rollLoot(mob),life:22})}
 };
 game.startNew=function(){originalStartNew();if(this.player)applyState.call(this)};
 game.continueGame=function(){originalContinue();if(this.player)applyState.call(this)};
 applyState.call(game);
 global.dispatchEvent(new CustomEvent('astraeon:admin-ready',{detail:{version:'3.0-C'}}));return true;
}
global.AstraeonAdminRuntime={install,load,ensureOnlineV4};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',()=>setTimeout(install,0));else setTimeout(install,0);
})(window);

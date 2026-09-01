(function(global){
'use strict';
const $=selector=>document.querySelector(selector);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
let cursor=null,moveTimer=0,attackTimer=0,raf=0,lastX=0,lastY=0,nextX=0,nextY=0,worldHudRetry=0;

function isEditable(target){return !!target?.closest?.('input,textarea,select,[contenteditable="true"]');}
function isWorldTarget(target){return target===$('#world')&&document.body.classList.contains('game-running')&&!document.body.classList.contains('panel-studio-embed');}
function isNearNpc(){const game=global.astraeon,player=game?.player;if(!player)return false;return (game.npcsV4||[]).some(npc=>Math.hypot(npc.x-player.x,npc.y-player.y)<=78);}
function paint(){raf=0;if(!cursor)return;cursor.style.left=`${nextX}px`;cursor.style.top=`${nextY}px`;cursor.classList.toggle('interacting',isNearNpc());}
function move(event){
  if(!cursor)return;
  if(!isWorldTarget(event.target)){cursor.classList.remove('visible','moving','interacting');return;}
  nextX=event.clientX;nextY=event.clientY;
  const speed=Math.hypot(nextX-lastX,nextY-lastY);lastX=nextX;lastY=nextY;
  cursor.classList.add('visible');cursor.classList.toggle('moving',speed>3);
  clearTimeout(moveTimer);moveTimer=setTimeout(()=>cursor?.classList.remove('moving'),90);
  if(!raf)raf=requestAnimationFrame(paint);
}
function attack(event){
  if(!cursor||!isWorldTarget(event.target)||event.button!==0)return;
  cursor.classList.add('attacking');clearTimeout(attackTimer);attackTimer=setTimeout(()=>cursor?.classList.remove('attacking'),180);
}
function preventSelection(event){
  if(!document.body.classList.contains('game-running')||isEditable(event.target))return;
  if(event.target?.closest?.('#gameRoot,#onlineChat,#biomeBanner,#toast,#lootWarning'))event.preventDefault();
}

function drawWorldBar(ctx,x,y,width,height,ratio,color){
  ctx.fillStyle='rgba(3,5,6,.92)';
  ctx.fillRect(x,y,width,height);
  ctx.strokeStyle='rgba(0,0,0,.9)';
  ctx.lineWidth=1;
  ctx.strokeRect(x-.5,y-.5,width+1,height+1);
  ctx.fillStyle=color;
  ctx.fillRect(x,y,width*clamp01(ratio),height);
}

function drawPlayerWorldHud(ctx,game,name){
  const p=game?.player;
  if(!ctx||!p)return;

  const width=68,height=5,gap=2;
  const left=p.x-width/2;
  const hpMax=Math.max(1,Number(p.maxHp)||1);
  const manaMax=Math.max(1,Number(p.maxMana)||1);
  const staminaMax=Math.max(1,Number(game.staminaMax)||100);
  const staminaValue=Number.isFinite(Number(game.stamina))?Number(game.stamina):staminaMax;
  const top=p.y-62;

  ctx.save();
  ctx.textAlign='center';
  ctx.textBaseline='bottom';
  ctx.font='700 10px Inter, sans-serif';
  ctx.lineJoin='round';
  ctx.lineWidth=3;
  ctx.strokeStyle='rgba(0,0,0,.86)';
  ctx.strokeText(name,p.x,p.y-67);
  ctx.fillStyle='#fff';
  ctx.fillText(name,p.x,p.y-67);

  drawWorldBar(ctx,left,top,width,height,Number(p.hp)/hpMax,'#e51f1f');
  drawWorldBar(ctx,left,top+height+gap,width,height,Number(p.mana)/manaMax,'#1594ef');
  drawWorldBar(ctx,left,top+(height+gap)*2,width,height,staminaValue/staminaMax,'#e7ec17');
  ctx.restore();
}

function installPlayerWorldHud(){
  const game=global.astraeon;
  if(!game||typeof game.drawPlayer!=='function'){
    clearTimeout(worldHudRetry);
    worldHudRetry=setTimeout(installPlayerWorldHud,60);
    return;
  }
  if(game.playerWorldHudV1Installed)return;
  game.playerWorldHudV1Installed=true;

  const originalDrawPlayer=game.drawPlayer.bind(game);
  game.drawPlayer=function(ctx){
    const player=this.player;
    if(!player)return originalDrawPlayer(ctx);
    const savedName=player.name;
    const displayName=String(savedName||'Jogador').trim().slice(0,18)||'Jogador';
    player.name='';
    try{originalDrawPlayer(ctx);}
    finally{player.name=savedName;}
    drawPlayerWorldHud(ctx,this,displayName);
  };
}

function install(){
  if(document.documentElement.dataset.gameInteractionV1==='true')return;document.documentElement.dataset.gameInteractionV1='true';
  cursor=document.createElement('div');cursor.id='astraeonCursor';cursor.setAttribute('aria-hidden','true');cursor.innerHTML='<i class="cursor-ring"></i><i class="cursor-rune"></i><i class="cursor-core"></i>';document.body.appendChild(cursor);
  document.addEventListener('pointermove',move,{passive:true,capture:true});
  document.addEventListener('pointerdown',attack,{passive:true,capture:true});
  document.addEventListener('pointerleave',()=>cursor?.classList.remove('visible'));
  document.addEventListener('selectstart',preventSelection,true);
  global.addEventListener('blur',()=>cursor?.classList.remove('visible','moving','attacking','interacting'));
  installPlayerWorldHud();
}
global.AstraeonPlayerWorldHudV1={install:installPlayerWorldHud};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

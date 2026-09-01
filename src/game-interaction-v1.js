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

function roundedRect(ctx,x,y,width,height,radius){
  ctx.beginPath();
  if(typeof ctx.roundRect==='function')ctx.roundRect(x,y,width,height,radius);
  else{
    const r=Math.min(radius,width/2,height/2);
    ctx.moveTo(x+r,y);ctx.lineTo(x+width-r,y);ctx.quadraticCurveTo(x+width,y,x+width,y+r);
    ctx.lineTo(x+width,y+height-r);ctx.quadraticCurveTo(x+width,y+height,x+width-r,y+height);
    ctx.lineTo(x+r,y+height);ctx.quadraticCurveTo(x,y+height,x,y+height-r);
    ctx.lineTo(x,y+r);ctx.quadraticCurveTo(x,y,x+r,y);
  }
}

function drawWorldBar(ctx,x,y,width,height,ratio,colors,glow){
  const fillWidth=Math.max(0,width*clamp01(ratio));
  ctx.save();
  roundedRect(ctx,x-.75,y-.75,width+1.5,height+1.5,3);
  ctx.fillStyle='rgba(2,5,9,.94)';
  ctx.fill();
  ctx.strokeStyle='rgba(160,205,255,.18)';
  ctx.lineWidth=.75;
  ctx.stroke();

  if(fillWidth>.15){
    const gradient=ctx.createLinearGradient(x,y,x+width,y);
    gradient.addColorStop(0,colors[0]);
    gradient.addColorStop(.58,colors[1]);
    gradient.addColorStop(1,colors[2]);
    ctx.shadowBlur=5;
    ctx.shadowColor=glow;
    roundedRect(ctx,x,y,fillWidth,height,2.5);
    ctx.fillStyle=gradient;
    ctx.fill();
    ctx.shadowBlur=0;
    ctx.globalAlpha=.72;
    roundedRect(ctx,x+1,y+.65,Math.max(0,fillWidth-2),Math.max(.8,height*.22),1);
    ctx.fillStyle='rgba(255,255,255,.62)';
    ctx.fill();
  }
  ctx.restore();
}

function drawPlayerIdentity(ctx,p,name){
  const level=Math.max(1,Math.round(Number(p.level)||1));
  const parts=[
    {text:name,color:'#f7fbff'},
    {text:`  (Lv: ${level})`,color:'#ffd35a'},
    {text:'  Personagem',color:'#f7fbff'}
  ];
  ctx.save();
  ctx.font='800 8px Inter, sans-serif';
  ctx.textAlign='left';
  ctx.textBaseline='bottom';
  ctx.lineJoin='round';
  ctx.lineWidth=2.6;
  const total=parts.reduce((sum,part)=>sum+ctx.measureText(part.text).width,0);
  let x=p.x-total/2;
  const y=p.y-69;
  for(const part of parts){
    ctx.strokeStyle='rgba(0,0,0,.9)';
    ctx.strokeText(part.text,x,y);
    ctx.fillStyle=part.color;
    ctx.fillText(part.text,x,y);
    x+=ctx.measureText(part.text).width;
  }
  ctx.restore();
}

function drawPlayerWorldHud(ctx,game,name){
  const p=game?.player;
  if(!ctx||!p)return;

  const width=72,height=5,gap=2;
  const left=p.x-width/2;
  const hpMax=Math.max(1,Number(p.maxHp)||1);
  const manaMax=Math.max(1,Number(p.maxMana)||1);
  const staminaMax=Math.max(1,Number(game.staminaMax)||100);
  const staminaValue=Number.isFinite(Number(game.stamina))?Number(game.stamina):staminaMax;
  const top=p.y-64;

  drawPlayerIdentity(ctx,p,name);
  drawWorldBar(ctx,left,top,width,height,Number(p.hp)/hpMax,['#810c2c','#ff2857','#ff7890'],'rgba(255,45,92,.72)');
  drawWorldBar(ctx,left,top+height+gap,width,height,Number(p.mana)/manaMax,['#073caa','#138dff','#45e4ff'],'rgba(30,174,255,.72)');
  drawWorldBar(ctx,left,top+(height+gap)*2,width,height,staminaValue/staminaMax,['#9a4b04','#ffae16','#fff06a'],'rgba(255,190,45,.7)');
}

function installHudIdentitySync(game){
  if(!game||game.playerHudIdentityV2Installed||typeof game.updateUI!=='function')return;
  game.playerHudIdentityV2Installed=true;
  const originalUpdateUI=game.updateUI.bind(game);
  game.updateUI=function(){
    const result=originalUpdateUI();
    const player=this.player;
    const char=this.ui?.char||$('#charText');
    if(player&&char){
      const nick=String(player.name||'Jogador').trim().slice(0,18)||'Jogador';
      if(char.textContent!==nick)char.textContent=nick;
      char.title=nick;
    }
    return result;
  };
}

function installStaminaLabelGuard(){
  const label=$('.stamina-line > span');
  if(!label||label.dataset.stamLabelGuard==='true')return;
  label.dataset.stamLabelGuard='true';
  const enforce=()=>{if(label.textContent!=='STAM')label.textContent='STAM';};
  enforce();
  new MutationObserver(enforce).observe(label,{childList:true,characterData:true,subtree:true});
}

function installPlayerWorldHud(){
  const game=global.astraeon;
  if(!game||typeof game.drawPlayer!=='function'){
    clearTimeout(worldHudRetry);
    worldHudRetry=setTimeout(installPlayerWorldHud,60);
    return;
  }
  installHudIdentitySync(game);
  installStaminaLabelGuard();
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

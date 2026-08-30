(function(global){
'use strict';
const $=selector=>document.querySelector(selector);
let cursor=null,moveTimer=0,attackTimer=0,raf=0,lastX=0,lastY=0,nextX=0,nextY=0;

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
function install(){
  if(document.documentElement.dataset.gameInteractionV1==='true')return;document.documentElement.dataset.gameInteractionV1='true';
  cursor=document.createElement('div');cursor.id='astraeonCursor';cursor.setAttribute('aria-hidden','true');cursor.innerHTML='<i class="cursor-ring"></i><i class="cursor-rune"></i><i class="cursor-core"></i>';document.body.appendChild(cursor);
  document.addEventListener('pointermove',move,{passive:true,capture:true});
  document.addEventListener('pointerdown',attack,{passive:true,capture:true});
  document.addEventListener('pointerleave',()=>cursor?.classList.remove('visible'));
  document.addEventListener('selectstart',preventSelection,true);
  global.addEventListener('blur',()=>cursor?.classList.remove('visible','moving','attacking','interacting'));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

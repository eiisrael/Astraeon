(function(global){
'use strict';
const $=selector=>document.querySelector(selector);
const clamp01=value=>Math.max(0,Math.min(1,Number(value)||0));
const PLAYER_BUFF_KEYS=['buffPower','buffSpeed','buffDefense','manaRegenPct','lifeStealAura','critBonus','dotRate','critManaPct','resistHealPct','unstoppable'];
const QUEST_PANEL_STATE_KEY='astraeon:v4:quest-panel-collapsed';
let cursor=null,moveTimer=0,attackTimer=0,raf=0,lastX=0,lastY=0,nextX=0,nextY=0,worldHudRetry=0,buffHudRetry=0,buffHudFrame=0,buffHudLastPaint=0,buffPlayerRef=null,buffCharacterId=null,macroGuardRetry=0,questHudRetry=0;
const activePlayerBuffs=new Map();

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
    {text:`(Lv.: ${level}) `,color:'#ffd35a'},
    {text:name,color:'#f7fbff'}
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

function buffDuration(skill){
  const mechanics=skill?.mechanics||{};
  const duration=Math.max(0,Number(mechanics.duration)||0);
  if(!duration)return 0;
  if(skill?.mode==='buff')return duration;
  return PLAYER_BUFF_KEYS.some(key=>key==='unstoppable'?mechanics[key]===true:Number(mechanics[key])!==0)?duration:0;
}

function classBuffCapacity(classId){
  const catalog=global.AstraeonSkillsCatalogV1;
  const count=(catalog?.list?.(classId)||[]).filter(skill=>buffDuration(skill)>0).length;
  return Math.max(1,Math.min(5,count||1));
}

function buffGlyph(skill){
  const ignored=new Set(['da','de','do','das','dos','e']);
  const words=String(skill?.name||'Buff').split(/\s+/).filter(word=>word&&!ignored.has(word.toLowerCase()));
  return (words.slice(0,2).map(word=>word[0]).join('')||'B').toUpperCase();
}

function ensurePlayerBuffHost(){
  let host=$('#playerBuffs');
  if(host)return host;
  const card=$('.player-card');
  const meta=card?.querySelector('.player-meta');
  if(!card||!meta)return null;
  host=document.createElement('div');
  host.id='playerBuffs';
  host.className='player-buffs';
  host.setAttribute('aria-label','Buffs ativos do personagem');
  meta.before(host);
  return host;
}

function syncBuffOwner(){
  const game=global.astraeon;
  const player=game?.player||null;
  const characterId=global.AstraeonCharactersV6?.activeCharacterId||null;
  if(player===buffPlayerRef&&characterId===buffCharacterId)return;
  buffPlayerRef=player;
  buffCharacterId=characterId;
  activePlayerBuffs.clear();
  ensurePlayerBuffHost()?.replaceChildren();
}

function registerPlayerBuff(skill){
  const duration=buffDuration(skill);
  if(!duration)return;
  const now=performance.now();
  activePlayerBuffs.set(skill.id,{skill,duration,until:now+duration*1000,activatedAt:now});
  renderPlayerBuffHud(now,true);
}

function renderPlayerBuffHud(now=performance.now(),force=false){
  syncBuffOwner();
  if(!force&&now-buffHudLastPaint<120)return;
  buffHudLastPaint=now;
  const host=ensurePlayerBuffHost();
  const player=global.astraeon?.player;
  if(!host||!player)return;
  for(const[id,buff]of activePlayerBuffs)if(buff.until<=now)activePlayerBuffs.delete(id);
  const capacity=classBuffCapacity(player.classId);
  host.style.setProperty('--buff-capacity',String(capacity));
  host.dataset.capacity=String(capacity);
  const entries=[...activePlayerBuffs.values()].sort((a,b)=>a.activatedAt-b.activatedAt).slice(-capacity);
  host.replaceChildren();
  for(const entry of entries){
    const remaining=Math.max(0,(entry.until-now)/1000);
    const tile=document.createElement('span');
    tile.className='player-buff-icon';
    tile.style.setProperty('--buff-color',entry.skill.domainColor||'#7caeff');
    tile.style.setProperty('--buff-progress',`${Math.max(0,Math.min(100,remaining/entry.duration*100))}%`);
    tile.title=`${entry.skill.name} · ${remaining.toFixed(1)}s`;
    tile.setAttribute('aria-label',`${entry.skill.name}, ${Math.ceil(remaining)} segundos restantes`);
    const glyph=document.createElement('b');glyph.textContent=buffGlyph(entry.skill);
    const time=document.createElement('i');time.textContent=String(Math.ceil(remaining));
    tile.append(glyph,time);
    host.appendChild(tile);
  }
}

function buffHudLoop(now){
  renderPlayerBuffHud(now);
  buffHudFrame=requestAnimationFrame(buffHudLoop);
}

function installPlayerBuffHud(){
  const game=global.astraeon;
  const skills=global.AstraeonSkillsV1;
  const catalog=global.AstraeonSkillsCatalogV1;
  if(!game||typeof game.castSkill!=='function'||!skills?.state||!catalog){
    clearTimeout(buffHudRetry);
    buffHudRetry=setTimeout(installPlayerBuffHud,80);
    return;
  }
  if(game.playerBuffHudV1Installed)return;
  game.playerBuffHudV1Installed=true;
  ensurePlayerBuffHost();
  syncBuffOwner();
  const originalCastSkill=game.castSkill.bind(game);
  game.castSkill=function(index){
    syncBuffOwner();
    const slot=Number(index);
    const skillId=global.AstraeonSkillsV1?.state?.loadout?.[slot];
    const skill=global.AstraeonSkillsCatalogV1?.get?.(skillId);
    const before=Math.max(0,Number(this.cooldowns?.[slot])||0);
    const result=originalCastSkill(slot);
    const after=Math.max(0,Number(this.cooldowns?.[slot])||0);
    if(skill&&buffDuration(skill)>0&&before<=0&&after>0)registerPlayerBuff(skill);
    return result;
  };
  if(!buffHudFrame)buffHudFrame=requestAnimationFrame(buffHudLoop);
}

function macroLoadout(){
  const loadout=global.AstraeonSkillsV1?.state?.loadout;
  return Array.isArray(loadout)?loadout:null;
}

function macroSlotUsable(game,index){
  const loadout=macroLoadout();
  if(!loadout||!loadout[index]||!game?.player)return false;
  const skillId=loadout[index];
  const learned=global.AstraeonSkillsV1?.state?.learned;
  if(learned instanceof Set&&!learned.has(skillId))return false;
  const skill=global.AstraeonSkillsCatalogV1?.get?.(skillId);
  const cooldown=Math.max(0,Number(game.cooldowns?.[index])||0);
  const mana=Math.max(0,Number(game.player.mana)||0);
  const manaCost=Math.max(0,Number(skill?.mana)||0);
  return cooldown<=.001&&mana>=manaCost;
}

function nextMacroSlot(game,from,usableOnly=true){
  const loadout=macroLoadout();
  if(!loadout?.length)return -1;
  for(let offset=1;offset<=loadout.length;offset++){
    const index=(from+offset)%loadout.length;
    if(!loadout[index])continue;
    if(usableOnly&&!macroSlotUsable(game,index))continue;
    return index;
  }
  return -1;
}

function installSkillMacroEmptySlotGuard(){
  const game=global.astraeon;
  if(!game||typeof game.castSkill!=='function'||!global.AstraeonSkillsV1?.state){
    clearTimeout(macroGuardRetry);
    macroGuardRetry=setTimeout(installSkillMacroEmptySlotGuard,90);
    return;
  }
  if(game.skillMacroEmptySlotGuardV1Installed)return;
  game.skillMacroEmptySlotGuardV1Installed=true;
  const originalCastSkill=game.castSkill.bind(game);
  game.castSkill=function(index,...args){
    const loadout=macroLoadout();
    const slot=Math.max(0,Math.min((loadout?.length||5)-1,Math.trunc(Number(index)||0)));
    const macro=this.mobCombatFocusV4;
    if(macro?.rightHeld&&loadout&&!loadout[slot]){
      let next=nextMacroSlot(this,slot,true);
      if(next<0)next=nextMacroSlot(this,slot,false);
      if(next<0)return false;

      const beforeCooldown=Math.max(0,Number(this.cooldowns?.[next])||0);
      const beforeMana=Math.max(0,Number(this.player?.mana)||0);
      const result=originalCastSkill(next,...args);
      const afterCooldown=Math.max(0,Number(this.cooldowns?.[next])||0);
      const afterMana=Math.max(0,Number(this.player?.mana)||0);
      const used=beforeCooldown<=.001&&(afterCooldown>.001||afterMana<beforeMana);

      macro.skillSelected=next;
      if(used){
        if(Array.isArray(macro.skillMaxCooldowns)){
          const catalogCooldown=Number(global.AstraeonSkillsCatalogV1?.get?.(loadout[next])?.cooldown)||0;
          macro.skillMaxCooldowns[next]=afterCooldown>.001?afterCooldown:Math.max(.001,catalogCooldown);
        }
        macro.skillCursor=(next+1)%loadout.length;
      }else{
        macro.skillCursor=next;
      }
      return used?true:result;
    }
    return originalCastSkill(slot,...args);
  };
}

function ensureQuestStyles(){
  if(document.querySelector('style[data-astraeon-quest-hud-v1]'))return;
  const style=document.createElement('style');
  style.dataset.astraeonQuestHudV1='1';
  style.textContent=`
    .quest-card.quest-medieval{
      --quest-gold:#d8ab55;--quest-gold-bright:#f3d78d;--quest-iron:#302719;
      top:14px!important;right:14px!important;width:min(300px,calc(100vw - 42px))!important;
      padding:0!important;border:1px solid rgba(218,173,87,.38)!important;border-radius:12px!important;
      overflow:visible!important;color:#e9dfcb!important;
      background:linear-gradient(145deg,rgba(35,26,17,.98),rgba(10,9,8,.98) 56%,rgba(19,15,10,.98))!important;
      box-shadow:0 18px 50px rgba(0,0,0,.62),inset 0 0 0 1px rgba(255,232,177,.045),inset 0 0 36px rgba(165,108,36,.05)!important;
      translate:0 0!important;transition:translate .24s ease!important;
    }
    .quest-card.quest-medieval:before{content:"";position:absolute;z-index:0;inset:4px;border:1px solid rgba(236,198,113,.11);border-radius:8px;pointer-events:none}
    .quest-card.quest-medieval:after{content:"✦";position:absolute;z-index:1;right:9px;bottom:5px;color:rgba(231,187,98,.13);font:700 27px/1 Georgia,serif;pointer-events:none}
    .quest-medieval-frame{position:absolute;z-index:0;inset:0;overflow:hidden;border-radius:inherit;pointer-events:none}
    .quest-medieval-frame:before,.quest-medieval-frame:after{content:"";position:absolute;width:31px;height:31px;border-color:rgba(232,190,103,.37);pointer-events:none}
    .quest-medieval-frame:before{left:7px;top:7px;border-left:2px solid;border-top:2px solid;clip-path:polygon(0 0,100% 0,100% 2px,8px 2px,8px 100%,0 100%)}
    .quest-medieval-frame:after{right:7px;bottom:7px;border-right:2px solid;border-bottom:2px solid;clip-path:polygon(0 calc(100% - 2px),calc(100% - 8px) calc(100% - 2px),calc(100% - 8px) 0,100% 0,100% 100%,0 100%)}
    .quest-medieval-head{position:relative;z-index:2;display:grid;grid-template-columns:34px minmax(0,1fr) auto;align-items:center;gap:9px;padding:11px 11px 9px;border-bottom:1px solid rgba(225,182,92,.17);background:linear-gradient(180deg,rgba(108,70,29,.17),rgba(24,18,12,.08))}
    .quest-medieval-seal{width:32px;height:32px;display:grid;place-items:center;border:1px solid rgba(229,184,91,.38);border-radius:50%;background:radial-gradient(circle at 50% 42%,rgba(225,173,75,.2),rgba(31,22,13,.88) 62%);color:#eacb82;font:700 15px/1 Georgia,serif;text-shadow:0 0 10px rgba(239,196,103,.45);box-shadow:inset 0 0 12px #0008,0 3px 9px #0008}
    .quest-medieval-title{min-width:0}.quest-medieval-title small{display:block;color:#9f8c6f;font:900 6px/1 Inter,sans-serif;letter-spacing:.17em}.quest-medieval-title strong{display:block;margin-top:3px;color:#f1ddb3;font:700 13px/1.05 Georgia,serif;letter-spacing:.045em;text-shadow:0 2px 5px #000}
    .quest-state{align-self:start;margin-top:1px;padding:4px 6px;border:1px solid rgba(211,166,78,.23);border-radius:999px;background:rgba(145,95,31,.1);color:#ddb863;font:900 6px/1 Inter,sans-serif;letter-spacing:.09em;font-style:normal}
    .quest-card.quest-complete .quest-state{border-color:rgba(123,190,115,.33);background:rgba(64,123,61,.15);color:#b8df9d;box-shadow:0 0 9px rgba(116,193,94,.09)}
    .quest-medieval-body{position:relative;z-index:2;padding:9px 11px 10px}
    .quest-chapter{display:block;margin-bottom:5px;color:#806f57;font:800 6px/1 Inter,sans-serif;letter-spacing:.14em;text-transform:uppercase}
    .quest-card.quest-medieval #questText{margin:0 0 8px!important;color:#c9bda7!important;font:500 8px/1.4 Inter,sans-serif!important;letter-spacing:0!important;text-shadow:0 1px 2px #000}
    .quest-objectives{display:grid;gap:5px;margin:0 0 9px}
    .quest-objective{display:flex;align-items:center;justify-content:space-between;gap:8px;min-height:26px;padding:5px 7px;border:1px solid rgba(205,165,93,.11);border-radius:6px;background:linear-gradient(90deg,rgba(80,57,30,.12),rgba(4,5,6,.28));box-shadow:inset 0 1px rgba(255,255,255,.018)}
    .quest-objective span{display:flex;align-items:center;gap:6px;color:#a99b85;font:800 7px/1 Inter,sans-serif;letter-spacing:.04em}.quest-objective span i{width:15px;height:15px;display:grid;place-items:center;border:1px solid rgba(214,171,82,.18);border-radius:4px;background:rgba(174,117,42,.08);color:#d5ad5e;font:normal 8px/1 serif}.quest-objective b{color:#e4d6bb;font:900 8px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
    .quest-objective.done{border-color:rgba(122,179,99,.2);background:linear-gradient(90deg,rgba(54,101,47,.12),rgba(4,5,6,.28))}.quest-objective.done span i{border-color:rgba(128,192,104,.25);color:#a8d88c}.quest-objective.done b{color:#b9dc9f}
    .quest-progress-copy{display:flex;align-items:center;justify-content:space-between;margin:0 1px 4px;color:#786c5a;font:800 6px/1 Inter,sans-serif;letter-spacing:.08em;text-transform:uppercase}.quest-progress-copy b{color:#e1bd6d;font:900 7px/1 ui-monospace,SFMono-Regular,Consolas,monospace}
    .quest-card.quest-medieval .quest-progress{position:relative;height:7px!important;margin:0 0 9px!important;overflow:hidden;border:1px solid rgba(230,191,105,.18)!important;border-radius:99px!important;background:#050504!important;box-shadow:inset 0 2px 5px #000c!important}
    .quest-card.quest-medieval .quest-progress i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#6b431a,#bd7d2f 47%,#f0ca75)!important;box-shadow:0 0 9px rgba(229,176,76,.32),inset 0 1px rgba(255,255,255,.26);transition:width .22s ease-out}
    .quest-card.quest-complete .quest-progress i{background:linear-gradient(90deg,#456934,#83ad5d 48%,#d7dc87)!important;box-shadow:0 0 9px rgba(140,196,92,.28)}
    .quest-reward{display:grid!important;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;margin:0!important;padding:7px 8px!important;border:1px solid rgba(219,174,83,.14);border-radius:7px;background:radial-gradient(circle at 85% 40%,rgba(220,166,68,.09),transparent 34%),rgba(8,7,5,.46);color:inherit!important}
    .quest-reward>span{display:block!important}.quest-reward small{display:block;color:#756a5a;font:900 5.5px/1 Inter,sans-serif;letter-spacing:.12em}.quest-reward b{display:block;margin-top:3px;color:#d9c39b;font:700 8px/1.1 Georgia,serif}.quest-reward>span:last-child{text-align:right}.quest-reward>span:last-child b{margin:0;color:#efc96f;font:900 10px/1 ui-monospace,SFMono-Regular,Consolas,monospace}.quest-reward.received{border-color:rgba(117,174,92,.18)}.quest-reward.received b{color:#b9d79b}
    .quest-panel-toggle{position:absolute;z-index:8;left:-25px;top:50%;translate:0 -50%;width:25px;height:44px;display:grid;place-items:center;padding:0;border:1px solid rgba(218,173,87,.28);border-right-color:rgba(218,173,87,.12);border-radius:10px 0 0 10px;background:linear-gradient(180deg,rgba(37,28,17,.99),rgba(8,8,7,.99));color:#e7c573;font:900 14px/1 Inter,sans-serif;box-shadow:-8px 9px 23px #0008,inset 0 1px rgba(255,255,255,.035);cursor:pointer}
    .quest-panel-toggle:hover{color:#fff0bd;border-color:rgba(239,200,112,.5);background:linear-gradient(180deg,rgba(67,47,23,.99),rgba(12,10,8,.99))}
    .quest-card.quest-panel-collapsed{translate:calc(100% + 13px) 0!important}
    @media(max-width:760px){.quest-card.quest-medieval{top:8px!important;right:8px!important;width:min(286px,calc(100vw - 38px))!important}.quest-card.quest-panel-collapsed{translate:calc(100% + 7px) 0!important}}
    @media(max-width:430px){.quest-medieval-head{grid-template-columns:30px minmax(0,1fr) auto;padding:9px}.quest-medieval-seal{width:28px;height:28px}.quest-medieval-title strong{font-size:11px}.quest-medieval-body{padding:8px 9px 9px}.quest-objective{min-height:24px}}
    @media(prefers-reduced-motion:reduce){.quest-card.quest-medieval{transition-duration:.01ms!important}.quest-card.quest-medieval *{transition-duration:.01ms!important}}
  `;
  document.head.appendChild(style);
}

function questElement(tag,className,text){
  const element=document.createElement(tag);
  if(className)element.className=className;
  if(text!==undefined)element.textContent=text;
  return element;
}

function ensureQuestHudMarkup(){
  const card=$('.quest-card');
  if(!card)return null;
  if(card.dataset.questHudV1==='true')return card;
  const questText=card.querySelector('#questText');
  const progress=card.querySelector('.quest-progress');
  const footer=card.querySelector('footer');
  if(!questText||!progress||!footer)return null;

  card.dataset.questHudV1='true';
  card.classList.add('quest-medieval');
  const frame=questElement('div','quest-medieval-frame');frame.setAttribute('aria-hidden','true');
  const head=questElement('header','quest-medieval-head');
  const seal=questElement('span','quest-medieval-seal','✦');seal.setAttribute('aria-hidden','true');
  const title=questElement('div','quest-medieval-title');title.append(questElement('small','', 'JORNADA PRINCIPAL'),questElement('strong','', 'CONVERGÊNCIA'));
  const state=questElement('em','quest-state','EM CURSO');state.id='questStateText';
  head.append(seal,title,state);

  const body=questElement('div','quest-medieval-body');
  body.appendChild(questElement('span','quest-chapter','I · ECOS DA CONVERGÊNCIA'));
  questText.className='quest-medieval-copy';
  body.appendChild(questText);

  const objectives=questElement('div','quest-objectives');
  const kills=questElement('div','quest-objective');kills.id='questKillsObjective';
  const killsLabel=questElement('span');const killsIcon=questElement('i','', '⚔');killsIcon.setAttribute('aria-hidden','true');killsLabel.append(killsIcon,document.createTextNode(' Criaturas abatidas'));
  const killsValue=questElement('b','', '0 / 12');killsValue.id='questKillsDetail';kills.append(killsLabel,killsValue);
  const biomes=questElement('div','quest-objective');biomes.id='questBiomesObjective';
  const biomesLabel=questElement('span');const biomesIcon=questElement('i','', '◈');biomesIcon.setAttribute('aria-hidden','true');biomesLabel.append(biomesIcon,document.createTextNode(' Biomas explorados'));
  const biomesValue=questElement('b','', '0 / 3');biomesValue.id='questBiomesDetail';biomes.append(biomesLabel,biomesValue);
  objectives.append(kills,biomes);body.appendChild(objectives);

  const progressCopy=questElement('div','quest-progress-copy');progressCopy.append(questElement('span','', 'Progresso da jornada'));
  const progressValue=questElement('b','', '0%');progressValue.id='questProgressDetail';progressCopy.append(progressValue);body.appendChild(progressCopy);
  progress.classList.add('quest-medieval-progress');body.appendChild(progress);

  footer.className='quest-reward';footer.replaceChildren();
  const rewardItem=questElement('span');rewardItem.append(questElement('small','', 'RECOMPENSA'),questElement('b','', 'Núcleo de Astraeon'));
  const rewardGold=questElement('span');rewardGold.append(questElement('b','', '+120'),questElement('small','', 'OURO'));
  footer.append(rewardItem,rewardGold);body.appendChild(footer);

  card.replaceChildren(frame,head,body);
  const toggle=questElement('button','quest-panel-toggle','›');toggle.id='questPanelToggle';toggle.type='button';card.appendChild(toggle);

  const apply=(collapsed,persist=false)=>{
    card.classList.toggle('quest-panel-collapsed',collapsed);
    toggle.textContent=collapsed?'‹':'›';
    toggle.setAttribute('aria-expanded',String(!collapsed));
    toggle.setAttribute('aria-label',collapsed?'Abrir jornada principal':'Recolher jornada principal');
    toggle.title=collapsed?'Abrir jornada principal':'Recolher jornada principal';
    if(persist){try{localStorage.setItem(QUEST_PANEL_STATE_KEY,collapsed?'1':'0');}catch(_){}}
  };
  let initial=false;try{initial=localStorage.getItem(QUEST_PANEL_STATE_KEY)==='1';}catch(_){}
  apply(initial,false);
  toggle.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();apply(!card.classList.contains('quest-panel-collapsed'),true);});

  const enforceOverflow=()=>{
    if(card.style.getPropertyValue('overflow')!=='visible'||card.style.getPropertyPriority('overflow')!=='important')card.style.setProperty('overflow','visible','important');
  };
  enforceOverflow();
  new MutationObserver(enforceOverflow).observe(card,{attributes:true,attributeFilter:['style']});
  return card;
}

function refreshQuestHud(game){
  const card=$('.quest-card.quest-medieval');
  const quest=game?.quest;
  if(!card||!quest)return;
  const goal=Math.max(1,Number(quest.goal)||12);
  const kills=Math.max(0,Number(quest.kills)||0);
  const explored=Math.max(0,Number(quest.biomes?.size)||0);
  const done=kills>=goal&&explored>=3;
  const rewarded=!!quest.reward;
  const progress=Math.min(100,((kills/goal)*.7+(explored/3)*.3)*100);

  const text=card.querySelector('#questText');
  if(text)text.textContent=done?'A Convergência foi estabilizada. Sua jornada nesta missão foi concluída.':'Derrote criaturas e atravesse novos biomas para estabilizar a Convergência.';
  const killsDetail=card.querySelector('#questKillsDetail');if(killsDetail)killsDetail.textContent=`${Math.min(kills,goal)} / ${goal}`;
  const biomesDetail=card.querySelector('#questBiomesDetail');if(biomesDetail)biomesDetail.textContent=`${Math.min(explored,3)} / 3`;
  const progressDetail=card.querySelector('#questProgressDetail');if(progressDetail)progressDetail.textContent=`${Math.round(progress)}%`;
  const state=card.querySelector('#questStateText');if(state)state.textContent=done?'CONCLUÍDA':'EM CURSO';
  card.querySelector('#questKillsObjective')?.classList.toggle('done',kills>=goal);
  card.querySelector('#questBiomesObjective')?.classList.toggle('done',explored>=3);
  card.classList.toggle('quest-complete',done);
  const reward=card.querySelector('.quest-reward');reward?.classList.toggle('received',rewarded);
  const rewardLabel=reward?.querySelector('small');if(rewardLabel)rewardLabel.textContent=rewarded?'RECOMPENSA RECEBIDA':'RECOMPENSA';
}

function installQuestHud(){
  const game=global.astraeon;
  if(!game||typeof game.updateUI!=='function'||!$('.quest-card')){
    clearTimeout(questHudRetry);
    questHudRetry=setTimeout(installQuestHud,80);
    return;
  }
  if(game.questHudV1Installed)return;
  ensureQuestStyles();
  if(!ensureQuestHudMarkup()){
    clearTimeout(questHudRetry);
    questHudRetry=setTimeout(installQuestHud,80);
    return;
  }
  game.questHudV1Installed=true;
  const originalUpdateUI=game.updateUI.bind(game);
  game.updateUI=function(){
    const result=originalUpdateUI();
    refreshQuestHud(this);
    return result;
  };
  refreshQuestHud(game);
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
  installPlayerBuffHud();
  installSkillMacroEmptySlotGuard();
  installQuestHud();
}
global.AstraeonPlayerWorldHudV1={install:installPlayerWorldHud,installBuffHud:installPlayerBuffHud,installQuestHud,installSkillMacroGuard:installSkillMacroEmptySlotGuard};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

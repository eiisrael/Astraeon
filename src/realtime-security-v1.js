(function(root){
'use strict';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULTS=Object.freeze({
  statePerSecond:15,
  actionPerSecond:12,
  maxPastMs:10000,
  maxFutureMs:5000,
  maxCoordinate:10000000,
  maxSpeed:520,
  movementSlack:96,
  resetAfterMs:3000,
  maxEffects:300
});

function finite(value){const number=Number(value);return Number.isFinite(number)?number:null;}
function integer(value){const number=finite(value);return number!==null&&Number.isSafeInteger(number)?number:null;}
function validUserId(value){return UUID.test(String(value||''));}
function clamp(value,min,max){return Math.max(min,Math.min(max,value));}

function createGuard(options={}){
  const config={...DEFAULTS,...options};
  const remoteRate=new Map();
  const lastRemoteTs=new Map();
  const lastRemoteSeq=new Map();
  const positions=new Map();
  const suspicious=new Map();

  function reject(reason){return{accepted:false,reason};}
  function note(userId,reason){
    const key=`${userId}:${reason}`,count=(suspicious.get(key)||0)+1;
    suspicious.set(key,count);return count;
  }
  function accept(kind,userId,payload,now=Date.now()){
    if(kind!=='state'&&kind!=='action')return reject('invalid_kind');
    if(!validUserId(userId)||!payload||typeof payload!=='object')return reject('invalid_identity');
    const seq=integer(payload.seq),ts=integer(payload.client_ts??payload.ts),serverNow=finite(now);
    if(seq===null||seq<=0)return reject('invalid_seq');
    if(ts===null||serverNow===null||ts<serverNow-config.maxPastMs||ts>serverNow+config.maxFutureMs)return reject('invalid_timestamp');

    const eventKey=`${kind}:${userId}`;
    if(seq<=(lastRemoteSeq.get(eventKey)||0))return reject('stale_seq');
    if(ts<=(lastRemoteTs.get(eventKey)||0))return reject('stale_timestamp');
    const limit=kind==='state'?config.statePerSecond:config.actionPerSecond;
    const times=(remoteRate.get(eventKey)||[]).filter(value=>serverNow-value<1000);
    if(times.length>=limit){remoteRate.set(eventKey,times);note(userId,`${kind}_flood`);return reject('rate_limited');}

    const clean={...payload,seq,client_ts:ts,user_id:userId};
    let clamped=false;
    if(kind==='state'){
      let x=finite(payload.x),y=finite(payload.y);
      if(x===null||y===null||x<0||y<0||x>config.maxCoordinate||y>config.maxCoordinate)return reject('invalid_position');
      const previous=positions.get(userId);
      if(previous){
        const elapsed=ts-previous.ts;
        if(elapsed>0&&elapsed<config.resetAfterMs){
          const dx=x-previous.x,dy=y-previous.y,distance=Math.hypot(dx,dy);
          const maxDistance=config.movementSlack+config.maxSpeed*(elapsed/1000);
          if(distance>maxDistance&&distance>0){
            x=previous.x+dx/distance*maxDistance;
            y=previous.y+dy/distance*maxDistance;
            clamped=true;note(userId,'impossible_movement');
          }
        }
      }
      clean.x=clamp(x,0,config.maxCoordinate);
      clean.y=clamp(y,0,config.maxCoordinate);
      clean.facing=Number(payload.facing)<0?-1:1;
      positions.set(userId,{x:clean.x,y:clean.y,ts});
    }else{
      if(payload.action_type!=='attack'&&payload.action_type!=='skill')return reject('invalid_action');
      clean.action_type=payload.action_type;
      clean.action_index=clamp(integer(payload.action_index)??0,0,4);
    }

    times.push(serverNow);remoteRate.set(eventKey,times);
    lastRemoteSeq.set(eventKey,seq);lastRemoteTs.set(eventKey,ts);
    return{accepted:true,value:clean,clamped};
  }

  function forget(userId){
    positions.delete(userId);
    for(const map of [remoteRate,lastRemoteTs,lastRemoteSeq,suspicious]){
      for(const key of map.keys())if(key===userId||String(key).includes(userId))map.delete(key);
    }
  }
  function prune(now=Date.now(),maxAge=30000){
    for(const [userId,position] of positions)if(now-position.ts>maxAge)forget(userId);
  }
  return{accept,forget,prune,remoteRate,lastRemoteTs,lastRemoteSeq,positions,suspicious,config};
}

function pushBoundedEffect(effects,effect,limit=DEFAULTS.maxEffects){
  if(!Array.isArray(effects)||!effect)return false;
  const safeLimit=Math.max(1,Math.min(1000,Number(limit)||DEFAULTS.maxEffects));
  if(effects.length>=safeLimit)effects.splice(0,effects.length-safeLimit+1);
  effects.push(effect);return true;
}

function publicProfile(row){
  if(!row||!validUserId(row.user_id))return null;
  const username=String(row.username||'').replace(/[^A-Za-z0-9_]/g,'').slice(0,18)||'Viajante';
  const classId=['Warrior','Mage','Archer','Assassin','Paladine'].includes(row.class_id)?row.class_id:'Warrior';
  return{
    userId:row.user_id,
    username,
    displayName:String(row.display_name||username).slice(0,24),
    classId,
    level:clamp(integer(row.level)??1,1,999),
    isAdmin:row.is_admin===true
  };
}

root.AstraeonRealtimeSecurityV1={DEFAULTS,createGuard,pushBoundedEffect,publicProfile,validUserId};
})(typeof globalThis!=='undefined'?globalThis:window);

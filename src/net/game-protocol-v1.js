(function (global) {
  'use strict';
  const VERSION = '1.0.0';
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  const KINDS = Object.freeze(['bootstrap','sync','move','attack','skill','inventory_equip','inventory_unequip','inventory_use','inventory_discard','inventory_reorder','quest_claim']);
  const KIND_SET = new Set(KINDS), MAX_PAYLOAD_BYTES = 8192;
  function uuid(){if(global.crypto?.randomUUID)return global.crypto.randomUUID();const bytes=new Uint8Array(16);global.crypto?.getRandomValues?.(bytes);bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;return[...bytes].map((b,i)=>`${[4,6,8,10].includes(i)?'-':''}${b.toString(16).padStart(2,'0')}`).join('');}
  function plain(value){return!!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;}
  function finite(value,min,max){const number=Number(value);if(!Number.isFinite(number)||number<min||number>max)throw new Error('invalid_number');return number;}
  function cleanPayload(kind,payload={}){
    if(!plain(payload))throw new Error('invalid_payload');const out={};
    if(kind==='move'||kind==='bootstrap'){if(payload.x!==undefined)out.x=finite(payload.x,0,1000000);if(payload.y!==undefined)out.y=finite(payload.y,0,1000000);if(payload.worldKey!==undefined)out.worldKey=String(payload.worldKey).slice(0,32);if(payload.clientTs!==undefined)out.clientTs=Math.trunc(finite(payload.clientTs,1,Number.MAX_SAFE_INTEGER));}
    else if(kind==='attack'){if(!UUID.test(String(payload.targetMobId||'')))throw new Error('invalid_target');out.targetMobId=String(payload.targetMobId);}
    else if(kind==='skill'){out.index=Math.trunc(finite(payload.index,0,4));if(payload.targetMobId!=null){if(!UUID.test(String(payload.targetMobId)))throw new Error('invalid_target');out.targetMobId=String(payload.targetMobId);}if(payload.x!==undefined)out.x=finite(payload.x,0,1000000);if(payload.y!==undefined)out.y=finite(payload.y,0,1000000);}
    else if(kind.startsWith('inventory_')){if(payload.inventoryId!=null){if(!UUID.test(String(payload.inventoryId)))throw new Error('invalid_inventory_id');out.inventoryId=String(payload.inventoryId);}if(payload.slot!=null)out.slot=String(payload.slot).slice(0,32);if(payload.quantity!=null)out.quantity=Math.trunc(finite(payload.quantity,1,9999));if(payload.toIndex!=null)out.toIndex=Math.trunc(finite(payload.toIndex,0,9999));}
    else if(kind==='quest_claim'){out.questId=String(payload.questId||'').replace(/[^a-z0-9_\-]/gi,'').slice(0,80);if(!out.questId)throw new Error('invalid_quest');}
    if(new TextEncoder().encode(JSON.stringify(out)).length>MAX_PAYLOAD_BYTES)throw new Error('payload_too_large');return out;
  }
  function envelope(kind,characterId,payload={}){if(!KIND_SET.has(kind))throw new Error('invalid_kind');if(!UUID.test(String(characterId||'')))throw new Error('invalid_character');return{protocol:VERSION,kind,characterId:String(characterId),operationId:uuid(),payload:cleanPayload(kind,payload)};}
  function isSnapshot(value){return plain(value)&&plain(value.player)&&Array.isArray(value.mobs)&&plain(value.progress);}
  global.AstraeonGameProtocolV1={VERSION,KINDS,envelope,cleanPayload,isSnapshot,isUuid:value=>UUID.test(String(value||''))};
})(window);

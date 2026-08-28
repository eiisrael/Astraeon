(function(global){
'use strict';
const W=global.AstraeonWorld;
const state={installed:false,client:null,session:null,lastUpdated:null,channel:null,timer:null};
function mp(){return global.AstraeonMultiplayerV4?.state||null;}
function game(){return global.astraeon||null;}
function apply(config){if(!config||typeof config!=='object'||!W)return;const g=game();if(g?.adminConfigV3C){const target=g.adminConfigV3C;target.enabled=config.enabled!==false;for(const key of ['gameplay','classes','mobs','items','biomes']){target[key]=target[key]&&typeof target[key]==='object'?target[key]:{};Object.assign(target[key],config[key]||{});}const gameplay=target.gameplay||{};if(Number.isFinite(Number(gameplay.sprintMultiplier)))g.adminSprintMultiplier=Number(gameplay.sprintMultiplier);if(Number.isFinite(Number(gameplay.staminaMax))){g.staminaMax=Math.max(1,Number(gameplay.staminaMax));g.stamina=Math.min(g.staminaMax,Number.isFinite(Number(g.stamina))?Number(g.stamina):g.staminaMax);}if(Number.isFinite(Number(gameplay.staminaDrain)))g.adminStaminaDrain=Math.max(0,Number(gameplay.staminaDrain));if(Number.isFinite(Number(gameplay.staminaRegen)))g.adminStaminaRegen=Math.max(0,Number(gameplay.staminaRegen));if(Number.isFinite(Number(gameplay.staminaDelay)))g.adminStaminaDelay=Math.max(0,Number(gameplay.staminaDelay));}
  for(const [id,ov] of Object.entries(config.classes||{}))if(W.CLASS_DATA?.[id])Object.assign(W.CLASS_DATA[id],ov);
  for(const [id,ov] of Object.entries(config.mobs||{}))if(W.MOB_DATA?.[id])Object.assign(W.MOB_DATA[id],ov);
  for(const [id,ov] of Object.entries(config.biomes||{}))if(W.BIOMES?.[id])Object.assign(W.BIOMES[id],ov);
  const A=global.AstraeonItems;if(A?.items)for(const [id,ov] of Object.entries(config.items||{})){const item=A.items[id];if(!item)continue;if(ov.stats)item.stats={...(item.stats||{}),...ov.stats};for(const [k,v] of Object.entries(ov))if(k!=='stats')item[k]=v;}
  if(g?.world&&typeof g.updateUI==='function')g.updateUI();
}
async function refresh(){const s=mp();state.client=s?.client||null;state.session=s?.session||null;if(!state.client||!state.session)return false;try{const {data,error}=await state.client.from('admin_runtime_config').select('config,updated_at').eq('config_key','global').maybeSingle();if(error)throw error;if(data?.config){apply(data.config);state.lastUpdated=data.updated_at||null;}return true;}catch(error){if(!/admin_runtime_config|relation/i.test(error.message||''))console.warn('[Astraeon Server Config]',error.message||error);return false;}}
async function connectRealtime(){const s=mp();if(!s?.client||!s.session||state.channel)return;try{const channel=s.client.channel('admin-config:astraeon',{config:{private:true}});channel.on('postgres_changes',{event:'UPDATE',schema:'public',table:'admin_runtime_config',filter:'config_key=eq.global'},payload=>{if(payload.new?.config){apply(payload.new.config);state.lastUpdated=payload.new.updated_at||null;}});await channel.subscribe();state.channel=channel;}catch(error){console.warn('[Astraeon Server Config realtime]',error.message||error);}}
function install(){if(state.installed)return;const s=mp();if(!s?.client||!s.session||!game()){setTimeout(install,200);return;}state.installed=true;void refresh();void connectRealtime();state.timer=setInterval(()=>void refresh(),30000);}
function wait(){if(game())install();else setTimeout(wait,120);}if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',wait);else wait();
global.addEventListener('beforeunload',()=>{if(state.timer)clearInterval(state.timer);try{if(state.channel)mp()?.client?.removeChannel?.(state.channel);}catch(_){}});
global.AstraeonServerConfigV62={state,install,refresh,apply};
})(window);

(function(global){
'use strict';
const STORAGE='astraeon:v3c:admin';
const state={installed:false,timer:null,last:'',syncing:false,queued:false};
const $=s=>document.querySelector(s);
const client=()=>global.AstraeonAdminAuth?.client;
const adminId=()=>global.AstraeonAdminAuth?.session?.user?.id||null;
function read(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'{}');return value&&typeof value==='object'?value:{};}catch(_){return{};}}
async function sync(force=false){if(!client()||!adminId())return false;if(state.syncing){state.queued=true;return true;}const config=read(),serialized=JSON.stringify(config);if(!force&&serialized===state.last)return true;state.syncing=true;try{const {error}=await client().from('admin_runtime_config').upsert({config_key:'global',config,updated_by:adminId()},{onConflict:'config_key'});if(error)throw error;state.last=serialized;global.AstraeonAdminRealtimeV62?.queueBackup?.('admin_runtime_config','global',config,{delay:3500});global.AstraeonEditorDiagnosticsV5?.info?.('admin.server_config.synced',{bytes:serialized.length});return true;}catch(error){console.warn('[Astraeon Admin Server Config]',error.message||error);global.AstraeonEditorDiagnosticsV5?.warn?.('admin.server_config.failed',{error:String(error.message||error)});return false;}finally{state.syncing=false;if(state.queued){state.queued=false;schedule(600);}}}
function schedule(delay=1800){clearTimeout(state.timer);state.timer=setTimeout(()=>void sync(),delay);}
function install(){if(state.installed)return;const content=$('#adminContent');if(!content||Number(global.AstraeonAdminAuth?.access)!==3){setTimeout(install,100);return;}state.installed=true;state.last=JSON.stringify(read());const onEdit=event=>{if(event.target.matches('input,select,textarea'))schedule();};content.addEventListener('input',onEdit,true);content.addEventListener('change',onEdit,true);content.addEventListener('click',event=>{if(event.target.closest('button'))schedule(1200);},true);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')void sync();});}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',install);else install();
global.AstraeonAdminServerConfigV62={state,install,sync};
})(window);

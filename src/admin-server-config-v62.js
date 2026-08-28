(function(global){
'use strict';
const STORAGE='astraeon:v3c:admin';
const state={installed:false,timer:null,last:''};
const $=s=>document.querySelector(s);
const client=()=>global.AstraeonAdminAuth?.client;
const adminId=()=>global.AstraeonAdminAuth?.session?.user?.id||null;
function read(){try{const value=JSON.parse(localStorage.getItem(STORAGE)||'{}');return value&&typeof value==='object'?value:{};}catch(_){return{};}}
async function sync(force=false){if(!client()||!adminId())return false;const config=read(),serialized=JSON.stringify(config);if(!force&&serialized===state.last)return true;try{const {error}=await client().from('admin_runtime_config').upsert({config_key:'global',config,updated_by:adminId()},{onConflict:'config_key'});if(error)throw error;state.last=serialized;await global.AstraeonAdminRealtimeV62?.backup?.('admin_runtime_config','global',config);global.AstraeonEditorDiagnosticsV5?.info?.('admin.server_config.synced',{bytes:serialized.length});return true;}catch(error){console.warn('[Astraeon Admin Server Config]',error.message||error);global.AstraeonEditorDiagnosticsV5?.warn?.('admin.server_config.failed',{error:String(error.message||error)});return false;}}
function schedule(){clearTimeout(state.timer);state.timer=setTimeout(()=>void sync(),1650);}
function install(){if(state.installed)return;const content=$('#adminContent');if(!content||Number(global.AstraeonAdminAuth?.access)!==3){setTimeout(install,100);return;}state.installed=true;state.last=JSON.stringify(read());content.addEventListener('input',event=>{if(event.target.matches('input,select,textarea'))schedule();},true);content.addEventListener('change',event=>{if(event.target.matches('input,select,textarea'))schedule();},true);content.addEventListener('click',event=>{if(event.target.closest('button'))setTimeout(()=>void sync(),1000);},true);global.addEventListener('beforeunload',()=>{void sync();});setTimeout(()=>void sync(true),800);}
if(document.readyState==='loading')global.addEventListener('DOMContentLoaded',install);else install();
global.AstraeonAdminServerConfigV62={state,install,sync};
})(window);

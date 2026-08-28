(function(global){
'use strict';
const VERSION='5.0-diagnostics-1';
const STORAGE='astraeon:v5:editor-diagnostics';
const MAX_LOGS=450;
const PERSIST_LOGS=220;
let installed=false;
let editorInstrumented=false;
let logs=[];
let errorCount=0;
const $=s=>document.querySelector(s);
const now=()=>new Date().toISOString();

function clean(value,depth=0){
  if(depth>3)return '[depth-limit]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,700);
  if(value instanceof Error)return{name:value.name,message:value.message,stack:String(value.stack||'').slice(0,1800)};
  if(Array.isArray(value))return value.slice(0,30).map(v=>clean(v,depth+1));
  if(typeof value==='object'){
    const out={};
    for(const[k,v]of Object.entries(value)){
      if(/password|token|authorization|secret|key/i.test(k)){out[k]='[redacted]';continue;}
      try{out[k]=clean(v,depth+1);}catch(_){out[k]='[unserializable]';}
    }
    return out;
  }
  return String(value).slice(0,700);
}
function persist(){try{sessionStorage.setItem(STORAGE,JSON.stringify(logs.slice(-PERSIST_LOGS)));}catch(_){}}
function restore(){try{const raw=JSON.parse(sessionStorage.getItem(STORAGE)||'[]');if(Array.isArray(raw))logs=raw.slice(-PERSIST_LOGS);}catch(_){logs=[];}errorCount=logs.filter(x=>x.level==='error').length;}
function log(level,event,data={}){
  const entry={time:now(),level:String(level||'info'),event:String(event||'event'),data:clean(data)};
  logs.push(entry);if(logs.length>MAX_LOGS)logs=logs.slice(-MAX_LOGS);if(entry.level==='error')errorCount++;
  persist();render();return entry;
}
function info(event,data){return log('info',event,data);}
function warn(event,data){return log('warn',event,data);}
function error(event,data){return log('error',event,data);}

function describe(el){
  if(!(el instanceof Element))return{tag:null};
  const text=(el.textContent||'').trim().replace(/\s+/g,' ').slice(0,90);
  const style=getComputedStyle(el);
  return{tag:el.tagName.toLowerCase(),id:el.id||null,className:String(el.className||'').slice(0,160),text,disabled:'disabled'in el?!!el.disabled:undefined,pointerEvents:style.pointerEvents,display:style.display,visibility:style.visibility};
}
function snapshot(){
  const editor=global.astraeonEditor,canvas=$('#editorCanvas'),rect=canvas?.getBoundingClientRect?.(),auth=global.AstraeonAdminAuth?.state;
  let storageOK=true;try{localStorage.setItem('astraeon:v5:diag-probe','1');localStorage.removeItem('astraeon:v5:diag-probe');}catch(_){storageOK=false;}
  return{
    version:VERSION,time:now(),path:location.pathname,readyState:document.readyState,viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio||1},
    auth:{unlocked:!!auth?.unlocked,access:auth?.access??null,hasSession:!!auth?.session},
    runtime:{world:!!global.AstraeonWorld,editor:!!editor,adminPanel:!!$('#adminPanel'),studio:!!global.AstraeonAdminStudioV5},
    ui:{toolButtons:document.querySelectorAll('.tool-btn').length,paletteButtons:document.querySelectorAll('#biomePalette .palette-btn').length,objectOptions:$('#objectSelect')?.options?.length||0,mobOptions:$('#mobSelect')?.options?.length||0},
    canvas:canvas?{width:canvas.width,height:canvas.height,clientWidth:canvas.clientWidth,clientHeight:canvas.clientHeight,rect:rect?{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}:null,pointerEvents:getComputedStyle(canvas).pointerEvents}:null,
    world:editor?.world?{width:editor.world.width,height:editor.world.height,seed:editor.design?.seed||null,overrides:Object.keys(editor.design?.overrides||{}).length,spawns:(editor.design?.spawns||[]).length,tool:editor.tool,zoom:editor.view?.zoom}:null,
    capabilities:{fileSystemAccess:typeof global.showSaveFilePicker==='function',clipboard:!!navigator.clipboard,localStorage:storageOK},
    activeElement:describe(document.activeElement),errors:errorCount,logs:logs.length
  };
}
function formatEntry(entry){
  const stamp=entry.time?.replace(/^.*T/,'').replace('Z','')||'';
  let payload='';try{payload=Object.keys(entry.data||{}).length?' '+JSON.stringify(entry.data):'';}catch(_){}
  return `[${stamp}] ${String(entry.level||'info').toUpperCase()} ${entry.event}${payload}`;
}
function exportText(){
  const header=['ASTRAEON ADMIN STUDIO DIAGNOSTICS',`Version: ${VERSION}`,`Generated: ${now()}`,'',`SNAPSHOT ${JSON.stringify(snapshot(),null,2)}`,'','EVENTS'];
  return header.concat(logs.map(formatEntry)).join('\n');
}
async function copyLogs(){
  const text=exportText();
  try{await navigator.clipboard.writeText(text);info('diagnostics.copy.success');}
  catch(err){error('diagnostics.copy.failure',err);const area=$('#studioDiagnosticsText');if(area){area.value=text;area.select();document.execCommand?.('copy');}}
}
function downloadLogs(){
  const blob=new Blob([exportText()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=`astraeon-admin-diagnostics-${new Date().toISOString().replace(/[:.]/g,'-')}.txt`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);info('diagnostics.export.success');
}
function clearLogs(){logs=[];errorCount=0;persist();info('diagnostics.cleared');}

function injectUI(){
  if($('#studioDiagnosticsPanel'))return;
  const style=document.createElement('style');style.dataset.editorDiagnostics='1';style.textContent=`
#studioDiagnosticsLauncher{position:fixed;right:12px;bottom:34px;z-index:420;min-width:64px;height:28px;padding:0 9px;border:1px solid rgba(117,210,244,.28);border-radius:7px;background:rgba(5,14,21,.94);color:#bcecff;font:800 9px Inter,sans-serif;box-shadow:0 8px 28px rgba(0,0,0,.45);cursor:pointer}#studioDiagnosticsLauncher[data-errors]:after{content:attr(data-errors);display:inline-grid;place-items:center;min-width:15px;height:15px;margin-left:5px;padding:0 3px;border-radius:999px;background:#8f3238;color:#ffd6d8;font-size:8px}
#studioDiagnosticsPanel{position:fixed;right:10px;bottom:68px;z-index:421;width:min(720px,calc(100vw - 20px));height:min(560px,calc(100vh - 90px));display:grid;grid-template-rows:auto auto minmax(0,1fr);border:1px solid rgba(117,210,244,.2);border-radius:12px;background:#061018;color:#dcecf3;box-shadow:0 24px 90px rgba(0,0,0,.72);overflow:hidden}#studioDiagnosticsPanel.hidden{display:none!important}.studio-diag-head{display:flex;align-items:center;gap:8px;padding:9px 10px;border-bottom:1px solid rgba(117,210,244,.1);background:#091722}.studio-diag-head div{min-width:0}.studio-diag-head b,.studio-diag-head small{display:block}.studio-diag-head b{font-size:11px;color:#dff7ff}.studio-diag-head small{font-size:8px;color:#7899a8}.studio-diag-actions{margin-left:auto;display:flex;gap:5px;flex-wrap:wrap}.studio-diag-actions button{min-height:27px;padding:5px 7px;border:1px solid rgba(117,210,244,.15);border-radius:6px;background:rgba(117,210,244,.05);color:#bfe8f7;font-size:8px;cursor:pointer}.studio-diag-summary{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:5px;padding:7px;background:#050d13;border-bottom:1px solid rgba(255,255,255,.05)}.studio-diag-card{min-width:0;padding:6px;border:1px solid rgba(255,255,255,.06);border-radius:6px;background:rgba(255,255,255,.018)}.studio-diag-card span,.studio-diag-card b{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.studio-diag-card span{font-size:7px;text-transform:uppercase;letter-spacing:.08em;color:#698895}.studio-diag-card b{margin-top:2px;font-size:9px;color:#cfe7f0}.studio-diag-body{min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 240px}.studio-diag-log{min-width:0;min-height:0;overflow:auto;margin:0;padding:9px;background:#03090e;color:#9ec1cf;font:8px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;white-space:pre-wrap;word-break:break-word}.studio-diag-snapshot{width:100%;height:100%;resize:none;border:0;border-left:1px solid rgba(255,255,255,.05);outline:0;padding:9px;background:#071119;color:#8faebc;font:8px/1.4 ui-monospace,SFMono-Regular,Consolas,monospace}@media(max-width:700px){#studioDiagnosticsLauncher{bottom:28px}.studio-diag-summary{grid-template-columns:repeat(2,minmax(0,1fr))}.studio-diag-body{grid-template-columns:1fr}.studio-diag-snapshot{display:none}}
`;document.head.appendChild(style);
  const launcher=document.createElement('button');launcher.id='studioDiagnosticsLauncher';launcher.type='button';launcher.textContent='Logs';launcher.title='Abrir diagnóstico do Admin Studio';
  const panel=document.createElement('section');panel.id='studioDiagnosticsPanel';panel.className='hidden';panel.innerHTML=`<header class="studio-diag-head"><div><b>Diagnóstico do Admin Studio</b><small>Interações, erros, runtime, canvas e estado do mapa</small></div><div class="studio-diag-actions"><button data-diag="refresh">Atualizar</button><button data-diag="copy">Copiar</button><button data-diag="export">Exportar .txt</button><button data-diag="clear">Limpar</button><button data-diag="close">Fechar</button></div></header><div id="studioDiagnosticsSummary" class="studio-diag-summary"></div><div class="studio-diag-body"><pre id="studioDiagnosticsLog" class="studio-diag-log"></pre><textarea id="studioDiagnosticsText" class="studio-diag-snapshot" readonly spellcheck="false"></textarea></div>`;
  document.body.append(launcher,panel);
  launcher.addEventListener('click',()=>{panel.classList.toggle('hidden');info('diagnostics.panel.toggle',{open:!panel.classList.contains('hidden')});render();});
  panel.addEventListener('click',event=>{const action=event.target.closest('[data-diag]')?.dataset.diag;if(!action)return;if(action==='refresh'){info('diagnostics.snapshot.manual',snapshot());render();}if(action==='copy')void copyLogs();if(action==='export')downloadLogs();if(action==='clear')clearLogs();if(action==='close')panel.classList.add('hidden');});
}
function render(){
  const launcher=$('#studioDiagnosticsLauncher');if(launcher){if(errorCount)launcher.dataset.errors=String(errorCount);else delete launcher.dataset.errors;}
  const panel=$('#studioDiagnosticsPanel');if(!panel||panel.classList.contains('hidden'))return;
  const snap=snapshot(),summary=$('#studioDiagnosticsSummary'),logEl=$('#studioDiagnosticsLog'),text=$('#studioDiagnosticsText');
  if(summary)summary.innerHTML=`<div class="studio-diag-card"><span>Editor</span><b>${snap.runtime.editor?'ATIVO':'AUSENTE'}</b></div><div class="studio-diag-card"><span>Canvas</span><b>${snap.canvas?.clientWidth||0}×${snap.canvas?.clientHeight||0}</b></div><div class="studio-diag-card"><span>Biomas</span><b>${snap.ui.paletteButtons}/5</b></div><div class="studio-diag-card"><span>Objetos/Mobs</span><b>${snap.ui.objectOptions}/${snap.ui.mobOptions}</b></div><div class="studio-diag-card"><span>Erros</span><b>${snap.errors}</b></div>`;
  if(logEl){logEl.textContent=logs.slice(-180).map(formatEntry).join('\n');logEl.scrollTop=logEl.scrollHeight;}
  if(text)text.value=JSON.stringify(snap,null,2);
}

function wrapEditorMethod(editor,name){
  const original=editor?.[name];if(typeof original!=='function'||original.__astraeonDiagWrapped)return;
  const wrapped=function(...args){
    info(`editor.${name}.start`,{args:clean(args)});
    try{
      const result=original.apply(this,args);
      if(result&&typeof result.then==='function')return result.then(value=>{info(`editor.${name}.ok`);return value;}).catch(err=>{error(`editor.${name}.error`,err);throw err;});
      info(`editor.${name}.ok`);return result;
    }catch(err){error(`editor.${name}.error`,err);throw err;}
  };
  wrapped.__astraeonDiagWrapped=true;editor[name]=wrapped;
}
function instrumentEditor(editor){
  if(!editor||editorInstrumented)return;editorInstrumented=true;
  ['setTool','save','validateAndRender','newMap','undo','redo','linkExportFile','exportDesign','jumpToInputs','clearSpawns','clearOverrides','handleInspectorAction','commitEdit','flushAutosave','rebuild','pointerDown'].forEach(name=>wrapEditorMethod(editor,name));
  info('editor.instrumented',{world:{width:editor.world?.width,height:editor.world?.height,seed:editor.design?.seed},canvas:{width:editor.canvas?.clientWidth,height:editor.canvas?.clientHeight}});render();
}
function watchEditor(){
  let attempts=0;const timer=setInterval(()=>{attempts++;if(global.astraeonEditor){clearInterval(timer);instrumentEditor(global.astraeonEditor);return;}if(attempts===8)warn('editor.waiting',{readyState:document.readyState});if(attempts>=40){clearInterval(timer);error('editor.missing.after_runtime',{snapshot:snapshot()});}},100);
}
function installGlobalHooks(){
  global.addEventListener('error',event=>error('window.error',{message:event.message,filename:event.filename,lineno:event.lineno,colno:event.colno,error:event.error}));
  global.addEventListener('unhandledrejection',event=>error('window.unhandledrejection',{reason:event.reason instanceof Error?event.reason:clean(event.reason)}));
  document.addEventListener('click',event=>{const target=event.target.closest?.('button,a,input,select,[data-tool],[data-inspector-action]')||event.target;info('ui.click',{target:describe(target),defaultPrevented:event.defaultPrevented,x:event.clientX,y:event.clientY});},true);
  document.addEventListener('change',event=>{const target=event.target;if(target instanceof HTMLInputElement||target instanceof HTMLSelectElement)info('ui.change',{target:describe(target),type:target.type||target.tagName.toLowerCase(),checked:target.type==='checkbox'?target.checked:undefined});},true);
}
function init(){if(installed)return;installed=true;restore();injectUI();installGlobalHooks();info('diagnostics.ready',{version:VERSION,readyState:document.readyState});watchEditor();setTimeout(()=>info('diagnostics.initial_snapshot',snapshot()),800);}
init();
global.AstraeonEditorDiagnosticsV5={version:VERSION,log,info,warn,error,snapshot,exportText,copyLogs,downloadLogs,clearLogs,open(){injectUI();$('#studioDiagnosticsPanel')?.classList.remove('hidden');render();},instrumentEditor};
})(window);

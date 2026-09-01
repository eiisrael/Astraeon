(function (global) {
  'use strict';
  const MAX_EVENTS=200,state={events:[],counters:new Map(),sessionId:global.crypto?.randomUUID?.()||`session-${Date.now()}`};
  const scrub=value=>{if(value==null||typeof value==='number'||typeof value==='boolean')return value;if(typeof value==='string')return value.slice(0,240);if(Array.isArray(value))return value.slice(0,20).map(scrub);if(typeof value==='object'){const out={};Object.entries(value).slice(0,30).forEach(([key,item])=>{out[key]=/token|password|secret|cookie|authorization/i.test(key)?'[redacted]':scrub(item);});return out;}return String(value).slice(0,240);};
  function capture(name,data={},level='info'){const event={name:String(name).slice(0,96),level,at:new Date().toISOString(),sessionId:state.sessionId,data:scrub(data)};state.events.push(event);if(state.events.length>MAX_EVENTS)state.events.splice(0,state.events.length-MAX_EVENTS);state.counters.set(event.name,(state.counters.get(event.name)||0)+1);if(level==='error')console.error('[Astraeon]',event.name,event.data);else if(level==='warn')console.warn('[Astraeon]',event.name,event.data);global.dispatchEvent(new CustomEvent('astraeon:telemetry',{detail:event}));return event;}
  function measure(name,fn){const start=performance.now();try{const result=fn();if(result?.then)return result.finally(()=>capture(`${name}.timing`,{ms:+(performance.now()-start).toFixed(2)}));capture(`${name}.timing`,{ms:+(performance.now()-start).toFixed(2)});return result;}catch(error){capture(`${name}.error`,{message:error?.message},'error');throw error;}}
  global.AstraeonObservabilityV1={state,capture,measure,counters:()=>Object.fromEntries(state.counters)};
  global.addEventListener('error',event=>capture('runtime.window_error',{message:event.message,source:event.filename,line:event.lineno},'error'));
  global.addEventListener('unhandledrejection',event=>capture('runtime.unhandled_rejection',{message:event.reason?.message||event.reason},'error'));
})(window);

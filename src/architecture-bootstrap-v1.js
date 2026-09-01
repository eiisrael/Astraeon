(function(global){
'use strict';
if(document.documentElement.dataset.astraeonArchitectureV1==='loading'||document.documentElement.dataset.astraeonArchitectureV1==='ready')return;
document.documentElement.dataset.astraeonArchitectureV1='loading';
const scripts=['src/observability-v1.js?v=1.0.0','src/core/version-v1.js?v=1.0.0','src/core/event-bus-v1.js?v=1.0.0','src/net/game-protocol-v1.js?v=1.0.0','src/inventory-runtime-v5.js?v=5.0.0','src/lumen-content-v1.js?v=1.0.0','src/quests-v2.js?v=2.0.0','src/net/authority-runtime-v1.js?v=1.0.0'];
function load(index){if(index>=scripts.length){document.documentElement.dataset.astraeonArchitectureV1='ready';global.dispatchEvent(new CustomEvent('astraeon:architecture-ready'));return;}const src=scripts[index],script=document.createElement('script');script.src=src;script.async=false;script.dataset.astraeonArchitectureModule='1';script.onload=()=>load(index+1);script.onerror=()=>{console.error('[Astraeon Bootstrap] Falha ao carregar',src);document.documentElement.dataset.astraeonArchitectureV1='error';};document.body.appendChild(script);}
load(0);
})(window);

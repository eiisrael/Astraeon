(function(global){
'use strict';

const M=global.AstraeonPanelStudioModel;
if(!M)return;
const APPLIED_PROPS=['display','position','isolation','width','height','max-width','max-height','padding','border-radius','border-width','border-style','border-color','background','background-size','background-position','background-repeat','opacity','z-index','clip-path','transform','box-shadow','backdrop-filter','filter','overflow'];
const TEXT_PROPS=['font-family','font-size','font-weight','line-height','letter-spacing','text-align','color','border-color'];
let doc=M.load(),observer=null,scheduled=false;

function clearApplied(element){
  if(!(element instanceof HTMLElement))return;
  for(const prop of APPLIED_PROPS)element.style.removeProperty(prop);
  element.removeAttribute('data-panel-studio-applied');
}
function clearTypography(element){if(!(element instanceof HTMLElement))return;for(const prop of TEXT_PROPS)element.style.removeProperty(prop);element.removeAttribute('data-panel-studio-typography');}
function important(element,property,value){element.style.setProperty(property,String(value),'important');}
function applyBox(element,panel){
  if(!(element instanceof HTMLElement))return;
  clearApplied(element);
  if(!panel.enabled){important(element,'display','none');element.dataset.panelStudioApplied='1';return;}
  element.style.removeProperty('display');
  const b=panel.box,e=panel.effects,img=panel.image;
  important(element,'width',`min(${b.width}px,calc(100vw - 16px))`);
  important(element,'height',`min(${b.height}px,calc(100dvh - 16px))`);
  important(element,'max-width','calc(100vw - 16px)');important(element,'max-height','calc(100dvh - 16px)');
  important(element,'padding',`${b.padding}px`);important(element,'border-radius',`${b.radius}px`);important(element,'border-width',`${b.borderWidth}px`);important(element,'border-style','solid');important(element,'border-color',panel.surface.border);
  important(element,'position','relative');important(element,'isolation','isolate');important(element,'background',M.background(panel,false));important(element,'background-size','auto');important(element,'background-position','center');important(element,'background-repeat','no-repeat');
  important(element,'opacity',b.opacity/100);important(element,'z-index',b.z);important(element,'clip-path',M.clipPath(panel.shape));important(element,'transform',M.transform(panel));important(element,'box-shadow',M.shadow(panel));important(element,'backdrop-filter',`blur(${e.backdropBlur}px)`);important(element,'filter',`brightness(${e.brightness}%) saturate(${e.saturate}%)`);important(element,'overflow','auto');
  element.dataset.panelStudioApplied='1';
  let media=element.querySelector(':scope > .panel-studio-runtime-media');
  if(panel.content.image){if(!media){media=document.createElement('span');media.className='panel-studio-runtime-media';media.setAttribute('aria-hidden','true');element.prepend(media);}media.style.backgroundImage=`url(${JSON.stringify(panel.content.image)})`;media.style.backgroundSize=img.fit==='auto'?'auto':img.fit;media.style.backgroundPosition=`${img.positionX}% ${img.positionY}%`;media.style.opacity=img.opacity/100;media.style.filter=`blur(${img.blur}px)`;media.style.transform=`scale(${img.scale/100})`;}
  else media?.remove();
}
function setText(root,selector,value){const element=selector?root.querySelector(selector):null;if(!element)return;if(!element.hasAttribute('data-panel-studio-original-text'))element.dataset.panelStudioOriginalText=element.textContent;if(element.textContent!==value)element.textContent=value;}
function restoreContent(definition){
  if(!definition||definition.dynamicContent)return;
  document.querySelectorAll(definition.selector).forEach(root=>{for(const selector of [definition.titleSelector,definition.kickerSelector,definition.bodySelector,definition.buttonSelector]){const element=selector?root.querySelector(selector):null;if(element?.hasAttribute('data-panel-studio-original-text')){element.textContent=element.dataset.panelStudioOriginalText||'';element.removeAttribute('data-panel-studio-original-text');}}});
}
function applyTypography(root,panel,definition){
  const title=definition.titleSelector?root.querySelector(definition.titleSelector):root.querySelector('h1,h2,h3');
  const kicker=definition.kickerSelector?root.querySelector(definition.kickerSelector):null;
  const body=definition.bodySelector?root.querySelector(definition.bodySelector):root.querySelector('p');
  const button=definition.buttonSelector?root.querySelector(definition.buttonSelector):null;
  const font=M.FONT_OPTIONS[panel.text.font]||M.FONT_OPTIONS.serif;
  if(title){title.dataset.panelStudioTypography='1';important(title,'font-family',font);important(title,'font-size',`${panel.text.size}px`);important(title,'font-weight',panel.text.weight);important(title,'line-height',panel.text.lineHeight);important(title,'letter-spacing',`${panel.text.letterSpacing}px`);important(title,'text-align',panel.text.align);important(title,'color',panel.text.color);}
  if(kicker){kicker.dataset.panelStudioTypography='1';important(kicker,'font-family',font);important(kicker,'color',panel.text.accent);important(kicker,'text-align',panel.text.align);}
  if(body){body.dataset.panelStudioTypography='1';important(body,'font-family',font);important(body,'font-size',`${panel.text.bodySize}px`);important(body,'line-height',panel.text.lineHeight);important(body,'text-align',panel.text.align);important(body,'color',panel.text.muted);}
  if(button){button.dataset.panelStudioTypography='1';important(button,'font-family',font);important(button,'border-color',panel.text.accent);}
  if(!definition.dynamicContent){setText(root,definition.titleSelector,panel.content.title);setText(root,definition.kickerSelector,panel.content.kicker);setText(root,definition.bodySelector,panel.content.body);setText(root,definition.buttonSelector,panel.content.button);}
}
function ensureCustom(panel){
  let overlay=document.querySelector(`.panel-studio-custom-overlay[data-panel-id="${CSS.escape(panel.id)}"]`);
  if(!overlay){
    overlay=document.createElement('section');overlay.className='panel-studio-custom-overlay hidden';overlay.dataset.panelId=panel.id;overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
    const card=document.createElement('article');card.className='panel-studio-custom-card';card.dataset.panelStudioCustom=panel.id;
    const head=document.createElement('header');head.className='panel-studio-custom-head';const copy=document.createElement('div');copy.className='panel-studio-custom-copy';const kicker=document.createElement('small'),title=document.createElement('h2'),body=document.createElement('p'),close=document.createElement('button'),action=document.createElement('button');
    kicker.dataset.panelKicker='1';title.dataset.panelTitle='1';body.dataset.panelBody='1';close.className='panel-studio-custom-close';close.type='button';close.setAttribute('aria-label','Fechar painel');close.textContent='×';action.className='panel-studio-custom-action';action.type='button';action.dataset.panelAction='1';
    copy.append(kicker,title,body);head.append(copy,close);card.append(head,action);overlay.appendChild(card);(document.querySelector('#gameRoot')||document.body).appendChild(overlay);
    close.addEventListener('click',()=>closePanel(panel.id));overlay.addEventListener('click',event=>{if(event.target===overlay)closePanel(panel.id);});action.addEventListener('click',()=>closePanel(panel.id));
  }
  return overlay;
}
function applyCustom(panel){
  const overlay=ensureCustom(panel),card=overlay.querySelector('.panel-studio-custom-card');
  overlay.dataset.panelStudioRootApplied='1';important(overlay,'z-index',panel.box.z);if(!panel.enabled)important(overlay,'display','none');else overlay.style.removeProperty('display');
  applyBox(card,panel);
  const definition={titleSelector:'[data-panel-title]',kickerSelector:'[data-panel-kicker]',bodySelector:'[data-panel-body]',buttonSelector:'[data-panel-action]'};
  applyTypography(card,panel,definition);
  overlay.setAttribute('aria-label',panel.content.title||panel.name);
  overlay.classList.toggle('panel-studio-disabled',!panel.enabled);
}
function applyExisting(definition,panel){
  if(definition.rootSelector)document.querySelectorAll(definition.rootSelector).forEach(panelRoot=>{panelRoot.dataset.panelStudioRootApplied='1';important(panelRoot,'z-index',panel.box.z);if(!panel.enabled)important(panelRoot,'display','none');else panelRoot.style.removeProperty('display');});
  document.querySelectorAll(definition.selector).forEach(element=>{applyBox(element,panel);applyTypography(element,panel,definition);});
}
function cleanup(){
  document.querySelectorAll('[data-panel-studio-applied="1"]').forEach(element=>clearApplied(element));
  document.querySelectorAll('[data-panel-studio-typography="1"]').forEach(element=>clearTypography(element));
  document.querySelectorAll('[data-panel-studio-root-applied="1"]').forEach(element=>{element.style.removeProperty('display');element.style.removeProperty('z-index');element.removeAttribute('data-panel-studio-root-applied');});
  document.querySelectorAll('.panel-studio-runtime-media').forEach(element=>element.remove());
  document.querySelectorAll('.panel-studio-custom-overlay').forEach(element=>{if(!doc.customPanels.some(panel=>panel.id===element.dataset.panelId))element.remove();});
}
function apply(){
  scheduled=false;cleanup();
  for(const definition of M.CATALOG){if(!doc.panels[definition.id])continue;applyExisting(definition,M.getPanel(doc,definition.id));}
  for(const panel of doc.customPanels)applyCustom(M.getPanel(doc,panel.id));
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
function refresh(next){const previous=doc,updated=next?M.normalize(next):M.load();for(const definition of M.CATALOG)if(previous.panels?.[definition.id]&&!updated.panels?.[definition.id])restoreContent(definition);doc=updated;schedule();return doc;}
function definition(id){return M.getDefinition(doc,id);}
function rootFor(id){const def=definition(id);if(!def)return null;if(def.custom)return document.querySelector(`.panel-studio-custom-overlay[data-panel-id="${CSS.escape(id)}"]`);return document.querySelector(def.rootSelector||def.selector);}
function openPanel(id){const def=definition(id);if(!def)return false;if(def.custom)applyCustom(M.getPanel(doc,id));const root=rootFor(id);if(!root)return false;root.classList.remove('hidden','collapsed-mobile');root.setAttribute('aria-hidden','false');return true;}
function closePanel(id){const root=rootFor(id);if(!root)return false;root.classList.add('hidden');root.setAttribute('aria-hidden','true');return true;}
function togglePanel(id){const root=rootFor(id);return root?.classList.contains('hidden')?openPanel(id):closePanel(id);}
function shortcutMatches(event,shortcut){
  const parts=String(shortcut||'').toLowerCase().split('+').map(part=>part.trim()).filter(Boolean),key=parts.pop();if(!key)return false;
  return event.ctrlKey===parts.includes('ctrl')&&event.altKey===parts.includes('alt')&&event.shiftKey===parts.includes('shift')&&event.metaKey===parts.includes('meta')&&(event.key.toLowerCase()===key||event.code.toLowerCase()===key);
}
function onKey(event){
  if(event.key==='Escape'){const active=Array.from(document.querySelectorAll('.panel-studio-custom-overlay:not(.hidden)')).pop();if(active){event.preventDefault();closePanel(active.dataset.panelId);}return;}
  for(const panel of doc.customPanels){if(panel.enabled&&shortcutMatches(event,panel.shortcut)){event.preventDefault();togglePanel(panel.id);break;}}
}
function install(){
  apply();
  observer=new MutationObserver(schedule);observer.observe(document.body,{childList:true,subtree:true});
  global.addEventListener('storage',event=>{if(event.key===M.STORAGE_KEY)refresh();});global.addEventListener('astraeon:panels-updated',event=>refresh(event.detail?.document));global.addEventListener('keydown',onKey,true);
  const preview=new URLSearchParams(location.search).get('panelPreview');if(preview)setTimeout(()=>openPanel(preview),800);
  global.dispatchEvent(new CustomEvent('astraeon:panels-ready',{detail:{version:'7.0',count:M.list(doc).length}}));
}

global.AstraeonPanelStudio={refresh,open:openPanel,close:closePanel,toggle:togglePanel,get document(){return M.clone(doc);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

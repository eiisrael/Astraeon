(function(global){
'use strict';

const M=global.AstraeonPanelStudioModel;
if(!M)return;
const APPLIED_PROPS=['display','position','isolation','width','height','max-width','max-height','padding','border-radius','border-width','border-style','border-color','background','background-size','background-position','background-repeat','opacity','z-index','clip-path','transform','box-shadow','backdrop-filter','filter','overflow'];
const TEXT_PROPS=['font-family','font-size','font-weight','line-height','letter-spacing','text-align','color','border-color'];
const NODE_PROPS=['display','position','left','top','width','height','min-width','max-width','min-height','max-height','gap','padding','margin','z-index','order','flex-direction','align-items','justify-content','grid-template-columns','grid-template-rows','background','color','border-color','border-width','border-style','border-radius','font-family','font-size','font-weight','text-align','line-height','letter-spacing','opacity','transform','box-shadow','filter'];
const nodeOriginal=new WeakMap(),nodeOriginalContent=new WeakMap(),activeNodes=new Map();
const query=new URLSearchParams(location.search),hostFrame=global.frameElement,previewId=query.get('panelPreview')||hostFrame?.dataset?.panelPreview||'',embed=query.get('panelStudioEmbed')==='1'||hostFrame?.dataset?.panelStudioEmbed==='1';
let doc=M.load(),observer=null,scheduled=false;

function clearApplied(element){
  if(!(element instanceof HTMLElement))return;
  for(const prop of APPLIED_PROPS)element.style.removeProperty(prop);
  element.removeAttribute('data-panel-studio-applied');
}
function clearTypography(element){if(!(element instanceof HTMLElement))return;for(const prop of TEXT_PROPS)element.style.removeProperty(prop);element.removeAttribute('data-panel-studio-typography');}
function important(element,property,value){element.style.setProperty(property,String(value),'important');}
function rememberNode(element){
  if(nodeOriginal.has(element))return;
  const styles={};for(const prop of NODE_PROPS)styles[prop]=[element.style.getPropertyValue(prop),element.style.getPropertyPriority(prop)];
  nodeOriginal.set(element,styles);nodeOriginalContent.set(element,{text:element.textContent,value:'value'in element?element.value:undefined,src:element.getAttribute('src'),alt:element.getAttribute('alt'),title:element.getAttribute('title'),aria:element.getAttribute('aria-label')});
}
function nodeStyle(element,property,value){rememberNode(element);if(value===null||value===undefined||value===''){const original=nodeOriginal.get(element)?.[property]||['',''];if(original[0])element.style.setProperty(property,original[0],original[1]);else element.style.removeProperty(property);return;}important(element,property,value);}
function restoreNode(element){
  if(!(element instanceof HTMLElement)||!nodeOriginal.has(element))return;
  const styles=nodeOriginal.get(element);for(const prop of NODE_PROPS){const original=styles[prop];if(original?.[0])element.style.setProperty(prop,original[0],original[1]);else element.style.removeProperty(prop);}
  const content=nodeOriginalContent.get(element);if(content&&!element.hasAttribute('data-panel-studio-element')){if('value'in element&&content.value!==undefined)element.value=content.value;else element.textContent=content.text;for(const [attr,value] of [['src',content.src],['alt',content.alt],['title',content.title],['aria-label',content.aria]])value===null?element.removeAttribute(attr):element.setAttribute(attr,value);}
  element.removeAttribute('data-panel-studio-node-applied');nodeOriginal.delete(element);nodeOriginalContent.delete(element);
}
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
function elementTag(type){return type==='button'?'button':type==='image'?'img':type==='text'?'p':'div';}
function customParent(root,node){if(node.parentId)return root.querySelector(`[data-panel-studio-element="${CSS.escape(node.parentId)}"]`)||root;if(node.parentSelector){try{return node.parentSelector===':scope'?root:root.querySelector(node.parentSelector)||root;}catch(_){return root;}}return root;}
function ensureCustomElements(root,panel){
  const ids=new Set(panel.customElements.map(node=>node.id));
  root.querySelectorAll('[data-panel-studio-element]').forEach(element=>{if(!ids.has(element.dataset.panelStudioElement))element.remove();});
  const pending=[...panel.customElements];let guard=0;
  while(pending.length&&guard++<pending.length+4){
    let progressed=false;
    for(let index=pending.length-1;index>=0;index--){
      const node=pending[index];if(node.parentId&&!root.querySelector(`[data-panel-studio-element="${CSS.escape(node.parentId)}"]`)&&pending.some(item=>item.id===node.parentId))continue;
      const tag=elementTag(node.type);let element=root.querySelector(`[data-panel-studio-element="${CSS.escape(node.id)}"]`);
      if(element&&element.tagName.toLowerCase()!==tag){element.remove();element=null;}
      if(!element){element=document.createElement(tag);element.dataset.panelStudioElement=node.id;element.className=`panel-studio-element panel-studio-element-${node.type}`;if(tag==='button')element.type='button';customParent(root,node).appendChild(element);}
      else{const parent=customParent(root,node);if(element.parentElement!==parent)parent.appendChild(element);}
      element.dataset.panelStudioOwner=panel.id;
      if(node.type==='grid'){
        const cells=Array.from(element.querySelectorAll(':scope > [data-panel-studio-grid-cell]'));
        while(cells.length>node.grid.cells)cells.pop().remove();
        for(let i=cells.length;i<node.grid.cells;i++){const cell=document.createElement('div');cell.dataset.panelStudioGridCell=String(i+1);cell.className='panel-studio-grid-cell';cell.textContent=String(i+1);element.appendChild(cell);}
      }
      pending.splice(index,1);progressed=true;
    }
    if(!progressed)break;
  }
}
function resolveNode(root,node){if(node.custom)return root.querySelector(`[data-panel-studio-element="${CSS.escape(node.id)}"]`);try{return node.selector===':scope'?root:root.querySelector(node.selector);}catch(_){return null;}}
function dimension(value){const text=String(value??'').trim();if(!text||text==='auto')return text||null;return /^-?[\d.]+$/.test(text)?`${text}px`:text;}
function applyNode(element,node){
  if(!(element instanceof HTMLElement))return;rememberNode(element);element.dataset.panelStudioNodeApplied='1';
  const allow=property=>node.styleSet.includes(property),s=node.style;
  nodeStyle(element,'display',node.hidden?'none':allow('display')?s.display:null);
  if(allow('position'))nodeStyle(element,'position',s.position==='flow'?null:s.position);
  if(allow('x'))nodeStyle(element,'left',s.position==='absolute'||s.position==='fixed'?`${s.x}px`:null);
  if(allow('y'))nodeStyle(element,'top',s.position==='absolute'||s.position==='fixed'?`${s.y}px`:null);
  if(allow('width'))nodeStyle(element,'width',dimension(s.width));if(allow('height'))nodeStyle(element,'height',dimension(s.height));
  for(const [field,prop] of [['minWidth','min-width'],['maxWidth','max-width'],['minHeight','min-height'],['maxHeight','max-height']])if(allow(field))nodeStyle(element,prop,dimension(s[field]));
  for(const [field,prop,unit] of [['gap','gap','px'],['padding','padding','px'],['margin','margin','px'],['zIndex','z-index',''],['order','order',''],['borderWidth','border-width','px'],['borderRadius','border-radius','px'],['fontSize','font-size','px'],['fontWeight','font-weight',''],['lineHeight','line-height',''],['letterSpacing','letter-spacing','px'],['opacity','opacity','']])if(allow(field))nodeStyle(element,prop,field==='opacity'?s[field]/100:`${s[field]}${unit}`);
  for(const [field,prop] of [['flexDirection','flex-direction'],['alignItems','align-items'],['justifyContent','justify-content'],['background','background'],['color','color'],['borderColor','border-color'],['fontFamily','font-family'],['textAlign','text-align'],['shadow','box-shadow'],['filter','filter']])if(allow(field))nodeStyle(element,prop,s[field]);
  if(allow('borderWidth')&&s.borderWidth)nodeStyle(element,'border-style','solid');
  if(node.custom&&node.type==='grid')nodeStyle(element,'display','grid');
  if(node.custom||allow('grid.columns'))nodeStyle(element,'grid-template-columns',`repeat(${node.grid.columns},minmax(0,1fr))`);
  if(node.custom||allow('grid.rows'))nodeStyle(element,'grid-template-rows',`repeat(${node.grid.rows},minmax(0,1fr))`);
  const transform=[];if((s.position==='flow'||s.position==='relative')&&(allow('x')||allow('y')))transform.push(`translate(${allow('x')?s.x:0}px,${allow('y')?s.y:0}px)`);if(allow('rotate'))transform.push(`rotate(${s.rotate}deg)`);if(allow('scale'))transform.push(`scale(${s.scale/100})`);if(transform.length)nodeStyle(element,'transform',transform.join(' '));
  if(node.contentSet){if(node.type==='image'||element instanceof HTMLImageElement){if(node.content.src)element.setAttribute('src',node.content.src);else element.removeAttribute('src');element.setAttribute('alt',node.content.alt||'');}else if(node.type!=='grid'&&node.type!=='container'){if(element instanceof HTMLInputElement||element instanceof HTMLTextAreaElement||element instanceof HTMLSelectElement){if(element.value!==node.content.text)element.value=node.content.text;}else if(element.textContent!==node.content.text)element.textContent=node.content.text;}}
  for(const [attr,value] of [['title',node.content.title],['aria-label',node.content.ariaLabel]])if(value)element.setAttribute(attr,value);else if(node.custom)element.removeAttribute(attr);
}
function applyPanelNodes(root,panel,keyPrefix,seen){
  ensureCustomElements(root,panel);
  const nodes=[...Object.values(panel.nodes),...panel.customElements];
  nodes.forEach(node=>{const element=resolveNode(root,node);if(!element)return;const key=`${keyPrefix}:${node.id}`;activeNodes.set(key,element);seen.add(key);applyNode(element,node);});
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
function applyCustom(panel,seen){
  const overlay=ensureCustom(panel),card=overlay.querySelector('.panel-studio-custom-card');
  overlay.dataset.panelStudioRootApplied='1';important(overlay,'z-index',panel.box.z);if(!panel.enabled)important(overlay,'display','none');else overlay.style.removeProperty('display');
  applyBox(card,panel);
  const definition={titleSelector:'[data-panel-title]',kickerSelector:'[data-panel-kicker]',bodySelector:'[data-panel-body]',buttonSelector:'[data-panel-action]'};
  applyTypography(card,panel,definition);
  const action=card.querySelector('[data-panel-action]');if(action)action.hidden=!panel.content.button;
  applyPanelNodes(card,panel,`custom:${panel.id}`,seen);
  overlay.setAttribute('aria-label',panel.content.title||panel.name);
  overlay.classList.toggle('panel-studio-disabled',!panel.enabled);
}
function applyExisting(definition,panel,seen){
  if(definition.rootSelector)document.querySelectorAll(definition.rootSelector).forEach(panelRoot=>{panelRoot.dataset.panelStudioRootApplied='1';important(panelRoot,'z-index',panel.box.z);if(!panel.enabled)important(panelRoot,'display','none');else panelRoot.style.removeProperty('display');});
  document.querySelectorAll(definition.selector).forEach((element,index)=>{applyBox(element,panel);applyTypography(element,panel,definition);applyPanelNodes(element,panel,`${definition.id}:${index}`,seen);});
}
function cleanup(){
  document.querySelectorAll('[data-panel-studio-applied="1"]').forEach(element=>clearApplied(element));
  document.querySelectorAll('[data-panel-studio-typography="1"]').forEach(element=>clearTypography(element));
  document.querySelectorAll('[data-panel-studio-root-applied="1"]').forEach(element=>{element.style.removeProperty('display');element.style.removeProperty('z-index');element.removeAttribute('data-panel-studio-root-applied');});
  document.querySelectorAll('.panel-studio-runtime-media').forEach(element=>element.remove());
  document.querySelectorAll('[data-panel-studio-owner]').forEach(element=>{const id=element.dataset.panelStudioOwner;if(!doc.panels[id]&&!doc.customPanels.some(panel=>panel.id===id))element.remove();});
  document.querySelectorAll('.panel-studio-custom-overlay').forEach(element=>{if(!doc.customPanels.some(panel=>panel.id===element.dataset.panelId))element.remove();});
}
function apply(){
  scheduled=false;cleanup();const seen=new Set();
  for(const definition of M.CATALOG){if(!doc.panels[definition.id])continue;applyExisting(definition,M.getPanel(doc,definition.id),seen);}
  for(const panel of doc.customPanels)applyCustom(M.getPanel(doc,panel.id),seen);
  for(const [key,element] of activeNodes)if(!seen.has(key)){restoreNode(element);activeNodes.delete(key);}
  if(embed&&previewId)prepareEmbed(previewId);
}
function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(apply);}
function refresh(next){const previous=doc,updated=next?M.normalize(next):M.load();for(const definition of M.CATALOG)if(previous.panels?.[definition.id]&&!updated.panels?.[definition.id])restoreContent(definition);doc=updated;schedule();return doc;}
function definition(id){return M.getDefinition(doc,id);}
function rootFor(id){const def=definition(id);if(!def)return null;if(def.custom)return document.querySelector(`.panel-studio-custom-overlay[data-panel-id="${CSS.escape(id)}"]`);return document.querySelector(def.rootSelector||def.selector);}
function openPanel(id){const def=definition(id);if(!def)return false;if(def.custom)applyCustom(M.getPanel(doc,id),new Set());const root=rootFor(id);if(!root)return false;root.classList.remove('hidden','collapsed-mobile');root.setAttribute('aria-hidden','false');return true;}
function closePanel(id){const root=rootFor(id);if(!root)return false;root.classList.add('hidden');root.setAttribute('aria-hidden','true');return true;}
function togglePanel(id){const root=rootFor(id);return root?.classList.contains('hidden')?openPanel(id):closePanel(id);}
function hydratePreview(id){
  if(id!=='inventory')return;
  const equipment=document.querySelector('#equipmentGrid'),backpack=document.querySelector('#inventoryGrid'),stats=document.querySelector('#equipmentStats');
  if(equipment&&!equipment.children.length){const fallback={weapon:{label:'Arma',icon:'⚔'},head:{label:'Elmo',icon:'♜'},chest:{label:'Peitoral',icon:'◈'},hands:{label:'Luvas',icon:'✦'},boots:{label:'Botas',icon:'⌁'},ring:{label:'Anel',icon:'◌'},amulet:{label:'Amuleto',icon:'◇'},relic:{label:'Relicário',icon:'✧'}},slots=global.AstraeonItems?.slots||fallback,categories={weapon:'weapon',ring:'accessory',amulet:'accessory',relic:'realm'};for(const [id,info] of Object.entries(slots)){const slot=document.createElement('button');slot.type='button';slot.className=`equipment-slot slot-${id} empty`;slot.dataset.slot=id;slot.dataset.category=categories[id]||'armor';slot.dataset.panelStudioPreviewFixture='1';slot.innerHTML=`<small>${info.label}</small><strong>${info.icon||'◇'}</strong><span>Vazio</span>`;equipment.appendChild(slot);}}
  if(backpack&&!backpack.children.length){for(let index=0;index<25;index++){const slot=document.createElement('button');slot.type='button';slot.className='inventory-slot empty';slot.dataset.panelStudioPreviewFixture='1';slot.disabled=true;slot.setAttribute('aria-label',`Slot vazio ${index+1}`);backpack.appendChild(slot);}}
  if(stats&&!stats.children.length){for(const [label,value] of [['Poder','48'],['Defesa','34'],['Vida máx.','457'],['Mana máx.','183'],['Velocidade','192'],['Crítico','8%']]){const item=document.createElement('div');item.dataset.panelStudioPreviewFixture='1';item.innerHTML=`<span>${label}</span><b>${value}<i>+0</i></b>`;stats.appendChild(item);}}
}
function prepareEmbed(id){
  const def=definition(id);if(!def)return;
  document.documentElement.classList.add('panel-studio-embed');document.body.classList.add('panel-studio-embed','game-running');document.body.dataset.panelStudioPreview=id;
  document.querySelectorAll('.panel-studio-embed-hide').forEach(element=>element.classList.remove('panel-studio-embed-hide'));
  const candidates=new Set();
  for(const item of M.list(doc)){const definitionItem=M.getDefinition(doc,item.id);if(!definitionItem)continue;const selectors=[definitionItem.rootSelector,definitionItem.selector].filter(Boolean);for(const selector of selectors){try{document.querySelectorAll(selector).forEach(element=>candidates.add(element));}catch(_){}}}
  document.querySelectorAll('#startScreen,#classScreen,#hud,#inventoryPanel,#mapPanel,#helpPanel,#settingsPanel,#pauseScreen,#onlineAccountPanel,#npcDialogue,.panel-studio-custom-overlay').forEach(element=>candidates.add(element));
  if(def.custom)applyCustom(M.getPanel(doc,id),new Set());hydratePreview(id);
  const target=document.querySelector(def.selector)||rootFor(id);if(!target)return;
  candidates.forEach(element=>element.classList.add('panel-studio-embed-hide'));
  for(let current=target;current&&current!==document.body;current=current.parentElement){current.classList.remove('panel-studio-embed-hide','hidden','collapsed','collapsed-mobile','chat-pro-collapsed');current.removeAttribute('aria-hidden');}
  target.classList.add('panel-studio-embed-target');target.scrollIntoView({block:'center',inline:'center'});
}
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
  if(previewId)setTimeout(()=>{openPanel(previewId);if(embed)prepareEmbed(previewId);},800);
  global.dispatchEvent(new CustomEvent('astraeon:panels-ready',{detail:{version:'7.0',count:M.list(doc).length}}));
}

global.AstraeonPanelStudio={refresh,open:openPanel,close:closePanel,toggle:togglePanel,get document(){return M.clone(doc);}};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

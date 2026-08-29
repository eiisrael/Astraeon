(function(global){
'use strict';

const VERSION='7.0';
let M=null,root=null,content=null,tab=null,doc=null,installed=false,history=[],future=[],editSnapshot=null,editCheckpointed=false,saveTimer=0,dirty=false,styleClipboard=null,drag=null;
const $=(selector,scope=document)=>scope.querySelector(selector);
const $$=(selector,scope=document)=>Array.from(scope.querySelectorAll(selector));
const esc=value=>String(value??'').replace(/[&<>'"]/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
const snapshot=()=>JSON.stringify(doc);
const notify=text=>global.astraeonEditor?.notify?.(text);

function ensureStyle(){if(document.querySelector('link[data-panel-editor-v7]'))return;const link=document.createElement('link');link.rel='stylesheet';link.href='src/admin-panel-editor-v7.css?v=7.0.0';link.dataset.panelEditorV7='1';document.head.appendChild(link);}
function selectedId(){return doc.ui.selectedId;}
function definition(){return M.getDefinition(doc,selectedId());}
function panel(){return M.getPanel(doc,selectedId());}
function mutablePanel(){
  const id=selectedId(),catalog=M.getCatalog(id);
  if(catalog){if(!doc.panels[id])doc.panels[id]=M.getPanel(doc,id);return doc.panels[id];}
  return doc.customPanels.find(item=>item.id===id);
}
function setPath(object,path,value){const keys=path.split('.');let cursor=object;for(let i=0;i<keys.length-1;i++){cursor[keys[i]]=cursor[keys[i]]&&typeof cursor[keys[i]]==='object'?cursor[keys[i]]:{};cursor=cursor[keys[i]];}cursor[keys.at(-1)]=value;}
function checkpoint(value=snapshot()){if(history.at(-1)===value)return;history.push(value);if(history.length>80)history.shift();future=[];updateHistoryButtons();}
function restore(value){doc=M.normalize(JSON.parse(value));dirty=true;renderPage();queueSave();}
function undo(){if(!history.length)return;future.push(snapshot());restore(history.pop());notify('Alteração desfeita.');}
function redo(){if(!future.length)return;history.push(snapshot());restore(future.pop());notify('Alteração refeita.');}
function updateHistoryButtons(){const undoBtn=$('#pseUndo',content),redoBtn=$('#pseRedo',content);if(undoBtn)undoBtn.disabled=!history.length;if(redoBtn)redoBtn.disabled=!future.length;}
function setDirty(value=true){dirty=value;const state=$('#pseSaveState',content);if(state){state.textContent=value?'Alterações pendentes':'Salvo localmente';state.classList.toggle('dirty',value);}}
function saveNow(silent=false){
  clearTimeout(saveTimer);
  try{doc=M.save(doc);setDirty(false);global.dispatchEvent(new CustomEvent('astraeon:panels-updated',{detail:{document:M.clone(doc)}}));if(!silent)notify('Projeto de painéis salvo e publicado no jogo.');return true;}
  catch(error){setDirty(true);notify(error?.name==='QuotaExceededError'?'A imagem excedeu o espaço local. Use uma URL ou uma imagem menor.':'Não foi possível salvar o projeto de painéis.');return false;}
}
function queueSave(){setDirty(true);clearTimeout(saveTimer);saveTimer=setTimeout(()=>saveNow(true),650);}

function field(label,path,value,type='text',options={}){
  const full=options.full?' full':'',attrs=[`data-path="${esc(path)}"`,options.min!=null?`min="${options.min}"`:'',options.max!=null?`max="${options.max}"`:'',options.step!=null?`step="${options.step}"`:'',options.placeholder?`placeholder="${esc(options.placeholder)}"`:''].filter(Boolean).join(' ');
  if(type==='textarea')return`<label class="pse-field${full}"><span>${esc(label)}</span><textarea ${attrs}>${esc(value)}</textarea></label>`;
  if(type==='select')return`<label class="pse-field${full}"><span>${esc(label)}</span><select ${attrs}>${(options.items||[]).map(([key,text])=>`<option value="${esc(key)}" ${String(key)===String(value)?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
  if(type==='checkbox')return`<label class="pse-toggle-field${full}"><span>${esc(label)}</span><input type="checkbox" ${attrs} ${value?'checked':''}></label>`;
  if(type==='color')return`<label class="pse-field${full}"><span>${esc(label)}</span><div class="pse-color-row"><input type="color" ${attrs} value="${esc(value)}"><input type="text" data-color-mirror="${esc(path)}" value="${esc(value)}" maxlength="7"></div></label>`;
  return`<label class="pse-field${full}"><span>${esc(label)}</span><input type="${type}" ${attrs} value="${esc(value)}"></label>`;
}
function section(title,subtitle,body){return`<section class="pse-section"><div class="pse-section-title"><b>${esc(title)}</b><small>${esc(subtitle||'')}</small></div><div class="pse-fields">${body}</div></section>`;}

function inspectorContent(p,def){
  const dynamic=!!def?.dynamicContent;
  return section('Identificação','biblioteca',
    field('Nome do painel','name',p.name,'text',{full:true})+field('Categoria','category',p.category,'text')+field('Ativo no jogo','enabled',p.enabled,'checkbox')+
    (p.custom?field('Atalho de abertura','shortcut',p.shortcut,'text',{full:true,placeholder:'Ctrl+Alt+1'}):'')
  )+section('Conteúdo textual','tipografia editável',
    (dynamic?'<div class="pse-field-note">Este painel usa dados dinâmicos do jogo. Os textos abaixo alimentam a prévia; no runtime, nomes, status e mensagens continuam sendo atualizados pelos sistemas do jogo.</div>':'')+
    field('Título','content.title',p.content.title,'text',{full:true})+field('Marcador / kicker','content.kicker',p.content.kicker,'text',{full:true})+field('Descrição','content.body',p.content.body,'textarea',{full:true})+field('Texto do botão','content.button',p.content.button,'text',{full:true})
  )+section('Imagem de fundo','arquivo ou URL',
    field('URL / Data URL','content.image',p.content.image,'text',{full:true,placeholder:'https://… ou selecione um arquivo'})+field('Texto alternativo','content.imageAlt',p.content.imageAlt,'text',{full:true})+
    '<div class="pse-inline-buttons"><button class="pse-btn" type="button" data-action="pick-image">Selecionar imagem</button><button class="pse-btn" type="button" data-action="clear-image">Remover imagem</button></div>'
  );
}
function inspectorLayout(p){
  return section('Dimensões','pixels',
    field('Largura','box.width',p.box.width,'number',{min:180,max:1600,step:1})+field('Altura','box.height',p.box.height,'number',{min:80,max:1200,step:1})+field('Espaçamento interno','box.padding',p.box.padding,'number',{min:0,max:160})+field('Raio da borda','box.radius',p.box.radius,'number',{min:0,max:120})+field('Espessura da borda','box.borderWidth',p.box.borderWidth,'number',{min:0,max:12,step:.5})+field('Opacidade %','box.opacity',p.box.opacity,'number',{min:0,max:100})
  )+section('Posição e camada','arraste no canvas',
    field('Posição X','box.x',p.box.x,'number',{min:-1200,max:1200})+field('Posição Y','box.y',p.box.y,'number',{min:-900,max:900})+field('Camada Z','box.z',p.box.z,'number',{min:0,max:999})+field('Bloquear edição','locked',p.locked,'checkbox')+
    '<div class="pse-inline-buttons"><button class="pse-btn" type="button" data-action="center-panel">Centralizar</button><button class="pse-btn" type="button" data-action="fit-panel">Ajustar à tela</button></div>'
  )+section('Vértices','cortes independentes',
    field('Superior esquerdo','shape.topLeft',p.shape.topLeft,'number',{min:0,max:160})+field('Superior direito','shape.topRight',p.shape.topRight,'number',{min:0,max:160})+field('Inferior esquerdo','shape.bottomLeft',p.shape.bottomLeft,'number',{min:0,max:160})+field('Inferior direito','shape.bottomRight',p.shape.bottomRight,'number',{min:0,max:160})+
    '<div class="pse-inline-buttons"><button class="pse-btn" type="button" data-vertices="0">Reto</button><button class="pse-btn" type="button" data-vertices="12">Corte 12</button><button class="pse-btn" type="button" data-vertices="28">Corte 28</button></div>'
  )+section('Transformação','geometria',
    field('Rotação °','shape.rotate',p.shape.rotate,'number',{min:-180,max:180,step:.5})+field('Escala %','shape.scale',p.shape.scale,'number',{min:10,max:300})+field('Inclinação X','shape.skewX',p.shape.skewX,'number',{min:-60,max:60,step:.5})+field('Inclinação Y','shape.skewY',p.shape.skewY,'number',{min:-60,max:60,step:.5})
  );
}
function inspectorStyle(p){
  return section('Superfície','cores e gradiente',
    field('Fundo','surface.background',p.surface.background,'color')+field('Gradiente','surface.gradient',p.surface.gradient,'color')+field('Borda','surface.border',p.surface.border,'color')+field('Sobreposição','surface.overlay',p.surface.overlay,'color')+field('Ângulo do gradiente','surface.angle',p.surface.angle,'number',{min:0,max:360})+field('Sobreposição %','surface.overlayOpacity',p.surface.overlayOpacity,'number',{min:0,max:100})
  )+section('Texto','controle editorial',
    field('Fonte','text.font',p.text.font,'select',{items:[['serif','Serif editorial'],['sans','Sans profissional'],['display','Display fantástica'],['mono','Monoespaçada']]})+field('Alinhamento','text.align',p.text.align,'select',{items:[['left','Esquerda'],['center','Centro'],['right','Direita']]})+field('Título px','text.size',p.text.size,'number',{min:8,max:120})+field('Corpo px','text.bodySize',p.text.bodySize,'number',{min:7,max:64})+field('Peso','text.weight',p.text.weight,'select',{items:[[300,'Leve'],[400,'Regular'],[500,'Médio'],[600,'Semibold'],[700,'Negrito'],[800,'Extra bold'],[900,'Black']]})+field('Entrelinha','text.lineHeight',p.text.lineHeight,'number',{min:.7,max:3,step:.05})+field('Espaçamento','text.letterSpacing',p.text.letterSpacing,'number',{min:-5,max:30,step:.1})+
    '<div class="pse-inline-buttons"><button class="pse-btn" type="button" data-align="left">Alinhar ←</button><button class="pse-btn" type="button" data-align="center">Centro</button><button class="pse-btn" type="button" data-align="right">Direita →</button></div>'+field('Título','text.color',p.text.color,'color')+field('Texto secundário','text.muted',p.text.muted,'color')+field('Destaque','text.accent',p.text.accent,'color')
  )+section('Presets profissionais','um clique',
    '<div class="pse-inline-buttons"><button class="pse-btn" type="button" data-preset="astra">Astra clássico</button><button class="pse-btn" type="button" data-preset="glass">Vidro astral</button><button class="pse-btn" type="button" data-preset="void">Vazio</button><button class="pse-btn" type="button" data-preset="lumen">Lúmen</button></div>'
  );
}
function inspectorEffects(p){
  return section('Tratamento da imagem','composição',
    field('Enquadramento','image.fit',p.image.fit,'select',{items:[['cover','Preencher'],['contain','Conter'],['auto','Tamanho original']]})+field('Escala %','image.scale',p.image.scale,'number',{min:25,max:300})+field('Posição X %','image.positionX',p.image.positionX,'number',{min:0,max:100})+field('Posição Y %','image.positionY',p.image.positionY,'number',{min:0,max:100})+field('Opacidade %','image.opacity',p.image.opacity,'number',{min:0,max:100})+field('Desfoque px','image.blur',p.image.blur,'number',{min:0,max:40,step:.5})
  )+section('Filtros','renderização',
    field('Desfoque de fundo','effects.backdropBlur',p.effects.backdropBlur,'number',{min:0,max:60})+field('Brilho %','effects.brightness',p.effects.brightness,'number',{min:10,max:250})+field('Saturação %','effects.saturate',p.effects.saturate,'number',{min:0,max:300})+field('Aura / glow','effects.glow',p.effects.glow,'number',{min:0,max:100})
  )+section('Sombra','profundidade',
    field('Deslocamento X','effects.shadowX',p.effects.shadowX,'number',{min:-120,max:120})+field('Deslocamento Y','effects.shadowY',p.effects.shadowY,'number',{min:-120,max:120})+field('Desfoque','effects.shadowBlur',p.effects.shadowBlur,'number',{min:0,max:240})+field('Expansão','effects.shadowSpread',p.effects.shadowSpread,'number',{min:-40,max:100})+field('Cor','effects.shadowColor',p.effects.shadowColor,'color')+field('Opacidade %','effects.shadowOpacity',p.effects.shadowOpacity,'number',{min:0,max:100})
  );
}
function renderInspector(){const p=panel(),def=definition(),body=$('#pseInspectorBody',content);if(!p||!body)return;$$('.pse-inspector-tab',content).forEach(button=>button.classList.toggle('active',button.dataset.inspector===doc.ui.inspector));body.innerHTML=doc.ui.inspector==='layout'?inspectorLayout(p):doc.ui.inspector==='style'?inspectorStyle(p):doc.ui.inspector==='effects'?inspectorEffects(p):inspectorContent(p,def);}

function libraryHtml(){
  const groups=new Map();for(const item of M.list(doc)){if(!groups.has(item.category))groups.set(item.category,[]);groups.get(item.category).push(item);}
  return Array.from(groups,([category,items])=>`<div class="pse-category">${esc(category)}</div>${items.map(item=>`<button class="pse-panel-item ${item.id===selectedId()?'active':''} ${item.modified?'modified':''} ${item.panel.enabled?'':'disabled'}" type="button" data-panel-select="${esc(item.id)}" data-search="${esc(`${item.name} ${category}`.toLowerCase())}"><span class="pse-panel-icon">${item.custom?'＋':'◇'}</span><span><b>${esc(item.name)}</b><small>${item.custom?'Personalizado':esc(item.selector||'Painel do jogo')}</small></span><i class="pse-panel-state"></i></button>`).join('')}`).join('');
}
function shortcutsHtml(){return`<div id="pseShortcuts" class="pse-shortcuts hidden"><div class="pse-shortcuts-card"><header><div><h3>Atalhos do Editor de Painéis</h3><small>Fluxo rápido de produção</small></div><button class="pse-icon-btn" type="button" data-action="shortcuts-close">×</button></header><div class="pse-shortcut-grid"><div><span>Salvar/publicar</span><kbd>Ctrl+S</kbd></div><div><span>Desfazer</span><kbd>Ctrl+Z</kbd></div><div><span>Refazer</span><kbd>Ctrl+Y</kbd></div><div><span>Duplicar painel</span><kbd>Ctrl+D</kbd></div><div><span>Novo painel</span><kbd>Ctrl+N</kbd></div><div><span>Excluir/resetar</span><kbd>Delete</kbd></div><div><span>Copiar estilo</span><kbd>Ctrl+Shift+C</kbd></div><div><span>Colar estilo</span><kbd>Ctrl+Shift+V</kbd></div><div><span>Aumentar zoom</span><kbd>Ctrl++</kbd></div><div><span>Diminuir zoom</span><kbd>Ctrl+-</kbd></div><div><span>Zoom 100%</span><kbd>Ctrl+0</kbd></div><div><span>Mover 1 / 10 px</span><kbd>Setas / Shift</kbd></div><div><span>Fechar ajuda</span><kbd>Esc</kbd></div></div></div></div>`;}
function renderPage(){
  if(!content)return;editSnapshot=null;editCheckpointed=false;content.classList.add('panel-editor-host');const p=panel();if(!p)return;
  content.innerHTML=`<div class="panel-editor-page ${innerWidth>930?'inspector-open':''}">
    <header class="pse-topbar"><div class="pse-title"><div class="pse-title-mark">◇</div><div><span>Design System</span><b>Editor de Painéis</b><small>Visual, conteúdo e comportamento em produção</small></div></div><div class="pse-top-actions"><button id="pseUndo" class="pse-icon-btn" title="Desfazer · Ctrl+Z" type="button" data-action="undo">↶</button><button id="pseRedo" class="pse-icon-btn" title="Refazer · Ctrl+Y" type="button" data-action="redo">↷</button><button class="pse-btn" type="button" data-action="shortcuts">Atalhos</button><button class="pse-btn" data-hide-compact type="button" data-action="export">Exportar JSON</button><button class="pse-btn" data-hide-compact type="button" data-action="import">Importar</button><button class="pse-btn" type="button" data-action="open-game">▶ Testar</button><button class="pse-btn primary" type="button" data-action="save">Salvar + publicar</button><button class="pse-icon-btn" title="Alternar inspetor" type="button" data-action="toggle-inspector">☷</button></div></header>
    <main class="pse-workspace"><aside class="pse-library"><div class="pse-side-head"><div class="pse-side-head-row"><div><span>Biblioteca</span><b>Todos os painéis</b></div><small>${M.list(doc).length}</small></div><input id="pseSearch" class="pse-search" type="search" placeholder="Buscar painel…"></div><div class="pse-library-actions"><button class="pse-btn primary" type="button" data-action="new">+ Novo</button><button class="pse-btn" type="button" data-action="duplicate">Duplicar</button></div><div id="psePanelList" class="pse-panel-list">${libraryHtml()}</div></aside>
    <section class="pse-stage"><div class="pse-stage-toolbar"><button class="pse-icon-btn" type="button" data-action="zoom-out" title="Diminuir zoom">−</button><span id="pseZoomLabel" class="pse-zoom-label">${Math.round(doc.ui.zoom)}%</span><button class="pse-icon-btn" type="button" data-action="zoom-in" title="Aumentar zoom">+</button><button class="pse-icon-btn" type="button" data-action="zoom-reset" title="Zoom 100%">⌗</button><i class="pse-tool-sep"></i><button class="pse-btn ${doc.ui.grid?'active':''}" type="button" data-action="grid">Grade</button><button class="pse-btn ${doc.ui.snap?'active':''}" type="button" data-action="snap">Imã ${doc.ui.gridSize}px</button><div class="pse-viewport-group"><button class="pse-btn pse-viewport ${doc.ui.viewport==='desktop'?'active':''}" type="button" data-viewport="desktop">Desktop</button><button class="pse-btn pse-viewport ${doc.ui.viewport==='tablet'?'active':''}" type="button" data-viewport="tablet">Tablet</button><button class="pse-btn pse-viewport ${doc.ui.viewport==='mobile'?'active':''}" type="button" data-viewport="mobile">Mobile</button></div></div><div id="pseCanvas" class="pse-canvas ${doc.ui.grid?'grid':''}" style="--pse-grid:${doc.ui.gridSize}px"><div id="pseArtboard" class="pse-artboard" data-viewport="${esc(doc.ui.viewport)}"><article id="psePreview" class="pse-preview ${p.locked?'locked':''}"><i class="pse-preview-media" aria-hidden="true"></i><div class="pse-preview-copy"><small class="pse-preview-kicker"></small><h2 class="pse-preview-title"></h2><p class="pse-preview-body"></p><button class="pse-preview-action" type="button" tabindex="-1"></button></div>${['nw','n','ne','e','se','s','sw','w'].map(handle=>`<i class="pse-handle" data-handle="${handle}"></i>`).join('')}</article></div></div></section>
    <aside class="pse-inspector"><nav class="pse-inspector-tabs"><button class="pse-inspector-tab" type="button" data-inspector="content">Conteúdo</button><button class="pse-inspector-tab" type="button" data-inspector="layout">Layout</button><button class="pse-inspector-tab" type="button" data-inspector="style">Estilo</button><button class="pse-inspector-tab" type="button" data-inspector="effects">Efeitos</button></nav><div id="pseInspectorBody" class="pse-inspector-body"></div></aside></main>
    <footer class="pse-statusbar"><span>Painel <b id="pseStatusName">${esc(p.name)}</b></span><span>Tamanho <b id="pseStatusSize">${p.box.width} × ${p.box.height}</b></span><span>Posição <b id="pseStatusPosition">${p.box.x}, ${p.box.y}</b></span><span>Zoom <b id="pseStatusZoom">${Math.round(doc.ui.zoom)}%</b></span><span id="pseSaveState" class="pse-save-state ${dirty?'dirty':''}">${dirty?'Alterações pendentes':'Salvo localmente'}</span></footer>${shortcutsHtml()}
    <input id="pseImageInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" hidden><input id="pseImportInput" type="file" accept="application/json,.json" hidden>
  </div>`;
  renderInspector();renderPreview();updateHistoryButtons();
}

function renderPreview(){
  const raw=panel(),preview=$('#psePreview',content);if(!raw||!preview)return;const p=M.normalizePanel(raw,definition()||raw),b=p.box,t=p.text,e=p.effects,img=p.image,scale=doc.ui.zoom/100;
  preview.classList.toggle('locked',p.locked);preview.style.width=`${b.width}px`;preview.style.height=`${b.height}px`;preview.style.padding=`${b.padding}px`;preview.style.borderRadius=`${b.radius}px`;preview.style.border=`${b.borderWidth}px solid ${p.surface.border}`;preview.style.background=M.background(p,false);preview.style.backgroundSize='auto';preview.style.backgroundPosition='center';preview.style.backgroundRepeat='no-repeat';preview.style.opacity=b.opacity/100;preview.style.clipPath=M.clipPath(p.shape);preview.style.transform=`translate(${b.x}px,${b.y}px) rotate(${p.shape.rotate}deg) skew(${p.shape.skewX}deg,${p.shape.skewY}deg) scale(${p.shape.scale/100*scale})`;preview.style.boxShadow=M.shadow(p);preview.style.backdropFilter=`blur(${e.backdropBlur}px)`;preview.style.filter=`brightness(${e.brightness}%) saturate(${e.saturate}%)`;preview.style.transformOrigin='center';
  const media=$('.pse-preview-media',preview);media.hidden=!p.content.image;media.style.backgroundImage=p.content.image?`url(${JSON.stringify(p.content.image)})`:'none';media.style.backgroundSize=img.fit==='auto'?'auto':img.fit;media.style.backgroundPosition=`${img.positionX}% ${img.positionY}%`;media.style.opacity=img.opacity/100;media.style.filter=`blur(${img.blur}px)`;media.style.transform=`scale(${img.scale/100})`;
  const title=$('.pse-preview-title',preview),kicker=$('.pse-preview-kicker',preview),body=$('.pse-preview-body',preview),button=$('.pse-preview-action',preview),font=M.FONT_OPTIONS[t.font]||M.FONT_OPTIONS.serif;
  kicker.textContent=p.content.kicker;kicker.style.cssText=`font-family:${font};color:${t.accent};text-align:${t.align}`;title.textContent=p.content.title;title.style.cssText=`font-family:${font};font-size:${t.size}px;font-weight:${t.weight};line-height:${t.lineHeight};letter-spacing:${t.letterSpacing}px;text-align:${t.align};color:${t.color}`;body.textContent=p.content.body;body.style.cssText=`font-family:${font};font-size:${t.bodySize}px;line-height:${t.lineHeight};text-align:${t.align};color:${t.muted}`;button.textContent=p.content.button;button.style.cssText=`font-family:${font};border-color:${t.accent};color:${t.color}`;button.hidden=!p.content.button;
  const size=$('#pseStatusSize',content),position=$('#pseStatusPosition',content),name=$('#pseStatusName',content);if(size)size.textContent=`${Math.round(b.width)} × ${Math.round(b.height)}`;if(position)position.textContent=`${Math.round(b.x)}, ${Math.round(b.y)}`;if(name)name.textContent=p.name;
}

function selectPanel(id){if(!M.getDefinition(doc,id))return;doc.ui.selectedId=id;renderPage();}
function createNew(){checkpoint();let n=1,id;do{id=`painel-personalizado-${n++}`;}while(M.getDefinition(doc,id));const p=M.createPanel({id,name:`Painel personalizado ${n-1}`,category:'Personalizados',title:'Novo painel de Astraeon',kicker:'Painel personalizado',body:'Estruture aqui uma nova experiência do jogo.',width:560,height:360},true);p.shortcut=`Ctrl+Alt+${Math.min(9,n-1)}`;doc.customPanels.push(p);doc.ui.selectedId=p.id;queueSave();renderPage();notify('Novo painel criado. Edite e publique quando estiver pronto.');}
function duplicatePanel(){const source=panel();if(!source)return;checkpoint();let base=M.safeId(`${source.id}-copia`),id=base,n=2;while(M.getDefinition(doc,id))id=`${base}-${n++}`;const copy=M.normalizePanel({...M.clone(source),id,name:`${source.name} — cópia`,custom:true,shortcut:''},source);doc.customPanels.push(copy);doc.ui.selectedId=id;queueSave();renderPage();notify('Painel duplicado.');}
function removeOrReset(){const p=panel();if(!p)return;if(p.custom){if(!confirm(`Excluir “${p.name}”? Esta ação pode ser desfeita com Ctrl+Z.`))return;checkpoint();doc.customPanels=doc.customPanels.filter(item=>item.id!==p.id);doc.ui.selectedId=M.CATALOG[0].id;queueSave();renderPage();notify('Painel personalizado excluído.');return;}if(!doc.panels[p.id]){notify('Este painel já usa o estilo original do jogo.');return;}if(!confirm(`Restaurar o painel “${p.name}” ao visual original do jogo?`))return;checkpoint();delete doc.panels[p.id];queueSave();renderPage();notify('Estilo original restaurado.');}
function mutate(callback,{renderInspectorAfter=false,checkpointFirst=true}={}){if(checkpointFirst)checkpoint();const target=mutablePanel();if(!target)return;callback(target);doc=M.normalize(doc);queueSave();if(renderInspectorAfter)renderInspector();renderPreview();updateLibraryStates();}
function updateLibraryStates(){for(const item of $$('.pse-panel-item',content)){const id=item.dataset.panelSelect,p=M.getPanel(doc,id);item.classList.toggle('modified',M.hasOverride(doc,id));item.classList.toggle('disabled',!p?.enabled);const label=item.querySelector('b');if(label&&p)label.textContent=p.name;}}
function setZoom(value){doc.ui.zoom=M.clamp(value,25,160);const label=$('#pseZoomLabel',content),status=$('#pseStatusZoom',content);if(label)label.textContent=`${Math.round(doc.ui.zoom)}%`;if(status)status.textContent=`${Math.round(doc.ui.zoom)}%`;renderPreview();queueSave();}
function applyPreset(name){
  const presets={astra:{surface:{background:'#080807',gradient:'#21170f',border:'#c79b52',overlay:'#000000',angle:145,overlayOpacity:16},text:{color:'#eee1c9',muted:'#918678',accent:'#d4aa62',font:'serif'},effects:{glow:8,backdropBlur:8,brightness:100,saturate:100}},glass:{surface:{background:'#07131b',gradient:'#102b38',border:'#76d6ff',overlay:'#02080c',angle:135,overlayOpacity:22},text:{color:'#e3f8ff',muted:'#89aab7',accent:'#76d6ff',font:'sans'},effects:{glow:24,backdropBlur:18,brightness:105,saturate:118}},void:{surface:{background:'#040308',gradient:'#1a0d24',border:'#9a5fc0',overlay:'#000000',angle:160,overlayOpacity:28},text:{color:'#eee5f4',muted:'#9c8fa5',accent:'#bf7be8',font:'display'},effects:{glow:32,backdropBlur:12,brightness:92,saturate:130}},lumen:{surface:{background:'#131008',gradient:'#473315',border:'#e6bd66',overlay:'#140d02',angle:125,overlayOpacity:12},text:{color:'#fff1c9',muted:'#c7ad7a',accent:'#ffd56f',font:'display'},effects:{glow:38,backdropBlur:6,brightness:110,saturate:118}}};const preset=presets[name];if(!preset)return;mutate(p=>{for(const[key,value]of Object.entries(preset))Object.assign(p[key],value);},{renderInspectorAfter:true});notify('Preset aplicado.');
}
function copyStyle(){const p=panel();if(!p)return;const{x,y,z,...boxStyle}=p.box;void x;void y;void z;styleClipboard=M.clone({box:boxStyle,text:p.text,surface:p.surface,image:p.image,shape:p.shape,effects:p.effects});notify('Estilo copiado. Use Ctrl+Shift+V em outro painel.');}
function pasteStyle(){if(!styleClipboard){notify('Copie primeiro o estilo de um painel com Ctrl+Shift+C.');return;}mutate(p=>{for(const key of ['box','text','surface','image','shape','effects'])Object.assign(p[key],M.clone(styleClipboard[key]));},{renderInspectorAfter:true});notify('Estilo colado.');}
function exportProject(){saveNow(true);const blob=new Blob([JSON.stringify(doc,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`astraeon-paineis-${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);notify('Projeto de painéis exportado.');}
async function importProject(file){try{const text=await file.text(),next=M.normalize(JSON.parse(text));checkpoint();doc=next;queueSave();renderPage();notify('Projeto de painéis importado e validado.');}catch(_){notify('Arquivo de painéis inválido.');}}
function openGame(){saveNow(true);const id=encodeURIComponent(selectedId());global.open(`index.html?panelPreview=${id}`,'_blank','noopener');}

function inputValue(input){if(input.type==='checkbox')return input.checked;if(input.type==='number'||input.type==='range')return Number(input.value);return input.value;}
function onInput(event){
  const input=event.target.closest('[data-path]');if(!input)return;if(!editSnapshot)editSnapshot=snapshot();if(!editCheckpointed){checkpoint(editSnapshot);editCheckpointed=true;}const target=mutablePanel();if(!target)return;setPath(target,input.dataset.path,inputValue(input));const mirror=input.type==='color'?content.querySelector(`[data-color-mirror="${CSS.escape(input.dataset.path)}"]`):null;if(mirror)mirror.value=input.value;queueSave();renderPreview();updateLibraryStates();
}
function onChange(event){const input=event.target.closest('[data-path]');if(!input)return;editSnapshot=null;editCheckpointed=false;doc=M.normalize(doc);saveNow(true);renderInspector();renderPreview();}
function onFocusIn(event){if(event.target.matches('[data-path]')){editSnapshot=snapshot();editCheckpointed=false;}}
function onColorMirror(event){const mirror=event.target.closest('[data-color-mirror]');if(!mirror||!/^#[0-9a-f]{6}$/i.test(mirror.value))return;const color=content.querySelector(`input[type="color"][data-path="${CSS.escape(mirror.dataset.colorMirror)}"]`);if(color){color.value=mirror.value;color.dispatchEvent(new Event('input',{bubbles:true}));}}

function handleAction(action){
  const actions={undo,redo,new:createNew,duplicate:duplicatePanel,save:()=>saveNow(),export:exportProject,import:()=>$('#pseImportInput',content)?.click(),'open-game':openGame,shortcuts:()=>$('#pseShortcuts',content)?.classList.remove('hidden'),'shortcuts-close':()=>$('#pseShortcuts',content)?.classList.add('hidden'),'toggle-inspector':()=>$('.panel-editor-page',content)?.classList.toggle('inspector-open'),'zoom-in':()=>setZoom(doc.ui.zoom+10),'zoom-out':()=>setZoom(doc.ui.zoom-10),'zoom-reset':()=>setZoom(100),grid:()=>{doc.ui.grid=!doc.ui.grid;renderPage();queueSave();},snap:()=>{doc.ui.snap=!doc.ui.snap;renderPage();queueSave();},'pick-image':()=>$('#pseImageInput',content)?.click(),'clear-image':()=>mutate(p=>{p.content.image='';},{renderInspectorAfter:true}),'center-panel':()=>mutate(p=>{p.box.x=0;p.box.y=0;},{renderInspectorAfter:true}),'fit-panel':()=>mutate(p=>{const limits=doc.ui.viewport==='mobile'?[350,620]:doc.ui.viewport==='tablet'?[700,620]:[900,680],ratio=Math.min(1,limits[0]/p.box.width,limits[1]/p.box.height);p.box.width=Math.round(p.box.width*ratio);p.box.height=Math.round(p.box.height*ratio);p.box.x=0;p.box.y=0;},{renderInspectorAfter:true})};actions[action]?.();
}
function onClick(event){
  const select=event.target.closest('[data-panel-select]');if(select){selectPanel(select.dataset.panelSelect);return;}
  const inspector=event.target.closest('[data-inspector]');if(inspector){doc.ui.inspector=inspector.dataset.inspector;renderInspector();queueSave();return;}
  const viewport=event.target.closest('[data-viewport]');if(viewport){doc.ui.viewport=viewport.dataset.viewport;renderPage();queueSave();return;}
  const align=event.target.closest('[data-align]');if(align){mutate(p=>{p.text.align=align.dataset.align;},{renderInspectorAfter:true});return;}
  const vertices=event.target.closest('[data-vertices]');if(vertices){const value=Number(vertices.dataset.vertices);mutate(p=>{for(const key of ['topLeft','topRight','bottomRight','bottomLeft'])p.shape[key]=value;},{renderInspectorAfter:true});return;}
  const preset=event.target.closest('[data-preset]');if(preset){applyPreset(preset.dataset.preset);return;}
  const action=event.target.closest('[data-action]');if(action)handleAction(action.dataset.action);
}
function onSearch(event){if(event.target.id!=='pseSearch')return;const query=event.target.value.trim().toLowerCase();$$('.pse-panel-item',content).forEach(item=>item.hidden=query&&!item.dataset.search.includes(query));$$('.pse-category',content).forEach(category=>{let cursor=category.nextElementSibling,visible=false;while(cursor&&!cursor.classList.contains('pse-category')){if(cursor.classList.contains('pse-panel-item')&&!cursor.hidden)visible=true;cursor=cursor.nextElementSibling;}category.hidden=!visible;});}
async function onFile(event){
  const file=event.target.files?.[0];if(!file)return;
  if(event.target.id==='pseImportInput'){await importProject(file);return;}
  if(file.size>2*1024*1024){notify('Use uma imagem com até 2 MB para evitar exceder o armazenamento local.');event.target.value='';return;}
  const reader=new FileReader();reader.onload=()=>mutate(p=>{p.content.image=String(reader.result||'');p.content.imageAlt=file.name;},{renderInspectorAfter:true});reader.readAsDataURL(file);
}

function snapValue(value){if(!doc.ui.snap)return value;return Math.round(value/doc.ui.gridSize)*doc.ui.gridSize;}
function onPointerDown(event){
  const preview=event.target.closest('#psePreview');if(!preview||panel()?.locked)return;event.preventDefault();const p=panel(),handle=event.target.closest('[data-handle]')?.dataset.handle||'move';drag={pointerId:event.pointerId,handle,startX:event.clientX,startY:event.clientY,b:M.clone(p.box),before:snapshot()};preview.setPointerCapture?.(event.pointerId);
}
function onPointerMove(event){
  if(!drag||event.pointerId!==drag.pointerId)return;const scale=doc.ui.zoom/100||1,dx=(event.clientX-drag.startX)/scale,dy=(event.clientY-drag.startY)/scale,target=mutablePanel();if(!target)return;
  if(drag.handle==='move'){target.box.x=snapValue(drag.b.x+dx);target.box.y=snapValue(drag.b.y+dy);}else{const h=drag.handle;if(h.includes('e'))target.box.width=Math.max(180,snapValue(drag.b.width+dx));if(h.includes('s'))target.box.height=Math.max(80,snapValue(drag.b.height+dy));if(h.includes('w')){target.box.width=Math.max(180,snapValue(drag.b.width-dx));target.box.x=snapValue(drag.b.x+dx/2);}if(h.includes('n')){target.box.height=Math.max(80,snapValue(drag.b.height-dy));target.box.y=snapValue(drag.b.y+dy/2);}}
  setDirty(true);renderPreview();
}
function onPointerUp(event){if(!drag||event.pointerId!==drag.pointerId)return;if(drag.before!==snapshot())checkpoint(drag.before);drag=null;doc=M.normalize(doc);queueSave();renderInspector();renderPreview();}

function keyInsideField(event){const tag=event.target?.tagName;return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||event.target?.isContentEditable;}
function onKey(event){
  if(!isActive())return;const key=event.key.toLowerCase(),ctrl=event.ctrlKey||event.metaKey;
  const consume=()=>{event.preventDefault();event.stopImmediatePropagation();};
  if(event.key==='Escape'&&!$('#pseShortcuts',content)?.classList.contains('hidden')){consume();$('#pseShortcuts',content).classList.add('hidden');return;}
  if(keyInsideField(event)){if(ctrl&&key==='s'){consume();saveNow();}return;}
  if(ctrl&&key==='s'){consume();saveNow();}else if(ctrl&&key==='z'&&!event.shiftKey){consume();undo();}else if((ctrl&&key==='y')||(ctrl&&event.shiftKey&&key==='z')){consume();redo();}else if(ctrl&&key==='d'){consume();duplicatePanel();}else if(ctrl&&key==='n'){consume();createNew();}else if(ctrl&&event.shiftKey&&key==='c'){consume();copyStyle();}else if(ctrl&&event.shiftKey&&key==='v'){consume();pasteStyle();}else if(ctrl&&(key==='+'||key==='=')){consume();setZoom(doc.ui.zoom+10);}else if(ctrl&&key==='-'){consume();setZoom(doc.ui.zoom-10);}else if(ctrl&&key==='0'){consume();setZoom(100);}else if(event.key==='Delete'){consume();removeOrReset();}else if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)&&!panel()?.locked){consume();const before=snapshot(),step=event.shiftKey?10:1,target=mutablePanel();if(event.key==='ArrowLeft')target.box.x-=step;if(event.key==='ArrowRight')target.box.x+=step;if(event.key==='ArrowUp')target.box.y-=step;if(event.key==='ArrowDown')target.box.y+=step;checkpoint(before);queueSave();renderPreview();}
}
function isActive(){return !!content?.classList.contains('panel-editor-host')&&!root?.classList.contains('hidden')&&tab?.classList.contains('active');}
function bindPage(){content.addEventListener('click',onClick);content.addEventListener('input',event=>{onInput(event);onColorMirror(event);onSearch(event);});content.addEventListener('change',event=>{onChange(event);void onFile(event);});content.addEventListener('focusin',onFocusIn);content.addEventListener('pointerdown',onPointerDown);global.addEventListener('pointermove',onPointerMove,true);global.addEventListener('pointerup',onPointerUp,true);global.addEventListener('pointercancel',onPointerUp,true);global.addEventListener('keydown',onKey,true);}
function openEditor(){doc=M.load();tab.classList.add('active');$$('[data-admin-tab]',root).forEach(button=>button.classList.toggle('active',button===tab));renderPage();}
function install(){
  if(installed)return;M=global.AstraeonPanelStudioModel;root=$('#adminPanel');content=$('#adminContent');const tabs=root?.querySelector('.admin-tabs');if(!M||!root||!content||!tabs){setTimeout(install,80);return;}
  installed=true;ensureStyle();doc=M.load();tab=document.createElement('button');tab.type='button';tab.className='admin-tab';tab.dataset.adminTab='panel-editor';tab.textContent='Editor de Painéis';tabs.appendChild(tab);tab.addEventListener('click',event=>{event.preventDefault();event.stopPropagation();openEditor();});
  root.addEventListener('click',event=>{const target=event.target.closest('[data-admin-tab]');if(target&&target!==tab)content.classList.remove('panel-editor-host');});
  $('#adminOpenBtn')?.addEventListener('click',()=>setTimeout(()=>{if(tab.classList.contains('active'))openEditor();},0));new MutationObserver(()=>{if(!root.classList.contains('hidden')&&tab.classList.contains('active')&&!content.classList.contains('panel-editor-host'))openEditor();}).observe(root,{attributes:true,attributeFilter:['class']});
  bindPage();global.AstraeonPanelEditorV7={open:()=>{root.classList.remove('hidden');openEditor();},save:saveNow,get document(){return M.clone(doc);}};global.dispatchEvent(new CustomEvent('astraeon:panel-editor-ready',{detail:{version:VERSION,count:M.list(doc).length}}));
}

global.AstraeonAdminPanelEditorV7={install};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else install();
})(window);

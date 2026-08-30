(function(global){
'use strict';

const STORAGE_KEY='astraeon:v7:panel-studio';
const VERSION=2;

const CATALOG=[
  {id:'start-main',name:'Menu principal',category:'Entrada',selector:'#startScreen .start-panel',titleSelector:'.logo',kickerSelector:'.eyebrow',bodySelector:'.lead',buttonSelector:'#newGameBtn',title:'ASTRAEON',kicker:'Ecos da Convergência',body:'Explore Astra em cinco climas e construa a sua jornada.',button:'Nova jornada',width:520,height:500},
  {id:'start-world',name:'Apresentação do mundo',category:'Entrada',selector:'#startScreen .world-panel',titleSelector:'.world-copy h3',kickerSelector:'.world-kicker',bodySelector:'.world-copy p',title:'Astra, continente vivo',kicker:'Mundo conectado',body:'Cidades, viajantes e histórias fazem parte do mundo.',width:590,height:500},
  {id:'character-creation',name:'Criação de personagem',category:'Entrada',selector:'#classScreen .modal-card',titleSelector:'.modal-head h2',kickerSelector:'.eyebrow',bodySelector:'.modal-head p',buttonSelector:'#beginBtn',title:'Escolha seu vínculo astral',kicker:'Criação de personagem',body:'Defina a identidade do novo viajante.',button:'Entrar em Astraeon',width:900,height:620},
  {id:'hud-player',name:'HUD do personagem',category:'HUD',selector:'#hud .player-card',titleSelector:'#charText',kickerSelector:'#climateText',bodySelector:'.player-meta',title:'Viajante',kicker:'Convergência',body:'Vida, mana, fôlego e progressão.',width:340,height:148,dynamicContent:true},
  {id:'hud-quest',name:'HUD da jornada',category:'HUD',selector:'#hud .quest-card',titleSelector:'.quest-kicker span:first-child',bodySelector:'#questText',title:'Jornada principal',kicker:'Convergência',body:'Elimine criaturas e explore novos biomas.',width:260,height:128,dynamicContent:true},
  {id:'hud-minimap',name:'Minimapa',category:'HUD',selector:'#hud .minimap-shell',title:'Minimapa',kicker:'Navegação',body:'Radar do mundo e posição do viajante.',width:174,height:174,dynamicContent:true},
  {id:'hud-hotbar',name:'Barra de habilidades',category:'HUD',selector:'#hud .hotbar',title:'Habilidades',kicker:'Combate',body:'Atalhos de habilidades 1–5.',width:270,height:58,dynamicContent:true},
  {id:'inventory',name:'Inventário',category:'Sobreposições',selector:'#inventoryPanel > .overlay-card',rootSelector:'#inventoryPanel',titleSelector:'.overlay-head h2',kickerSelector:'.panel-kicker',bodySelector:'.overlay-head p',title:'Inventário do Viajante',kicker:'Arsenal da Convergência',body:'Equipamento, requisitos de uso e mochila 5×5.',width:560,height:620},
  {id:'characteristics',name:'Características',category:'Sobreposições',selector:'#characteristicsPanel > .characteristics-card',rootSelector:'#characteristicsPanel',titleSelector:'.characteristics-title h2',kickerSelector:'.characteristics-title span',bodySelector:'.characteristics-title p',title:'Características',kicker:'Essência do Viajante',body:'Distribuição de atributos e evolução do personagem.',width:980,height:730,dynamicContent:true},
  {id:'map',name:'Mapa Astral',category:'Sobreposições',selector:'#mapPanel > .overlay-card',rootSelector:'#mapPanel',titleSelector:'.overlay-head h2',kickerSelector:'.panel-kicker',bodySelector:'.overlay-head p',title:'Mapa Astral',kicker:'Cartografia',body:'Cidades, cinco climas e sua posição atual.',width:720,height:680},
  {id:'help',name:'Manual do viajante',category:'Sobreposições',selector:'#helpPanel > .overlay-card',rootSelector:'#helpPanel',titleSelector:'.overlay-head h2',kickerSelector:'.panel-kicker',bodySelector:'.overlay-head p',title:'Manual do viajante',kicker:'Codex',body:'Controles e sistemas principais.',width:720,height:520},
  {id:'settings',name:'Configurações',category:'Sobreposições',selector:'#settingsPanel > .overlay-card',rootSelector:'#settingsPanel',titleSelector:'.overlay-head h2',kickerSelector:'.panel-kicker',bodySelector:'.overlay-head p',title:'Configurações',kicker:'Sistema',body:'Ajustes salvos automaticamente neste navegador.',width:610,height:500},
  {id:'pause',name:'Pausa',category:'Sobreposições',selector:'#pauseScreen > .overlay-card',rootSelector:'#pauseScreen',titleSelector:'h2',kickerSelector:'.eyebrow',bodySelector:'p',buttonSelector:'#resumeBtn',title:'Pausa',kicker:'Jornada suspensa',body:'O mundo permanece salvo enquanto você estiver ausente.',button:'Continuar',width:380,height:360},
  {id:'online-chat',name:'Chat de Astra',category:'Online',selector:'.online-chat',titleSelector:'header b',bodySelector:'.online-chat-line.system span',title:'Chat de Astra',kicker:'Online',body:'Converse com viajantes conectados.',width:390,height:280,dynamicContent:true},
  {id:'online-account',name:'Conta do viajante',category:'Online',selector:'.online-account-card',titleSelector:'h2',bodySelector:'p',title:'Conta do viajante',kicker:'Online',body:'Perfil, sessão e sincronização.',width:620,height:560,dynamicContent:true},
  {id:'npc-dialogue',name:'Diálogo com NPC',category:'Mundo',selector:'.npc-dialogue-card',titleSelector:'h2',bodySelector:'.npc-dialogue-messages',title:'Habitante de Astra',kicker:'Diálogo',body:'História e opções de conversa.',width:620,height:430,dynamicContent:true}
];

const FONT_OPTIONS={
  serif:"Georgia, 'Times New Roman', serif",
  sans:"Inter, ui-sans-serif, system-ui, sans-serif",
  display:"Cinzel, Georgia, serif",
  mono:"'SFMono-Regular', Consolas, monospace"
};

const clone=value=>JSON.parse(JSON.stringify(value));
const finite=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,finite(value,min)));
const safeColor=(value,fallback)=>/^#[0-9a-f]{6}$/i.test(String(value||''))?String(value):fallback;
const safeId=value=>String(value||'panel').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,52)||'panel';
const ELEMENT_TYPES=['text','button','image','container','grid'];

function createNode(source={},custom=false){
  const type=ELEMENT_TYPES.includes(source.type)?source.type:'container';
  return{
    id:safeId(source.id||`${type}-${Date.now()}`),
    name:String(source.name||({text:'Texto',button:'Botão',image:'Imagem',container:'Contêiner',grid:'Grid'}[type])).slice(0,80),
    selector:String(source.selector||''),parentId:String(source.parentId||''),parentSelector:String(source.parentSelector||''),
    custom:!!custom,type,hidden:!!source.hidden,locked:!!source.locked,contentSet:source.contentSet===true||!!custom,styleSet:Array.isArray(source.styleSet)?source.styleSet.map(String):[],
    content:{text:String(source.content?.text??source.text??''),src:String(source.content?.src??''),alt:String(source.content?.alt??''),title:String(source.content?.title??''),ariaLabel:String(source.content?.ariaLabel??'')},
    grid:{columns:Math.round(clamp(source.grid?.columns??3,1,24)),rows:Math.round(clamp(source.grid?.rows??2,1,24)),cells:Math.round(clamp(source.grid?.cells??6,0,240))},
    style:{display:String(source.style?.display||''),position:String(source.style?.position||'flow'),x:finite(source.style?.x,0),y:finite(source.style?.y,0),width:String(source.style?.width??'auto'),height:String(source.style?.height??'auto'),minWidth:String(source.style?.minWidth??''),maxWidth:String(source.style?.maxWidth??''),minHeight:String(source.style?.minHeight??''),maxHeight:String(source.style?.maxHeight??''),gap:finite(source.style?.gap,8),padding:finite(source.style?.padding,0),margin:finite(source.style?.margin,0),zIndex:Math.round(finite(source.style?.zIndex,0)),order:Math.round(finite(source.style?.order,0)),flexDirection:String(source.style?.flexDirection||'row'),alignItems:String(source.style?.alignItems||''),justifyContent:String(source.style?.justifyContent||''),background:String(source.style?.background||''),color:String(source.style?.color||''),borderColor:String(source.style?.borderColor||''),borderWidth:finite(source.style?.borderWidth,0),borderRadius:finite(source.style?.borderRadius,0),fontFamily:String(source.style?.fontFamily||''),fontSize:finite(source.style?.fontSize,0),fontWeight:Math.round(finite(source.style?.fontWeight,0)),textAlign:String(source.style?.textAlign||''),lineHeight:finite(source.style?.lineHeight,0),letterSpacing:finite(source.style?.letterSpacing,0),opacity:clamp(source.style?.opacity??100,0,100),rotate:finite(source.style?.rotate,0),scale:clamp(source.style?.scale??100,10,400),shadow:String(source.style?.shadow||''),filter:String(source.style?.filter||'')}
  };
}

function normalizeNode(input={},custom=false){
  const node=createNode(input,custom||input.custom);
  node.style.position=['flow','relative','absolute','fixed'].includes(node.style.position)?node.style.position:'flow';
  node.style.x=clamp(node.style.x,-4000,4000);node.style.y=clamp(node.style.y,-4000,4000);node.style.gap=clamp(node.style.gap,0,240);node.style.padding=clamp(node.style.padding,0,320);node.style.margin=clamp(node.style.margin,-320,320);node.style.zIndex=Math.round(clamp(node.style.zIndex,-999,9999));node.style.order=Math.round(clamp(node.style.order,-999,999));
  node.style.borderWidth=clamp(node.style.borderWidth,0,40);node.style.borderRadius=clamp(node.style.borderRadius,0,500);node.style.fontSize=clamp(node.style.fontSize,0,240);node.style.fontWeight=Math.round(clamp(node.style.fontWeight,0,900));node.style.lineHeight=clamp(node.style.lineHeight,0,5);node.style.letterSpacing=clamp(node.style.letterSpacing,-20,80);node.style.rotate=clamp(node.style.rotate,-360,360);
  return node;
}

function createElement(type='text',parentSelector=''){
  const labels={text:'Novo texto',button:'Novo botão',image:'Nova imagem',container:'Novo contêiner',grid:'Novo grid'};
  const node=createNode({id:`${type}-${Date.now()}`,type,name:labels[type]||'Novo elemento',parentSelector},true);
  if(type==='text')node.content.text='Novo texto';
  if(type==='button')node.content.text='Novo botão';
  if(type==='image')node.content.alt='Imagem do painel';
  if(type==='grid'){node.style.display='grid';node.grid={columns:3,rows:2,cells:6};}
  if(type==='container')node.style.display='flex';
  return node;
}

function createPanel(source={},custom=false){
  const width=clamp(source.width||560,180,1600),height=clamp(source.height||420,80,1200);
  return{
    id:safeId(source.id||`panel-${Date.now()}`),
    name:String(source.name||'Novo painel').slice(0,80),
    category:String(source.category||(custom?'Personalizados':'Painéis')).slice(0,40),
    custom:!!custom,
    enabled:true,
    locked:false,
    shortcut:custom?'Ctrl+Alt+1':'',
    content:{
      kicker:String(source.kicker||'ASTRAEON').slice(0,120),
      title:String(source.title||source.name||'Novo painel').slice(0,180),
      body:String(source.body||'Edite o conteúdo deste painel no Admin Studio.').slice(0,1200),
      button:String(source.button??'').slice(0,80),
      image:'',imageAlt:''
    },
    box:{width,height,padding:24,radius:12,borderWidth:1,x:0,y:0,z:60,opacity:100},
    text:{font:'serif',size:28,bodySize:12,weight:700,lineHeight:1.45,letterSpacing:0,align:'left',color:'#eee1c9',muted:'#918678',accent:'#d4aa62'},
    surface:{background:'#080807',gradient:'#1b1510',angle:145,border:'#c79b52',overlay:'#000000',overlayOpacity:16},
    image:{fit:'cover',positionX:50,positionY:50,opacity:34,blur:0,scale:100},
    shape:{topLeft:0,topRight:0,bottomRight:0,bottomLeft:0,rotate:0,skewX:0,skewY:0,scale:100},
    effects:{shadowX:0,shadowY:24,shadowBlur:70,shadowSpread:0,shadowColor:'#000000',shadowOpacity:68,glow:0,backdropBlur:8,brightness:100,saturate:100},
    nodes:{},customElements:[]
  };
}

function normalizePanel(input,source={}){
  const base=createPanel({...source,...input},!!input?.custom);
  const panel=input&&typeof input==='object'?input:{};
  base.enabled=panel.enabled!==false;
  base.locked=!!panel.locked;
  base.shortcut=String(panel.shortcut||base.shortcut).slice(0,40);
  for(const key of ['content','box','text','surface','image','shape','effects'])if(panel[key]&&typeof panel[key]==='object')Object.assign(base[key],panel[key]);
  base.box.width=clamp(base.box.width,180,1600);base.box.height=clamp(base.box.height,80,1200);base.box.padding=clamp(base.box.padding,0,160);base.box.radius=clamp(base.box.radius,0,120);base.box.borderWidth=clamp(base.box.borderWidth,0,12);base.box.x=clamp(base.box.x,-1200,1200);base.box.y=clamp(base.box.y,-900,900);base.box.z=Math.round(clamp(base.box.z,0,999));base.box.opacity=clamp(base.box.opacity,0,100);
  base.text.size=clamp(base.text.size,8,120);base.text.bodySize=clamp(base.text.bodySize,7,64);base.text.weight=Math.round(clamp(base.text.weight,100,900)/100)*100;base.text.lineHeight=clamp(base.text.lineHeight,.7,3);base.text.letterSpacing=clamp(base.text.letterSpacing,-5,30);base.text.align=['left','center','right'].includes(base.text.align)?base.text.align:'left';base.text.font=FONT_OPTIONS[base.text.font]?base.text.font:'serif';
  for(const key of ['color','muted','accent'])base.text[key]=safeColor(base.text[key],createPanel(source).text[key]);
  for(const key of ['background','gradient','border','overlay'])base.surface[key]=safeColor(base.surface[key],createPanel(source).surface[key]);
  base.surface.angle=clamp(base.surface.angle,0,360);base.surface.overlayOpacity=clamp(base.surface.overlayOpacity,0,100);
  base.image.fit=['cover','contain','auto'].includes(base.image.fit)?base.image.fit:'cover';base.image.positionX=clamp(base.image.positionX,0,100);base.image.positionY=clamp(base.image.positionY,0,100);base.image.opacity=clamp(base.image.opacity,0,100);base.image.blur=clamp(base.image.blur,0,40);base.image.scale=clamp(base.image.scale,25,300);
  for(const key of ['topLeft','topRight','bottomRight','bottomLeft'])base.shape[key]=clamp(base.shape[key],0,160);
  base.shape.rotate=clamp(base.shape.rotate,-180,180);base.shape.skewX=clamp(base.shape.skewX,-60,60);base.shape.skewY=clamp(base.shape.skewY,-60,60);base.shape.scale=clamp(base.shape.scale,10,300);
  base.effects.shadowX=clamp(base.effects.shadowX,-120,120);base.effects.shadowY=clamp(base.effects.shadowY,-120,120);base.effects.shadowBlur=clamp(base.effects.shadowBlur,0,240);base.effects.shadowSpread=clamp(base.effects.shadowSpread,-40,100);base.effects.shadowOpacity=clamp(base.effects.shadowOpacity,0,100);base.effects.glow=clamp(base.effects.glow,0,100);base.effects.backdropBlur=clamp(base.effects.backdropBlur,0,60);base.effects.brightness=clamp(base.effects.brightness,10,250);base.effects.saturate=clamp(base.effects.saturate,0,300);base.effects.shadowColor=safeColor(base.effects.shadowColor,'#000000');
  for(const key of ['kicker','title','body','button','image','imageAlt'])base.content[key]=String(base.content[key]??'');
  base.nodes={};
  for(const [id,rawNode] of Object.entries(panel.nodes&&typeof panel.nodes==='object'?panel.nodes:{})){const node=normalizeNode({...rawNode,id},false);if(node.selector)base.nodes[node.id]=node;}
  base.customElements=[];
  const used=new Set(Object.keys(base.nodes));
  for(const rawNode of Array.isArray(panel.customElements)?panel.customElements:[]){const node=normalizeNode(rawNode,true);let id=safeId(node.id),n=2;while(used.has(id))id=`${safeId(node.id)}-${n++}`;node.id=id;used.add(id);base.customElements.push(node);}
  return base;
}

function defaults(){return{version:VERSION,updatedAt:null,panels:{},customPanels:[],ui:{selectedId:CATALOG[0].id,selectedNodeId:'root',inspector:'content',zoom:80,grid:true,snap:true,gridSize:8,viewport:'desktop'}};}
function normalize(input){
  const doc=defaults(),raw=input&&typeof input==='object'?input:{};
  doc.updatedAt=raw.updatedAt||null;
  if(raw.ui&&typeof raw.ui==='object')Object.assign(doc.ui,raw.ui);
  doc.ui.zoom=clamp(doc.ui.zoom,25,160);doc.ui.gridSize=Math.round(clamp(doc.ui.gridSize,2,64));doc.ui.inspector=['content','layout','style','effects'].includes(doc.ui.inspector)?doc.ui.inspector:'content';doc.ui.viewport=['desktop','tablet','mobile'].includes(doc.ui.viewport)?doc.ui.viewport:'desktop';doc.ui.grid=doc.ui.grid!==false;doc.ui.snap=doc.ui.snap!==false;
  for(const item of CATALOG){const rawSaved=raw.panels?.[item.id];if(rawSaved){const saved=clone(rawSaved);if(finite(raw.version,1)<2&&item.button==null&&saved.content?.button==='Continuar')saved.content.button='';doc.panels[item.id]=normalizePanel({...saved,id:item.id,name:saved.name||item.name,custom:false},item);}}
  const used=new Set(CATALOG.map(item=>item.id));
  for(const sourcePanel of Array.isArray(raw.customPanels)?raw.customPanels:[]){const rawPanel=clone(sourcePanel);if(finite(raw.version,1)<2&&rawPanel.content?.button==='Continuar')rawPanel.content.button='';let panel=normalizePanel({...rawPanel,custom:true},rawPanel);let id=safeId(panel.id);let n=2;while(used.has(id))id=`${safeId(panel.id)}-${n++}`;panel.id=id;used.add(id);doc.customPanels.push(panel);}
  if(!getDefinition(doc,doc.ui.selectedId))doc.ui.selectedId=CATALOG[0].id;
  return doc;
}
function load(){try{return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}'));}catch(_){return defaults();}}
function save(doc){const next=normalize(doc);next.updatedAt=new Date().toISOString();localStorage.setItem(STORAGE_KEY,JSON.stringify(next));return next;}
function getCatalog(id){return CATALOG.find(item=>item.id===id)||null;}
function getDefinition(doc,id){return getCatalog(id)||doc?.customPanels?.find(item=>item.id===id)||null;}
function getPanel(doc,id){const source=getCatalog(id);if(source)return normalizePanel(doc?.panels?.[id]||{id,name:source.name},source);const custom=doc?.customPanels?.find(item=>item.id===id);return custom?normalizePanel(custom,custom):null;}
function hasOverride(doc,id){return !!doc?.panels?.[id]||!!doc?.customPanels?.some(item=>item.id===id);}
function list(doc){return[...CATALOG.map(source=>({...source,panel:getPanel(doc,source.id),custom:false,modified:!!doc?.panels?.[source.id]})),...(doc?.customPanels||[]).map(panel=>({...panel,panel:getPanel(doc,panel.id),custom:true,modified:true}))];}
function clipPath(shape){const s=shape||{},tl=finite(s.topLeft),tr=finite(s.topRight),br=finite(s.bottomRight),bl=finite(s.bottomLeft);if(!(tl||tr||br||bl))return'none';return`polygon(${tl}px 0,calc(100% - ${tr}px) 0,100% ${tr}px,100% calc(100% - ${br}px),calc(100% - ${br}px) 100%,${bl}px 100%,0 calc(100% - ${bl}px),0 ${tl}px)`;}
function rgba(hex,alpha){const value=safeColor(hex,'#000000').slice(1),n=parseInt(value,16);return`rgba(${n>>16},${n>>8&255},${n&255},${clamp(alpha,0,100)/100})`;}
function background(panel,includeImage=true){const s=panel.surface,img=includeImage&&panel.content.image?`url(${JSON.stringify(panel.content.image)})`:'';return[`linear-gradient(${rgba(s.overlay,s.overlayOpacity)},${rgba(s.overlay,s.overlayOpacity)})`,img,`linear-gradient(${s.angle}deg,${s.gradient},${s.background})`].filter(Boolean).join(',');}
function transform(panel){const b=panel.box,s=panel.shape;return`translate(${b.x}px,${b.y}px) rotate(${s.rotate}deg) skew(${s.skewX}deg,${s.skewY}deg) scale(${s.scale/100})`;}
function shadow(panel){const e=panel.effects;return`${e.shadowX}px ${e.shadowY}px ${e.shadowBlur}px ${e.shadowSpread}px ${rgba(e.shadowColor,e.shadowOpacity)}${e.glow?`,0 0 ${Math.round(e.glow*.7)}px ${rgba(panel.text.accent,Math.min(72,e.glow))}`:''}`;}

global.AstraeonPanelStudioModel={STORAGE_KEY,VERSION,CATALOG:clone(CATALOG),FONT_OPTIONS:{...FONT_OPTIONS},ELEMENT_TYPES:[...ELEMENT_TYPES],clone,clamp,safeId,createNode,normalizeNode,createElement,createPanel,normalizePanel,defaults,normalize,load,save,getCatalog,getDefinition,getPanel,hasOverride,list,clipPath,rgba,background,transform,shadow};
})(window);

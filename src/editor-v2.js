(function(){
'use strict';
const W=window.AstraeonWorld;
if(!W) throw new Error('AstraeonWorld não carregado.');
const $=s=>document.querySelector(s), $$=s=>Array.from(document.querySelectorAll(s));
const AUTO_EXPORT_KEY='astraeon:v5:auto-export';
const AUTOSAVE_DELAY=650;
const AUTOEXPORT_DELAY=950;

class AstraeonEditor{
  constructor(){
    this.canvas=$('#editorCanvas');
    this.ctx=this.canvas.getContext('2d');
    this.dpr=Math.min(window.devicePixelRatio||1,2);
    this.design=W.loadWorldDesign()||W.makeDefaultDesign('ASTRAEON-2');
    this.design.overrides=this.design.overrides||{};
    this.design.spawns=Array.isArray(this.design.spawns)?this.design.spawns:[];
    this.tool='biome';this.biome='forest';this.object='tree';this.mob='Slime';this.brush=1;
    this.layers={terrain:true,objects:true,collision:true,spawns:true,grid:true};
    this.view={x:0,y:0,zoom:.38};
    this.pointer={x:0,y:0,tx:-1,ty:-1,down:false,lastX:0,lastY:0};
    this.selected=null;this.dragPan=false;this.strokeSnapshot=null;
    this.undoStack=[];this.redoStack=[];this.history=[];
    this.dirty=false;this.exportDirty=false;this.exportFileHandle=null;
    this.autosaveTimer=null;this.autoExportTimer=null;
    this.autoExport=localStorage.getItem(AUTO_EXPORT_KEY)!=='0';
    this.world=W.generateWorld({seed:this.design.seed,custom:this.design});
    this.cacheUI();this.buildPalette();this.bind();this.resize();this.fitWorld();this.refreshAll();this.syncExportUI();this.draw();
  }

  cacheUI(){
    this.ui={
      seed:$('#seedInput'),object:$('#objectSelect'),mob:$('#mobSelect'),brush:$('#brushSize'),coords:$('#cursorCoord'),zoom:$('#zoomLabel'),
      inspector:$('#inspector'),stats:$('#stats'),history:$('#historyList'),saveState:$('#saveState'),notice:$('#notice'),jsonDialog:$('#jsonDialog'),
      jsonText:$('#jsonText'),statusTool:$('#statusTool'),statusSeed:$('#statusSeed'),dirtyState:$('#studioDirtyState'),activeTool:$('#studioActiveTool'),
      autosave:$('#autosaveState'),autosaveBadge:$('#studioAutosaveBadge'),exportState:$('#exportState'),autoExport:$('#autoExportToggle'),health:$('#worldHealth'),
      validationState:$('#validationState'),statusExport:$('#statusExport'),mapSize:$('#statusMapSize'),canvasMeta:$('#studioCanvasMeta')
    };
    if(this.ui.autoExport)this.ui.autoExport.checked=this.autoExport;
  }

  buildPalette(){
    const palette=$('#biomePalette');palette.innerHTML='';
    W.BIOME_ORDER.forEach(id=>{
      const b=W.BIOMES[id],btn=document.createElement('button');
      btn.className='palette-btn'+(id===this.biome?' active':'');btn.dataset.biome=id;
      btn.innerHTML=`<i class="swatch" style="background:${b.ground[1]}"></i><span><b>${b.icon} ${b.name}</b><small>${b.climate}</small></span>`;
      btn.addEventListener('click',()=>{this.biome=id;this.setTool('biome');$$('.palette-btn').forEach(x=>x.classList.toggle('active',x===btn));});
      palette.appendChild(btn);
    });
    const objects=['tree','ancientTree','pine','cactus','sunrock','crystal','reed','ruin','boulder','obelisk'];
    this.ui.object.innerHTML=objects.map(x=>`<option value="${x}">${this.objectName(x)}</option>`).join('');
    this.ui.mob.innerHTML=Object.keys(W.MOB_DATA).map(x=>`<option value="${x}">${x}</option>`).join('');
    this.ui.seed.value=this.design.seed||'ASTRAEON-2';
  }

  objectName(x){return ({tree:'Árvore',ancientTree:'Árvore ancestral',pine:'Pinheiro',cactus:'Cacto',sunrock:'Rocha solar',crystal:'Cristal',reed:'Juncos',ruin:'Ruína',boulder:'Pedregulho',obelisk:'Obelisco'})[x]||x;}
  toolName(t){return ({biome:'Pincel de bioma',road:'Estrada',water:'Água',object:'Objeto',collision:'Colisão',spawn:'Spawn de criatura',erase:'Borracha',select:'Seleção',pan:'Mover câmera'})[t]||t;}
  escape(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

  bind(){
    window.addEventListener('resize',()=>this.resize());
    $$('.tool-btn').forEach(btn=>btn.addEventListener('click',()=>this.setTool(btn.dataset.tool)));
    this.ui.object.addEventListener('change',()=>{this.object=this.ui.object.value;this.setTool('object');});
    this.ui.mob.addEventListener('change',()=>{this.mob=this.ui.mob.value;this.setTool('spawn');});
    this.ui.brush.addEventListener('input',()=>{this.brush=Number(this.ui.brush.value)||1;});
    this.ui.seed.addEventListener('change',()=>this.regenerateSeed());

    $('#saveBtn')?.addEventListener('click',()=>void this.save({exportFile:true}));
    $('#playBtn')?.addEventListener('click',async()=>{await this.save({exportFile:true,quiet:true});location.href='index.html';});
    $('#newMapBtn')?.addEventListener('click',()=>this.newMap());
    $('#undoBtn')?.addEventListener('click',()=>this.undo());
    $('#redoBtn')?.addEventListener('click',()=>this.redo());
    $('#exportBtn')?.addEventListener('click',()=>this.openJson(false));
    $('#importBtn')?.addEventListener('click',()=>this.openJson(true));
    $('#jsonClose')?.addEventListener('click',()=>this.ui.jsonDialog.classList.add('hidden'));
    $('#jsonApply')?.addEventListener('click',()=>void this.applyJson());
    $('#validateMapBtn')?.addEventListener('click',()=>this.validateAndRender(true));
    $('#exportNowBtn')?.addEventListener('click',()=>void this.exportDesign({userInitiated:true,force:true}));
    $('#linkExportFileBtn')?.addEventListener('click',()=>void this.linkExportFile());
    this.ui.autoExport?.addEventListener('change',()=>{this.autoExport=!!this.ui.autoExport.checked;localStorage.setItem(AUTO_EXPORT_KEY,this.autoExport?'1':'0');this.syncExportUI();if(this.autoExport&&this.exportDirty&&this.exportFileHandle)this.scheduleAutoExport();});

    $('#jumpTileBtn')?.addEventListener('click',()=>this.jumpToInputs());
    $('#jumpTileX')?.addEventListener('keydown',e=>{if(e.key==='Enter')this.jumpToInputs();});
    $('#jumpTileY')?.addEventListener('keydown',e=>{if(e.key==='Enter')this.jumpToInputs();});
    $('#clearSpawnsBtn')?.addEventListener('click',()=>this.clearSpawns());
    $('#clearOverridesBtn')?.addEventListener('click',()=>this.clearOverrides());
    this.ui.inspector?.addEventListener('click',e=>{const btn=e.target.closest('[data-inspector-action]');if(btn)this.handleInspectorAction(btn.dataset.inspectorAction);});

    $('#zoomIn')?.addEventListener('click',()=>this.zoomAt(1.18,this.canvas.clientWidth/2,this.canvas.clientHeight/2));
    $('#zoomOut')?.addEventListener('click',()=>this.zoomAt(.84,this.canvas.clientWidth/2,this.canvas.clientHeight/2));
    $('#zoomFit')?.addEventListener('click',()=>this.fitWorld());
    $$('.layer-toggle').forEach(ch=>ch.addEventListener('change',()=>{this.layers[ch.dataset.layer]=ch.checked;this.draw();}));
    this.canvas.addEventListener('contextmenu',e=>e.preventDefault());
    this.canvas.addEventListener('pointerdown',e=>this.pointerDown(e));
    this.canvas.addEventListener('pointermove',e=>this.pointerMove(e));
    window.addEventListener('pointerup',()=>this.pointerUp());
    this.canvas.addEventListener('wheel',e=>this.wheel(e),{passive:false});
    window.addEventListener('keydown',e=>this.keydown(e));
    window.addEventListener('beforeunload',()=>this.flushAutosave());
  }

  setTool(tool){
    this.tool=tool;
    $$('.tool-btn').forEach(b=>b.classList.toggle('active',b.dataset.tool===tool));
    const label=this.toolName(tool);
    if(this.ui.statusTool)this.ui.statusTool.textContent=label;
    if(this.ui.activeTool)this.ui.activeTool.textContent=label;
    this.canvas.style.cursor=tool==='pan'?'grab':tool==='select'?'default':'crosshair';
  }

  resize(){
    const r=this.canvas.getBoundingClientRect();
    this.canvas.width=Math.max(1,Math.floor(r.width*this.dpr));this.canvas.height=Math.max(1,Math.floor(r.height*this.dpr));
    this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);this.width=r.width;this.height=r.height;this.draw();
  }

  fitWorld(){
    const worldPx=this.world.width*W.TILE,worldPy=this.world.height*W.TILE;
    const z=Math.min((this.width-60)/worldPx,(this.height-60)/worldPy);
    this.view.zoom=W.clamp(z,.12,1.8);this.view.x=(this.width-worldPx*this.view.zoom)/2;this.view.y=(this.height-worldPy*this.view.zoom)/2;
    this.refreshZoom();this.draw();
  }

  centerOnTile(x,y,zoom){
    x=W.clamp(Math.round(Number(x)||0),0,this.world.width-1);y=W.clamp(Math.round(Number(y)||0),0,this.world.height-1);
    if(Number.isFinite(zoom))this.view.zoom=W.clamp(zoom,.12,2.2);
    const px=(x+.5)*W.TILE*this.view.zoom,py=(y+.5)*W.TILE*this.view.zoom;
    this.view.x=this.width/2-px;this.view.y=this.height/2-py;this.selected={x,y};
    this.refreshInspector();this.refreshZoom();this.draw();
  }

  jumpToInputs(){this.centerOnTile($('#jumpTileX')?.value,$('#jumpTileY')?.value,Math.max(this.view.zoom,.55));}
  zoomAt(factor,sx,sy){const old=this.view.zoom,next=W.clamp(old*factor,.12,2.2),wx=(sx-this.view.x)/old,wy=(sy-this.view.y)/old;this.view.zoom=next;this.view.x=sx-wx*next;this.view.y=sy-wy*next;this.refreshZoom();this.draw();}
  wheel(e){e.preventDefault();this.zoomAt(e.deltaY<0?1.12:.89,e.offsetX,e.offsetY);}
  refreshZoom(){if(this.ui.zoom)this.ui.zoom.textContent=`${Math.round(this.view.zoom*100)}%`;}
  screenToTile(sx,sy){const wx=(sx-this.view.x)/this.view.zoom,wy=(sy-this.view.y)/this.view.zoom;return{x:Math.floor(wx/W.TILE),y:Math.floor(wy/W.TILE)};}

  pointerDown(e){
    this.canvas.setPointerCapture?.(e.pointerId);this.pointer.down=true;this.pointer.lastX=e.clientX;this.pointer.lastY=e.clientY;
    if(e.button===1||e.button===2||this.tool==='pan'||e.shiftKey){this.dragPan=true;this.canvas.style.cursor='grabbing';return;}
    this.strokeSnapshot=this.snapshot();this.applyAtPointer(e.offsetX,e.offsetY);
  }
  pointerMove(e){
    const r=this.canvas.getBoundingClientRect(),sx=e.clientX-r.left,sy=e.clientY-r.top,t=this.screenToTile(sx,sy);
    this.pointer.x=sx;this.pointer.y=sy;this.pointer.tx=t.x;this.pointer.ty=t.y;if(this.ui.coords)this.ui.coords.textContent=`tile ${t.x}, ${t.y}`;
    if(this.dragPan&&this.pointer.down){this.view.x+=e.clientX-this.pointer.lastX;this.view.y+=e.clientY-this.pointer.lastY;this.pointer.lastX=e.clientX;this.pointer.lastY=e.clientY;this.draw();return;}
    if(this.pointer.down&&['biome','road','water','object','collision','erase'].includes(this.tool))this.applyAtPointer(sx,sy,false);else this.draw();
  }
  pointerUp(){
    if(!this.pointer.down)return;
    this.pointer.down=false;this.dragPan=false;this.canvas.style.cursor=this.tool==='pan'?'grab':this.tool==='select'?'default':'crosshair';
    if(this.strokeSnapshot&&this.exportDirty){this.undoStack.push(this.strokeSnapshot);if(this.undoStack.length>60)this.undoStack.shift();this.redoStack=[];this.strokeSnapshot=null;}
  }

  applyAtPointer(sx,sy,rebuild=true){
    const t=this.screenToTile(sx,sy);if(t.x<0||t.y<0||t.x>=this.world.width||t.y>=this.world.height)return;
    if(this.tool==='select'){this.selected={x:t.x,y:t.y};this.refreshInspector();this.draw();return;}
    if(this.tool==='spawn'){this.applySpawn(t.x,t.y);this.commitEdit('Spawn adicionado');return;}
    const radius=Math.max(0,this.brush-1);
    for(let y=t.y-radius;y<=t.y+radius;y++)for(let x=t.x-radius;x<=t.x+radius;x++){
      if(x<0||y<0||x>=this.world.width||y>=this.world.height)continue;
      if(Math.hypot(x-t.x,y-t.y)>radius+.25&&radius>0)continue;
      this.applyTile(x,y);
    }
    if(rebuild)this.commitEdit(this.toolName(this.tool));else{this.rebuild();this.markDirty();}
  }

  overrideAt(x,y){const key=`${x},${y}`;return this.design.overrides[key]||(this.design.overrides[key]={});}
  applyTile(x,y){
    const key=`${x},${y}`,o=this.overrideAt(x,y);
    if(this.tool==='biome')o.biome=this.biome;
    else if(this.tool==='road'){o.kind='road';o.blocked=false;o.object='';}
    else if(this.tool==='water'){o.kind='water';o.blocked=true;o.object='';}
    else if(this.tool==='object'){o.object=this.object;o.blocked=!['reed','cactus'].includes(this.object);}
    else if(this.tool==='collision'){const tile=this.world.get(x,y);o.blocked=!(tile&&tile.blocked);}
    else if(this.tool==='erase'){delete this.design.overrides[key];this.design.spawns=this.design.spawns.filter(s=>s.x!==x||s.y!==y);}
  }
  applySpawn(x,y){this.design.spawns=this.design.spawns.filter(s=>s.x!==x||s.y!==y);this.design.spawns.push({x,y,type:this.mob});this.selected={x,y};}

  snapshot(){return JSON.stringify({overrides:this.design.overrides,spawns:this.design.spawns,seed:this.design.seed,notes:this.design.notes});}
  restoreSnapshot(raw){const s=JSON.parse(raw);this.design.overrides=s.overrides||{};this.design.spawns=s.spawns||[];this.design.seed=s.seed||this.design.seed;this.design.notes=s.notes||this.design.notes;this.ui.seed.value=this.design.seed;this.rebuild();this.markDirty();this.refreshAll();}
  commitEdit(label){this.rebuild();this.markDirty();this.addHistory(label);this.refreshAll();}

  markDirty(){
    this.dirty=true;this.exportDirty=true;
    this.setSaveState('Alterações pendentes','#f0c76c');
    if(this.ui.dirtyState)this.ui.dirtyState.textContent='Editando · autosave pendente';
    this.scheduleAutosave();this.scheduleAutoExport();
  }

  setSaveState(text,color){if(this.ui.saveState){this.ui.saveState.textContent=text;if(color)this.ui.saveState.style.color=color;}}
  scheduleAutosave(){clearTimeout(this.autosaveTimer);if(this.ui.autosave)this.ui.autosave.textContent='Salvando em instantes…';this.autosaveTimer=setTimeout(()=>this.flushAutosave(),AUTOSAVE_DELAY);}
  flushAutosave(){
    clearTimeout(this.autosaveTimer);this.autosaveTimer=null;
    if(!this.design||!this.world)return;
    this.normalizeDesign();W.saveWorldDesign(this.design);this.dirty=false;
    if(this.ui.autosave)this.ui.autosave.textContent=`Salvo localmente às ${new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}`;
    if(this.ui.autosaveBadge)this.ui.autosaveBadge.textContent='Autosave local OK';
    if(this.ui.dirtyState)this.ui.dirtyState.textContent=this.exportDirty?'Autosave OK · exportação pendente':'Sincronizado';
    this.setSaveState(this.exportDirty?'Local salvo · export pendente':'Sincronizado',this.exportDirty?'#e7bd6e':'#70ce90');
  }

  scheduleAutoExport(){
    clearTimeout(this.autoExportTimer);this.autoExportTimer=null;
    if(!this.autoExport||!this.exportFileHandle)return;
    this.autoExportTimer=setTimeout(()=>void this.writeLinkedFile(true),AUTOEXPORT_DELAY);
  }

  normalizeDesign(){this.design.version=W.VERSION;this.design.width=this.world.width;this.design.height=this.world.height;this.design.overrides=this.design.overrides||{};this.design.spawns=Array.isArray(this.design.spawns)?this.design.spawns:[];return this.design;}
  fileName(){const seed=String(this.design.seed||'ASTRAEON').trim().replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,48)||'ASTRAEON';return `astraeon-world-${seed}.json`;}
  serialized(){return JSON.stringify(this.normalizeDesign(),null,2);}

  async linkExportFile(){
    if(typeof window.showSaveFilePicker!=='function'){
      this.exportFileHandle=null;this.syncExportUI();this.notify('Seu navegador usará download automático ao salvar.');return;
    }
    try{
      const handle=await window.showSaveFilePicker({suggestedName:this.fileName(),types:[{description:'Mapa Astraeon JSON',accept:{'application/json':['.json']}}]});
      this.exportFileHandle=handle;this.autoExport=true;if(this.ui.autoExport)this.ui.autoExport.checked=true;localStorage.setItem(AUTO_EXPORT_KEY,'1');
      await this.writeLinkedFile(false);this.notify('Arquivo vinculado. Alterações serão exportadas automaticamente nesta sessão.');
    }catch(error){if(error?.name!=='AbortError')this.notify('Não foi possível vincular o arquivo.');}
    this.syncExportUI();
  }

  async writeLinkedFile(background=false){
    clearTimeout(this.autoExportTimer);this.autoExportTimer=null;
    if(!this.exportFileHandle)return false;
    try{
      const permission=await this.exportFileHandle.queryPermission?.({mode:'readwrite'});
      if(permission==='denied'&&background)return false;
      if(permission!=='granted'&&!background){const requested=await this.exportFileHandle.requestPermission?.({mode:'readwrite'});if(requested!=='granted')return false;}
      const writable=await this.exportFileHandle.createWritable();await writable.write(this.serialized());await writable.close();
      this.exportDirty=false;this.syncExportUI();if(this.ui.dirtyState)this.ui.dirtyState.textContent='Sincronizado · arquivo atualizado';this.setSaveState('Mapa sincronizado','#70ce90');
      return true;
    }catch(error){console.warn('[Astraeon Editor] autoexport',error);if(!background)this.notify('Falha ao gravar o arquivo vinculado.');return false;}
  }

  downloadExport(){
    const blob=new Blob([this.serialized()],{type:'application/json;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=this.fileName();document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
    this.exportDirty=false;this.syncExportUI();
  }

  async exportDesign({userInitiated=false,force=false}={}){
    this.flushAutosave();
    if(this.exportFileHandle){const ok=await this.writeLinkedFile(false);if(ok){if(userInitiated)this.notify('Mapa exportado para o arquivo vinculado.');return true;}}
    if(userInitiated||force){this.downloadExport();this.notify('Mapa JSON exportado automaticamente.');return true;}
    return false;
  }

  syncExportUI(){
    if(this.ui.autoExport)this.ui.autoExport.checked=this.autoExport;
    if(this.ui.exportState)this.ui.exportState.textContent=this.exportFileHandle?(this.autoExport?'Arquivo vinculado · autoexport ativo':'Arquivo vinculado · autoexport pausado'):'Download automático ao salvar';
    if(this.ui.statusExport)this.ui.statusExport.textContent=this.autoExport?(this.exportFileHandle?'arquivo vinculado':'download no salvar'):'manual';
  }

  async save({exportFile=true,quiet=false}={}){
    this.normalizeDesign();this.flushAutosave();
    const result=this.validateAndRender(false);this.addHistory('Mundo salvo');
    let exported=false;if(exportFile)exported=await this.exportDesign({userInitiated:true});
    if(!exportFile)this.exportDirty=false;
    this.setSaveState(exported?'Salvo + exportado':'Mapa salvo','#70ce90');
    if(!quiet)this.notify(result.errors.length?`Mapa salvo com ${result.errors.length} erro(s) de validação.`:'Mapa salvo e exportado.');
    return result;
  }

  validateDesign(){
    const errors=[],warnings=[],width=this.world.width,height=this.world.height,knownObjects=new Set(['','tree','ancientTree','pine','cactus','sunrock','crystal','reed','ruin','boulder','obelisk']);
    const seed=String(this.design.seed||'').trim();if(!seed)errors.push('A seed global está vazia.');
    for(const [key,ov] of Object.entries(this.design.overrides||{})){
      const m=/^(\d+),(\d+)$/.exec(key);if(!m){errors.push(`Override com coordenada inválida: ${key}`);continue;}
      const x=Number(m[1]),y=Number(m[2]);if(x<0||y<0||x>=width||y>=height)errors.push(`Override fora do mapa: ${key}`);
      if(ov.biome&&!W.BIOMES[ov.biome])errors.push(`Bioma desconhecido em ${key}: ${ov.biome}`);
      if(typeof ov.object==='string'&&!knownObjects.has(ov.object))warnings.push(`Objeto não catalogado em ${key}: ${ov.object}`);
    }
    const occupied=new Set();
    for(const spawn of this.design.spawns||[]){
      const x=Number(spawn.x),y=Number(spawn.y),key=`${x},${y}`;
      if(!Number.isInteger(x)||!Number.isInteger(y)||x<0||y<0||x>=width||y>=height){errors.push(`Spawn fora do mapa: ${key}`);continue;}
      if(!W.MOB_DATA[spawn.type])errors.push(`Mob desconhecido no spawn ${key}: ${spawn.type}`);
      if(occupied.has(key))warnings.push(`Mais de um spawn configurado no tile ${key}.`);occupied.add(key);
      if(this.world.get(x,y)?.blocked)warnings.push(`Spawn ${spawn.type} está em tile bloqueado (${key}).`);
    }
    return{errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
  }

  validateAndRender(notify=true){
    const result=this.validateDesign(),total=result.errors.length+result.warnings.length;
    if(this.ui.validationState){this.ui.validationState.textContent=result.errors.length?`${result.errors.length} erro(s)`:result.warnings.length?`${result.warnings.length} aviso(s)`:'Mapa saudável';this.ui.validationState.dataset.state=result.errors.length?'error':result.warnings.length?'warn':'ok';}
    if(this.ui.health){
      if(!total)this.ui.health.innerHTML='<div class="studio-health-ok"><b>✓ Mapa válido</b><span>Seed, overrides e spawns passaram na verificação.</span></div>';
      else this.ui.health.innerHTML=`${result.errors.map(x=>`<div class="studio-health-item error"><b>Erro</b><span>${this.escape(x)}</span></div>`).join('')}${result.warnings.map(x=>`<div class="studio-health-item warn"><b>Aviso</b><span>${this.escape(x)}</span></div>`).join('')}`;
    }
    if(notify)this.notify(!total?'Mapa validado sem problemas.':`${result.errors.length} erro(s) · ${result.warnings.length} aviso(s).`);
    return result;
  }

  rebuild(){this.world=W.generateWorld({seed:this.design.seed,custom:this.design});this.draw();}
  undo(){if(!this.undoStack.length){this.notify('Nada para desfazer.');return;}const cur=this.snapshot(),prev=this.undoStack.pop();this.redoStack.push(cur);this.restoreSnapshot(prev);this.addHistory('Desfazer');}
  redo(){if(!this.redoStack.length){this.notify('Nada para refazer.');return;}const cur=this.snapshot(),next=this.redoStack.pop();this.undoStack.push(cur);this.restoreSnapshot(next);this.addHistory('Refazer');}

  regenerateSeed(){const next=(this.ui.seed.value||'ASTRAEON-2').trim();if(next===this.design.seed)return;this.undoStack.push(this.snapshot());this.design.seed=next;this.redoStack=[];this.commitEdit('Semente alterada');this.notify('Mundo procedural regenerado.');}
  newMap(){
    if((this.exportDirty||this.dirty)&&!confirm('Criar um novo mundo? As alterações atuais já estão no autosave local, mas podem não ter sido exportadas.'))return;
    this.undoStack.push(this.snapshot());this.design=W.makeDefaultDesign(`ASTRAEON-${Math.random().toString(36).slice(2,7).toUpperCase()}`);this.design.overrides={};this.design.spawns=[];this.ui.seed.value=this.design.seed;this.redoStack=[];this.rebuild();this.markDirty();this.fitWorld();this.addHistory('Novo mapa');this.refreshAll();
  }

  clearSpawns(){if(!this.design.spawns.length){this.notify('Não existem spawns manuais.');return;}if(!confirm(`Remover ${this.design.spawns.length} spawn(s) manuais?`))return;this.undoStack.push(this.snapshot());this.design.spawns=[];this.selected=null;this.redoStack=[];this.commitEdit('Spawns removidos');}
  clearOverrides(){const count=Object.keys(this.design.overrides).length;if(!count){this.notify('Não existem overrides manuais.');return;}if(!confirm(`Remover ${count} override(s) e voltar ao terreno procedural?`))return;this.undoStack.push(this.snapshot());this.design.overrides={};this.selected=null;this.redoStack=[];this.commitEdit('Overrides removidos');}

  handleInspectorAction(action){
    if(!this.selected)return;const{x,y}=this.selected,key=`${x},${y}`;
    this.undoStack.push(this.snapshot());
    if(action==='toggle-collision'){const tile=this.world.get(x,y);this.overrideAt(x,y).blocked=!tile?.blocked;}
    if(action==='clear-override')delete this.design.overrides[key];
    if(action==='remove-spawn')this.design.spawns=this.design.spawns.filter(s=>s.x!==x||s.y!==y);
    if(action==='add-spawn'){this.design.spawns=this.design.spawns.filter(s=>s.x!==x||s.y!==y);this.design.spawns.push({x,y,type:this.mob});}
    this.redoStack=[];this.commitEdit('Tile atualizado pelo Inspetor');
  }

  openJson(importMode){
    this.importMode=importMode;this.ui.jsonDialog.classList.remove('hidden');this.ui.jsonText.value=importMode?'':this.serialized();
    $('#jsonTitle').textContent=importMode?'Importar mapa JSON':'Mapa JSON atual';
    $('#jsonHelp').textContent=importMode?'Cole um mapa Astraeon e aplique. Uma cópia do estado atual fica disponível no histórico de desfazer.':'Revise ou copie o JSON. O botão Salvar + exportar gera o arquivo automaticamente.';
    $('#jsonApply').textContent=importMode?'Aplicar importação':'Copiar JSON';
  }
  async applyJson(){
    if(!this.importMode){try{await navigator.clipboard.writeText(this.ui.jsonText.value);this.notify('JSON copiado.');}catch(_){this.ui.jsonText.select();document.execCommand?.('copy');this.notify('JSON selecionado para cópia.');}return;}
    try{
      const parsed=JSON.parse(this.ui.jsonText.value);if(!parsed||typeof parsed!=='object'||!parsed.seed)throw new Error();
      this.undoStack.push(this.snapshot());this.design=Object.assign(W.makeDefaultDesign(parsed.seed),parsed);this.design.overrides=this.design.overrides||{};this.design.spawns=Array.isArray(this.design.spawns)?this.design.spawns:[];
      this.ui.seed.value=this.design.seed;this.rebuild();this.markDirty();this.fitWorld();this.refreshAll();this.ui.jsonDialog.classList.add('hidden');this.addHistory('Mapa importado');this.notify('Mapa importado com sucesso.');
    }catch(_){this.notify('JSON inválido ou incompatível.');}
  }

  keydown(e){
    const tag=document.activeElement?.tagName;if(tag==='INPUT'||tag==='SELECT'||tag==='TEXTAREA')return;
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='s'){e.preventDefault();void this.save({exportFile:true});return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();e.shiftKey?this.redo():this.undo();return;}
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='y'){e.preventDefault();this.redo();return;}
    if(e.key==='Delete'&&this.selected){this.undoStack.push(this.snapshot());delete this.design.overrides[`${this.selected.x},${this.selected.y}`];this.design.spawns=this.design.spawns.filter(s=>s.x!==this.selected.x||s.y!==this.selected.y);this.commitEdit('Tile limpo');return;}
    const map={b:'biome',r:'road',w:'water',o:'object',c:'collision',s:'spawn',e:'erase',v:'select',p:'pan'};if(map[e.key.toLowerCase()])this.setTool(map[e.key.toLowerCase()]);
  }

  refreshAll(){
    this.refreshStats();this.refreshInspector();this.refreshHistory();this.refreshZoom();this.validateAndRender(false);
    if(this.ui.statusSeed)this.ui.statusSeed.textContent=this.design.seed;
    if(this.ui.mapSize)this.ui.mapSize.textContent=`${this.world.width} × ${this.world.height}`;
    if(this.ui.canvasMeta)this.ui.canvasMeta.textContent=`${this.world.width} × ${this.world.height} tiles · ${W.TILE}px`;
    this.draw();
  }

  refreshStats(){
    const overrides=Object.keys(this.design.overrides).length,spawns=this.design.spawns.length,blocked=this.world.tiles.filter(t=>t.blocked).length;
    const biomeCounts={};for(const tile of this.world.tiles)biomeCounts[tile.biome]=(biomeCounts[tile.biome]||0)+1;
    const dominant=Object.entries(biomeCounts).sort((a,b)=>b[1]-a[1])[0];
    const dominantName=dominant?W.BIOMES[dominant[0]]?.name:'—',dominantPct=dominant?Math.round(dominant[1]/this.world.tiles.length*100):0;
    this.ui.stats.innerHTML=`<div class="stat"><b>${overrides}</b><small>overrides</small></div><div class="stat"><b>${spawns}</b><small>spawns</small></div><div class="stat"><b>${blocked}</b><small>bloqueios</small></div><div class="stat"><b>${dominantPct}%</b><small>${this.escape(dominantName)}</small></div>`;
  }

  refreshInspector(){
    if(!this.selected){this.ui.inspector.innerHTML='<h3>Inspetor</h3><p class="hint">Use Seleção e clique em um tile. Aqui você poderá alternar colisão, adicionar/remover spawn e limpar o override local.</p>';return;}
    const t=this.world.get(this.selected.x,this.selected.y),b=t?W.BIOMES[t.biome]:null,spawn=this.design.spawns.find(s=>s.x===this.selected.x&&s.y===this.selected.y),override=this.design.overrides[`${this.selected.x},${this.selected.y}`];
    if(!t||!b)return;
    this.ui.inspector.innerHTML=`<div class="studio-inspector-title"><span>${b.icon}</span><div><h3>${this.escape(b.name)}</h3><small>tile ${t.x}, ${t.y}${override?' · override manual':''}</small></div></div><div class="kv"><span>Clima</span><b>${this.escape(b.climate)}</b></div><div class="kv"><span>Terreno</span><b>${this.escape(t.kind)}</b></div><div class="kv"><span>Objeto</span><b>${t.object?this.escape(this.objectName(t.object)):'—'}</b></div><div class="kv"><span>Colisão</span><b>${t.blocked?'Bloqueado':'Livre'}</b></div><div class="kv"><span>Spawn</span><b>${spawn?this.escape(spawn.type):'—'}</b></div><div class="studio-inspector-actions"><button data-inspector-action="toggle-collision">${t.blocked?'Liberar tile':'Bloquear tile'}</button><button data-inspector-action="${spawn?'remove-spawn':'add-spawn'}">${spawn?'Remover spawn':`Adicionar ${this.escape(this.mob)}`}</button>${override?'<button data-inspector-action="clear-override" class="danger">Limpar override</button>':''}</div><p class="hint">${this.escape(b.feature)}</p>`;
  }

  addHistory(label){this.history.unshift({label,time:new Date().toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})});this.history=this.history.slice(0,14);this.refreshHistory();}
  refreshHistory(){this.ui.history.innerHTML=this.history.length?this.history.map(h=>`<div class="history-item"><b>${h.time}</b><span>${this.escape(h.label)}</span></div>`).join(''):'<p class="hint">As ações desta sessão aparecerão aqui.</p>';}
  notify(text){this.ui.notice.textContent=text;this.ui.notice.classList.add('show');clearTimeout(this.noticeTimer);this.noticeTimer=setTimeout(()=>this.ui.notice.classList.remove('show'),2400);}

  draw(){
    if(!this.ctx||!this.world)return;const ctx=this.ctx,w=this.width||1,h=this.height||1;ctx.clearRect(0,0,w,h);ctx.fillStyle='#02050b';ctx.fillRect(0,0,w,h);
    const ts=W.TILE*this.view.zoom;if(ts<2)return;
    const sx=Math.max(0,Math.floor((-this.view.x)/(W.TILE*this.view.zoom))-1),sy=Math.max(0,Math.floor((-this.view.y)/(W.TILE*this.view.zoom))-1),ex=Math.min(this.world.width,Math.ceil((w-this.view.x)/(W.TILE*this.view.zoom))+1),ey=Math.min(this.world.height,Math.ceil((h-this.view.y)/(W.TILE*this.view.zoom))+1);
    for(let y=sy;y<ey;y++)for(let x=sx;x<ex;x++){
      const t=this.world.get(x,y),b=W.BIOMES[t.biome],px=this.view.x+x*ts,py=this.view.y+y*ts;
      let color=b.ground[t.variant];if(t.kind==='road')color=t.biome==='frost'?'#a6afb1':'#6d5b49';else if(t.kind==='water')color=b.water;else if(t.kind==='ice')color='#91becd';else if(t.kind==='rock')color='#555157';else if(t.kind==='sand')color='#a87a42';
      ctx.fillStyle=this.layers.terrain?color:'#091119';ctx.fillRect(px,py,Math.ceil(ts)+1,Math.ceil(ts)+1);
      if(this.layers.objects&&t.object&&ts>7)this.drawObject(ctx,t,px,py,ts);
      if(this.layers.collision&&t.blocked){ctx.fillStyle='rgba(255,80,98,.14)';ctx.fillRect(px,py,ts,ts);if(ts>13){ctx.strokeStyle='rgba(255,105,120,.35)';ctx.beginPath();ctx.moveTo(px+3,py+3);ctx.lineTo(px+ts-3,py+ts-3);ctx.moveTo(px+ts-3,py+3);ctx.lineTo(px+3,py+ts-3);ctx.stroke();}}
      if(this.layers.grid&&ts>8){ctx.strokeStyle='rgba(255,255,255,.055)';ctx.lineWidth=1;ctx.strokeRect(px+.5,py+.5,ts,ts);}
    }
    if(this.layers.spawns)this.drawSpawns(ctx,ts);
    if(this.selected){ctx.strokeStyle='#f0d078';ctx.lineWidth=2;ctx.strokeRect(this.view.x+this.selected.x*ts+1,this.view.y+this.selected.y*ts+1,ts-2,ts-2);}
    if(this.pointer.tx>=0&&this.pointer.ty>=0&&this.pointer.tx<this.world.width&&this.pointer.ty<this.world.height&&!this.dragPan){const r=Math.max(0,this.brush-1);ctx.strokeStyle='rgba(116,216,255,.8)';ctx.lineWidth=1.5;ctx.strokeRect(this.view.x+(this.pointer.tx-r)*ts,this.view.y+(this.pointer.ty-r)*ts,ts*(r*2+1),ts*(r*2+1));}
    ctx.strokeStyle='rgba(239,202,114,.25)';ctx.lineWidth=2;ctx.strokeRect(this.view.x,this.view.y,this.world.width*ts,this.world.height*ts);
  }

  drawObject(ctx,t,px,py,ts){
    const cx=px+ts/2,by=py+ts*.86,s=Math.max(2,ts*.22);ctx.save();
    if(['tree','ancientTree','pine'].includes(t.object)){ctx.fillStyle='#1f3628';ctx.fillRect(cx-s*.16,by-s*.7,s*.32,s*.75);ctx.fillStyle=t.object==='pine'?'#5f8c82':t.object==='ancientTree'?'#4f815a':'#5e9665';ctx.beginPath();ctx.arc(cx,by-s,s*(t.object==='ancientTree'?.78:.62),0,Math.PI*2);ctx.fill();}
    else if(t.object==='crystal'){ctx.fillStyle='#b4eff8';ctx.beginPath();ctx.moveTo(cx,by-s*1.6);ctx.lineTo(cx+s*.5,by);ctx.lineTo(cx-s*.45,by);ctx.closePath();ctx.fill();}
    else{ctx.fillStyle=t.object==='cactus'?'#547c55':'#74675c';ctx.beginPath();ctx.arc(cx,by-s*.45,s*.52,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  drawSpawns(ctx,ts){
    for(const s of this.design.spawns){const x=this.view.x+(s.x+.5)*ts,y=this.view.y+(s.y+.5)*ts;if(x<-20||y<-20||x>this.width+20||y>this.height+20)continue;ctx.save();ctx.fillStyle='rgba(255,209,103,.9)';ctx.strokeStyle='rgba(20,10,0,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,Math.max(4,ts*.19),0,Math.PI*2);ctx.fill();ctx.stroke();if(ts>18){ctx.fillStyle='#160e05';ctx.font=`700 ${Math.max(7,ts*.15)}px Inter`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('S',x,y+.5);}ctx.restore();}
  }
}

window.addEventListener('DOMContentLoaded',()=>{window.astraeonEditor=new AstraeonEditor();});
})();

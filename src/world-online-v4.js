(function (global) {
  'use strict';

  const W = global.AstraeonWorld;
  if (!W) return;
  const TILE = W.TILE;

  const CITIES = [
    { id:'astralum', name:'Astralum', subtitle:'Coração da Convergência', x:48, y:48, radius:9, accent:'#e6b85f', biome:'forest' },
    { id:'lumenfall', name:'Lúmenfall', subtitle:'Cidade das Copas Antigas', x:18, y:27, radius:9, accent:'#79c98c', biome:'forest' },
    { id:'solvaris', name:'Solvaris', subtitle:'Mercado do Sol Ardente', x:76, y:33, radius:9, accent:'#e4a657', biome:'steppe' },
    { id:'nivora', name:'Nivora', subtitle:'Fortaleza do Véu', x:50, y:11, radius:9, accent:'#9dd9e8', biome:'frost' },
    { id:'umbravale', name:'Umbra Vale', subtitle:'Refúgio das Águas Escuras', x:21, y:75, radius:9, accent:'#7fa57a', biome:'swamp' },
    { id:'cinzalta', name:'Cinzalta', subtitle:'Bastião dos Altos de Cinza', x:74, y:75, radius:9, accent:'#d08d67', biome:'highland' }
  ];

  const BUILDING_OFFSETS = [
    [-6,-6,'house',5,5,'east',0],
    [2,-6,'house',5,5,'west',1],
    [-6,2,'house',5,5,'north',2],
    [2,2,'market',5,5,'north',3]
  ];
  const HOUSE_STYLES = [
    { wall:'#5b4631', wallLight:'#a5875f', mortar:'#d0b17d', floor:'#80684a', floorAlt:'#725a40', rug:'#783b35', furniture:'#4b3020' },
    { wall:'#4c5557', wallLight:'#89979a', mortar:'#cad4d2', floor:'#687478', floorAlt:'#5b676a', rug:'#355a73', furniture:'#3b2c23' },
    { wall:'#644535', wallLight:'#a8785f', mortar:'#d0a27f', floor:'#896a50', floorAlt:'#775a44', rug:'#3d654d', furniture:'#503324' },
    { wall:'#45413c', wallLight:'#7f786c', mortar:'#b8aa91', floor:'#6b6154', floorAlt:'#5b5348', rug:'#765a32', furniture:'#3e2d20' }
  ];

  function tile(world, x, y) { return world?.get?.(x, y); }
  function cityAtTile(tx, ty) {
    return CITIES.find(c => Math.hypot(tx - c.x, ty - c.y) <= c.radius + .45) || null;
  }
  function cityAtPixel(x, y) { return cityAtTile(x / TILE, y / TILE); }
  function nearbyCity(game) {
    if (!game?.player) return null;
    let best = null;
    let bestDistance = Infinity;
    for (const city of CITIES) {
      const distance = Math.hypot(game.player.x-city.x*TILE,game.player.y-city.y*TILE);
      const visibleRadius = (Math.max(2,Number(city.radius)||5)+5)*TILE;
      if (distance <= visibleRadius && distance < bestDistance) {
        best = city;
        bestDistance = distance;
      }
    }
    return best;
  }

  function ensureCityHud() {
    let hud = document.querySelector('#cityLocationHud');
    if (hud) return hud;
    const minimap = document.querySelector('.minimap-shell');
    if (!minimap) return null;
    hud = document.createElement('section');
    hud.id = 'cityLocationHud';
    hud.className = 'city-location-hud hidden';
    hud.setAttribute('aria-live','polite');
    hud.innerHTML = '<strong id="cityLocationName"></strong><span id="cityLocationSubtitle"></span>';
    minimap.insertAdjacentElement('beforebegin',hud);
    return hud;
  }

  function updateCityHud(game) {
    const hud = ensureCityHud();
    if (!hud) return;
    const city = nearbyCity(game);
    if (!city) {
      hud.classList.add('hidden');
      hud.removeAttribute('data-city');
      return;
    }
    const name = hud.querySelector('#cityLocationName');
    const subtitle = hud.querySelector('#cityLocationSubtitle');
    if (name) name.textContent = city.name;
    if (subtitle) subtitle.textContent = city.subtitle || 'Cidade de Astraeon';
    hud.dataset.city = city.id;
    hud.style.setProperty('--city-accent',city.accent||'#e6b85f');
    hud.classList.remove('hidden');
  }

  function openTile(t, city) {
    if (!t) return;
    t.biome = city.biome || t.biome;
    t.kind = 'road';
    t.blocked = false;
    t.object = null;
    t.cityId = city.id;
  }

  function isDoorTile(structure, xx, yy) {
    const centerX=Math.floor(structure.w/2),centerY=Math.floor(structure.h/2);
    if(structure.door==='north')return yy===0&&xx===centerX;
    if(structure.door==='south')return yy===structure.h-1&&xx===centerX;
    if(structure.door==='west')return xx===0&&yy===centerY;
    return xx===structure.w-1&&yy===centerY;
  }

  function openDoorApproach(world, structure, city) {
    const centerX=Math.floor(structure.w/2),centerY=Math.floor(structure.h/2);
    let x=structure.x+centerX,y=structure.y+centerY;
    if(structure.door==='north')y=structure.y-1;
    else if(structure.door==='south')y=structure.y+structure.h;
    else if(structure.door==='west')x=structure.x-1;
    else x=structure.x+structure.w;
    openTile(tile(world,x,y),city);
  }

  function blockFootprint(world, structure, city) {
    const building=structure.type==='house'||structure.type==='market';
    for (let yy = 0; yy < structure.h; yy++) for (let xx = 0; xx < structure.w; xx++) {
      const t = tile(world, structure.x + xx, structure.y + yy);
      if (!t) continue;
      t.cityId = city.id;
      t.biome = city.biome || t.biome;
      if(building){
        const perimeter=xx===0||yy===0||xx===structure.w-1||yy===structure.h-1;
        t.kind='road';
        t.blocked=perimeter&&!isDoorTile(structure,xx,yy);
      }else if (structure.type !== 'fountain' && structure.type !== 'lamp') t.blocked = true;
      t.object = null;
    }
    if(building)openDoorApproach(world,structure,city);
  }

  function structuresFor(city) {
    const out = [];
    const cityVariant=Math.max(0,CITIES.findIndex(entry=>entry.id===city.id));
    const add = (dx,dy,type,w=2,h=2,door='south',variant=0) => out.push({cityId:city.id,x:city.x+dx,y:city.y+dy,type,w,h,door,variant:(variant+cityVariant)%HOUSE_STYLES.length,accent:city.accent});
    BUILDING_OFFSETS.forEach(args => add(...args));
    add(-1,-1,'fountain',2,2);
    add(-city.radius,0,'gate',1,2);
    add(city.radius-1,0,'gate',1,2);
    add(0,-city.radius,'gate',2,1);
    add(0,city.radius-1,'gate',2,1);
    add(-3,0,'lamp',1,1); add(3,0,'lamp',1,1); add(0,-3,'lamp',1,1); add(0,3,'lamp',1,1);
    return out;
  }

  function decorate(world) {
    if (!world || world.onlineCitiesDecorated) return world;
    world.onlineCitiesDecorated = true;
    world.cities = CITIES.map(c => ({...c}));
    world.cityStructures = [];

    for (const city of CITIES) {
      const r = city.radius;
      for (let y = city.y - r; y <= city.y + r; y++) for (let x = city.x - r; x <= city.x + r; x++) {
        const t = tile(world,x,y);
        if (!t) continue;
        const dx = x-city.x, dy = y-city.y, d = Math.hypot(dx,dy);
        if (d > r + .35) continue;
        t.cityId = city.id;
        t.biome = city.biome || t.biome;
        const plaza = Math.abs(dx) <= 2 && Math.abs(dy) <= 2;
        const cross = Math.abs(dx) <= 1 || Math.abs(dy) <= 1;
        const ring = Math.abs(d - (r - 1)) < .8;
        if (plaza || cross || ring) openTile(t, city);
        else if (t.kind === 'water' || t.kind === 'rock') { t.kind='ground'; t.blocked=false; t.object=null; }
      }
      const structures = structuresFor(city);
      structures.forEach(s => { world.cityStructures.push(s); blockFootprint(world,s,city); });
    }
    return world;
  }

  function drawWallBlock(ctx,x,y,w,h,style) {
    if(w<=0||h<=0)return;
    ctx.fillStyle='rgba(0,0,0,.25)';ctx.fillRect(x+3,y+4,w,h);
    const wall=ctx.createLinearGradient(x,y,x,y+h);wall.addColorStop(0,style.wallLight);wall.addColorStop(.28,style.wall);wall.addColorStop(1,'#31271f');
    ctx.fillStyle=wall;ctx.fillRect(x,y,w,h);
    ctx.fillStyle=style.wallLight;ctx.globalAlpha=.42;ctx.fillRect(x,y,w,3);ctx.globalAlpha=1;
    ctx.strokeStyle=style.mortar;ctx.globalAlpha=.32;ctx.lineWidth=1;ctx.strokeRect(x+.5,y+.5,w-1,h-1);ctx.globalAlpha=1;
  }

  function drawHouseFloor(ctx,s,style,x,y,w,h) {
    ctx.fillStyle=style.floor;ctx.fillRect(x+4,y+4,w-8,h-8);
    const unit=TILE/2;
    ctx.globalAlpha=.18;
    for(let yy=y+5,row=0;yy<y+h-5;yy+=unit,row++)for(let xx=x+5,col=0;xx<x+w-5;xx+=unit,col++){
      ctx.fillStyle=(row+col)%2?style.floorAlt:style.floor;
      ctx.fillRect(xx,yy,Math.min(unit-1,x+w-5-xx),Math.min(unit-1,y+h-5-yy));
    }
    ctx.globalAlpha=1;
    const rugW=Math.max(TILE,w-TILE*2.25),rugH=Math.max(TILE*.7,h-TILE*2.45);
    ctx.fillStyle=style.rug;ctx.globalAlpha=.56;ctx.fillRect(x+(w-rugW)/2,y+(h-rugH)/2,rugW,rugH);
    ctx.strokeStyle=s.accent;ctx.globalAlpha=.32;ctx.strokeRect(x+(w-rugW)/2+.5,y+(h-rugH)/2+.5,rugW-1,rugH-1);ctx.globalAlpha=1;
  }

  function drawHouseFurniture(ctx,s,style,x,y,w,h) {
    const variant=Number(s.variant)||0,ix=x+TILE,iy=y+TILE,iw=w-TILE*2,ih=h-TILE*2;
    ctx.save();ctx.lineWidth=1;
    if(s.type==='market'){
      ctx.fillStyle=style.furniture;ctx.fillRect(ix+8,iy+10,iw-16,13);ctx.fillRect(ix+8,iy+ih-24,iw-16,13);
      ctx.fillStyle='#b48648';for(let i=0;i<3;i++){ctx.fillRect(ix+13+i*31,iy+13,9,7);ctx.fillRect(ix+18+i*27,iy+ih-21,8,7);}
    }else if(variant%3===0){
      ctx.fillStyle=style.furniture;ctx.fillRect(ix+8,iy+9,30,56);ctx.fillStyle='#bca986';ctx.fillRect(ix+11,iy+12,24,13);
      ctx.fillStyle='#513b2a';ctx.fillRect(ix+iw-43,iy+ih-38,31,25);ctx.fillStyle='#8b704d';ctx.fillRect(ix+iw-38,iy+ih-33,21,15);
    }else if(variant%3===1){
      ctx.fillStyle=style.furniture;ctx.fillRect(ix+iw/2-22,iy+ih/2-15,44,30);ctx.fillStyle='#a17c4c';ctx.beginPath();ctx.arc(ix+iw/2,iy+ih/2,9,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#47372b';ctx.fillRect(ix+7,iy+8,12,ih-16);ctx.fillRect(ix+iw-19,iy+8,12,ih-16);
    }else{
      ctx.fillStyle=style.furniture;ctx.fillRect(ix+8,iy+10,28,50);ctx.fillRect(ix+iw-36,iy+ih-60,28,50);
      ctx.fillStyle='#c4ad86';ctx.fillRect(ix+11,iy+13,22,11);ctx.fillRect(ix+iw-33,iy+ih-57,22,11);
      ctx.fillStyle='#59402c';ctx.fillRect(ix+iw/2-18,iy+ih/2-12,36,24);
    }
    ctx.restore();
  }

  function drawHouseWalls(ctx,s,style,x,y,w,h) {
    const inset=4,thickness=11,left=x+inset,top=y+inset,right=x+w-inset,bottom=y+h-inset;
    const doorSpan=TILE*.72,centerX=x+(Math.floor(s.w/2)+.5)*TILE,centerY=y+(Math.floor(s.h/2)+.5)*TILE;
    const horizontal=(wallY,side)=>{
      if(s.door!==side)return drawWallBlock(ctx,left,wallY,right-left,thickness,style);
      drawWallBlock(ctx,left,wallY,centerX-doorSpan/2-left,thickness,style);
      drawWallBlock(ctx,centerX+doorSpan/2,wallY,right-centerX-doorSpan/2,thickness,style);
    };
    const vertical=(wallX,side)=>{
      if(s.door!==side)return drawWallBlock(ctx,wallX,top+thickness,thickness,bottom-top-thickness*2,style);
      drawWallBlock(ctx,wallX,top+thickness,thickness,centerY-doorSpan/2-top-thickness,style);
      drawWallBlock(ctx,wallX,centerY+doorSpan/2,thickness,bottom-thickness-centerY-doorSpan/2,style);
    };
    horizontal(top,'north');horizontal(bottom-thickness,'south');vertical(left,'west');vertical(right-thickness,'east');
    ctx.fillStyle=s.accent;ctx.globalAlpha=.72;
    if(s.door==='north'||s.door==='south')ctx.fillRect(centerX-doorSpan/2,s.door==='north'?top+thickness-3:bottom-thickness,doorSpan,3);
    else ctx.fillRect(s.door==='west'?left+thickness-3:right-thickness,centerY-doorSpan/2,3,doorSpan);
    ctx.globalAlpha=1;
  }

  function drawHouse(ctx, s) {
    const x=s.x*TILE,y=s.y*TILE,w=s.w*TILE,h=s.h*TILE;
    const style=HOUSE_STYLES[(Number(s.variant)||0)%HOUSE_STYLES.length];
    ctx.save();ctx.fillStyle='rgba(0,0,0,.24)';ctx.fillRect(x+10,y+12,w-4,h-4);
    drawHouseFloor(ctx,s,style,x,y,w,h);
    drawHouseFurniture(ctx,s,style,x,y,w,h);
    drawHouseWalls(ctx,s,style,x,y,w,h);
    ctx.restore();
  }

  function drawStructure(ctx,s) {
    if (s.type==='house' || s.type==='market') {
      drawHouse(ctx,s);
      return;
    }
    const cx=(s.x+s.w/2)*TILE, cy=(s.y+s.h/2)*TILE;
    ctx.save();
    if(s.type==='fountain'){
      ctx.fillStyle='#2b3435';ctx.beginPath();ctx.ellipse(cx,cy+8,24,10,0,0,Math.PI*2);ctx.fill();
      ctx.strokeStyle='#7bc6d7';ctx.globalAlpha=.72;ctx.lineWidth=2;ctx.beginPath();ctx.arc(cx,cy-2,10,0,Math.PI*2);ctx.stroke();ctx.beginPath();ctx.moveTo(cx,cy+3);ctx.quadraticCurveTo(cx+9,cy-18,cx,cy-25);ctx.stroke();
    } else if(s.type==='gate'){
      ctx.fillStyle='#4d4338';ctx.fillRect(cx-13,cy-19,26,38);ctx.fillStyle='#1c1814';ctx.fillRect(cx-6,cy-10,12,29);ctx.strokeStyle=s.accent;ctx.globalAlpha=.45;ctx.strokeRect(cx-13,cy-19,26,38);
    } else {
      ctx.shadowBlur=12;ctx.shadowColor=s.accent;ctx.fillStyle='#29231b';ctx.fillRect(cx-2,cy-13,4,20);ctx.fillStyle=s.accent;ctx.globalAlpha=.72;ctx.beginPath();ctx.arc(cx,cy-15,4,0,Math.PI*2);ctx.fill();
    }
    ctx.restore();
  }

  function drawCities(game,ctx) {
    const world=game.world;if(!world?.cityStructures)return;
    for(const s of world.cityStructures) drawStructure(ctx,s);
    // City identity now belongs to the fixed HUD above the minimap. Keeping it
    // out of the world canvas prevents labels from covering buildings/players.
    updateCityHud(game);
  }

  function pruneCityMobs(game) {
    if (!Array.isArray(game.mobs)) return;
    game.mobs = game.mobs.filter(m => !cityAtPixel(m.x,m.y));
  }

  function install() {
    const game=global.astraeon;
    if(!game || game.onlineWorldV4Installed)return;
    game.onlineWorldV4Installed=true;
    ensureCityHud();

    const originalAddMob=game.addMob?.bind(game);
    if(originalAddMob)game.addMob=function(type,x,y,...rest){if(cityAtPixel(x,y))return null;return originalAddMob(type,x,y,...rest);};

    const originalStart=game.startNew.bind(game);
    game.startNew=function(){originalStart();decorate(this.world);pruneCityMobs(this);updateCityHud(this);this.toast?.('Astralum e as cidades de Astraeon foram abertas.');};
    const originalContinue=game.continueGame.bind(game);
    game.continueGame=function(){originalContinue();if(this.world){decorate(this.world);pruneCityMobs(this);updateCityHud(this);}};

    const originalTerrain=game.drawTerrain.bind(game);
    game.drawTerrain=function(ctx){originalTerrain(ctx);drawCities(this,ctx);};

    const originalMini=game.drawMinimap.bind(game);
    game.drawMinimap=function(){originalMini();updateCityHud(this);if(!this.world)return;const ctx=this.mctx,size=196;ctx.save();for(const c of CITIES){const x=(c.x/this.world.width)*size,y=(c.y/this.world.height)*size;ctx.fillStyle=c.accent;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,3.3,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();};

    const originalBig=game.renderBigMap.bind(game);
    game.renderBigMap=function(){originalBig();if(!this.world)return;const canvas=document.querySelector('#bigMapCanvas'),ctx=canvas?.getContext('2d');if(!ctx)return;const size=canvas.width||620;ctx.save();ctx.textAlign='center';for(const c of CITIES){const x=(c.x/this.world.width)*size,y=(c.y/this.world.height)*size;ctx.fillStyle=c.accent;ctx.strokeStyle='#15100c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font='700 10px Inter,sans-serif';ctx.fillStyle='#f2eadc';ctx.shadowBlur=5;ctx.shadowColor='#000';ctx.fillText(c.name,x,y-10);}ctx.restore();};

    if(game.world){decorate(game.world);pruneCityMobs(game);updateCityHud(game);}
  }

  global.AstraeonOnlineWorld={CITIES,decorate,cityAtTile,cityAtPixel,nearbyCity,updateCityHud,install};
  global.addEventListener('DOMContentLoaded',install);
})(window);

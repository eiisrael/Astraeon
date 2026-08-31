(function (global) {
  'use strict';

  const W = global.AstraeonWorld;
  if (!W) return;
  const TILE = W.TILE;

  const CITIES = [
    { id:'astralum', name:'Astralum', subtitle:'Coração da Convergência', x:48, y:48, radius:7, accent:'#e6b85f', biome:'forest' },
    { id:'lumenfall', name:'Lúmenfall', subtitle:'Cidade das Copas Antigas', x:18, y:27, radius:5, accent:'#79c98c', biome:'forest' },
    { id:'solvaris', name:'Solvaris', subtitle:'Mercado do Sol Ardente', x:76, y:33, radius:5, accent:'#e4a657', biome:'steppe' },
    { id:'nivora', name:'Nivora', subtitle:'Fortaleza do Véu', x:50, y:11, radius:5, accent:'#9dd9e8', biome:'frost' },
    { id:'umbravale', name:'Umbra Vale', subtitle:'Refúgio das Águas Escuras', x:21, y:75, radius:5, accent:'#7fa57a', biome:'swamp' },
    { id:'cinzalta', name:'Cinzalta', subtitle:'Bastião dos Altos de Cinza', x:74, y:75, radius:5, accent:'#d08d67', biome:'highland' }
  ];

  const BUILDING_OFFSETS = [
    [-4,-3,'house'],[-1,-4,'house'],[3,-3,'house'],[-4,1,'house'],[3,1,'house'],[-2,3,'market'],[2,3,'house']
  ];

  function tile(world, x, y) { return world?.get?.(x, y); }
  function cityAtTile(tx, ty) {
    return CITIES.find(c => Math.hypot(tx - c.x, ty - c.y) <= c.radius + .45) || null;
  }
  function cityAtPixel(x, y) { return cityAtTile(x / TILE, y / TILE); }

  function openTile(t, city) {
    if (!t) return;
    t.biome = city.biome || t.biome;
    t.kind = 'road';
    t.blocked = false;
    t.object = null;
    t.cityId = city.id;
  }

  function blockFootprint(world, structure, city) {
    for (let yy = 0; yy < structure.h; yy++) for (let xx = 0; xx < structure.w; xx++) {
      const t = tile(world, structure.x + xx, structure.y + yy);
      if (!t) continue;
      t.cityId = city.id;
      t.biome = city.biome || t.biome;
      if (structure.type !== 'fountain' && structure.type !== 'lamp') t.blocked = true;
      t.object = null;
    }
  }

  function structuresFor(city) {
    const out = [];
    const add = (dx,dy,type,w=2,h=2) => out.push({cityId:city.id,x:city.x+dx,y:city.y+dy,type,w,h,accent:city.accent});
    BUILDING_OFFSETS.forEach(([dx,dy,type]) => add(dx,dy,type,2,2));
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

  function drawHouse(ctx, s) {
    const x=s.x*TILE,y=s.y*TILE,w=s.w*TILE,h=s.h*TILE;
    ctx.save();
    ctx.fillStyle='rgba(0,0,0,.22)';ctx.fillRect(x+5,y+9,w-5,h-6);
    const wall=ctx.createLinearGradient(x,y,x,y+h);wall.addColorStop(0,'#65543d');wall.addColorStop(1,'#3b3126');
    ctx.fillStyle=wall;ctx.fillRect(x+7,y+13,w-14,h-16);
    ctx.fillStyle='#241b16';ctx.beginPath();ctx.moveTo(x+2,y+18);ctx.lineTo(x+w/2,y+1);ctx.lineTo(x+w-2,y+18);ctx.closePath();ctx.fill();
    ctx.strokeStyle=s.accent;ctx.globalAlpha=.38;ctx.lineWidth=2;ctx.strokeRect(x+11,y+20,w-22,h-25);
    ctx.globalAlpha=1;ctx.fillStyle='rgba(238,190,105,.45)';ctx.fillRect(x+w/2-4,y+h-20,8,12);
    ctx.restore();
  }

  function drawStructure(ctx,s) {
    if (s.type==='house' || s.type==='market') {
      drawHouse(ctx,s);
      if(s.type==='market'){
        const x=s.x*TILE,y=s.y*TILE,w=s.w*TILE;
        ctx.save();ctx.fillStyle='rgba(188,88,58,.75)';ctx.fillRect(x+6,y+8,w-12,7);ctx.fillStyle='rgba(241,200,111,.55)';
        for(let i=0;i<4;i++)ctx.fillRect(x+7+i*((w-14)/4),y+8,(w-14)/8,7);ctx.restore();
      }
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
    const near = CITIES.filter(c => Math.hypot(game.player.x-c.x*TILE,game.player.y-c.y*TILE) < (c.radius+5)*TILE);
    ctx.save();ctx.textAlign='center';
    for(const c of near){
      const x=c.x*TILE+TILE/2,y=(c.y-c.radius-1)*TILE;
      ctx.font='700 12px Georgia,serif';ctx.fillStyle='#f0ddbb';ctx.shadowBlur=6;ctx.shadowColor='#000';ctx.fillText(c.name,x,y);
      ctx.font='600 9px Inter,sans-serif';ctx.fillStyle=c.accent;ctx.fillText(c.subtitle,x,y+13);
    }
    ctx.restore();
  }

  function pruneCityMobs(game) {
    if (!Array.isArray(game.mobs)) return;
    game.mobs = game.mobs.filter(m => !cityAtPixel(m.x,m.y));
  }

  function install() {
    const game=global.astraeon;
    if(!game || game.onlineWorldV4Installed)return;
    game.onlineWorldV4Installed=true;

    const originalAddMob=game.addMob?.bind(game);
    if(originalAddMob)game.addMob=function(type,x,y,...rest){if(cityAtPixel(x,y))return null;return originalAddMob(type,x,y,...rest);};

    const originalStart=game.startNew.bind(game);
    game.startNew=function(){originalStart();decorate(this.world);pruneCityMobs(this);this.toast?.('Astralum e as cidades de Astraeon foram abertas.');};
    const originalContinue=game.continueGame.bind(game);
    game.continueGame=function(){originalContinue();if(this.world){decorate(this.world);pruneCityMobs(this);}};

    const originalTerrain=game.drawTerrain.bind(game);
    game.drawTerrain=function(ctx){originalTerrain(ctx);drawCities(this,ctx);};

    const originalMini=game.drawMinimap.bind(game);
    game.drawMinimap=function(){originalMini();if(!this.world)return;const ctx=this.mctx,size=196;ctx.save();for(const c of CITIES){const x=(c.x/this.world.width)*size,y=(c.y/this.world.height)*size;ctx.fillStyle=c.accent;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(x,y,3.3,0,Math.PI*2);ctx.fill();ctx.stroke();}ctx.restore();};

    const originalBig=game.renderBigMap.bind(game);
    game.renderBigMap=function(){originalBig();if(!this.world)return;const canvas=document.querySelector('#bigMapCanvas'),ctx=canvas?.getContext('2d');if(!ctx)return;const size=canvas.width||620;ctx.save();ctx.textAlign='center';for(const c of CITIES){const x=(c.x/this.world.width)*size,y=(c.y/this.world.height)*size;ctx.fillStyle=c.accent;ctx.strokeStyle='#15100c';ctx.lineWidth=3;ctx.beginPath();ctx.arc(x,y,6,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.font='700 10px Inter,sans-serif';ctx.fillStyle='#f2eadc';ctx.shadowBlur=5;ctx.shadowColor='#000';ctx.fillText(c.name,x,y-10);}ctx.restore();};

    if(game.world){decorate(game.world);pruneCityMobs(game);}
  }

  global.AstraeonOnlineWorld={CITIES,decorate,cityAtTile,cityAtPixel,install};
  global.addEventListener('DOMContentLoaded',install);
})(window);

import assert from 'node:assert/strict';
import fs from 'node:fs';

const fakeClassList={add(){},remove(){}};
const fakeNode=()=>({dataset:{},style:{setProperty(){}},classList:fakeClassList,remove(){},set innerHTML(_) {}});
globalThis.window=globalThis;
globalThis.document={getElementById:()=>null,createElement:fakeNode,body:{appendChild(){}},documentElement:{}};
globalThis.requestAnimationFrame=callback=>{callback();return 1;};
globalThis.setTimeout=callback=>{callback();return 1;};
await import('../src/skills-catalog-v1.js');
await import('../src/skill-effects-v2.js');
const C=globalThis.AstraeonSkillsCatalogV1;
const FX=globalThis.AstraeonSkillEffectsV2;
assert.ok(C&&FX,'catálogo e runtime visual devem iniciar');
assert.equal(C.VERSION,'2.0','catálogo usa receitas individuais v2');
assert.equal(Object.keys(C.CLASSES).length,5,'existem cinco classes');

const ids=new Set(),names=new Set(),descriptions=new Set(),visuals=new Set(),effectNames=new Set(),mechanics=new Set();
for(const[classId,group]of Object.entries(C.CLASSES)){
  assert.equal(group.domains.length,2,`${classId} possui dois domínios`);
  assert.equal(C.list(classId).length,20,`${classId} possui vinte skills`);
  const classVariants=new Set();
  for(const domain of group.domains){
    assert.equal(domain.skills.length,10,`${domain.name} possui dez skills`);
    domain.skills.forEach((skill,index)=>{
      assert.equal(skill.tier,index+1);
      assert.ok(skill.description.length>70,`${skill.name} descreve sua mecânica real`);
      assert.ok(Object.keys(skill.mechanics).length>=4,`${skill.name} possui receita própria`);
      assert.ok(!ids.has(skill.id),`${skill.id} é único`);ids.add(skill.id);
      assert.ok(!names.has(skill.name),`${skill.name} não se repete`);names.add(skill.name);
      assert.ok(!descriptions.has(skill.description),`${skill.name} não reutiliza descrição`);descriptions.add(skill.description);
      assert.ok(!visuals.has(skill.visualKey),`${skill.name} possui assinatura visual única`);visuals.add(skill.visualKey);
      assert.ok(!classVariants.has(skill.visualVariant),`${skill.name} possui variante exclusiva na classe`);classVariants.add(skill.visualVariant);
      const visualName=FX.effectName(skill);assert.ok(!effectNames.has(visualName),`${skill.name} possui efeito nomeado exclusivo`);effectNames.add(visualName);
      const mechanicSignature=JSON.stringify({mode:skill.mode,...skill.mechanics});assert.ok(!mechanics.has(mechanicSignature),`${skill.name} não repete uma receita de combate`);mechanics.add(mechanicSignature);
      if(skill.tier===10){assert.equal(skill.gold,5_000_000);assert.equal(skill.ultimate,true);assert.equal(skill.mechanics.cinematic,true);}
    });
  }
  assert.equal(classVariants.size,20,`${classId} possui vinte variantes visuais`);

  const learned=new Set();let available=180,gold=10_000_000;
  for(const skill of C.list(classId)){
    const eligibility=C.purchaseEligibility({skill,level:60,available,gold,learned});
    assert.deepEqual(eligibility,{ok:true,reason:null},`${classId} pode comprar ${skill.name} com requisitos completos`);
    learned.add(skill.id);available-=skill.cost;gold-=skill.gold;
  }
  assert.equal(learned.size,20,`${classId} consegue comprar as vinte skills`);
  assert.equal(available,40,`${classId} preserva o balanço de 180 pontos ganhos e 140 gastos`);
  assert.equal(gold,0,`${classId} paga 5 milhões por cada uma das duas cinematics`);
}
assert.equal(ids.size,100,'catálogo totaliza cem skills únicas');
assert.equal(visuals.size,100,'existem cem assinaturas visuais distintas');
assert.equal(effectNames.size,100,'existem cem efeitos nomeados distintos');
assert.equal(mechanics.size,100,'existem cem receitas mecânicas distintas');
assert.deepEqual(C.COSTS,[1,2,3,4,5,6,8,10,13,18]);
assert.deepEqual(C.LEVELS,[1,3,6,10,15,21,28,36,45,60]);

const incomplete=C.CLASSES.Warrior.domains[0].skills[9];
assert.equal(C.purchaseEligibility({skill:incomplete,level:60,available:180,gold:5_000_000,learned:[]}).reason,'skill_domain_incomplete','a cinematic exige as nove skills anteriores');
assert.equal(C.purchaseEligibility({skill:incomplete,level:60,available:180,gold:0,learned:C.CLASSES.Warrior.domains[0].skills.slice(0,9).map(s=>s.id)}).reason,'skill_gold_insufficient','a cinematic exige cinco milhões');

function mockGame(classId){
  const mobs=Array.from({length:12},(_,i)=>({id:`mob-${i}`,x:55+Math.cos(i)*35,y:Math.sin(i)*35,hp:50000,maxHp:50000,speed:80,power:10,dead:false}));
  return{player:{classId,x:0,y:0,hp:1000,maxHp:1000,mana:1000,maxMana:1000,power:100,defense:20,speed:180,crit:0,invuln:0},mobs,mouse:{worldX:70,worldY:0},effects:[],camera:{shake:0},moveEntity(entity,dx,dy){entity.x+=dx;entity.y+=dy;},closestMobTo(x,y,radius){return this.mobs.find(m=>!m.dead&&Math.hypot(m.x-x,m.y-y)<=radius)||null;},hitMob(mob,amount){mob.hp-=amount;if(mob.hp<=0)mob.dead=true;}};
}
const context={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},closePath(){},arc(){},stroke(){},fill(){},translate(){},rotate(){},setLineDash(){},globalAlpha:1,globalCompositeOperation:'source-over'};
for(const[classId]of Object.entries(C.CLASSES))for(const skill of C.list(classId)){
  const g=mockGame(classId),result=FX.cast(g,skill);
  assert.equal(result.ok,true,`${classId}/${skill.name} executa sem falha`);
  const effect=g.effects.at(-1);assert.equal(effect.type,'class-skill',`${skill.name} publica efeito próprio`);
  assert.equal(effect.skillId,skill.id,`${skill.name} preserva identidade no canvas`);
  assert.doesNotThrow(()=>FX.draw(context,effect,.5),`${skill.name} renderiza no canvas`);
}

const runtime=fs.readFileSync(new URL('../src/skills-v1.js',import.meta.url),'utf8');
const gameRuntime=fs.readFileSync(new URL('../src/game-v2.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const masterStyles=fs.readFileSync(new URL('../src/skills-master-layout-v2.css',import.meta.url),'utf8');
const skillStyles=fs.readFileSync(new URL('../src/skills-v1.css',import.meta.url),'utf8');
const purchaseRepair=fs.readFileSync(new URL('../supabase/migrations/021_skill_purchase_level_sync.sql',import.meta.url),'utf8');
assert.match(runtime,/AstraeonSkillEffectsV2\?\.cast/,'HUD executa o runtime individual de skills');
assert.match(runtime,/purchaseEligibility/,'compra offline usa a mesma validação central');
assert.match(gameRuntime,/e\.type === 'class-skill'/,'canvas delega efeitos exclusivos');
assert.match(index,/src\/skill-effects-v2\.js/,'renderer v2 carrega no jogo');
assert.match(index,/src\/skill-effects-v2\.css/,'cinemáticas carregam no jogo');
assert.match(runtime,/id='skillsPanel'|id="skillsPanel"/,'grimório do jogador possui painel próprio');
assert.match(runtime,/id='skillMerchantPanel'|id="skillMerchantPanel"/,'Mestre possui loja separada');
assert.match(runtime,/onSkillPointerMove/,'equipamento suporta arraste por ponteiro');
assert.match(runtime,/saveCharacterNow/,'compra online sincroniza o nível atual antes da RPC');
assert.match(runtime,/state\.remote\?state\.serverGold/,'loja não pode exibir ouro local como se fosse saldo autoritativo');
assert.match(runtime,/data-purchase-state/,'cada skill deve informar o motivo real do bloqueio');
assert.match(runtime,/skills-overlay-open/,'painéis de skill sinalizam a camada visual ativa');
assert.match(runtime,/document\.body\.appendChild\(toast\)/,'aviso é elevado acima da camada fixa do jogo');
assert.match(runtime,/responseCharacter!==String\(expectedCharacter\)/,'resposta remota de outro personagem é descartada');
assert.match(runtime,/remoteCharacter!==id&&state\.syncingCharacter!==id/,'sincronização falha é repetida somente para o personagem ativo');
assert.match(runtime,/selectCharacter\(id,\{fresh:true\}\)/,'troca detectada limpa imediatamente as skills anteriores');
assert.match(runtime,/characterId\(\)!==id/,'compra é cancelada se o personagem mudar durante a requisição');
assert.match(runtime,/state\.remote&&state\.remoteCharacter===characterId\(\)/,'saldo de pontos autoritativo não é recalculado pelo save local');
assert.match(runtime,/PGRST202\|schema cache/,'servidor sem migrations recebe diagnóstico específico');
assert.match(runtime,/catch\(error\)\{if\(id\)await syncRemote\(id\)/,'exceções de compra restauram o estado autoritativo do personagem');
assert.match(runtime,/canPlayerAttack\(g\)/,'skills ofensivas respeitam a área protegida');
assert.match(masterStyles,/--compact-skill-size:\s*30px/,'tiles desktop permanecem compactos');
assert.match(skillStyles,/\.skills-overlay-open #toast[\s\S]*z-index:1700/, 'avisos ficam acima do fundo translúcido e da confirmação');
assert.match(purchaseRepair,/greatest\(c\.level,coalesce\(p\.level,1\)\)/,'RPC corrige o nível obsoleto do personagem pelo perfil ativo salvo');
assert.match(purchaseRepair,/update public\.characters set level=greatest\(level,character_level\)/,'compra válida repara o nível persistido para as próximas operações');

console.log('ASTRAEON SKILLS V2: 100 mechanics, effects, purchases and cinematics OK');

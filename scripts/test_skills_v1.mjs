import assert from 'node:assert/strict';
import fs from 'node:fs';
globalThis.window=globalThis;
await import('../src/skills-catalog-v1.js');
const C=globalThis.AstraeonSkillsCatalogV1;
assert.ok(C,'catálogo de skills deve iniciar');
assert.equal(Object.keys(C.CLASSES).length,5,'existem cinco classes');
const ids=new Set();
for(const[classId,group]of Object.entries(C.CLASSES)){
  assert.equal(group.domains.length,2,`${classId} possui dois domínios`);
  assert.equal(C.list(classId).length,20,`${classId} possui vinte skills`);
  for(const domain of group.domains){
    assert.equal(domain.skills.length,10,`${domain.name} possui dez skills`);
    domain.skills.forEach((skill,index)=>{
      assert.equal(skill.tier,index+1);
      assert.ok(skill.description.length>24,`${skill.name} possui descrição mecânica`);
      assert.ok(!ids.has(skill.id),`${skill.id} é único`);ids.add(skill.id);
      if(skill.tier===10){assert.equal(skill.gold,5_000_000);assert.equal(skill.ultimate,true);}
    });
  }
}
assert.equal(ids.size,100,'catálogo totaliza cem skills únicas');
assert.deepEqual(C.COSTS,[1,2,3,4,5,6,8,10,13,18]);
assert.deepEqual(C.LEVELS,[1,3,6,10,15,21,28,36,45,60]);
const runtime=fs.readFileSync(new URL('../src/skills-v1.js',import.meta.url),'utf8');
const masterStyles=fs.readFileSync(new URL('../src/skills-master-layout-v2.css',import.meta.url),'utf8');
assert.match(runtime,/id='skillsPanel'|id="skillsPanel"/,'grimório do jogador possui painel próprio');
assert.match(runtime,/id='skillMerchantPanel'|id="skillMerchantPanel"/,'Mestre possui loja separada');
assert.match(runtime,/function openPlayer\(\)/,'tecla H abre o grimório pessoal');
assert.match(runtime,/function openMerchant\(\)/,'NPC abre a loja do Mestre');
assert.match(runtime,/onSkillPointerMove/,'equipamento suporta arraste por ponteiro');
assert.match(runtime,/\.skill-loadout-slot/,'arraste termina nos slots do HUD');
assert.match(runtime,/skills-master-workspace/,'interação com o Mestre usa workspace duplo');
assert.ok(runtime.indexOf('skills-companion-card')<runtime.indexOf('skills-merchant-card'),'grimório aparece antes e à esquerda da loja');
assert.match(runtime,/merchant-skill-grid/,'loja possui grade própria de skills');
assert.match(masterStyles,/--compact-skill-size:\s*30px/,'tiles desktop permanecem próximos de 25x25');
assert.match(masterStyles,/--compact-panel-width:\s*380px/,'painéis usam largura compacta idêntica');
assert.match(masterStyles,/--compact-panel-height:\s*620px/,'painéis usam altura compacta idêntica');
assert.match(masterStyles,/--compact-skill-size:\s*28px/,'tiles mobile permanecem próximos de 25x25');
console.log('ASTRAEON SKILLS V1 catalog and balance validation OK');

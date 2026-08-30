(function(global){
'use strict';
const LEVELS=[1,3,6,10,15,21,28,36,45,60];
const COSTS=[1,2,3,4,5,6,8,10,13,18];
const GOLD=[0,0,0,0,0,0,0,0,0,5000000];
const EFFECTS={
 strike:(p,t)=>`Atinge o alvo por ${p}% do Poder${t>=7?' e recebe +15% de chance crítica':''}.`,
 projectile:(p,t)=>`Dispara energia até o alcance da classe e causa ${p}% do Poder ao primeiro alvo.`,
 area:(p,t)=>`Fere inimigos em ${70+t*9}px ao redor por ${p}% do Poder.`,
 nova:(p,t)=>`Detona a área indicada em ${105+t*10}px, causando ${p}% do Poder.`,
 shield:(p,t)=>`Concede ${(.7+t*.12).toFixed(1)}s de invulnerabilidade e restaura ${12+t*5} de vida.`,
 heal:(p,t)=>`Restaura ${18+t*7} de vida e ${8+t*3} de mana.`,
 dash:(p,t)=>`Avança ${85+t*9}px na direção apontada e causa ${p}% do Poder no destino.`,
 buff:(p,t)=>`Amplifica Poder e velocidade em ${12+t*2}% durante ${3+Math.floor(t/2)}s.`,
 execute:(p,t)=>`Executa um golpe de ${p}% do Poder; causa 50% a mais contra alvos abaixo de 30% de vida.`,
 drain:(p,t)=>`Causa ${p}% do Poder e converte 25% do dano em vida.`,
 trap:(p,t)=>`Cria uma armadilha de ${90+t*7}px que causa ${p}% do Poder aos inimigos próximos.`,
 ultimate:(p,t)=>`Poder supremo: causa ${p}% do Poder em uma grande área, restaura recursos e abala os inimigos.`
};
const RAW={
 Warrior:[
  ['vanguarda','Domínio da Vanguarda','Ofensiva frontal, ruptura e domínio do campo.','#ef8b62',[
   ['Corte de Astrium','strike'],['Brado Provocador','area'],['Passo de Ferro','dash'],['Guarda do Primeiro Sol','shield'],['Ruptura Ascendente','strike'],['Redemoinho de Aço','area'],['Investida Rompedora','dash'],['Ira da Vanguarda','buff'],['Execução do Comandante','execute'],['Avatar da Convergência','ultimate']]],
  ['colosso','Domínio do Colosso','Defesa, sustentação e contra-ataques devastadores.','#d7b27a',[
   ['Pele de Rocha','shield'],['Golpe de Escudo','strike'],['Clamor do Colosso','heal'],['Abalo Guardião','area'],['Fortaleza Ambulante','buff'],['Muralha de Astrium','shield'],['Martelo Tectônico','nova'],['Sangue de Gigante','heal'],['Queda da Montanha','execute'],['Coração do Titã','ultimate']]]
 ],
 Mage:[
  ['arcano','Domínio do Arcano','Precisão mística, controle espacial e mana.','#7caeff',[
   ['Dardo de Éter','projectile'],['Selo de Gravidade','trap'],['Passo do Vazio','dash'],['Égide Rúnica','shield'],['Lança Astral','projectile'],['Prisão de Mana','area'],['Dobra Espacial','dash'],['Sobrecarga Arcana','buff'],['Colapso Etéreo','execute'],['Singularidade de Astra','ultimate']]],
  ['elemental','Domínio Elemental','Fogo, gelo e tempestades de grande alcance.','#71d6e8',[
   ['Centelha Ígnea','projectile'],['Círculo de Geada','area'],['Salto Trovejante','dash'],['Manto de Gelo','shield'],['Lança de Chamas','projectile'],['Tempestade Prismática','nova'],['Coração da Tormenta','buff'],['Zero Absoluto','trap'],['Meteorito Ancestral','execute'],['Cataclismo Elemental','ultimate']]]
 ],
 Archer:[
  ['cacada','Domínio da Caçada','Precisão, perseguição e golpes contra alvos isolados.','#87d887',[
   ['Flecha Marcadora','projectile'],['Passo do Rastreador','dash'],['Armadilha Serrilhada','trap'],['Camuflagem de Folha','shield'],['Tiro Perfurante','projectile'],['Olho do Predador','buff'],['Rajada Caçadora','strike'],['Cerco Silencioso','trap'],['Abate Implacável','execute'],['Caçada da Lua Rubra','ultimate']]],
  ['tempestade','Domínio da Tempestade','Mobilidade e chuva de projéteis em área.','#69c7d2',[
   ['Flecha de Vento','projectile'],['Recuo Aéreo','dash'],['Círculo de Plumas','area'],['Brisa Restauradora','heal'],['Rajada Ciclônica','projectile'],['Passos do Vendaval','buff'],['Nuvem de Setas','nova'],['Olho do Furacão','shield'],['Trovão Perfurante','execute'],['Monção de Astra','ultimate']]]
 ],
 Assassin:[
  ['sangue','Domínio de Sangue','Drenagem, feridas críticas e execução.','#f05d72',[
   ['Talho Rubro','strike'],['Sede Vital','drain'],['Passo Hemático','dash'],['Pacto Escarlate','heal'],['Lâmina da Artéria','strike'],['Névoa Carmesim','area'],['Frenesi Sanguíneo','buff'],['Marca da Hemorragia','drain'],['Ceifa do Coração','execute'],['Eclipse de Sangue','ultimate']]],
  ['bruxo','Domínio de Bruxo','Maldições, sombras e controle oculto.','#b27adf',[
   ['Agulha Sombria','projectile'],['Selo Maldito','trap'],['Travessia Umbral','dash'],['Pele do Vazio','shield'],['Garras do Familiar','strike'],['Círculo Profano','area'],['Transe da Bruxa','buff'],['Prisão das Sombras','trap'],['Veredito do Abismo','execute'],['Sabá da Noite Eterna','ultimate']]]
 ],
 Paladine:[
  ['juramento','Domínio do Juramento Solar','Luz ofensiva, cura e julgamento.','#f1c75f',[
   ['Golpe Juramentado','strike'],['Luz Reparadora','heal'],['Investida Solar','dash'],['Voto de Proteção','shield'],['Lança de Lúmen','projectile'],['Consagração','area'],['Fervor do Justo','buff'],['Círculo do Alvorecer','nova'],['Julgamento Final','execute'],['Ascensão do Sol Eterno','ultimate']]],
  ['egide','Domínio da Égide Sagrada','Proteção coletiva e punição aos agressores.','#e9df9a',[
   ['Escudo Luminar','shield'],['Represália Sagrada','strike'],['Prece Restauradora','heal'],['Passo do Guardião','dash'],['Aura da Égide','area'],['Vigília Inquebrável','buff'],['Martelo da Aurora','nova'],['Santuário Radiante','heal'],['Sentença Divina','execute'],['Bastião Celestial','ultimate']]]
 ]
};
function idFor(classId,domain,index){return `${classId.toLowerCase()}_${domain}_${String(index+1).padStart(2,'0')}`;}
function build(){const classes={};for(const[classId,domains]of Object.entries(RAW)){classes[classId]={classId,domains:domains.map(([code,name,summary,color,rows])=>({code,name,summary,color,skills:rows.map(([name,effect],index)=>{const tier=index+1,power=110+tier*17+(effect==='ultimate'?120:0);return{id:idFor(classId,code,index),classId,domain:code,domainName:name,domainColor:color,tier,name,effect,power,level:LEVELS[index],cost:COSTS[index],gold:GOLD[index],description:EFFECTS[effect](power,tier),ultimate:tier===10};})}))};}return classes;}
const CLASSES=build();
function list(classId){return CLASSES[classId]?.domains.flatMap(domain=>domain.skills)||[];}
function get(skillId){for(const group of Object.values(CLASSES))for(const domain of group.domains){const skill=domain.skills.find(row=>row.id===skillId);if(skill)return skill;}return null;}
global.AstraeonSkillsCatalogV1=Object.freeze({VERSION:'1.0',LEVELS,COSTS,GOLD,CLASSES,list,get,idFor});
})(window);

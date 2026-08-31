(function(global){
'use strict';
const LEVELS=[1,3,6,10,15,21,28,36,45,60];
const COSTS=[1,2,3,4,5,6,8,10,13,18];
const GOLD=[0,0,0,0,0,0,0,0,0,5000000];
const D=(code,name,summary,color,skills)=>({code,name,summary,color,skills});
const S=(name,mode,description,mechanics)=>({name,mode,description,mechanics});
const RAW={
 Warrior:[
  D('vanguarda','Domínio da Vanguarda','Ofensiva frontal, ruptura e comando do campo.','#ef8b62',[
   S('Corte de Astrium','target','Cruza a guarda do alvo com dois cortes de 127% do Poder e deixa uma ferida de 18% por 3 segundos.',{power:127,hits:2,dot:18,dotDuration:3,range:72,mana:11,cooldown:5.6}),
   S('Brado Provocador','selfArea','Explode um brado em 96 px, causa 118% do Poder e reduz o dano dos inimigos atingidos por 4 segundos.',{power:118,radius:96,weaken:.18,weakenDuration:4,mana:14,cooldown:7.8}),
   S('Passo de Ferro','dash','Avança 118 px sem atravessar corpos, golpeia em 58 px por 142% do Poder e atordoa por 0,7 segundo.',{power:142,dash:118,radius:58,stun:.7,mana:16,cooldown:8.4}),
   S('Guarda do Primeiro Sol','shield','Ergue uma guarda de 1,45 segundo, cura 9% da vida máxima e converte o próximo impacto em luz.',{invuln:1.45,healPct:.09,mana:19,cooldown:12}),
   S('Ruptura Ascendente','target','Lança o inimigo em uma ruptura vertical de 176% do Poder e rompe 16% de sua resistência por 5 segundos.',{power:176,armorBreak:.16,statusDuration:5,range:76,mana:23,cooldown:8.8}),
   S('Redemoinho de Aço','selfArea','Executa três giros cortantes em 112 px; cada volta causa 68% do Poder e amplia o alcance seguinte.',{power:68,hits:3,radius:112,mana:27,cooldown:10.5}),
   S('Investida Rompedora','dash','Percorre 168 px em linha, abre uma trilha de 72 px e causa 214% do Poder aos inimigos atravessados.',{power:214,dash:168,radius:72,line:true,mana:31,cooldown:11.2}),
   S('Ira da Vanguarda','buff','Por 6 segundos, recebe 28% de Poder e 16% de velocidade; cada golpe mantém a aura de comando acesa.',{buffPower:.28,buffSpeed:.16,duration:6,mana:35,cooldown:18}),
   S('Execução do Comandante','execute','Desfere 292% do Poder; abaixo de 32% de vida, o alvo recebe mais 75% e fica marcado para a tropa.',{power:292,execute:.32,executeBonus:.75,mark:1.12,statusDuration:5,range:80,mana:42,cooldown:16}),
   S('Avatar da Convergência','ultimate','Cinemática: materializa o estandarte da Vanguarda, desfere cinco ondas de 104% em 245 px e restaura 18% da vida.',{power:104,hits:5,radius:245,healPct:.18,cinematic:true,mana:60,cooldown:30})
  ]),
  D('colosso','Domínio do Colosso','Defesa, sustentação e impactos tectônicos.','#d7b27a',[
   S('Pele de Rocha','shield','Reveste o corpo por 1,1 segundo e recupera 14% da vida máxima sem interromper o movimento.',{invuln:1.1,healPct:.14,mana:12,cooldown:10}),
   S('Golpe de Escudo','target','Projeta o escudo por 136% do Poder, atordoa por 1 segundo e enfraquece o ataque do alvo em 12%.',{power:136,stun:1,weaken:.12,weakenDuration:4,range:70,mana:15,cooldown:8}),
   S('Clamor do Colosso','heal','Converte fúria em 24% de vida e 18% de mana, emitindo um pulso que revela inimigos próximos.',{healPct:.24,manaPct:.18,revealRadius:180,mana:17,cooldown:15}),
   S('Abalo Guardião','selfArea','Golpeia o chão em 128 px por 154% do Poder e desacelera os atingidos em 34% durante 3 segundos.',{power:154,radius:128,slow:.34,slowDuration:3,mana:21,cooldown:9.5}),
   S('Fortaleza Ambulante','buff','Por 7 segundos, recebe 22% de defesa e ignora lentidão, mas ganha somente 7% de velocidade.',{buffDefense:.22,buffSpeed:.07,unstoppable:true,duration:7,mana:25,cooldown:19}),
   S('Muralha de Astrium','wall','Ergue uma muralha rúnica de 150 px à frente; a explosão inicial causa 188% do Poder em uma faixa estreita.',{power:188,radius:86,wallLength:150,stun:.45,mana:29,cooldown:13}),
   S('Martelo Tectônico','cursorArea','Faz um martelo cair no cursor em 142 px, causando 238% do Poder e três réplicas de 22%.',{power:238,radius:142,aftershocks:3,aftershockPower:22,mana:34,cooldown:14.5}),
   S('Sangue de Gigante','heal','Restaura 38% da vida máxima e, por 5 segundos, transforma 10% do dano causado em cura.',{healPct:.38,lifeStealAura:.10,duration:5,mana:38,cooldown:22}),
   S('Queda da Montanha','execute','Esmaga uma área de 104 px por 318% do Poder; inimigos abaixo de 38% recebem uma segunda queda de 92%.',{power:318,radius:104,execute:.38,executeBonus:.92,mana:46,cooldown:19}),
   S('Coração do Titã','ultimate','Cinemática: desperta o Titã, cria quatro terremotos de 132% em 270 px e concede 2 segundos de invulnerabilidade.',{power:132,hits:4,radius:270,invuln:2,cinematic:true,mana:60,cooldown:30})
  ])
 ],
 Mage:[
  D('arcano','Domínio do Arcano','Precisão mística, gravidade e dobra espacial.','#7caeff',[
   S('Dardo de Éter','projectile','Condensa um dardo que atravessa até dois alvos, causando 132% e 84% do Poder em sequência.',{power:132,maxTargets:2,chainFalloff:.64,range:310,mana:11,cooldown:4.8}),
   S('Selo de Gravidade','trap','Marca 104 px no cursor por 5 segundos; a ativação causa 116% e prende por 1,15 segundo.',{power:116,radius:104,stun:1.15,trapDuration:5,mana:15,cooldown:9}),
   S('Passo do Vazio','teleport','Dobra o espaço por 152 px até o cursor e deixa uma implosão de 94% do Poder na origem.',{power:94,dash:152,originBlast:72,mana:18,cooldown:8.2}),
   S('Égide Rúnica','shield','Forma seis runas por 1,6 segundo, restaura 12% de mana e repele magia sem deslocar criaturas.',{invuln:1.6,manaPct:.12,mana:21,cooldown:12.5}),
   S('Lança Astral','beam','Perfura uma linha de 340 px por 196% do Poder e aplica ruptura arcana de 14% por 4 segundos.',{power:196,range:340,line:true,armorBreak:.14,statusDuration:4,mana:26,cooldown:8.7}),
   S('Prisão de Mana','cursorArea','Fecha uma jaula de 118 px no cursor, causa 144% do Poder e silencia o movimento por 1,35 segundo.',{power:144,radius:118,stun:1.35,mana:30,cooldown:12}),
   S('Dobra Espacial','swap','Troca a posição com o alvo até 280 px, causando 174% do Poder somente no ponto de chegada.',{power:174,range:280,swap:true,radius:48,mana:34,cooldown:13.8}),
   S('Sobrecarga Arcana','buff','Por 6 segundos, aumenta o Poder em 34% e regenera 4% da mana máxima a cada segundo.',{buffPower:.34,manaRegenPct:.04,duration:6,mana:38,cooldown:19}),
   S('Colapso Etéreo','execute','Comprime o alvo por 306% do Poder; abaixo de 30%, implode também inimigos em 92 px por metade do dano.',{power:306,execute:.30,executeBonus:.6,splashRadius:92,splashFactor:.5,range:330,mana:46,cooldown:17}),
   S('Singularidade de Astraeon','ultimate','Cinemática: abre uma singularidade de 285 px, pulsa seis vezes por 96% do Poder e devolve 30% da mana.',{power:96,hits:6,radius:285,manaPct:.30,cinematic:true,mana:60,cooldown:30})
  ]),
  D('elemental','Domínio Elemental','Fogo, gelo e tempestade em combinações mutáveis.','#71d6e8',[
   S('Centelha Ígnea','projectile','Dispara fogo vivo por 146% do Poder e queima 16% por segundo durante 4 segundos.',{power:146,dot:16,dotDuration:4,range:320,mana:12,cooldown:5.2}),
   S('Círculo de Geada','selfArea','Congela 126 px ao redor por 122% do Poder e reduz a velocidade em 48% por 3,5 segundos.',{power:122,radius:126,slow:.48,slowDuration:3.5,mana:16,cooldown:8.5}),
   S('Salto Trovejante','teleport','Vira relâmpago por 176 px e descarrega 158% do Poder em 66 px no destino.',{power:158,dash:176,radius:66,stun:.4,mana:20,cooldown:9}),
   S('Manto de Gelo','shield','Cria três camadas glaciais por 1,8 segundo e cura 7% da vida a cada camada quebrada.',{invuln:1.8,healPct:.21,layers:3,mana:24,cooldown:14}),
   S('Lança de Chamas','beam','Varre 360 px com fogo por 218% do Poder, deixando brasas de 13% por 5 segundos.',{power:218,range:360,line:true,dot:13,dotDuration:5,mana:28,cooldown:9.8}),
   S('Tempestade Prismática','cursorArea','Mistura três elementos em 154 px: 84% de fogo, gelo e raio, cada qual com impacto próprio.',{power:84,hits:3,radius:154,slow:.24,slowDuration:2,mana:33,cooldown:13}),
   S('Coração da Tormenta','orbit','Invoca quatro orbes elétricos por 6 segundos; a descarga total causa 236% em 132 px.',{power:59,hits:4,radius:132,duration:6,mana:37,cooldown:18}),
   S('Zero Absoluto','trap','Cristaliza 148 px no cursor por 2 segundos, causa 208% do Poder e paralisa por 1,8 segundo.',{power:208,radius:148,stun:1.8,slow:.7,slowDuration:4,mana:42,cooldown:16}),
   S('Meteorito Ancestral','execute','Invoca um meteoro de 344% em 122 px; abaixo de 35% de vida, abre uma cratera de 152% adicional.',{power:344,radius:122,execute:.35,executeBonus:.44,mana:49,cooldown:20}),
   S('Cataclismo Elemental','ultimate','Cinemática: fogo, gelo e raio colidem em sete impactos de 88% dentro de 300 px.',{power:88,hits:7,radius:300,stun:1.2,cinematic:true,mana:60,cooldown:30})
  ])
 ],
 Archer:[
  D('cacada','Domínio da Caçada','Rastreamento, precisão e domínio de alvos isolados.','#87d887',[
   S('Flecha Marcadora','projectile','Marca o alvo com 124% do Poder; durante 5 segundos, seus próximos ataques causam 14% a mais.',{power:124,mark:1.14,statusDuration:5,range:370,mana:10,cooldown:4.5}),
   S('Passo do Rastreador','dash','Desliza 112 px para o cursor e dispara para trás uma flecha de 106% do Poder.',{power:106,dash:112,backshot:true,range:300,mana:13,cooldown:7}),
   S('Armadilha Serrilhada','trap','Instala dentes em 86 px, causa 138% do Poder e sangramento de 21% por 4 segundos.',{power:138,radius:86,dot:21,dotDuration:4,slow:.25,slowDuration:3,mana:17,cooldown:9}),
   S('Camuflagem de Folha','shield','Some entre folhas por 1,25 segundo, cura 8% da vida e ganha 24% de velocidade por 3 segundos.',{invuln:1.25,healPct:.08,buffSpeed:.24,duration:3,mana:20,cooldown:12}),
   S('Tiro Perfurante','beam','Perfura uma linha de 410 px, atingindo até quatro inimigos por 184% com queda de 15% por alvo.',{power:184,range:410,line:true,maxTargets:4,chainFalloff:.85,mana:24,cooldown:7.8}),
   S('Olho do Predador','buff','Por 7 segundos, recebe 26% de Poder e 18% de crítico contra o alvo marcado mais próximo.',{buffPower:.26,critBonus:.18,duration:7,mana:28,cooldown:17}),
   S('Rajada Caçadora','volley','Dispara cinco flechas em leque; cada uma causa 54% do Poder e a central aplica lentidão.',{power:54,hits:5,spread:.38,slow:.22,slowDuration:2.5,range:360,mana:32,cooldown:10}),
   S('Cerco Silencioso','trap','Cria três armadilhas em triângulo de 118 px; cada detona por 92% sem alertar alvos distantes.',{power:92,hits:3,radius:118,trapDuration:6,mana:36,cooldown:14}),
   S('Abate Implacável','execute','Dispara 286% do Poder; contra alvo isolado abaixo de 34%, repete o disparo com 80% da força.',{power:286,execute:.34,executeBonus:.8,isolationRadius:130,range:390,mana:44,cooldown:16}),
   S('Caçada da Lua Rubra','ultimate','Cinemática: a lua marca até oito presas e cada uma recebe uma flecha espectral de 138% do Poder.',{power:138,maxTargets:8,radius:330,cinematic:true,mana:60,cooldown:30})
  ]),
  D('tempestade','Domínio da Tempestade','Mobilidade aérea, vento e saturação de projéteis.','#69c7d2',[
   S('Flecha de Vento','projectile','Lança uma flecha de pressão por 136% e cria um corte de vento lateral de 62% em 70 px.',{power:136,splashRadius:70,splashFactor:.46,range:380,mana:11,cooldown:4.8}),
   S('Recuo Aéreo','dash','Salta 104 px para longe do cursor e deixa duas flechas cruzadas de 88% no ponto abandonado.',{power:88,dash:-104,hits:2,originBlast:68,mana:14,cooldown:7.4}),
   S('Círculo de Plumas','selfArea','Gira oito plumas em 108 px, cada inimigo recebe 148% e perde 20% de velocidade por 2 segundos.',{power:148,radius:108,slow:.20,slowDuration:2,mana:18,cooldown:8.8}),
   S('Brisa Restauradora','heal','Recupera 19% da vida, 14% da mana e deixa um vento que acelera o arqueiro em 18% por 4 segundos.',{healPct:.19,manaPct:.14,buffSpeed:.18,duration:4,mana:21,cooldown:13}),
   S('Rajada Ciclônica','volley','Dispara três projéteis curvos de 76%; o terceiro cria um vórtice de 92 px.',{power:76,hits:3,radius:92,lastHitBonus:.35,range:370,mana:25,cooldown:9}),
   S('Passos do Vendaval','buff','Por 8 segundos, recebe 38% de velocidade e deixa lâminas de vento de 34% a cada segundo.',{buffSpeed:.38,trailDamage:34,duration:8,radius:48,mana:29,cooldown:18}),
   S('Nuvem de Setas','cursorArea','Chove nove flechas em 164 px; cada inimigo sofre três impactos de 72% do Poder.',{power:72,hits:3,projectiles:9,radius:164,mana:34,cooldown:13.5}),
   S('Olho do Furacão','shield','Cria um olho calmo por 1,55 segundo e devolve 16% da mana para cada inimigo dentro de 130 px.',{invuln:1.55,manaPerTargetPct:.16,radius:130,mana:39,cooldown:17}),
   S('Trovão Perfurante','execute','Uma flecha-relâmpago causa 312% e encadeia 52% a até três alvos; executa abaixo de 28%.',{power:312,maxTargets:4,chainFalloff:.52,execute:.28,executeBonus:.55,range:420,mana:47,cooldown:18}),
   S('Monção Celeste','ultimate','Cinemática: uma monção cobre 310 px com dez ondas de flechas e raios de 76% do Poder.',{power:76,hits:10,radius:310,slow:.35,slowDuration:4,cinematic:true,mana:60,cooldown:30})
  ])
 ],
 Assassin:[
  D('sangue','Domínio de Sangue','Hemorragia, risco calculado e execução próxima.','#f05d72',[
   S('Talho Rubro','target','Abre um corte de 134% e uma hemorragia crescente de 12%, 18% e 24% em três pulsos.',{power:134,dot:18,dotDuration:3,dotRamp:true,range:82,mana:10,cooldown:4.6}),
   S('Sede Vital','target','Morde a essência por 118% e converte 42% do dano real em vida para o assassino.',{power:118,lifeSteal:.42,range:86,mana:13,cooldown:6.5}),
   S('Passo Hemático','dash','Dissolve-se por 136 px e corta origem e destino por 92% do Poder em áreas de 54 px.',{power:92,dash:136,originBlast:54,radius:54,doubleBlast:true,mana:17,cooldown:8}),
   S('Pacto Escarlate','sacrifice','Sacrifica 8% da vida atual para recuperar 34% da mana e obter 24% de Poder por 5 segundos.',{selfDamagePct:.08,manaPct:.34,buffPower:.24,duration:5,mana:0,cooldown:13}),
   S('Lâmina da Artéria','target','Perfura por 188% e faz o alvo receber 20% mais dano de hemorragias durante 6 segundos.',{power:188,bleedAmp:.20,statusDuration:6,range:84,mana:23,cooldown:8.4}),
   S('Névoa Carmesim','selfArea','Espalha sangue em 116 px, causa 62% por quatro pulsos e cura 7% por inimigo atingido.',{power:62,hits:4,radius:116,healPerTargetPct:.07,mana:28,cooldown:11}),
   S('Frenesi Sanguíneo','buff','Por 7 segundos, ganha 32% de Poder e 22% de velocidade, mas consome 2% da vida por segundo.',{buffPower:.32,buffSpeed:.22,selfDotPct:.02,duration:7,mana:31,cooldown:18}),
   S('Marca da Hemorragia','mark','Marca o inimigo por 8 segundos; ao fim, explode 36% de todo dano recebido em 82 px.',{power:104,mark:1.18,statusDuration:8,delayedBurst:.36,radius:82,range:90,mana:36,cooldown:15}),
   S('Ceifa do Coração','execute','Golpeia por 324%; abaixo de 36%, consome a marca e acrescenta 95% sem exigir crítico.',{power:324,execute:.36,executeBonus:.95,consumeMark:true,range:88,mana:45,cooldown:17}),
   S('Eclipse de Sangue','ultimate','Cinemática: um eclipse pulsa seis cortes de 112% em 260 px e devolve 28% de todo dano como vida.',{power:112,hits:6,radius:260,lifeSteal:.28,cinematic:true,mana:60,cooldown:30})
  ]),
  D('bruxo','Domínio de Bruxo','Maldições, sombras e pactos do vazio.','#b27adf',[
   S('Agulha Sombria','projectile','Uma agulha invisível causa 128% e aplica uma maldição de 15% por 5 segundos.',{power:128,dot:15,dotDuration:5,range:300,mana:11,cooldown:5}),
   S('Selo Maldito','trap','Grava 98 px no cursor; a vítima sofre 126%, perde 28% de velocidade e fica revelada por 6 segundos.',{power:126,radius:98,slow:.28,slowDuration:6,trapDuration:7,mana:15,cooldown:9}),
   S('Travessia Umbral','teleport','Atravessa 164 px pelo vazio, torna-se invulnerável por 0,55 segundo e corta por 88% na saída.',{power:88,dash:164,radius:52,invuln:.55,mana:19,cooldown:8.8}),
   S('Pele do Vazio','shield','Absorve o mundo por 1,7 segundo e converte 22% da mana máxima em cura imediata.',{invuln:1.7,healFromMana:.22,mana:24,cooldown:14}),
   S('Garras do Familiar','summon','Invoca um familiar para três garras de 72%; a última silencia o alvo por 0,8 segundo.',{power:72,hits:3,stun:.8,range:285,mana:28,cooldown:10}),
   S('Círculo Profano','cursorArea','Consagra 138 px ao vazio por 182% e drena 6% de vida por inimigo atingido.',{power:182,radius:138,healPerTargetPct:.06,mana:32,cooldown:12}),
   S('Transe da Bruxa','buff','Por 8 segundos, recebe 30% de Poder e seus efeitos contínuos pulsam 35% mais rápido.',{buffPower:.30,dotRate:.35,duration:8,mana:36,cooldown:19}),
   S('Prisão das Sombras','tether','Acorrenta até três alvos em 150 px, causa 146% e paralisa todos por 1,45 segundo.',{power:146,radius:150,maxTargets:3,stun:1.45,mana:41,cooldown:16}),
   S('Veredito do Abismo','execute','O abismo julga por 338%; abaixo de 31%, deixa uma sombra que repete 68% após um segundo.',{power:338,execute:.31,executeBonus:.68,delayedHit:1,range:305,mana:49,cooldown:19}),
   S('Sabá da Noite Eterna','ultimate','Cinemática: sete sigilos cercam 290 px, cada um causa 94% e prolonga maldições em 5 segundos.',{power:94,hits:7,radius:290,extendDots:5,cinematic:true,mana:60,cooldown:30})
  ])
 ],
 Paladine:[
  D('juramento','Domínio do Juramento Solar','Luz ofensiva, cura e sentenças solares.','#f1c75f',[
   S('Golpe Juramentado','target','Marca o juramento com 126% do Poder e cura 6% da vida se o alvo já estiver ferido.',{power:126,conditionalHealPct:.06,range:84,mana:11,cooldown:5}),
   S('Luz Reparadora','heal','Restaura 26% da vida e cria duas faíscas que recuperam 10% da mana ao longo de 3 segundos.',{healPct:.26,manaPct:.10,regenDuration:3,mana:15,cooldown:11}),
   S('Investida Solar','dash','Avança 132 px em um raio solar, causando 148% em 62 px e cegando o movimento por 0,6 segundo.',{power:148,dash:132,radius:62,stun:.6,mana:18,cooldown:8}),
   S('Voto de Proteção','shield','Cumpre um voto de 1,65 segundo e recebe cura equivalente a 11% da vida máxima ao terminar.',{invuln:1.65,healPct:.11,delayedHeal:true,mana:22,cooldown:13}),
   S('Lança de Lúmen','projectile','Arremessa luz por 192%; atravessa o alvo e retorna, causando mais 58% no caminho inverso.',{power:192,returnHit:.58,range:340,mana:26,cooldown:8.6}),
   S('Consagração','selfArea','Consagra 134 px por três pulsos de 58% e recupera 5% de vida a cada inimigo purificado.',{power:58,hits:3,radius:134,healPerTargetPct:.05,mana:30,cooldown:12}),
   S('Fervor do Justo','buff','Por 7 segundos, ganha 25% de Poder, 14% de defesa e converte críticos em 4% de mana.',{buffPower:.25,buffDefense:.14,critManaPct:.04,duration:7,mana:34,cooldown:18}),
   S('Círculo do Alvorecer','cursorArea','Desenha um sol de 152 px no cursor, causa 226% e restaura 12% da vida se houver três inimigos.',{power:226,radius:152,conditionalTargets:3,healPct:.12,mana:39,cooldown:14}),
   S('Julgamento Final','execute','Julga por 314%; abaixo de 33%, um segundo feixe de 72% cai sem custo adicional.',{power:314,execute:.33,executeBonus:.72,range:310,mana:47,cooldown:18}),
   S('Ascensão do Sol Eterno','ultimate','Cinemática: ascende um sol dourado com oito raios de 84% em 295 px e cura 32% da vida.',{power:84,hits:8,radius:295,healPct:.32,cinematic:true,mana:60,cooldown:30})
  ]),
  D('egide','Domínio da Égide Sagrada','Proteção, represália e arquitetura celestial.','#e9df9a',[
   S('Escudo Luminar','shield','Projeta um disco por 1,2 segundo, restaura 8% de mana e causa 72% em 58 px ao desaparecer.',{invuln:1.2,manaPct:.08,power:72,radius:58,exitBlast:true,mana:12,cooldown:9.5}),
   S('Represália Sagrada','counter','Prepara uma resposta por 2 segundos; libera imediatamente 168% do Poder no alvo mais próximo.',{power:168,counterWindow:2,range:120,mana:16,cooldown:9}),
   S('Prece Restauradora','heal','Canaliza uma prece de quatro pulsos, totalizando 32% de vida e 16% de mana recuperadas.',{healPct:.32,manaPct:.16,healPulses:4,mana:19,cooldown:14}),
   S('Passo do Guardião','dash','Avança 96 px, deixa um selo protetor na origem e ganha 0,8 segundo de invulnerabilidade.',{dash:96,invuln:.8,originWard:5,radius:64,mana:22,cooldown:9.5}),
   S('Aura da Égide','selfArea','A aura golpeia 122 px por 142% e reduz o ataque dos inimigos em 24% durante 5 segundos.',{power:142,radius:122,weaken:.24,weakenDuration:5,mana:27,cooldown:11}),
   S('Vigília Inquebrável','buff','Por 8 segundos, recebe 30% de defesa e cura 3% da vida sempre que resiste a um controle.',{buffDefense:.30,resistHealPct:.03,unstoppable:true,duration:8,mana:31,cooldown:20}),
   S('Martelo da Aurora','cursorArea','Um martelo cai em 116 px por 248% e abre quatro linhas solares de 44% para fora.',{power:248,radius:116,rays:4,rayPower:44,mana:36,cooldown:14}),
   S('Santuário Radiante','sanctuary','Ergue um santuário de 146 px por 6 segundos, curando 6% de vida e 4% de mana por pulso.',{healPct:.06,manaPct:.04,healPulses:4,radius:146,duration:6,mana:41,cooldown:21}),
   S('Sentença Divina','execute','Invoca uma espada de 326%; abaixo de 37%, o alvo recebe silêncio de 2 segundos e mais 64%.',{power:326,execute:.37,executeBonus:.64,stun:2,range:300,mana:49,cooldown:19}),
   S('Bastião Celestial','ultimate','Cinemática: uma cidadela de luz fecha 305 px, pulsa cinco vezes por 108% e concede 2,4 segundos de proteção.',{power:108,hits:5,radius:305,invuln:2.4,cinematic:true,mana:60,cooldown:30})
  ])
 ]
};
function idFor(classId,domain,index){return `${classId.toLowerCase()}_${domain}_${String(index+1).padStart(2,'0')}`;}
function build(){const classes={};for(const[classId,domains]of Object.entries(RAW)){classes[classId]={classId,domains:domains.map((domain,domainIndex)=>({...domain,skills:domain.skills.map((row,index)=>{const tier=index+1,id=idFor(classId,domain.code,index),mechanics=Object.freeze({...row.mechanics});return Object.freeze({id,classId,domain:domain.code,domainName:domain.name,domainColor:domain.color,tier,name:row.name,effect:row.mode,mode:row.mode,power:Number(mechanics.power)||0,level:LEVELS[index],cost:COSTS[index],gold:GOLD[index],mana:Number(mechanics.mana)||0,cooldown:Number(mechanics.cooldown)||30,description:row.description,mechanics,visualKey:id,visualVariant:domainIndex*10+index,ultimate:tier===10});})}))};}return classes;}
const CLASSES=build();
function list(classId){return CLASSES[classId]?.domains.flatMap(domain=>domain.skills)||[];}
function get(skillId){for(const group of Object.values(CLASSES))for(const domain of group.domains){const skill=domain.skills.find(row=>row.id===skillId);if(skill)return skill;}return null;}
function purchaseEligibility({skill,level=1,available=0,gold=0,learned=[]}){if(!skill)return{ok:false,reason:'skill_missing'};const owned=learned instanceof Set?learned:new Set(learned);if(owned.has(skill.id))return{ok:false,reason:'skill_already_learned'};if(Number(level)<skill.level)return{ok:false,reason:'skill_level_required'};if(Number(available)<skill.cost)return{ok:false,reason:'skill_points_insufficient'};if(skill.ultimate){const domain=CLASSES[skill.classId]?.domains.find(row=>row.code===skill.domain);if(domain?.skills.slice(0,9).some(row=>!owned.has(row.id)))return{ok:false,reason:'skill_domain_incomplete'};if(Number(gold)<skill.gold)return{ok:false,reason:'skill_gold_insufficient'};}return{ok:true,reason:null};}
global.AstraeonSkillsCatalogV1=Object.freeze({VERSION:'2.0',LEVELS,COSTS,GOLD,CLASSES,list,get,idFor,purchaseEligibility});
})(window);

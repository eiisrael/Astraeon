import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const interaction = read('src/game-interaction-v1.js');

// A rotação do clique direito precisa consultar o loadout real e nunca ficar presa em slot vazio.
assert.match(interaction, /function macroLoadout\(\)/, 'O macro deve ler o loadout real do sistema de skills.');
assert.match(interaction, /global\.AstraeonSkillsV1\?\.state\?\.loadout/, 'O loadout equipado deve ser a fonte dos slots do macro.');
assert.match(interaction, /if\(!loadout\|\|!loadout\[index\]\|\|!game\?\.player\)return false;/, 'Slot vazio deve ser considerado indisponível.');
assert.match(interaction, /function nextMacroSlot\(game,from,usableOnly=true\)/, 'O macro deve procurar o próximo slot equipado.');
assert.match(interaction, /if\(!loadout\[index\]\)continue;/, 'A procura deve ignorar explicitamente slots vazios.');
assert.match(interaction, /macro\?\.rightHeld&&loadout&&!loadout\[slot\]/, 'O redirecionamento deve ocorrer somente durante a rotação do botão direito.');
assert.match(interaction, /let next=nextMacroSlot\(this,slot,true\);/, 'O macro deve priorizar a próxima skill realmente utilizável.');
assert.match(interaction, /if\(next<0\)next=nextMacroSlot\(this,slot,false\);/, 'Sem skill pronta, o cursor deve permanecer em uma skill equipada para tentar novamente.');
assert.match(interaction, /macro\.skillCursor=\(next\+1\)%loadout\.length;/, 'Depois de uma skill usada, a rotação deve continuar no próximo slot.');

// O HUD flutuante de HP/MP/STAM não pode ser alterado por esta tarefa.
for (const token of ["['#810c2c','#ff2857','#ff7890']", "['#073caa','#138dff','#45e4ff']", "['#9a4b04','#ffae16','#fff06a']"]) {
  assert.ok(interaction.includes(token), `As cores existentes do HUD flutuante devem ser preservadas: ${token}`);
}

// Jornada principal: visual medieval, dados reais e colapso independente do transform do Studio.
assert.match(interaction, /function installQuestHud\(\)/, 'O HUD medieval de quests deve possuir instalador próprio.');
assert.match(interaction, /style\.dataset\.astraeonQuestHudV1='1'/, 'O tema da quest deve ser injetado uma única vez.');
assert.match(interaction, /JORNADA PRINCIPAL/, 'O painel deve identificar a jornada principal.');
assert.match(interaction, /I · ECOS DA CONVERGÊNCIA/, 'O painel deve apresentar o capítulo da missão.');
assert.match(interaction, /id='questKillsDetail'/, 'O painel deve informar o progresso de criaturas.');
assert.match(interaction, /id='questBiomesDetail'/, 'O painel deve informar o progresso de biomas.');
assert.match(interaction, /id='questProgressDetail'/, 'O painel deve informar o percentual total da jornada.');
assert.match(interaction, /RECOMPENSA RECEBIDA/, 'O HUD deve sinalizar quando a recompensa já foi entregue.');
assert.match(interaction, /Núcleo de Astraeon/, 'A recompensa de item existente deve continuar informada.');
assert.match(interaction, /\+120/, 'A recompensa de ouro existente deve continuar informada.');
assert.match(interaction, /QUEST_PANEL_STATE_KEY='astraeon:v4:quest-panel-collapsed'/, 'O estado recolhido da quest deve ser persistido.');
assert.match(interaction, /quest-panel-toggle/, 'O painel deve ter uma aba para recolher e expandir.');
assert.match(interaction, /aria-expanded/, 'O botão de colapso deve manter estado acessível.');
assert.match(interaction, /\.quest-card\.quest-panel-collapsed\{translate:calc\(100% \+ 13px\) 0!important\}/, 'O recolhimento desktop deve usar translate e deixar a aba acessível.');
assert.doesNotMatch(interaction, /\.quest-card\.quest-panel-collapsed\{transform:/, 'O colapso da quest não deve disputar transform com o Panel Studio.');
assert.match(interaction, /card\.style\.setProperty\('overflow','visible','important'\)/, 'A aba externa da quest não pode ser recortada pelo Studio.');
assert.match(interaction, /const progress=Math\.min\(100,\(\(kills\/goal\)\*\.7\+\(explored\/3\)\*\.3\)\*100\);/, 'O percentual visual deve manter exatamente a ponderação atual da missão.');

console.log('SKILL MACRO EMPTY SLOT + MEDIEVAL QUEST HUD validation OK');

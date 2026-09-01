import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const hudCss = read('src/player-hud-v2.css');
const game = read('src/game-v2.js');
const interaction = read('src/game-interaction-v1.js');
const controller = read('src/online-controller-v4.js');
const runtime = read('src/panel-studio-runtime-v7.js');
const editorCss = read('src/admin-panel-editor-v8.css');
const editorJs = read('src/admin-panel-editor-v8.js');
const fitCss = read('src/panel-fit-v1.css');

for (const label of ['HP', 'MP', 'STAM']) {
  assert.match(index, new RegExp(`<span>${label}<\\/span>`), `O HUD deve exibir ${label}.`);
}
assert.match(index, /id="playerHudPortrait"/, 'O HUD deve renderizar o retrato da classe.');
assert.match(index, /id="xpText"/, 'O HUD deve exibir a progressão percentual de XP.');
assert.match(index, /src\/player-hud-v2\.css/, 'O tema profissional do HUD deve carregar no jogo.');
assert.match(game, /Assets\/Classes\/\$\{W\.CLASS_DATA\[p\.classId\]\.sprite\}/, 'O retrato deve acompanhar a classe selecionada.');
assert.match(game, /ui\.xpText\.textContent/, 'O percentual de XP deve ser atualizado pelo runtime.');
assert.match(hudCss, /@keyframes hud-xp-scan/, 'A barra de XP deve manter o efeito neon dinâmico.');
assert.match(hudCss, /\.player-hud-portrait img[\s\S]*object-fit:contain/, 'O retrato não pode ser cortado ou distorcido.');
assert.match(hudCss, /\.player-title strong\{[\s\S]*font:700 11px/, 'O nick do HUD principal deve usar uma fonte menor para caber por inteiro.');

assert.match(interaction, /installHudIdentitySync/, 'O HUD principal deve sincronizar somente o nick do personagem.');
assert.match(interaction, /char\.textContent!==nick/, 'A classe não deve permanecer concatenada ao nick no HUD principal.');
assert.match(interaction, /installStaminaLabelGuard/, 'A legenda de stamina deve ser protegida contra nomes de estado de corrida.');
assert.match(interaction, /label\.textContent!=='STAM'/, 'A legenda do recurso deve permanecer apenas STAM.');

assert.match(interaction, /installPlayerWorldHud/, 'O segundo HUD deve ser instalado junto ao personagem no mundo.');
assert.match(interaction, /originalDrawPlayer/, 'O segundo HUD deve preservar o desenho original do personagem.');
assert.match(interaction, /player\.name=''/, 'O nome antigo do canvas deve ser suprimido durante o desenho para não duplicar o nome.');
assert.match(interaction, /Number\(p\.hp\)\/hpMax/, 'A barra vermelha deve acompanhar o HP real do personagem.');
assert.match(interaction, /Number\(p\.mana\)\/manaMax/, 'A barra azul deve acompanhar a mana real do personagem.');
assert.match(interaction, /Number\(game\.stamina\)/, 'A barra dourada deve acompanhar o fôlego real do personagem.');
assert.match(interaction, /'#ff2857'/, 'HP deve usar vermelho gamer no HUD flutuante.');
assert.match(interaction, /'#138dff'/, 'Mana deve usar azul elétrico no HUD flutuante.');
assert.match(interaction, /'#ffae16'/, 'Fôlego deve usar dourado gamer no HUD flutuante.');
assert.match(interaction, /`  \(Lv: \$\{level\}\)`/, 'O HUD flutuante deve exibir o nível real ao lado do nick.');
assert.match(interaction, /color:'#ffd35a'/, 'O nível deve ser dourado.');
assert.match(interaction, /text:'  Personagem',color:'#f7fbff'/, 'A identificação Personagem deve aparecer em branco.');
assert.match(interaction, /const top=p\.y-64/, 'As três barras devem ficar imediatamente acima do personagem.');

assert.match(controller, /installPlayerPanelToggle/, 'O HUD precisa manter o controle de recolher e expandir.');
assert.match(controller, /aria-expanded/, 'O estado do HUD recolhido deve ser acessível.');
assert.match(hudCss, /\.player-card\.player-panel-collapsed\{translate:calc\(-100% - 13px\) 0!important\}/, 'O recolhimento deve usar translate independente do transform do Studio.');
assert.doesNotMatch(hudCss, /\.player-card\.player-panel-collapsed\{transform:/, 'O recolhimento não deve disputar a propriedade transform com o Studio.');

assert.doesNotMatch(runtime, /important\(element,'overflow','auto'\)/, 'O Studio nunca deve salvar scroll no painel do jogo.');
assert.match(runtime, /important\(element,'overflow',element\.matches\('#hud \.player-card'\)\?'visible':'hidden'\)/, 'Painéis devem ocultar overflow sem encobrir a aba externa do HUD.');
assert.match(runtime, /important\(element,'transform',M\.transform\(panel\)\)/, 'O Studio pode manter seu próprio transform sem bloquear o translate do recolhimento.');
assert.match(runtime, /AstraeonPanelFitV1\?\.schedule/, 'Alterações do Studio devem recalcular o encaixe responsivo.');
assert.match(editorCss, /\.pse-canvas\{[\s\S]*overflow:hidden/, 'O canvas do Studio não pode criar uma janela com scroll.');
assert.match(editorJs, /safeWidth\/width/, 'O preview do Studio deve ajustar a largura ao espaço disponível.');
assert.match(editorJs, /safeHeight\/height/, 'O preview do Studio deve ajustar a altura ao espaço disponível.');
assert.match(fitCss, /\.inventory-column[\s\S]*overflow:\s*hidden\s*!important/, 'Conteúdo interno dos painéis não deve criar scroll secundário.');

console.log('ASTRAEON PLAYER HUD READABILITY + WORLD HUD GAMER + COLLAPSE validation OK');

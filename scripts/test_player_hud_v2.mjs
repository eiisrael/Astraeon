import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const hudCss = read('src/player-hud-v2.css');
const game = read('src/game-v2.js');
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
assert.match(hudCss, /\.player-card \.player-title\{[^}]*align-self:start/, 'O nome do personagem deve permanecer elevado no cabeçalho.');
assert.match(hudCss, /\.player-card \.bar-line:not\(\.xp-line\)\{[^}]*position:absolute/, 'HP, mana e fôlego devem ocupar a coluna abaixo do nome sem invadir o retrato.');
assert.match(hudCss, /content:"MANA"/, 'O recurso azul deve ser identificado visualmente como MANA.');
assert.match(hudCss, /content:"FÔLEGO"/, 'O recurso de stamina deve ser identificado visualmente como FÔLEGO.');
assert.match(controller, /installPlayerPanelToggle/, 'O HUD precisa manter o controle de recolher e expandir.');
assert.match(controller, /aria-expanded/, 'O estado do HUD recolhido deve ser acessível.');

assert.doesNotMatch(runtime, /important\(element,'overflow','auto'\)/, 'O Studio nunca deve salvar scroll no painel do jogo.');
assert.match(runtime, /important\(element,'overflow',element\.matches\('#hud \.player-card'\)\?'visible':'hidden'\)/, 'Painéis devem ocultar overflow sem encobrir a aba externa do HUD.');
assert.match(runtime, /AstraeonPanelFitV1\?\.schedule/, 'Alterações do Studio devem recalcular o encaixe responsivo.');
assert.match(editorCss, /\.pse-canvas\{[\s\S]*overflow:hidden/, 'O canvas do Studio não pode criar uma janela com scroll.');
assert.match(editorJs, /safeWidth\/width/, 'O preview do Studio deve ajustar a largura ao espaço disponível.');
assert.match(editorJs, /safeHeight\/height/, 'O preview do Studio deve ajustar a altura ao espaço disponível.');
assert.match(fitCss, /\.inventory-column[\s\S]*overflow:\s*hidden\s*!important/, 'Conteúdo interno dos painéis não deve criar scroll secundário.');

console.log('ASTRAEON PLAYER HUD V2 + NO-SCROLL PANELS validation OK');

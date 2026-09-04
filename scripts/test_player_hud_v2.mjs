import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const index = read('index.html');
const hudCss = read('src/player-hud-v2.css');
const onlineFixesCss = read('src/online-fixes-v4.css');
const game = read('src/game-v2.js');
const interaction = read('src/game-interaction-v1.js');
const catalog = read('src/skills-catalog-v1.js');
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
assert.match(interaction, /'#ff2857'/, 'HP deve manter o vermelho gamer atual no HUD flutuante.');
assert.match(interaction, /'#138dff'/, 'Mana deve manter o azul elétrico atual no HUD flutuante.');
assert.match(interaction, /'#ffae16'/, 'Fôlego deve manter o dourado gamer atual no HUD flutuante.');
assert.match(interaction, /text:`\(Lv\.: \$\{level\}\) `,color:'#ffd35a'/, 'O nível deve aparecer primeiro no formato (Lv.: X) e em dourado.');
assert.match(interaction, /\{text:name,color:'#f7fbff'\}/, 'O nick deve aparecer imediatamente depois do nível e em branco.');
assert.doesNotMatch(interaction, /text:'\s*Personagem'/, 'A palavra Personagem não deve mais aparecer na identidade flutuante.');
assert.match(interaction, /const top=p\.y-64/, 'As três barras devem permanecer na posição atual acima do personagem.');

assert.match(interaction, /PLAYER_BUFF_KEYS/, 'O HUD deve reconhecer efeitos temporários positivos além do modo buff literal.');
assert.match(interaction, /function buffDuration\(skill\)/, 'O runtime deve identificar a duração real dos buffs.');
assert.match(interaction, /function classBuffCapacity\(classId\)/, 'A capacidade do HUD deve ser calculada pela referência de buffs da classe.');
assert.match(interaction, /catalog\?\.list\?\.\(classId\)/, 'A capacidade deve consultar o catálogo real de skills da classe.');
assert.match(interaction, /Math\.min\(5,count\|\|1\)/, 'A faixa deve suportar até cinco buffs simultâneos sem sair da área reservada.');
assert.match(interaction, /installPlayerBuffHud/, 'O HUD principal deve instalar o monitor de buffs ativos.');
assert.match(interaction, /originalCastSkill/, 'O monitor de buffs deve preservar o cast original de skills.');
assert.match(interaction, /before<=0&&after>0/, 'Um buff só deve entrar no HUD após um cast realmente aceito.');
assert.match(interaction, /activePlayerBuffs\.set\(skill\.id/, 'Buffs ativos devem ser registrados individualmente por skill.');
assert.match(interaction, /buff\.until<=now/, 'Buffs expirados devem desaparecer automaticamente do HUD.');
assert.match(interaction, /remaining\/entry\.duration\*100/, 'Cada buff deve exibir progresso visual do tempo restante.');
assert.match(catalog, /S\('Camuflagem de Folha'[\s\S]*buffSpeed:\.24,duration:3/, 'Buffs concedidos por skills híbridas devem existir na referência do catálogo.');
assert.match(catalog, /S\('Pacto Escarlate'[\s\S]*buffPower:\.24,duration:5/, 'Buffs de skills de sacrifício também devem ser reconhecíveis pela referência.');
assert.match(hudCss, /\.player-card \.player-buffs\{[\s\S]*max-width:148px/, 'A faixa de buffs deve ocupar a área inferior esquerda sem invadir os metadados.');
assert.match(hudCss, /\.player-card \.player-buff-icon\{[\s\S]*--buff-color/, 'Cada buff deve ser apresentado como ícone gamer colorido pelo domínio.');
assert.match(hudCss, /width:var\(--buff-progress\)/, 'O ícone deve mostrar visualmente o tempo restante do buff.');

assert.match(controller, /installPlayerPanelToggle/, 'O HUD precisa manter o controle de recolher e expandir.');
assert.match(controller, /aria-expanded/, 'O estado do HUD recolhido deve ser acessível.');
assert.match(hudCss, /\.player-card\.player-panel-collapsed\{translate:calc\(-100% - 13px\) 0!important\}/, 'O recolhimento deve usar translate independente do transform do Studio.');
assert.doesNotMatch(hudCss, /\.player-card\.player-panel-collapsed\{transform:/, 'O recolhimento não deve disputar a propriedade transform com o Studio.');
assert.doesNotMatch(onlineFixesCss, /\.player-card\.player-panel-collapsed\{transform:/, 'Overrides legados não podem somar transform ao translate do HUD recolhido.');
assert.match(onlineFixesCss, /\.player-card\.player-panel-collapsed\{translate:calc\(-100% - 8px\) 0!important\}/, 'O fallback de recolhimento deve usar a mesma propriedade translate do HUD atual.');

assert.doesNotMatch(runtime, /important\(element,'overflow','auto'\)/, 'O Studio nunca deve salvar scroll no painel do jogo.');
assert.match(runtime, /important\(element,'overflow',element\.matches\('#hud \.player-card'\)\?'visible':'hidden'\)/, 'Painéis devem ocultar overflow sem encobrir a aba externa do HUD.');
assert.match(runtime, /important\(element,'transform',M\.transform\(panel\)\)/, 'O Studio pode manter seu próprio transform sem bloquear o translate do recolhimento.');
assert.match(runtime, /AstraeonPanelFitV1\?\.schedule/, 'Alterações do Studio devem recalcular o encaixe responsivo.');
assert.match(editorCss, /\.pse-canvas\{[\s\S]*overflow:hidden/, 'O canvas do Studio não pode criar uma janela com scroll.');
assert.match(editorJs, /safeWidth\/width/, 'O preview do Studio deve ajustar a largura ao espaço disponível.');
assert.match(editorJs, /safeHeight\/height/, 'O preview do Studio deve ajustar a altura ao espaço disponível.');
assert.match(fitCss, /\.inventory-column[\s\S]*overflow:\s*hidden\s*!important/, 'Conteúdo interno dos painéis não deve criar scroll secundário.');

console.log('ASTRAEON PLAYER BUFF HUD + WORLD IDENTITY ORDER + COLLAPSE validation OK');

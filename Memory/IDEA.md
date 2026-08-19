# IDEA.MD — MMORPG WEB PROCEDURAL (SINGLE-FILE HTML / ASTRAEON)

## 1. VISÃO GERAL DO PROJETO
* **Nome do Projeto:** ASTRAEON (ou ChronoRealm ASTRAEON)
* **Formato:** Single File (`index.html`) com suporte a Editor Visual Low-Code (`game-editor.html`). Zero dependências externas e execução offline.
* **Paradigma:** RPG de Mundo Aberto Procedural 2D Top-Down renderizado via Canvas 2D, com interface rica em HTML/CSS.
* **Público-Alvo/Objetivo:** Experiência jogável de MMORPG em navegador offline, com salvamento local, biomas gerados em tempo real, ciclo de dia/noite e eventos dinâmicos.

---

## 2. PILARES DE DESIGN & ARQUITETURA DE JOGO

### 2.1. Mundo Aberto & Geração Procedural
* **Seed Determinística:** Utilização de um PRNG (Pseudo-Random Number Generator baseada em LCG) alimentado por `seed` (configurável e persistente).
* **Biomas & Terrenos:** Geração de gradientes e ruídos via fbm (Fractional Brownian Motion) e interpolação de ruído suave (smooth noise) para biomas:
  - *Vila Inicial (Safezone/Village)* -> *Floresta Sombria (Forest)* -> *Planície (Plain)* -> *Montanha (Mountain)* -> *Deserto (Desert)* -> *Pântano (Swamp)* -> *Neve (Snow)* -> *Vulcão (Volcano)* -> *Ruínas (Ruins)* -> *Água (Water)*.
* **Culling & Render Distance:** Processamento restrito à viewport (câmera centralizada no jogador) para manter 60 FPS.
* **Fog of War Persistent:** Revelação progressiva do mapa baseada em coordenadas de chunks descobertos (`cx:cy`), salvos no `Set` de descobertas e persistidos no `localStorage`.

### 2.2. Entidades & Ecossistema
* **IA de Inimigos (FSM - Finite State Machine):**
  - Estados: `IDLE` | `PATROL` | `CHASE` | `ATTACK` | `DEAD`.
  - Inimigos normais com atributos escalados por nível (HP, ATK, DEF, SPD, XP) baseados na distância da Vila.
  - Spawns noturnos com bônus de agressividade e atributos aumentados.
* **NPCs Interativos (Localizados na Vila):**
  - **Eldrin, o Ancião** (tipo `quest` • X: 70, Y: -40): Gerenciador de missões (Active -> Completed -> Claimed).
  - **Mira, Mercadora** (tipo `merchant` • X: 135, Y: 35): Compra de armas iniciais e venda de itens coletados na bolsa.
  - **Brom, Ferreiro** (tipo `smith` • X: 135, Y: -35): Sistema de reparo total de vitalidade e equipamentos baseado na vida perdida.
  - **Lyra, Curandeira** (tipo `healer` • X: -75, Y: 55): Cura gratuita de HP e MP.
  - **Kael, Mestre de Classe** (tipo `class` • X: -70, Y: -45): Abertura de painel de gerenciamento e troca de classes.

### 2.3. Sistema de Combate, Habilidades & Classes
* **Mecânica de Combate Dinâmico:**
  - Ataque Melee (para guerreiros/assassinos) e Projéteis à Distância (para arqueiros/magos).
  - Alcances de combate configurados dinamicamente via `GENESIS_CONFIG.systems.combat.meleeRange` (padrão: 125px).
  - Indicadores visuais de combate: área de alcance de ataque (círculo azul pontilhado "ALCANCE") e círculos vermelhos indicando perigo próximo ("PERIGO" para inimigos com alcance de ataque ativo).
  - Floating Text (números de dano/XP/cura) e Screen Shake / Hit Flash.
* **Hotbar de 8 Slots:**
  1. `Slot 1` (Tecla 1): Ataque Básico (melee ou projétil dependendo da classe).
  2. `Slot 2` (Tecla 2): Habilidade de Dano (ex: Orbe Arcano, Golpe Poderoso).
  3. `Slot 3` (Tecla 3): Bloqueio (reduz o dano sofrido em 38% por 650ms).
  4. `Slot 4` (Tecla 4): Esquiva/Rolamento (concede imunidade de frame por 0.55s).
  5. `Slot 5` (Tecla 5): Especial de Dano AoE ou Disparo Espalhado.
  6. `Slot 6` (Tecla 6): Habilidade de Cura (recupera vida baseada em Magia).
  7. `Slot 7` (Tecla 7): Dash (deslocamento rápido com imunidade temporária).
  8. `Slot 8` (Tecla 8): Ultimate (dano massivo de área com cooldown de 15s).
* **5 Classes Distintas (Selecionáveis e Alteráveis Dinamicamente):**
  - **Guerreiro:** Defesa robusta, foco em ataque físico e Golpe Poderoso.
  - **Paladino:** Híbrido com alta resistência, auras protetoras e Luz Restauradora.
  - **Mago:** Dano mágico à distância massivo via Orbe Arcano, alto MP.
  - **Arqueiro:** Alta velocidade de ataque, esquiva e projéteis com Disparo Perfurante.
  - **Assassino:** Crítico elevado, alta velocidade e dano rápido via Lâmina Sombria.

### 2.4. Loot, Inventário & Catálogo de Equipamentos
* **Tabela de Loot Procedural & Raridades:**
  - **6 Raridades:** Comum (cinza), Incomum (verde), Raro (azul), Épico (roxo), Lendário (dourado), Mítico (vermelho).
* **Slots de Equipamento:** Capacete (head), Peitoral (chest), Luvas (hands), Calças (legs), Botas (boots), Arma Principal (weapon), Escudo (shield), Acessórios (accessory).
* **Gerenciamento de Inventário (Bolsa 2.0):**
  - Painel de inventário com 24 slots, com suporte a **Drag & Drop** para equipar itens nos slots correspondentes.
  - Tooltip interativo detalhado mostrando atributos adicionados (ATK, DEF, MAG, HP, MP, CRIT, SPD, LUCK).
  - Catálogo de itens customizável via Editor Visual.

### 2.5. Ciclo de Dia/Noite & Eventos Dinâmicos
* **Iluminação Canvas:** Transição suave baseada em `gameTime` e intensidade configurada por `nightStrength`.
* **Inimigos Noturnos:** Spawn de inimigos com bônus estatístico na escuridão.
* **Eventos Aleatórios:** Transições climáticas (chuva, tempestade, céu aberto) e eventos globais temporários (Invasão de Goblins, Caravana Perdida, Tesouro Oculto, Eclipse) com overlays e toasts.

---

## 3. ESPECIFICAÇÃO TÉCNICA E ARQUITETURA DE ARQUIVOS

### 3.1. Arquitetura do Arquivo `index.html`
O jogo principal é estruturado em uma única página contendo a camada visual de Canvas 2D, HUD em HTML/CSS e dois blocos principais de scripts:
* **Bloco 1: Core Engine:** Motores de geração do mundo, movimentação de jogador, classes de entidades, combat system, áudio sintetizado, interface de painéis (inventário, personagem, missões, mapa, configurações) e loop principal (`requestAnimationFrame`).
* **Bloco 2: GENESIS Runtime Bridge:** Camada de sincronização de dados com o editor via `BroadcastChannel` (canal `"GENESIS_GAME_EDITOR"`), `localStorage` e eventos globais (`storage`), permitindo modificações de configuração sem necessidade de reload manual.

### 3.2. Persistência de Dados (`SaveSystem`)
* **Chave:** `astraeon_save`
* **Estrutura Salva (JSON):**
  ```json
  {
    "version": 1,
    "seed": 739281,
    "player": {
      "name": "Aventureiro",
      "class": "Warrior",
      "level": 1,
      "x": 0,
      "y": 0,
      "xp": 0,
      "gold": 80,
      "points": 0,
      "hp": 145,
      "mp": 35,
      "stamina": 100,
      "equipment": { ... },
      "inventory": [ ... ],
      "discovered": [ "0:0", "1:0" ]
    },
    "quest": { ... },
    "settings": { "audio": true }
  }
  ```

### 3.3. Áudio Sintetizado (`Web Audio API`)
* Sem arquivos de som externos. O sintetizador `AudioFX` / `AudioFX` constrói sons de espada, magia, dano, level up e mortes em tempo real utilizando osciladores do navegador. Pode ser ligado/desativado no menu de configurações.

### 3.4. Editor de Jogo (`game-editor.html`)
* **Editor Visual Completo:** Permite modificar o JSON de configuração do jogo em tempo real.
* **IndexedDB Integration:** Utiliza a File System Access API para salvar arquivos diretamente na máquina local, persistindo o file handle em um banco IndexedDB (`HANDLE_DB`) para carregamento automático no reinício.
* **Visualizador em tempo real:** Embutido em um iframe para testar as configurações aplicando-as imediatamente (LIVE).

---

## 4. ROTEIRO DE EXECUÇÃO & POLISH
1. **Verificação do Mundo:** Movimentação nas bordas de chunks para carregar dinamicamente estruturas e monstros sem stutter.
2. **Polimento Visual:** Efeitos de luz no Canvas para noite e tochas, partículas flutuantes nos acertos críticos e transições fluidas de tela.
3. **Editor Interface:** Importar sprites personalizados e embuti-los no arquivo do jogo via base64, garantindo portabilidade.

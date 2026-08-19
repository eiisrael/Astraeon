# ASTRAEON — MMORPG Procedural Offline & Editor Visual

Este repositório contém o projeto completo do jogo **ASTRAEON**, um MMORPG procedural offline rodando diretamente no navegador (Canvas 2D + HTML/CSS HUD) sem dependências externas, integrado a um editor visual low-code em tempo real.

---

## 📁 Estrutura do Projeto

* 📄 [**index.html**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/index.html): O executável e código-fonte principal do jogo. Contém a engine gráfica, sistemas de combate, PRNG de biomas, sintetizador Web Audio, inventário e a ponte de comunicação (`Genesis Runtime Bridge`).
* 📄 [**game-editor.html**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/game-editor.html): Editor visual low-code. Permite alterar configurações gráficas, itens catalogados, quests, NPCs, parâmetros de balanceamento (gameplay/IA) e salvar diretamente de volta no `index.html`.
* 📁 [**Assets/**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/Assets): Diretório contendo os assets gráficos (sprites PNG em 32x32):
  * 📁 [**Assets/Npc/**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/Assets/Npc): Texturas das classes (`Warrior.png`, `Paladine.png`, `Mage.png`, `Archer.png`, `Assassin.png`).
  * 📁 [**Assets/Mob/**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/Assets/Mob): Texturas das criaturas do mundo procedural (`Slime.png`, `Globin.png`, `Wolf.png`, `Squelleton.png`, `Orc.png`, `Spider.png`, `Troll.png`, `Golem_Gelo.png`, `Draconato.png`, etc.).
* 📄 [**IDEA.md**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/IDEA.md): Documento conceitual de design detalhando as mecânicas, ciclo de dia/noite, biomas, slots de equipamentos, hotbars, e especificações técnicas.
* 📄 [**SOUL.md**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/SOUL.md): Diretrizes de desenvolvimento (Hermes Framework) que regem a estabilidade, tratamento de crashes, culling, preservação de estado e regras para modificação segura dos delimitadores de configuração.

---

## 🚀 Como Executar o Jogo e o Editor

1. **Jogar:** Abra o arquivo [**index.html**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/index.html) diretamente em qualquer navegador moderno.
2. **Editar:** Abra o arquivo [**game-editor.html**](file:///c:/Users/Home/Desktop/ASTRAEON%20-%20GEMINI/game-editor.html) no navegador:
   * **Fluxo de Trabalho:**
     1. Abra o arquivo `index.html` no editor usando o botão "Abrir index.html".
     2. Modifique os parâmetros desejados nas abas (Dashboard, Gameplay, Monstros, Classes, Quests, Itens, Gráficos, Páginas, Lógicas).
     3. Clique em **"Aplicar LIVE"** para testar as mudanças instantaneamente no frame de preview lateral.
     4. Clique em **"Salvar no index.html"** para regravar permanentemente as alterações no código-fonte do jogo.

---

## ⚔️ Mecânicas & Sistemas Atuais

* **Mundo Procedural:** O mapa é gerado dinamicamente usando interpolação de ruído baseada na `seed` do jogador, dividindo o mundo em 9 biomas terrestres (com recursos exclusivos como madeira, minério, ervas, cristal) cercados por água.
* **Inventário Drag & Drop (Bolsa 2.0):** Interface de arrastar e soltar itens para os 8 slots de equipamentos, com ferramenta de tooltip exibindo atributos agregados de combate.
* **Combate com Alcance Visual:** Renderização de raio de ataque e círculos pontilhados vermelhos indicando o perigo de aggro dos monstros ao redor.
* **Barra de Habilidades (1 a 8):** Inclui ataque básico, habilidades de classe, bloqueio defensivo, esquiva invulnerável, disparos AoE, cura curativa baseada em magia, dash horizontal e habilidades do tipo ultimate.
* **Ponte GENESIS:** Sincronização em tempo real entre o editor e a instância do jogo usando `BroadcastChannel` e localStorage, permitindo testes ágeis sem perdas de save.

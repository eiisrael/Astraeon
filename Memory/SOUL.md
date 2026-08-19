# SOUL.MD — Diretrizes de Integração, Contexto e Execução Rígida (Hermes Framework)

## 1. MANTRA & FILOSOFIA DE TRABALHO
* **Execução Direta e Focada:** Trabalhe exclusivamente na tarefa solicitada. Sem devaneios, sem tentativas experimentais não homologadas, sem refatorações fora do escopo.
* **Sem Alucinação de Contexto:** Trate o escopo do arquivo/prompt como a única verdade absoluta. Não presuma infraestruturas externas ou APIs ausentes.
* **Determinismo e Estabilidade:** Priorize soluções robustas, testadas e que garantam zero regressão, zero bugs e zero crashes.

---

## 2. REGRAS ABSOLUTAS DE PRESERVAÇÃO DE LÓGICA E CONTEXTO
1. **Zero Perda de Lógica:** Nenhuma lógica de negócio existente deve ser removida, simplificada ou substituída por stubs (`// TODO`, `// implementar depois`) durante correções ou expansões.
2. **Manutenção de Estado e Transições de Fase:** Mantenha a integridade do estado da aplicação. Garantir mutações previsíveis, sem colaterais e sem estados indefinidos (`null`/`undefined`).
3. **Isolamento de Alterações:** Mudanças em um módulo/sistema não devem afetar inadvertidamente outros subsistemas. Encapsule regras de negócio rigorosamente.
4. **Foco Único (Single-Minded Execution):** Resolva um problema de cada vez com 100% de precisão antes de avançar para a próxima camada.

---

## 3. PROTOCOLO DE SEGURANÇA E PREVENÇÃO DE CRASHES
* **Tratamento de Exceções Defensivo:**
  - Valide todas as entradas de dados, retornos de funções e payloads (ex: `localStorage`, dados de rede, parsing de JSON).
  - Use blocos `try/catch` com fallbacks seguros em operações críticas (I/O, Parsing, Renderização).
* **Prevenção de Memory Leaks e Performance:**
  - Limpe loops, event listeners, intervals e timeouts não utilizados.
  - Implemente spatial hashing / culling / render distance para objetos e entidades em jogos ou interfaces ricas (como o culling de chunks implementado no ASTRAEON).
  - Evite criação desnecessária de objetos dentro do game loop (`requestAnimationFrame`).
* **Segurança de Código Client-side:**
  - **PROIBIDO:** `eval()`, `new Function()`, injeção de HTML via `innerHTML` sem sanitização estrita.
  - Prefira manipuladores de DOM seguros (`textContent`, `createElement`) ou Canvas 2D render.
  - Sem chamadas/dependências de servidores externos não declarados.

---

## 4. DIRETRIZES DE ARQUITETURA E MODULARIDADE
* **Separação Rígida de Responsabilidades (SoC):**
  - **Core/Game Engine:** Gerenciador de loop, eventos, input e ticks de simulação.
  - **State/Progression:** Sistemas de entidades, inventário, stats, salvamento e persistência.
  - **Render/UI:** Gerenciamento de Canvas/DOM, HUD, efeitos visuais, câmeras e layouts CSS.
  - **Audio/IO:** Sintetizadores (Web Audio API), escuta de entradas (Teclado/Mouse).
* **Geração Procedural e Determinismo:**
  - Sempre utilize geradores numéricos baseados em seeds (`PRNG` / `RNG` class) alimentando o gerador de biomas e estruturas.
  - Nunca dependa puramente de `Math.random()` quando a consistência do mundo/dados for necessária.
* **Preservação de Blocos de Configuração (Genesis Bridge):**
  - **REGRA CRÍTICA:** Nunca altere ou remova de forma destrutiva os comentários demarcadores `/* GENESIS_CONFIG_START */` e `/* GENESIS_CONFIG_END */` localizados no arquivo `index.html`. 
  - A constante `GENESIS_DEFAULT_CONFIG` contida entre estes delimitadores deve permanecer estruturada como um objeto JSON válido para garantir a compatibilidade e leitura/escrita direta pelo editor visual (`game-editor.html`).

---

## 5. MODO DE RESPOSTA E FLUXO DE TRABALHO
1. **Análise Inicial:** Entenda o requisito de ponta a ponta sem suposições.
2. **Sem Módulos Incompletos:** Entregue código 100% funcional, pronto para produção.
3. **Zero Explicações Desnecessárias:** Entregue o resultado diretamente no formato final requisitado.
4. **Auto-Validação Mandatória:** Antes da entrega, valide mentalmente ou via testes se todas as condições de erro, limites e tipos foram tratadas.
# ASTRAEON PROJECT MEMORY

## Estado
Inicialização em andamento.

## Identidade
Projeto: ASTRAEON

## Objetivo
Manter e evoluir o ASTRAEON preservando sua arquitetura,
funcionalidades e lógica existente.

## Fonte da verdade
O código atual possui prioridade sobre memória antiga.

## Regras
- Não inventar informações.
- Não alterar sem necessidade.
- Não reescrever sistemas funcionando.
- Verificar o código antes de modificar.
- Registrar descobertas importantes.
- Atualizar a memória após mudanças relevantes.

## Conhecimento
- Cinco classes jogáveis: Warrior, Mage, Archer, Assassin e Paladine.
- A progressão por personagem combina save local/nuvem com tabelas autoritativas no Supabase.
- A hotbar possui cinco slots; sistemas expansivos devem preservar esse limite visual.

## Sistemas conhecidos
- `src/game-v2.js`: engine, combate base, XP, ouro e hotbar.
- `src/characteristics-v1.js`: pontos de características e recálculo de status.
- `src/skills-catalog-v1.js` e `src/skills-v1.js`: catálogo, loja do Mestre, grimório H, loadout por arraste e execução das skills.
- `src/npcs-v4.js`: runtime de NPC; temporariamente mantém apenas o Mestre de Habilidades.
- `supabase/migrations/019_skill_domains_and_master.sql`: catálogo e posse autoritativa de skills.

## Decisões
- Cada classe possui dois domínios, dez skills por domínio e recebe três pontos de skill por nível, inclusive no nível 1.
- As 100 skills possuem receitas mecânicas, descrições e assinaturas visuais exclusivas; as duas skills de tier 10 de cada classe disparam cinematics próprias do domínio.
- Custos por domínio: 1, 2, 3, 4, 5, 6, 8, 10, 13 e 18 pontos; requisitos: níveis 1, 3, 6, 10, 15, 21, 28, 36, 45 e 60.
- A décima skill exige as nove anteriores do mesmo domínio e 5.000.000 de ouro autoritativo.
- H abre somente o grimório pessoal; nele, skills aprendidas são arrastadas ao HUD 1–5. Ao interagir com Maeron, o grimório abre à esquerda e a loja do Mestre à direita; compra e desbloqueio existem somente nessa loja.
- O chat tem prioridade absoluta sobre atalhos: enquanto estiver aberto, focado ou contiver texto, nenhuma tecla de painel pode abrir overlays do jogo.
- O chat é identificado na interface apenas como `Chat`.
- O efeito de ausência termina somente com movimento real do personagem, ataque, uso de habilidade ou tecla; mover o ponteiro do mouse não conta como atividade.
- O ataque básico possui efeito visual próprio por classe: X em dois traços para Guerreiro, círculo roxo para Mago, flecha encorpada para Arqueiro, perfuração com microvento para Assassino e círculo mágico para Paladino.
- Colisões entre jogador, mobs, NPCs e jogadores online são rígidas: a entidade em movimento para na borda do outro corpo e nunca desloca a entidade atingida, inclusive correndo.
- Painéis do HUD removem a rolagem externa e aplicam escala automática limitada pela resolução ativa e pela preferência de escala da interface; listas internas funcionais continuam navegáveis sem exibir barras.
- Todo nome visível do mundo usa `Astraeon`; a forma isolada `Astra` é nomenclatura legada e não deve retornar.
- Os painéis de skill do jogador e do Mestre compartilham dimensões compactas de referência (380×620 px); os tiles desktop medem 30×30 px e dependem do tooltip para detalhes.
- `!allskill` é exclusivo de administrador com MFA/AAL2 e libera somente as skills da classe ativa.
- Até nova decisão do usuário, Maeron em Astralum é o único NPC ativo.

## Bugs conhecidos
Nenhum registrado.

## Desconhecido
A arquitetura completa ainda precisa ser analisada.
# Painéis sem scroll e HUD do personagem 2.0 (2026-08-31)
- Painéis ingame editados no Studio não recebem mais `overflow:auto`: o runtime usa conteúdo recortado e o `panel-fit-v1` recalcula a escala para caber no viewport.
- O canvas do Editor de Painéis autoajusta o preview pela largura e altura disponíveis, sem criar uma janela rolável dentro do Studio.
- O HUD do personagem usa o retrato real da classe, recursos abreviados como HP/MP/STAM, XP percentual com neon e mantém recolhimento lateral persistente.
# Compra de skills e avisos sobrepostos (2026-08-31)
- O Mestre de Habilidades sincroniza o save do personagem antes da compra online e a migration 021 usa o maior nível persistido entre personagem e perfil ativo, reparando registros antigos após uma compra válida.
- A loja diferencia nível, pontos, dependências e ouro autoritativo antes da confirmação; saldo autoritativo zero não é mais substituído visualmente pelo ouro local.
- Avisos de skills são elevados para a raiz da página, permanecem acessíveis via `role=status` e aparecem acima dos painéis e fundos translúcidos.
# Saves por personagem e áreas protegidas (2026-09-01)
- Autosaves capturam o ID do personagem e um snapshot imutável no agendamento; temporizadores são independentes por personagem para impedir gravações cruzadas ao trocar ou criar slots.
- O painel de características possui a ação explícita `Salvar pontos`, aguarda a persistência online e informa quando o save ficou apenas local.
- A sincronização de skills é vinculada ao personagem solicitado, descarta respostas antigas e limpa imediatamente o grimório ao detectar uma troca.
- Áreas `mob_exclusion` bloqueiam ataques do jogador em seu interior e mantêm mobs/spawns a dois tiles de distância, inclusive em recarregamentos e trocas de mapa.

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
- Custos por domínio: 1, 2, 3, 4, 5, 6, 8, 10, 13 e 18 pontos; requisitos: níveis 1, 3, 6, 10, 15, 21, 28, 36, 45 e 60.
- A décima skill exige as nove anteriores do mesmo domínio e 5.000.000 de ouro autoritativo.
- H abre somente o grimório pessoal; nele, skills aprendidas são arrastadas ao HUD 1–5. Ao interagir com Maeron, o grimório abre à esquerda e a loja do Mestre à direita; compra e desbloqueio existem somente nessa loja.
- Os painéis de skill do jogador e do Mestre compartilham dimensões compactas de referência (380×620 px); os tiles desktop medem 30×30 px e dependem do tooltip para detalhes.
- `!allskill` é exclusivo de administrador com MFA/AAL2 e libera somente as skills da classe ativa.
- Até nova decisão do usuário, Maeron em Astralum é o único NPC ativo.

## Bugs conhecidos
Nenhum registrado.

## Desconhecido
A arquitetura completa ainda precisa ser analisada.

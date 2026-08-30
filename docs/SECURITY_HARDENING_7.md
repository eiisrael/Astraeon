# Astraeon Security Hardening 7.0

Este documento registra o modelo de segurança introduzido pelas migrations incrementais `011` a `015`. Ele complementa [`SECURITY.md`](../SECURITY.md) e não substitui a configuração segura do Supabase e da Vercel.

## Migrations

| Migration | Finalidade |
|---|---|
| `011_security_hardening.sql` | ownership imutável, grants mínimos, ban uniforme, validação estrutural de saves, lock do chat, MFA administrativo, auditoria e proteção do mapa default |
| `012_public_profiles.sql` | leitura interna somente do próprio perfil e RPCs públicas mínimas |
| `013_admin_pagination.sql` | listagem administrativa paginada sem `save_data` e detalhe sob demanda |
| `014_realtime_hardening.sql` | posição/ação social vinculada a `auth.uid()`, sequência, timestamp, rate limit e mitigação de teleporte |
| `015_server_authoritative_progression.sql` | fundação server-side de progressão, inventário e operações idempotentes |

Execute-as em ordem. Nunca reescreva migrations antigas que já foram aplicadas.

## Limites de confiança

O navegador não é autoridade de identidade, ownership, cargo, ban ou operações administrativas. Mensagens Broadcast deixaram de carregar estado de jogador porque o remetente declarado no payload não é uma identidade verificável. O canal privado mantém Presence; estado e ações passam por RPCs com identidade derivada de `auth.uid()` e por tabelas protegidas por RLS.

O cliente ainda valida sequência, tempo, frequência, posição e quantidade de efeitos para permanecer estável diante de eventos hostis. Essa camada é defesa de renderização, não anti-cheat definitivo.

## Administração

- leitura administrativa exige `access = 3`;
- mutações administrativas exigem `access = 3` e sessão `aal2`;
- alterações relevantes geram `security_events` sem tokens, senhas ou conteúdo integral de saves;
- trocar DOM ou estado JavaScript não concede permissão no banco;
- a listagem de personagens carrega no máximo 100 registros por página e nunca inclui `save_data`;
- o JSON de um personagem é obtido somente quando o detalhe é aberto.

## Saves e progressão

`validate_astraeon_save(jsonb)` limita estrutura, tamanho, classe, nome, nível, posição, recursos, seed e arrays. As constraints foram adicionadas como `NOT VALID`: novos writes são verificados imediatamente, enquanto dados históricos precisam ser auditados antes de executar `VALIDATE CONSTRAINT` em produção.

`character_progress` e `character_inventory` não concedem escrita direta a `authenticated`. XP e drops possuem RPCs server-only concedidas apenas a `service_role`; essa chave jamais pertence ao navegador.

O bootstrap autoritativo não importa ouro nem XP do JSON legado controlado pelo cliente. Personagens existentes começam com saldo autoritativo neutro (`0`) e só devem ser reconciliados por um processo confiável e auditado antes que qualquer economia competitiva seja ativada.

## Testes

```bash
npm run test:security
npm run validate
npm exec -- supabase start
npm run test:db
npm exec -- supabase db lint --local --level warning --fail-on error
npm exec -- supabase stop --no-backup
```

O teste JavaScript cobre payloads falsos, replay de sequência, timestamps antigos/futuros, flood, movimento impossível e limite de efeitos. O teste SQL representa Usuário A, Usuário B, Admin, Banido e Anon em banco descartável.

## Limitações deliberadas

PvP, trade, marketplace, ranking competitivo, loot compartilhado e economia global continuam desabilitados como sistemas autoritativos. Eles não devem ser ativados enquanto combate, cooldown, HP, morte, recompensa, inventário e economia não forem validados integralmente pelo servidor.

O save JSON legado continua sendo usado pelo modo local e pela experiência atual. Sua validação estrutural reduz corrupção e abuso de payload, mas não torna seus valores economicamente confiáveis.

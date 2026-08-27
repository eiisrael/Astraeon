# ASTRAEON ONLINE 4.1

RPG 2D em Canvas com classes, inventário, stamina, mapa procedural, cidades, NPCs, contas Supabase, save em nuvem, chat e presença multiplayer.

## Início rápido

```bash
git clone https://github.com/eiisrael/Astraeon.git
cd Astraeon
npm run validate
npx vercel dev
```

Abra o endereço exibido pelo Vercel CLI.

## Modo local

Sem Supabase configurado, o jogo continua funcionando localmente. Contas, chat mundial, save em nuvem e outros jogadores exigem Vercel + Supabase.

## Banco de dados

Schema versionado:

```text
supabase/migrations/001_astraeon_online.sql
```

Tabelas principais no Supabase:

- `public.profiles` — perfil do jogador;
- `public.player_saves` — save individual;
- `public.chat_messages` — histórico do chat;
- `auth.users` — usuários/senhas gerenciados pelo Supabase Auth.

## Variáveis Vercel

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ASTRAEON_REALTIME_TOPIC=world:astraeon:main
```

Nunca publique `service_role`, `sb_secret_...` ou outra chave secreta no frontend.

## Controles

- `WASD`/setas — mover
- `Shift` — correr
- Mouse/Espaço — ataque
- `1–5` — habilidades
- `I` — mochila
- `M` — mapa
- `Enter` — chat
- `E` — falar com NPC
- `Esc` — pausa

## Editor / Admin

O Editor não aparece mais no menu principal. Abra diretamente:

```text
/game-editor
```

`F10` abre o Admin Studio.

## Multiplayer atual

Compartilhado: presença, movimento, classe/nível visual, chat e efeitos de ações. Saves são persistidos individualmente no banco.

Ainda local: mobs, dano, loot, economia e PvP. Um MMO competitivo exige backend autoritativo para esses sistemas.

## Guia completo

Consulte [`ONLINE_SETUP.md`](ONLINE_SETUP.md) para instalação do Supabase, Vercel, banco, cadastro/login, diagnóstico e testes com duas contas.

# Astraeon Online — Vercel + Supabase

Astraeon continua funcionando em modo local sem configuração externa. Para habilitar contas, saves em nuvem, chat e jogadores visíveis em tempo real, configure o Supabase e o Vercel abaixo.

## 1. Criar o projeto Supabase

1. Crie um projeto Supabase.
2. Abra **SQL Editor**.
3. Execute o arquivo `supabase/migrations/001_astraeon_online.sql` inteiro.
4. Em **Authentication > URL Configuration**, defina o Site URL para o domínio de produção do Vercel e adicione os domínios de Preview que você realmente usa como Redirect URLs.
5. Mantenha confirmação de e-mail habilitada em produção.
6. Em **Realtime Settings**, habilite Realtime e prefira **private channels only / desabilitar public access**. As policies da migration permitem apenas usuários autenticados em tópicos `world:astraeon:*`.

## 2. Variáveis do Vercel

No projeto Vercel, em **Settings > Environment Variables**, crie:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ASTRAEON_REALTIME_TOPIC=world:astraeon:main
```

`ASTRAEON_REALTIME_TOPIC` é opcional, mas deve manter o prefixo `world:astraeon:` para corresponder às policies Realtime da migration.

**Nunca** coloque `sb_secret_...`, `service_role` ou qualquer segredo Supabase no HTML, CSS, JavaScript do navegador ou GitHub. O endpoint `/api/config` expõe somente URL, publishable key e tópico, que são valores públicos protegidos por RLS.

Depois de alterar Environment Variables, faça um novo deploy.

## 3. Deploy Vercel

- Importe o repositório GitHub no Vercel.
- Framework Preset: **Other** (o projeto é HTML/Canvas + Vercel Function).
- Root Directory: raiz do repositório.
- Não é necessário build command.
- `index.html` continua sendo a entrada do jogo.
- `api/config.js` vira a Function `/api/config`.

O `vercel.json` adiciona headers de segurança e CSP compatível com Supabase Realtime e o SDK carregado do jsDelivr.

## 4. Teste

1. Abra o deploy em duas janelas anônimas diferentes.
2. Cadastre duas contas distintas e confirme os e-mails.
3. Faça login em ambas.
4. Inicie uma jornada em cada janela.
5. Os personagens devem aparecer um para o outro e se mover em tempo real.
6. Envie mensagens pelo Chat de Astra.
7. Use o controle de transparência no ícone de engrenagem do chat.
8. Salve e use **Conta & Nuvem > Salvar na nuvem**; recarregue a página e valide **Carregar save da nuvem**.

## Segurança implementada

- Supabase Auth para senha/e-mail e JWT.
- Row Level Security em `profiles`, `player_saves` e `chat_messages`.
- Save só pode ser lido/escrito pelo próprio usuário.
- Chat só aceita usuário autenticado, força `auth.uid()`, limita a 240 caracteres e aplica intervalo mínimo de 900 ms entre mensagens.
- Username é validado e possui índice único case-insensitive.
- Broadcast/Presence usa canal privado e policies Realtime para usuários autenticados.
- Movimento remoto é **cosmético e não autoritativo**: mensagens Realtime nunca concedem itens, XP, ouro ou persistem alterações de gameplay.
- Renderização do chat usa `textContent`, evitando interpretar HTML enviado por jogadores.
- CSP, HSTS, `nosniff`, `frame-ancestors 'none'`, Permissions Policy e Referrer Policy são definidos pelo Vercel.

## Limite atual do multiplayer

Esta versão sincroniza **presença, movimento, classe, level, efeitos de ataque/skill e chat**. Mobs, dano e loot continuam simulados localmente por cliente. Para PvP, combate compartilhado ou economia competitiva, o próximo passo deve ser um servidor autoritativo que valide movimento, combate e inventário no backend.

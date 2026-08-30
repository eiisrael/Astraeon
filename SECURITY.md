# Security Policy — Astraeon Online

## Environment variables and secrets

Astraeon separates **public browser configuration** from **private server credentials**.

The only environment template committed to the repository is `.env.example`, and it contains placeholders only.

### Allowed browser/public configuration

The current frontend may receive these values through `/api/config`:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
ASTRAEON_REALTIME_TOPIC
```

`SUPABASE_PUBLISHABLE_KEY` is designed to be public. It does **not** replace database security: Supabase RLS and Realtime policies must remain enabled.

### Never commit or expose

Do not commit, print, screenshot or return to the browser:

- Supabase secret/service-role keys;
- database passwords or database URLs containing passwords;
- Vercel personal access tokens;
- GitHub personal access tokens;
- private keys/certificates containing private material;
- refresh tokens, cookies or session secrets;
- real `.env`, `.env.local`, `.env.production`, `.env.development` or similar files.

## Local environment workflow

Use `.env.example` only as a template.

If you need a local file:

```bash
cp .env.example .env.local
```

Then replace placeholders **only in `.env.local`**. `.env.local` is ignored by Git.

For a Vercel-linked project, you can also use:

```bash
npx vercel env pull
```

The downloaded environment file must remain local and must never be forced into Git.

## Before every commit

Run:

```bash
npm run validate
```

The validation now includes `scripts/check_secrets.py`, which checks tracked files for:

- real `.env` files accidentally tracked;
- Supabase secret keys;
- GitHub tokens;
- Vercel token assignments;
- common cloud access keys;
- private-key blocks;
- database URLs containing passwords;
- other high-risk secret assignments.

You can run only the secret scanner with:

```bash
npm run check:secrets
```

## If a secret was committed

Adding the file to `.gitignore` afterward is **not enough**. Assume the secret is exposed.

1. Revoke or rotate the secret immediately at its provider.
2. Remove the secret from the current code.
3. If necessary, rewrite Git history using an appropriate history-cleaning tool.
4. Redeploy with the replacement secret stored only in the provider's protected Environment Variables.
5. Review logs and access history when the provider makes them available.

## Vercel

Store runtime environment variables in:

```text
Project → Settings → Environment Variables
```

Use separate values/scopes for Development, Preview and Production when appropriate.

Never use a personal Vercel token as a browser environment variable.

## Supabase

The browser must use a publishable key, while access to player data is enforced by RLS/policies.

A service-role or secret key must never be returned by `/api/config` or referenced by frontend JavaScript.

## Controles de autenticação no Supabase

As regras de senha precisam ser configuradas no servidor, em **Authentication → Settings**. O `minlength` do formulário é apenas uma ajuda visual e não é uma barreira de segurança.

Para produção:

- exija no mínimo 10 caracteres no servidor;
- mantenha confirmação de e-mail habilitada;
- habilite proteção contra senhas vazadas quando disponível no plano;
- revise os limites de cadastro e login;
- adicione CAPTCHA quando houver abuso automatizado;
- use somente Redirect URLs controladas pelo projeto.

## MFA administrativo

Contas com `profiles.access = 3` precisam concluir **AAL2/MFA** antes que o Admin Studio carregue. O fluxo interno oferece inscrição TOTP por QR Code, desafio com código e gestão de fatores; as migrations também exigem AAL2 para mutações administrativas. Alterar DOM, JavaScript, `localStorage` ou `AstraeonAdminAuth.access` não muda a autorização do Postgres.

Antes de editar contas, personagens, saves, mapas, mobs, itens ou configurações em produção:

1. habilite MFA no Supabase Auth;
2. cadastre um segundo fator para cada conta administrativa;
3. confirme que a sessão possui claim `aal = aal2`;
4. mantenha pelo menos duas contas administrativas de recuperação protegidas.
5. mantenha ao menos dois fatores TOTP verificados por conta administrativa antes de remover qualquer um.

## Modelo de autoridade

- `profiles` é interno e cada jogador lê somente o próprio registro;
- identidades públicas são resolvidas por RPCs mínimas e limitadas;
- ownership de `character_saves` é imutável;
- bans são revalidados em policies e RPCs;
- estado social Realtime é publicado por RPC e vinculado a `auth.uid()`;
- listagens administrativas não carregam todos os saves;
- progressão competitiva usa as tabelas autoritativas preparadas em migration própria.
- XP e drops só podem ser emitidos por um processo de jogo confiável via `/api/progression-authority`, com segredo privado configurado no host.

O JSON legado do save continua necessário para o jogo local, mas **não deve ser usado como autoridade de economia, ranking, PvP, trade ou marketplace**.

Consulte [`docs/SECURITY_HARDENING_7.md`](docs/SECURITY_HARDENING_7.md) para os contratos, migrations e testes.

## Reporting a security problem

Do not publish active credentials in a public Issue. Revoke/rotate the credential first, then report the technical issue without including the secret value.

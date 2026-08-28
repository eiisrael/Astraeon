# INSTALLME — Astraeon Online 4.1

> Guia didático para instalar, executar, configurar o modo online e publicar o Astraeon na Vercel sem expor informações privadas do criador ou da infraestrutura.

---

## 1. O que você vai montar

Ao final deste guia, a arquitetura será:

```text
Seu computador
     │
     ├── Git / GitHub → código-fonte
     │
     ├── Vercel → site + /api/config
     │
     └── Supabase
          ├── Auth → contas/login
          ├── Postgres → perfis/saves/chat
          └── Realtime → presença/movimento/chat
```

O Astraeon também funciona em modo local sem Supabase, mas cadastro, save em nuvem, chat mundial e presença multiplayer precisam da configuração online.

---

# PARTE A — Preparar o computador

## 2. Instale os programas necessários

### Git

Use a versão atual do Git para seu sistema operacional.

Teste depois da instalação:

```bash
git --version
```

### Node.js

Recomendado: **Node.js 20 ou superior**.

Teste:

```bash
node --version
npm --version
```

### Navegador

Use uma versão atual de Chrome, Edge, Firefox ou outro navegador moderno com suporte a Canvas, módulos web e APIs atuais.

### Editor de código — opcional

VS Code ou outro editor de sua preferência.

---

# PARTE B — Baixar o Astraeon

## 3. Clone o repositório

Escolha uma pasta de trabalho e execute:

```bash
git clone https://github.com/eiisrael/Astraeon.git
```

Entre no projeto:

```bash
cd Astraeon
```

Para atualizar uma cópia existente:

```bash
git checkout main
git pull origin main
```

---

## 4. Valide o projeto

Execute:

```bash
npm run validate
```

Resultado esperado:

```text
ASTRAEON ONLINE 4.1 validation OK
```

Se existir um arquivo temporário local como `*.crswap`, `*.swp` ou semelhante, remova-o. Esses arquivos não fazem parte do jogo e já estão previstos no `.gitignore`.

---

# PARTE C — Entender a Vercel

## 5. O que é a Vercel?

A Vercel é a plataforma que hospeda o Astraeon na web.

Ela cuida principalmente de:

- entregar `index.html`, CSS, JavaScript e assets;
- disponibilizar uma URL pública;
- executar a Function `/api/config`;
- armazenar variáveis de ambiente do projeto;
- criar deployments de preview e produção;
- registrar logs de build/runtime.

### Conceitos principais

**Project** = o projeto Astraeon dentro da Vercel.

**Deployment** = uma versão publicada desse projeto.

**Development** = execução local com `vercel dev`.

**Preview** = publicação temporária para teste.

**Production** = versão pública principal.

---

# PARTE D — Instalar e vincular Vercel CLI

## 6. Login na Vercel

Na raiz do Astraeon:

```bash
npx vercel login
```

Siga o fluxo de autenticação mostrado pelo terminal.

Não coloque tokens pessoais em arquivos do projeto.

---

## 7. Vincule a pasta local a um Project

Execute:

```bash
npx vercel link
```

Se estiver criando um projeto novo, use respostas equivalentes a:

```text
Which project?      → Create a new project
Name?               → astraeon
Code directory?     → ./
Customize settings? → no
```

### Regras para o nome do projeto

O nome da Vercel deve usar letras minúsculas. Exemplo válido:

```text
astraeon
```

Evite nomes com espaços ou letras maiúsculas.

### Code directory

Se o terminal já estiver dentro da pasta raiz do Astraeon, use:

```text
./
```

Não use `./astraeon` a menos que exista realmente uma subpasta com esse nome.

Depois do link, a Vercel cria uma pasta local:

```text
.vercel/
```

Ela contém IDs de vínculo local e está ignorada pelo Git.

---

# PARTE E — Rodar localmente

## 8. Inicie o servidor Vercel local

Execute:

```bash
npx vercel dev
```

Mantenha o terminal aberto.

Espere uma mensagem semelhante a:

```text
Ready! Available at http://localhost:3000
```

Só depois disso acesse o navegador.

Jogo:

```text
http://localhost:3000
```

Admin Studio:

```text
http://localhost:3000/game-editor
```

### Se aparecer ERR_CONNECTION_REFUSED

Isso normalmente significa que `vercel dev` ainda não está rodando ou ficou parado aguardando alguma pergunta no terminal.

Volte ao terminal e verifique se apareceu `Ready!`.

---

# PARTE F — Criar o Supabase

## 9. Crie um projeto Supabase

Crie um novo projeto em sua própria conta Supabase.

Não publique no GitHub:

- senha do banco;
- tokens privados;
- `service_role`;
- chaves `sb_secret_...`;
- dados de acesso administrativos.

---

## 10. Crie o banco do Astraeon

No Supabase Dashboard abra:

```text
SQL Editor
```

No repositório, abra:

```text
supabase/migrations/001_astraeon_online.sql
```

Copie o conteúdo completo e execute no SQL Editor.

A migration cria e configura:

```text
public.profiles
public.player_saves
public.chat_messages
```

Além de:

- triggers;
- índices;
- validações;
- Row Level Security;
- políticas de acesso;
- proteção do chat;
- Realtime.

---

## 11. Onde ficam os usuários?

No Supabase:

```text
Authentication → Users
```

Internamente, as contas são gerenciadas em:

```text
auth.users
```

O Astraeon não salva senhas manualmente em JavaScript ou em `profiles`.

---

## 12. Onde ficam os dados do jogador?

No Supabase:

```text
Table Editor
```

### profiles

Informações públicas básicas do jogador:

- username;
- display name;
- classe;
- nível;
- last seen.

### player_saves

Save individual do personagem em JSON.

RLS impede um jogador autenticado de ler ou alterar o save de outra conta.

### chat_messages

Histórico persistente do chat mundial.

---

# PARTE G — Configurar Authentication

## 13. URL Configuration

No Supabase abra:

```text
Authentication → URL Configuration
```

Para produção, configure o **Site URL** com o domínio público do projeto.

Exemplo genérico:

```text
https://SEU-PROJETO.vercel.app
```

Adicione Redirect URLs apenas para endereços que você realmente utiliza.

Em produção, é recomendado manter confirmação de e-mail ativa.

---

# PARTE H — Variáveis de ambiente

## 14. Variáveis necessárias

O Astraeon utiliza:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
ASTRAEON_REALTIME_TOPIC
```

Exemplo seguro/documentacional:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXEMPLO
ASTRAEON_REALTIME_TOPIC=world:astraeon:main
```

Nunca copie valores reais para documentação pública.

---

## 15. Configurar no painel Vercel

Abra seu Project na Vercel e vá para:

```text
Settings → Environment Variables
```

Crie as três variáveis.

`ASTRAEON_REALTIME_TOPIC` pode manter:

```text
world:astraeon:main
```

O prefixo `world:astraeon:` deve ser preservado porque as policies Realtime da migration esperam esse padrão.

Depois de alterar Environment Variables, faça um novo deployment.

---

## 16. Desenvolvimento local com variáveis

Depois que o Project estiver vinculado, você pode trazer as variáveis de desenvolvimento da Vercel para o ambiente local usando:

```bash
npx vercel env pull
```

Isso pode criar um arquivo local de ambiente.

Esse arquivo **não deve ser enviado ao GitHub**.

Verifique sempre o `.gitignore` antes de versionar mudanças.

---

# PARTE I — Testar o modo online

## 17. Teste de cadastro

Com `npx vercel dev` rodando:

1. abra o Astraeon;
2. abra **Conta online**;
3. escolha **Cadastrar**;
4. informe um username válido, e-mail e senha;
5. confirme o e-mail se a confirmação estiver ativa;
6. faça login.

Depois confira no Supabase:

```text
Authentication → Users
Table Editor → profiles
```

---

## 18. Teste de save na nuvem

Inicie uma jornada e use a ação de salvar na nuvem.

Confira:

```text
Table Editor → player_saves
```

O registro deve usar o UUID da conta autenticada.

---

## 19. Teste do chat

Durante a partida:

```text
Enter
```

abre/foca o chat.

Envie uma mensagem autenticado e confira:

```text
Table Editor → chat_messages
```

O banco valida o autor pelo usuário autenticado.

---

## 20. Teste multiplayer com dois jogadores

Use dois navegadores, dois perfis ou duas janelas anônimas independentes.

1. crie duas contas diferentes;
2. faça login nas duas;
3. inicie uma jornada em ambas;
4. confirme que os personagens aparecem um para o outro;
5. movimente os personagens;
6. envie mensagens;
7. verifique a contagem de jogadores online.

O multiplayer atual sincroniza presença/movimento/chat e efeitos visuais. Mobs, dano, loot, economia e PvP ainda não são autoritativos no servidor.

---

# PARTE J — Publicar na Vercel

## 21. Preview Deployment

Para criar uma versão de teste:

```bash
npx vercel
```

A Vercel gera uma URL de preview.

Use preview para validar antes de publicar a versão principal.

---

## 22. Production Deployment

Para publicar manualmente em produção:

```bash
npx vercel --prod
```

Se o Project estiver integrado ao GitHub, a Vercel também pode publicar automaticamente quando a branch de produção for atualizada.

---

## 23. Deploy automático pelo GitHub

Fluxo recomendado:

```text
Alteração local
   ↓
Git commit / GitHub
   ↓
Pull Request
   ↓
GitHub Actions valida
   ↓
Merge em main
   ↓
Vercel cria novo deployment
```

Isso reduz o risco de publicar código que não passou pela validação do projeto.

---

# PARTE K — Diagnóstico básico

## 24. O site não abre

Verifique se o servidor está rodando:

```bash
npx vercel dev
```

Procure `Ready!` no terminal.

---

## 25. Jogo abre, mas aparece OFFLINE

Verifique:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
```

E faça novo deployment ou reinicie `vercel dev` após atualizar as variáveis.

No jogo, abra:

```text
Conta online → Diagnóstico Online
```

---

## 26. Cadastro falha

Confira:

- migration executada;
- Auth habilitado;
- URL Configuration;
- confirmação de e-mail;
- console do navegador;
- logs da Vercel;
- logs/Auth do Supabase.

---

## 27. Chat abre, mas não envia

O chat mundial exige uma sessão autenticada.

Confirme no Diagnóstico Online:

```text
Configuração → ativa
Autenticação → conectado
Realtime → online/conectando
```

Também confira se `chat_messages` e as policies foram criadas pela migration.

---

## 28. Realtime não conecta

Confirme:

- migration executada;
- Realtime habilitado;
- usuário autenticado;
- tópico começando por `world:astraeon:`;
- URL/chave públicas corretas;
- nenhuma CSP customizada bloqueando `wss://*.supabase.co`.

---

# PARTE L — Segurança

## 29. O que pode ficar público

Pode aparecer no cliente quando necessário:

- URL pública do projeto Supabase;
- publishable key;
- tópico Realtime.

Esses valores dependem de RLS/policies corretas para segurança.

---

## 30. O que nunca deve ficar público

Nunca publique:

```text
service_role
sb_secret_...
senha de banco
access token pessoal
refresh token
cookie de sessão
VERCEL_TOKEN
IDs/credenciais administrativas privadas
.env real
```

Não coloque essas informações em:

- README;
- INSTALLME;
- issues;
- screenshots públicas;
- commits;
- frontend JavaScript;
- HTML;
- arquivos enviados ao Discord/fóruns.

---

# PARTE M — Comandos essenciais

## Atualizar código

```bash
git checkout main
git pull origin main
```

## Validar

```bash
npm run validate
```

## Vincular Vercel

```bash
npx vercel link
```

## Desenvolvimento local

```bash
npx vercel dev
```

## Trazer env de desenvolvimento

```bash
npx vercel env pull
```

## Criar preview

```bash
npx vercel
```

## Publicar produção

```bash
npx vercel --prod
```

---

# PARTE N — Checklist antes de publicar

- [ ] `npm run validate` passa;
- [ ] `.env` e `.vercel/` não estão versionados;
- [ ] migration do Supabase foi executada;
- [ ] RLS está ativa;
- [ ] nenhuma chave secreta está no frontend;
- [ ] cadastro funciona;
- [ ] login funciona;
- [ ] save na nuvem funciona;
- [ ] chat funciona com duas contas;
- [ ] presença multiplayer funciona em dois clientes;
- [ ] `/game-editor` não aparece no menu público;
- [ ] Admin Studio não possui credenciais administrativas embutidas;
- [ ] deployment de preview foi testado;
- [ ] domínio/redirect URLs estão corretos.

---

# Licença

Astraeon Online é distribuído sob a **MIT License**.

Copyright © 2026 **Erick Israel (eiisrael)**.

Consulte [`LICENSE`](LICENSE) e [`COPYRIGHT.md`](COPYRIGHT.md).

> A MIT License preserva o copyright do autor enquanto concede permissões amplas de uso, cópia, modificação e distribuição conforme seus termos.

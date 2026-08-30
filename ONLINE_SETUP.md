# Astraeon Online 4.1 — instalação, banco, multiplayer e chat

Este guia descreve o funcionamento real do Astraeon no navegador, o banco usado para contas e saves e a configuração necessária para Vercel + Supabase.

## O que funciona sem configurar nada

Abrindo o projeto localmente, o jogo continua funcionando em modo local com:

- mapa procedural e Editor Astral;
- classes, combate e habilidades;
- inventário, equipamentos, stamina e loot;
- cidades e NPCs locais;
- saves no `localStorage` do navegador.

Contas, save em nuvem, chat mundial persistente e presença de outros jogadores precisam do Supabase configurado.

---

## 1. Programas necessários no computador

Instale:

1. **Git** — para baixar/atualizar o repositório.
2. **Node.js 20 ou superior** — para validação e Vercel CLI.
3. Um navegador atual (Chrome, Edge ou Firefox).
4. Opcional: **VS Code** para editar o projeto.

Depois:

```bash
git clone https://github.com/eiisrael/Astraeon.git
cd Astraeon
npm run validate
```

O projeto não depende de um framework frontend ou build de bundle. O jogo é HTML + CSS + JavaScript + Canvas e possui uma Vercel Function em `api/config.js`.

### Rodar localmente do jeito correto

Não use apenas duplo clique em `index.html` se quiser testar `/api/config` e o modo online. Na raiz do projeto execute:

```bash
npx vercel dev
```

Abra o endereço mostrado pelo terminal, normalmente `http://localhost:3000`.

---

## 2. Onde fica o banco de dados das contas

O banco não fica dentro de um arquivo `.db` do repositório. O Astraeon usa **Supabase (Postgres + Auth + Realtime)**.

No Supabase Dashboard:

### Authentication → Users

Aqui ficam as contas de autenticação criadas por e-mail e senha. O Supabase mantém esses dados na estrutura interna `auth.users`. A senha não é armazenada pelo JavaScript do Astraeon.

### Table Editor → `profiles`

Perfil interno do jogador. Usuários comuns só podem consultar o próprio registro:

- `id` — mesmo UUID da conta Auth;
- `username`;
- `display_name`;
- `class_id`;
- `level`;
- `last_seen`.

Metadados de apresentação de outros jogadores são entregues somente pelas RPCs públicas mínimas. `access`, `active_character_id`, timestamps internos e outros campos privados não podem ser enumerados por jogadores.

### Table Editor → `player_saves`

Save persistente por conta:

- `user_id`;
- `save_data` em JSON;
- `world_seed`;
- `updated_at`.

Cada jogador só pode ler/escrever o próprio save através de Row Level Security.

### Table Editor → `chat_messages`

Histórico do chat mundial:

- jogador;
- username;
- mensagem;
- canal;
- horário.

O esquema completo e incremental está em:

```text
supabase/migrations/
```

---

## 3. Criar e preparar o Supabase

1. Crie um projeto em Supabase.
2. Abra **SQL Editor**.
3. Execute **todas** as migrations em ordem numérica. Em um banco já existente, execute apenas as migrations ainda não aplicadas; nunca edite uma migration antiga como se ela não tivesse sido executada.

```text
supabase/migrations/001_astraeon_online.sql
...
supabase/migrations/015_server_authoritative_progression.sql
```

As migrations criam perfis, personagens, saves, chat, Admin Studio, RLS, rate limits, identidade Realtime vinculada ao usuário autenticado e a fundação de progressão autoritativa.

4. Em **Authentication → URL Configuration**:
   - configure **Site URL** com o domínio de produção do Vercel;
   - adicione somente os Redirect URLs de preview/desenvolvimento que realmente utilizar.
5. Em produção, mantenha confirmação de e-mail habilitada.
6. Em **Realtime → Settings**, habilite Realtime e desabilite acesso público aos canais. Presence usa tópicos privados `world:astraeon:*`; posição e ações sociais chegam pelas tabelas RLS `player_runtime_states` e `player_runtime_actions`.

### Chave correta

Use a chave pública/publishable (`sb_publishable_...`). Nunca coloque `sb_secret_...`, `service_role` ou outra chave secreta no HTML/JavaScript/GitHub.

---

## 4. Configurar o Vercel

### Pelo painel

1. No Vercel, escolha **Add New → Project**.
2. Importe `eiisrael/Astraeon` do GitHub.
3. Framework Preset: **Other**.
4. Root Directory: raiz do repositório.
5. Não é necessário Build Command.
6. Em **Settings → Environment Variables**, adicione:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
ASTRAEON_REALTIME_TOPIC=world:astraeon:main
```

`ASTRAEON_REALTIME_TOPIC` é opcional, mas deve manter o prefixo `world:astraeon:` para corresponder às policies do banco.

7. Faça um novo deploy depois de alterar variáveis.

### O que `/api/config` faz

`api/config.js` roda como Vercel Function. Ela entrega ao navegador somente:

- URL pública do Supabase;
- publishable key;
- tópico Realtime.

Não existe secret/service-role enviado ao cliente.

---

## 5. Como cadastro e login funcionam

No menu do jogo aparece **Conta online** quando a camada online inicia.

### Cadastro

1. Abra **Conta online**.
2. Escolha **Cadastrar**.
3. Informe username, e-mail e senha (mínimo de 10 caracteres no cliente).
4. O navegador chama `supabase.auth.signUp()`.
5. O Supabase cria o usuário em Auth.
6. O trigger da migration cria automaticamente o registro em `public.profiles`.
7. Se confirmação de e-mail estiver ativa, confirme o e-mail antes de fazer login.

### Login

O login usa `signInWithPassword()`. A sessão fica persistida pelo Supabase Client no navegador e é renovada automaticamente.

---

## 6. Como o chat funciona depois da correção 4.1

### Desktop

Durante a partida:

```text
Enter = abrir/focar o Chat de Astra
```

Também existe um botão de chat no HUD.

Se você ainda não estiver autenticado, o chat **abre normalmente**. Ao tentar enviar uma mensagem, o jogo abre **Conta & Nuvem** e informa que é necessário login. Antes da 4.1 o campo ficava `disabled` sem sessão, por isso o `Enter` podia aparentar não funcionar.

### Mobile

Existe botão **Chat** junto aos controles touch. O painel expande e pode ser recolhido pelo cabeçalho.

### Transparência

No ícone de engrenagem do Chat de Astra existe o controle de transparência. O valor é salvo no navegador em:

```text
astraeon:v4:chat-opacity
```

### Segurança do chat

- máximo de 240 caracteres;
- texto renderizado com `textContent`;
- trigger do Postgres força `auth.uid()` e o username real do perfil;
- rate limit mínimo de 900 ms entre mensagens;
- somente usuários autenticados podem inserir mensagens;
- canal Realtime privado.

---

## 7. Diagnóstico multiplayer

Em **Conta online → Diagnóstico Online** aparecem quatro estados:

- **Configuração** — indica se `/api/config` recebeu URL + publishable key;
- **Autenticação** — mostra se existe sessão;
- **Realtime** — `online`, `connecting`, `offline` ou erro;
- **Banco** — indica se a configuração Supabase foi detectada.

Para testar de verdade:

1. abra o deploy em duas janelas anônimas/perfis diferentes;
2. crie duas contas e confirme os e-mails;
3. faça login nas duas;
4. inicie uma jornada em ambas;
5. confirme que os dois personagens aparecem um para o outro;
6. mova os dois personagens;
7. envie mensagens dos dois lados;
8. confira Table Editor → `chat_messages`;
9. clique em **Salvar na nuvem** e confira `player_saves`.

### Escopo multiplayer atual

Sincronizado entre jogadores:

- presença;
- posição/movimento;
- classe e nível exibidos;
- efeitos visuais de ataque/habilidades;
- chat;
- save individual na nuvem.

Ainda local em cada cliente:

- IA e estado dos mobs;
- dano compartilhado;
- loot compartilhado;
- economia competitiva;
- PvP.

Portanto, esta versão já é multiplayer social/presença, mas combate MMORPG autoritativo exigirá uma camada de servidor que valide estado de mundo, combate, itens e economia.

---

## 8. Game Editor / Admin Studio

O Editor foi removido do menu público da `index.html`.

Para abrir diretamente:

```text
http://localhost:3000/game-editor
```

ou, em um deploy:

```text
https://SEU-DOMINIO/game-editor
```

O Editor possui duas responsabilidades:

1. **World Editor** — terreno, biomas, água, estradas, objetos, colisões e spawns.
2. **Admin Studio (F10)** — personagem local, gameplay, classes, mobs, itens, biomas, save/world JSON e diagnóstico de infraestrutura.

O Admin Studio manipula os dados locais e os overrides de balanceamento do navegador. Ele **não é uma interface service-role do Supabase** e não ignora RLS.

---

## 9. Atualizar o projeto no PC

```bash
git checkout main
git pull origin main
npm run validate
npx vercel dev
```

Se o Vercel estiver conectado ao GitHub, merges no branch de produção disparam novos deployments automaticamente.

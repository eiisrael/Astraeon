<div align="center">

# ✦ ASTRAEON ONLINE

### Ecos da Convergência

**RPG 2D online em Canvas · mundo procedural · classes · cidades · NPCs · inventário · chat · contas · multiplayer social**

[![Version](https://img.shields.io/badge/version-4.1-7dd3fc?style=for-the-badge)](#estado-atual)
[![License](https://img.shields.io/badge/license-MIT-e7b75f?style=for-the-badge)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Web-9be7a5?style=for-the-badge)](#tecnologias)
[![Deploy](https://img.shields.io/badge/deploy-Vercel-black?style=for-the-badge)](INSTALLME.md)
[![Database](https://img.shields.io/badge/database-Supabase-3ecf8e?style=for-the-badge)](INSTALLME.md)

> **Astra foi quebrada pela Convergência.** Cinco climas disputam o mesmo continente, cidades surgem como refúgios e cada viajante constrói sua própria lenda entre criaturas, relíquias e ecos de outros jogadores.

</div>

---

## 🌌 O que é o Astraeon?

**Astraeon Online** é um RPG 2D executado diretamente no navegador. O projeto combina uma engine própria em **HTML + CSS + JavaScript + Canvas 2D** com serviços de nuvem para autenticação, persistência e comunicação entre jogadores.

O objetivo é manter uma base leve e compreensível, sem esconder a lógica principal atrás de um framework pesado: o mapa, combate, inventário, HUD, cidades, NPCs e sistemas de progressão são construídos em JavaScript e renderizados pelo Canvas.

### Destaques

- 🗺️ mundo procedural de **96 × 96 tiles**;
- 🌲 cinco biomas/climas com identidade própria;
- 🏙️ cidades e áreas seguras distribuídas pelo continente;
- 🧙 cinco classes jogáveis;
- ⚔️ combate, habilidades, mana, stamina e corrida;
- 🎒 mochila, equipamentos, raridades e itens exclusivos por classe;
- 💎 loot persistente no chão quando a mochila está cheia;
- 🤖 NPCs que caminham e respondem a diálogos contextuais locais;
- 💬 chat mundial com transparência configurável;
- 👥 presença e movimento de jogadores em tempo real;
- 🔐 cadastro/login por Supabase Auth;
- ☁️ save individual na nuvem;
- 🛠️ **Admin Studio** separado da tela pública;
- 📱 interface adaptada a desktop e dispositivos móveis.

---

## 🎮 Controles

| Ação | Desktop |
|---|---|
| Mover | `WASD` ou setas |
| Correr | `Shift` |
| Ataque básico | Mouse / `Espaço` |
| Habilidades | `1` a `5` |
| Mochila | `I` |
| Mapa | `M` |
| Chat mundial | `Enter` |
| Falar com NPC | `E` |
| Ajuda | `H` |
| Pausa | `Esc` |

No mobile, o jogo cria controles touch para movimento, corrida, ataque, habilidades, chat e interação com NPCs.

---

## 🧬 Classes

O Astraeon possui cinco arquétipos, cada um com identidade visual, atributos e equipamentos compatíveis:

| Classe | Estilo geral |
|---|---|
| **Guerreiro** | resistência, combate frontal e armas pesadas |
| **Mago** | mana, alcance e dano mágico |
| **Arqueiro** | mobilidade, precisão e ataque à distância |
| **Assassino** | velocidade, crítico e execução |
| **Paladino** | defesa, sustentação e poder sagrado |

Itens incompatíveis ainda podem ser encontrados e armazenados, mas o sistema impede que sejam equipados pela classe errada.

---

## 🏙️ Mundo vivo

A camada online adiciona cidades ao mundo procedural:

- **Astralum** — coração da Convergência;
- **Lúmenfall** — cidade das copas antigas;
- **Solvaris** — mercado do sol ardente;
- **Nivora** — fortaleza do véu gelado;
- **Umbra Vale** — refúgio das águas escuras;
- **Cinzalta** — bastião dos altos de cinza.

As cidades possuem vias, estruturas, áreas protegidas e habitantes. NPCs caminham por pontos seguros e podem conversar com o jogador usando um sistema contextual local, sem depender obrigatoriamente de uma API externa de IA.

---

## 🌐 Arquitetura online

```mermaid
flowchart LR
    P[Jogador / Navegador] --> V[Vercel]
    V --> S[Arquivos do jogo]
    V --> API[/api/config]
    API --> E[Variáveis de ambiente]
    P --> A[Supabase Auth]
    P --> DB[(Supabase Postgres)]
    P --> R[Supabase Realtime]
    DB --> PS[player_saves]
    DB --> PR[profiles]
    DB --> CH[chat_messages]
```

### Responsabilidade de cada parte

**Vercel** hospeda o jogo e executa a Function `/api/config`.

**Supabase Auth** gerencia cadastro, login, sessão e senha.

**Supabase Postgres** guarda perfis, saves e histórico do chat.

**Supabase Realtime** sincroniza presença, movimento, mensagens e eventos visuais entre jogadores.

---

## 🔐 Segurança

O projeto foi estruturado para não depender de segredos no navegador.

- nenhuma `service_role` deve ser enviada ao frontend;
- o navegador usa somente chave pública/publishable do Supabase;
- `player_saves` usa **Row Level Security (RLS)**;
- cada jogador só pode ler e alterar o próprio save;
- chat exige usuário autenticado;
- o banco força o `auth.uid()` como autor da mensagem;
- mensagens têm limite de tamanho e rate limit;
- chat é renderizado com `textContent`, evitando interpretação de HTML enviado por jogadores;
- canais Realtime são preparados para uso autenticado;
- Vercel aplica CSP, HSTS, `nosniff`, proteção contra iframe e outras políticas HTTP.

> Nunca publique chaves `service_role`, `sb_secret_...`, tokens privados, credenciais pessoais ou arquivos `.env` reais no GitHub.

---

## 💾 Banco de dados

O Astraeon usa **Supabase/PostgreSQL**. O banco não fica em um arquivo `.db` dentro do repositório.

Migration principal:

```text
supabase/migrations/001_astraeon_online.sql
```

Estruturas principais:

| Estrutura | Finalidade |
|---|---|
| `auth.users` | autenticação gerenciada pelo Supabase |
| `public.profiles` | username, classe, nível e presença básica |
| `public.player_saves` | save JSON individual de cada jogador |
| `public.chat_messages` | histórico persistente do chat mundial |

---

## 🚀 Instalação rápida

### Requisitos

- Git;
- Node.js 20+;
- navegador moderno;
- conta Vercel para execução/deploy web;
- conta Supabase para recursos online.

```bash
git clone https://github.com/eiisrael/Astraeon.git
cd Astraeon
npm run validate
npx vercel link
npx vercel dev
```

Depois abra o endereço exibido pelo Vercel CLI.

### Variáveis do modo online

No Vercel, o modo online usa somente configuração pública no frontend:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_EXEMPLO
ASTRAEON_REALTIME_TOPIC=world:astraeon:main
```

Os valores reais devem ser configurados em **Vercel → Project → Settings → Environment Variables** e nunca copiados para documentação pública.

> Para configurar banco, variáveis de ambiente, cadastro, multiplayer e publicação em produção, siga o manual completo: **[INSTALLME.md](INSTALLME.md)**.

Também existe uma documentação técnica complementar em **[ONLINE_SETUP.md](ONLINE_SETUP.md)**.

---

## 🛠️ Admin Studio

O editor administrativo foi separado da página pública do jogo.

Em desenvolvimento:

```text
http://localhost:3000/game-editor
```

Em produção:

```text
https://SEU-DOMINIO/game-editor
```

Dentro do Editor:

- ferramentas de terreno e bioma;
- estradas e água;
- objetos e colisões;
- spawns de criaturas;
- seed procedural;
- importação/exportação JSON;
- undo/redo;
- inspeção de tiles;
- balanceamento de personagem, classes, mobs e itens;
- configuração de gameplay;
- diagnóstico do ambiente online.

`F10` abre o **Admin Studio**.

> A rota separada e `noindex` melhoram organização e exposição, mas não substituem autenticação administrativa real. Um painel de produção deve ser protegido por autorização/roles no backend.

---

## 🧪 Validação

O projeto possui validação automatizada para sintaxe JavaScript, referências HTML, arquivos obrigatórios, contratos do multiplayer e configurações de deploy.

```bash
npm run validate
```

GitHub Actions executa verificações equivalentes nas alterações do repositório.

---

## 📁 Estrutura resumida

```text
Astraeon/
├── index.html                     # jogo público
├── game-editor.html               # World Editor / Admin Studio
├── api/
│   └── config.js                  # configuração pública para o frontend
├── src/
│   ├── world-v2.js                # geração do mundo
│   ├── game-v2.js                 # engine principal
│   ├── inventory-v*.js            # inventário/equipamentos
│   ├── systems-v3b.js             # stamina, sprint e loot
│   ├── world-online-v4.js         # cidades
│   ├── npcs-v4.js                 # NPCs e diálogos
│   ├── multiplayer-v4.js          # Auth, Realtime, chat e cloud save
│   ├── online-controller-v4.js    # UX online/chat 4.1
│   └── admin-*.js                 # ferramentas administrativas
├── supabase/
│   └── migrations/                # schema Postgres/RLS
├── scripts/
│   └── validate_v2.py             # validação estrutural
├── INSTALLME.md                   # instalação e deploy
├── ONLINE_SETUP.md                # referência técnica online
├── COPYRIGHT.md                   # aviso de copyright
└── LICENSE                        # MIT License
```

---

## 📡 Estado atual

### Já compartilhado entre jogadores

- autenticação;
- perfil;
- save individual na nuvem;
- presença;
- posição e movimento;
- classe e nível visuais;
- chat mundial;
- efeitos visuais de ataques/habilidades.

### Ainda simulado localmente por cliente

- estado dos mobs;
- dano compartilhado;
- loot compartilhado;
- economia global;
- PvP;
- autoridade central de combate.

Portanto, o estágio atual é um **RPG online com multiplayer social/presença**. A evolução para um MMORPG competitivo exige um servidor autoritativo para combate, economia, inventário e estado do mundo.

---

## 🗺️ Roadmap sugerido

- [x] mundo procedural;
- [x] classes e habilidades;
- [x] inventário/equipamentos;
- [x] stamina e sprint;
- [x] cidades;
- [x] NPCs contextuais;
- [x] cadastro/login;
- [x] save em nuvem;
- [x] chat mundial;
- [x] presença multiplayer;
- [x] Admin Studio;
- [ ] autenticação administrativa por role;
- [ ] servidor autoritativo de mobs/combate;
- [ ] loot e economia compartilhados;
- [ ] party/guilda;
- [ ] comércio entre jogadores;
- [ ] PvP seguro;
- [ ] testes E2E completos com múltiplos clientes.

---

## ⚖️ Licença e direitos autorais

Copyright © 2026 **Erick Israel (eiisrael)**.

O código e a documentação originais deste repositório são disponibilizados sob a **MIT License**. O copyright permanece com o autor; a licença concede as permissões descritas em [`LICENSE`](LICENSE).

Arquivos, bibliotecas ou assets de terceiros, caso existam e estejam identificados separadamente, permanecem sujeitos às respectivas licenças e direitos de seus autores.

Consulte também [`COPYRIGHT.md`](COPYRIGHT.md).

---

<div align="center">

### ✦ ASTRAEON

**Explore · Evolua · Conecte-se · Atravesse a Convergência**

</div>

# Pelada da Quinta

Aplicacao web para organizar a pelada semanal de quinta-feira em Cachoeira do Sul.

## Stack

- Next.js (App Router + TypeScript)
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Auth.js (Credentials) para admin
- Vitest e Playwright (smoke)

## Funcionalidades do MVP

- Selecao de jogador sem senha (`/jogador`)
- Confirmacao e cancelamento de presenca na proxima partida (`/`)
- Lista de confirmados, lista de espera e pendentes
- Pos-jogo com registro de gols, assistencias e gols sofridos (`/partidas/[id]/pos-jogo`)
- Avaliacoes 0..5 por jogador
- Painel admin protegido (`/admin`)
- CRUD de jogadores e controle ativo/inativo
- Criacao/edicao de partidas, status, placar, times e presenca
- Relatorios de ranking e presenca + export CSV

## Estrutura principal

```text
.
|- prisma/
|  |- schema.prisma
|  `- seed.ts
|- src/
|  |- app/
|  |  |- api/
|  |  |- admin/
|  |  |- jogador/
|  |  `- partidas/
|  |- components/
|  `- lib/
`- tests/
   |- unit/
   |- integration/
   `- e2e/
```

## Setup local

1. Copie variaveis:

```bash
cp .env.example .env
```

2. Instale dependencias:

```bash
npm install
```

3. Gere cliente Prisma:

```bash
npm run prisma:generate
```

4. Rode migracao:

```bash
npm run prisma:migrate
```

5. Popule seed:

```bash
npm run prisma:seed
```

6. Rode em dev:

```bash
npm run dev
```

## Credenciais seed (default)

- Email: `admin@peladadaquinta.com`
- Senha: `admin123`

Recomendado mudar via `.env`:

- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`

## Scripts

- `npm run dev`
- `npm run build`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run test:e2e`
- `npm run prisma:migrate`
- `npm run prisma:migrate:deploy`
- `npm run prisma:seed`

## Bootstrap Supabase + Vercel

Como voce ja criou os projetos, agora faltam 3 passos:

1. Configurar variaveis no Vercel (Project Settings > Environment Variables):
- `DATABASE_URL`: string do Supabase Pooler (porta `6543`)
- `DIRECT_URL`: string direta do Supabase (porta `5432`)
- `AUTH_SECRET`: segredo forte para Auth.js
- `AUTH_TRUST_HOST`: `true`
- `ADMIN_SEED_EMAIL` e `ADMIN_SEED_PASSWORD`

2. Criar tabelas no Supabase:
- opcao A (recomendada): rodar `npm run prisma:migrate:deploy` com `DATABASE_URL` e `DIRECT_URL` apontando para seu Supabase;
- opcao B: executar o SQL de [prisma/migrations/20260304130000_init/migration.sql](c:\CODEX\Automations\Pelada-de-Quinta\prisma\migrations\20260304130000_init\migration.sql) no SQL Editor do Supabase.

3. Popular admin e jogadores iniciais:

```bash
npm run prisma:seed
```

Depois disso, o deploy no Vercel ja sobe com banco pronto.

## Endpoints principais

- `POST /api/admin/login`
- `POST /api/admin/logout`
- `GET /api/admin/me`
- `GET /api/players`
- `POST /api/admin/players`
- `GET /api/matches/next`
- `POST /api/matches/:id/confirm`
- `POST /api/matches/:id/cancel`
- `PUT /api/matches/:id/stats`
- `POST /api/matches/:id/ratings`
- `GET /api/admin/reports/leaderboards`
- `GET /api/admin/reports/attendance`
- `GET /api/admin/reports/export.csv`

## CI

Workflow em `.github/workflows/ci.yml` executa:

- lint
- typecheck
- testes unitarios/integracao
- build

## Observacao (Windows ARM)

Se voce estiver em Windows ARM e encontrar erro de engine do Prisma, rode o projeto com Node x64.

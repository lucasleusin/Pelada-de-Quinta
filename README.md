# Pelada da Quinta

Aplicacao web para organizar a pelada semanal de quinta-feira em Cachoeira do Sul.

## Stack

- Next.js (App Router + TypeScript)
- PWA instalavel para iPhone e Android
- Tailwind CSS
- Prisma ORM
- PostgreSQL
- Auth.js (Credentials) para admin
- Vitest e Playwright (smoke)

## Funcionalidades do MVP

- Home com lista de proximas partidas (`/`)
- Confirmacao/desconfirmacao de jogadores por partida direto na Home
- Listas de pendentes, confirmados e desconfirmados
- Pos-jogo com registro de gols, assistencias e gols sofridos (`/partidas/[id]/pos-jogo`)
- Avaliacoes 0..5 por jogador
- Pagina de estatisticas (`/estatisticas`) com historico geral e recorte por jogador
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

- Usuario: `marcio`
- Senha: `sop`

Recomendado mudar via `.env`:

- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `ADMIN_LOGIN_USERNAME`
- `ADMIN_LOGIN_PASSWORD`

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
- `npm run photos:migrate:local`
- `npm run photos:rewrite-urls`

## Storage de fotos

O app agora suporta dois drivers de storage para fotos:

- `supabase`: preserva o comportamento atual do ambiente legado.
- `local`: grava em disco e serve os arquivos em `/uploads/...`.

Selecao do driver:

- se `PHOTO_STORAGE_DRIVER` estiver definido, ele vence;
- se nao estiver definido mas `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` existirem, o app usa `supabase`;
- caso contrario, o app usa `local`.

Para o driver local:

- `PHOTO_STORAGE_DIR`: pasta onde as fotos serao gravadas;
- `PHOTO_PUBLIC_BASE_PATH`: rota publica usada para servir as fotos.

## Deploy na VPS

O fluxo novo de self-hosting esta documentado em [docs/DEPLOYMENT_VPS.md](docs/DEPLOYMENT_VPS.md).
Ele sobe a Pelada em um `docker compose` proprio, sem mexer nas outras aplicacoes da VPS, e usa:

- `Docker Compose`
- `Caddy` compartilhado
- `PostgreSQL` dedicado
- storage local persistente para fotos
- manifesto PWA + service worker no mesmo dominio HTTPS

## PWA

O sistema continua funcionando normalmente na web e agora tambem pode ser instalado como app no celular:

- Android: use `Instalar app` no navegador ou `Adicionar a tela inicial`.
- iPhone: abra no Safari e use `Compartilhar -> Adicionar a Tela de Inicio`.

O PWA usa o mesmo backend, o mesmo banco e o mesmo deploy da VPS. O suporte offline e propositalmente simples:

- telas publicas ja visitadas podem abrir sem conexao;
- confirmacoes, votos, uploads, placares e admin continuam exigindo internet.

## Deploy pelo GitHub

O repositório tambem tem deploy automatico para a VPS via GitHub Actions:

- `push` na branch `main`
- execucao manual via `workflow_dispatch`
- sync do codigo para `/opt/stacks/pelada`
- rebuild apenas da stack da Pelada
- `prisma migrate deploy` apos subir o app

O workflow usa o secret `PELADA_VPS_SSH_PRIVATE_KEY`.
Os detalhes de preparacao da chave e do servidor ficam em [docs/DEPLOYMENT_VPS.md](docs/DEPLOYMENT_VPS.md).

## Compatibilidade com Supabase

O driver `supabase` ainda existe para rollback e migracao de fotos.
Se precisar manter esse comportamento de forma temporaria, garanta no ambiente:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Bootstrap local

Para criar um ambiente do zero localmente:

1. Ajuste as variaveis em `.env`.
2. Rode `npm run prisma:migrate`.
3. Rode `npm run prisma:seed`.
4. Rode `npm run dev`.

## Migracao de fotos para o driver local

No momento do cutover, com `PHOTO_STORAGE_DRIVER=local`:

1. Baixe as fotos atuais para o storage local:

```bash
PHOTO_STORAGE_DRIVER=local npm run photos:migrate:local
```

2. Reescreva `photoUrl` para a rota local:

```bash
PHOTO_STORAGE_DRIVER=local npm run photos:rewrite-urls
```

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

# Deploy da Pelada na VPS

Este fluxo foi preparado para **nao afetar o app atual** nem outras aplicacoes da VPS.
O deploy da Pelada fica isolado em um `docker compose` proprio e usa apenas a rede compartilhada do Caddy.

## Arquivos usados

- `.env.production.example`: modelo das variaveis reais da producao.
- `deploy/pelada.env.example`: nomes do container e da rede Docker compartilhada com o Caddy.
- `deploy/docker-compose.pelada.yml`: compose isolado da Pelada.
- `deploy/Caddyfile.pelada.snippet`: bloco do subdominio no Caddy.
- `scripts/migrate-player-photos-to-local.ts`: baixa as fotos atuais e grava no storage local.
- `scripts/rewrite-photo-urls.ts`: reescreve `photoUrl` para a rota local `/uploads/...`.

## Pre-condicoes

1. `pelada.losportsconsulting.com` ja deve estar criado no Cloudflare.
2. A rede Docker compartilhada do Caddy deve existir no VPS (`caddy_proxy`, salvo customizacao em `deploy/pelada.env`).
3. Portas `80` e `443` devem continuar apontando para o Caddy ja existente.
4. Nenhum arquivo ou compose de outra aplicacao precisa ser alterado, exceto a inclusao do snippet do novo subdominio no Caddy.

## Preparacao

1. Copie `.env.production.example` para `.env.production` e preencha os segredos reais.
2. Copie `deploy/pelada.env.example` para `deploy/pelada.env`.
3. Revise se `APP_BASE_URL` esta como `https://pelada.losportsconsulting.com`.
4. Confirme se `PHOTO_STORAGE_DRIVER=local`.

## Subida segura da stack

Rode os comandos abaixo **sem derrubar nada existente**:

```bash
cd deploy
docker compose --env-file pelada.env -f docker-compose.pelada.yml up -d --build
docker compose --env-file pelada.env -f docker-compose.pelada.yml ps
docker compose --env-file pelada.env -f docker-compose.pelada.yml logs -f pelada-app
```

## Caddy

1. Adicione o conteudo de `deploy/Caddyfile.pelada.snippet` ao Caddy principal.
2. Recarregue o Caddy.
3. Valide `https://pelada.losportsconsulting.com`.

## Banco e fotos no corte

Este passo deve ser feito **apenas no momento do cutover**:

1. Congele escrita no ambiente atual.
2. Exporte o banco atual do Supabase.
3. Restaure no PostgreSQL da Pelada na VPS.
4. Rode a migracao de fotos para o storage local:

```bash
PHOTO_STORAGE_DRIVER=local npm run photos:migrate:local
```

5. Reescreva as URLs das fotos para a rota local:

```bash
PHOTO_STORAGE_DRIVER=local npm run photos:rewrite-urls
```

6. Rode as migracoes Prisma no banco novo:

```bash
docker compose --env-file deploy/pelada.env -f deploy/docker-compose.pelada.yml exec pelada-app npx prisma migrate deploy
```

## Checklist de validacao

- `https://pelada.losportsconsulting.com` abre em HTTPS.
- Login admin funciona.
- Home, estatisticas e perfil carregam normalmente.
- Upload e remocao de foto funcionam.
- Fotos antigas continuam acessiveis.
- Webhook do Twilio aponta para o host novo.

## Rollback

Se algo falhar no corte:

1. Nao altere outros apps da VPS.
2. Remova apenas o snippet `pelada.losportsconsulting.com` do Caddy.
3. Mantenha Vercel e Supabase como origem ativa.
4. Corrija a stack local e repita o processo depois.

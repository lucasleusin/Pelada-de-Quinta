# Deploy da Pelada na VPS

Este fluxo foi preparado para **nao afetar o app atual** nem outras aplicacoes da VPS.
O deploy da Pelada fica isolado em um `docker compose` proprio e usa apenas a rede compartilhada do Caddy.

## Arquivos usados

- `.env.production.example`: modelo das variaveis reais da producao.
- `deploy/pelada.env.example`: nomes do container e da rede Docker compartilhada com o Caddy.
- `deploy/docker-compose.pelada.yml`: compose isolado da Pelada.
- `deploy/Caddyfile.pelada.snippet`: bloco do subdominio no Caddy.
- `.github/workflows/ci.yml`: CI + deploy automatico para a VPS.
- `.github/rsync-exclude.txt`: lista de exclusoes para sync do repositorio.
- `scripts/deploy-vps.sh`: deploy idempotente da stack da Pelada na VPS.
- `scripts/migrate-player-photos-to-local.ts`: baixa as fotos atuais e grava no storage local.
- `scripts/rewrite-photo-urls.ts`: reescreve `photoUrl` para a rota local `/uploads/...`.

## Pre-condicoes

1. `pelada.losportsconsulting.com` ja deve estar criado no Cloudflare.
2. A rede Docker compartilhada do Caddy deve existir no VPS (`caddy_proxy`, salvo customizacao em `deploy/pelada.env`).
3. Portas `80` e `443` devem continuar apontando para o Caddy ja existente.
4. Nenhum arquivo ou compose de outra aplicacao precisa ser alterado, exceto a inclusao do snippet do novo subdominio no Caddy.
5. O host precisa continuar servindo em HTTPS, porque o PWA depende disso para `manifest.webmanifest` e `sw.js`.

## Deploy automatico pelo GitHub

O workflow em `.github/workflows/ci.yml` faz o deploy automatico para a VPS quando ha `push` em `main`.
Tambem e possivel disparar manualmente pelo `workflow_dispatch`.

### Secret necessario no GitHub

- `PELADA_VPS_SSH_PRIVATE_KEY`: chave privada `ed25519` dedicada ao deploy.

### Como criar a chave dedicada

1. Gere uma chave local nova:

```bash
ssh-keygen -t ed25519 -C "pelada-github-actions" -f ~/.ssh/pelada_github_actions -N ""
```

2. Adicione a chave publica ao usuario `deploy` da VPS:

```bash
ssh deploy@89.167.118.60 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
cat ~/.ssh/pelada_github_actions.pub | ssh deploy@89.167.118.60 "cat >> ~/.ssh/authorized_keys"
```

3. Copie o conteudo de `~/.ssh/pelada_github_actions` para o secret `PELADA_VPS_SSH_PRIVATE_KEY` no repositório do GitHub.

### O que o workflow faz

1. Roda `lint`, `typecheck`, `test` e `build`.
2. Sincroniza o repositório para `/opt/stacks/pelada` via `rsync`.
3. Executa `bash scripts/deploy-vps.sh` na VPS.
4. Rebuilda apenas `pelada-app`.
5. Roda `prisma migrate deploy`.
6. Valida a URL publica da Pelada.

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
- `https://pelada.losportsconsulting.com/manifest.webmanifest` responde corretamente.
- `https://pelada.losportsconsulting.com/sw.js` responde corretamente.
- Login admin funciona.
- Home, estatisticas e perfil carregam normalmente.
- Upload e remocao de foto funcionam.
- Fotos antigas continuam acessiveis.
- Webhook do Twilio aponta para o host novo.

## Validacao PWA

Depois do deploy, valide tambem o comportamento instalavel:

1. Android Chrome:
   - abrir o site;
   - confirmar se o navegador oferece `Instalar app`;
   - instalar e validar abertura em modo standalone.
2. iPhone Safari:
   - abrir o site;
   - usar `Compartilhar -> Adicionar a Tela de Inicio`;
   - validar abertura com icone proprio e sem a barra tradicional do navegador.
3. Offline:
   - abrir ao menos Home, Estatisticas e Meu Perfil uma vez online;
   - desligar a conexao;
   - confirmar que o shell do app continua abrindo e que a rota offline aparece quando necessario;
   - confirmar que envios e alteracoes mostram falha clara sem internet.

## Rollback

Se algo falhar no corte:

1. Nao altere outros apps da VPS.
2. Remova apenas o snippet `pelada.losportsconsulting.com` do Caddy.
3. Mantenha Vercel e Supabase como origem ativa.
4. Corrija a stack local e repita o processo depois.

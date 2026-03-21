# Pelada da Quinta — Regras de Produto

## Regras gerais
- UI e comunicacao em PT-BR.
- Jogadores podem ter o mesmo nome.
- Duplicidade automatica de jogador ou vinculo com conta so deve considerar email.
- Registros fundidos nao somem do banco, mas ficam ocultos do uso normal.

## Autenticacao e onboarding
- Todo usuario novo deve nascer com `User + Player` vinculados.
- Cadastro local cria conta em `PENDING_VERIFICATION`.
- Depois de confirmar email, a conta vira `ACTIVE` e vai para `Meu Perfil`.
- Login social Google/Microsoft cria ou vincula conta ao mesmo email e entra como `ACTIVE`.
- Nao existe mais aprovacao manual de cadastro no fluxo normal.

## Identidade exibida na UI
Ao mostrar o usuario logado, a ordem correta e:
1. `playerNickname`
2. `playerName`
3. `user.nickname`
4. `user.name`
5. fallback textual

## Home
### Visitante
- usa confirmacao rapida publica
- lista apenas jogadores ativos sem conta vinculada
- mantem o ultimo jogador escolhido
- abaixo mostra apenas confirmados

### Jogador logado sem admin
- mantem o widget autenticado atual
- pode confirmar/desconfirmar a propria presenca
- ve a lista lateral de confirmados

### Admin logado
- ve o widget autenticado da propria presenca
- nao ve o card lateral de confirmados do fluxo autenticado
- ve os blocos publicos da Home abaixo
- usa a base global de partidas futuras

## Partidas anteriores
- admin pode editar qualquer partida anterior
- jogador comum so pode editar o ultimo jogo anterior global e somente se tiver jogado
- score e estatisticas usam autosave
- a tela nao exibe notas do jogo

## Admin > Partidas
- admin pode criar, arquivar e editar partidas
- placar usa inputs compactos e autosave
- nas listas dos times A e B existem caixas para `G`, `A` e `GS` por jogador
- jogador pode estar em Time A e Time B ao mesmo tempo; existe time principal quando necessario

## Unificacao de jogadores
- ocorre em `/admin/jogadores/unificar`
- inativos nao aparecem nas listas de unificacao
- a unificacao e player-only
- se o principal nao tiver foto e o secundario tiver, a foto migra para o principal
- o merge nao pode derrubar o ultimo admin ativo

## Admin > Jogadores
- tela unificada de jogador + conta vinculada
- blocos principais:
  - ativos
  - aguardando confirmacao de email
  - inativos colapsados
- nao usar badge de `Atleta`; so destacar `Admin`

## Favicon e branding
- o favicon configurado no admin e a fonte de verdade
- fallback antigo so vale quando nao houver favicon configurado

## Producao e banco
- deploy oficial vai para a VPS
- o banco de producao pode ser diferente do banco do `.env` local
- antes de qualquer manutencao de dados reais, validar o ambiente correto

# Pelada da Quinta — Thread Context Summary

Este arquivo agora e apenas um ponto de entrada rapido.

Para qualquer novo chat ou handoff, leia nesta ordem:
1. `docs/PROJECT_CONTEXT.md`
2. `docs/PRODUCT_RULES.md`
3. `docs/IMPORTANT_DECISIONS.md`
4. `docs/DEPLOYMENT_VPS.md`
5. `README.md`

## Resumo curtissimo
- O sistema e player-centric.
- Duplicidade automatica considera email, nao nome.
- Cadastro nao depende mais de aprovacao manual.
- Home tem 3 cenarios: visitante, jogador logado e admin logado.
- Producao roda na VPS e o banco de producao pode nao ser o mesmo do `.env` local.

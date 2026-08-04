# Publicacao de homologacao do Servix

Este guia prepara um ambiente de teste. Ele nao habilita cobrancas reais.

## Fronteira financeira

- **Empresa paga a assinatura do Servix:** dominio `AssinaturaEmpresa`, conta e
  credenciais exclusivas do Servix. No MVP, `SERVIX_BILLING_MODE=TESTE` usa um
  simulador e nao movimenta dinheiro.
- **Cliente paga um orcamento:** dominio `Cobranca`/`Pagamento`. O backend resolve
  exclusivamente o token OAuth cifrado da empresa dona do orcamento e o valor
  segue para a conta Mercado Pago dessa empresa.

Nunca reutilize `IntegracaoPagamento`, `obterCredencialMercadoPagoService` ou
`resolverGatewayPagamento` no codigo de assinaturas. A futura integracao real de
assinaturas deve ler apenas variaveis com prefixo `SERVIX_BILLING_` e permanecer
server-side.

## 1. Banco e backend de teste

Use PostgreSQL gerenciado e um host que execute containers ou um processo Node
persistente. O arquivo `backend/Dockerfile` compila a API, aplica migrations
pendentes e inicia o servidor.

Configure no host do backend:

O mesmo modelo, pronto para copiar campo a campo, esta em
`backend/railway.env.example`.

```env
NODE_ENV=production
HOST=0.0.0.0
DATABASE_URL=postgresql://...
JWT_SECRET=<segredo-aleatorio-com-32-ou-mais-caracteres>
TRUST_PROXY=true

FRONTEND_URL=https://SEU-FRONTEND.vercel.app
CORS_ORIGINS=https://SEU-FRONTEND.vercel.app

SERVIX_BILLING_MODE=TESTE
SERVIX_SUBSCRIPTIONS_MP_MODE=TESTE
SERVIX_CUSTOMER_PAYMENTS_MP_MODE=DESABILITADO
SERVIX_PAYMENT_SIMULATOR_ENABLED=false
SERVIX_FINANCEIRO_MODE=PREVIEW

MERCADO_PAGO_SUBSCRIPTIONS_TESTE_ACCESS_TOKEN=<token-da-conta-seller-de-teste>
MERCADO_PAGO_SUBSCRIPTIONS_TESTE_BACK_URL=https://SEU-FRONTEND.vercel.app
MERCADO_PAGO_SUBSCRIPTIONS_TESTE_WEBHOOK_SECRET=<segredo-exclusivo-de-teste>

MERCADO_PAGO_OAUTH_TESTE_CLIENT_ID=<app-oauth-sandbox-do-servix>
MERCADO_PAGO_OAUTH_TESTE_CLIENT_SECRET=<segredo-do-app-oauth-sandbox>
MERCADO_PAGO_OAUTH_TESTE_REDIRECT_URI=https://SEU-BACKEND.example.com/integracoes/mercado-pago/callback
MERCADO_PAGO_OAUTH_TESTE_TOKEN_ENCRYPTION_KEY=<base64-de-32-bytes>
MERCADO_PAGO_TIMEOUT_MS=8000
```

No Railway, nao defina `PORT`: a plataforma injeta a porta dinamicamente. O
servidor le `process.env.PORT` e usa `0.0.0.0` automaticamente em
`NODE_ENV=production`; `HOST=0.0.0.0` pode permanecer explicito para facilitar
a auditoria da configuracao.

Configure o deploy do servico com:

```txt
Build Command: npm run build
Pre-deploy Command: npm run db:deploy
Start Command: npm start
Healthcheck Path: /health
```

`db:deploy` falha fechado antes de executar o Prisma se
`SERVIX_FINANCEIRO_MODE` não for exatamente `PREVIEW`. Enquanto a migration do
financeiro preview estiver incluída no artefato, não use o comando de escape
`prisma:migrate:deploy:raw` no Railway nem em outro pipeline comum.

Gere valores novos para `JWT_SECRET` e para cada chave
`MERCADO_PAGO_OAUTH_*_TOKEN_ENCRYPTION_KEY` em cada ambiente.
Nao copie segredos locais para homologacao e nunca coloque esses valores no
frontend.

Depois da publicacao, valide:

1. `GET https://SEU-BACKEND.example.com/health` retorna banco e API como `ok`.
2. As migrations aparecem como aplicadas no log de inicializacao.
3. `GET /assinaturas/planos` informa ambiente `TESTE`.

## 2. Frontend na Vercel

Crie o projeto apontando o **Root Directory** para `frontend`:

- Framework: Vite.
- Comando de build: `npm run build`.
- Diretorio de saida: `dist`.
- Variavel: `VITE_API_URL=https://SEU-BACKEND.example.com`.
- Canais publicos: `VITE_CONTACT_EMAIL` e `VITE_SUPPORT_EMAIL`.

O `frontend/vercel.json` mantem as rotas do React Router funcionando quando uma
URL e aberta diretamente.

## 3. Callback OAuth publico

A aplicação e as credenciais do Mercado Pago devem ser administradas pelo
titular adulto responsável pela conta da empresa.

Cadastre no aplicativo Mercado Pago exatamente:

```txt
https://SEU-BACKEND.example.com/integracoes/mercado-pago/callback
```

O valor deve ser HTTPS, publico e identico a
`MERCADO_PAGO_OAUTH_TESTE_REDIRECT_URI`, sem
barra adicional. Enquanto o OAuth estiver em desenvolvimento, mantenha
`SERVIX_CUSTOMER_PAYMENTS_MP_MODE=DESABILITADO` e não inicie conexões.

## 4. Roteiro de homologacao

1. Abra a home, planos, contato, suporte, termos e privacidade.
2. Cadastre uma empresa e confirme a assinatura simulada.
3. Confirme que o login fica bloqueado antes da ativacao e e liberado depois.
4. No dashboard da empresa, conecte uma conta Mercado Pago de teste via OAuth.
5. Gere um orcamento e confira que a cobranca registra o `mercadoPagoUserId` da
   empresa conectada.
6. Repita com uma segunda empresa e confirme o isolamento entre as contas.

## 5. Antes de qualquer producao real

O titular responsavel deve revisar Termos e Politica de Privacidade, cadastrar
URLs e credenciais de producao, definir webhooks assinados, validar o recebedor
da assinatura e dos orcamentos, revisar logs/alertas/backups e executar testes de
baixo valor. Alterar `NODE_ENV` nao habilita dinheiro real; os modos financeiros
sao deliberadamente independentes. Use `backend/railway.production.env.example`
como checklist: nomes com `PRODUCAO` nunca consultam segredos de `TESTE` nem os
nomes legados temporariamente aceitos na homologacao.

O canal publico de suporte e privacidade e `suporte.vercel@gmail.com`. Antes de
aceitar clientes, os documentos legais ainda devem receber o nome ou razao
social, CPF ou CNPJ e endereco fisico do fornecedor responsavel pelo Servix.

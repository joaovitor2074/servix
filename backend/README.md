# Servix Backend

API para gestão de clientes, orçamentos, ordens de serviço e pagamentos,
construída com Express, TypeScript, PostgreSQL e Prisma.

## Requisitos

- Node.js 22 ou superior
- PostgreSQL

## Configuração

```bash
npm install
cp .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
```

No Windows PowerShell, copie o ambiente com:

```powershell
Copy-Item .env.example .env
```

Configure `DATABASE_URL`, um `JWT_SECRET` com pelo menos 32 caracteres e as
origens do frontend em `CORS_ORIGINS`.

Valores locais também podem ficar em `.env.local`; esse arquivo tem prioridade
sobre `.env` e não é versionado.

## Primeiro administrador

Preencha as variáveis `ADMIN_*` do `.env` e execute:

```bash
npm run admin:create
```

Se a empresa indicada por `ADMIN_EMPRESA_SLUG` não existir, o comando também
cria a empresa usando `ADMIN_EMPRESA_NOME`.

## Execução

```bash
npm run dev
```

Para produção:

```bash
npm run build
npm start
```

## Autenticação

Faça login em `POST /auth/login`:

```json
{
  "empresaSlug": "minha-assistencia",
  "email": "admin@exemplo.com",
  "senha": "sua-senha"
}
```

Envie o token nas demais rotas:

```text
Authorization: Bearer TOKEN
```

O `empresaId` é extraído do token. A API nunca aceita esse campo no corpo da
requisição.

## Rotas

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/` | Estado básico da API |
| GET | `/health` | Prontidão da API e do banco |
| POST | `/auth/login` | Login |
| GET | `/auth/me` | Usuário autenticado |
| GET/POST | `/clientes` | Listar e criar clientes |
| GET/PUT/DELETE | `/clientes/:id` | Consultar, atualizar e remover cliente |
| GET/POST | `/orcamentos` | Listar e criar orçamentos |
| GET/PATCH | `/orcamentos/:id` | Consultar ou editar um rascunho |
| PATCH | `/orcamentos/:id/status` | Alterar status com controle de versão |
| POST | `/orcamentos/:id/transformar-em-ordem` | Criar a OS de um orçamento aprovado |
| GET | `/publico/orcamentos/:token` | Consultar orçamento pelo link público |
| POST | `/publico/orcamentos/:token/aprovar` | Aprovar orçamento pelo link público |
| POST | `/publico/orcamentos/:token/rejeitar` | Rejeitar orçamento pelo link público |
| GET | `/publico/orcamentos/:token/cobranca` | Consultar a cobrança pública mais recente |
| POST | `/publico/orcamentos/:token/cobrancas` | Gerar Pix com `Idempotency-Key` e rate limit |
| GET | `/publico/ordens/:token` | Consultar o acompanhamento sanitizado da OS |
| GET | `/ordens` | Listar ordens |
| POST | `/ordens` | Bloqueado (`405`): a OS nasce de um orçamento aprovado |
| GET/PUT/PATCH/DELETE | `/ordens/:id` | Operações de uma ordem |
| PATCH | `/ordens/:id/status` | Alterar status |
| GET | `/ordens/:id/historico` | Histórico de status |
| GET/POST | `/ordens/:id/pagamentos` | Listar ou registrar pagamentos |
| POST | `/ordens/:id/pagamentos/:pagamentoId/estorno` | Estornar um pagamento |
| GET/PATCH | `/configuracoes/pagamentos` | Consultar ou atualizar a configuração de pagamento (ADMIN) |
| POST | `/configuracoes/pagamentos/mercado-pago/oauth/iniciar` | Iniciar a conexão OAuth da empresa e devolver a URL de autorização (ADMIN) |
| DELETE | `/configuracoes/pagamentos/mercado-pago` | Desconectar a conta Mercado Pago da empresa (ADMIN) |
| GET | `/integracoes/mercado-pago/callback` | Receber o callback OAuth e redirecionar para as configurações |
| GET | `/cobrancas` | Listar cobranças da empresa autenticada |
| POST | `/cobrancas` | Criar cobranças de teste (ADMIN) |
| GET | `/cobrancas/:id` | Consultar uma cobrança da empresa |
| POST | `/cobrancas/:id/simular-confirmacao` | Confirmar cobrança simulada fora de produção (ADMIN) |

As listagens aceitam `pagina`, `limite` e `busca`. Orçamentos e ordens também
aceitam filtros de `status` e `clienteId`.

O fluxo comercial é:

```text
Cliente → orçamento → aprovação → ordem de serviço → execução → pagamento → entrega
```

Um orçamento começa como `RASCUNHO`, pode ser enviado ao cliente e só pode ser
aprovado ou rejeitado pelo link público. Somente `APROVADO` pode ser
transformado em OS. A
transformação é transacional e idempotente: chamadas repetidas devolvem a mesma
ordem, sem duplicar a OS ou o histórico. Os valores, equipamento e problema da
ordem vêm do orçamento e não podem ser alterados diretamente depois da conversão.

Orçamentos usam `statusEsperado` e `versaoEsperada` nas operações mutáveis. Uma
alteração concorrente responde `409` com `ORCAMENTO_ATUALIZACAO_CONFLITANTE`.
Se o prazo terminar antes da aprovação, o orçamento passa atomicamente para
`EXPIRADO`.

Status válidos: `RECEBIDO`, `EM_ANALISE`, `EM_EXECUCAO`,
`AGUARDANDO_PECA`, `PRONTO`, `ENTREGUE` e `CANCELADO`.

Os estados de aprovação pertencem ao orçamento e não fazem parte do ciclo da
ordem de serviço. Para atualizar uma ordem, envie o estado que foi carregado:

```json
{
  "statusEsperado": "EM_ANALISE",
  "versaoEsperada": 3,
  "status": "EM_EXECUCAO"
}
```

O backend compara status e versão de forma atômica. Se outra pessoa já tiver
alterado a ordem, a API responde `409` com o código
`ORDEM_ATUALIZACAO_CONFLITANTE`; o cliente deve recarregar os dados. A mesma
regra vale para `PATCH /ordens/:id/status` e para o cancelamento por `DELETE`.

Pagamentos confirmados podem ser parciais e o saldo é sempre calculado a partir
do livro de registros. Registrar ou estornar também exige a fotografia atual da
OS (`statusEsperado` e `versaoEsperada`). A transição para `ENTREGUE` só ocorre
quando o total confirmado cobre integralmente o valor da ordem. Uma ordem com
pagamentos ativos não pode ser cancelada, e pagamentos de uma ordem entregue ou
cancelada ficam bloqueados.

A fundação de gateways mantém `Cobranca` separada de `Pagamento`. A cobrança
representa uma solicitação ainda pendente no provedor; o pagamento só entra no
ledger quando existe confirmação. Cada empresa possui sua própria
`ConfiguracaoPagamento`, atualizada com controle otimista por `versaoEsperada`.
O provedor `SIMULADO` produz somente códigos claramente fictícios, funciona
apenas em teste/desenvolvimento e nunca movimenta dinheiro. Mercado Pago usa
uma conexão OAuth sandbox isolada por empresa. Se o provedor devolver
`live_mode=true`, o Servix descarta
os tokens, finaliza a tentativa OAuth e não cria nem altera a integração da
empresa.
Cobranças em produção continuam bloqueadas de propósito. Asaas
permanece indisponível até uma integração futura.

Uma cobrança pode ser criada depois da aprovação e antes da OS. Nesse caso ela
fica vinculada ao orçamento; se for confirmada, será materializada uma única vez
no ledger durante a conversão do orçamento em ordem. A chave de idempotência e a
relação única entre cobrança e pagamento impedem lançamentos duplicados.

No link público, o cliente escolhe a forma de pagamento ao aprovar. Quando o
Pix estiver habilitado, o navegador gera a cobrança por uma rota limitada a oito
tentativas por minuto e envia `Idempotency-Key`; repetir a mesma tentativa
devolve a mesma cobrança. A consulta pública expõe somente valor, código Pix,
vencimento e estado. Pendências vencidas passam para `EXPIRADA` antes de serem
exibidas, e a tela acompanha `PENDENTE`, `PAGA` e `EXPIRADA` por atualização
periódica.

Cada ordem possui um `tokenAcompanhamento` exclusivo, diferente do token do
orçamento. `GET /publico/ordens/:token` não exige autenticação, recebe rate
limit dedicado e responde com `Cache-Control: no-store`. O contrato usa uma
lista positiva: empresa, número apresentado da OS, equipamento, status,
previsão, valor aprovado, resumo do pagamento e histórico público. IDs
relacionados, cliente, atores, diagnóstico, custos e demais campos internos não
são selecionados nem devolvidos.

Uma mudança de status pode receber `mensagemPublica` com até 500 caracteres.
Ela é gravada na mesma transação do histórico somente quando ocorre uma
transição real; edições técnicas isoladas não podem publicar mensagens. O
frontend interno orienta o funcionário a não incluir diagnósticos, custos ou
dados sensíveis nesse texto.

No cancelamento, envie a fotografia no corpo ou na query string. Também é
possível alterar o status para `CANCELADO` pela rota dedicada:

```json
{
  "statusEsperado": "EM_EXECUCAO",
  "versaoEsperada": 4
}
```

Exemplo equivalente: `DELETE /ordens/15?statusEsperado=EM_EXECUCAO&versaoEsperada=4`.

As migrations do novo fluxo devem ser publicadas em uma janela coordenada com
backend e frontend, pois versões antigas não entendem o novo contrato. Faça
backup do banco antes de `npm run prisma:migrate:deploy`. Ordens legadas recebem
um orçamento já convertido; ordens entregues com valor positivo recebem um
registro de pagamento de migração. Se os dados legados forem inconsistentes, a
migration aborta sem aplicar alterações parciais.

## Qualidade

```bash
npm run prisma:validate
npm run typecheck
npm test
```

As migrations são aplicadas em produção com `npm run prisma:migrate:deploy`.

## Mercado Pago por empresa (OAuth)

O Servix usa uma única aplicação cadastrada no Mercado Pago, mas mantém uma
conexão OAuth independente para cada empresa. Configure as credenciais globais
somente no ambiente do backend:

```env
MERCADO_PAGO_CLIENT_ID=""
MERCADO_PAGO_CLIENT_SECRET=""
MERCADO_PAGO_REDIRECT_URI="http://localhost:3005/integracoes/mercado-pago/callback"
TOKEN_ENCRYPTION_KEY=""
FRONTEND_URL="http://localhost:5173"
MERCADO_PAGO_TIMEOUT_MS=8000
```

O `MERCADO_PAGO_REDIRECT_URI` precisa coincidir exatamente com a URL cadastrada
no provedor. `FRONTEND_URL` é a origem para a qual o callback redireciona o
administrador após concluir ou rejeitar a conexão.

`TOKEN_ENCRYPTION_KEY` não é uma senha: deve ser uma chave Base64 que represente
exatamente 32 bytes. Gere uma chave diferente para cada ambiente e mantenha uma
cópia segura, pois trocá-la sem recriptografar os dados invalida as conexões já
salvas:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

O fluxo é iniciado por um administrador autenticado em
`POST /configuracoes/pagamentos/mercado-pago/oauth/iniciar`. O backend cria um
`state` curto e de uso único, prepara PKCE e devolve apenas a URL de autorização.
O Mercado Pago retorna `code` e `state` para
`GET /integracoes/mercado-pago/callback`; o backend valida a tentativa, troca o
código por uma credencial sandbox usando `test_token=true` e associa a conexão
à empresa que iniciou o fluxo. O callback
redireciona de volta às configurações com `mercadoPago=conectado` ou, sem expor
segredos, `mercadoPago=erro&codigo=...`.

Os tokens de acesso e renovação são criptografados antes de serem persistidos.
Cada cobrança resolve o `empresaId` do orçamento ou da ordem e usa somente a
integração dessa empresa. O frontend nunca recebe credenciais, não escolhe o
`empresaId` da conexão e não pode consultar a integração de outra empresa.
Quando o access token expira, o backend usa o refresh token e salva de forma
atômica tanto o novo access token quanto o refresh token rotacionado. A rota
`DELETE /configuracoes/pagamentos/mercado-pago` desconecta somente a empresa do
administrador autenticado.

Criar uma Order, trocar a conta e desconectar usam o mesmo bloqueio transacional
por empresa. Uma cobrança pendente ou ainda não conciliada impede a troca e a
remoção da credencial, inclusive quando o POST pode ter sido aceito mas a
resposta do provedor não chegou ao Servix.

Somente conexões de teste (`live_mode=false`) podem alimentar o gateway nesta
etapa. Em uma autorização de produção, access token e refresh token não são
persistidos e nenhum registro de integração é criado ou atualizado.

Não registre `code`, tokens, segredo da aplicação, chave de criptografia ou
verificador PKCE em logs. A conexão e a desconexão são exclusivas de
administradores. Antes de qualquer operação real, valide o fluxo em ambiente de
teste; qualquer teste com dinheiro deve ser realizado apenas pelo titular adulto
e responsável da conta autorizada.

## Mercado Pago em ambiente de teste

O teste multiempresa usa exclusivamente o OAuth com `test_token=true`. Tokens
avulsos como `MERCADO_PAGO_ACCESS_TOKEN_TESTE` não são lidos pelo fluxo de
cobrança: os prefixos de teste e produção podem ser iguais e não comprovam o
ambiente com segurança. Cada empresa deve autorizar a própria conta sandbox na
tela de pagamentos. A integração fica desativada em `NODE_ENV=production` e
aceita somente `AmbientePagamento.TESTE` nesta etapa.

O Pix usa a Orders API do Mercado Pago. Em teste, o pagador predefinido `APRO`
faz a order sair de `action_required/waiting_transfer` para
`processed/accredited`. As consultas públicas sincronizam esse estado com
intervalo mínimo, respeitam `Retry-After` em respostas 429 e a conciliação do
pagamento no ledger continua idempotente. O backend também confere `user_id`,
`external_reference`, valor e método Pix antes de aceitar uma resposta.

Esta integração usa exclusivamente a API do Mercado Pago
(`api.mercadopago.com`); não há chamadas para a API comercial do Mercado Livre.

### Antes de liberar produção

O bloqueio de produção deve permanecer até existirem notificações assinadas do
tópico Order como fonte principal, renovação agendada de conexões sem uso e
conciliação de reembolsos, estornos parciais e chargebacks. Também é necessário
recuperar automaticamente uma resposta perdida na criação por replay idempotente
ou busca por `external_reference`. O polling atual é somente uma contingência
apropriada ao ambiente de teste. Qualquer teste com dinheiro real deve ser
conduzido pelo titular adulto e responsável da conta.

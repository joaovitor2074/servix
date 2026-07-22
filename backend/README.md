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
| GET | `/ordens` | Listar ordens |
| POST | `/ordens` | Bloqueado (`405`): a OS nasce de um orçamento aprovado |
| GET/PUT/PATCH/DELETE | `/ordens/:id` | Operações de uma ordem |
| PATCH | `/ordens/:id/status` | Alterar status |
| GET | `/ordens/:id/historico` | Histórico de status |
| GET/POST | `/ordens/:id/pagamentos` | Listar ou registrar pagamentos |
| POST | `/ordens/:id/pagamentos/:pagamentoId/estorno` | Estornar um pagamento |

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

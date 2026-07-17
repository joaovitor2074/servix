# Servix Backend

API para gestão de clientes e ordens de serviço, construída com Express,
TypeScript, PostgreSQL e Prisma.

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
| GET/POST | `/ordens` | Listar e criar ordens |
| GET/PUT/PATCH/DELETE | `/ordens/:id` | Operações de uma ordem |
| PATCH | `/ordens/:id/status` | Alterar status |
| GET | `/ordens/:id/historico` | Histórico de status |

As listagens aceitam `pagina`, `limite` e `busca`. Ordens também aceitam
`status` e `clienteId`.

Status válidos: `ABERTA`, `EM_ANALISE`, `AGUARDANDO_APROVACAO`, `APROVADA`,
`EM_ANDAMENTO`, `AGUARDANDO_PECA`, `CONCLUIDA`, `ENTREGUE` e `CANCELADA`.

## Qualidade

```bash
npm run prisma:validate
npm run typecheck
npm test
```

As migrations são aplicadas em produção com `npm run prisma:migrate:deploy`.

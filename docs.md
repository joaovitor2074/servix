# Documentação do Servix

Este arquivo registra o estado atual do projeto, explica como as partes se
conectam e resume o trabalho realizado até agora. Ele deve ser atualizado à
medida que novas funcionalidades forem concluídas.

## 1. Objetivo do projeto

O Servix é um sistema para empresas que gerenciam clientes e ordens de
serviço. Cada usuário pertence a uma empresa e só pode acessar os dados dessa
empresa.

O repositório está dividido em:

- `backend/`: API REST criada com Express, TypeScript, Prisma e PostgreSQL.
- `frontend/`: aplicação web criada com React, TypeScript e Vite.

## 2. Tecnologias usadas

### Backend

- Node.js e TypeScript;
- Express para rotas e middlewares HTTP;
- Prisma para acesso ao PostgreSQL;
- Zod para validação dos dados recebidos;
- JWT para autenticação;
- bcrypt para hash e comparação de senhas;
- Vitest e Supertest para testes;
- Helmet, CORS e rate limit para proteções HTTP básicas.

### Frontend

- React e TypeScript;
- Vite para o ambiente de desenvolvimento e build;
- Zod para validar o formulário de login;
- React Hook Form e `@hookform/resolvers` já instalados para uma futura
  integração, embora o formulário atual ainda use `FormData`.

## 3. Como executar o projeto

### Backend

Na pasta `backend`:

```powershell
npm install
Copy-Item .env.example .env
npm run prisma:generate
npm run prisma:migrate:deploy
npm run dev
```

O backend usa `http://localhost:3005` por padrão. Antes de iniciá-lo, configure
no `.env`:

- `DATABASE_URL`: conexão com o PostgreSQL;
- `JWT_SECRET`: segredo com pelo menos 32 caracteres;
- `CORS_ORIGINS`: endereços autorizados a chamar a API.

Para criar ou atualizar o primeiro administrador, configure as variáveis
`ADMIN_*` e execute:

```powershell
npm run admin:create
```

### Frontend

Em outro terminal, na pasta `frontend`:

```powershell
npm install
npm run dev
```

O Vite normalmente disponibiliza a aplicação em `http://localhost:5173`.

## 4. Arquitetura do backend

Uma requisição normalmente percorre este caminho:

```text
Cliente HTTP
    ↓
app.ts e arquivo de rotas
    ↓
middlewares de autenticação/autorização
    ↓
controller
    ↓
validator (Zod)
    ↓
service (regra de negócio)
    ↓
Prisma e PostgreSQL
    ↓
resposta JSON
```

Responsabilidade de cada pasta:

- `routes/`: associa método e URL a um controller.
- `middlewares/`: executa regras comuns antes ou depois do controller.
- `controllers/`: recebe a requisição e escolhe o status HTTP da resposta.
- `validators/`: valida e normaliza corpo, parâmetros e query string.
- `services/`: contém regras de negócio e consultas ao banco.
- `rules/`: regras de domínio puras, sem dependência do Express ou banco.
- `lib/`: integrações e utilitários, como o cliente Prisma.
- `errors/`: erros conhecidos da aplicação.
- `config/`: leitura e validação das variáveis de ambiente.
- `scripts/`: comandos administrativos executados fora da API.
- `types/`: extensões de tipos usadas pelo Express.
- `prisma/`: modelo do banco e migrations.

## 5. Segurança e separação por empresa

O Servix é multiempresa. Depois que um token é validado, o middleware coloca
estas informações em `req.auth`:

```ts
{
  usuarioId: number
  empresaId: number
  papel: 'ADMIN' | 'ATENDENTE' | 'TECNICO'
}
```

Os services recebem `empresaId` e o incluem nas consultas. Isso impede que um
usuário consulte um registro de outra empresa apenas alterando o ID presente
na URL.

O backend nunca deve confiar em um `empresaId` enviado pelo frontend. A fonte
confiável é o usuário encontrado após a validação do token.

## 6. Fluxo de autenticação

### Login

O frontend envia:

```http
POST /auth/login
Content-Type: application/json
```

```json
{
  "empresaSlug": "minha-assistencia",
  "email": "admin@exemplo.com",
  "senha": "sua-senha"
}
```

O backend:

1. limita tentativas repetidas na rota de login;
2. valida e normaliza os dados com Zod;
3. procura um usuário ativo pelo e-mail e pelo slug da empresa;
4. compara a senha com o hash salvo no banco;
5. cria um JWT válido por oito horas;
6. devolve o token e um resumo do usuário.

Formato da resposta de sucesso:

```json
{
  "token": "jwt",
  "expiresIn": 28800,
  "usuario": {
    "id": 1,
    "nome": "Administrador",
    "email": "admin@exemplo.com",
    "papel": "ADMIN",
    "empresa": {
      "id": 1,
      "nome": "Minha Assistência",
      "slug": "minha-assistencia"
    }
  }
}
```

Nas rotas protegidas, o frontend deverá enviar:

```http
Authorization: Bearer TOKEN
```

O endpoint `GET /auth/me` permite validar o token e recuperar o usuário atual.

## 7. Funcionalidades existentes no backend

### Empresas

- criação de empresa junto com o primeiro administrador;
- normalização do slug e do e-mail;
- senha armazenada como hash, nunca em texto puro.

### Usuários

- criação, listagem, busca e atualização;
- ativação e desativação;
- autorização administrativa nas rotas;
- proteção contra desativar a própria conta;
- proteção contra desativar ou rebaixar o único administrador ativo.

### Clientes

- criação, listagem paginada, busca, atualização e remoção;
- pesquisa por nome, telefone ou CPF/CNPJ;
- telefone único dentro de cada empresa;
- bloqueio de remoção quando o cliente possui ordens.

### Ordens de serviço

- criação exclusivamente pela conversão de orçamento aprovado;
- listagem paginada, busca e atualização dos dados técnicos;
- filtros por texto, cliente e status;
- alteração controlada de status;
- estados operacionais separados da aprovação do orçamento;
- concorrência otimista por status e versão esperados;
- resposta `409` quando outra pessoa altera a ordem primeiro;
- histórico de cada alteração de status;
- cancelamento lógico no lugar de exclusão física;
- transações para manter ordem e histórico consistentes.

O ciclo operacional da ordem é:

```text
RECEBIDO → EM_ANALISE → EM_EXECUCAO → PRONTO → ENTREGUE
                              ↕
                       AGUARDANDO_PECA
```

`CANCELADO` pode encerrar uma ordem ainda aberta. Aprovação e rejeição são
estados do orçamento e, por isso, não aparecem mais em `StatusOrdem`.

### Orçamentos

- criação e edição de rascunhos com itens de serviço, peça ou material;
- subtotal, desconto e total calculados no backend;
- envio, expiração, cancelamento e reabertura controlados pela empresa;
- aprovação e rejeição exclusivas do cliente pelo link público;
- link público imprevisível para o cliente consultar e responder;
- concorrência otimista por status e versão;
- transformação transacional e idempotente de orçamento aprovado em OS;
- histórico de cada mudança de status.

### Pagamentos

- múltiplos pagamentos parciais por ordem;
- formas PIX, dinheiro, cartão, boleto ou outra;
- resumo financeiro calculado a partir dos registros confirmados;
- estorno com motivo, autor e data preservados;
- concorrência otimista vinculada à versão da OS;
- bloqueio da entrega enquanto houver saldo pendente;
- bloqueio do cancelamento enquanto houver pagamento confirmado.

O fluxo completo agora é:

```text
Cliente cadastrado
       ↓
Orçamento criado e enviado
       ↓
Cliente aprova
       ↓
Ordem de serviço criada a partir do orçamento
       ↓
Serviço executado e acompanhado pelo cliente
       ↓
Pagamento integral registrado
       ↓
Serviço entregue
```

O frontend conduz esse caminho sem obrigar o funcionário a procurar a próxima
tela: após cadastrar o cliente, oferece criar um orçamento com o cadastro já
selecionado; após salvar o orçamento, orienta o envio do link para aprovação;
quando o cliente aprova, destaca a criação da OS como próximo passo.

A dashboard funciona como central operacional. Ela mostra serviços em aberto,
ordens aguardando peça, pagamento ou entrega, a distribuição por etapa e os
orçamentos enviados ou aprovados que ainda exigem ação. Cada indicador e cada
pendência levam diretamente à lista filtrada ou à ordem correspondente.

`POST /ordens` não cria mais ordens e responde `405` com o código
`ORDEM_EXIGE_ORCAMENTO_APROVADO`.

Toda atualização ou cancelamento recebe `statusEsperado` e `versaoEsperada`. O
banco faz um único `UPDATE` condicionado a esses valores e incrementa `versao`.
A linha do histórico só é criada na mesma transação depois que essa atualização
vence, impedindo duas gravações simultâneas para a mesma versão.

## 8. Rotas atuais

| Método | Rota | Autenticação | Finalidade |
| --- | --- | --- | --- |
| `GET` | `/` | Não | Informa que a API está online |
| `GET` | `/health` | Não | Verifica API e banco |
| `POST` | `/auth/login` | Não | Autentica o usuário |
| `GET` | `/auth/me` | Sim | Retorna o usuário atual |
| `POST` | `/empresa` | Não | Cria empresa e administrador |
| `GET` | `/clientes` | Sim | Lista clientes |
| `POST` | `/clientes` | Sim | Cria cliente |
| `GET` | `/clientes/:id` | Sim | Busca cliente |
| `PUT` | `/clientes/:id` | Sim | Atualiza cliente |
| `DELETE` | `/clientes/:id` | Sim | Remove cliente quando permitido |
| `GET` | `/orcamentos` | Sim | Lista orçamentos |
| `POST` | `/orcamentos` | Sim | Cria orçamento em rascunho |
| `GET` | `/orcamentos/:id` | Sim | Busca orçamento |
| `PATCH` | `/orcamentos/:id` | Sim | Edita orçamento em rascunho |
| `PATCH` | `/orcamentos/:id/status` | Sim | Altera status com controle de versão |
| `POST` | `/orcamentos/:id/transformar-em-ordem` | Sim | Converte orçamento aprovado em OS |
| `GET` | `/publico/orcamentos/:token` | Não | Exibe orçamento pelo link público |
| `POST` | `/publico/orcamentos/:token/aprovar` | Não | Aprova pelo link público |
| `POST` | `/publico/orcamentos/:token/rejeitar` | Não | Rejeita pelo link público |
| `GET` | `/ordens` | Sim | Lista ordens |
| `POST` | `/ordens` | Sim | Responde `405`; use a conversão do orçamento |
| `GET` | `/ordens/:id` | Sim | Busca ordem |
| `PUT/PATCH` | `/ordens/:id` | Sim | Atualiza ordem |
| `PATCH` | `/ordens/:id/status` | Sim | Altera o status |
| `GET` | `/ordens/:id/historico` | Sim | Lista o histórico |
| `DELETE` | `/ordens/:id` | Sim | Cancela a ordem |
| `GET` | `/ordens/:id/pagamentos` | Sim | Lista pagamentos e resumo financeiro |
| `POST` | `/ordens/:id/pagamentos` | Sim | Registra pagamento |
| `POST` | `/ordens/:id/pagamentos/:pagamentoId/estorno` | Sim | Estorna pagamento |
| `GET` | `/usuarios` | ADMIN | Lista usuários |
| `POST` | `/usuarios` | ADMIN | Cria usuário |
| `GET` | `/usuarios/:id` | ADMIN | Busca usuário |
| `PATCH` | `/usuarios/:id` | ADMIN | Atualiza usuário |
| `PATCH` | `/usuarios/:id/ativo` | ADMIN | Ativa ou desativa usuário |

## 9. O que foi feito no frontend de login

O primeiro fluxo vertical do frontend foi iniciado:

1. criação dos tipos do login em `auth.types.ts`;
2. criação do `loginSchema` com regras equivalentes às do backend;
3. criação do `LoginForm` com empresa, e-mail e senha;
4. captura dos valores com `FormData`;
5. validação com `safeParse` do Zod;
6. apresentação do primeiro erro de cada campo;
7. criação dos estados de carregamento e erro da API;
8. criação do `auth.service.ts` com `POST /auth/login`;
9. bloqueio e mudança do texto do botão durante a requisição;
10. renderização do formulário por `LoginPage` e `App`.

O código foi validado com `npm run build` e `npm run lint`. A primeira versão
foi registrada no commit `93639ce` da branch `preview`.

## 10. Estado atual e próximos passos do login

O formulário já valida os dados, chama a API e mostra erros. Ainda falta:

1. implementar `token-storage.ts` para guardar e recuperar o token;
2. salvar o token retornado após o login;
3. criar uma função central em `api.ts` que envie o cabeçalho `Authorization`;
4. consultar `GET /auth/me` ao iniciar a aplicação;
5. criar logout e remover o token;
6. instalar e configurar o roteamento entre login e dashboard;
7. substituir o `console.log` de sucesso por navegação;
8. estilizar o formulário e seus estados;
9. criar testes do formulário e do serviço;
10. trocar a URL fixa da API por `VITE_API_URL`.

Observação de segurança: o backend atualmente devolve o JWT no corpo da
resposta. Se o token for armazenado no navegador, é preciso manter atenção a
XSS. Uma evolução possível é usar cookie `HttpOnly`, o que exige uma alteração
coordenada no backend e no frontend.

## 11. Validação do projeto

Backend:

```powershell
npm run prisma:validate
npm run typecheck
npm test
npm run build
```

Frontend:

```powershell
npm run lint
npm run build
```

Execute essas verificações antes de criar um commit para encontrar erros de
tipagem, validação e integração o mais cedo possível.

# Financeiro empresarial — preview

Esta entrega implementa o financeiro interno da empresa em um ambiente de
avaliação isolado. Ela não publica a funcionalidade, não conecta contas
bancárias e não executa pagamentos reais.

## Escopo da preview

- painel com saldo consolidado, contas a receber, contas a pagar, atrasos e
  resultado previsto;
- resumo somente leitura das ordens de serviço, com valor total, recebido no
  dia, recebido no mês e saldo a receber;
- lançamentos de receitas e despesas, inclusive baixas parciais;
- contas financeiras, categorias e centros de custo;
- fluxo de caixa diário e consolidado, separando realizado de previsto;
- livro de movimentações, ajustes, transferências e estornos;
- cancelamento controlado e trilha de auditoria;
- filtros, paginação e exportação CSV na interface;
- isolamento por empresa e acesso restrito a administradores.

Os domínios existentes de `Pagamento` e `Cobranca` continuam separados. A
preview não chama gateway e não transforma uma baixa financeira em transação
bancária.

## Travas de segurança

O recurso começa fechado nos dois lados:

```env
# backend
SERVIX_FINANCEIRO_MODE=DESABILITADO

# frontend
VITE_FINANCEIRO_PREVIEW_MODE=DESABILITADO
```

Para um teste local deliberado, altere as duas variáveis somente no processo
ou no ambiente local para `PREVIEW`. O backend responde `503` enquanto estiver
desabilitado. Além da autenticação e da autorização `ADMIN`, toda mutação exige:

```http
X-Servix-Preview-Confirmation: FINANCEIRO_PREVIEW
```

Todo `POST` também exige uma `Idempotency-Key` única. Se a conexão cair, o
frontend tenta a operação novamente uma única vez com a mesma chave; a API
reproduz a resposta já concluída e recusa reutilização com outro endpoint,
usuário ou conteúdo. Isso evita lançamentos, baixas e transferências duplicados.

Todos os registros criados pela API usam `ambiente=PREVIEW`. O router não
oferece `DELETE` nem endpoints de gateway. Lançamentos, movimentações e
auditoria também possuem restrições no banco para preservar histórico e
impedir baixa acima do saldo aberto.

## Preparação local

Na pasta `backend`:

```powershell
$env:SERVIX_FINANCEIRO_MODE="PREVIEW"
npm run prisma:generate
npm run prisma:migrate:deploy
```

O comando de migration falha fechado sem essa variável. Não substitua o
pipeline comum por `prisma:migrate:deploy:raw`; esse escape existe apenas para
manutenção deliberada fora do deploy automático.

Crie ou escolha uma empresa local com um administrador. Para carregar o cenário
fictício, defina no processo:

```env
SERVIX_FINANCEIRO_MODE=PREVIEW
FINANCEIRO_PREVIEW_EMPRESA_SLUG=slug-da-empresa-local
POPULAR_FINANCEIRO_PREVIEW_CONFIRMAR=SIM
```

Então execute:

```powershell
npm run finance:preview:seed
```

O seed é idempotente, exige confirmação explícita e cria somente dados
fictícios no ambiente `PREVIEW` da empresa indicada.

Inicie o backend ainda com `SERVIX_FINANCEIRO_MODE=PREVIEW`. Em outro terminal,
inicie o frontend com `VITE_FINANCEIRO_PREVIEW_MODE=PREVIEW` e acesse
`/financeiro` com um administrador. O livro-caixa avançado fica em
`/financeiro/movimentacoes`, com filtros, ajustes, transferências, estornos e
auditoria recente.

## Rotas principais da API

Todas usam o prefixo `/preview/financeiro`:

- `GET /dashboard`, `GET /fluxo-caixa`, `GET /movimentacoes` e
  `GET /auditoria`;
- `GET /servicos/resumo`, leitura das ordens e pagamentos operacionais sem
  criar lançamentos financeiros;
- cadastro e edição de `/categorias`, `/centros-custo` e `/contas`;
- cadastro, edição, baixa, cancelamento e estorno em `/lancamentos`;
- ajustes em `/movimentacoes/ajustes` e transferências em `/transferencias`.

## Antes de considerar produção

Esta preview precisa ser validada com usuários e dados fictícios. Uma futura
entrega de produção deve ter revisão financeira e de segurança, estratégia de
backup e reconciliação, observabilidade, política de fechamento de períodos e
plano explícito de migração. Habilitar as variáveis desta preview não substitui
essas etapas.

A API é o único caminho de escrita suportado e mantém as baixas protegidas por
transações, bloqueios e validações. Os triggers são defesa em profundidade; a
preview não promete proteção absoluta contra sobrebaixa por SQL arbitrário
executado diretamente fora da API ou sob isolamento ou concorrência não
suportados. Portanto, mantenha o acesso direto de escrita ao banco restrito.

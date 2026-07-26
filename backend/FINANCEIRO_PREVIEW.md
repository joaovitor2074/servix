# Financeiro empresarial — preview

Este módulo é independente de `Pagamento` e `Cobranca`, usados pelas ordens de
serviço. Ele não possui gateway, não emite boleto/Pix e não movimenta dinheiro
real. A integração com pagamentos de ordens poderá ser feita futuramente por
conciliação explícita, sem compartilhar ou alterar o ledger atual.

## Barreiras de segurança

- As rotas existem somente em `/preview/financeiro`.
- O servidor precisa ter `SERVIX_FINANCEIRO_MODE=PREVIEW`. Ausência, erro de
  digitação ou qualquer outro valor responde `503` antes da autenticação.
- `npm run db:deploy` e `npm run prisma:migrate:deploy` também falham antes de
  chamar o Prisma sem esse modo explícito. O comando
  `prisma:migrate:deploy:raw` existe apenas para manutenção consciente e não
  deve ser usado no pipeline comum enquanto esta migration estiver no artefato.
- Todas as rotas exigem usuário `ADMIN` nesta primeira versão.
- `POST` e `PATCH` exigem o header
  `X-Servix-Preview-Confirmation: FINANCEIRO_PREVIEW`.
- Todo `POST` também exige `Idempotency-Key` com 8 a 120 caracteres. A mesma
  chave e payload reutilizam a resposta; reutilização com conteúdo diferente
  é recusada.
- Todas as consultas e relações usam `empresaId` do JWT e ambiente `PREVIEW`.
- Não existem rotas `DELETE`. Lançamentos são cancelados, cadastros são
  inativados e movimentações são estornadas.
- Auditoria é append-only; o ledger e lançamentos não podem ser apagados por
  escrita direta no banco.
- Constraint triggers diferidos validam no commit o status das baixas e o par
  completo de cada transferência, inclusive durante estornos atômicos.

O header é uma confirmação de intenção, não uma credencial. Ele complementa a
autenticação e a chave fail-closed do servidor.

## Recursos HTTP

Todos os endpoints abaixo usam o prefixo `/preview/financeiro`:

- `GET|POST /categorias` e `PATCH /categorias/:id`
- `GET|POST /centros-custo` e `PATCH /centros-custo/:id`
- `GET|POST /contas` e `PATCH /contas/:id`
- `GET|POST /lancamentos`, `GET|PATCH /lancamentos/:id`
- `POST /lancamentos/:id/cancelar`
- `POST /lancamentos/:id/baixas`
- `POST /lancamentos/:id/baixas/:movimentacaoId/estornar`
- `GET /movimentacoes`
- `POST /movimentacoes/ajustes`
- `POST /movimentacoes/:id/estornar`
- `POST /transferencias`
- `GET /dashboard`
- `GET /fluxo-caixa?inicio=AAAA-MM-DD&fim=AAAA-MM-DD`
- `GET /auditoria`

Valores são `Decimal(12,2)` no banco e chegam como strings decimais no JSON de
resposta. Datas aceitam um dia civil real (`AAAA-MM-DD`) ou um instante ISO com
`Z`/offset explícito; datas impossíveis e timestamps locais são recusados.

## Saldos, baixas e vencimento

O saldo da conta não é armazenado: ele é calculado a partir do saldo inicial e
das movimentações confirmadas. Movimentos anteriores à `dataSaldoInicial` são
recusados pelos serviços e por trigger no banco.

Uma baixa parcial cria uma movimentação de entrada (`RECEBER`) ou saída
(`PAGAR`). O advisory lock por empresa, a transação serializável, o CAS por
`versao` e uma trigger impedem sobrebaixa concorrente. O estorno preserva a
movimentação e recalcula o título como pendente, parcial, quitado ou vencido.

`statusCalculado` é o estado que a interface deve exibir. Vencimento é derivado
de `dataVencimento + saldoAberto`, portanto consultas `GET` permanecem
estritamente read-only. A coluna `status` guarda o último estado transacional.

As chaves idempotentes são reservadas de forma persistente antes do controller.
Isso oferece semântica *at-most-once* entre instâncias. Se o processo cair no
meio da operação, a chave permanece `EM_PROCESSAMENTO` e bloqueia repetição; a
ocorrência deve ser reconciliada manualmente em vez de arriscar escrita dupla.

Categorias, centros de custo e contas são serializados pelo advisory lock da
empresa e protegidos por chaves únicas. Eles ainda não exigem `versaoEsperada`
no `PATCH`, para manter o contrato desta preview; concorrência otimista nesses
três cadastros é uma evolução compatível com a futura matriz de permissões.

## Evoluções deliberadamente fora desta preview

Parcelamento e recorrência automática não foram incluídos nesta entrega. A
próxima etapa deve adicionar um agregado próprio (`RecorrenciaFinanceira`) e um
identificador de grupo/parcela nos lançamentos, com geração idempotente em lote,
pausa/cancelamento somente das ocorrências futuras e auditoria de cada título.
Até isso existir, parcelas podem ser cadastradas como lançamentos independentes,
sem automação.

Também ficam para uma etapa posterior: conciliação bancária, importação OFX/CNAB,
anexos, aprovação em múltiplas etapas, integração contábil e associação
automática ao ledger de pagamentos das ordens.

## Publicação

A migration `20260724183000_financeiro_preview` não deve ser aplicada em
produção nesta fase. Ela deve ser validada em um banco exclusivo de preview,
seguida por testes funcionais e conferência dos relatórios antes de qualquer
plano separado de ativação em produção.

Esta preview ainda não usa PostgreSQL RLS. O isolamento depende do `empresaId`
autenticado, filtros obrigatórios, chaves/FKs compostas, ambiente imutável e
triggers. Adotar RLS exige re-arquitetar o uso do pool para definir contexto de
tenant com `SET LOCAL` em toda transação; habilitá-la sem isso poderia misturar
ou bloquear requisições ao reutilizar conexões.

A API é o único caminho de escrita suportado: nela, baixa e estorno usam
transações, bloqueios e validações contra sobrebaixa. Os triggers da migration
são defesa em profundidade, mas esta preview não promete proteção absoluta
contra SQL arbitrário executado diretamente fora da API nem sob um modelo de
isolamento ou concorrência não suportados. Acesso direto de escrita ao banco deve
permanecer restrito durante os testes.

import {
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react'
import {
  criarCategoriaFinanceiraPreview,
  criarCentroCustoFinanceiroPreview,
  criarContaFinanceiraPreview,
} from '../services/finance-preview.service'
import {
  FinanceError,
  FinanceIcon,
  FinanceLoading,
  FinancePageHeader,
  FinanceSourceNote,
} from '../components/FinanceShared'
import { useFinanceiroPreview } from '../hooks/useFinanceiroPreview'
import { useFinanceDialogBehavior } from '../hooks/useFinanceDialogBehavior'
import type {
  ContaFinanceira,
  FinanceiroPreviewSnapshot,
  TipoLancamentoFinanceiro,
} from '../types/finance.types'
import {
  TIPO_CONTA_LABELS,
  formatarMoeda,
  obterMensagemErro,
  somarValoresMonetarios,
  subtrairValoresMonetarios,
} from '../utils/finance-formatters'

type TipoCadastro = 'CONTA' | 'CATEGORIA' | 'CENTRO_CUSTO'

export default function FinanceRegistriesPage() {
  const { dados, carregando, erro, recarregar, atualizarDados } = useFinanceiroPreview()
  const [cadastroAberto, setCadastroAberto] = useState<TipoCadastro | null>(null)
  const [mensagem, setMensagem] = useState('')

  if (carregando && !dados) return <FinanceLoading />
  if (erro && !dados) return <FinanceError message={erro} onRetry={() => void recarregar()} />
  if (!dados) return null

  function handleSaved(snapshot: FinanceiroPreviewSnapshot, label: string) {
    atualizarDados(snapshot)
    setCadastroAberto(null)
    setMensagem(`${label} adicionado com sucesso no ambiente de teste.`)
  }

  return (
    <div className="finance-page finance-registries-page">
      <FinancePageHeader
        eyebrow="Estrutura financeira"
        title="Cadastros"
        description="Organize contas, categorias e centros de custo usados nos lançamentos."
      />

      <FinanceSourceNote fonte={dados.fonte} atualizadoEm={dados.atualizadoEm} />

      {mensagem && (
        <div className="finance-success" role="status">
          <FinanceIcon name="check" />
          <span>{mensagem}</span>
          <button type="button" aria-label="Fechar mensagem" onClick={() => setMensagem('')}><FinanceIcon name="close" /></button>
        </div>
      )}

      <section className="finance-registry-section">
        <header className="finance-registry-section__header">
          <div>
            <span className="finance-eyebrow">Disponibilidades</span>
            <h2>Contas financeiras</h2>
            <p>Contas bancárias, carteiras e caixas que compõem o saldo.</p>
          </div>
          <button className="finance-button finance-button--secondary" type="button" onClick={() => setCadastroAberto('CONTA')}>
            <FinanceIcon name="plus" /> Adicionar conta
          </button>
        </header>

        <div className="finance-account-cards">
          {dados.contas.map(conta => (
            <article className="finance-account-card" key={conta.id} style={{ '--account-color': conta.cor } as CSSProperties}>
              <header>
                <span><FinanceIcon name={conta.tipo === 'CAIXA' ? 'wallet' : 'bank'} /></span>
                <em className={conta.ativa ? 'is-active' : ''}>{conta.ativa ? 'Ativa' : 'Inativa'}</em>
              </header>
              <div>
                <small>{conta.instituicao}</small>
                <h3>{conta.nome}</h3>
              </div>
              <strong>{formatarMoeda(conta.saldo)}</strong>
              <footer>
                <span>{TIPO_CONTA_LABELS[conta.tipo]}</span>
                <small>Saldo de preview</small>
              </footer>
            </article>
          ))}
        </div>
      </section>

      <div className="finance-registries-grid">
        <section className="finance-registry-section finance-registry-section--card">
          <header className="finance-registry-section__header">
            <div>
              <span className="finance-eyebrow">Classificação</span>
              <h2>Categorias</h2>
              <p>Separe receitas e despesas nos relatórios.</p>
            </div>
            <button className="finance-button finance-button--compact" type="button" onClick={() => setCadastroAberto('CATEGORIA')}>
              <FinanceIcon name="plus" /> Nova
            </button>
          </header>

          <div className="finance-category-groups">
            {(['RECEITA', 'DESPESA'] as TipoLancamentoFinanceiro[]).map(tipo => (
              <div key={tipo}>
                <h3>{tipo === 'RECEITA' ? 'Receitas' : 'Despesas'}</h3>
                <div className="finance-category-list">
                  {dados.categorias.filter(item => item.tipo === tipo).map(categoria => {
                    const usos = dados.lancamentos.filter(item => item.categoriaId === categoria.id).length
                    return (
                      <div className="finance-category-row" key={categoria.id}>
                        <i style={{ backgroundColor: categoria.cor }} />
                        <span><strong>{categoria.nome}</strong><small>{usos} lançamentos</small></span>
                        <em className={categoria.ativa ? 'is-active' : ''}>{categoria.ativa ? 'Ativa' : 'Inativa'}</em>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="finance-registry-section finance-registry-section--card">
          <header className="finance-registry-section__header">
            <div>
              <span className="finance-eyebrow">Responsabilidade</span>
              <h2>Centros de custo</h2>
              <p>Acompanhe qual área gera cada movimentação.</p>
            </div>
            <button className="finance-button finance-button--compact" type="button" onClick={() => setCadastroAberto('CENTRO_CUSTO')}>
              <FinanceIcon name="plus" /> Novo
            </button>
          </header>

          <div className="finance-cost-center-list">
            {dados.centrosCusto.map(centro => {
              const relacionados = dados.lancamentos.filter(item => item.centroCustoId === centro.id)
              const receitas = somarValoresMonetarios(
                ...relacionados.filter(item => item.tipo === 'RECEITA').map(item => item.valor),
              )
              const despesas = somarValoresMonetarios(
                ...relacionados.filter(item => item.tipo === 'DESPESA').map(item => item.valor),
              )
              const resultado = subtrairValoresMonetarios(receitas, despesas)

              return (
                <article className="finance-cost-center-row" key={centro.id}>
                  <span className="finance-cost-center-row__icon"><FinanceIcon name="folder" /></span>
                  <span>
                    <strong>{centro.nome}</strong>
                    <small>{centro.codigo} · {relacionados.length} lançamentos</small>
                  </span>
                  <span>
                    <small>Resultado previsto</small>
                    <strong className={resultado >= 0 ? 'finance-value--receita' : 'finance-value--despesa'}>
                      {formatarMoeda(resultado)}
                    </strong>
                  </span>
                  <em className={centro.ativo ? 'is-active' : ''}>{centro.ativo ? 'Ativo' : 'Inativo'}</em>
                </article>
              )
            })}
          </div>
        </section>
      </div>

      {cadastroAberto && (
        <RegistryDialog
          tipo={cadastroAberto}
          contas={dados.contas}
          onClose={() => setCadastroAberto(null)}
          onSaved={snapshot => handleSaved(
            snapshot,
            cadastroAberto === 'CONTA' ? 'Conta' : cadastroAberto === 'CATEGORIA' ? 'Categoria' : 'Centro de custo',
          )}
        />
      )}
    </div>
  )
}

function RegistryDialog({
  tipo,
  contas,
  onClose,
  onSaved,
}: {
  tipo: TipoCadastro
  contas: ContaFinanceira[]
  onClose: () => void
  onSaved: (snapshot: FinanceiroPreviewSnapshot) => void
}) {
  const [nome, setNome] = useState('')
  const [instituicao, setInstituicao] = useState('')
  const [tipoConta, setTipoConta] = useState<ContaFinanceira['tipo']>('CONTA_CORRENTE')
  const [saldo, setSaldo] = useState('0')
  const [tipoCategoria, setTipoCategoria] = useState<TipoLancamentoFinanceiro>('RECEITA')
  const [codigo, setCodigo] = useState('')
  const [cor, setCor] = useState('#0648d8')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const nomeRef = useRef<HTMLInputElement>(null)

  const dialogRef = useFinanceDialogBehavior(onClose, salvando, nomeRef)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErro('')
    setSalvando(true)

    try {
      if (tipo === 'CONTA') {
        const saldoNumerico = Number(saldo)
        if (!Number.isFinite(saldoNumerico)) throw new Error('Informe um saldo inicial válido.')
        onSaved(await criarContaFinanceiraPreview({
          nome: nome.trim(),
          instituicao: instituicao.trim(),
          tipo: tipoConta,
          saldo: saldoNumerico,
          cor,
        }))
      } else if (tipo === 'CATEGORIA') {
        onSaved(await criarCategoriaFinanceiraPreview({ nome: nome.trim(), tipo: tipoCategoria, cor }))
      } else {
        onSaved(await criarCentroCustoFinanceiroPreview({ nome: nome.trim(), codigo: codigo.trim().toUpperCase() }))
      }
    } catch (error) {
      setErro(obterMensagemErro(error))
      setSalvando(false)
    }
  }

  const titulo = tipo === 'CONTA' ? 'Nova conta financeira' : tipo === 'CATEGORIA' ? 'Nova categoria' : 'Novo centro de custo'

  return (
    <div className="finance-dialog-backdrop">
      <section ref={dialogRef} className="finance-dialog" role="dialog" aria-modal="true" aria-labelledby="registry-dialog-title" tabIndex={-1}>
        <header className="finance-dialog__header">
          <div>
            <span className="finance-eyebrow">Cadastro de preview</span>
            <h2 id="registry-dialog-title">{titulo}</h2>
            <p>Disponível somente no ambiente financeiro de teste.</p>
          </div>
          <button type="button" aria-label="Fechar" onClick={onClose} disabled={salvando}><FinanceIcon name="close" /></button>
        </header>

        <form className="finance-form" onSubmit={handleSubmit}>
          <div className="finance-form__grid">
            <label className="finance-form__field finance-form__field--full">
              <span>Nome</span>
              <input ref={nomeRef} value={nome} required maxLength={80} placeholder={tipo === 'CONTA' ? `Ex.: Conta principal ${contas.length + 1}` : 'Nome do cadastro'} onChange={event => setNome(event.target.value)} />
            </label>

            {tipo === 'CONTA' && (
              <>
                <label className="finance-form__field finance-form__field--full">
                  <span>Instituição</span>
                  <input value={instituicao} required maxLength={80} placeholder="Ex.: Banco Itaú" onChange={event => setInstituicao(event.target.value)} />
                </label>
                <label className="finance-form__field">
                  <span>Tipo</span>
                  <select value={tipoConta} onChange={event => setTipoConta(event.target.value as ContaFinanceira['tipo'])}>
                    {Object.entries(TIPO_CONTA_LABELS).map(([valor, label]) => <option value={valor} key={valor}>{label}</option>)}
                  </select>
                </label>
                <label className="finance-form__field">
                  <span>Saldo inicial</span>
                  <input type="number" step="0.01" value={saldo} required onChange={event => setSaldo(event.target.value)} />
                </label>
              </>
            )}

            {tipo === 'CATEGORIA' && (
              <label className="finance-form__field">
                <span>Tipo</span>
                <select value={tipoCategoria} onChange={event => setTipoCategoria(event.target.value as TipoLancamentoFinanceiro)}>
                  <option value="RECEITA">Receita</option>
                  <option value="DESPESA">Despesa</option>
                </select>
              </label>
            )}

            {tipo === 'CENTRO_CUSTO' && (
              <label className="finance-form__field finance-form__field--full">
                <span>Código</span>
                <input value={codigo} required maxLength={16} placeholder="Ex.: ADM" onChange={event => setCodigo(event.target.value)} />
              </label>
            )}

            {tipo !== 'CENTRO_CUSTO' && (
              <label className="finance-form__field">
                <span>Cor de identificação</span>
                <span className="finance-color-field">
                  <input type="color" value={cor} onChange={event => setCor(event.target.value)} />
                  <code>{cor.toUpperCase()}</code>
                </span>
              </label>
            )}
          </div>

          {erro && <p className="finance-form__error" role="alert">{erro}</p>}

          <footer className="finance-dialog__footer">
            <span><FinanceIcon name="flask" /> Cadastro isolado da produção.</span>
            <div>
              <button type="button" className="finance-button finance-button--ghost" onClick={onClose} disabled={salvando}>Cancelar</button>
              <button type="submit" className="finance-button finance-button--primary" disabled={salvando}>{salvando ? 'Salvando...' : 'Adicionar no preview'}</button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  )
}

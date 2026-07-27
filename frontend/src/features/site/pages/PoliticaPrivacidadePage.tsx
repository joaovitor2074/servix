import { SITE_SUPPORT_EMAIL } from '../site-data'

export default function PoliticaPrivacidadePage() {
  return (
    <section className="legal-page">
      <div className="site-container legal-page__layout">
        <aside className="legal-page__summary">
          <p className="eyebrow">Documento informativo</p>
          <h1>Política de Privacidade</h1>
          <p>Versão revisada de 27/07/2026</p>
          <div className="legal-review-notice" role="note">
            <strong>Identificação do controlador pendente</strong>
            <p>
              Antes da ativação comercial, inclua o nome ou a razão social,
              CPF ou CNPJ e endereço físico do responsável pelo Servix.
            </p>
          </div>
        </aside>

        <article className="legal-content">
          <section>
            <h2>1. Objetivo e abrangência</h2>
            <p>
              Esta Política descreve como o Servix poderá
              tratar dados pessoais no site público e no sistema de gestão de
              serviços. O tratamento deve observar a legislação aplicável,
              incluindo a Lei Geral de Proteção de Dados Pessoais (LGPD).
            </p>
          </section>

          <section>
            <h2>2. Dados que podem ser tratados</h2>
            <p>Conforme o uso do serviço, podem ser tratados:</p>
            <ul>
              <li>dados cadastrais da empresa e de seus responsáveis;</li>
              <li>nome, e-mail, telefone e credenciais dos usuários autorizados;</li>
              <li>dados de clientes inseridos pela empresa, como contato, identificação e histórico de atendimento;</li>
              <li>informações de orçamentos, ordens de serviço e registros financeiros;</li>
              <li>dados técnicos de acesso, segurança e funcionamento da aplicação.</li>
            </ul>
          </section>

          <section>
            <h2>3. Finalidades</h2>
            <p>
              Os dados podem ser utilizados para criar e administrar contas,
              prestar as funcionalidades contratadas, autenticar usuários,
              oferecer suporte, manter segurança, prevenir abuso, cumprir
              obrigações legais e melhorar o serviço.
            </p>
          </section>

          <section>
            <h2>4. Papéis e responsabilidades</h2>
            <p>
              O Servix atua como controlador dos dados necessários à conta,
              assinatura, suporte, segurança e administração da plataforma. A
              empresa usuária decide quais dados de seus clientes e
              colaboradores serão registrados e deve possuir base legal para
              esse tratamento. Nessa relação, o Servix atua como operador ao
              executar as instruções da empresa dentro do serviço contratado.
            </p>
          </section>

          <section>
            <h2>5. Compartilhamento e integrações</h2>
            <p>
              Dados podem ser tratados por fornecedores necessários à operação,
              incluindo Vercel, Railway, PostgreSQL e Mercado Pago, conforme a
              funcionalidade utilizada. Alguns fornecedores podem processar
              dados fora do Brasil, com medidas contratuais e de segurança
              compatíveis com a LGPD. Quando uma empresa conecta sua conta
              Mercado Pago, essa autorização pertence à própria empresa e é
              usada apenas em seus pagamentos.
            </p>
          </section>

          <section>
            <h2>6. Separação dos pagamentos</h2>
            <p>
              A assinatura paga pela empresa é destinada à conta do Servix. O
              pagamento feito pelo cliente de uma empresa, relacionado a um
              orçamento ou serviço, é destinado à conta Mercado Pago conectada
              por essa empresa. O token OAuth da empresa não deve ser usado para
              cobrar a assinatura do Servix.
            </p>
          </section>

          <section>
            <h2>7. Segurança e conservação</h2>
            <p>
              O Servix adota medidas técnicas e administrativas adequadas ao
              risco, incluindo controle de acesso, proteção de credenciais,
              registros de eventos e cópias de segurança. Os dados são mantidos
              durante a prestação do serviço e, após seu término, pelo período
              necessário ao cumprimento de obrigações legais, prevenção de
              fraude e exercício regular de direitos. Depois disso, serão
              eliminados ou anonimizados quando aplicável.
            </p>
          </section>

          <section>
            <h2>8. Direitos dos titulares</h2>
            <p>
              Titulares podem solicitar confirmação do tratamento, acesso,
              correção, informações sobre compartilhamento, portabilidade,
              anonimização, bloqueio ou eliminação quando aplicável, além de
              revogar consentimento e apresentar oposição. A identidade do
              solicitante poderá ser confirmada para proteger os dados.
            </p>
          </section>

          <section>
            <h2>9. Contato e atualizações</h2>
            <p>
              Dúvidas sobre privacidade podem ser enviadas para{' '}
              <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>.
              Esta versão poderá ser atualizada para refletir mudanças na
              operação e requisitos legais aplicáveis.
            </p>
          </section>
        </article>
      </div>
    </section>
  )
}

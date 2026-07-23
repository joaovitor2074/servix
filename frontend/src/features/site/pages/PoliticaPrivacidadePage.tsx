import { SITE_CONTACT_EMAIL } from '../site-data'

export default function PoliticaPrivacidadePage() {
  return (
    <section className="legal-page">
      <div className="site-container legal-page__layout">
        <aside className="legal-page__summary">
          <p className="eyebrow">Documento informativo</p>
          <h1>Política de Privacidade</h1>
          <p>Versão inicial de 23/07/2026</p>
          <div className="legal-review-notice" role="note">
            <strong>Revisão necessária</strong>
            <p>
              Este texto é uma versão inicial informativa e deve ser revisado
              pelo responsável jurídico antes da ativação em produção.
            </p>
          </div>
        </aside>

        <article className="legal-content">
          <section>
            <h2>1. Objetivo e abrangência</h2>
            <p>
              Esta Política descreve, de forma inicial, como o Servix poderá
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
              A empresa usuária decide quais dados de seus clientes e
              colaboradores serão registrados no Servix e deve possuir base
              legal adequada para esse tratamento. Os papéis de controlador e
              operador precisam ser formalizados na versão jurídica definitiva.
            </p>
          </section>

          <section>
            <h2>5. Compartilhamento e integrações</h2>
            <p>
              Dados podem ser compartilhados com fornecedores necessários à
              hospedagem, segurança, comunicação e processamento de pagamentos,
              sempre dentro da finalidade correspondente. Quando uma empresa
              conecta sua conta Mercado Pago, essa autorização pertence à
              própria empresa e é usada apenas em seus pagamentos.
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
              O Servix deve adotar medidas técnicas e administrativas adequadas
              ao risco. Os prazos de conservação, critérios de descarte, plano
              de resposta a incidentes e fornecedores utilizados deverão ser
              detalhados antes da produção.
            </p>
          </section>

          <section>
            <h2>8. Direitos dos titulares</h2>
            <p>
              Titulares podem solicitar informações e o exercício dos direitos
              previstos na LGPD. A identidade do solicitante poderá precisar ser
              confirmada para proteger os dados envolvidos.
            </p>
          </section>

          <section>
            <h2>9. Contato e atualizações</h2>
            <p>
              Dúvidas sobre privacidade podem ser enviadas para{' '}
              <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>.
              Esta versão poderá ser atualizada para refletir a operação final e
              requisitos legais aplicáveis.
            </p>
          </section>
        </article>
      </div>
    </section>
  )
}

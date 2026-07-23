import { SITE_CONTACT_EMAIL } from '../site-data'

export default function TermosUsoPage() {
  return (
    <section className="legal-page">
      <div className="site-container legal-page__layout">
        <aside className="legal-page__summary">
          <p className="eyebrow">Documento informativo</p>
          <h1>Termos de Uso</h1>
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
            <h2>1. Aceitação</h2>
            <p>
              Ao criar uma conta ou utilizar o Servix, a empresa e seus usuários
              declaram ter lido e aceito estes Termos. A versão final deverá
              identificar formalmente o fornecedor do serviço e seus dados
              empresariais.
            </p>
          </section>

          <section>
            <h2>2. O serviço</h2>
            <p>
              O Servix oferece ferramentas para organizar clientes, orçamentos,
              ordens de serviço, acompanhamento e registros de pagamento. As
              funcionalidades podem evoluir, desde que preservadas as obrigações
              assumidas na contratação aplicável.
            </p>
          </section>

          <section>
            <h2>3. Conta e usuários</h2>
            <p>
              A empresa é responsável pela veracidade dos dados cadastrados,
              pela autorização de seus usuários e pela proteção das credenciais.
              Contas não devem ser compartilhadas. Suspeitas de acesso indevido
              devem ser comunicadas ao suporte.
            </p>
          </section>

          <section>
            <h2>4. Assinatura do Servix</h2>
            <p>
              O Plano Servix é apresentado pelo valor de R$ 79,90 por mês. O
              fluxo inicial opera em ambiente de teste, sem cobrança ou
              renovação real. Regras definitivas de cobrança, reajuste,
              vencimento, cancelamento e reembolso deverão ser revisadas e
              comunicadas antes da ativação em produção.
            </p>
          </section>

          <section>
            <h2>5. Pagamentos dos clientes da empresa</h2>
            <p>
              Pagamentos relacionados a orçamentos ou serviços são independentes
              da assinatura. Quando a empresa conecta o Mercado Pago, o dinheiro
              segue para sua própria conta. O Servix não deve usar essa conexão
              OAuth para receber mensalidades da assinatura.
            </p>
          </section>

          <section>
            <h2>6. Uso adequado</h2>
            <p>Não é permitido usar o Servix para:</p>
            <ul>
              <li>praticar fraude, violar direitos ou descumprir a lei;</li>
              <li>tentar acessar contas, dados ou infraestrutura sem autorização;</li>
              <li>inserir código malicioso ou prejudicar a disponibilidade do serviço;</li>
              <li>tratar dados pessoais sem finalidade e base legal adequadas.</li>
            </ul>
          </section>

          <section>
            <h2>7. Dados e conteúdo da empresa</h2>
            <p>
              A empresa permanece responsável pelos dados e conteúdos que
              insere no sistema, inclusive dados de clientes e colaboradores. O
              Servix deve tratar essas informações conforme a Política de
              Privacidade e os instrumentos contratuais aplicáveis.
            </p>
          </section>

          <section>
            <h2>8. Disponibilidade e suporte</h2>
            <p>
              Interrupções planejadas, níveis de serviço, rotinas de backup e
              canais de suporte deverão ser definidos na documentação final. O
              ambiente de teste pode passar por ajustes com maior frequência.
            </p>
          </section>

          <section>
            <h2>9. Propriedade intelectual e responsabilidades</h2>
            <p>
              A marca, interface e tecnologia do Servix permanecem protegidas
              pela legislação aplicável. Limites de responsabilidade, garantias
              e tratamento de danos deverão receber revisão jurídica específica
              antes da produção.
            </p>
          </section>

          <section>
            <h2>10. Contato e alterações</h2>
            <p>
              Dúvidas podem ser enviadas para{' '}
              <a href={`mailto:${SITE_CONTACT_EMAIL}`}>{SITE_CONTACT_EMAIL}</a>.
              Mudanças relevantes na versão definitiva deverão ser comunicadas
              com clareza e antecedência adequada.
            </p>
          </section>
        </article>
      </div>
    </section>
  )
}

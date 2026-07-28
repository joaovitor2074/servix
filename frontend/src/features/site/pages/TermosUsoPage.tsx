import {
  SITE_LEGAL_ADDRESS,
  SITE_LEGAL_DOCUMENT,
  SITE_LEGAL_IDENTITY_READY,
  SITE_LEGAL_NAME,
  SITE_SUPPORT_EMAIL,
} from '../site-data'

export default function TermosUsoPage() {
  return (
    <section className="legal-page">
      <div className="site-container legal-page__layout">
        <aside className="legal-page__summary">
          <p className="eyebrow">Documento informativo</p>
          <h1>Termos de Uso</h1>
          <p>Versão revisada de 28/07/2026</p>
          {SITE_LEGAL_IDENTITY_READY ? (
            <div className="legal-review-notice" role="note">
              <strong>Fornecedor responsável</strong>
              <p>
                {SITE_LEGAL_NAME}<br />
                CPF/CNPJ: {SITE_LEGAL_DOCUMENT}<br />
                Endereço: {SITE_LEGAL_ADDRESS}<br />
                Contato: <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
              </p>
            </div>
          ) : (
            <div className="legal-review-notice" role="note">
              <strong>Identificação do fornecedor pendente</strong>
              <p>
                A contratação em produção permanecerá bloqueada até a inclusão
                do nome ou razão social, CPF ou CNPJ e endereço público do
                responsável pelo Servix.
              </p>
            </div>
          )}
        </aside>

        <article className="legal-content">
          <section>
            <h2>1. Aceitação</h2>
            <p>
              Ao criar uma conta ou utilizar o Servix, a empresa e seus usuários
              declaram ter lido e aceito estes Termos.{' '}
              {SITE_LEGAL_IDENTITY_READY
                ? `O serviço é fornecido por ${SITE_LEGAL_NAME}, CPF/CNPJ ${SITE_LEGAL_DOCUMENT}, com endereço de contato em ${SITE_LEGAL_ADDRESS}.`
                : 'A identificação pública do fornecedor será concluída antes da ativação comercial.'}
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
              O Plano Servix custa R$ 79,90 por mês e possui renovação mensal.
              O checkout informa claramente se está em TESTE, sem cobrança
              real, ou em PRODUÇÃO, com cobrança recorrente pelo Mercado Pago.
              Qualquer alteração de preço será informada antes de produzir
              efeitos na renovação seguinte.
            </p>
          </section>

          <section>
            <h2>5. Cancelamento, arrependimento e reembolso</h2>
            <p>
              O administrador pode solicitar o cancelamento nas configurações
              da assinatura. Após a confirmação do Mercado Pago, novas
              renovações deixam de ser cobradas e o acesso da empresa é
              suspenso. A reativação exige um novo checkout.
            </p>
            <p>
              Quando a contratação estiver sujeita ao direito de arrependimento
              previsto na legislação de consumo, o pedido poderá ser feito em
              até sete dias da contratação, com devolução dos valores pagos.
              Pedidos de estorno ou reembolso também podem ser enviados para{' '}
              <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>
              {' '}e serão analisados conforme a legislação e o histórico da
              cobrança.
            </p>
            <p>
              Se uma renovação for recusada, o Mercado Pago poderá realizar
              novas tentativas dentro da janela informada pelo provedor. O
              acesso poderá permanecer ativo durante essas tentativas. Se a
              cobrança for encerrada sem aprovação, o acesso será suspenso até
              a regularização confirmada pelo Mercado Pago.
            </p>
          </section>

          <section>
            <h2>6. Pagamentos dos clientes da empresa</h2>
            <p>
              Pagamentos relacionados a orçamentos ou serviços são independentes
              da assinatura. No funcionamento atual, o pagamento é combinado e
              recebido diretamente pela assistência, que registra o recebimento
              no Servix. Uma futura conexão OAuth não deverá ser usada para
              receber mensalidades da assinatura.
            </p>
          </section>

          <section>
            <h2>7. Uso adequado</h2>
            <p>Não é permitido usar o Servix para:</p>
            <ul>
              <li>praticar fraude, violar direitos ou descumprir a lei;</li>
              <li>tentar acessar contas, dados ou infraestrutura sem autorização;</li>
              <li>inserir código malicioso ou prejudicar a disponibilidade do serviço;</li>
              <li>tratar dados pessoais sem finalidade e base legal adequadas.</li>
            </ul>
          </section>

          <section>
            <h2>8. Dados e conteúdo da empresa</h2>
            <p>
              A empresa permanece responsável pelos dados e conteúdos que
              insere no sistema, inclusive dados de clientes e colaboradores. O
              Servix deve tratar essas informações conforme a Política de
              Privacidade e os instrumentos contratuais aplicáveis.
            </p>
          </section>

          <section>
            <h2>9. Disponibilidade e suporte</h2>
            <p>
              O Servix pode realizar manutenções e atualizações necessárias à
              segurança e à evolução do serviço. Solicitações de informação,
              dúvida, reclamação, suspensão ou cancelamento podem ser enviadas
              para <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>.
              A resposta será encaminhada em até cinco dias.
            </p>
          </section>

          <section>
            <h2>10. Propriedade intelectual e responsabilidades</h2>
            <p>
              A marca, interface e tecnologia do Servix permanecem protegidas
              pela legislação aplicável. Nenhuma disposição destes Termos
              exclui direitos ou responsabilidades que não possam ser afastados
              pela legislação aplicável.
            </p>
          </section>

          <section>
            <h2>11. Contato e alterações</h2>
            <p>
              Dúvidas podem ser enviadas para{' '}
              <a href={`mailto:${SITE_SUPPORT_EMAIL}`}>{SITE_SUPPORT_EMAIL}</a>.
              Mudanças relevantes serão comunicadas com clareza e antecedência
              adequada, preservados os direitos previstos em lei.
            </p>
          </section>
        </article>
      </div>
    </section>
  )
}

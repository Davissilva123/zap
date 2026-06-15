import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Shield } from 'lucide-react';

export default function PrivacyPolicyPage() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Política de Privacidade</h1>
            <p className="text-sm text-slate-500">Última atualização: junho de 2025</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Quem somos</h2>
            <p>
              O <strong>ZapMenu</strong> é uma plataforma SaaS de gestão de restaurantes desenvolvida e operada por Davi Silva
              (doravante "ZapMenu", "nós" ou "nosso"). Esta Política descreve como coletamos, usamos,
              armazenamos e protegemos seus dados pessoais em conformidade com a Lei Geral de Proteção
              de Dados Pessoais (LGPD — Lei nº 13.709/2018) e demais normas aplicáveis.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Dados que coletamos</h2>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Dados de cadastro:</strong> nome, endereço de e-mail, CNPJ/CPF, telefone e dados do restaurante.</li>
              <li><strong>Dados de pagamento:</strong> processados diretamente pelo Stripe; não armazenamos números de cartão.</li>
              <li><strong>Dados de uso:</strong> cardápio, pedidos, relatórios, clientes do restaurante e configurações.</li>
              <li><strong>Dados técnicos:</strong> endereço IP, tipo de navegador, sistema operacional e logs de acesso.</li>
              <li><strong>Cookies:</strong> sessão de autenticação e preferências da interface.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Finalidade e base legal</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-50">
                    <th className="text-left p-3 border border-slate-200 font-semibold">Finalidade</th>
                    <th className="text-left p-3 border border-slate-200 font-semibold">Base legal (LGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Prestação do serviço contratado', 'Execução de contrato (art. 7º, V)'],
                    ['Cobrança e faturamento', 'Execução de contrato (art. 7º, V)'],
                    ['Envio de comunicados e novidades', 'Legítimo interesse / consentimento (art. 7º, IX / II)'],
                    ['Segurança e prevenção a fraudes', 'Legítimo interesse (art. 7º, IX)'],
                    ['Cumprimento de obrigações legais', 'Obrigação legal (art. 7º, II)'],
                    ['Análise e melhoria do produto', 'Legítimo interesse (art. 7º, IX)'],
                  ].map(([fin, base]) => (
                    <tr key={fin}>
                      <td className="p-3 border border-slate-200">{fin}</td>
                      <td className="p-3 border border-slate-200 text-slate-500">{base}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Compartilhamento de dados</h2>
            <p className="mb-3">Compartilhamos seus dados apenas com os seguintes parceiros, estritamente para viabilizar a prestação do serviço:</p>
            <ul className="list-disc list-inside space-y-2">
              <li><strong>Supabase Inc.</strong> — banco de dados e autenticação (EUA, cláusulas contratuais padrão).</li>
              <li><strong>Stripe Inc.</strong> — processamento de pagamentos (EUA, certificado PCI-DSS).</li>
              <li><strong>Vercel Inc.</strong> — hospedagem da aplicação (EUA/global CDN).</li>
              <li><strong>Sentry (Functional Software, Inc.)</strong> — monitoramento de erros (EUA).</li>
            </ul>
            <p className="mt-3">Não vendemos nem alugamos seus dados a terceiros.</p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Retenção de dados</h2>
            <p>
              Mantemos seus dados enquanto sua conta estiver ativa. Após o encerramento, retemos os dados
              pelo prazo mínimo exigido por lei (5 anos para documentos fiscais) e, em seguida, excluímos
              ou anonimizamos permanentemente. Você pode solicitar a exclusão antecipada pelos meios
              indicados na seção 7.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">6. Segurança</h2>
            <p>
              Adotamos medidas técnicas e organizacionais para proteger seus dados, incluindo criptografia
              em trânsito (TLS 1.2+), controle de acesso por função (RLS no banco de dados), autenticação
              segura e monitoramento contínuo. Nenhum sistema é 100% seguro; em caso de incidente,
              notificaremos os titulares e a ANPD conforme exigido pela LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">7. Seus direitos (LGPD, art. 18)</h2>
            <p className="mb-3">Você tem direito a:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Confirmar a existência e acessar seus dados;</li>
              <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
              <li>Solicitar a anonimização, bloqueio ou eliminação de dados desnecessários;</li>
              <li>Portabilidade dos seus dados a outro fornecedor;</li>
              <li>Revogar o consentimento a qualquer momento;</li>
              <li>Excluir sua conta e todos os dados associados — disponível em <em>Configurações → Excluir conta</em>.</li>
            </ul>
            <p className="mt-3">
              Para exercer esses direitos, entre em contato pelo e-mail:{' '}
              <a href="mailto:privacidade@zapmenu.com.br" className="text-emerald-600 hover:underline">
                privacidade@zapmenu.com.br
              </a>
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">8. Cookies</h2>
            <p>
              Utilizamos cookies essenciais para manter a sessão autenticada e cookies de análise para
              entender o uso da plataforma (Sentry). Não utilizamos cookies de publicidade comportamental.
              Você pode desabilitar cookies no seu navegador, mas isso pode afetar o funcionamento do sistema.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Transferência internacional</h2>
            <p>
              Alguns de nossos parceiros estão localizados nos Estados Unidos. A transferência é realizada
              com base em cláusulas contratuais padrão e certificações de adequação, garantindo nível de
              proteção equivalente ao exigido pela LGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">10. Alterações nesta política</h2>
            <p>
              Podemos atualizar esta Política periodicamente. Alterações relevantes serão comunicadas por
              e-mail ou notificação na plataforma com antecedência mínima de 15 dias.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Contato e DPO</h2>
            <p>
              Para dúvidas, solicitações ou reclamações relacionadas à privacidade, entre em contato com
              nosso Encarregado de Dados (DPO):{' '}
              <a href="mailto:privacidade@zapmenu.com.br" className="text-emerald-600 hover:underline">
                privacidade@zapmenu.com.br
              </a>
              . Caso não esteja satisfeito com nossa resposta, você pode contatar a{' '}
              <a href="https://www.gov.br/anpd" target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline">
                Autoridade Nacional de Proteção de Dados (ANPD)
              </a>.
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

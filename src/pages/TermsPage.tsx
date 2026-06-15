import { useNavigate } from 'react-router-dom';
import { ArrowLeft, FileText } from 'lucide-react';

export default function TermsPage() {
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
            <FileText className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Termos de Uso</h1>
            <p className="text-sm text-slate-500">Última atualização: junho de 2025</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8 space-y-8 text-slate-700 leading-relaxed">

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">1. Aceitação dos termos</h2>
            <p>
              Ao criar uma conta ou utilizar a plataforma <strong>ZapMenu</strong>, você declara ter lido,
              compreendido e concordado com estes Termos de Uso e com nossa{' '}
              <button
                onClick={() => navigate('/privacidade')}
                className="text-emerald-600 hover:underline"
              >
                Política de Privacidade
              </button>
              . Se você não concordar, não utilize o serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">2. Descrição do serviço</h2>
            <p>
              O ZapMenu é uma plataforma de gestão para restaurantes, lanchonetes e estabelecimentos
              alimentícios, oferecida no modelo SaaS (Software as a Service). Inclui cardápio digital com
              QR Code, gestão de pedidos, relatórios, controle de estoque, operadores, entre outros módulos
              conforme o plano contratado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">3. Elegibilidade</h2>
            <p>
              O serviço é destinado a pessoas jurídicas ou físicas maiores de 18 anos que exerçam atividade
              comercial legal no Brasil. Ao aceitar estes Termos, você declara ter capacidade legal para
              celebrar contratos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">4. Cadastro e segurança da conta</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Você é responsável por manter a confidencialidade da sua senha.</li>
              <li>Notifique-nos imediatamente em caso de uso não autorizado da sua conta.</li>
              <li>Cada conta corresponde a um estabelecimento (CNPJ ou CPF). Múltiplos estabelecimentos requerem múltiplas contas.</li>
              <li>Você é responsável por todas as ações realizadas em sua conta.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">5. Planos, pagamento e cancelamento</h2>
            <ul className="list-disc list-inside space-y-2">
              <li>Os planos disponíveis (Básico, Pro, Premium) e seus preços estão descritos na página de planos.</li>
              <li>O período de teste gratuito (trial) é de 14 dias. Após esse período, é necessário assinar um plano pago para continuar usando.</li>
              <li>O pagamento é processado mensalmente ou anualmente, conforme o plano escolhido, via cartão de crédito pelo Stripe.</li>
              <li>O cancelamento pode ser feito a qualquer momento pelo painel; o acesso permanece ativo até o fim do período já pago.</li>
              <li>Não realizamos reembolsos proporcionais por cancelamento antecipado, salvo exigência legal.</li>
              <li>Reservamo-nos o direito de alterar preços mediante aviso prévio de 30 dias.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">6. Uso aceitável</h2>
            <p className="mb-3">É proibido utilizar o ZapMenu para:</p>
            <ul className="list-disc list-inside space-y-2">
              <li>Atividades ilegais, fraudulentas ou que violem direitos de terceiros;</li>
              <li>Envio de spam ou comunicações não solicitadas em massa;</li>
              <li>Tentar acessar dados de outros usuários sem autorização;</li>
              <li>Realizar engenharia reversa, descompilar ou extrair o código-fonte da plataforma;</li>
              <li>Sobrecarregar intencionalmente a infraestrutura do serviço.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">7. Conteúdo do usuário</h2>
            <p>
              Você retém todos os direitos sobre os dados que insere no ZapMenu (cardápio, preços, imagens,
              pedidos). Ao utilizar a plataforma, concede ao ZapMenu uma licença limitada para processar
              esses dados exclusivamente para prestar o serviço contratado. Você é responsável pela
              legalidade e veracidade do conteúdo cadastrado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">8. Propriedade intelectual</h2>
            <p>
              A plataforma ZapMenu, incluindo seu código, design, marcas e documentação, é propriedade
              exclusiva do ZapMenu. Nenhum direito de propriedade intelectual é transferido ao usuário
              pelo uso do serviço.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">9. Disponibilidade e SLA</h2>
            <p>
              Buscamos manter a plataforma disponível 24 horas por dia, 7 dias por semana, com meta de
              uptime de 99,5% mensal. Manutenções programadas serão comunicadas com antecedência. Não
              nos responsabilizamos por indisponibilidades causadas por falhas em serviços de terceiros
              (Supabase, Stripe, Vercel) ou por causas de força maior.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">10. Limitação de responsabilidade</h2>
            <p>
              Na extensão máxima permitida por lei, o ZapMenu não será responsável por danos indiretos,
              incidentais, especiais ou consequenciais, incluindo lucros cessantes, perda de dados ou
              interrupção de negócios. Nossa responsabilidade total está limitada ao valor pago pelo usuário
              nos últimos 3 meses.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">11. Encerramento da conta</h2>
            <p>
              Você pode encerrar sua conta a qualquer momento em <em>Configurações → Excluir conta</em>.
              Podemos suspender ou encerrar sua conta em caso de violação destes Termos, com ou sem aviso
              prévio, dependendo da gravidade da infração.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">12. Privacidade</h2>
            <p>
              O tratamento dos seus dados pessoais é regido pela nossa{' '}
              <button
                onClick={() => navigate('/privacidade')}
                className="text-emerald-600 hover:underline"
              >
                Política de Privacidade
              </button>
              , que é parte integrante destes Termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">13. Alterações nos termos</h2>
            <p>
              Podemos atualizar estes Termos a qualquer momento. Mudanças substanciais serão comunicadas
              com antecedência mínima de 15 dias. O uso continuado da plataforma após a vigência das
              alterações constitui aceitação dos novos termos.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">14. Lei aplicável e foro</h2>
            <p>
              Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro
              da comarca de São Paulo/SP para dirimir quaisquer controvérsias, com renúncia expressa a
              qualquer outro, por mais privilegiado que seja.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">15. Contato</h2>
            <p>
              Para dúvidas sobre estes Termos, entre em contato:{' '}
              <a href="mailto:contato@zapmenu.com.br" className="text-emerald-600 hover:underline">
                contato@zapmenu.com.br
              </a>
            </p>
          </section>

        </div>
      </div>
    </div>
  );
}

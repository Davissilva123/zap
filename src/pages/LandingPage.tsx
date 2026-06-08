import { useNavigate } from 'react-router-dom';
import { Zap, QrCode, MessageCircle, CreditCard, ChefHat, Bike, BarChart2, Star, Tag, Check, ArrowRight, Smartphone, Shield, Users } from 'lucide-react';

const features = [
  { icon: QrCode, title: 'Cardápio via QR Code', desc: 'Clientes acessam pelo celular sem baixar nenhum app' },
  { icon: MessageCircle, title: 'WhatsApp automático', desc: 'Notificação instantânea de cada pedido no seu WhatsApp' },
  { icon: CreditCard, title: 'PIX integrado', desc: 'Cobrança PIX via Mercado Pago, sem maquininha' },
  { icon: ChefHat, title: 'KDS para cozinha', desc: 'Tela de cozinha em tempo real para seus operadores' },
  { icon: Bike, title: 'Sistema de entregadores', desc: 'Portal com GPS e rotas para suas entregas' },
  { icon: BarChart2, title: 'Relatórios completos', desc: 'Faturamento, itens mais vendidos e performance diária' },
  { icon: Star, title: 'Avaliações dos clientes', desc: 'Colete feedback e melhore seu serviço continuamente' },
  { icon: Tag, title: 'Cupons e promoções', desc: 'Crie descontos e fidelidade para seus clientes' },
];

const steps = [
  { n: '1', title: 'Cadastre seu cardápio', desc: 'Crie categorias, adicione itens com fotos e preços em poucos minutos' },
  { n: '2', title: 'Compartilhe o QR Code', desc: 'Imprima ou exiba no balcão. Clientes acessam direto pelo celular' },
  { n: '3', title: 'Receba pedidos e pague', desc: 'Pedidos chegam em tempo real. PIX automático no Mercado Pago' },
];

const plans = [
  {
    name: 'Grátis',
    price: 'R$ 0',
    period: 'para sempre',
    highlight: false,
    btnClass: 'bg-slate-900 hover:bg-slate-800 text-white',
    borderClass: 'border-slate-200',
    label: 'Começar grátis',
    items: ['Cardápio online com QR Code', 'Até 30 itens no cardápio', 'Portal do cliente com histórico', 'Pedidos manuais (WhatsApp)', 'Suporte por email'],
  },
  {
    name: 'Pro',
    price: 'R$ 79',
    period: 'por mês',
    highlight: true,
    badge: 'Mais popular',
    btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderClass: 'border-emerald-500 ring-2 ring-emerald-500/20',
    label: 'Assinar Pro',
    items: ['Tudo do Grátis', 'Itens ilimitados', 'PIX automático (Mercado Pago)', 'WhatsApp automático', 'KDS para cozinha', 'Entregadores com GPS', 'Relatórios avançados', 'Operadores ilimitados', 'Cupons e promoções', 'Suporte prioritário'],
  },
];

export default function LandingPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-100">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-tight">ZapMenu</span>
          </div>
          <nav className="hidden sm:flex items-center gap-6 text-sm font-medium text-slate-500">
            <a href="#recursos" className="hover:text-slate-900 transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-slate-900 transition-colors">Como funciona</a>
            <a href="#precos" className="hover:text-slate-900 transition-colors">Preços</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/login')} className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Entrar
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-3 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-emerald-500/20 hover:-translate-y-0.5"
            >
              Começar grátis
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-[#0f1c14] to-slate-900 text-white">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-20%,rgba(5,150,105,0.25),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_40%_50%_at_90%_60%,rgba(5,150,105,0.12),transparent)]" />
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 pt-20 pb-24 sm:pt-28 sm:pb-32 text-center">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 text-emerald-400 text-xs font-semibold mb-7 tracking-wide uppercase">
            <Zap className="w-3 h-3" /> Cardápio digital inteligente
          </div>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-black leading-[1.08] tracking-tight mb-6">
            Seu restaurante no digital<br />
            <span className="text-emerald-400">em 15 minutos</span>
          </h1>
          <p className="text-slate-300 text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed">
            Cardápio via QR Code, pedidos com PIX automático, KDS para cozinha e sistema de entregadores — tudo integrado e fácil de usar.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl text-base transition-all shadow-2xl shadow-emerald-500/30 hover:-translate-y-1 hover:shadow-emerald-400/40"
            >
              Criar cardápio grátis <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full sm:w-auto px-8 py-4 bg-white/8 hover:bg-white/12 text-white font-semibold rounded-2xl text-base transition-all border border-white/10 backdrop-blur-sm"
            >
              Ver demonstração
            </button>
          </div>
          <p className="text-slate-500 text-sm">Sem cartão de crédito · Grátis para sempre no plano básico</p>

          {/* Stats */}
          <div className="mt-16 pt-12 border-t border-white/8 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[
              { n: '500+', l: 'Restaurantes' },
              { n: '98%', l: 'Satisfação' },
              { n: '15min', l: 'Para configurar' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-2xl font-black text-white mb-1">{s.n}</div>
                <div className="text-xs text-slate-500 font-medium">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="recursos" className="py-20 sm:py-24 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">
              Tudo que seu restaurante precisa
            </h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">
              Uma plataforma completa para digitalizar e crescer
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <div
                key={i}
                className="group p-5 rounded-2xl border border-slate-100 hover:border-emerald-200/80 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Como funciona</h2>
            <p className="text-slate-500 text-lg">Configure rápido, venda para sempre</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden sm:block absolute top-7 left-[58%] w-[84%] h-px bg-gradient-to-r from-emerald-300 to-slate-200" />
                )}
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30 relative z-10">
                  {s.n}
                </div>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social proof */}
      <section className="py-14 bg-white border-y border-slate-100">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <p className="text-center text-slate-400 text-sm font-medium mb-8 uppercase tracking-widest">O que dizem nossos clientes</p>
          <div className="grid sm:grid-cols-3 gap-5">
            {[
              { q: 'Configurei em 20 minutos e já estava recebendo pedidos com PIX. Incrível!', n: 'Carlos M.', r: 'Hamburgueria do Carlos' },
              { q: 'Os entregadores adoram o sistema de GPS. Zero ligação pra confirmar endereço.', n: 'Ana R.', r: 'Pizzaria Roma' },
              { q: 'A cozinha ficou muito mais organizada com a tela KDS. Recomendo muito.', n: 'Pedro S.', r: 'Restaurante Sabor' },
            ].map((t, i) => (
              <div key={i} className="p-5 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}
                </div>
                <p className="text-slate-700 text-sm leading-relaxed mb-4">"{t.q}"</p>
                <div>
                  <p className="text-sm font-bold text-slate-900">{t.n}</p>
                  <p className="text-xs text-slate-400">{t.r}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="precos" className="py-20 sm:py-24 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Planos simples</h2>
            <p className="text-slate-500 text-lg">Comece grátis e evolua quando precisar</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            {plans.map((plan, i) => (
              <div key={i} className={`relative p-8 rounded-3xl border-2 bg-white ${plan.borderClass}`}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="bg-emerald-600 text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg shadow-emerald-500/20">
                      {plan.badge}
                    </span>
                  </div>
                )}
                <div className="mb-7">
                  <h3 className="font-black text-slate-900 text-xl mb-3">{plan.name}</h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-4xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 text-sm">/{plan.period}</span>
                  </div>
                </div>
                <ul className="space-y-3 mb-8">
                  {plan.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2.5 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3.5 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 ${plan.btnClass}`}
                >
                  {plan.label}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-br from-emerald-600 to-emerald-700 text-white overflow-hidden relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_80%_at_50%_120%,rgba(255,255,255,0.08),transparent)]" />
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <Smartphone className="w-12 h-12 mx-auto mb-6 opacity-70" />
          <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">
            Pronto para modernizar seu restaurante?
          </h2>
          <p className="text-emerald-100 text-lg mb-8 leading-relaxed">
            Junte-se a centenas de restaurantes que já usam o ZapMenu para vender mais e trabalhar melhor.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="inline-flex items-center gap-2.5 px-10 py-4 bg-white text-emerald-700 font-bold rounded-2xl text-base transition-all hover:bg-emerald-50 hover:-translate-y-1 shadow-2xl shadow-emerald-900/30"
          >
            Criar meu cardápio grátis <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-emerald-200/60 text-sm mt-5">Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-10 bg-slate-900">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-white text-[15px]">ZapMenu</span>
            </div>
            <div className="flex items-center gap-5 sm:gap-7 text-sm text-slate-500">
              <button onClick={() => navigate('/login')} className="hover:text-slate-300 transition-colors">Entrar</button>
              <a href="#precos" className="hover:text-slate-300 transition-colors">Preços</a>
              <a href="#recursos" className="hover:text-slate-300 transition-colors">Recursos</a>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" />
                <span>Dados protegidos</span>
              </div>
            </div>
            <p className="text-slate-600 text-xs">© 2025 ZapMenu</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

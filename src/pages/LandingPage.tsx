import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Zap, QrCode, MessageCircle, CreditCard, ChefHat, Bike, BarChart2, Star, Tag, Check,
  ArrowRight, Smartphone, Shield, Crown, X, Phone, Mail, MapPin, Send,
  ClipboardList, Users, LayoutDashboard, Package, Percent, Printer, Wifi, Clock,
} from 'lucide-react';
import { db } from '../lib/db';

const FALLBACK_WA_NUMBER = import.meta.env.VITE_WHATSAPP_CONTACT ?? '5511999999999';
const FALLBACK_WA_MSG = 'Olá! Tenho interesse em saber mais sobre o ZapMenu para meu restaurante. Pode me ajudar?';

const features = [
  { icon: QrCode,         title: 'Cardápio via QR Code',       desc: 'Clientes acessam pelo celular sem baixar nenhum app' },
  { icon: MessageCircle,  title: 'WhatsApp automático',         desc: 'Notificação instantânea de cada pedido no seu WhatsApp' },
  { icon: CreditCard,     title: 'PIX integrado',               desc: 'Cobrança PIX via Mercado Pago, sem maquininha' },
  { icon: ChefHat,        title: 'KDS para cozinha',            desc: 'Tela de cozinha em tempo real para seus operadores' },
  { icon: Bike,           title: 'Sistema de entregadores',     desc: 'Portal com GPS e rotas para suas entregas' },
  { icon: BarChart2,      title: 'Relatórios completos',        desc: 'Faturamento, itens mais vendidos e performance diária' },
  { icon: Star,           title: 'Avaliações dos clientes',     desc: 'Colete feedback e melhore seu serviço continuamente' },
  { icon: Tag,            title: 'Cupons e promoções',          desc: 'Crie descontos e fidelidade para seus clientes' },
];

const steps = [
  { n: '1', title: 'Cadastre seu cardápio',   desc: 'Crie categorias, adicione itens com fotos e preços em poucos minutos' },
  { n: '2', title: 'Compartilhe o QR Code',   desc: 'Imprima ou exiba no balcão. Clientes acessam direto pelo celular' },
  { n: '3', title: 'Receba pedidos e pague',  desc: 'Pedidos chegam em tempo real. PIX automático no Mercado Pago' },
];

const plans = [
  {
    name: 'Básico', price: 'R$ 39', period: 'mês', trial: '7 dias grátis',
    highlight: false, btnClass: 'bg-slate-900 hover:bg-slate-800 text-white',
    borderClass: 'border-slate-200',
    items: ['Cardápio online com QR Code', 'Até 50 itens', 'Portal do cliente', 'Pedidos via WhatsApp (manual)', '2 operadores', 'Suporte por email'],
  },
  {
    name: 'Pro', price: 'R$ 89', period: 'mês', trial: '7 dias grátis', highlight: true,
    badge: 'Mais popular', btnClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
    borderClass: 'border-emerald-500 ring-2 ring-emerald-500/20',
    items: ['Tudo do Básico', 'Itens ilimitados', 'PIX automático', 'WhatsApp automático', 'Relatórios e análises', 'Cupons e promoções', 'Até 5 operadores', 'Suporte prioritário'],
  },
  {
    name: 'Premium', price: 'R$ 149', period: 'mês', trial: '7 dias grátis',
    highlight: false, badge: 'Completo', btnClass: 'bg-violet-600 hover:bg-violet-700 text-white',
    borderClass: 'border-violet-400 ring-2 ring-violet-400/20',
    items: ['Tudo do Pro', 'Operadores ilimitados', 'KDS para cozinha', 'Entregadores com GPS', 'Comandas digitais', 'Avaliações dos clientes', 'Suporte via WhatsApp'],
  },
];

// Módulos para o modal "Ver demonstração"
const demoModules = [
  {
    icon: LayoutDashboard, color: 'bg-emerald-100 text-emerald-600',
    title: 'Dashboard',
    desc: 'Visão geral do restaurante: pedidos do dia, faturamento, itens mais vendidos e status em tempo real.',
  },
  {
    icon: QrCode, color: 'bg-blue-100 text-blue-600',
    title: 'Cardápio Digital + QR Code',
    desc: 'Monte categorias e itens com fotos, preços e descrições. Gere QR Code personalizado para imprimir ou compartilhar.',
  },
  {
    icon: ClipboardList, color: 'bg-amber-100 text-amber-600',
    title: 'Pedidos em Tempo Real',
    desc: 'Receba e gerencie pedidos de delivery, retirada e mesa. Notificação imediata no WhatsApp do restaurante.',
  },
  {
    icon: CreditCard, color: 'bg-violet-100 text-violet-600',
    title: 'PIX Automático (Mercado Pago)',
    desc: 'Cliente paga na hora com PIX gerado automaticamente. Sem maquininha, sem taxa de cartão.',
  },
  {
    icon: ChefHat, color: 'bg-orange-100 text-orange-600',
    title: 'KDS — Tela da Cozinha',
    desc: 'Monitor dedicado para a cozinha com status de cada item. Reduz erros e acelera o preparo.',
  },
  {
    icon: Bike, color: 'bg-sky-100 text-sky-600',
    title: 'Sistema de Entregadores',
    desc: 'Portal exclusivo para motoboys com lista de pedidos, endereço e integração com Google Maps.',
  },
  {
    icon: Users, color: 'bg-pink-100 text-pink-600',
    title: 'Operadores e Mesas',
    desc: 'Crie contas para garçons e caixas com permissões separadas. Controle por mesa e comanda digital.',
  },
  {
    icon: BarChart2, color: 'bg-emerald-100 text-emerald-600',
    title: 'Relatórios e Analytics',
    desc: 'Faturamento por período, itens mais pedidos, horário de pico e desempenho por categoria.',
  },
  {
    icon: Tag, color: 'bg-rose-100 text-rose-600',
    title: 'Cupons e Promoções',
    desc: 'Crie cupons de desconto fixo ou percentual com validade e limite de uso. Fideliza clientes.',
  },
  {
    icon: Star, color: 'bg-yellow-100 text-yellow-600',
    title: 'Avaliações dos Clientes',
    desc: 'Colete notas e comentários após cada pedido. Veja sua média e responda feedback.',
  },
  {
    icon: Package, color: 'bg-slate-100 text-slate-600',
    title: 'Portal do Cliente',
    desc: 'Cada cliente tem perfil com histórico de pedidos, endereços salvos e recompras com 1 clique.',
  },
  {
    icon: Percent, color: 'bg-teal-100 text-teal-600',
    title: 'Assinatura e Pagamento',
    desc: 'Planos mensais com cartão ou boleto via Stripe. Cancele a qualquer momento, sem fidelidade.',
  },
  {
    icon: Printer, color: 'bg-indigo-100 text-indigo-600',
    title: 'Impressão de Recibos',
    desc: 'Imprima comprovantes de pagamento para seus clientes diretamente do painel.',
  },
  {
    icon: Wifi, color: 'bg-cyan-100 text-cyan-600',
    title: 'Cardápio Sempre Online',
    desc: 'Link permanente do seu restaurante. Funciona em qualquer celular sem instalar app.',
  },
  {
    icon: Clock, color: 'bg-amber-100 text-amber-600',
    title: 'Horários de Funcionamento',
    desc: 'Configure dias e horários de abertura. Cardápio informa automaticamente quando está fechado.',
  },
];

export default function LandingPage() {
  const navigate = useNavigate();
  const [showDemo, setShowDemo] = useState(false);
  const [waNumber, setWaNumber] = useState(FALLBACK_WA_NUMBER);
  const [waMsg, setWaMsg] = useState(FALLBACK_WA_MSG);
  const [contactEmail, setContactEmail] = useState('contato@zapmenu.com.br');
  const [contactPhone, setContactPhone] = useState('+55 (11) 99999-9999');
  const [heroTitle, setHeroTitle] = useState('Cardápio digital para o seu restaurante');
  const [heroSubtitle, setHeroSubtitle] = useState('Crie seu cardápio, gere QR Codes e receba pedidos com pagamento via PIX — tudo em um só lugar.');
  const [businessHours, setBusinessHours] = useState('Segunda a sexta, das 9h às 18h. Suporte via WhatsApp.');

  useEffect(() => {
    db.getMarketingSettings().then(s => {
      if (!s) return;
      if (s.whatsappNumber) setWaNumber(s.whatsappNumber);
      if (s.whatsappMessage) setWaMsg(s.whatsappMessage);
      if (s.contactEmail) setContactEmail(s.contactEmail);
      if (s.contactPhone) setContactPhone(s.contactPhone);
      if (s.heroTitle) setHeroTitle(s.heroTitle);
      if (s.heroSubtitle) setHeroSubtitle(s.heroSubtitle);
      if (s.businessHours) setBusinessHours(s.businessHours);
    }).catch(() => {});
  }, []);

  const waLink = (msg?: string) => `https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(msg ?? waMsg)}`;

  const goRegister = () => navigate('/login?register=1');

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
            <a href="#recursos"      className="hover:text-slate-900 transition-colors">Recursos</a>
            <a href="#como-funciona" className="hover:text-slate-900 transition-colors">Como funciona</a>
            <a href="#precos"        className="hover:text-slate-900 transition-colors">Preços</a>
            <a href="#contato"       className="hover:text-slate-900 transition-colors">Contato</a>
          </nav>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => navigate('/login')} className="px-3 sm:px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Entrar
            </button>
            <button onClick={goRegister} className="px-3 sm:px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-emerald-500/20 hover:-translate-y-0.5">
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
              onClick={goRegister}
              className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl text-base transition-all shadow-2xl shadow-emerald-500/30 hover:-translate-y-1 hover:shadow-emerald-400/40"
            >
              Criar Cardápio <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowDemo(true)}
              className="w-full sm:w-auto px-8 py-4 bg-white/8 hover:bg-white/12 text-white font-semibold rounded-2xl text-base transition-all border border-white/10 backdrop-blur-sm"
            >
              Ver demonstração
            </button>
          </div>
          <p className="text-slate-500 text-sm">7 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>

          <div className="mt-16 pt-12 border-t border-white/8 grid grid-cols-3 gap-6 max-w-lg mx-auto">
            {[{ n: '500+', l: 'Restaurantes' }, { n: '98%', l: 'Satisfação' }, { n: '15min', l: 'Para configurar' }].map((s, i) => (
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
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Tudo que seu restaurante precisa</h2>
            <p className="text-slate-500 text-lg max-w-xl mx-auto">Uma plataforma completa para digitalizar e crescer</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
            {features.map((f, i) => (
              <div key={i} className="group p-5 rounded-2xl border border-slate-100 hover:border-emerald-200/80 hover:shadow-xl hover:shadow-emerald-500/5 transition-all duration-300 hover:-translate-y-0.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 group-hover:bg-emerald-100 flex items-center justify-center mb-4 transition-colors">
                  <f.icon className="w-5 h-5 text-emerald-600" />
                </div>
                <h3 className="font-bold text-slate-900 text-sm mb-1.5">{f.title}</h3>
                <p className="text-slate-500 text-xs leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <button onClick={() => setShowDemo(true)} className="inline-flex items-center gap-2 px-6 py-3 border-2 border-emerald-500 text-emerald-600 hover:bg-emerald-50 font-bold rounded-xl transition-all text-sm">
              Ver todas as funcionalidades <ArrowRight className="w-4 h-4" />
            </button>
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
                <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white font-black text-xl flex items-center justify-center mx-auto mb-5 shadow-lg shadow-emerald-500/30 relative z-10">{s.n}</div>
                <h3 className="font-bold text-slate-900 mb-2">{s.title}</h3>
                <p className="text-slate-500 text-sm leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
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
                <div className="flex gap-0.5 mb-3">{[...Array(5)].map((_, j) => <Star key={j} className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />)}</div>
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Planos simples e transparentes</h2>
            <p className="text-slate-500 text-lg">Todos com <strong>7 dias grátis</strong> — sem cartão de crédito · Cancele a qualquer momento</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-5">
            {plans.map((plan, i) => (
              <div key={i} className={`relative p-7 rounded-3xl border-2 bg-white flex flex-col ${plan.borderClass}`}>
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className={`text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg ${plan.highlight ? 'bg-emerald-600' : 'bg-violet-600'}`}>{plan.badge}</span>
                  </div>
                )}
                <div className="mb-6">
                  <h3 className="font-black text-slate-900 text-lg mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-black text-slate-900">{plan.price}</span>
                    <span className="text-slate-400 text-sm">/{plan.period}</span>
                  </div>
                  <p className="text-xs text-emerald-600 font-semibold mt-1">{plan.trial}</p>
                </div>
                <ul className="space-y-2.5 mb-7 flex-1">
                  {plan.items.map((item, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-slate-600">
                      <Check className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />{item}
                    </li>
                  ))}
                </ul>
                <button onClick={goRegister} className={`w-full py-3 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5 ${plan.btnClass}`}>
                  Começar grátis
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
          <h2 className="text-3xl sm:text-4xl font-black mb-4 tracking-tight">Pronto para modernizar seu restaurante?</h2>
          <p className="text-emerald-100 text-lg mb-8 leading-relaxed">
            Junte-se a centenas de restaurantes que já usam o ZapMenu para vender mais e trabalhar melhor.
          </p>
          <button onClick={goRegister} className="inline-flex items-center gap-2.5 px-10 py-4 bg-white text-emerald-700 font-bold rounded-2xl text-base transition-all hover:bg-emerald-50 hover:-translate-y-1 shadow-2xl shadow-emerald-900/30">
            Criar Cardápio <ArrowRight className="w-5 h-5" />
          </button>
          <p className="text-emerald-200/60 text-sm mt-5">7 dias grátis · Sem cartão de crédito · Cancele quando quiser</p>
        </div>
      </section>

      {/* Contato */}
      <section id="contato" className="py-20 sm:py-24 bg-slate-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-black text-slate-900 mb-3 tracking-tight">Entre em contato</h2>
            <p className="text-slate-500 text-lg">Estamos prontos para ajudar seu restaurante a crescer</p>
          </div>
          <div className="grid sm:grid-cols-3 gap-6 mb-10">
            {[
              {
                icon: MessageCircle, color: 'bg-emerald-100 text-emerald-600',
                title: 'WhatsApp', value: 'Atendimento rápido',
                action: () => window.open(waLink(), '_blank'),
                btn: 'Falar no WhatsApp',
              },
              {
                icon: Mail, color: 'bg-blue-100 text-blue-600',
                title: 'E-mail', value: contactEmail,
                action: () => window.open(`mailto:${contactEmail}`, '_blank'),
                btn: 'Enviar e-mail',
              },
              {
                icon: Phone, color: 'bg-violet-100 text-violet-600',
                title: 'Telefone / WhatsApp', value: contactPhone,
                action: () => window.open(waLink(), '_blank'),
                btn: 'Ligar / Chamar',
              },
            ].map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 p-6 text-center flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${c.color}`}>
                  <c.icon className="w-6 h-6" />
                </div>
                <div>
                  <p className="font-bold text-slate-900 text-sm">{c.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{c.value}</p>
                </div>
                <button onClick={c.action} className="mt-1 px-4 py-2 bg-slate-900 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-colors">
                  {c.btn}
                </button>
              </div>
            ))}
          </div>
          <div className="bg-white rounded-2xl border border-slate-100 p-6 flex flex-col sm:flex-row items-center gap-4 shadow-sm">
            <div className="flex items-center gap-3 flex-1">
              <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <MapPin className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-sm">Horário de atendimento</p>
                <p className="text-slate-500 text-xs">{businessHours}</p>
              </div>
            </div>
            <button
              onClick={() => window.open(waLink(), '_blank')}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-all flex-shrink-0"
            >
              <Send className="w-4 h-4" /> Falar com a equipe
            </button>
          </div>
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
              <a href="#precos"   className="hover:text-slate-300 transition-colors">Preços</a>
              <a href="#recursos" className="hover:text-slate-300 transition-colors">Recursos</a>
              <a href="#contato"  className="hover:text-slate-300 transition-colors">Contato</a>
              <div className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-500" /><span>Dados protegidos</span>
              </div>
            </div>
            <p className="text-slate-600 text-xs">© 2025 ZapMenu</p>
          </div>
        </div>
      </footer>

      {/* WhatsApp flutuante */}
      <a
        href={waLink()}
        target="_blank"
        rel="noreferrer"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5a] rounded-full flex items-center justify-center shadow-2xl shadow-green-500/40 transition-all hover:scale-110 hover:-translate-y-1"
        title="Falar no WhatsApp"
      >
        <svg viewBox="0 0 24 24" className="w-7 h-7 fill-white">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      {/* Modal Demonstração */}
      {showDemo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowDemo(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-3xl z-10 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 flex-shrink-0">
              <div>
                <h2 className="text-xl font-black text-slate-900">Todas as funcionalidades</h2>
                <p className="text-slate-500 text-sm mt-0.5">Tudo que o ZapMenu oferece para seu restaurante</p>
              </div>
              <button onClick={() => setShowDemo(false)} className="p-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="overflow-y-auto p-6 grid sm:grid-cols-2 gap-4">
              {demoModules.map((m, i) => (
                <div key={i} className="flex gap-3 p-4 rounded-2xl border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${m.color}`}>
                    <m.icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="font-bold text-slate-900 text-sm mb-0.5">{m.title}</p>
                    <p className="text-slate-500 text-xs leading-relaxed">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-6 border-t border-slate-100 flex-shrink-0">
              <button onClick={() => { setShowDemo(false); goRegister(); }} className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-all text-sm">
                Começar 7 dias grátis <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

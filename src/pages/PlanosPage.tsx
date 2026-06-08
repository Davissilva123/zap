import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Check, X, Zap, Star, Crown, Lock, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';

const PLANS = [
  {
    slug: 'basic', name: 'Básico', price: 39,
    icon: Zap, color: 'border-slate-200', iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
    btn: 'bg-slate-800 hover:bg-slate-900', badge: null,
    description: 'Para quem está começando',
    features: [
      { label: 'Cardápio online + QR Code', ok: true },
      { label: 'Até 50 itens', ok: true },
      { label: 'Portal do cliente', ok: true },
      { label: '2 operadores', ok: true },
      { label: 'PIX automático', ok: false },
      { label: 'Relatórios e analytics', ok: false },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
    ],
  },
  {
    slug: 'pro', name: 'Pro', price: 89,
    icon: Star, color: 'border-emerald-400 ring-2 ring-emerald-400/20', iconBg: 'bg-emerald-100', iconColor: 'text-emerald-600',
    btn: 'bg-emerald-600 hover:bg-emerald-700', badge: 'Mais popular',
    description: 'Para crescer com tecnologia',
    features: [
      { label: 'Tudo do Básico', ok: true },
      { label: 'Itens ilimitados', ok: true },
      { label: 'PIX automático', ok: true },
      { label: 'WhatsApp automático', ok: true },
      { label: 'Relatórios e analytics', ok: true },
      { label: 'Cupons e promoções', ok: true },
      { label: 'Até 5 operadores', ok: true },
      { label: 'KDS para cozinha', ok: false },
    ],
  },
  {
    slug: 'premium', name: 'Premium', price: 149,
    icon: Crown, color: 'border-violet-500 ring-2 ring-violet-500/20', iconBg: 'bg-violet-100', iconColor: 'text-violet-600',
    btn: 'bg-violet-600 hover:bg-violet-700', badge: 'Completo',
    description: 'Solução completa para redes',
    features: [
      { label: 'Tudo do Pro', ok: true },
      { label: 'Operadores ilimitados', ok: true },
      { label: 'KDS para cozinha', ok: true },
      { label: 'Entregadores + GPS', ok: true },
      { label: 'Comandas digitais', ok: true },
      { label: 'Avaliações dos clientes', ok: true },
      { label: 'Suporte via WhatsApp', ok: true },
      { label: 'Relatórios avançados + CSV', ok: true },
    ],
  },
];

const STRIPE_CONFIGURED = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

interface Props {
  reason?: 'expired' | 'blocked';
}

export default function PlanosPage({ reason = 'expired' }: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({ basic: 39, pro: 89, premium: 149 });
  const [pixSettings, setPixSettings] = useState<{ pixKey: string; pixKeyType: string; pixBeneficiary: string } | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [selectedPlanForPix, setSelectedPlanForPix] = useState<{ name: string; price: number } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    db.getPlatformPlanPrices().then(setPrices).catch(() => {});
    db.getPixSettings().then(setPixSettings).catch(() => {});
  }, []);

  const handleCopyPix = () => {
    if (!pixSettings?.pixKey) return;
    navigator.clipboard.writeText(pixSettings.pixKey).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const openPixModal = (slug: string) => {
    const price = prices[slug] ?? PLANS.find(p => p.slug === slug)?.price ?? 0;
    const name = PLANS.find(p => p.slug === slug)?.name ?? slug;
    setSelectedPlanForPix({ name, price });
    setShowPixModal(true);
  };

  const handleSubscribe = async (slug: string) => {
    setLoading(slug);
    setError('');
    try {
      if (STRIPE_CONFIGURED) {
        const url = await db.checkoutWithStripe(slug);
        window.location.href = url;
      } else {
        // Stripe não configurado — abre WhatsApp para contato
        const msg = encodeURIComponent(
          `Olá! Quero assinar o ZapMenu — Plano ${PLANS.find(p => p.slug === slug)?.name}.\nPode me ajudar?`
        );
        window.open(`https://wa.me/55?text=${msg}`, '_blank');
      }
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao processar. Tente novamente.');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f1c14] to-slate-900 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white text-xl tracking-tight">ZapMenu</span>
          </div>

          <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5 ${
            reason === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
          }`}>
            <Lock className="w-4 h-4" />
            {reason === 'blocked' ? 'Acesso suspenso por inadimplência' : 'Seu período de teste encerrou'}
          </div>

          <h1 className="text-3xl font-black text-white mb-2">
            {reason === 'blocked' ? 'Reative seu acesso' : 'Escolha seu plano'}
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {reason === 'blocked'
              ? 'Regularize sua assinatura para reativar o cardápio.'
              : 'Assine agora e continue usando o ZapMenu sem interrupções.'}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-2xl text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        {/* Stripe não configurado — aviso */}
        {!STRIPE_CONFIGURED && (
          <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-amber-300 text-sm text-center flex items-center gap-2 justify-center">
            <ExternalLink className="w-4 h-4 flex-shrink-0" />
            Pagamento por cartão em configuração. Clique em "Assinar" para entrar em contato pelo WhatsApp.
          </div>
        )}

        {/* Cards de planos */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isLoading = loading === plan.slug;
            return (
              <div
                key={plan.slug}
                className={`relative bg-white rounded-3xl border-2 p-6 flex flex-col ${plan.color} ${plan.badge ? 'shadow-xl' : 'shadow-lg'}`}
              >
                {plan.badge && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                    <span className="text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg bg-emerald-600">{plan.badge}</span>
                  </div>
                )}

                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.iconBg}`}>
                  <Icon className={`w-5 h-5 ${plan.iconColor}`} />
                </div>

                <h3 className="text-xl font-black text-slate-900 mb-1">{plan.name}</h3>
                <p className="text-xs text-slate-400 mb-4">{plan.description}</p>

                <div className="mb-5">
                  <span className="text-3xl font-black text-slate-900">R$ {prices[plan.slug] ?? plan.price}</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                  <p className="text-xs text-slate-400 mt-0.5">cobrado mensalmente no cartão</p>
                </div>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-600' : 'text-slate-300'}`}>
                      {f.ok
                        ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5" />}
                      {f.label}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleSubscribe(plan.slug)}
                  disabled={!!loading}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${plan.btn}`}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : STRIPE_CONFIGURED ? (
                    `Assinar R$ ${prices[plan.slug] ?? plan.price}/mês`
                  ) : (
                    'Assinar via WhatsApp'
                  )}
                </button>

                {/* Opção PIX manual */}
                {pixSettings?.pixKey && (
                  <button
                    onClick={() => openPixModal(plan.slug)}
                    disabled={!!loading}
                    className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 text-sm font-semibold rounded-xl transition-all mt-2"
                  >
                    <span className="text-base">⚡</span> Pagar via PIX
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="text-center mt-8">
          <p className="text-slate-500 text-xs mb-3">
            Cobrança recorrente mensal · Cancele quando quiser
          </p>
          <button
            onClick={() => logout().then(() => navigate('/'))}
            className="text-slate-600 hover:text-slate-400 text-xs underline transition-colors"
          >
            Sair da conta
          </button>
        </div>
      </div>

      {/* Modal PIX */}
      {showPixModal && selectedPlanForPix && pixSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPixModal(false)} />
          <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">⚡</span>
            </div>
            <h3 className="text-lg font-black text-slate-900 mb-1">Pagamento via PIX</h3>
            <p className="text-sm text-slate-500 mb-1">
              Plano <strong>{selectedPlanForPix.name}</strong>
            </p>
            <p className="text-2xl font-black text-emerald-600 mb-5">
              R$ {selectedPlanForPix.price.toFixed(2).replace('.', ',')}
            </p>

            <div className="bg-slate-50 rounded-2xl p-4 mb-4 text-left space-y-2">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Beneficiário</p>
                <p className="text-sm font-bold text-slate-800">{pixSettings.pixBeneficiary}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Chave PIX ({pixSettings.pixKeyType.toUpperCase()})</p>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono font-semibold text-slate-800 flex-1 break-all">{pixSettings.pixKey}</p>
                  <button
                    onClick={handleCopyPix}
                    className={`flex-shrink-0 p-1.5 rounded-lg transition-colors ${copied ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 hover:bg-slate-300 text-slate-600'}`}
                    title="Copiar chave PIX"
                  >
                    {copied ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-5 text-left">
              <p className="text-xs text-amber-800 font-semibold mb-1">Após fazer o PIX:</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Envie o comprovante para nosso WhatsApp. Seu acesso será liberado em até 1 hora útil.
              </p>
            </div>

            <button
              onClick={() => setShowPixModal(false)}
              className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-colors text-sm"
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

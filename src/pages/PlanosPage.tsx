import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Check, X, Zap, Star, Crown, Lock, ExternalLink, Copy, CheckCircle } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';

const PLANS = [
  {
    slug: 'basic', name: 'Básico', price: 39,
    icon: Zap, color: 'border-slate-200', iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
    btn: 'bg-slate-800 hover:bg-slate-900', badge: null,
    description: 'Para quem está começando',
    features: [
      { label: 'Cardápio online + QR Code', ok: true },
      { label: 'Até 50 itens no cardápio', ok: true },
      { label: 'Portal do cliente', ok: true },
      { label: 'Pedidos via WhatsApp (manual)', ok: true },
      { label: '2 operadores', ok: true },
      { label: 'Suporte por email', ok: true },
      { label: 'PIX automático', ok: false },
      { label: 'CRM e gestão de clientes', ok: false },
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
      { label: 'PIX + WhatsApp automático', ok: true },
      { label: 'CRM e segmentação de clientes', ok: true },
      { label: 'Estoque, caixa e combos/kits', ok: true },
      { label: 'Promoções automáticas por horário', ok: true },
      { label: 'Relatórios, analytics e cupons', ok: true },
      { label: 'Até 5 operadores + suporte prioritário', ok: true },
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
      { label: 'KDS para cozinha + Comandas digitais', ok: true },
      { label: 'Entregadores + GPS em tempo real', ok: true },
      { label: 'Rastreamento de entrega pelo cliente', ok: true },
      { label: 'Campanhas de WhatsApp por segmento', ok: true },
      { label: 'Avaliações, 2FA e domínio próprio', ok: true },
      { label: 'Suporte exclusivo via WhatsApp', ok: true },
    ],
  },
];

const STRIPE_CONFIGURED = !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

interface Props {
  reason?: 'expired' | 'blocked';
}

export default function PlanosPage({ reason }: Props) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [prices, setPrices] = useState<Record<string, number>>({ basic: 39, pro: 89, premium: 149 });
  const [pixSettings, setPixSettings] = useState<{ pixKey: string; pixKeyType: string; pixBeneficiary: string } | null>(null);
  const [showPixModal, setShowPixModal] = useState(false);
  const [selectedPlanForPix, setSelectedPlanForPix] = useState<{ name: string; price: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [actualStatus, setActualStatus] = useState<string | null>(null);
  const [waNumber, setWaNumber] = useState('');
  const [trialSettings, setTrialSettings] = useState<Record<string, { enabled: boolean; days: number }>>({
    basic: { enabled: true, days: 7 },
    pro:   { enabled: true, days: 7 },
    premium: { enabled: true, days: 7 },
  });

  const isNew = new URLSearchParams(window.location.search).has('new');

  useEffect(() => {
    db.getPlatformPlanPrices().then(setPrices).catch(() => {});
    db.getPixSettings().then(setPixSettings).catch(() => {});
    db.getMarketingSettings().then(s => { if (s?.whatsappNumber) setWaNumber(s.whatsappNumber); }).catch(() => {});
    db.getPlanTrialSettings().then(list => {
      if (!list.length) return;
      const map: Record<string, { enabled: boolean; days: number }> = {};
      list.forEach(p => { map[p.slug] = { enabled: p.trialEnabled, days: p.trialDays }; });
      setTrialSettings(map);
    }).catch(() => {});

    // Busca status real do plano para não mostrar mensagem errada
    db.getMyPlan().then(plan => {
      setActualStatus(plan?.status ?? 'none');
      // Novo usuário sem plano — tenta criar trial e redireciona
      if (!plan || plan.status === 'none' || isNew) {
        if (user) {
          supabase.rpc('create_trial_plan', { p_user_id: user.id })
            .then(() => db.getMyPlan())
            .then(p => { if (p && p.status === 'trial') navigate('/dashboard', { replace: true }); })
            .catch(() => {});
        }
      }
    }).catch(() => setActualStatus('none'));
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

  const canClose = actualStatus === 'trial' || actualStatus === 'active';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f1c14] to-slate-900 flex items-center justify-center px-4 py-12">

      {/* Botão fechar — só aparece quando usuário tem plano ativo */}
      {canClose && (
        <button
          onClick={() => navigate(-1)}
          className="fixed top-4 right-4 z-50 w-10 h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all"
          title="Fechar"
        >
          <X className="w-5 h-5" />
        </button>
      )}

      <div className="w-full max-w-4xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="font-black text-white text-xl tracking-tight">ZapMenu</span>
          </div>

          {/* Badge — só aparece quando o teste/acesso REALMENTE encerrou */}
          {(reason === 'blocked' || actualStatus === 'blocked') && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5 bg-red-500/20 text-red-300">
              <Lock className="w-4 h-4" />
              Acesso suspenso por inadimplência
            </div>
          )}
          {actualStatus === 'expired' && (
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-5 bg-amber-500/20 text-amber-300">
              <Lock className="w-4 h-4" />
              Seu período de teste encerrou
            </div>
          )}

          <h1 className="text-3xl font-black text-white mb-2">
            {(reason === 'blocked' || actualStatus === 'blocked')
              ? 'Reative seu acesso'
              : actualStatus === 'trial'
              ? 'Você está no período de teste'
              : 'Escolha seu plano'}
          </h1>
          <p className="text-slate-400 text-sm max-w-md mx-auto">
            {(reason === 'blocked' || actualStatus === 'blocked')
              ? 'Regularize sua assinatura para reativar o cardápio.'
              : actualStatus === 'trial'
              ? 'Seu teste está ativo. Assine agora para garantir acesso contínuo após o período de teste.'
              : actualStatus === 'expired'
              ? 'Assine agora e continue usando o ZapMenu sem interrupções.'
              : 'Escolha o plano ideal para o seu restaurante.'}
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
                  {trialSettings[plan.slug]?.enabled && (
                    <p className="text-xs text-emerald-600 font-semibold mt-1">
                      {trialSettings[plan.slug].days} dias grátis para testar
                    </p>
                  )}
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

            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-left">
              <p className="text-xs text-amber-800 font-semibold mb-1">Após fazer o PIX:</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Envie o comprovante para nosso WhatsApp. Seu acesso será liberado em até 1 hora útil.
              </p>
            </div>

            {waNumber && (
              <a
                href={`https://wa.me/${waNumber.replace(/\D/g, '')}?text=${encodeURIComponent(
                  `Olá! Acabei de fazer o PIX de R$ ${selectedPlanForPix.price.toFixed(2).replace('.', ',')} para o Plano ${selectedPlanForPix.name} do ZapMenu. Segue o comprovante.`
                )}`}
                target="_blank"
                rel="noreferrer"
                className="w-full flex items-center justify-center gap-2 py-3 mb-2 bg-[#25D366] hover:bg-[#20bd5a] text-white font-bold rounded-xl transition-colors text-sm"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-white flex-shrink-0">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Enviar comprovante no WhatsApp
              </a>
            )}

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

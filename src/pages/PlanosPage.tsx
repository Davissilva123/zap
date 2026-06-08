import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../lib/db';
import { Check, X, Zap, Star, Crown, ArrowRight, Lock } from 'lucide-react';
import { useAuth } from '../lib/auth';

const PLANS = [
  {
    slug: 'basic', name: 'Básico', price: 39,
    icon: Zap, color: 'border-slate-300', iconBg: 'bg-slate-100', iconColor: 'text-slate-600',
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

interface Props {
  /** quando usado dentro do onboarding (step embutido) */
  onTrialStarted?: () => void;
  /** motivo de exibição: 'new' = novo usuário, 'expired' = trial expirou, 'blocked' = bloqueado */
  reason?: 'new' | 'expired' | 'blocked';
}

export default function PlanosPage({ onTrialStarted, reason = 'new' }: Props) {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const handleTrial = async (slug: string) => {
    setStarting(slug);
    setError('');
    try {
      await db.startTrial(slug);
      if (onTrialStarted) {
        onTrialStarted();
      } else {
        navigate('/dashboard');
      }
    } catch (e: any) {
      // Se já tem trial, apenas redireciona
      if (e?.message?.includes('já possui')) {
        navigate('/dashboard');
        return;
      }
      setError(e?.message ?? 'Erro ao iniciar trial. Tente novamente.');
    } finally {
      setStarting(null);
    }
  };

  const isEmbedded = !!onTrialStarted;

  const header = {
    new:     { title: 'Escolha seu plano', sub: 'Todos os planos incluem 7 dias grátis — sem cartão de crédito agora.' },
    expired: { title: 'Seu período gratuito encerrou', sub: 'Escolha um plano para continuar usando o ZapMenu.' },
    blocked: { title: 'Acesso suspenso', sub: 'Regularize seu plano para reativar o cardápio.' },
  }[reason];

  return (
    <div className={`${isEmbedded ? '' : 'min-h-screen bg-gradient-to-br from-slate-900 via-[#0f1c14] to-slate-900 flex items-center justify-center px-4 py-12'}`}>
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        {!isEmbedded && (
          <div className="text-center mb-10">
            <div className="flex items-center justify-center gap-2.5 mb-8">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
                <Zap className="w-5 h-5 text-white" />
              </div>
              <span className="font-black text-white text-xl tracking-tight">ZapMenu</span>
            </div>
            {reason !== 'new' && (
              <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold mb-4 ${
                reason === 'blocked' ? 'bg-red-500/20 text-red-300' : 'bg-amber-500/20 text-amber-300'
              }`}>
                <Lock className="w-4 h-4" />
                {reason === 'blocked' ? 'Acesso suspenso por inadimplência' : 'Período de teste encerrado'}
              </div>
            )}
            <h1 className="text-3xl font-black text-white mb-2">{header.title}</h1>
            <p className="text-slate-400 text-sm max-w-md mx-auto">{header.sub}</p>
          </div>
        )}

        {isEmbedded && (
          <div className="text-center mb-6">
            <h2 className="text-2xl font-black text-slate-900 mb-1">{header.title}</h2>
            <p className="text-slate-500 text-sm">{header.sub}</p>
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm text-center">
            {error}
          </div>
        )}

        {/* Plan cards */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLANS.map(plan => {
            const Icon = plan.icon;
            const isLoading = starting === plan.slug;
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

                <div className="mb-1">
                  <span className="text-3xl font-black text-slate-900">R$ {plan.price}</span>
                  <span className="text-slate-400 text-sm">/mês</span>
                </div>
                <p className="text-xs text-emerald-600 font-semibold mb-5">7 dias grátis para testar</p>

                <ul className="space-y-2 flex-1 mb-6">
                  {plan.features.map((f, i) => (
                    <li key={i} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-600' : 'text-slate-300'}`}>
                      {f.ok
                        ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                        : <X className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5" />
                      }
                      {f.label}
                    </li>
                  ))}
                </ul>

                {/* Botão principal: iniciar trial */}
                <button
                  onClick={() => handleTrial(plan.slug)}
                  disabled={!!starting}
                  className={`w-full flex items-center justify-center gap-2 py-3 text-white text-sm font-bold rounded-xl transition-all disabled:opacity-50 ${plan.btn}`}
                >
                  {isLoading ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Começar 7 dias grátis <ArrowRight className="w-4 h-4" /></>
                  )}
                </button>

                <p className="text-center text-[10px] text-slate-400 mt-2">
                  Sem cartão agora · Cancele quando quiser
                </p>
              </div>
            );
          })}
        </div>

        {/* Rodapé */}
        {!isEmbedded && (
          <div className="text-center mt-8">
            <p className="text-slate-500 text-xs mb-2">
              Após o período gratuito, cobramos automaticamente no cartão de crédito.
              Você pode cancelar antes do vencimento sem custo.
            </p>
            <button
              onClick={() => logout().then(() => navigate('/'))}
              className="text-slate-600 hover:text-slate-400 text-xs underline transition-colors"
            >
              Sair da conta
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

import { useNavigate } from 'react-router-dom';
import { Lock, ArrowRight, Check, Zap, Star, Crown } from 'lucide-react';
import { PLAN_DISPLAY, FEATURE_MIN_PLAN, type FeatureKey } from '../lib/planFeatures';
import { usePlan } from '../lib/planContext';

const PLAN_FEATURES: Record<string, { icon: typeof Zap; color: string; border: string; textColor: string; highlights: string[] }> = {
  pro: {
    icon: Star,
    color: 'bg-emerald-500',
    border: 'border-emerald-500',
    textColor: 'text-emerald-600',
    highlights: [
      'Itens ilimitados no cardápio',
      'PIX automático integrado',
      'WhatsApp automático de pedidos',
      'Relatórios e analytics completos',
      'Cupons e promoções',
      'Mesas e QR Code por mesa',
      'Até 5 operadores',
      'Suporte prioritário',
    ],
  },
  premium: {
    icon: Crown,
    color: 'bg-violet-500',
    border: 'border-violet-500',
    textColor: 'text-violet-600',
    highlights: [
      'Tudo do plano Pro',
      'Operadores ilimitados',
      'KDS para cozinha em tempo real',
      'Entregadores com rastreamento GPS',
      'Comandas digitais',
      'Avaliações dos clientes',
      'Suporte via WhatsApp',
    ],
  },
};

const FEATURE_LABELS: Record<FeatureKey, string> = {
  dashboard: 'Dashboard',
  menu: 'Cardápio',
  categories: 'Categorias',
  orders: 'Pedidos',
  qrcode: 'QR Code',
  settings: 'Configurações',
  operators: 'Operadores',
  reports: 'Relatórios e análises',
  coupons: 'Cupons e promoções',
  tables: 'Mesas',
  reviews: 'Avaliações dos clientes',
  comandas: 'Comandas digitais',
  drivers: 'Entregadores',
  crm: 'CRM de clientes',
  stock: 'Controle de estoque',
  cashregister: 'Caixa',
  combos: 'Combos',
  promotions: 'Promoções',
  campaigns: 'Campanhas de marketing',
  cmv: 'CMV',
  financas: 'Financeiro',
  fiscal: 'Módulo Fiscal',
  pdv: 'PDV',
  kds: 'KDS (Cozinha)',
  recipes: 'Fichas técnicas',
  suppliers: 'Fornecedores',
  purchase_orders: 'Pedidos de compra',
  contas: 'Contas a pagar/receber',
  dre: 'DRE',
};

export default function UpgradePage() {
  const navigate = useNavigate();
  const { planName } = usePlan();
  const params = new URLSearchParams(window.location.search);
  const feature = (params.get('feature') ?? 'reports') as FeatureKey;
  const required = FEATURE_MIN_PLAN[feature] as 'pro' | 'premium';
  const info = PLAN_FEATURES[required] ?? PLAN_FEATURES.pro;
  const Icon = info.icon;

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md text-center space-y-6">

        {/* Lock icon */}
        <div className={`w-20 h-20 rounded-3xl ${info.color} flex items-center justify-center mx-auto shadow-2xl`}>
          <Lock className="w-9 h-9 text-white" />
        </div>

        {/* Heading */}
        <div>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Recurso bloqueado</p>
          <h1 className="text-2xl font-black text-slate-900 mb-2">
            {FEATURE_LABELS[feature] ?? 'Esta funcionalidade'}
          </h1>
          <p className="text-slate-500 text-sm leading-relaxed">
            Seu plano atual <span className="font-bold text-slate-700">({planName || 'Básico'})</span> não inclui este recurso.
            Faça upgrade para o plano <span className={`font-bold ${info.textColor}`}>{PLAN_DISPLAY[required]}</span> para desbloquear.
          </p>
        </div>

        {/* Features included */}
        <div className={`bg-white rounded-2xl border-2 ${info.border} p-5 text-left`}>
          <div className="flex items-center gap-2 mb-4">
            <div className={`w-7 h-7 rounded-lg ${info.color} flex items-center justify-center`}>
              <Icon className="w-3.5 h-3.5 text-white" />
            </div>
            <p className={`font-black text-base ${info.textColor}`}>Plano {PLAN_DISPLAY[required]}</p>
          </div>
          <ul className="space-y-2">
            {info.highlights.map((h, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <Check className={`w-4 h-4 mt-0.5 flex-shrink-0 ${info.textColor}`} />
                {h}
              </li>
            ))}
          </ul>
        </div>

        {/* CTA buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => navigate('/planos')}
            className={`w-full flex items-center justify-center gap-2 py-3.5 ${info.color} hover:opacity-90 text-white font-bold rounded-2xl transition-all text-sm shadow-lg`}
          >
            <Icon className="w-4 h-4" />
            Fazer upgrade para o Plano {PLAN_DISPLAY[required]}
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={() => navigate(-1)}
            className="w-full py-3 text-slate-500 hover:text-slate-700 text-sm font-medium transition-colors"
          >
            Voltar
          </button>
        </div>

      </div>
    </div>
  );
}

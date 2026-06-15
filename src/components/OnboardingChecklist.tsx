import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, X, Zap } from 'lucide-react';
import type { Category, MenuItem, RestaurantSettings } from '../lib/types';

interface Props {
  settings: RestaurantSettings | null;
  categories: Category[];
  items: MenuItem[];
}

export default function OnboardingChecklist({ settings, categories, items }: Props) {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem('zm_onboarding_done') === '1');

  const steps = [
    {
      id: 'profile',
      label: 'Configure nome e logo do restaurante',
      hint: 'Dê identidade visual ao seu restaurante',
      done: !!(settings?.name && settings?.logoUrl),
      link: '/settings',
    },
    {
      id: 'hours',
      label: 'Defina o horário de funcionamento',
      hint: 'O cardápio mostra se está aberto ou fechado',
      done: Object.keys(settings?.openingHours ?? {}).length > 0,
      link: '/settings',
    },
    {
      id: 'payment',
      label: 'Ative um método de pagamento',
      hint: 'PIX, cartão ou dinheiro',
      done: (settings?.paymentMethods?.length ?? 0) > 0,
      link: '/settings',
    },
    {
      id: 'category',
      label: 'Crie uma categoria no cardápio',
      hint: 'Exemplo: Lanches, Bebidas, Sobremesas',
      done: categories.length > 0,
      link: '/categories',
    },
    {
      id: 'item',
      label: 'Adicione seu primeiro produto',
      hint: 'Foto + descrição + preço = mais vendas',
      done: items.length > 0,
      link: '/menu',
    },
    {
      id: 'qrcode',
      label: 'Acesse e teste seu QR Code',
      hint: 'Compartilhe com clientes para receber pedidos',
      done: localStorage.getItem('zm_qr_tested') === '1',
      link: '/qrcode',
    },
  ];

  const completed = steps.filter(s => s.done).length;
  const allDone = completed === steps.length;
  const pct = Math.round((completed / steps.length) * 100);

  useEffect(() => {
    if (allDone) {
      localStorage.setItem('zm_onboarding_done', '1');
      setDismissed(true);
    }
  }, [allDone]);

  if (dismissed) return null;

  return (
    <div className="bg-white rounded-2xl border border-emerald-100 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 pt-5 pb-4 bg-gradient-to-r from-emerald-50 to-white flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow shadow-emerald-200 flex-shrink-0">
            <Zap className="w-4.5 h-4.5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 text-[15px]">Configure seu restaurante</p>
            <p className="text-xs text-slate-500 mt-0.5">{completed} de {steps.length} etapas concluídas</p>
          </div>
        </div>
        <button
          onClick={() => { localStorage.setItem('zm_onboarding_done', '1'); setDismissed(true); }}
          className="p-1 text-slate-400 hover:text-slate-600 transition-colors flex-shrink-0"
          title="Fechar"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 bg-slate-100">
        <div
          className="h-full bg-emerald-500 transition-all duration-500 rounded-r-full"
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Steps */}
      <div className="divide-y divide-slate-50">
        {steps.map(step => (
          <button
            key={step.id}
            onClick={() => navigate(step.link)}
            disabled={step.done}
            className={`w-full flex items-center gap-3 px-5 py-3.5 text-left transition-colors ${
              step.done
                ? 'opacity-60 cursor-default'
                : 'hover:bg-slate-50 group'
            }`}
          >
            {step.done
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
              : <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
            }
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${step.done ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                {step.label}
              </p>
              {!step.done && (
                <p className="text-xs text-slate-400 mt-0.5">{step.hint}</p>
              )}
            </div>
            {!step.done && (
              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-500 flex-shrink-0 transition-colors" />
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

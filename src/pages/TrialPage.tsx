import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { Zap, Check, ArrowRight, Gift } from 'lucide-react';

interface Props {
  restaurantName: string;
  onActivated: () => void;
}

const FEATURES = [
  'Cardápio digital com QR Code',
  'Receba pedidos online em tempo real',
  'Portal do cliente com histórico',
  'Painel de pedidos e relatórios',
  'Configuração completa do restaurante',
];

export default function TrialPage({ restaurantName, onActivated }: Props) {
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    db.getTrialDays().then(setDays).catch(() => {});
  }, []);

  const handleActivate = async () => {
    setLoading(true);
    setError('');
    try {
      await db.startTrial('pro'); // trial usa o plano Pro como padrão
      onActivated();
    } catch (e: any) {
      if (e?.message?.includes('já possui')) { onActivated(); return; }
      setError(e?.message ?? 'Erro ao ativar o teste. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in text-center">
      {/* Ícone */}
      <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
        <Gift className="w-8 h-8 text-emerald-600" />
      </div>

      <h2 className="text-2xl font-black text-slate-900 mb-1">
        {days} dias grátis para testar!
      </h2>
      <p className="text-slate-500 text-sm mb-6 leading-relaxed">
        Você terá acesso completo ao ZapMenu por <strong>{days} dias</strong>,{' '}
        sem precisar de cartão de crédito agora.
      </p>

      {/* O que inclui */}
      <div className="bg-emerald-50 rounded-2xl p-4 mb-6 text-left">
        <p className="text-xs font-bold text-emerald-700 uppercase tracking-widest mb-3">
          Incluído no seu teste
        </p>
        <ul className="space-y-2">
          {FEATURES.map((f, i) => (
            <li key={i} className="flex items-center gap-2.5 text-sm text-slate-700">
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Check className="w-2.5 h-2.5 text-white" />
              </div>
              {f}
            </li>
          ))}
        </ul>
      </div>

      {error && (
        <p className="text-sm text-red-500 mb-4">{error}</p>
      )}

      <button
        onClick={handleActivate}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all text-sm"
      >
        {loading ? (
          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <>
            <Zap className="w-4 h-4" />
            Ativar meu teste grátis — {restaurantName}
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>

      <p className="text-[11px] text-slate-400 mt-3">
        Sem cartão agora · Após {days} dias, escolha um plano para continuar
      </p>
    </div>
  );
}

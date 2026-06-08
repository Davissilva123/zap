import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import { Zap, ArrowRight, Check, ChefHat } from 'lucide-react';
import PlanosPage from './PlanosPage';

const RESTAURANT_TYPES = [
  { emoji: '🍕', label: 'Pizzaria' },
  { emoji: '🍔', label: 'Hamburgueria' },
  { emoji: '🍣', label: 'Japonês' },
  { emoji: '🌮', label: 'Mexicano' },
  { emoji: '🍝', label: 'Italiano' },
  { emoji: '🍗', label: 'Frango' },
  { emoji: '☕', label: 'Cafeteria' },
  { emoji: '🍺', label: 'Bar / Pub' },
  { emoji: '🌭', label: 'Lanches' },
  { emoji: '🥗', label: 'Saudável' },
  { emoji: '🍦', label: 'Sobremesas' },
  { emoji: '🍽️', label: 'Restaurante' },
];

export default function OnboardingPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [restaurantName, setRestaurantName] = useState('');
  const [selectedType, setSelectedType] = useState<{ emoji: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const slug = restaurantName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  const goStep2 = () => {
    if (!restaurantName.trim() || restaurantName.trim().length < 2) {
      setError('Digite o nome do seu restaurante (mínimo 2 caracteres)');
      return;
    }
    setError('');
    setStep(2);
  };

  const finish = async () => {
    if (!user) return;
    if (!selectedType) {
      setError('Selecione o tipo do seu restaurante');
      return;
    }
    setSaving(true);
    try {
      await db.updateSettings(user.id, {
        name: restaurantName.trim(),
        slug,
        description: `${selectedType.emoji} ${selectedType.label}`,
      });
      // Vai para escolha de plano (step 3) sem marcar como onboarded ainda
      setStep(3);
    } catch (e) {
      setError('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0f1c14] to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-white text-xl tracking-tight">ZapMenu</span>
        </div>

        {/* Step indicators — só mostra para steps 1 e 2 */}
        {step <= 2 && (
          <div className="flex items-center gap-2 mb-8 justify-center">
            {[1, 2, 3].map(s => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s
                    ? 'bg-emerald-500 text-white'
                    : step === s
                    ? 'bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400'
                    : 'bg-white/10 text-slate-500'
                }`}>
                  {step > s ? <Check className="w-3.5 h-3.5" /> : s}
                </div>
                {s < 3 && <div className={`h-px w-10 sm:w-16 transition-all ${step > s ? 'bg-emerald-500' : 'bg-white/10'}`} />}
              </div>
            ))}
          </div>
        )}

        {/* Step 3: Escolher plano — fora do card branco, ocupa tela toda */}
        {step === 3 && (
          <PlanosPage
            reason="new"
            onTrialStarted={() => {
              localStorage.setItem(`zm_onboarded_${user?.id}`, '1');
              navigate('/dashboard');
            }}
          />
        )}

        {step !== 3 && <div className="bg-white rounded-3xl shadow-2xl shadow-black/30 p-7 sm:p-8">
          {/* Step 1: Restaurant name */}
          {step === 1 && (
            <div className="animate-fade-in">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mb-5">
                <ChefHat className="w-6 h-6 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-black text-slate-900 mb-2">Bem-vindo ao ZapMenu!</h2>
              <p className="text-slate-500 text-sm mb-7 leading-relaxed">
                Vamos configurar seu cardápio digital em 2 passos rápidos.
              </p>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">
                    Nome do restaurante *
                  </label>
                  <input
                    autoFocus
                    value={restaurantName}
                    onChange={e => { setRestaurantName(e.target.value); setError(''); }}
                    onKeyDown={e => e.key === 'Enter' && goStep2()}
                    placeholder="Ex: Pizzaria do João"
                    className="input w-full text-base"
                  />
                </div>
                {slug && (
                  <p className="text-xs text-slate-400">
                    Seu cardápio ficará em:{' '}
                    <span className="font-mono text-emerald-600 font-semibold">
                      zapmenu.app/m/{slug}
                    </span>
                  </p>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button
                  onClick={goStep2}
                  disabled={!restaurantName.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all"
                >
                  Próximo passo <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Restaurant type */}
          {step === 2 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-black text-slate-900 mb-2">Qual é o tipo?</h2>
              <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                Escolha a categoria que melhor descreve <strong>{restaurantName}</strong>:
              </p>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {RESTAURANT_TYPES.map(t => (
                  <button
                    key={t.label}
                    onClick={() => { setSelectedType(t); setError(''); }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 text-center transition-all ${
                      selectedType?.label === t.label
                        ? 'border-emerald-500 bg-emerald-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <span className="text-2xl">{t.emoji}</span>
                    <span className="text-[11px] font-semibold text-slate-600 leading-tight">{t.label}</span>
                  </button>
                ))}
              </div>
              {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
              <div className="flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 py-3 border border-slate-200 hover:bg-slate-50 text-slate-600 font-semibold rounded-xl transition-colors text-sm">
                  Voltar
                </button>
                <button
                  onClick={finish}
                  disabled={!selectedType || saving}
                  className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all text-sm"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>Concluir <Check className="w-4 h-4" /></>
                  )}
                </button>
              </div>
            </div>
          )}

        </div>}
      </div>
    </div>
  );
}

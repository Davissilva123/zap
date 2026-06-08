import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { Check, X, Zap, Star, Crown, Plus, Trash2, Tag, CreditCard, RefreshCw, Key } from 'lucide-react';

const PLANS = [
  {
    slug: 'basic', name: 'Básico', price: 39, period: 'mês', trial: '7 dias grátis',
    icon: Zap, color: 'border-slate-300', iconColor: 'bg-slate-100 text-slate-600', badge: null,
    description: 'Para quem está começando a digitalizar o atendimento',
    features: [
      { label: 'Cardápio online com QR Code', ok: true },
      { label: 'Até 50 itens no cardápio', ok: true },
      { label: 'Portal do cliente com histórico', ok: true },
      { label: '2 operadores', ok: true },
      { label: 'Suporte por email', ok: true },
      { label: 'PIX automático (Mercado Pago)', ok: false },
      { label: 'WhatsApp automático', ok: false },
      { label: 'Relatórios e análises', ok: false },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
    ],
  },
  {
    slug: 'pro', name: 'Pro', price: 89, period: 'mês', trial: '7 dias grátis',
    icon: Star, color: 'border-blue-400 ring-2 ring-blue-400/20', iconColor: 'bg-blue-100 text-blue-600',
    badge: 'Mais popular', badgeColor: 'bg-blue-600',
    description: 'Para restaurantes que querem crescer com tecnologia',
    features: [
      { label: 'Tudo do Básico', ok: true },
      { label: 'Itens ilimitados', ok: true },
      { label: 'PIX automático (Mercado Pago)', ok: true },
      { label: 'WhatsApp automático', ok: true },
      { label: 'Relatórios e análises', ok: true },
      { label: 'Cupons e promoções', ok: true },
      { label: 'Até 5 operadores', ok: true },
      { label: 'Suporte prioritário', ok: true },
      { label: 'KDS para cozinha', ok: false },
      { label: 'Entregadores com GPS', ok: false },
    ],
  },
  {
    slug: 'premium', name: 'Premium', price: 149, period: 'mês', trial: '7 dias grátis',
    icon: Crown, color: 'border-violet-500 ring-2 ring-violet-500/20', iconColor: 'bg-violet-100 text-violet-600',
    badge: 'Completo', badgeColor: 'bg-violet-600',
    description: 'Solução completa para restaurantes e redes',
    features: [
      { label: 'Tudo do Pro', ok: true },
      { label: 'Operadores ilimitados', ok: true },
      { label: 'KDS para cozinha', ok: true },
      { label: 'Sistema de entregadores + GPS', ok: true },
      { label: 'Comandas digitais', ok: true },
      { label: 'Avaliações dos clientes', ok: true },
      { label: 'Suporte via WhatsApp', ok: true },
      { label: 'Relatórios avançados + exportação', ok: true },
      { label: 'API de acesso (em breve)', ok: true },
      { label: 'Onboarding dedicado', ok: true },
    ],
  },
];

type Coupon = Awaited<ReturnType<typeof db.getSubscriptionCoupons>>[number];

export default function AdminPlansPage() {
  const [editing, setEditing] = useState<string | null>(null);
  const [prices, setPrices] = useState<Record<string, number>>({ basic: 39, pro: 89, premium: 149 });
  const [saved, setSaved] = useState<string | null>(null);
  const [savingPrice, setSavingPrice] = useState<string | null>(null);
  const [priceError, setPriceError] = useState<string | null>(null);
  const [tab, setTab] = useState<'plans' | 'coupons' | 'stripe'>('plans');

  // Trial days
  const [trialDays, setTrialDays] = useState(7);
  const [trialDaysInput, setTrialDaysInput] = useState('7');
  const [savingTrial, setSavingTrial] = useState(false);
  const [trialSaved, setTrialSaved] = useState(false);
  const [trialError, setTrialError] = useState('');

  useEffect(() => {
    db.getPlatformPlanPrices().then(p => setPrices(p)).catch(() => {});
    db.getTrialDays().then(d => { setTrialDays(d); setTrialDaysInput(String(d)); }).catch(() => {});
  }, []);

  const saveTrialDays = async () => {
    const days = parseInt(trialDaysInput, 10);
    if (isNaN(days) || days < 1 || days > 90) {
      setTrialError('Digite um número entre 1 e 90 dias.');
      return;
    }
    setSavingTrial(true);
    setTrialError('');
    try {
      await db.setTrialDays(days);
      setTrialDays(days);
      setTrialSaved(true);
      setTimeout(() => setTrialSaved(false), 2500);
    } catch (e: any) {
      setTrialError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSavingTrial(false);
    }
  };

  // PIX settings state
  const [pixKey, setPixKey] = useState('');
  const [pixKeyType, setPixKeyType] = useState('cpf');
  const [pixBeneficiary, setPixBeneficiary] = useState('');
  const [savingPix, setSavingPix] = useState(false);
  const [pixSaved, setPixSaved] = useState(false);
  const [pixError, setPixError] = useState('');

  useEffect(() => {
    db.getPixSettings().then(s => {
      if (s) {
        setPixKey(s.pixKey ?? '');
        setPixKeyType(s.pixKeyType ?? 'cpf');
        setPixBeneficiary(s.pixBeneficiary ?? '');
      }
    }).catch(() => {});
  }, []);

  const savePixSettings = async () => {
    if (!pixKey.trim() || !pixBeneficiary.trim()) {
      setPixError('Preencha a chave PIX e o beneficiário.');
      return;
    }
    setSavingPix(true);
    setPixError('');
    try {
      await db.setPixSettings(pixKey.trim(), pixKeyType, pixBeneficiary.trim());
      setPixSaved(true);
      setTimeout(() => setPixSaved(false), 2500);
    } catch (e: any) {
      setPixError(e?.message ?? 'Erro ao salvar');
    } finally {
      setSavingPix(false);
    }
  };

  // Coupons state
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loadingCoupons, setLoadingCoupons] = useState(false);
  const [showNewCoupon, setShowNewCoupon] = useState(false);
  const [newCoupon, setNewCoupon] = useState({ code: '', discountType: 'percent', discountValue: '', maxUses: '', expiresAt: '' });
  const [savingCoupon, setSavingCoupon] = useState(false);

  const loadCoupons = async () => {
    setLoadingCoupons(true);
    try { setCoupons(await db.getSubscriptionCoupons().catch(() => [])); }
    finally { setLoadingCoupons(false); }
  };

  useEffect(() => { if (tab === 'coupons') loadCoupons(); }, [tab]);

  const savePrice = async (slug: string, price: number) => {
    if (!price || price <= 0) { setEditing(null); return; }
    setSavingPrice(slug);
    setPriceError(null);
    try {
      await db.updatePlatformPlanPrice(slug, price);
      setPrices(p => ({ ...p, [slug]: price }));
      setEditing(null);
      setSaved(slug);
      setTimeout(() => setSaved(null), 2500);
    } catch (e: any) {
      setPriceError(`Erro ao salvar ${slug}: ${e?.message ?? 'verifique o banco'}`);
    } finally {
      setSavingPrice(null);
    }
  };

  const handleCreateCoupon = async () => {
    if (!newCoupon.code || !newCoupon.discountValue) return;
    setSavingCoupon(true);
    try {
      await db.createSubscriptionCoupon(
        newCoupon.code,
        newCoupon.discountType,
        Number(newCoupon.discountValue),
        newCoupon.maxUses ? Number(newCoupon.maxUses) : null,
        newCoupon.expiresAt || null,
      );
      setNewCoupon({ code: '', discountType: 'percent', discountValue: '', maxUses: '', expiresAt: '' });
      setShowNewCoupon(false);
      await loadCoupons();
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao criar cupom');
    } finally {
      setSavingCoupon(false);
    }
  };

  const handleToggleCoupon = async (id: string) => {
    await db.toggleSubscriptionCoupon(id);
    setCoupons(prev => prev.map(c => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Deletar este cupom?')) return;
    await db.deleteSubscriptionCoupon(id);
    setCoupons(prev => prev.filter(c => c.id !== id));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Planos & Cobrança</h1>
        <p className="text-slate-500 text-sm mt-0.5">Estrutura de planos, cupons de assinatura e integração Stripe</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['plans', 'Planos'], ['coupons', 'Cupons'], ['stripe', 'Stripe']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ---- PLANS ---- */}
      {tab === 'plans' && (
        <div className="space-y-5">
          {priceError && (
            <div className="card p-3 bg-red-50 border border-red-200 text-red-700 text-sm flex items-center gap-2">
              <X className="w-4 h-4 flex-shrink-0" /> {priceError}
              <button onClick={() => setPriceError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
            </div>
          )}

          {/* Configuração de trial */}
          <div className="card p-4 flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="text-sm font-bold text-slate-900">Período de teste gratuito</p>
              <p className="text-xs text-slate-400 mt-0.5">Quantos dias um novo cliente pode testar antes de precisar assinar.</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={1} max={90}
                  value={trialDaysInput}
                  onChange={e => { setTrialDaysInput(e.target.value); setTrialError(''); }}
                  onKeyDown={e => e.key === 'Enter' && saveTrialDays()}
                  className="input w-20 text-center font-bold text-lg"
                />
                <span className="text-sm text-slate-500 font-medium">dias</span>
              </div>
              <button
                onClick={saveTrialDays}
                disabled={savingTrial || trialDaysInput === String(trialDays)}
                className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {savingTrial
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : trialSaved ? <><Check className="w-3.5 h-3.5" /> Salvo</> : 'Salvar'}
              </button>
            </div>
            {trialError && <p className="w-full text-xs text-red-500">{trialError}</p>}
          </div>

          <div className="card p-4 bg-emerald-50 border border-emerald-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <Zap className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-emerald-800">Trial de 7 dias grátis em todos os planos</p>
              <p className="text-xs text-emerald-700 mt-0.5">Após o trial, o cliente precisa confirmar o pagamento para continuar.</p>
            </div>
          </div>

          {/* Configuração de PIX */}
          <div className="card p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Key className="w-4 h-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Chave PIX para pagamento manual</p>
                <p className="text-xs text-slate-400 mt-0.5">Exibida para clientes que escolherem pagar via PIX (fora do Stripe).</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="label">Tipo de chave</label>
                <select value={pixKeyType} onChange={e => setPixKeyType(e.target.value)} className="input text-sm">
                  <option value="cpf">CPF</option>
                  <option value="cnpj">CNPJ</option>
                  <option value="email">E-mail</option>
                  <option value="phone">Telefone</option>
                  <option value="random">Chave aleatória</option>
                </select>
              </div>
              <div>
                <label className="label">Chave PIX</label>
                <input
                  value={pixKey}
                  onChange={e => { setPixKey(e.target.value); setPixError(''); }}
                  className="input text-sm font-mono"
                  placeholder="000.000.000-00"
                />
              </div>
              <div>
                <label className="label">Nome do beneficiário</label>
                <input
                  value={pixBeneficiary}
                  onChange={e => { setPixBeneficiary(e.target.value); setPixError(''); }}
                  className="input text-sm"
                  placeholder="ZapMenu"
                />
              </div>
            </div>
            {pixError && <p className="text-xs text-red-500">{pixError}</p>}
            <div className="flex justify-end">
              <button
                onClick={savePixSettings}
                disabled={savingPix}
                className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-bold rounded-xl transition-colors"
              >
                {savingPix
                  ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : pixSaved ? <><Check className="w-3.5 h-3.5" /> Salvo</> : 'Salvar chave PIX'}
              </button>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-5">
            {PLANS.map(plan => {
              const Icon = plan.icon;
              const isEditing = editing === plan.slug;
              const isSaved = saved === plan.slug;
              return (
                <div key={plan.slug} className={`relative bg-white rounded-3xl border-2 p-6 ${plan.color}`}>
                  {plan.badge && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                      <span className={`text-white text-xs font-bold px-4 py-1.5 rounded-full shadow-lg ${(plan as any).badgeColor}`}>{plan.badge}</span>
                    </div>
                  )}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-4 ${plan.iconColor}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 mb-1">{plan.name}</h3>
                  <p className="text-xs text-slate-400 mb-4 leading-relaxed">{plan.description}</p>
                  <div className="mb-1">
                    {savingPrice === plan.slug ? (
                      <div className="flex items-center gap-2">
                        <div className="w-5 h-5 border-2 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
                        <span className="text-sm text-slate-400">Salvando...</span>
                      </div>
                    ) : isEditing ? (
                      <div className="flex items-center gap-2">
                        <span className="text-slate-500 text-sm font-semibold">R$</span>
                        <input
                          type="number" defaultValue={prices[plan.slug]}
                          onBlur={e => savePrice(plan.slug, Number(e.target.value))}
                          onKeyDown={e => e.key === 'Enter' && savePrice(plan.slug, Number((e.target as HTMLInputElement).value))}
                          autoFocus className="input w-24 text-2xl font-black py-1"
                        />
                        <span className="text-slate-400 text-sm">/mês</span>
                        <button onClick={() => setEditing(null)}><X className="w-4 h-4 text-slate-400" /></button>
                      </div>
                    ) : (
                      <button onClick={() => setEditing(plan.slug)} className="flex items-baseline gap-1 group hover:opacity-80 transition-opacity" title="Clique para editar">
                        <span className="text-3xl font-black text-slate-900">R$ {prices[plan.slug]}</span>
                        <span className="text-slate-400 text-sm">/{plan.period}</span>
                        <span className="text-xs text-slate-300 group-hover:text-slate-400 ml-1">(editar)</span>
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-emerald-600 font-semibold mb-5">{plan.trial}</p>
                  <ul className="space-y-2.5">
                    {plan.features.map((f, i) => (
                      <li key={i} className={`flex items-start gap-2 text-xs ${f.ok ? 'text-slate-600' : 'text-slate-300'}`}>
                        {f.ok ? <Check className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" /> : <X className="w-3.5 h-3.5 text-slate-200 flex-shrink-0 mt-0.5" />}
                        {f.label}
                      </li>
                    ))}
                  </ul>
                  {isSaved && <div className="mt-4 flex items-center gap-1.5 text-xs text-emerald-600 font-semibold"><Check className="w-3.5 h-3.5" /> Salvo</div>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- COUPONS ---- */}
      {tab === 'coupons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-slate-900">Cupons de assinatura</h2>
              <p className="text-xs text-slate-400 mt-0.5">Descontos no plano mensal (% ou valor fixo)</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadCoupons} className="btn-secondary" disabled={loadingCoupons}>
                <RefreshCw className={`w-4 h-4 ${loadingCoupons ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowNewCoupon(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Novo cupom
              </button>
            </div>
          </div>

          {/* New coupon form */}
          {showNewCoupon && (
            <div className="card p-5 border-2 border-violet-200 bg-violet-50/30 space-y-4">
              <p className="text-sm font-bold text-slate-900">Novo cupom de assinatura</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <label className="label">Código</label>
                  <input value={newCoupon.code} onChange={e => setNewCoupon(p => ({ ...p, code: e.target.value.toUpperCase() }))}
                    className="input font-mono" placeholder="PRIMEIRO30" />
                </div>
                <div>
                  <label className="label">Tipo de desconto</label>
                  <select value={newCoupon.discountType} onChange={e => setNewCoupon(p => ({ ...p, discountType: e.target.value }))} className="input">
                    <option value="percent">Porcentagem (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </div>
                <div>
                  <label className="label">{newCoupon.discountType === 'percent' ? 'Desconto (%)' : 'Valor (R$)'}</label>
                  <input type="number" value={newCoupon.discountValue} onChange={e => setNewCoupon(p => ({ ...p, discountValue: e.target.value }))}
                    className="input" placeholder={newCoupon.discountType === 'percent' ? '30' : '20'} />
                </div>
                <div>
                  <label className="label">Máximo de usos (deixe vazio para ilimitado)</label>
                  <input type="number" value={newCoupon.maxUses} onChange={e => setNewCoupon(p => ({ ...p, maxUses: e.target.value }))}
                    className="input" placeholder="100" />
                </div>
                <div>
                  <label className="label">Expira em (opcional)</label>
                  <input type="date" value={newCoupon.expiresAt} onChange={e => setNewCoupon(p => ({ ...p, expiresAt: e.target.value }))} className="input" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowNewCoupon(false)} className="btn-secondary">Cancelar</button>
                <button onClick={handleCreateCoupon} disabled={savingCoupon || !newCoupon.code || !newCoupon.discountValue} className="btn-primary">
                  {savingCoupon ? 'Criando...' : 'Criar cupom'}
                </button>
              </div>
            </div>
          )}

          {/* Coupons list */}
          <div className="card overflow-hidden">
            {loadingCoupons ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="p-8 text-center">
                <Tag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum cupom cadastrado</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {coupons.map(c => (
                  <div key={c.id} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-bold text-slate-900">{c.code}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${c.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                          {c.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {c.discountType === 'percent' ? `${c.discountValue}% de desconto` : `R$ ${c.discountValue} de desconto`}
                        {' · '}{c.usesCount}{c.maxUses ? `/${c.maxUses}` : ''} usos
                        {c.expiresAt && ` · expira ${new Date(c.expiresAt).toLocaleDateString('pt-BR')}`}
                      </p>
                    </div>
                    <button onClick={() => handleToggleCoupon(c.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors flex-shrink-0 ${c.active ? 'bg-emerald-400' : 'bg-slate-200'}`}>
                      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${c.active ? 'left-5' : 'left-0.5'}`} />
                    </button>
                    <button onClick={() => handleDeleteCoupon(c.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- STRIPE ---- */}
      {tab === 'stripe' && (
        <div className="space-y-4">

          {/* Status rápido */}
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">Status de configuração</p>
            <div className="grid sm:grid-cols-3 gap-3">
              {[
                {
                  label: 'Chave pública (Vercel)',
                  ok: !!import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY,
                  detail: import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
                    ? import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY.slice(0, 14) + '...'
                    : 'Não configurada',
                },
                { label: 'Edge Functions', ok: false, detail: 'Deploy necessário (passo 5)' },
                { label: 'Webhook Stripe', ok: false, detail: 'Configurar no dashboard (passo 6)' },
              ].map((s, i) => (
                <div key={i} className={`p-3 rounded-xl border ${s.ok ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${s.ok ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <span className={`text-xs font-semibold ${s.ok ? 'text-emerald-700' : 'text-slate-600'}`}>{s.label}</span>
                  </div>
                  <p className="text-[11px] text-slate-400 ml-4">{s.detail}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Passo a passo */}
          <div className="card p-5 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <CreditCard className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Como configurar o Stripe (passo a passo)</h2>
                <p className="text-xs text-slate-400">Faça uma vez e a cobrança recorrente funciona automaticamente</p>
              </div>
            </div>

            <ol className="space-y-4">
              {/* Passo 1 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">1</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Crie uma conta no Stripe</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">Acesse <strong>stripe.com</strong>, crie a conta e ative com CNPJ/CPF do negócio.</p>
                  <a href="https://dashboard.stripe.com/register" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors">
                    Abrir Stripe →
                  </a>
                </div>
              </li>

              {/* Passo 2 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">2</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Crie 3 produtos recorrentes no Stripe</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">Em <strong>Products → Add product</strong>, crie cada plano como assinatura mensal:</p>
                  <div className="space-y-1.5">
                    {[
                      { name: 'ZapMenu Básico', price: 'R$ 39,00/mês', var: 'STRIPE_PRICE_BASIC' },
                      { name: 'ZapMenu Pro',    price: 'R$ 89,00/mês', var: 'STRIPE_PRICE_PRO' },
                      { name: 'ZapMenu Premium',price: 'R$ 149,00/mês', var: 'STRIPE_PRICE_PREMIUM' },
                    ].map(p => (
                      <div key={p.var} className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg text-xs">
                        <span className="font-semibold text-slate-700 w-36">{p.name}</span>
                        <span className="text-slate-400">{p.price}</span>
                        <span className="ml-auto font-mono text-violet-600 text-[10px]">→ copie o Price ID (price_...)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </li>

              {/* Passo 3 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">3</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Execute o SQL no Supabase</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">
                    Abra o <strong>Supabase → SQL Editor</strong> e rode o arquivo <code className="bg-slate-100 px-1 rounded font-mono">supabase-stripe-v1.sql</code> (na raiz do projeto).
                  </p>
                </div>
              </li>

              {/* Passo 4 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">4</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Configure as variáveis no Supabase</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">
                    Vá em <strong>Supabase → Edge Functions → Manage secrets</strong> e adicione:
                  </p>
                  <div className="bg-slate-900 rounded-xl p-3 text-xs font-mono text-emerald-400 space-y-1 overflow-x-auto">
                    <div>STRIPE_SECRET_KEY=<span className="text-slate-400">sk_live_...</span></div>
                    <div>STRIPE_WEBHOOK_SECRET=<span className="text-slate-400">whsec_...</span></div>
                    <div>STRIPE_PRICE_BASIC=<span className="text-slate-400">price_...</span></div>
                    <div>STRIPE_PRICE_PRO=<span className="text-slate-400">price_...</span></div>
                    <div>STRIPE_PRICE_PREMIUM=<span className="text-slate-400">price_...</span></div>
                  </div>
                </div>
              </li>

              {/* Passo 5 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">5</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Faça deploy das Edge Functions</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">No terminal, na raiz do projeto:</p>
                  <div className="bg-slate-900 rounded-xl p-3 text-xs font-mono text-emerald-400 space-y-1">
                    <div><span className="text-slate-500"># Login (só na primeira vez)</span></div>
                    <div>npx supabase login</div>
                    <div className="mt-1"><span className="text-slate-500"># Deploy das funções Stripe</span></div>
                    <div>npx supabase functions deploy stripe-create-checkout</div>
                    <div>npx supabase functions deploy stripe-webhook</div>
                  </div>
                </div>
              </li>

              {/* Passo 6 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">6</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Configure o Webhook no Stripe</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">
                    Vá em <strong>Stripe → Developers → Webhooks → Add endpoint</strong>:
                  </p>
                  <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-2">
                    <div>
                      <span className="text-slate-400 block mb-0.5">URL do endpoint:</span>
                      <code className="font-mono text-violet-700 break-all">https://[SEU-PROJETO].supabase.co/functions/v1/stripe-webhook</code>
                    </div>
                    <div>
                      <span className="text-slate-400 block mb-0.5">Eventos a escutar:</span>
                      <div className="font-mono text-slate-700 space-y-0.5">
                        <div>customer.subscription.created</div>
                        <div>customer.subscription.updated</div>
                        <div>customer.subscription.deleted</div>
                        <div>invoice.payment_succeeded</div>
                        <div>invoice.payment_failed</div>
                      </div>
                    </div>
                    <p className="text-slate-400">Depois copie o <strong>Signing secret (whsec_...)</strong> e adicione como <code className="bg-slate-100 px-1 rounded">STRIPE_WEBHOOK_SECRET</code> no Supabase (passo 4).</p>
                  </div>
                </div>
              </li>

              {/* Passo 7 */}
              <li className="flex gap-3">
                <span className="w-7 h-7 rounded-full bg-indigo-600 text-white text-xs font-black flex items-center justify-center flex-shrink-0 mt-0.5">7</span>
                <div className="flex-1">
                  <p className="font-bold text-slate-800 text-sm">Adicione a chave pública no Vercel</p>
                  <p className="text-xs text-slate-500 mt-0.5 mb-2">
                    Vá em <strong>Vercel → Settings → Environment Variables</strong> e adicione:
                  </p>
                  <div className="bg-slate-900 rounded-xl p-3 text-xs font-mono text-emerald-400">
                    VITE_STRIPE_PUBLISHABLE_KEY=<span className="text-slate-400">pk_live_...</span>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Após salvar, faça um novo deploy no Vercel para a variável entrar em vigor.</p>
                </div>
              </li>
            </ol>
          </div>

          {/* Como funciona o fluxo */}
          <div className="card p-4 bg-indigo-50 border border-indigo-100 space-y-2">
            <p className="text-sm font-bold text-indigo-900">Como funciona o fluxo após configurar</p>
            <div className="grid sm:grid-cols-2 gap-2 text-xs text-indigo-800">
              {[
                '1. Cliente clica em "Assinar" → abre Stripe Checkout seguro',
                '2. Cliente preenche o cartão e confirma',
                '3. Stripe cria a assinatura e dispara webhook',
                '4. Webhook atualiza status do plano no Supabase automaticamente',
                '5. Se o pagamento falhar → status vira past_due → admin é notificado',
                '6. Após 15 dias sem pagar → cardápio é bloqueado automaticamente',
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-1.5">
                  <span className="text-indigo-400 flex-shrink-0">→</span>
                  <span>{t}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Dunning */}
          <div className="card p-4 bg-violet-50 border border-violet-200">
            <p className="text-sm font-bold text-violet-900 mb-1">Dunning automático (tentativas de cobrança)</p>
            <p className="text-xs text-violet-700">
              Quando o cartão é recusado, o Stripe tenta cobrar novamente em 3, 5 e 7 dias (configurável em{' '}
              <strong>Stripe → Settings → Subscriptions → Smart Retries</strong>).
              Após falhar todas as tentativas, o status vai para <code className="bg-violet-100 px-1 rounded font-mono">past_due</code> e
              o ZapMenu exibe aviso ao restaurante. No 16° dia de atraso, o cardápio é bloqueado automaticamente.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

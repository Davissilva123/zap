import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import type { RestaurantSettings } from '../../lib/types';
import {
  Store, RefreshCw, ExternalLink, Copy, Check, Search,
  ShoppingBag, DollarSign, Clock, ChevronDown, Filter,
} from 'lucide-react';

type Stat = { userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null };
type Plan = { userId: string; planSlug: string; planName: string; status: string; expiresAt: string | null };

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ago = (d: string | null) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
};

const PLAN_OPTIONS = [
  { slug: 'basic', label: 'Básico', color: 'bg-slate-100 text-slate-600' },
  { slug: 'pro', label: 'Pro', color: 'bg-blue-100 text-blue-700' },
  { slug: 'premium', label: 'Premium', color: 'bg-violet-100 text-violet-700' },
];

const planColor = (slug: string) => {
  if (slug === 'premium') return 'bg-violet-100 text-violet-700';
  if (slug === 'pro') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-500';
};

export default function AdminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantSettings[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'orders' | 'revenue' | 'name'>('orders');

  const load = async () => {
    setLoading(true);
    try {
      const [r, s, p] = await Promise.all([
        db.getAllRestaurants(),
        db.getRestaurantStats().catch(() => []),
        db.getRestaurantPlans().catch(() => []),
      ]);
      setRestaurants(r);
      setStats(s);
      setPlans(p);
    } catch (e: any) {
      alert('Erro: ' + (e?.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const getStat = (uid: string) => stats.find(s => s.userId === uid);
  const getPlan = (uid: string) => plans.find(p => p.userId === uid);

  const handleSetPlan = async (userId: string, slug: string) => {
    setChangingPlan(userId);
    try {
      await db.setRestaurantPlan(userId, slug);
      await load();
    } catch (e: any) {
      alert('Erro ao alterar plano: ' + (e?.message ?? e));
    } finally {
      setChangingPlan(null);
    }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/m/${slug}`);
    setCopied(slug);
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = restaurants
    .filter(r => {
      const q = search.toLowerCase();
      const matchSearch = r.name.toLowerCase().includes(q) || r.slug.includes(q) || (r.phone ?? '').includes(q);
      const planSlug = getPlan(r.userId)?.planSlug ?? 'basic';
      const matchPlan = filterPlan === 'all' || planSlug === filterPlan;
      return matchSearch && matchPlan;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      const sa = getStat(a.userId);
      const sb = getStat(b.userId);
      if (sortBy === 'revenue') return (sb?.totalRevenue ?? 0) - (sa?.totalRevenue ?? 0);
      return (sb?.orderCount ?? 0) - (sa?.orderCount ?? 0);
    });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Restaurantes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{restaurants.length} clientes cadastrados na plataforma</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome, slug ou telefone…" className="input w-full pl-10" />
        </div>
        <div className="flex gap-2">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
            {[{ v: 'all', l: 'Todos' }, { v: 'basic', l: 'Básico' }, { v: 'pro', l: 'Pro' }, { v: 'premium', l: 'Premium' }].map(f => (
              <button key={f.v} onClick={() => setFilterPlan(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterPlan === f.v ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {f.l}
              </button>
            ))}
          </div>
          <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input text-xs pr-8">
            <option value="orders">↓ Pedidos</option>
            <option value="revenue">↓ Receita</option>
            <option value="name">A → Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-400">Clique no plano para alterar</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum restaurante encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(r => {
                const stat = getStat(r.userId);
                const plan = getPlan(r.userId);
                const planSlug = plan?.planSlug ?? 'basic';
                const isChanging = changingPlan === r.userId;

                return (
                  <div key={r.userId} className="px-4 sm:px-5 py-4 hover:bg-slate-50/40 transition-colors">
                    <div className="flex items-start gap-3">
                      {r.logoUrl ? (
                        <img src={r.logoUrl} alt={r.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Store className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                          {r.mercadoPagoToken && <span className="badge bg-blue-50 text-blue-600 text-[10px] py-0.5">PIX</span>}
                          {r.whatsappEnabled && <span className="badge bg-green-50 text-green-600 text-[10px] py-0.5">WhatsApp</span>}
                        </div>

                        {/* Slug */}
                        <p className="text-xs text-slate-400 font-mono mb-2">/m/{r.slug} {r.phone ? `· ${r.phone}` : ''}</p>

                        {/* Stats */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" /> {stat?.orderCount ?? 0} pedidos
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> {stat ? R(stat.totalRevenue) : 'R$ 0,00'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {ago(stat?.lastOrderAt ?? null)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-end">
                        {/* Plan selector */}
                        <div className="relative">
                          <select
                            value={planSlug}
                            onChange={e => handleSetPlan(r.userId, e.target.value)}
                            disabled={isChanging}
                            className={`appearance-none text-[11px] font-bold pl-2.5 pr-6 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer transition-colors disabled:opacity-50 ${planColor(planSlug)}`}
                            title="Alterar plano"
                          >
                            {PLAN_OPTIONS.map(o => (
                              <option key={o.slug} value={o.slug}>{o.label}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                          {isChanging && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
                            </div>
                          )}
                        </div>

                        <button onClick={() => copyLink(r.slug)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Copiar link">
                          {copied === r.slug ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                        </button>

                        <a href={`/m/${r.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Ver cardápio">
                          <ExternalLink className="w-4 h-4 text-slate-400" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

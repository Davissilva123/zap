import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { RestaurantSettings } from '../lib/types';
import {
  Shield, Store, RefreshCw, ExternalLink, Zap, TrendingUp,
  ShoppingBag, DollarSign, Search, Copy, ChevronDown, Check,
  MessageCircle, Bike, Users, Star, Clock,
} from 'lucide-react';

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com';

type Stats = { userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null };
type Plan = { userId: string; planSlug: string; planName: string; status: string; expiresAt: string | null };
type PlatformStats = { totalRestaurants: number; totalOrders: number; totalRevenue: number; ordersToday: number; revenueToday: number };

const R = (n: number) => `R$ ${n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.')}`;
const ago = (d: string | null) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  const days = Math.floor(h / 24);
  return `${days}d atrás`;
};

export default function AdminPage() {
  const { user } = useAuth();
  const isSuperAdmin = !!(user?.email && SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL);

  const [restaurants, setRestaurants] = useState<RestaurantSettings[]>([]);
  const [stats, setStats] = useState<Stats[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState<'all' | 'free' | 'pro'>('all');
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [r, s, p, pl] = await Promise.all([
        db.getAllRestaurants(),
        db.getRestaurantStats().catch(() => []),
        db.getRestaurantPlans().catch(() => []),
        db.getPlatformStats().catch(() => null),
      ]);
      setRestaurants(r);
      setStats(s);
      setPlans(p);
      setPlatform(pl);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (isSuperAdmin) load(); else setLoading(false); }, [user]);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h2>
        <p className="text-slate-500 text-sm">Esta área é exclusiva para super-administradores.</p>
      </div>
    );
  }

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

  const filtered = restaurants.filter(r => {
    const matchSearch =
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      r.slug.toLowerCase().includes(search.toLowerCase()) ||
      (r.phone && r.phone.includes(search));
    const planSlug = getPlan(r.userId)?.planSlug ?? 'free';
    const matchPlan = filterPlan === 'all' || planSlug === filterPlan;
    return matchSearch && matchPlan;
  });

  // Sort by order count desc
  const sorted = [...filtered].sort((a, b) => {
    const sa = getStat(a.userId)?.orderCount ?? 0;
    const sb = getStat(b.userId)?.orderCount ?? 0;
    return sb - sa;
  });

  const statCards = platform
    ? [
        { label: 'Restaurantes', value: platform.totalRestaurants, icon: Store, color: 'text-emerald-600 bg-emerald-50', fmt: (n: number) => String(n) },
        { label: 'Pedidos totais', value: platform.totalOrders, icon: ShoppingBag, color: 'text-blue-600 bg-blue-50', fmt: (n: number) => String(n) },
        { label: 'Receita total', value: platform.totalRevenue, icon: DollarSign, color: 'text-violet-600 bg-violet-50', fmt: R },
        { label: 'Pedidos hoje', value: platform.ordersToday, icon: TrendingUp, color: 'text-amber-600 bg-amber-50', fmt: (n: number) => String(n) },
        { label: 'Receita hoje', value: platform.revenueToday, icon: Zap, color: 'text-emerald-600 bg-emerald-50', fmt: R },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel Super-Admin</h1>
          </div>
          <p className="text-slate-500 text-sm">Visão geral de todos os restaurantes na plataforma</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Platform stats */}
      {platform && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {statCards.map((s, i) => (
            <div key={i} className="card p-4">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${s.color}`}>
                <s.icon className="w-4 h-4" />
              </div>
              <div className="text-xl font-black text-slate-900 mb-0.5 leading-none">{s.fmt(s.value)}</div>
              <div className="text-xs text-slate-400 font-medium mt-1">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="card p-5 bg-amber-50 border border-amber-200 text-amber-800 text-sm space-y-1">
          <p><strong>Atenção:</strong> {error}</p>
          <p className="text-xs text-amber-600">Execute <code>supabase-features-v7.sql</code> + <code>supabase-admin-extras.sql</code> no Supabase SQL Editor.</p>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome, slug ou telefone..."
            className="input w-full pl-10"
          />
        </div>
        <div className="flex gap-1.5 p-1 bg-slate-100 rounded-xl">
          {(['all', 'free', 'pro'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilterPlan(f)}
              className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                filterPlan === f ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {f === 'all' ? 'Todos' : f === 'free' ? 'Grátis' : 'Pro'}
            </button>
          ))}
        </div>
      </div>

      {/* Restaurant list */}
      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">
              {sorted.length} restaurante{sorted.length !== 1 ? 's' : ''}
            </h3>
            <span className="text-xs text-slate-400">Ordenado por nº de pedidos</span>
          </div>

          {sorted.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum restaurante encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {sorted.map(r => {
                const stat = getStat(r.userId);
                const plan = getPlan(r.userId);
                const planSlug = plan?.planSlug ?? 'free';
                const isChanging = changingPlan === r.userId;

                return (
                  <div key={r.userId} className="px-4 sm:px-5 py-4 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-start gap-3">
                      {/* Logo */}
                      {r.logoUrl ? (
                        <img src={r.logoUrl} alt={r.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Store className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                          {/* Plan badge */}
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            planSlug === 'pro'
                              ? 'bg-violet-100 text-violet-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}>
                            {planSlug === 'pro' ? '⭐ Pro' : 'Grátis'}
                          </span>
                          {r.mercadoPagoToken && <span className="badge bg-blue-50 text-blue-600 text-[10px] py-0.5">PIX</span>}
                          {r.whatsappEnabled && <span className="badge bg-green-50 text-green-600 text-[10px] py-0.5">WhatsApp</span>}
                        </div>

                        {/* Slug + phone */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 mb-2">
                          <span className="font-mono">/m/{r.slug}</span>
                          {r.phone && <span>{r.phone}</span>}
                          {r.address && <span className="hidden sm:inline truncate max-w-[200px]">{r.address}</span>}
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            {stat?.orderCount ?? 0} pedidos
                          </span>
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {stat ? R(stat.totalRevenue) : 'R$ 0,00'}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {ago(stat?.lastOrderAt ?? null)}
                          </span>
                          {r.description && (
                            <span className="flex items-center gap-1 text-slate-400">
                              {r.description}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {/* Plan selector */}
                        <div className="relative">
                          <select
                            value={planSlug}
                            onChange={e => handleSetPlan(r.userId, e.target.value)}
                            disabled={isChanging}
                            className="appearance-none text-xs font-semibold pl-2.5 pr-6 py-1.5 rounded-lg border border-slate-200 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-colors cursor-pointer disabled:opacity-50"
                            title="Alterar plano"
                          >
                            <option value="free">Grátis</option>
                            <option value="pro">Pro</option>
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
                          {isChanging && (
                            <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                              <div className="w-3.5 h-3.5 border-2 border-slate-300 border-t-emerald-500 rounded-full animate-spin" />
                            </div>
                          )}
                        </div>

                        {/* Copy link */}
                        <button
                          onClick={() => copyLink(r.slug)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Copiar link do cardápio"
                        >
                          {copied === r.slug
                            ? <Check className="w-4 h-4 text-emerald-500" />
                            : <Copy className="w-4 h-4 text-slate-400" />
                          }
                        </button>

                        {/* Open cardápio */}
                        <a
                          href={`/m/${r.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                          title="Abrir cardápio"
                        >
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

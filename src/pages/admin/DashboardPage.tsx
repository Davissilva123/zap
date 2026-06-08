import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { Store, ShoppingBag, DollarSign, TrendingUp, Zap, RefreshCw, Users, CreditCard } from 'lucide-react';

type PlatformStats = { totalRestaurants: number; totalOrders: number; totalRevenue: number; ordersToday: number; revenueToday: number };
type RestaurantStat = { userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null };

const R = (n: number) =>
  'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const ago = (d: string | null) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora';
  if (h < 24) return `${h}h atrás`;
  return `${Math.floor(h / 24)}d atrás`;
};

export default function AdminDashboardPage() {
  const [platform, setPlatform] = useState<PlatformStats | null>(null);
  const [restaurantStats, setRestaurantStats] = useState<RestaurantStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [p, rs] = await Promise.all([
        db.getPlatformStats(),
        db.getRestaurantStats().catch(() => []),
      ]);
      setPlatform(p);
      setRestaurantStats(rs);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const topRestaurants = [...restaurantStats]
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, 5);

  const statCards = platform
    ? [
        { label: 'Restaurantes', value: String(platform.totalRestaurants), sub: 'cadastrados', icon: Store, color: 'bg-violet-50 text-violet-600' },
        { label: 'Pedidos totais', value: String(platform.totalOrders), sub: 'de todos os tempos', icon: ShoppingBag, color: 'bg-blue-50 text-blue-600' },
        { label: 'Receita total', value: R(platform.totalRevenue), sub: 'pedidos concluídos', icon: DollarSign, color: 'bg-emerald-50 text-emerald-600' },
        { label: 'Pedidos hoje', value: String(platform.ordersToday), sub: new Date().toLocaleDateString('pt-BR'), icon: TrendingUp, color: 'bg-amber-50 text-amber-600' },
        { label: 'Receita hoje', value: R(platform.revenueToday), sub: 'concluídos hoje', icon: Zap, color: 'bg-emerald-50 text-emerald-600' },
      ]
    : [];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Visão geral da plataforma em tempo real</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {error && (
        <div className="card p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          <strong>Execute os SQLs</strong>: <code>supabase-features-v7.sql</code> + <code>supabase-admin-extras.sql</code> + <code>supabase-plans-v2.sql</code>
        </div>
      )}

      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {statCards.map((s, i) => (
              <div key={i} className="card p-4">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${s.color}`}>
                  <s.icon className="w-4.5 h-4.5" />
                </div>
                <div className="text-xl font-black text-slate-900 leading-none mb-1">{s.value}</div>
                <div className="text-[11px] text-slate-400 font-medium">{s.label}</div>
                <div className="text-[10px] text-slate-300 mt-0.5">{s.sub}</div>
              </div>
            ))}
          </div>

          {/* Top restaurants */}
          {topRestaurants.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Top 5 — Maior faturamento</h3>
              </div>
              <div className="divide-y divide-slate-50">
                {topRestaurants.map((rs, i) => (
                  <div key={rs.userId} className="px-5 py-3.5 flex items-center gap-4">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-slate-100 text-slate-500' :
                      i === 2 ? 'bg-orange-100 text-orange-600' :
                      'bg-slate-50 text-slate-400'
                    }`}>
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate font-mono text-xs">{rs.userId.slice(0, 8)}…</p>
                      <p className="text-xs text-slate-400">{rs.orderCount} pedidos · último {ago(rs.lastOrderAt)}</p>
                    </div>
                    <div className="text-sm font-bold text-emerald-600 flex-shrink-0">{R(rs.totalRevenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid sm:grid-cols-3 gap-3">
            {[
              { label: 'Ver todos os restaurantes', desc: 'Gerencie clientes e planos', to: '/admin/restaurantes', icon: Users, color: 'text-violet-600 bg-violet-50' },
              { label: 'Gerenciar planos', desc: 'Edite preços e features', to: '/admin/planos', icon: CreditCard, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Plataforma ao vivo', desc: `${platform?.ordersToday ?? 0} pedidos hoje`, to: '/admin', icon: TrendingUp, color: 'text-blue-600 bg-blue-50' },
            ].map((link, i) => (
              <a key={i} href={link.to} className="card-hover p-4 flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${link.color}`}>
                  <link.icon className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900">{link.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{link.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

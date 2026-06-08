import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import {
  Store, ShoppingBag, DollarSign, TrendingUp, Zap, RefreshCw,
  AlertTriangle, Clock, Users, BarChart2, ArrowRight,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

type MrrStats = { mrrCurrent: number; arr: number; activePaid: number; inTrial: number; trialsExpiring7d: number; churnedMonth: number; totalRestaurants: number };
type RestaurantStat = { userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null };

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ago = (d: string | null) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora'; if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
};

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [mrr, setMrr] = useState<MrrStats | null>(null);
  const [stats, setStats] = useState<RestaurantStat[]>([]);
  const [platform, setPlatform] = useState<{ totalOrders: number; totalRevenue: number; ordersToday: number; revenueToday: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    try {
      const [m, s, p] = await Promise.all([
        db.getMrrStats().catch(() => null),
        db.getRestaurantStats().catch(() => []),
        db.getPlatformStats().catch(() => null),
      ]);
      setMrr(m); setStats(s); setPlatform(p);
      // Executa auto-bloqueio por inadimplência (silencioso)
      db.autoBlockOverdueRestaurants().catch(() => {});
    } catch (e: any) { setError(e?.message ?? 'Erro'); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const conversionRate = mrr
    ? mrr.activePaid + mrr.inTrial + mrr.churnedMonth > 0
      ? Math.round((mrr.activePaid / (mrr.activePaid + mrr.inTrial + mrr.churnedMonth)) * 100)
      : 0
    : 0;

  const topRestaurants = [...stats].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 text-sm mt-0.5">Visão geral da plataforma ZapMenu</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Trial alert banner */}
      {mrr && mrr.trialsExpiring7d > 0 && (
        <button
          onClick={() => navigate('/admin/restaurantes')}
          className="w-full flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl hover:bg-amber-100 transition-colors text-left"
        >
          <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-bold text-amber-800">
              {mrr.trialsExpiring7d} trial{mrr.trialsExpiring7d > 1 ? 's expiram' : ' expira'} nos próximos 7 dias
            </p>
            <p className="text-xs text-amber-600 mt-0.5">Faça follow-up para converter em clientes pagantes →</p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-500 flex-shrink-0" />
        </button>
      )}

      {error && (
        <div className="card p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm">
          Execute <strong>supabase-admin-v3.sql</strong> no Supabase SQL Editor para ativar todas as métricas.
        </div>
      )}

      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* MRR / SaaS Metrics */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Receita recorrente</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="card p-5 col-span-1">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center mb-3">
                  <DollarSign className="w-4.5 h-4.5 text-violet-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">{R(mrr?.mrrCurrent ?? 0)}</div>
                <div className="text-xs text-slate-400 font-medium">MRR (mensal)</div>
              </div>
              <div className="card p-5 col-span-1">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center mb-3">
                  <TrendingUp className="w-4.5 h-4.5 text-emerald-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">{R(mrr?.arr ?? 0)}</div>
                <div className="text-xs text-slate-400 font-medium">ARR (projeção anual)</div>
              </div>
              <div className="card p-5">
                <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center mb-3">
                  <Users className="w-4.5 h-4.5 text-blue-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">{mrr?.activePaid ?? 0}</div>
                <div className="text-xs text-slate-400 font-medium">Clientes pagantes</div>
              </div>
              <div className="card p-5">
                <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center mb-3">
                  <BarChart2 className="w-4.5 h-4.5 text-amber-600" />
                </div>
                <div className="text-2xl font-black text-slate-900 leading-none mb-1">{conversionRate}%</div>
                <div className="text-xs text-slate-400 font-medium">Taxa de conversão</div>
              </div>
            </div>
          </div>

          {/* Platform activity */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Atividade da plataforma</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Restaurantes', value: String(mrr?.totalRestaurants ?? 0), icon: Store, color: 'bg-slate-100 text-slate-600' },
                { label: 'Em trial', value: String(mrr?.inTrial ?? 0), icon: Clock, color: 'bg-amber-100 text-amber-600' },
                { label: 'Churn este mês', value: String(mrr?.churnedMonth ?? 0), icon: AlertTriangle, color: 'bg-red-100 text-red-600' },
                { label: 'Pedidos hoje', value: String(platform?.ordersToday ?? 0), icon: ShoppingBag, color: 'bg-blue-100 text-blue-600' },
              ].map((s, i) => (
                <div key={i} className="card p-4">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${s.color}`}>
                    <s.icon className="w-4 h-4" />
                  </div>
                  <div className="text-xl font-black text-slate-900 mb-0.5">{s.value}</div>
                  <div className="text-xs text-slate-400 font-medium">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Top 5 */}
          {topRestaurants.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900 text-sm">Top 5 por faturamento</h3>
                <button onClick={() => navigate('/admin/restaurantes')} className="text-xs text-violet-600 hover:underline font-semibold">
                  Ver todos →
                </button>
              </div>
              <div className="divide-y divide-slate-50">
                {topRestaurants.map((rs, i) => (
                  <div key={rs.userId} className="px-5 py-3.5 flex items-center gap-4">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black flex-shrink-0 ${
                      i === 0 ? 'bg-amber-100 text-amber-600' :
                      i === 1 ? 'bg-slate-100 text-slate-500' :
                      i === 2 ? 'bg-orange-100 text-orange-500' : 'bg-slate-50 text-slate-400'
                    }`}>{i + 1}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-slate-500 text-xs">{rs.userId.slice(0, 12)}…</p>
                      <p className="text-slate-400 text-xs">{rs.orderCount} pedidos · último {ago(rs.lastOrderAt)}</p>
                    </div>
                    <div className="text-sm font-bold text-emerald-600">{R(rs.totalRevenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick links */}
          <div className="grid sm:grid-cols-2 gap-3">
            <button onClick={() => navigate('/admin/restaurantes')} className="card-hover p-4 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
                <Users className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Gerenciar restaurantes</p>
                <p className="text-xs text-slate-400 mt-0.5">Planos, bloqueios e dados de contato</p>
              </div>
            </button>
            <button onClick={() => navigate('/admin/planos')} className="card-hover p-4 flex items-center gap-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <Zap className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-bold text-slate-900">Gerenciar planos</p>
                <p className="text-xs text-slate-400 mt-0.5">Preços, features e estrutura de planos</p>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

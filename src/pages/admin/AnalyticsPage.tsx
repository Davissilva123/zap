import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { TrendingUp, Users, BarChart2, AlertTriangle, RefreshCw, DollarSign } from 'lucide-react';

type MrrPoint = { month: string; mrrValue: number; activePaid: number; inTrial: number };
type PlanBreakdown = { planSlug: string; planName: string; planPrice: number; activeCount: number; mrr: number };
type FunnelStep = { stage: string; count: number };
type ChurnEntry = { userId: string; restaurantName: string; oldPlan: string; churnReason: string; churnedAt: string };

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const fmtMonth = (m: string) => {
  const [y, mo] = m.split('-');
  const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
  return `${names[parseInt(mo) - 1]}/${y.slice(2)}`;
};

const STAGE_LABELS: Record<string, string> = {
  cadastrou: 'Cadastraram',
  criou_restaurante: 'Criaram restaurante',
  personalizou: 'Personalizaram',
  fez_pedido: 'Receberam pedido',
};

const PLAN_COLORS: Record<string, string> = {
  basic: 'bg-slate-400',
  pro: 'bg-violet-500',
  premium: 'bg-amber-500',
};

function LineChart({ data }: { data: MrrPoint[] }) {
  if (!data.length) return <div className="h-40 flex items-center justify-center text-slate-400 text-sm">Sem dados</div>;
  const max = Math.max(...data.map(d => d.mrrValue), 1);
  const W = 600; const H = 140; const PAD = { t: 10, r: 20, b: 30, l: 55 };
  const w = W - PAD.l - PAD.r;
  const h = H - PAD.t - PAD.b;
  const pts = data.map((d, i) => {
    const x = PAD.l + (i / Math.max(data.length - 1, 1)) * w;
    const y = PAD.t + h - (d.mrrValue / max) * h;
    return { x, y, d };
  });
  const pathD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L${pts[pts.length - 1].x.toFixed(1)},${(PAD.t + h).toFixed(1)} L${pts[0].x.toFixed(1)},${(PAD.t + h).toFixed(1)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map(t => ({ val: max * t, y: PAD.t + h - t * h }));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 160 }}>
      <defs>
        <linearGradient id="mrr-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#8b5cf6" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {ticks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.l} x2={W - PAD.r} y1={t.y} y2={t.y} stroke="#e2e8f0" strokeWidth="1" />
          <text x={PAD.l - 6} y={t.y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">
            {t.val >= 1000 ? `R$${(t.val / 1000).toFixed(0)}k` : `R$${t.val.toFixed(0)}`}
          </text>
        </g>
      ))}
      <path d={areaD} fill="url(#mrr-grad)" />
      <path d={pathD} fill="none" stroke="#8b5cf6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r="4" fill="#8b5cf6" stroke="white" strokeWidth="2" />
          <text x={p.x} y={PAD.t + h + 16} textAnchor="middle" fontSize="9" fill="#64748b">
            {fmtMonth(p.d.month)}
          </text>
        </g>
      ))}
    </svg>
  );
}

export default function AdminAnalyticsPage() {
  const [mrrHistory, setMrrHistory] = useState<MrrPoint[]>([]);
  const [planBreakdown, setPlanBreakdown] = useState<PlanBreakdown[]>([]);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [churn, setChurn] = useState<ChurnEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'mrr' | 'funnel' | 'churn'>('mrr');

  const load = async () => {
    setLoading(true);
    try {
      const [hist, plan, fun, ch] = await Promise.all([
        db.getMrrHistory().catch(() => []),
        db.getMrrByPlan().catch(() => []),
        db.getOnboardingFunnel().catch(() => []),
        db.getChurnReport().catch(() => []),
      ]);
      setMrrHistory(hist);
      setPlanBreakdown(plan);
      setFunnel(fun);
      setChurn(ch);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const totalMrr = planBreakdown.reduce((s, p) => s + p.mrr, 0);
  const maxFunnel = funnel[0]?.count || 1;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          <p className="text-slate-500 text-sm mt-0.5">Receita, conversão e crescimento</p>
        </div>
        <button onClick={load} disabled={loading} className="btn-secondary">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
        {([['mrr', 'Receita'], ['funnel', 'Funil'], ['churn', 'Churn']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* ---- TAB: RECEITA ---- */}
          {tab === 'mrr' && (
            <div className="space-y-4">
              {/* MRR histórico */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-violet-500" />
                  <h3 className="font-bold text-slate-900 text-sm">MRR histórico</h3>
                </div>
                <div className="p-4">
                  <LineChart data={mrrHistory} />
                </div>
              </div>

              {/* Breakdown por plano */}
              <div className="card overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <h3 className="font-bold text-slate-900 text-sm">Receita por plano</h3>
                  <span className="ml-auto text-sm font-bold text-slate-900">{R(totalMrr)}/mês</span>
                </div>
                <div className="p-5 space-y-4">
                  {planBreakdown.length === 0 ? (
                    <p className="text-slate-400 text-sm text-center py-4">Nenhum dado ainda</p>
                  ) : planBreakdown.map(p => {
                    const pct = totalMrr > 0 ? (p.mrr / totalMrr) * 100 : 0;
                    return (
                      <div key={p.planSlug}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${PLAN_COLORS[p.planSlug] ?? 'bg-slate-400'}`} />
                            <span className="text-sm font-semibold text-slate-800">{p.planName}</span>
                            <span className="text-xs text-slate-400">{p.activeCount} cliente{p.activeCount !== 1 ? 's' : ''} · {R(p.planPrice)}/mês</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-bold text-slate-900">{R(p.mrr)}</span>
                            <span className="text-xs text-slate-400 ml-1.5">{pct.toFixed(0)}%</span>
                          </div>
                        </div>
                        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${PLAN_COLORS[p.planSlug] ?? 'bg-slate-400'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ---- TAB: FUNIL ---- */}
          {tab === 'funnel' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-slate-900 text-sm">Funil de onboarding</h3>
              </div>
              <div className="p-5 space-y-4">
                {funnel.length === 0 ? (
                  <p className="text-slate-400 text-sm text-center py-4">Execute supabase-billing-v1.sql para ativar</p>
                ) : funnel.map((step, i) => {
                  const pct = maxFunnel > 0 ? (step.count / maxFunnel) * 100 : 0;
                  const dropoff = i > 0 && funnel[i - 1].count > 0
                    ? Math.round((1 - step.count / funnel[i - 1].count) * 100)
                    : null;
                  return (
                    <div key={step.stage}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-xs font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                          <span className="text-sm font-semibold text-slate-800">{STAGE_LABELS[step.stage] ?? step.stage}</span>
                          {dropoff !== null && dropoff > 0 && (
                            <span className="text-xs text-red-400 font-medium">-{dropoff}%</span>
                          )}
                        </div>
                        <span className="text-sm font-bold text-slate-900">{step.count.toLocaleString('pt-BR')}</span>
                      </div>
                      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-violet-500 transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                {funnel.length > 1 && (
                  <div className="mt-4 p-3 bg-violet-50 rounded-xl border border-violet-100">
                    <p className="text-xs text-violet-700 font-medium">
                      Taxa de ativação:{' '}
                      <strong>
                        {funnel[0].count > 0
                          ? Math.round((funnel[funnel.length - 1].count / funnel[0].count) * 100)
                          : 0}%
                      </strong>{' '}
                      dos que se cadastraram chegaram a receber um pedido
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ---- TAB: CHURN ---- */}
          {tab === 'churn' && (
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h3 className="font-bold text-slate-900 text-sm">Relatório de churn</h3>
                <span className="ml-auto text-xs font-semibold bg-red-50 text-red-600 px-2 py-0.5 rounded-full">
                  {churn.length} cancelamento{churn.length !== 1 ? 's' : ''}
                </span>
              </div>
              {churn.length === 0 ? (
                <div className="p-8 text-center">
                  <BarChart2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                  <p className="text-slate-400 text-sm">Nenhum cancelamento registrado</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {churn.map((c, i) => (
                    <div key={i} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 truncate">{c.restaurantName}</p>
                          <p className="text-xs text-slate-400 mt-0.5">
                            Plano: <span className="font-medium capitalize">{c.oldPlan}</span>
                            {' · '}
                            {new Date(c.churnedAt).toLocaleDateString('pt-BR')}
                          </p>
                          {c.churnReason && c.churnReason !== 'Não informado' && (
                            <p className="text-xs text-slate-500 mt-1 italic">"{c.churnReason}"</p>
                          )}
                        </div>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-50 text-red-600 flex-shrink-0">Cancelado</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

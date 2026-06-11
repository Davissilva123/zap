import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { Order, CashSession } from '../lib/types';
import { TrendingUp, DollarSign, BarChart2, Wallet, ShoppingCart, XCircle } from 'lucide-react';

const PAYMENT_LABELS: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  meal_voucher: 'Vale-refeição',
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function FinancasPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [allOrders, sessions] = await Promise.all([
        db.getOrders(user.id),
        db.getCashSessions(user.id),
      ]);
      setOrders(allOrders);
      setCashSessions(sessions);
      setLoading(false);
    })();
  }, [user]);

  const cutoff = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - period);
    return d;
  }, [period]);

  const rangeOrders = orders.filter(o => new Date(o.createdAt) >= cutoff && o.status !== 'CANCELLED');
  const cancelledOrders = orders.filter(o => new Date(o.createdAt) >= cutoff && o.status === 'CANCELLED');

  const revenue = rangeOrders.reduce((s, o) => s + o.total, 0);
  const cancelledTotal = cancelledOrders.reduce((s, o) => s + o.total, 0);
  const avgTicket = rangeOrders.length > 0 ? revenue / rangeOrders.length : 0;

  const cashWithdrawals = cashSessions
    .filter(s => new Date(s.openedAt) >= cutoff)
    .reduce((sum, s) => sum + s.totalWithdrawals, 0);

  const cashDeposits = cashSessions
    .filter(s => new Date(s.openedAt) >= cutoff)
    .reduce((sum, s) => sum + s.totalDeposits, 0);

  // Monthly chart — últimos 6 meses
  const monthlyData = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      map.set(key, { revenue: 0, count: 0 });
    }
    for (const order of orders) {
      if (order.status === 'CANCELLED') continue;
      const d = new Date(order.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      if (map.has(key)) {
        const cur = map.get(key)!;
        map.set(key, { revenue: cur.revenue + order.total, count: cur.count + 1 });
      }
    }
    return Array.from(map.entries()).map(([key, v]) => ({
      month: key,
      label: new Date(key + '-01').toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' }),
      ...v,
    }));
  }, [orders]);

  const maxMonthlyRevenue = Math.max(...monthlyData.map(m => m.revenue), 1);

  // Payment breakdown
  const paymentBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    for (const order of rangeOrders) {
      map.set(order.paymentMethod, (map.get(order.paymentMethod) || 0) + order.total);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([method, total]) => ({
        method,
        total,
        pct: revenue > 0 ? (total / revenue) * 100 : 0,
      }));
  }, [rangeOrders, revenue]);

  // Top selling items
  const topItems = useMemo(() => {
    const map = new Map<string, { name: string; emoji: string; qty: number; revenue: number }>();
    for (const order of rangeOrders) {
      for (const oi of order.items) {
        const cur = map.get(oi.menuItemId) || { name: oi.name, emoji: oi.emoji, qty: 0, revenue: 0 };
        map.set(oi.menuItemId, {
          name: oi.name,
          emoji: oi.emoji,
          qty: cur.qty + oi.quantity,
          revenue: cur.revenue + oi.price * oi.quantity,
        });
      }
    }
    return Array.from(map.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);
  }, [rangeOrders]);

  const topRevenue = topItems[0]?.revenue || 1;

  const periodSessions = cashSessions.filter(s => new Date(s.openedAt) >= cutoff);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Finanças</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Visão geral financeira do seu restaurante</p>
        </div>
        <div className="flex items-center gap-2">
          {[30, 60, 90].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${period === d ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Receita bruta</p>
          <p className="text-2xl font-black text-emerald-600 tracking-tight">{fmt(revenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{rangeOrders.length} pedidos</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Ticket médio</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmt(avgTicket)}</p>
          <p className="text-xs text-slate-400 mt-1">por pedido</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Cancelamentos</p>
          <p className="text-2xl font-black text-red-500 tracking-tight">{fmt(cancelledTotal)}</p>
          <p className="text-xs text-slate-400 mt-1">{cancelledOrders.length} pedidos</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Saídas de caixa</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmt(cashWithdrawals)}</p>
          <p className="text-xs text-slate-400 mt-1">retiradas registradas</p>
        </div>
      </div>

      {/* Monthly Revenue Chart */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-5 flex items-center gap-2">
          <BarChart2 className="w-4 h-4 text-emerald-500" /> Receita mensal — últimos 6 meses
        </h2>
        <div className="flex items-end gap-2 h-32">
          {monthlyData.map(m => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
              <span className="text-[9px] font-semibold text-slate-500 truncate w-full text-center">
                {m.revenue > 0 ? `R$${(m.revenue / 1000).toFixed(1)}k` : ''}
              </span>
              <div
                className="w-full rounded-t-lg bg-emerald-500 transition-all"
                style={{ height: `${Math.max(4, (m.revenue / maxMonthlyRevenue) * 96)}px` }}
              />
              <span className="text-[9px] text-slate-400 font-medium">{m.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Payment breakdown */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-500" /> Formas de pagamento
          </h2>
          {paymentBreakdown.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sem dados no período</p>
          ) : (
            <div className="space-y-3">
              {paymentBreakdown.map(({ method, total, pct }) => (
                <div key={method}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{PAYMENT_LABELS[method] || method}</span>
                    <span className="text-slate-500">
                      {fmt(total)} <span className="text-slate-400">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top products by revenue */}
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-emerald-500" /> Top produtos por receita
          </h2>
          {topItems.length === 0 ? (
            <p className="text-slate-400 text-sm text-center py-6">Sem dados no período</p>
          ) : (
            <div className="space-y-3">
              {topItems.map(item => (
                <div key={item.name}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-slate-700 font-medium">{item.emoji} {item.name}</span>
                    <span className="text-slate-500">{fmt(item.revenue)} <span className="text-slate-400">(×{item.qty})</span></span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(item.revenue / topRevenue) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Cash register summary */}
      {periodSessions.length > 0 && (
        <div className="card p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-500" /> Caixa — sessões do período
          </h2>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-emerald-50 rounded-xl p-3 text-center">
              <p className="text-[11px] font-semibold text-emerald-600 uppercase tracking-wider mb-1">Vendas</p>
              <p className="text-lg font-black text-emerald-700">{fmt(periodSessions.reduce((s, c) => s + c.totalSales, 0))}</p>
            </div>
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Entradas</p>
              <p className="text-lg font-black text-blue-700">{fmt(cashDeposits)}</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-[11px] font-semibold text-red-600 uppercase tracking-wider mb-1">Saídas</p>
              <p className="text-lg font-black text-red-700">{fmt(cashWithdrawals)}</p>
            </div>
          </div>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {periodSessions.map(s => (
              <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-slate-700">
                    {new Date(s.openedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    {s.closedAt && ` → ${new Date(s.closedAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}`}
                  </p>
                  <p className="text-xs text-slate-400">{s.status === 'open' ? 'Em aberto' : 'Fechado'}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-emerald-600">{fmt(s.totalSales)}</p>
                  {s.totalWithdrawals > 0 && (
                    <p className="text-xs text-red-500 flex items-center justify-end gap-0.5">
                      <XCircle className="w-3 h-3" /> -{fmt(s.totalWithdrawals)}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card p-4 bg-blue-50 border-blue-100">
        <div className="flex items-start gap-3">
          <TrendingUp className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-blue-700">
            <strong>Análise de margem:</strong> Para ver o CMV (Custo da Mercadoria Vendida) e a margem de lucro por produto,
            acesse o módulo <strong>CMV</strong> no menu. Cadastre o custo de produção de cada item no cardápio para obter
            dados precisos de lucratividade.
          </p>
        </div>
      </div>
    </div>
  );
}

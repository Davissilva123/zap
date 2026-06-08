import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import type { Order, RestaurantSettings } from '../lib/types';
import { TrendingUp, ShoppingBag, DollarSign, Clock, Star, Download, Check, Loader2, Copy } from 'lucide-react';

function fmt(v: number) { return `R$ ${v.toFixed(2).replace('.', ',')}`; }

function StatCard({ icon: Icon, label, value, sub, color }: { icon: typeof TrendingUp; label: string; value: string; sub?: string; color: string }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>
          <Icon className="w-4.5 h-4.5 text-white w-5 h-5" />
        </div>
        <span className="text-sm text-slate-500 font-medium">{label}</span>
      </div>
      <p className="text-2xl font-extrabold text-slate-900">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function ReportsPage() {
  const { user } = useAuth();
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [range, setRange] = useState<'7' | '30' | '90' | 'custom'>('30');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [generatingCoupon, setGeneratingCoupon] = useState<string | null>(null);
  const [generatedCoupons, setGeneratedCoupons] = useState<Record<string, string>>({});
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    db.getOrders(restaurantId).then(setOrders);
    db.getSettings(restaurantId).then(setSettings);
  }, [restaurantId]);

  const generateCashbackCoupon = async (customerName: string, customerPhone: string, amount: number) => {
    if (!restaurantId) return;
    const key = customerPhone;
    setGeneratingCoupon(key);
    const code = `CB${customerName.replace(/\s+/g, '').toUpperCase().slice(0, 6)}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const expires = new Date(Date.now() + 30 * 86400000).toISOString();
    await db.addCoupon(restaurantId, {
      code,
      discountType: 'fixed',
      discountValue: Math.floor(amount * 100) / 100,
      minOrder: 0,
      maxUses: 1,
      active: true,
      expiresAt: expires,
    });
    setGeneratedCoupons(prev => ({ ...prev, [key]: code }));
    setGeneratingCoupon(null);
  };

  const copyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2500);
  };

  const days = range === 'custom' ? 30 : Number(range);
  const since = range === 'custom' && customFrom
    ? new Date(customFrom).toISOString()
    : new Date(Date.now() - days * 86400000).toISOString();
  const until = range === 'custom' && customTo
    ? new Date(customTo + 'T23:59:59').toISOString()
    : new Date().toISOString();
  const rangeOrders = orders.filter(o => o.createdAt >= since && o.createdAt <= until && o.status !== 'CANCELLED');

  const totalRevenue = rangeOrders.reduce((s, o) => s + o.total, 0);
  const avgTicket = rangeOrders.length ? totalRevenue / rangeOrders.length : 0;

  // Revenue by day
  const byDay: Record<string, number> = {};
  rangeOrders.forEach(o => {
    const d = o.createdAt.slice(0, 10);
    byDay[d] = (byDay[d] || 0) + o.total;
  });
  const dayEntries = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14);
  const maxDay = Math.max(...dayEntries.map(([, v]) => v), 1);

  // Top products
  const productCount: Record<string, { name: string; qty: number; revenue: number }> = {};
  rangeOrders.forEach(o => o.items.forEach(i => {
    if (!productCount[i.menuItemId]) productCount[i.menuItemId] = { name: i.name, qty: 0, revenue: 0 };
    productCount[i.menuItemId].qty += i.quantity;
    productCount[i.menuItemId].revenue += i.price * i.quantity;
  }));
  const topProducts = Object.values(productCount).sort((a, b) => b.qty - a.qty).slice(0, 8);

  // Orders by hour
  const byHour: Record<number, number> = {};
  rangeOrders.forEach(o => {
    const h = new Date(o.createdAt).getHours();
    byHour[h] = (byHour[h] || 0) + 1;
  });
  const hourEntries = Array.from({ length: 24 }, (_, h) => [h, byHour[h] || 0] as [number, number]);
  const maxHour = Math.max(...hourEntries.map(([, v]) => v), 1);

  // Payment methods
  const byPayment: Record<string, { count: number; revenue: number }> = {};
  rangeOrders.forEach(o => {
    if (!byPayment[o.paymentMethod]) byPayment[o.paymentMethod] = { count: 0, revenue: 0 };
    byPayment[o.paymentMethod].count += 1;
    byPayment[o.paymentMethod].revenue += o.total;
  });
  const payLabels: Record<string, { label: string; emoji: string }> = {
    pix: { label: 'PIX', emoji: '💠' },
    credit_card: { label: 'Crédito', emoji: '💳' },
    debit_card: { label: 'Débito', emoji: '💳' },
    cash: { label: 'Dinheiro', emoji: '💵' },
    meal_voucher: { label: 'Vale-refeição', emoji: '🎫' },
  };

  const exportCSV = () => {
    const headers = ['Data', 'Hora', 'Cliente', 'Telefone', 'Itens', 'Total', 'Status', 'Pagamento', 'Tipo entrega'];
    const rows = rangeOrders.map(o => {
      const d = new Date(o.createdAt);
      return [
        d.toLocaleDateString('pt-BR'),
        d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        o.customerName,
        o.customerPhone,
        o.items.map(i => `${i.quantity}x ${i.name}`).join(' | '),
        o.total.toFixed(2).replace('.', ','),
        o.status,
        o.paymentMethod,
        o.deliveryType,
      ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`);
    });
    const csv = [headers.map(h => `"${h}"`), ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `relatorio-${range}d-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Relatórios</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Visão geral do seu desempenho</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={exportCSV}
            disabled={rangeOrders.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            title="Exportar pedidos como CSV (abre no Excel)"
          >
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
          <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
            {(['7', '30', '90'] as const).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === r ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
                {r}d
              </button>
            ))}
            <button onClick={() => setRange('custom')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${range === 'custom' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              Custom
            </button>
          </div>
          {range === 'custom' && (
            <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-slate-400" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-slate-200 text-sm bg-white focus:outline-none focus:border-slate-400" />
            </div>
          )}
      </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} label="Faturamento" value={fmt(totalRevenue)} sub={`Últimos ${range} dias`} color="bg-emerald-500" />
        <StatCard icon={ShoppingBag} label="Pedidos" value={String(rangeOrders.length)} sub="Concluídos e pendentes" color="bg-blue-500" />
        <StatCard icon={TrendingUp} label="Ticket médio" value={fmt(avgTicket)} sub="Por pedido" color="bg-violet-500" />
        <StatCard icon={Clock} label="Cancelamentos" value={String(orders.filter(o => o.createdAt >= since && o.createdAt <= until && o.status === 'CANCELLED').length)} sub={range === 'custom' ? 'Período selecionado' : `Últimos ${range} dias`} color="bg-red-400" />
      </div>

      {/* Gráfico de faturamento por dia */}
      {dayEntries.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm">Faturamento por dia</h3>
          <div className="flex items-end gap-1 h-40">
            {dayEntries.map(([date, val]) => (
              <div key={date} className="flex-1 flex flex-col items-center gap-1 group">
                <div className="relative w-full flex justify-center">
                  <div
                    className="w-full max-w-[32px] bg-emerald-500 rounded-t-md hover:bg-emerald-600 transition-colors cursor-default"
                    style={{ height: `${(val / maxDay) * 140}px`, minHeight: 4 }}
                    title={`${date}: ${fmt(val)}`}
                  />
                </div>
                <span className="text-[9px] text-slate-400 rotate-45 origin-left translate-y-2 whitespace-nowrap hidden sm:block">
                  {date.slice(5)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Top produtos */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-400" /> Produtos mais vendidos
          </h3>
          {topProducts.length === 0 && <p className="text-sm text-slate-400">Sem dados ainda</p>}
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <span className="text-xs font-bold text-slate-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                  <div className="mt-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${(p.qty / (topProducts[0]?.qty || 1)) * 100}%` }} />
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-slate-700">{p.qty}x</p>
                  <p className="text-[11px] text-slate-400">{fmt(p.revenue)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Horário de pico */}
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-4 text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-400" /> Horário de pico
          </h3>
          <div className="flex items-end gap-0.5 h-24">
            {hourEntries.map(([h, v]) => (
              <div key={h} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className={`w-full rounded-t-sm transition-colors ${v > 0 ? 'bg-blue-400 hover:bg-blue-500' : 'bg-slate-100'}`}
                  style={{ height: `${(v / maxHour) * 88}px`, minHeight: v > 0 ? 4 : 2 }}
                  title={`${h}h: ${v} pedidos`}
                />
                {h % 6 === 0 && <span className="text-[9px] text-slate-400">{h}h</span>}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Conciliação financeira */}
      {Object.keys(byPayment).length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold text-slate-900 mb-1 text-sm">Conciliação financeira</h3>
          <p className="text-xs text-slate-400 mb-4">Receita por forma de pagamento no período</p>
          <div className="space-y-3">
            {Object.entries(byPayment).sort(([,a],[,b]) => b.revenue - a.revenue).map(([method, { count, revenue }]) => {
              const pay = payLabels[method] || { label: method, emoji: '💰' };
              const pct = totalRevenue > 0 ? revenue / totalRevenue : 0;
              return (
                <div key={method}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-slate-700">{pay.emoji} {pay.label}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{count} pedido{count !== 1 ? 's' : ''}</span>
                      <span className="text-sm font-bold text-slate-900">{fmt(revenue)}</span>
                      <span className="text-xs text-slate-400 w-10 text-right">{Math.round(pct * 100)}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-400 rounded-full" style={{ width: `${pct * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-500">Total do período</span>
            <span className="text-base font-extrabold text-emerald-600">{fmt(totalRevenue)}</span>
          </div>
        </div>
      )}

      {rangeOrders.length === 0 && (
        <div className="card p-16 text-center">
          <TrendingUp className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Sem pedidos nos últimos {range} dias</p>
        </div>
      )}

      {/* ── CASHBACK MANAGEMENT ── */}
      {settings && (settings.cashbackPercent ?? 0) > 0 && (() => {
        const pct = settings.cashbackPercent / 100;
        // Group all-time completed orders by customer phone
        const byCustomer: Record<string, { name: string; phone: string; total: number; count: number }> = {};
        orders.filter(o => ['COMPLETED', 'DELIVERING', 'PREPARING', 'PAID'].includes(o.status)).forEach(o => {
          const k = o.customerPhone;
          if (!byCustomer[k]) byCustomer[k] = { name: o.customerName, phone: o.customerPhone, total: 0, count: 0 };
          byCustomer[k].total += o.total;
          byCustomer[k].count += 1;
        });
        const rows = Object.values(byCustomer)
          .map(c => ({ ...c, cashback: c.total * pct }))
          .filter(c => c.cashback >= 1)
          .sort((a, b) => b.cashback - a.cashback);
        if (rows.length === 0) return null;
        return (
          <div className="card overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
              <DollarSign className="w-4 h-4 text-emerald-600" />
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Cashback dos clientes</h3>
                <p className="text-xs text-slate-400 mt-0.5">{settings.cashbackPercent}% sobre todos os pedidos concluídos · {rows.length} cliente{rows.length !== 1 ? 's' : ''} com saldo ≥ R$ 1,00</p>
              </div>
            </div>
            <div className="divide-y divide-slate-50">
              {rows.map(row => {
                const couponCode = generatedCoupons[row.phone];
                const isGenerating = generatingCoupon === row.phone;
                return (
                  <div key={row.phone} className="px-5 py-3.5 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{row.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{row.phone} · {row.count} pedido{row.count !== 1 ? 's' : ''} · gasto R$ {row.total.toFixed(2).replace('.', ',')}</p>
                    </div>
                    <span className="text-base font-extrabold text-emerald-600 flex-shrink-0">R$ {row.cashback.toFixed(2).replace('.', ',')}</span>
                    {couponCode ? (
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <span className="text-xs font-mono font-bold text-violet-700 bg-violet-50 border border-violet-200 px-2 py-1 rounded-lg">{couponCode}</span>
                        <button onClick={() => copyCoupon(couponCode)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
                          {copiedCode === couponCode ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => generateCashbackCoupon(row.name, row.phone, row.cashback)}
                        disabled={isGenerating}
                        className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500 text-white text-xs font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60"
                      >
                        {isGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <DollarSign className="w-3.5 h-3.5" />}
                        Gerar cupom
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
}

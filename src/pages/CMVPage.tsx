import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { MenuItem, Order } from '../lib/types';
import { TrendingDown, TrendingUp, Package, AlertTriangle, Info, BarChart2 } from 'lucide-react';

interface CmvRow {
  id: string;
  name: string;
  emoji: string;
  price: number;
  cost: number;
  marginPct: number;
  qtySold: number;
  revenue: number;
  cmvTotal: number;
}

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export default function CMVPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [period, setPeriod] = useState(30);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<'cmv' | 'margin' | 'qty'>('cmv');

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [menuItems, allOrders] = await Promise.all([
        db.getMenuItems(user.id),
        db.getOrders(user.id),
      ]);
      setItems(menuItems);
      setOrders(allOrders);
      setLoading(false);
    })();
  }, [user]);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - period);

  const rangeOrders = orders.filter(o =>
    new Date(o.createdAt) >= cutoff && o.status !== 'CANCELLED'
  );

  const itemMap = new Map(items.map(i => [i.id, i]));

  const statsMap = new Map<string, { qty: number; revenue: number; cmv: number }>();
  for (const order of rangeOrders) {
    for (const oi of order.items) {
      const mi = itemMap.get(oi.menuItemId);
      const cost = mi?.cost ?? 0;
      const s = statsMap.get(oi.menuItemId) || { qty: 0, revenue: 0, cmv: 0 };
      statsMap.set(oi.menuItemId, {
        qty: s.qty + oi.quantity,
        revenue: s.revenue + oi.price * oi.quantity,
        cmv: s.cmv + cost * oi.quantity,
      });
    }
  }

  const rows: CmvRow[] = items
    .filter(i => statsMap.has(i.id))
    .map(i => {
      const s = statsMap.get(i.id)!;
      const cost = i.cost ?? 0;
      const marginPct = i.price > 0 ? ((i.price - cost) / i.price) * 100 : 0;
      return {
        id: i.id, name: i.name, emoji: i.emoji,
        price: i.price, cost,
        marginPct,
        qtySold: s.qty,
        revenue: s.revenue,
        cmvTotal: s.cmv,
      };
    })
    .sort((a, b) => {
      if (sortKey === 'cmv') return b.cmvTotal - a.cmvTotal;
      if (sortKey === 'margin') return a.marginPct - b.marginPct;
      return b.qtySold - a.qtySold;
    });

  const totalRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const totalCmv = rows.reduce((s, r) => s + r.cmvTotal, 0);
  const grossProfit = totalRevenue - totalCmv;
  const cmvPct = totalRevenue > 0 ? (totalCmv / totalRevenue) * 100 : 0;

  const itemsMissingCost = items.filter(i => !i.cost || i.cost <= 0).length;
  const cmvIsGood = cmvPct > 0 && cmvPct <= 35;
  const cmvIsWarning = cmvPct > 35 && cmvPct <= 50;
  const cmvIsCritical = cmvPct > 50;

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">CMV — Custo da Mercadoria Vendida</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Análise de custos e margem por produto</p>
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

      {itemsMissingCost > 0 && (
        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">
              {itemsMissingCost} produto{itemsMissingCost > 1 ? 's' : ''} sem custo cadastrado
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Acesse <strong>Cardápio</strong> e edite cada produto para informar o custo de produção.
              Sem esse dado, o CMV estará subestimado.
            </p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Receita</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmt(totalRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">últimos {period} dias</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">CMV Total</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmt(totalCmv)}</p>
          <p className={`text-xs mt-1 font-semibold ${cmvIsCritical ? 'text-red-500' : cmvIsWarning ? 'text-amber-500' : cmvIsGood ? 'text-emerald-500' : 'text-slate-400'}`}>
            {fmtPct(cmvPct)} da receita
          </p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Lucro Bruto</p>
          <p className={`text-2xl font-black tracking-tight ${grossProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {fmt(grossProfit)}
          </p>
          <p className="text-xs text-slate-400 mt-1">receita − cmv</p>
        </div>
        <div className={`card p-4 ${cmvIsCritical ? 'ring-2 ring-red-200' : cmvIsWarning ? 'ring-2 ring-amber-200' : ''}`}>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">% CMV</p>
          <p className={`text-2xl font-black tracking-tight ${cmvIsCritical ? 'text-red-600' : cmvIsWarning ? 'text-amber-600' : cmvIsGood ? 'text-emerald-600' : 'text-slate-400'}`}>
            {fmtPct(cmvPct)}
          </p>
          <p className="text-xs text-slate-400 mt-1">ideal: 25–35%</p>
        </div>
      </div>

      {totalRevenue > 0 && (
        <div className={`flex items-center gap-3 p-4 rounded-2xl border ${cmvIsCritical ? 'bg-red-50 border-red-200' : cmvIsWarning ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
          {cmvIsCritical
            ? <TrendingDown className="w-5 h-5 text-red-500 flex-shrink-0" />
            : cmvIsWarning
            ? <TrendingDown className="w-5 h-5 text-amber-500 flex-shrink-0" />
            : <TrendingUp className="w-5 h-5 text-emerald-500 flex-shrink-0" />}
          <div>
            <p className={`text-sm font-bold ${cmvIsCritical ? 'text-red-800' : cmvIsWarning ? 'text-amber-800' : 'text-emerald-800'}`}>
              {cmvIsCritical
                ? 'CMV crítico — seus custos estão muito altos'
                : cmvIsWarning
                ? 'CMV elevado — revise os preços ou negocie com fornecedores'
                : 'CMV dentro da faixa ideal para restaurantes'}
            </p>
            <p className={`text-xs mt-0.5 ${cmvIsCritical ? 'text-red-600' : cmvIsWarning ? 'text-amber-600' : 'text-emerald-600'}`}>
              Referência do setor: CMV entre 25% e 35% indica boa gestão de custos.
            </p>
          </div>
        </div>
      )}

      {rows.length > 0 ? (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 flex-wrap gap-2">
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart2 className="w-4 h-4 text-emerald-500" /> Análise por produto
            </h2>
            <div className="flex gap-1">
              {(['cmv', 'margin', 'qty'] as const).map(k => (
                <button
                  key={k}
                  onClick={() => setSortKey(k)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${sortKey === k ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-100'}`}
                >
                  {k === 'cmv' ? 'Maior CMV' : k === 'margin' ? 'Menor margem' : 'Mais vendidos'}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Produto</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Preço</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Custo</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Margem</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Qtd</th>
                  <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Receita</th>
                  <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">CMV</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {rows.map(r => {
                  const marginBad = r.cost > 0 && r.marginPct < 50;
                  return (
                    <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-medium text-slate-800">{r.emoji} {r.name}</span>
                        {r.cost === 0 && (
                          <span className="ml-2 text-[10px] text-amber-500 font-semibold bg-amber-50 px-1.5 py-0.5 rounded-full">sem custo</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">{fmt(r.price)}</td>
                      <td className="px-3 py-3 text-right text-slate-600">
                        {r.cost > 0 ? fmt(r.cost) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className={`px-3 py-3 text-right font-semibold ${r.cost > 0 ? (marginBad ? 'text-red-500' : 'text-emerald-600') : 'text-slate-300'}`}>
                        {r.cost > 0 ? fmtPct(r.marginPct) : '—'}
                      </td>
                      <td className="px-3 py-3 text-right text-slate-600">{r.qtySold}</td>
                      <td className="px-3 py-3 text-right text-slate-700 font-medium">{fmt(r.revenue)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-800">
                        {r.cmvTotal > 0 ? fmt(r.cmvTotal) : <span className="text-slate-300">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t border-slate-200">
                <tr>
                  <td className="px-4 py-3 text-sm font-bold text-slate-900" colSpan={5}>Total</td>
                  <td className="px-3 py-3 text-right font-bold text-slate-900">{fmt(totalRevenue)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-900">{fmt(totalCmv)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : (
        <div className="card p-12 text-center">
          <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm font-medium">Nenhum produto vendido nos últimos {period} dias</p>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          O CMV é calculado com base nos custos cadastrados no cardápio. Acesse <strong>Cardápio → editar produto</strong> para
          informar o custo de produção de cada item. O CMV não inclui despesas operacionais (aluguel, energia, mão de obra).
        </p>
      </div>
    </div>
  );
}

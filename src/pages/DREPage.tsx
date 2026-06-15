import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { Order, MenuItem, FinancialEntry } from '../lib/types';
import { BarChart3, AlertCircle, Download } from 'lucide-react';

const fmt = (v: number, sign = false) => {
  const s = `R$ ${Math.abs(v).toFixed(2).replace('.', ',')}`;
  if (!sign) return s;
  return v >= 0 ? `+ ${s}` : `- ${s}`;
};
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

interface DREData {
  receitaBruta: number;
  descontos: number;
  receitaLiquida: number;
  cmv: number;
  lucroBruto: number;
  despesasOp: number;
  ebitda: number;
  impostos: number;
  lucroLiquido: number;
  ordersCount: number;
  avgTicket: number;
}

function calcDRE(orders: Order[], items: MenuItem[], expenses: FinancialEntry[]): DREData {
  const completed = orders.filter(o => ['PAID', 'DELIVERING', 'COMPLETED'].includes(o.status));
  const receitaBruta = completed.reduce((s, o) => s + o.total + o.discount, 0);
  const descontos    = completed.reduce((s, o) => s + o.discount, 0);
  const receitaLiquida = receitaBruta - descontos;

  // CMV calculation from menu item costs
  const costMap = new Map(items.map(i => [i.id, i.cost ?? 0]));
  const cmv = completed.reduce((sum, o) =>
    sum + o.items.reduce((s, it) => s + (costMap.get(it.menuItemId) ?? 0) * it.quantity, 0), 0);

  const lucroBruto = receitaLiquida - cmv;

  // Despesas operacionais (paid payables)
  const despesasOp = expenses
    .filter(e => e.type === 'payable' && (e.status === 'paid' || e.status === 'pending'))
    .reduce((s, e) => s + e.amount, 0);

  const ebitda = lucroBruto - despesasOp;

  // Simplified tax estimate (Simples Nacional ~6% on revenue)
  const impostos = receitaLiquida * 0.06;
  const lucroLiquido = ebitda - impostos;

  const ordersCount = completed.length;
  const avgTicket = ordersCount > 0 ? receitaLiquida / ordersCount : 0;

  return { receitaBruta, descontos, receitaLiquida, cmv, lucroBruto, despesasOp, ebitda, impostos, lucroLiquido, ordersCount, avgTicket };
}

function pct(value: number, base: number): string {
  if (base === 0) return '—';
  return fmtPct((value / base) * 100);
}

export default function DREPage() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<'month' | 'quarter' | 'year'>('month');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [dre, setDre] = useState<DREData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    setLoading(true);

    let from: Date;
    const now = new Date();
    if (period === 'month') {
      from = new Date(month + '-01');
    } else if (period === 'quarter') {
      from = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);
    } else {
      from = new Date(now.getFullYear(), 0, 1);
    }
    const to = period === 'month'
      ? new Date(new Date(month + '-01').setMonth(new Date(month + '-01').getMonth() + 1))
      : now;

    Promise.all([
      db.getOrders(user.id),
      db.getMenuItems(user.id),
      db.getFinancialEntries(user.id),
    ]).then(([orders, items, entries]) => {
      const filtered = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d >= from && d < to;
      });
      const filteredExp = entries.filter(e => {
        const d = new Date(e.dueDate + 'T00:00:00');
        return d >= from && d < to;
      });
      setDre(calcDRE(filtered, items, filteredExp));
      setLoading(false);
    });
  }, [user, period, month]);

  const downloadCSV = () => {
    if (!dre) return;
    const rows = [
      ['DRE — ZapMenu', `Período: ${month}`],
      [],
      ['Receita Bruta', dre.receitaBruta.toFixed(2)],
      ['(-) Descontos', dre.descontos.toFixed(2)],
      ['(=) Receita Líquida', dre.receitaLiquida.toFixed(2)],
      ['(-) CMV', dre.cmv.toFixed(2)],
      ['(=) Lucro Bruto', dre.lucroBruto.toFixed(2)],
      ['(-) Despesas Operacionais', dre.despesasOp.toFixed(2)],
      ['(=) EBITDA', dre.ebitda.toFixed(2)],
      ['(-) Impostos (estimado)', dre.impostos.toFixed(2)],
      ['(=) Lucro Líquido', dre.lucroLiquido.toFixed(2)],
      [],
      ['Nº de Pedidos', dre.ordersCount],
      ['Ticket Médio', dre.avgTicket.toFixed(2)],
    ];
    const csv = rows.map(r => r.join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `DRE-${month}.csv`;
    a.click();
  };

  const PERIOD_LABEL: Record<string, string> = { month: 'Mensal', quarter: 'Trimestral', year: 'Anual' };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BarChart3 size={22} className="text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">DRE — Demonstrativo de Resultado</h1>
            <p className="text-sm text-slate-500">Resultado financeiro consolidado do período</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {period === 'month' && (
            <input type="month" value={month} onChange={e => setMonth(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          )}
          <div className="flex rounded-xl overflow-hidden border border-slate-200">
            {(['month', 'quarter', 'year'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)}
                className={`px-3 py-2 text-xs font-medium ${period === p ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>
                {PERIOD_LABEL[p]}
              </button>
            ))}
          </div>
          <button onClick={downloadCSV} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">Calculando...</div>
      ) : !dre ? null : (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-xs text-emerald-600 font-medium uppercase tracking-wide">Receita Líquida</p>
              <p className="text-2xl font-bold text-emerald-700 mt-1">{fmt(dre.receitaLiquida)}</p>
              <p className="text-xs text-emerald-600 mt-1">{dre.ordersCount} pedidos · TM {fmt(dre.avgTicket)}</p>
            </div>
            <div className={`rounded-xl p-4 border ${dre.lucroLiquido >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${dre.lucroLiquido >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Lucro Líquido</p>
              <p className={`text-2xl font-bold mt-1 ${dre.lucroLiquido >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{fmt(dre.lucroLiquido)}</p>
              <p className={`text-xs mt-1 ${dre.lucroLiquido >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{pct(dre.lucroLiquido, dre.receitaLiquida)} da receita</p>
            </div>
            <div className={`rounded-xl p-4 border ${dre.ebitda >= 0 ? 'bg-violet-50 border-violet-200' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${dre.ebitda >= 0 ? 'text-violet-600' : 'text-red-600'}`}>EBITDA</p>
              <p className={`text-2xl font-bold mt-1 ${dre.ebitda >= 0 ? 'text-violet-700' : 'text-red-700'}`}>{fmt(dre.ebitda)}</p>
              <p className={`text-xs mt-1 ${dre.ebitda >= 0 ? 'text-violet-600' : 'text-red-600'}`}>{pct(dre.ebitda, dre.receitaLiquida)} da receita</p>
            </div>
          </div>

          {/* DRE Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[360px]">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-5 py-3 font-semibold text-slate-600">Linha</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">Valor</th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-600">% Receita</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { label: '(+) Receita Bruta de Vendas',      value: dre.receitaBruta,    indent: 0, total: false },
                  { label: '(−) Descontos e Cancelamentos',    value: -dre.descontos,      indent: 1, total: false },
                  { label: '(=) Receita Líquida',              value: dre.receitaLiquida,  indent: 0, total: true  },
                  { label: '(−) Custo da Mercadoria Vendida',  value: -dre.cmv,            indent: 1, total: false },
                  { label: '(=) Lucro Bruto',                  value: dre.lucroBruto,      indent: 0, total: true  },
                  { label: '(−) Despesas Operacionais',        value: -dre.despesasOp,     indent: 1, total: false },
                  { label: '(=) EBITDA',                       value: dre.ebitda,          indent: 0, total: true  },
                  { label: '(−) Impostos Estimados (6%)',      value: -dre.impostos,       indent: 1, total: false },
                  { label: '(=) Lucro Líquido',                value: dre.lucroLiquido,    indent: 0, total: true, highlight: true },
                ].map(({ label, value, indent, total, highlight }) => (
                  <tr key={label} className={`border-b border-slate-50 ${total ? 'bg-slate-50' : 'hover:bg-slate-50/50'}`}>
                    <td className={`px-5 py-3 ${indent ? 'pl-9 text-slate-500' : ''} ${total ? 'font-semibold text-slate-800' : ''} ${highlight ? 'font-bold text-slate-900' : ''}`}>
                      {label}
                    </td>
                    <td className={`px-5 py-3 text-right font-mono ${value < 0 ? 'text-red-600' : value > 0 ? 'text-slate-800' : 'text-slate-400'} ${total ? 'font-semibold' : ''} ${highlight ? 'font-bold text-lg' : ''}`}>
                      {fmt(value)}
                    </td>
                    <td className="px-5 py-3 text-right text-xs text-slate-400">
                      {pct(Math.abs(value), dre.receitaLiquida)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>{/* /overflow-x-auto */}
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
            <AlertCircle size={15} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Os impostos são estimados em 6% sobre a receita líquida (referência Simples Nacional). Para o valor real, consulte seu contador. O CMV usa o campo "Custo" cadastrado em cada item do cardápio.
            </p>
          </div>
        </>
      )}
    </div>
  );
}


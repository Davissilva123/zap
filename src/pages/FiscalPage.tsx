import { useEffect, useState, useMemo } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { Order } from '../lib/types';
import { AlertTriangle, Info, Calculator, TrendingUp, FileText, Calendar, Download, Building2, ExternalLink, ChevronDown, ChevronUp, Check, Pencil } from 'lucide-react';

type Regime = 'mei' | 'simples_i' | 'simples_ii' | 'simples_iii' | 'lucro_presumido';

const SIMPLES_I = [
  { min: 0,       max: 180000,  rate: 4.0,  deduction: 0 },
  { min: 180000,  max: 360000,  rate: 7.3,  deduction: 5940 },
  { min: 360000,  max: 720000,  rate: 9.5,  deduction: 13860 },
  { min: 720000,  max: 1800000, rate: 10.7, deduction: 22500 },
  { min: 1800000, max: 3600000, rate: 14.3, deduction: 87300 },
  { min: 3600000, max: 4800000, rate: 19.0, deduction: 378000 },
];
const SIMPLES_II = [
  { min: 0,       max: 180000,  rate: 4.5,  deduction: 0 },
  { min: 180000,  max: 360000,  rate: 7.8,  deduction: 5940 },
  { min: 360000,  max: 720000,  rate: 10.0, deduction: 13860 },
  { min: 720000,  max: 1800000, rate: 11.2, deduction: 22500 },
  { min: 1800000, max: 3600000, rate: 14.7, deduction: 85500 },
  { min: 3600000, max: 4800000, rate: 30.0, deduction: 720000 },
];
const SIMPLES_III = [
  { min: 0,       max: 180000,  rate: 6.0,  deduction: 0 },
  { min: 180000,  max: 360000,  rate: 11.2, deduction: 9360 },
  { min: 360000,  max: 720000,  rate: 13.5, deduction: 17640 },
  { min: 720000,  max: 1800000, rate: 16.0, deduction: 35640 },
  { min: 1800000, max: 3600000, rate: 21.0, deduction: 125640 },
  { min: 3600000, max: 4800000, rate: 33.0, deduction: 648000 },
];

type FaixaTable = typeof SIMPLES_I;
const TABLES: Record<string, FaixaTable> = {
  simples_i: SIMPLES_I,
  simples_ii: SIMPLES_II,
  simples_iii: SIMPLES_III,
};
const TABLE_NAMES: Record<string, string> = {
  simples_i: 'Simples Nacional — Anexo I (Comércio)',
  simples_ii: 'Simples Nacional — Anexo II (Indústria)',
  simples_iii: 'Simples Nacional — Anexo III (Serviços)',
};

const CNAE_RESTAURANTES = [
  { code: '5611-2/01', desc: 'Restaurantes e similares' },
  { code: '5611-2/03', desc: 'Lanchonetes, casas de chá, de sucos e similares' },
  { code: '5611-2/04', desc: 'Bares e outros estabelecimentos especializados em servir bebidas' },
  { code: '5612-1/00', desc: 'Serviços ambulantes de alimentação' },
  { code: '5620-1/01', desc: 'Fornecimento de alimentos preparados em refeitórios (empresas)' },
  { code: '5620-1/03', desc: 'Cantinas – serviços de alimentação (colégios/universidades)' },
];

const MEI_LIMIT = 81000;

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;
const fmtK = (v: number) =>
  v >= 1000 ? `R$ ${(v / 1000).toFixed(1).replace('.', ',')} mil` : `R$ ${v.toFixed(0)}`;

function formatCNPJ(v: string): string {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

function calcSimples(table: FaixaTable, rbt12: number) {
  if (rbt12 <= 0) return { aliqNominal: 0, aliqEfetiva: 0, imposto: 0 };
  const faixa = table.find(f => rbt12 > f.min && rbt12 <= f.max) ?? table[table.length - 1];
  const aliqEfetiva = Math.max(0, (rbt12 * faixa.rate / 100 - faixa.deduction) / rbt12) * 100;
  return { aliqNominal: faixa.rate, aliqEfetiva, imposto: rbt12 * aliqEfetiva / 100 };
}

function daysUntil(date: Date): number {
  return Math.ceil((date.getTime() - Date.now()) / 86400000);
}

function urgencyColor(days: number) {
  if (days < 0) return 'text-slate-400 bg-slate-50';
  if (days <= 5) return 'text-red-600 bg-red-50 border-red-200';
  if (days <= 15) return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-emerald-600 bg-emerald-50 border-emerald-200';
}

interface FiscalData {
  cnpj: string;
  ie: string;
  cnae: string;
  razaoSocial: string;
  regimeOficial: Regime | '';
}

const EMPTY_FISCAL: FiscalData = { cnpj: '', ie: '', cnae: '', razaoSocial: '', regimeOficial: '' };

export default function FiscalPage() {
  const { user } = useAuth();
  const [regime, setRegime] = useState<Regime>('simples_i');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [manualRbt12, setManualRbt12] = useState('');
  const [fiscalData, setFiscalData] = useState<FiscalData>(EMPTY_FISCAL);
  const [editingFiscal, setEditingFiscal] = useState(false);
  const [editDraft, setEditDraft] = useState<FiscalData>(EMPTY_FISCAL);
  const [showCnaeGuide, setShowCnaeGuide] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [relatorioAno, setRelatorioAno] = useState(new Date().getFullYear());

  useEffect(() => {
    if (!user) return;
    db.getOrders(user.id).then(o => { setOrders(o); setLoading(false); });
    const saved = localStorage.getItem(`zm_fiscal_${user.id}`);
    if (saved) {
      try { setFiscalData(JSON.parse(saved)); } catch { /* ignore */ }
    }
  }, [user]);

  const saveFiscal = () => {
    if (!user) return;
    setFiscalData(editDraft);
    localStorage.setItem(`zm_fiscal_${user.id}`, JSON.stringify(editDraft));
    setEditingFiscal(false);
    if (editDraft.regimeOficial) setRegime(editDraft.regimeOficial);
  };

  const startEdit = () => { setEditDraft(fiscalData); setEditingFiscal(true); };

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();

  const yearOrders = orders.filter(o => new Date(o.createdAt).getFullYear() === currentYear && o.status !== 'CANCELLED');
  const yearRevenue = yearOrders.reduce((s, o) => s + o.total, 0);
  const monthOrders = orders.filter(o => {
    const d = new Date(o.createdAt);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth && o.status !== 'CANCELLED';
  });
  const monthRevenue = monthOrders.reduce((s, o) => s + o.total, 0);

  const rbt12Parsed = parseFloat(manualRbt12.replace(',', '.')) * 1000;
  const rbt12 = !isNaN(rbt12Parsed) && rbt12Parsed > 0 ? rbt12Parsed : yearRevenue;

  const taxResult = useMemo(() => {
    if (regime === 'mei') return { monthly: 75.90, annual: 910.80, aliqEfetiva: null, aliqNominal: null };
    if (regime === 'lucro_presumido') {
      const baseLucro = rbt12 * 0.08;
      const irpj = baseLucro * 0.15 + Math.max(0, baseLucro - 20000 * 12) * 0.10;
      const csll = rbt12 * 0.12 * 0.09;
      const pis = rbt12 * 0.0065;
      const cofins = rbt12 * 0.03;
      const total = irpj + csll + pis + cofins;
      return { monthly: total / 12, annual: total, aliqEfetiva: rbt12 > 0 ? (total / rbt12) * 100 : 0, aliqNominal: null };
    }
    if (TABLES[regime]) {
      const r = calcSimples(TABLES[regime], rbt12);
      return { monthly: r.imposto / 12, annual: r.imposto, aliqEfetiva: r.aliqEfetiva, aliqNominal: r.aliqNominal };
    }
    return { monthly: 0, annual: 0, aliqEfetiva: 0, aliqNominal: 0 };
  }, [regime, rbt12]);

  const meiUsedPct = Math.min(100, (yearRevenue / MEI_LIMIT) * 100);

  // ---- Calendário de obrigações ----
  const obrigacoes = useMemo(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = today.getMonth();
    const list: { label: string; desc: string; date: Date; link?: string }[] = [];

    // DAS mensal (dia 20 de cada mês)
    for (let i = 0; i <= 2; i++) {
      const d = new Date(y, m + i, 20);
      list.push({
        label: `DAS — ${d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`,
        desc: 'Pagamento mensal do DAS (Documento de Arrecadação do Simples/MEI)',
        date: d,
        link: 'https://www8.receita.fazenda.gov.br/SimplesNacional/',
      });
    }
    // DASN-SIMEI (MEI anual — até 31/05 do ano seguinte, mas declaração abre em jan)
    const dasnDate = new Date(y + 1, 4, 31); // 31/maio do próximo ano
    list.push({
      label: `DASN-SIMEI ${y + 1}`,
      desc: 'Declaração Anual do MEI referente ao ano anterior — vence 31/05',
      date: dasnDate,
      link: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor/servicos-para-mei/declaracao-anual-dasn-simei',
    });
    // DEFIS (Simples Nacional — vence 31/03)
    const defisDate = new Date(y + 1, 2, 31);
    list.push({
      label: `DEFIS ${y + 1}`,
      desc: 'Declaração de Informações Socioeconômicas e Fiscais (Simples Nacional) — vence 31/03',
      date: defisDate,
      link: 'https://www8.receita.fazenda.gov.br/SimplesNacional/',
    });

    return list
      .filter(o => daysUntil(o.date) >= -30) // mostra até 30 dias após o vencimento
      .sort((a, b) => a.date.getTime() - b.date.getTime())
      .slice(0, 6);
  }, []);

  // ---- Relatório mensal para contador ----
  const monthlyBreakdown = useMemo(() => {
    const months: { key: string; label: string; revenue: number; cancelled: number; count: number; cancelledCount: number }[] = [];
    for (let m = 0; m <= 11; m++) {
      const key = `${relatorioAno}-${String(m + 1).padStart(2, '0')}`;
      const label = new Date(relatorioAno, m, 1).toLocaleDateString('pt-BR', { month: 'long' });
      const mOrders = orders.filter(o => {
        const d = new Date(o.createdAt);
        return d.getFullYear() === relatorioAno && d.getMonth() === m;
      });
      const paidOrders = mOrders.filter(o => o.status !== 'CANCELLED');
      const cancelledOrders = mOrders.filter(o => o.status === 'CANCELLED');
      months.push({
        key, label,
        revenue: paidOrders.reduce((s, o) => s + o.total, 0),
        cancelled: cancelledOrders.reduce((s, o) => s + o.total, 0),
        count: paidOrders.length,
        cancelledCount: cancelledOrders.length,
      });
    }
    return months;
  }, [orders, relatorioAno]);

  const totalRelatorio = monthlyBreakdown.reduce((s, m) => s + m.revenue, 0);

  const downloadCsvContador = () => {
    const header = ['Mês', 'Pedidos', 'Faturamento (R$)', 'Cancelamentos (R$)', 'Líquido (R$)'];
    const rows = monthlyBreakdown.map(m => [
      m.label,
      m.count.toString(),
      m.revenue.toFixed(2).replace('.', ','),
      m.cancelled.toFixed(2).replace('.', ','),
      (m.revenue - m.cancelled).toFixed(2).replace('.', ','),
    ]);
    rows.push(['TOTAL', monthlyBreakdown.reduce((s, m) => s + m.count, 0).toString(),
      totalRelatorio.toFixed(2).replace('.', ','),
      monthlyBreakdown.reduce((s, m) => s + m.cancelled, 0).toFixed(2).replace('.', ','),
      totalRelatorio.toFixed(2).replace('.', ',')]);
    const csv = [header, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `faturamento_${relatorioAno}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const gerarPdfContador = () => {
    const razao = fiscalData.razaoSocial || 'Restaurante';
    const cnpjStr = fiscalData.cnpj ? `CNPJ: ${fiscalData.cnpj}` : '';
    const ieStr = fiscalData.ie ? ` | IE: ${fiscalData.ie}` : '';
    const rows = monthlyBreakdown.map(m => `
      <tr class="${m.revenue > 0 ? '' : 'empty'}">
        <td>${m.label.charAt(0).toUpperCase() + m.label.slice(1)}</td>
        <td>${m.count}</td>
        <td>${fmt(m.revenue)}</td>
        <td>${m.cancelled > 0 ? fmt(m.cancelled) : '—'}</td>
        <td class="total">${fmt(m.revenue)}</td>
      </tr>`).join('');

    const html = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8">
<title>Faturamento ${relatorioAno} — ${razao}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{font-family:Arial,sans-serif;font-size:13px;color:#111;padding:32px}
  .header{margin-bottom:24px}
  h1{font-size:20px;font-weight:700;color:#0f172a}
  .sub{color:#64748b;font-size:12px;margin-top:4px}
  table{width:100%;border-collapse:collapse;margin-top:16px}
  th{background:#0f172a;color:#fff;padding:10px 12px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.05em}
  td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:13px}
  tr:hover td{background:#f8fafc}
  tr.empty td{color:#94a3b8}
  td.total{font-weight:700}
  .footer-row td{background:#f1f5f9;font-weight:700;border-top:2px solid #0f172a}
  .footer{margin-top:24px;font-size:11px;color:#94a3b8;border-top:1px solid #e2e8f0;padding-top:12px}
  .toolbar{position:fixed;top:12px;right:12px;display:flex;gap:8px}
  .btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none}
  .btn-primary{background:#10b981;color:#fff}
  .btn-secondary{background:#f1f5f9;color:#374151;border:1px solid #e2e8f0}
  @media print{.toolbar{display:none}}
</style></head><body>
<div class="toolbar">
  <button class="btn btn-secondary" onclick="window.close()">Fechar</button>
  <button class="btn btn-primary" onclick="window.print()">Salvar como PDF</button>
</div>
<div class="header">
  <h1>Relatório de Faturamento — ${relatorioAno}</h1>
  <div class="sub">${razao}${cnpjStr ? ' | ' + cnpjStr : ''}${ieStr}</div>
  <div class="sub">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
</div>
<table>
  <thead><tr><th>Mês</th><th>Pedidos</th><th>Faturamento</th><th>Cancelamentos</th><th>Líquido</th></tr></thead>
  <tbody>${rows}</tbody>
  <tfoot><tr class="footer-row">
    <td>TOTAL ${relatorioAno}</td>
    <td>${monthlyBreakdown.reduce((s, m) => s + m.count, 0)}</td>
    <td>${fmt(totalRelatorio)}</td>
    <td>${fmt(monthlyBreakdown.reduce((s, m) => s + m.cancelled, 0))}</td>
    <td class="total">${fmt(totalRelatorio)}</td>
  </tr></tfoot>
</table>
<div class="footer">Relatório gerado pelo sistema ZapMenu. Valores baseados nos pedidos registrados no sistema.</div>
</body></html>`;

    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
  };

  const REGIME_OPTIONS: { value: Regime; label: string }[] = [
    { value: 'mei', label: 'MEI' },
    { value: 'simples_i', label: 'Simples I — Comércio' },
    { value: 'simples_ii', label: 'Simples II — Indústria' },
    { value: 'simples_iii', label: 'Simples III — Serviços' },
    { value: 'lucro_presumido', label: 'Lucro Presumido' },
  ];

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
    </div>
  );

  const hasFiscalData = fiscalData.cnpj || fiscalData.razaoSocial || fiscalData.ie;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Fiscal</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Referência tributária, obrigações e relatórios para contabilidade</p>
      </div>

      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          <strong>Módulo informativo.</strong> Os cálculos são estimativas com base em alíquotas públicas de 2023.
          Consulte sempre um contador para obter valores exatos e cumprir suas obrigações fiscais.
        </p>
      </div>

      {/* ---- Dados fiscais ---- */}
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-500" /> Dados Fiscais do Restaurante
          </h2>
          {!editingFiscal && (
            <button onClick={startEdit} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> {hasFiscalData ? 'Editar' : 'Preencher'}
            </button>
          )}
        </div>

        {editingFiscal ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Razão Social / Nome</label>
                <input
                  value={editDraft.razaoSocial}
                  onChange={e => setEditDraft(p => ({ ...p, razaoSocial: e.target.value }))}
                  placeholder="Nome ou Razão Social"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">CNPJ</label>
                <input
                  value={editDraft.cnpj}
                  onChange={e => setEditDraft(p => ({ ...p, cnpj: formatCNPJ(e.target.value) }))}
                  placeholder="00.000.000/0001-00"
                  maxLength={18}
                  className="input-field w-full font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Inscrição Estadual</label>
                <input
                  value={editDraft.ie}
                  onChange={e => setEditDraft(p => ({ ...p, ie: e.target.value }))}
                  placeholder="Número da IE (ou ISENTO)"
                  className="input-field w-full"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">CNAE Principal</label>
                <input
                  value={editDraft.cnae}
                  onChange={e => setEditDraft(p => ({ ...p, cnae: e.target.value }))}
                  placeholder="Ex: 5611-2/01"
                  className="input-field w-full font-mono"
                />
                <button
                  type="button"
                  onClick={() => setShowCnaeGuide(s => !s)}
                  className="text-[11px] text-emerald-600 hover:underline mt-1"
                >
                  Ver CNAEs comuns para restaurantes
                </button>
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">Regime Tributário Oficial</label>
                <div className="flex flex-wrap gap-2">
                  {REGIME_OPTIONS.map(({ value, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEditDraft(p => ({ ...p, regimeOficial: value }))}
                      className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors border ${editDraft.regimeOficial === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {showCnaeGuide && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-100">
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wider">CNAEs comuns — Alimentação</p>
                <div className="space-y-1">
                  {CNAE_RESTAURANTES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setEditDraft(p => ({ ...p, cnae: c.code })); setShowCnaeGuide(false); }}
                      className="w-full flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-white text-left transition-colors"
                    >
                      <span className="text-[12px] text-slate-700">{c.desc}</span>
                      <span className="text-[11px] font-mono font-bold text-emerald-600 ml-3 flex-shrink-0">{c.code}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <button onClick={saveFiscal} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 transition-colors">
                <Check className="w-3.5 h-3.5" /> Salvar
              </button>
              <button onClick={() => setEditingFiscal(false)} className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        ) : hasFiscalData ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {fiscalData.razaoSocial && (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Razão Social</p>
                <p className="text-sm font-semibold text-slate-800">{fiscalData.razaoSocial}</p>
              </div>
            )}
            {fiscalData.cnpj && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">CNPJ</p>
                <p className="text-sm font-mono font-semibold text-slate-800">{fiscalData.cnpj}</p>
              </div>
            )}
            {fiscalData.ie && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Ins. Estadual</p>
                <p className="text-sm font-semibold text-slate-800">{fiscalData.ie}</p>
              </div>
            )}
            {fiscalData.cnae && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">CNAE</p>
                <p className="text-sm font-mono font-semibold text-slate-800">{fiscalData.cnae}</p>
              </div>
            )}
            {fiscalData.regimeOficial && (
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Regime</p>
                <p className="text-sm font-semibold text-slate-800">{REGIME_OPTIONS.find(r => r.value === fiscalData.regimeOficial)?.label}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-slate-400 py-2">Nenhum dado fiscal cadastrado. Clique em "Preencher" para adicionar CNPJ, IE, CNAE e regime tributário.</p>
        )}
      </div>

      {/* ---- Receita + MEI ---- */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Receita {currentYear}</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmtK(yearRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{yearOrders.length} pedidos</p>
        </div>
        <div className="card p-4">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Receita este mês</p>
          <p className="text-2xl font-black text-slate-900 tracking-tight">{fmtK(monthRevenue)}</p>
          <p className="text-xs text-slate-400 mt-1">{monthOrders.length} pedidos</p>
        </div>
        <div className="card p-4 col-span-2 md:col-span-1">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Limite MEI usado</p>
          <p className={`text-2xl font-black tracking-tight ${meiUsedPct > 80 ? 'text-red-600' : meiUsedPct > 60 ? 'text-amber-600' : 'text-emerald-600'}`}>
            {meiUsedPct.toFixed(0)}%
          </p>
          <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div className={`h-full rounded-full transition-all ${meiUsedPct > 80 ? 'bg-red-500' : meiUsedPct > 60 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${meiUsedPct}%` }} />
          </div>
          <p className="text-[10px] text-slate-400 mt-1">{fmtK(yearRevenue)} de {fmtK(MEI_LIMIT)}/ano</p>
        </div>
      </div>

      {yearRevenue > MEI_LIMIT * 0.8 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-2xl">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <p className="text-sm text-amber-800">
            <strong>Atenção:</strong> Receita próxima ao limite MEI (R$ 81.000/ano).
            Planeje a transição de regime com seu contador antes de ultrapassar o limite.
          </p>
        </div>
      )}

      {/* ---- Calendário de obrigações ---- */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calendar className="w-4 h-4 text-emerald-500" /> Calendário de Obrigações
        </h2>
        <div className="space-y-2">
          {obrigacoes.map((o, i) => {
            const days = daysUntil(o.date);
            const color = urgencyColor(days);
            return (
              <div key={i} className={`flex items-start justify-between gap-3 p-3 rounded-xl border ${color}`}>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{o.label}</p>
                  <p className="text-xs opacity-70 mt-0.5">{o.desc}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="text-right">
                    <p className="text-xs font-bold">{o.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    <p className="text-[10px] font-semibold mt-0.5">
                      {days < 0 ? `${Math.abs(days)}d atrás` : days === 0 ? 'Hoje!' : `em ${days}d`}
                    </p>
                  </div>
                  {o.link && (
                    <a href={o.link} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-white/50 hover:bg-white transition-colors">
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400 mt-3 flex items-center gap-1">
          <Info className="w-3.5 h-3.5" /> Datas aproximadas. Verifique prazos exatos no portal da Receita Federal.
        </p>
      </div>

      {/* ---- Relatório para contador ---- */}
      <div className="card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-500" /> Relatório de Faturamento para Contador
          </h2>
          <div className="flex items-center gap-2">
            <select
              value={relatorioAno}
              onChange={e => setRelatorioAno(Number(e.target.value))}
              className="input-field text-sm py-1.5 pr-8"
            >
              {[currentYear - 1, currentYear, currentYear + 1].filter(y => y <= currentYear).map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={downloadCsvContador} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={gerarPdfContador} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition-colors">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="text-left px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Mês</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Pedidos</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Faturamento</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Cancelamentos</th>
                <th className="text-right px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Líquido</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {monthlyBreakdown.map(m => (
                <tr key={m.key} className={`transition-colors ${m.revenue > 0 ? 'hover:bg-slate-50/50' : ''}`}>
                  <td className="px-3 py-2.5 capitalize text-slate-700 font-medium">{m.label}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{m.count > 0 ? m.count : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{m.revenue > 0 ? fmt(m.revenue) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right text-red-500">{m.cancelled > 0 ? fmt(m.cancelled) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-3 py-2.5 text-right font-bold text-slate-900">{m.revenue > 0 ? fmt(m.revenue) : <span className="text-slate-300">—</span>}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t-2 border-slate-200">
              <tr>
                <td className="px-3 py-3 font-bold text-slate-900">TOTAL {relatorioAno}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-900">{monthlyBreakdown.reduce((s, m) => s + m.count, 0)}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-900">{fmt(totalRelatorio)}</td>
                <td className="px-3 py-3 text-right font-bold text-red-500">{fmt(monthlyBreakdown.reduce((s, m) => s + m.cancelled, 0))}</td>
                <td className="px-3 py-3 text-right font-black text-slate-900 text-base">{fmt(totalRelatorio)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ---- Calculadora ---- */}
      <div className="card p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-emerald-500" /> Calculadora de Impostos
        </h2>
        <div className="flex flex-wrap gap-2 mb-5">
          {REGIME_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setRegime(value)}
              className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-colors border ${regime === value ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
              Receita bruta anual (RBT12) — base para cálculo
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">R$</span>
              <input
                type="number"
                value={manualRbt12}
                onChange={e => setManualRbt12(e.target.value)}
                placeholder={`${(yearRevenue / 1000).toFixed(1)} (do sistema)`}
                className="input-field pl-9 w-full"
                min="0" step="0.1"
              />
              <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-medium">mil</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">Deixe em branco para usar a receita registrada ({fmtK(yearRevenue)})</p>
          </div>
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            {regime === 'mei' ? (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">DAS mensal (estimado)</span>
                  <span className="font-bold text-slate-900">{fmt(taxResult.monthly)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">DAS anual (estimado)</span>
                  <span className="font-bold text-slate-900">{fmt(taxResult.annual)}</span>
                </div>
                <div className="pt-2 border-t border-slate-200">
                  <p className="text-xs text-slate-400">Inclui INSS + ICMS. Verifique o DAS atual no Portal do Empreendedor (gov.br).</p>
                </div>
              </>
            ) : (
              <>
                {taxResult.aliqNominal != null && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-600">Alíquota nominal</span>
                    <span className="font-bold text-slate-900">{taxResult.aliqNominal.toFixed(1)}%</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Alíquota efetiva</span>
                  <span className="font-bold text-slate-900">{taxResult.aliqEfetiva?.toFixed(2) ?? '—'}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-600">Imposto mensal médio</span>
                  <span className="font-bold text-slate-900">{fmt(taxResult.monthly)}</span>
                </div>
                <div className="flex justify-between text-sm border-t border-slate-200 pt-3">
                  <span className="text-slate-800 font-semibold">Imposto anual estimado</span>
                  <span className="font-black text-slate-900 text-base">{fmt(taxResult.annual)}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ---- Tabela Simples ---- */}
      {TABLES[regime] && (
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowTable(s => !s)}
            className="w-full flex items-center justify-between px-4 py-3 border-b border-slate-100 hover:bg-slate-50/50 transition-colors"
          >
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-500" /> {TABLE_NAMES[regime]}
            </h2>
            {showTable ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {showTable && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Faixa RBT12</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Alíq. nominal</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Parcela a deduzir</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {TABLES[regime].map((f, i) => {
                    const isActive = rbt12 > f.min && rbt12 <= f.max;
                    return (
                      <tr key={i} className={`transition-colors ${isActive ? 'bg-emerald-50' : 'hover:bg-slate-50/50'}`}>
                        <td className="px-4 py-2.5 text-slate-700">
                          {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2 align-middle" />}
                          {fmtK(f.min)} até {fmtK(f.max)}
                          {isActive && <span className="ml-2 text-[10px] font-bold text-emerald-600 bg-emerald-100 px-1.5 py-0.5 rounded-full">sua faixa</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right font-semibold text-slate-800">{f.rate.toFixed(1)}%</td>
                        <td className="px-4 py-2.5 text-right text-slate-600">{f.deduction > 0 ? fmtK(f.deduction) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {regime === 'mei' && (
        <div className="card p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" /> Limites MEI {currentYear}
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Limite anual', value: 'R$ 81.000' },
              { label: 'Média mensal', value: 'R$ 6.750' },
              { label: 'Empregados', value: '1 funcionário' },
              { label: 'DAS aprox.', value: 'R$ 75,90/mês' },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3 text-center">
                <p className="text-xs text-slate-500 font-medium mb-1">{item.label}</p>
                <p className="text-sm font-black text-slate-900">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- NFC-e / NF-e ---- */}
      <div className="card p-5 space-y-4">
        <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <FileText className="w-4 h-4 text-emerald-500" /> NFC-e e NF-e — Nota Fiscal Eletrônica
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
            <p className="text-sm font-bold text-blue-900 mb-2">NFC-e — Nota Fiscal do Consumidor</p>
            <ul className="text-xs text-blue-700 space-y-1.5 list-disc ml-4">
              <li>Obrigatória para venda direta ao consumidor final na maioria dos estados</li>
              <li>Emitida no ato da venda (balcão, delivery, mesa)</li>
              <li>Exige certificado digital e credenciamento junto à SEFAZ do seu estado</li>
              <li>Pode ser emitida por softwares fiscais homologados</li>
            </ul>
          </div>
          <div className="bg-violet-50 border border-violet-100 rounded-xl p-4">
            <p className="text-sm font-bold text-violet-900 mb-2">NF-e — Nota Fiscal de Produto</p>
            <ul className="text-xs text-violet-700 space-y-1.5 list-disc ml-4">
              <li>Usada em transferências entre empresas e notas de entrada de mercadoria</li>
              <li>Necessária para compras de fornecedores (insumos, bebidas, embalagens)</li>
              <li>Exige certificado digital A1 ou A3</li>
              <li>Validade do certificado digital: verifique a data de vencimento regularmente</li>
            </ul>
          </div>
        </div>
        <div className="bg-slate-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">Links úteis</p>
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Portal SEFAZ Nacional', href: 'https://www.nfe.fazenda.gov.br' },
              { label: 'Portal do Empreendedor (MEI)', href: 'https://www.gov.br/empresas-e-negocios/pt-br/empreendedor' },
              { label: 'Simples Nacional', href: 'https://www8.receita.fazenda.gov.br/SimplesNacional/' },
              { label: 'e-CAC (Receita Federal)', href: 'https://cav.receita.fazenda.gov.br/autenticacao/login' },
            ].map(link => (
              <a
                key={link.label}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> {link.label}
              </a>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 bg-amber-50 rounded-xl border border-amber-100">
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-700">
            A emissão de NFC-e/NF-e requer sistema fiscal homologado pela SEFAZ.
            Este módulo do ZapMenu não emite documentos fiscais — contrate um software fiscal ou consulte seu contador.
          </p>
        </div>
      </div>

      {regime === 'lucro_presumido' && (
        <div className="card p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-blue-500" /> Composição — Lucro Presumido
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Base IRPJ', value: '8% da receita', note: 'comércio/indústria' },
              { label: 'IRPJ', value: '15% + 10% adicional', note: 'sobre lucro presumido' },
              { label: 'CSLL', value: '9%', note: 'sobre 12% da receita' },
              { label: 'PIS + COFINS', value: '0,65% + 3%', note: 'regime cumulativo' },
            ].map(item => (
              <div key={item.label} className="bg-slate-50 rounded-xl p-3">
                <p className="text-xs text-slate-500 font-medium mb-1">{item.label}</p>
                <p className="text-sm font-bold text-slate-900">{item.value}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-start gap-2 text-xs text-slate-400 bg-slate-50 p-3 rounded-xl border border-slate-100">
        <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
        <p>
          Estimativas baseadas em alíquotas públicas vigentes em 2023. Consulte o portal e-CAC,
          Receita Federal e um profissional contábil para apuração oficial.
          Este módulo não substitui obrigações acessórias (DASN, DEFIS, EFD, DCTF, etc.).
        </p>
      </div>
    </div>
  );
}

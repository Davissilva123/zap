import type { Order } from './types';

const fmt = (v: number) =>
  'R$ ' + v.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
const fmtDT = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

const PAY: Record<string, string> = {
  pix: 'PIX',
  credit_card: 'Cartão de Crédito',
  debit_card: 'Cartão de Débito',
  cash: 'Dinheiro',
  meal_voucher: 'Vale-Refeição',
};

const DELIVERY: Record<string, string> = {
  delivery: 'Delivery',
  pickup: 'Retirada',
  dine_in: 'Mesa',
};

export interface ReportCtx {
  restaurantName: string;
  period: string;
  rangeOrders: Order[];       // pedidos do período (sem cancelados)
  allPeriodOrders: Order[];   // todos do período (com cancelados)
  allOrders: Order[];         // todos os pedidos (histórico completo)
}

export function openReport(html: string) {
  const w = window.open('', '_blank');
  if (!w) { alert('Permita pop-ups neste site para gerar relatórios em PDF.'); return; }
  w.document.write(html);
  w.document.close();
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(';'))
    .join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── CSS base embutido nos relatórios ────────────────────────────────────────
const CSS = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f8fafc;color:#1e293b;font-size:13px}.page{max-width:900px;margin:0 auto;padding:28px 24px}.toolbar{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;gap:10px;flex-wrap:wrap}.btn{display:inline-flex;align-items:center;gap:6px;padding:9px 18px;border-radius:10px;border:none;cursor:pointer;font-weight:600;font-size:13px}.btn-green{background:#10b981;color:#fff}.btn-green:hover{background:#059669}.btn-gray{background:#fff;color:#64748b;border:1px solid #e2e8f0}.btn-gray:hover{background:#f1f5f9}.doc-header{border-bottom:2px solid #0f172a;padding-bottom:16px;margin-bottom:24px}.doc-header h1{font-size:20px;font-weight:800;color:#0f172a}.doc-header p{font-size:12px;color:#64748b;margin-top:4px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px;margin-bottom:24px}.kpi{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px}.kpi-label{font-size:10px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px}.kpi-value{font-size:20px;font-weight:800;color:#0f172a}.kpi-sub{font-size:11px;color:#94a3b8;margin-top:2px}.section{background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:16px 18px;margin-bottom:16px}.sec-title{font-size:13px;font-weight:700;color:#0f172a;margin-bottom:12px;padding-bottom:8px;border-bottom:1px solid #f1f5f9}table{width:100%;border-collapse:collapse}th{background:#f8fafc;text-align:left;padding:8px 10px;font-size:10px;font-weight:700;color:#64748b;text-transform:uppercase;letter-spacing:.04em;border-bottom:1px solid #e2e8f0}td{padding:8px 10px;border-bottom:1px solid #f8fafc;font-size:12px}tr:last-child td{border-bottom:none}.bar-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}.bar-label{min-width:120px;font-size:11px;color:#475569;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.bar-track{flex:1;height:8px;background:#f1f5f9;border-radius:999px;overflow:hidden}.bar-fill{height:100%;border-radius:999px}.bar-val{min-width:90px;text-align:right;font-size:11px;font-weight:600}.note{background:#fffbeb;border:1px solid #fde68a;border-radius:8px;padding:10px 12px;font-size:11px;color:#92400e;margin-bottom:16px}.tfoot-total{font-weight:700;background:#f8fafc}.footer-doc{text-align:center;font-size:10px;color:#94a3b8;margin-top:28px;padding-top:16px;border-top:1px solid #e2e8f0}@media print{body{background:#fff}.toolbar{display:none!important}.page{padding:16px}.section{break-inside:avoid}table{break-inside:avoid}}`;

function base(title: string, name: string, period: string, body: string): string {
  return `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>${title} — ${name}</title><style>${CSS}</style></head><body><div class="page"><div class="toolbar"><div><strong style="font-size:15px;color:#0f172a">⚡ ZapMenu</strong></div><div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn-gray" onclick="window.close()">✕ Fechar</button><button class="btn btn-green" onclick="window.print()">🖨 Salvar como PDF</button></div></div><div class="doc-header"><h1>${title}</h1><p>${name} &nbsp;·&nbsp; ${period}</p></div>${body}<div class="footer-doc">Gerado pelo ZapMenu em ${new Date().toLocaleString('pt-BR', { dateStyle: 'long', timeStyle: 'short' })} · Uso interno / contabilidade</div></div></body></html>`;
}

function bars(items: { label: string; value: number; max: number; sub?: string; color?: string }[]) {
  return items.map(i => `
    <div class="bar-row">
      <div class="bar-label" title="${i.label}">${i.label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${i.max > 0 ? Math.round((i.value / i.max) * 100) : 0}%;background:${i.color ?? '#10b981'}"></div></div>
      <div class="bar-val">${i.sub ?? String(i.value)}</div>
    </div>`).join('');
}

// ─── 1. Faturamento do Período ────────────────────────────────────────────────
export function reportFaturamento(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders, allPeriodOrders } = ctx;
  const totalRev = rangeOrders.reduce((s, o) => s + o.total, 0);
  const avgTicket = rangeOrders.length ? totalRev / rangeOrders.length : 0;
  const cancelled = allPeriodOrders.filter(o => o.status === 'CANCELLED');
  const cancRate = allPeriodOrders.length ? (cancelled.length / allPeriodOrders.length * 100).toFixed(1) : '0.0';

  const byDay: Record<string, { rev: number; count: number }> = {};
  rangeOrders.forEach(o => {
    const d = o.createdAt.slice(0, 10);
    if (!byDay[d]) byDay[d] = { rev: 0, count: 0 };
    byDay[d].rev += o.total; byDay[d].count++;
  });
  const dayRows = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
    .map(([d, { rev, count }]) => `<tr><td>${fmtDate(d)}</td><td style="text-align:center">${count}</td><td style="text-align:right;font-weight:600">${fmt(rev)}</td><td style="text-align:right;color:#64748b">${fmt(count ? rev / count : 0)}</td></tr>`)
    .join('');

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Faturamento</div><div class="kpi-value">${fmt(totalRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Pedidos</div><div class="kpi-value">${rangeOrders.length}</div></div>
      <div class="kpi"><div class="kpi-label">Ticket Médio</div><div class="kpi-value">${fmt(avgTicket)}</div></div>
      <div class="kpi"><div class="kpi-label">Cancelamentos</div><div class="kpi-value">${cancelled.length}</div><div class="kpi-sub">${cancRate}% do total</div></div>
    </div>
    <div class="section">
      <div class="sec-title">Faturamento diário</div>
      <table><thead><tr><th>Data</th><th style="text-align:center">Pedidos</th><th style="text-align:right">Faturamento</th><th style="text-align:right">Ticket Médio</th></tr></thead>
      <tbody>${dayRows || '<tr><td colspan="4" style="color:#94a3b8;text-align:center;padding:20px">Nenhum pedido no período</td></tr>'}</tbody>
      <tfoot><tr class="tfoot-total"><td>TOTAL</td><td style="text-align:center">${rangeOrders.length}</td><td style="text-align:right;color:#10b981">${fmt(totalRev)}</td><td style="text-align:right">${fmt(avgTicket)}</td></tr></tfoot>
      </table>
    </div>`;
  return base('Relatório de Faturamento', restaurantName, period, body);
}

// ─── 2. Produtos Mais Vendidos ────────────────────────────────────────────────
export function reportProdutos(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders } = ctx;
  const map: Record<string, { name: string; qty: number; revenue: number }> = {};
  rangeOrders.forEach(o => o.items.forEach(i => {
    if (!map[i.menuItemId]) map[i.menuItemId] = { name: i.name, qty: 0, revenue: 0 };
    map[i.menuItemId].qty += i.quantity;
    map[i.menuItemId].revenue += i.price * i.quantity;
  }));
  const products = Object.values(map).sort((a, b) => b.qty - a.qty);
  const maxQty = products[0]?.qty ?? 1;
  const totalRev = rangeOrders.reduce((s, o) => s + o.total, 0);

  const tableRows = products.slice(0, 20).map((p, i) => `
    <tr>
      <td style="color:#64748b;font-weight:700">${i + 1}</td>
      <td>${p.name}</td>
      <td style="text-align:center;font-weight:600">${p.qty}</td>
      <td style="text-align:right">${fmt(p.revenue)}</td>
      <td style="text-align:right;color:#64748b">${totalRev > 0 ? Math.round(p.revenue / totalRev * 100) : 0}%</td>
    </tr>`).join('');

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Itens no ranking</div><div class="kpi-value">${products.length}</div></div>
      <div class="kpi"><div class="kpi-label">Unidades vendidas</div><div class="kpi-value">${products.reduce((s, p) => s + p.qty, 0)}</div></div>
      <div class="kpi"><div class="kpi-label">Mais vendido</div><div class="kpi-value" style="font-size:14px">${products[0]?.name ?? '—'}</div><div class="kpi-sub">${products[0]?.qty ?? 0} unidades</div></div>
    </div>
    <div class="section">
      <div class="sec-title">Ranking por quantidade vendida</div>
      ${bars(products.slice(0, 15).map(p => ({ label: p.name, value: p.qty, max: maxQty, sub: `${p.qty}x · ${fmt(p.revenue)}`, color: '#10b981' })))}
    </div>
    <div class="section">
      <div class="sec-title">Top 20 produtos — detalhado</div>
      <table><thead><tr><th>#</th><th>Produto</th><th style="text-align:center">Qtd</th><th style="text-align:right">Receita</th><th style="text-align:right">% do total</th></tr></thead>
      <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  return base('Produtos Mais Vendidos', restaurantName, period, body);
}

// ─── 3. Horário de Pico ───────────────────────────────────────────────────────
export function reportHorarioPico(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders } = ctx;
  const byHour: Record<number, number> = {};
  const byWeekday: Record<number, number> = {};
  rangeOrders.forEach(o => {
    const d = new Date(o.createdAt);
    byHour[d.getHours()] = (byHour[d.getHours()] || 0) + 1;
    byWeekday[d.getDay()] = (byWeekday[d.getDay()] || 0) + 1;
  });
  const maxH = Math.max(...Object.values(byHour), 1);
  const maxW = Math.max(...Object.values(byWeekday), 1);
  const DAYS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
  const peakHour = Object.entries(byHour).sort(([, a], [, b]) => b - a)[0];
  const peakDay = Object.entries(byWeekday).sort(([, a], [, b]) => b - a)[0];

  const hourBars = Array.from({ length: 24 }, (_, h) => ({
    label: `${h}h`,
    value: byHour[h] || 0,
    max: maxH,
    sub: `${byHour[h] || 0} pedidos`,
    color: byHour[h] >= maxH * 0.7 ? '#ef4444' : byHour[h] >= maxH * 0.4 ? '#f59e0b' : '#3b82f6',
  }));

  const weekBars = Array.from({ length: 7 }, (_, d) => ({
    label: DAYS[d],
    value: byWeekday[d] || 0,
    max: maxW,
    sub: `${byWeekday[d] || 0} pedidos`,
    color: '#6366f1',
  }));

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Hora de pico</div><div class="kpi-value">${peakHour ? `${peakHour[0]}h` : '—'}</div><div class="kpi-sub">${peakHour?.[1] ?? 0} pedidos</div></div>
      <div class="kpi"><div class="kpi-label">Dia mais movido</div><div class="kpi-value" style="font-size:15px">${peakDay ? DAYS[Number(peakDay[0])] : '—'}</div></div>
      <div class="kpi"><div class="kpi-label">Total de pedidos</div><div class="kpi-value">${rangeOrders.length}</div></div>
    </div>
    <div class="section"><div class="sec-title">Pedidos por hora do dia</div>${bars(hourBars)}</div>
    <div class="section"><div class="sec-title">Pedidos por dia da semana</div>${bars(weekBars)}</div>`;
  return base('Análise de Horário de Pico', restaurantName, period, body);
}

// ─── 4. Clientes Novos vs. Recorrentes ───────────────────────────────────────
export function reportRetencao(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders, allOrders } = ctx;
  const since = rangeOrders[0]?.createdAt ?? new Date().toISOString();
  const prevPhones = new Set(
    allOrders.filter(o => o.createdAt < since && o.status !== 'CANCELLED').map(o => o.customerPhone)
  );
  const rangePhones = new Set(rangeOrders.map(o => o.customerPhone));
  const newPhones = [...rangePhones].filter(p => !prevPhones.has(p));
  const retPhones = [...rangePhones].filter(p => prevPhones.has(p));

  const byCustomer: Record<string, { name: string; count: number; total: number }> = {};
  rangeOrders.forEach(o => {
    if (!byCustomer[o.customerPhone]) byCustomer[o.customerPhone] = { name: o.customerName, count: 0, total: 0 };
    byCustomer[o.customerPhone].count++;
    byCustomer[o.customerPhone].total += o.total;
  });
  const topCustomers = Object.entries(byCustomer)
    .sort(([, a], [, b]) => b.count - a.count)
    .slice(0, 15);

  const topRows = topCustomers.map(([phone, c], i) => `
    <tr>
      <td style="color:#64748b;font-weight:700">${i + 1}</td>
      <td>${c.name}</td>
      <td style="font-family:monospace;color:#94a3b8">${phone}</td>
      <td style="text-align:center;font-weight:600">${c.count}</td>
      <td style="text-align:right;color:#10b981;font-weight:600">${fmt(c.total)}</td>
      <td style="text-align:center">${prevPhones.has(phone) ? '🔄 Recorrente' : '🆕 Novo'}</td>
    </tr>`).join('');

  const pctNew = rangePhones.size ? Math.round(newPhones.length / rangePhones.size * 100) : 0;
  const pctRet = 100 - pctNew;

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Clientes únicos</div><div class="kpi-value">${rangePhones.size}</div></div>
      <div class="kpi"><div class="kpi-label">🆕 Novos</div><div class="kpi-value">${newPhones.length}</div><div class="kpi-sub">${pctNew}% do total</div></div>
      <div class="kpi"><div class="kpi-label">🔄 Recorrentes</div><div class="kpi-value">${retPhones.length}</div><div class="kpi-sub">${pctRet}% do total</div></div>
    </div>
    <div class="section">
      <div class="sec-title">Distribuição</div>
      ${bars([
        { label: 'Clientes novos', value: newPhones.length, max: rangePhones.size, sub: `${newPhones.length} (${pctNew}%)`, color: '#10b981' },
        { label: 'Clientes recorrentes', value: retPhones.length, max: rangePhones.size, sub: `${retPhones.length} (${pctRet}%)`, color: '#6366f1' },
      ])}
    </div>
    <div class="section">
      <div class="sec-title">Top 15 clientes do período</div>
      <table><thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th style="text-align:center">Pedidos</th><th style="text-align:right">Gasto total</th><th style="text-align:center">Tipo</th></tr></thead>
      <tbody>${topRows}</tbody></table>
    </div>`;
  return base('Retenção de Clientes', restaurantName, period, body);
}

// ─── 5. Taxa de Cancelamento ──────────────────────────────────────────────────
export function reportCancelamentos(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders, allPeriodOrders } = ctx;
  const cancelled = allPeriodOrders.filter(o => o.status === 'CANCELLED');
  const total = allPeriodOrders.length;
  const rate = total ? (cancelled.length / total * 100).toFixed(1) : '0.0';
  const cancRev = cancelled.reduce((s, o) => s + o.total, 0);

  const byDay: Record<string, { ok: number; canc: number }> = {};
  allPeriodOrders.forEach(o => {
    const d = o.createdAt.slice(0, 10);
    if (!byDay[d]) byDay[d] = { ok: 0, canc: 0 };
    if (o.status === 'CANCELLED') byDay[d].canc++; else byDay[d].ok++;
  });
  const dayRows = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
    .map(([d, { ok, canc }]) => {
      const t = ok + canc;
      const r = t ? Math.round(canc / t * 100) : 0;
      return `<tr><td>${fmtDate(d)}</td><td style="text-align:center">${ok}</td><td style="text-align:center;color:#ef4444;font-weight:600">${canc}</td><td style="text-align:center">${t}</td><td style="text-align:right;color:${r > 20 ? '#ef4444' : '#64748b'}">${r}%</td></tr>`;
    }).join('');

  const cancRows = cancelled.slice(0, 30).map(o => `
    <tr><td>${fmtDT(o.createdAt)}</td><td>${o.customerName}</td><td>${o.customerPhone}</td><td style="text-align:right">${fmt(o.total)}</td></tr>`)
    .join('');

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total de pedidos</div><div class="kpi-value">${total}</div></div>
      <div class="kpi"><div class="kpi-label">Cancelados</div><div class="kpi-value" style="color:#ef4444">${cancelled.length}</div></div>
      <div class="kpi"><div class="kpi-label">Taxa de cancelamento</div><div class="kpi-value">${rate}%</div></div>
      <div class="kpi"><div class="kpi-label">Receita perdida</div><div class="kpi-value" style="font-size:15px;color:#ef4444">${fmt(cancRev)}</div></div>
    </div>
    <div class="section"><div class="sec-title">Cancelamentos por dia</div>
      <table><thead><tr><th>Data</th><th style="text-align:center">Concluídos</th><th style="text-align:center">Cancelados</th><th style="text-align:center">Total</th><th style="text-align:right">Taxa</th></tr></thead>
      <tbody>${dayRows}</tbody></table>
    </div>
    ${cancelled.length > 0 ? `<div class="section"><div class="sec-title">Lista de cancelamentos (últimos 30)</div>
      <table><thead><tr><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${cancRows}</tbody></table></div>` : ''}`;
  return base('Taxa de Cancelamento', restaurantName, period, body);
}

// ─── 6. DRE Simplificado (para contador) ─────────────────────────────────────
export function reportDRE(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders, allPeriodOrders } = ctx;
  const cancelled = allPeriodOrders.filter(o => o.status === 'CANCELLED');
  const grossRev = allPeriodOrders.reduce((s, o) => s + o.total, 0);
  const cancRev = cancelled.reduce((s, o) => s + o.total, 0);
  const netRev = rangeOrders.reduce((s, o) => s + o.total, 0);

  const byPay: Record<string, { count: number; rev: number }> = {};
  rangeOrders.forEach(o => {
    if (!byPay[o.paymentMethod]) byPay[o.paymentMethod] = { count: 0, rev: 0 };
    byPay[o.paymentMethod].count++;
    byPay[o.paymentMethod].rev += o.total;
  });
  const payRows = Object.entries(byPay).sort(([, a], [, b]) => b.rev - a.rev)
    .map(([m, { count, rev }]) => `<tr><td>${PAY[m] ?? m}</td><td style="text-align:center">${count}</td><td style="text-align:right">${fmt(rev)}</td><td style="text-align:right;color:#64748b">${netRev > 0 ? Math.round(rev / netRev * 100) : 0}%</td></tr>`)
    .join('');

  const byDelivery: Record<string, number> = {};
  rangeOrders.forEach(o => { byDelivery[o.deliveryType ?? 'delivery'] = (byDelivery[o.deliveryType ?? 'delivery'] || 0) + o.total; });
  const delivRows = Object.entries(byDelivery).sort(([, a], [, b]) => b - a)
    .map(([t, v]) => `<tr><td>${DELIVERY[t] ?? t}</td><td style="text-align:right">${fmt(v)}</td></tr>`).join('');

  const body = `
    <div class="note">⚠ Este documento é um resumo de receitas gerado automaticamente. Não substitui demonstrações financeiras oficiais nem dispensa a análise de um contador qualificado.</div>
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Receita bruta</div><div class="kpi-value">${fmt(grossRev)}</div></div>
      <div class="kpi"><div class="kpi-label">(−) Cancelamentos</div><div class="kpi-value" style="color:#ef4444">${fmt(cancRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Receita líquida</div><div class="kpi-value" style="color:#10b981">${fmt(netRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Pedidos válidos</div><div class="kpi-value">${rangeOrders.length}</div></div>
    </div>
    <div class="section"><div class="sec-title">Receita por forma de pagamento</div>
      <table><thead><tr><th>Método</th><th style="text-align:center">Qtd.</th><th style="text-align:right">Valor</th><th style="text-align:right">% Receita</th></tr></thead>
      <tbody>${payRows}</tbody>
      <tfoot><tr class="tfoot-total"><td>TOTAL</td><td style="text-align:center">${rangeOrders.length}</td><td style="text-align:right;color:#10b981">${fmt(netRev)}</td><td style="text-align:right">100%</td></tr></tfoot>
      </table>
    </div>
    <div class="section"><div class="sec-title">Receita por tipo de atendimento</div>
      <table><thead><tr><th>Tipo</th><th style="text-align:right">Valor</th></tr></thead>
      <tbody>${delivRows}</tbody></table>
    </div>`;
  return base('DRE Simplificado — Resumo de Receitas', restaurantName, period, body);
}

// ─── 7. Vendas por Forma de Pagamento ────────────────────────────────────────
export function reportPagamentos(ctx: ReportCtx): string {
  const { restaurantName, period, rangeOrders } = ctx;
  const byPay: Record<string, { count: number; rev: number }> = {};
  rangeOrders.forEach(o => {
    if (!byPay[o.paymentMethod]) byPay[o.paymentMethod] = { count: 0, rev: 0 };
    byPay[o.paymentMethod].count++;
    byPay[o.paymentMethod].rev += o.total;
  });
  const total = rangeOrders.reduce((s, o) => s + o.total, 0);
  const entries = Object.entries(byPay).sort(([, a], [, b]) => b.rev - a.rev);
  const maxRev = entries[0]?.[1]?.rev ?? 1;

  const tableRows = entries.map(([m, { count, rev }]) => `
    <tr><td>${PAY[m] ?? m}</td><td style="text-align:center">${count}</td><td style="text-align:right;font-weight:600">${fmt(rev)}</td><td style="text-align:right;color:#64748b">${total > 0 ? Math.round(rev / total * 100) : 0}%</td></tr>`)
    .join('');

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Faturamento total</div><div class="kpi-value">${fmt(total)}</div></div>
      <div class="kpi"><div class="kpi-label">Métodos usados</div><div class="kpi-value">${entries.length}</div></div>
      <div class="kpi"><div class="kpi-label">Predominante</div><div class="kpi-value" style="font-size:14px">${PAY[entries[0]?.[0]] ?? entries[0]?.[0] ?? '—'}</div></div>
    </div>
    <div class="section"><div class="sec-title">Receita por método</div>
      ${bars(entries.map(([m, { rev }]) => ({ label: PAY[m] ?? m, value: rev, max: maxRev, sub: fmt(rev), color: '#6366f1' })))}
    </div>
    <div class="section"><div class="sec-title">Detalhamento</div>
      <table><thead><tr><th>Método</th><th style="text-align:center">Qtd. pedidos</th><th style="text-align:right">Valor</th><th style="text-align:right">% Total</th></tr></thead>
      <tbody>${tableRows}</tbody>
      <tfoot><tr class="tfoot-total"><td>TOTAL</td><td style="text-align:center">${rangeOrders.length}</td><td style="text-align:right;color:#10b981">${fmt(total)}</td><td style="text-align:right">100%</td></tr></tfoot>
      </table>
    </div>`;
  return base('Vendas por Forma de Pagamento', restaurantName, period, body);
}

// ─── 8. Extrato Completo de Pedidos ──────────────────────────────────────────
export function reportExtrato(ctx: ReportCtx): string {
  const { restaurantName, period, allPeriodOrders } = ctx;
  const sorted = [...allPeriodOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const STATUS: Record<string, string> = {
    PENDING: 'Pendente', PAID: 'Pago', PREPARING: 'Preparando',
    DELIVERING: 'Entregando', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
  };

  const rows = sorted.map(o => `
    <tr>
      <td style="white-space:nowrap">${fmtDT(o.createdAt)}</td>
      <td>${o.customerName}</td>
      <td style="font-family:monospace;color:#94a3b8;font-size:11px">${o.customerPhone}</td>
      <td>${PAY[o.paymentMethod] ?? o.paymentMethod}</td>
      <td>${DELIVERY[o.deliveryType ?? ''] ?? o.deliveryType ?? '—'}</td>
      <td style="text-align:right;font-weight:600">${fmt(o.total)}</td>
      <td style="color:${o.status === 'CANCELLED' ? '#ef4444' : o.status === 'COMPLETED' ? '#10b981' : '#64748b'}">${STATUS[o.status] ?? o.status}</td>
    </tr>`).join('');

  const completedRev = sorted.filter(o => o.status !== 'CANCELLED').reduce((s, o) => s + o.total, 0);

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Total de registros</div><div class="kpi-value">${sorted.length}</div></div>
      <div class="kpi"><div class="kpi-label">Receita (excl. cancel.)</div><div class="kpi-value" style="font-size:15px">${fmt(completedRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Cancelados</div><div class="kpi-value">${sorted.filter(o => o.status === 'CANCELLED').length}</div></div>
    </div>
    <div class="section"><div class="sec-title">Todos os pedidos do período</div>
      <table><thead><tr><th>Data/hora</th><th>Cliente</th><th>Telefone</th><th>Pagamento</th><th>Tipo</th><th style="text-align:right">Valor</th><th>Status</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="7" style="text-align:center;color:#94a3b8;padding:20px">Nenhum pedido no período</td></tr>'}</tbody>
      <tfoot><tr class="tfoot-total"><td colspan="5">TOTAL (excl. cancelamentos)</td><td style="text-align:right;color:#10b981">${fmt(completedRev)}</td><td></td></tr></tfoot>
      </table>
    </div>`;
  return base('Extrato Completo de Pedidos', restaurantName, period, body);
}

// ─── 9. Faturamento Mensal Consolidado ───────────────────────────────────────
export function reportMensal(ctx: ReportCtx): string {
  const { restaurantName, allOrders } = ctx;
  const byMonth: Record<string, { count: number; rev: number; canc: number }> = {};
  allOrders.forEach(o => {
    const m = o.createdAt.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, rev: 0, canc: 0 };
    if (o.status === 'CANCELLED') { byMonth[m].canc++; }
    else { byMonth[m].count++; byMonth[m].rev += o.total; }
  });
  const months = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).slice(0, 24);
  const maxRev = Math.max(...months.map(([, d]) => d.rev), 1);

  const monthLabel = (m: string) => {
    const [y, mo] = m.split('-');
    const names = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    return `${names[Number(mo) - 1]}/${y}`;
  };

  const rows = months.map(([m, { count, rev, canc }]) => `
    <tr><td>${monthLabel(m)}</td><td style="text-align:center">${count}</td><td style="text-align:center;color:#ef4444">${canc}</td><td style="text-align:right;font-weight:600">${fmt(rev)}</td><td style="text-align:right;color:#64748b">${fmt(count ? rev / count : 0)}</td></tr>`)
    .join('');

  const totalRev = months.reduce((s, [, d]) => s + d.rev, 0);
  const totalOrders = months.reduce((s, [, d]) => s + d.count, 0);
  const period = months.length > 0 ? `${monthLabel(months[months.length - 1][0])} a ${monthLabel(months[0][0])}` : '—';

  const body = `
    <div class="kpis">
      <div class="kpi"><div class="kpi-label">Período</div><div class="kpi-value" style="font-size:13px">${period}</div></div>
      <div class="kpi"><div class="kpi-label">Faturamento total</div><div class="kpi-value" style="font-size:15px">${fmt(totalRev)}</div></div>
      <div class="kpi"><div class="kpi-label">Total de pedidos</div><div class="kpi-value">${totalOrders}</div></div>
      <div class="kpi"><div class="kpi-label">Ticket médio geral</div><div class="kpi-value" style="font-size:15px">${fmt(totalOrders ? totalRev / totalOrders : 0)}</div></div>
    </div>
    <div class="section"><div class="sec-title">Faturamento por mês</div>
      ${bars(months.slice(0, 12).map(([m, d]) => ({ label: monthLabel(m), value: d.rev, max: maxRev, sub: fmt(d.rev), color: '#10b981' })))}
    </div>
    <div class="section"><div class="sec-title">Consolidado mensal — últimos 24 meses</div>
      <table><thead><tr><th>Mês</th><th style="text-align:center">Pedidos</th><th style="text-align:center">Cancelados</th><th style="text-align:right">Faturamento</th><th style="text-align:right">Ticket Médio</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr class="tfoot-total"><td>TOTAL</td><td style="text-align:center">${totalOrders}</td><td style="text-align:center">—</td><td style="text-align:right;color:#10b981">${fmt(totalRev)}</td><td style="text-align:right">${fmt(totalOrders ? totalRev / totalOrders : 0)}</td></tr></tfoot>
      </table>
    </div>`;
  return base('Faturamento Mensal Consolidado', restaurantName, period, body);
}

// ─── CSV generators ───────────────────────────────────────────────────────────

export function csvExtrato(ctx: ReportCtx) {
  const STATUS: Record<string, string> = {
    PENDING: 'Pendente', PAID: 'Pago', PREPARING: 'Preparando',
    DELIVERING: 'Entregando', COMPLETED: 'Concluído', CANCELLED: 'Cancelado',
  };
  const headers = ['Data', 'Hora', 'Cliente', 'Telefone', 'Itens', 'Pagamento', 'Tipo entrega', 'Total (R$)', 'Status'];
  const rows = [...ctx.allPeriodOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt)).map(o => {
    const d = new Date(o.createdAt);
    return [
      d.toLocaleDateString('pt-BR'),
      d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      o.customerName,
      o.customerPhone,
      o.items.map(i => `${i.quantity}x ${i.name}`).join(' | '),
      PAY[o.paymentMethod] ?? o.paymentMethod,
      DELIVERY[o.deliveryType ?? ''] ?? o.deliveryType ?? '',
      o.total.toFixed(2).replace('.', ','),
      STATUS[o.status] ?? o.status,
    ];
  });
  downloadCsv('extrato-pedidos', headers, rows);
}

export function csvPagamentos(ctx: ReportCtx) {
  const byPay: Record<string, { count: number; rev: number }> = {};
  ctx.rangeOrders.forEach(o => {
    if (!byPay[o.paymentMethod]) byPay[o.paymentMethod] = { count: 0, rev: 0 };
    byPay[o.paymentMethod].count++;
    byPay[o.paymentMethod].rev += o.total;
  });
  const total = ctx.rangeOrders.reduce((s, o) => s + o.total, 0);
  const headers = ['Método de pagamento', 'Qtd. pedidos', 'Valor (R$)', '% do total'];
  const rows = Object.entries(byPay).sort(([, a], [, b]) => b.rev - a.rev).map(([m, { count, rev }]) => [
    PAY[m] ?? m,
    String(count),
    rev.toFixed(2).replace('.', ','),
    total > 0 ? `${Math.round(rev / total * 100)}%` : '0%',
  ]);
  downloadCsv('pagamentos', headers, rows);
}

export function csvMensal(ctx: ReportCtx) {
  const byMonth: Record<string, { count: number; rev: number; canc: number }> = {};
  ctx.allOrders.forEach(o => {
    const m = o.createdAt.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { count: 0, rev: 0, canc: 0 };
    if (o.status === 'CANCELLED') byMonth[m].canc++;
    else { byMonth[m].count++; byMonth[m].rev += o.total; }
  });
  const headers = ['Mês', 'Pedidos', 'Cancelamentos', 'Faturamento (R$)', 'Ticket Médio (R$)'];
  const rows = Object.entries(byMonth).sort(([a], [b]) => b.localeCompare(a)).map(([m, { count, rev, canc }]) => [
    m,
    String(count),
    String(canc),
    rev.toFixed(2).replace('.', ','),
    (count ? rev / count : 0).toFixed(2).replace('.', ','),
  ]);
  downloadCsv('faturamento-mensal', headers, rows);
}

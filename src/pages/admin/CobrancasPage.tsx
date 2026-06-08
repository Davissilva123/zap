import { useEffect, useState, useCallback } from 'react';
import { db } from '../../lib/db';
import {
  AlertTriangle, RefreshCw, Mail, CheckCircle, Ban, Clock,
  DollarSign, Zap, Phone, ChevronDown, ChevronUp, Send,
} from 'lucide-react';

type Overdue = Awaited<ReturnType<typeof db.getOverdueRestaurants>>[number];

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');

const STATUS_LABELS: Record<string, string> = {
  trial: 'Trial vencido',
  past_due: 'Pagamento atrasado',
  expired: 'Plano expirado',
  blocked: 'Bloqueado',
};

function urgencyColor(daysOverdue: number, blocked: boolean) {
  if (blocked) return { bar: 'bg-slate-400', badge: 'bg-slate-100 text-slate-600', row: '' };
  if (daysOverdue >= 13) return { bar: 'bg-red-500', badge: 'bg-red-100 text-red-700', row: 'bg-red-50/30' };
  if (daysOverdue >= 7) return { bar: 'bg-orange-400', badge: 'bg-orange-100 text-orange-700', row: 'bg-orange-50/20' };
  return { bar: 'bg-amber-400', badge: 'bg-amber-100 text-amber-700', row: '' };
}

function EmailTemplate(restaurantName: string, planName: string, planPrice: number, daysOverdue: number) {
  return encodeURIComponent(
    `Olá, tudo bem?\n\n` +
    `Notamos que sua assinatura do ZapMenu (Plano ${planName} - ${R(planPrice)}/mês) está ` +
    `com ${daysOverdue} dia${daysOverdue !== 1 ? 's' : ''} de atraso.\n\n` +
    `Para continuar usando o ZapMenu sem interrupções, por favor regularize seu pagamento o quanto antes.\n\n` +
    `⚠️ Atenção: após 15 dias de atraso, o cardápio online é bloqueado automaticamente.\n\n` +
    `Em caso de dúvidas, responda este e-mail ou entre em contato diretamente.\n\n` +
    `Atenciosamente,\nEquipe ZapMenu`
  );
}

export default function AdminCobrancasPage() {
  const [overdue, setOverdue] = useState<Overdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningAutoBlock, setRunningAutoBlock] = useState(false);
  const [autoBlockResult, setAutoBlockResult] = useState<number | null>(null);
  const [autoBlockEnabled, setAutoBlockEnabled] = useState(() => {
    return localStorage.getItem('zm_auto_block_enabled') !== 'false';
  });
  const [confirmPaymentId, setConfirmPaymentId] = useState<string | null>(null);
  const [paymentNotes, setPaymentNotes] = useState('');
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await db.getOverdueRestaurants().catch(() => []);
      setOverdue(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Roda auto-bloqueio automaticamente se habilitado
    if (autoBlockEnabled) {
      db.autoBlockOverdueRestaurants().catch(() => {});
    }
  }, []);

  const runAutoBlock = async () => {
    setRunningAutoBlock(true);
    setAutoBlockResult(null);
    try {
      const count = await db.autoBlockOverdueRestaurants();
      setAutoBlockResult(count);
      await load();
    } catch (e: any) {
      alert('Erro: ' + (e?.message ?? e));
    } finally {
      setRunningAutoBlock(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!confirmPaymentId) return;
    setConfirmingPayment(true);
    try {
      await db.markPaymentReceived(confirmPaymentId, paymentNotes || undefined);
      await db.logBillingReminder(confirmPaymentId, 'Pagamento confirmado manualmente', 'manual');
      setConfirmPaymentId(null);
      setPaymentNotes('');
      await load();
    } catch (e: any) {
      alert('Erro: ' + (e?.message ?? e));
    } finally {
      setConfirmingPayment(false);
    }
  };

  const handleLogReminder = async (userId: string, email: string, name: string, planName: string, planPrice: number, daysOverdue: number) => {
    await db.logBillingReminder(userId, `E-mail de cobrança enviado para ${email}`, 'email').catch(() => {});
    await load();
  };

  const toggleAutoBlock = (val: boolean) => {
    setAutoBlockEnabled(val);
    localStorage.setItem('zm_auto_block_enabled', val ? 'true' : 'false');
  };

  const totalEmAberto = overdue.filter(r => !r.blocked).reduce((s, r) => s + r.planPrice, 0);
  const criticos = overdue.filter(r => !r.blocked && r.daysOverdue >= 13).length;
  const emRisco = overdue.filter(r => !r.blocked && r.daysOverdue >= 7 && r.daysOverdue < 13).length;
  const bloqueados = overdue.filter(r => r.blocked).length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cobranças</h1>
          <p className="text-slate-500 text-sm mt-0.5">Inadimplências, régua de cobrança e bloqueio automático</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Atualizar
          </button>
          <button
            onClick={runAutoBlock}
            disabled={runningAutoBlock}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Zap className={`w-4 h-4 ${runningAutoBlock ? 'animate-spin' : ''}`} />
            {runningAutoBlock ? 'Verificando...' : 'Rodar bloqueio automático'}
          </button>
        </div>
      </div>

      {/* Auto-block result banner */}
      {autoBlockResult !== null && (
        <div className={`card p-4 flex items-center gap-3 ${autoBlockResult > 0 ? 'bg-red-50 border border-red-200' : 'bg-emerald-50 border border-emerald-200'}`}>
          {autoBlockResult > 0
            ? <><AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" /><p className="text-sm font-semibold text-red-800">{autoBlockResult} restaurante{autoBlockResult > 1 ? 's' : ''} bloqueado{autoBlockResult > 1 ? 's' : ''} automaticamente por inadimplência.</p></>
            : <><CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0" /><p className="text-sm font-semibold text-emerald-800">Nenhum restaurante atingiu o limite de 15 dias. Tudo em ordem.</p></>
          }
          <button onClick={() => setAutoBlockResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">✕</button>
        </div>
      )}

      {/* Cards de resumo */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Em aberto', value: R(totalEmAberto), sub: `${overdue.filter(r => !r.blocked).length} clientes`, color: 'bg-amber-100 text-amber-600', icon: DollarSign },
          { label: 'Crítico (13+ dias)', value: String(criticos), sub: 'Bloqueio em breve', color: 'bg-red-100 text-red-600', icon: AlertTriangle },
          { label: 'Em risco (7-13d)', value: String(emRisco), sub: 'Cobrar urgente', color: 'bg-orange-100 text-orange-600', icon: Clock },
          { label: 'Já bloqueados', value: String(bloqueados), sub: 'Aguardando pagamento', color: 'bg-slate-100 text-slate-600', icon: Ban },
        ].map((c, i) => (
          <div key={i} className="card p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${c.color}`}>
              <c.icon className="w-4 h-4" />
            </div>
            <div className="text-xl font-black text-slate-900 leading-none mb-0.5">{c.value}</div>
            <div className="text-xs text-slate-400">{c.label}</div>
            <div className="text-[10px] text-slate-300 mt-0.5">{c.sub}</div>
          </div>
        ))}
      </div>

      {/* Configuração de bloqueio automático */}
      <div className="card p-4 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-sm font-bold text-slate-900">Bloqueio automático no 16° dia</p>
          <p className="text-xs text-slate-400 mt-0.5 max-w-sm">
            Quando ativado, restaurantes com 15+ dias de inadimplência são bloqueados automaticamente ao acessar este painel ou ao clicar em "Rodar bloqueio automático".
          </p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className={`text-xs font-semibold ${autoBlockEnabled ? 'text-emerald-600' : 'text-slate-400'}`}>
            {autoBlockEnabled ? 'Ativado' : 'Desativado'}
          </span>
          <button
            onClick={() => toggleAutoBlock(!autoBlockEnabled)}
            className={`relative w-12 h-6 rounded-full transition-colors ${autoBlockEnabled ? 'bg-emerald-500' : 'bg-slate-200'}`}
          >
            <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${autoBlockEnabled ? 'left-7' : 'left-1'}`} />
          </button>
        </div>
      </div>

      {/* Régua de cobrança - explicação */}
      <div className="card p-4 bg-violet-50 border border-violet-100">
        <p className="text-xs font-bold text-violet-800 mb-2">Régua de cobrança automática</p>
        <div className="flex items-center gap-0 overflow-x-auto">
          {[
            { day: 'Dia 1', label: 'Vencimento', color: 'bg-slate-200 text-slate-600' },
            { day: 'Dia 3', label: 'Cobrar', color: 'bg-amber-200 text-amber-800' },
            { day: 'Dia 7', label: 'Urgente', color: 'bg-orange-300 text-orange-800' },
            { day: 'Dia 12', label: 'Último aviso', color: 'bg-red-300 text-red-800' },
            { day: 'Dia 16', label: 'Auto-bloqueia', color: 'bg-red-600 text-white' },
          ].map((s, i, arr) => (
            <div key={i} className="flex items-center flex-shrink-0">
              <div className={`px-2.5 py-1.5 rounded-lg text-center ${s.color}`}>
                <div className="text-[10px] font-black">{s.day}</div>
                <div className="text-[9px] font-medium">{s.label}</div>
              </div>
              {i < arr.length - 1 && <div className="w-4 h-0.5 bg-slate-200 flex-shrink-0" />}
            </div>
          ))}
        </div>
      </div>

      {/* Lista de inadimplentes */}
      <div className="card overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">
            {overdue.length} registro{overdue.length !== 1 ? 's' : ''} de inadimplência
          </span>
          <span className="text-xs text-slate-400">Ordenado por dias de atraso</span>
        </div>

        {loading ? (
          <div className="p-12 flex items-center justify-center">
            <div className="w-7 h-7 border-4 border-slate-200 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : overdue.length === 0 ? (
          <div className="p-12 text-center">
            <CheckCircle className="w-10 h-10 text-emerald-300 mx-auto mb-3" />
            <p className="text-slate-500 font-semibold">Nenhuma inadimplência encontrada</p>
            <p className="text-slate-400 text-sm mt-1">Todos os clientes estão em dia ou no período de trial.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-50">
            {overdue.map(r => {
              const colors = urgencyColor(r.daysOverdue, r.blocked);
              const isExpanded = expanded === r.userId;

              return (
                <div key={r.userId} className={`transition-colors ${colors.row}`}>
                  {/* Main row */}
                  <div className="px-5 py-4">
                    <div className="flex items-start gap-3">
                      {/* Urgency bar */}
                      <div className={`w-1 self-stretch rounded-full flex-shrink-0 ${colors.bar}`} />

                      <div className="flex-1 min-w-0">
                        {/* Name + badges */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm">{r.restaurantName}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${colors.badge}`}>
                            {r.blocked ? '🚫 Bloqueado' : STATUS_LABELS[r.status] ?? r.status}
                          </span>
                          {!r.blocked && (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              r.daysOverdue >= 13 ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {r.daysOverdue}d de atraso
                            </span>
                          )}
                        </div>

                        {/* Barra de progresso até bloqueio */}
                        {!r.blocked && (
                          <div className="mb-2">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                              <span>Progresso até bloqueio automático</span>
                              <span className={r.daysUntilAutoBlock <= 2 ? 'text-red-500 font-bold' : ''}>
                                {r.daysUntilAutoBlock === 0 ? 'Bloqueio pendente!' : `${r.daysUntilAutoBlock}d restantes`}
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${
                                  r.daysOverdue >= 13 ? 'bg-red-500' : r.daysOverdue >= 7 ? 'bg-orange-400' : 'bg-amber-400'
                                }`}
                                style={{ width: `${Math.min(100, (r.daysOverdue / 15) * 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Info */}
                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {r.ownerEmail}
                          </span>
                          {r.ownerPhone && (
                            <span className="flex items-center gap-1">
                              <Phone className="w-3 h-3" /> {r.ownerPhone}
                            </span>
                          )}
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" /> {r.planName} · {R(r.planPrice)}/mês
                          </span>
                          {r.reminderCount > 0 && (
                            <span className="text-violet-500 font-medium">
                              {r.reminderCount} cobrança{r.reminderCount > 1 ? 's' : ''} enviada{r.reminderCount > 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                        {/* Enviar cobrança por email */}
                        {!r.blocked && (
                          <a
                            href={`mailto:${r.ownerEmail}?subject=ZapMenu — Fatura em aberto (${r.daysOverdue} dias)&body=${EmailTemplate(r.restaurantName, r.planName, r.planPrice, r.daysOverdue)}`}
                            onClick={() => handleLogReminder(r.userId, r.ownerEmail, r.restaurantName, r.planName, r.planPrice, r.daysOverdue)}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-xl text-xs font-semibold transition-colors"
                            title="Enviar cobrança por email"
                          >
                            <Send className="w-3.5 h-3.5" /> Cobrar
                          </a>
                        )}

                        {/* Confirmar pagamento */}
                        <button
                          onClick={() => { setConfirmPaymentId(r.userId); setPaymentNotes(''); }}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-xl text-xs font-semibold transition-colors"
                          title="Confirmar pagamento recebido"
                        >
                          <CheckCircle className="w-3.5 h-3.5" /> Pago
                        </button>

                        {/* Expandir */}
                        <button
                          onClick={() => setExpanded(isExpanded ? null : r.userId)}
                          className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Expandido: detalhes */}
                  {isExpanded && (
                    <div className="px-5 pb-4 ml-4 space-y-2 border-t border-slate-50 pt-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">Detalhes</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-1.5 text-xs">
                        <span className="text-slate-400">Inadimplente desde</span>
                        <span className="font-medium text-slate-700 col-span-2">
                          {r.overdueSince ? new Date(r.overdueSince).toLocaleDateString('pt-BR') : '—'}
                        </span>
                        <span className="text-slate-400">Dias de atraso</span>
                        <span className={`font-bold col-span-2 ${r.daysOverdue >= 13 ? 'text-red-600' : r.daysOverdue >= 7 ? 'text-orange-600' : 'text-amber-600'}`}>
                          {r.daysOverdue} dia{r.daysOverdue !== 1 ? 's' : ''}
                        </span>
                        <span className="text-slate-400">Bloqueio automático</span>
                        <span className={`font-semibold col-span-2 ${r.daysUntilAutoBlock === 0 ? 'text-red-600' : 'text-slate-700'}`}>
                          {r.blocked ? 'Já bloqueado' : r.daysUntilAutoBlock === 0 ? 'Executar agora' : `Em ${r.daysUntilAutoBlock} dia${r.daysUntilAutoBlock !== 1 ? 's' : ''}`}
                        </span>
                        <span className="text-slate-400">Últ. cobrança</span>
                        <span className="font-medium text-slate-700 col-span-2">
                          {r.lastReminderAt ? new Date(r.lastReminderAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Nenhuma enviada'}
                        </span>
                      </div>

                      {/* Template de email de cobrança */}
                      {!r.blocked && (
                        <details className="mt-2">
                          <summary className="text-xs text-violet-600 cursor-pointer hover:underline font-medium">Ver template do e-mail de cobrança</summary>
                          <div className="mt-2 p-3 bg-slate-50 rounded-xl text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed max-h-40 overflow-y-auto">
                            {decodeURIComponent(EmailTemplate(r.restaurantName, r.planName, r.planPrice, r.daysOverdue))}
                          </div>
                        </details>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Confirmar pagamento */}
      {confirmPaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmPaymentId(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 p-6">
            <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-6 h-6 text-emerald-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Confirmar pagamento</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              O restaurante será reativado e removido da lista de inadimplentes.
            </p>
            <div className="mb-5">
              <label className="label">Observação (opcional)</label>
              <input
                type="text"
                value={paymentNotes}
                onChange={e => setPaymentNotes(e.target.value)}
                placeholder="Ex: PIX recebido em 06/06/2026"
                className="input w-full"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmPaymentId(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button
                onClick={handleConfirmPayment}
                disabled={confirmingPayment}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {confirmingPayment
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><CheckCircle className="w-4 h-4" /> Confirmar recebimento</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

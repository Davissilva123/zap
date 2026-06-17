import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { FinancialEntry, FinancialEntryType, Supplier } from '../lib/types';
import { Wallet, Plus, X, Save, Trash2, CheckCircle, AlertCircle, Calendar, TrendingUp, TrendingDown, Edit2, Banknote, CreditCard } from 'lucide-react';
import { parseCurrency, numToCurrency } from '../lib/masks';

const STATUS_CFG = {
  pending:   { label: 'Pendente',  cls: 'bg-amber-100 text-amber-700'  },
  paid:      { label: 'Pago',      cls: 'bg-green-100 text-green-700'  },
  overdue:   { label: 'Vencida',   cls: 'bg-red-100 text-red-600'      },
  cancelled: { label: 'Cancelada', cls: 'bg-slate-100 text-slate-500'  },
};

const CATEGORIES = ['Aluguel','Energia','Água','Gás','Internet','Folha de Pagamento','Fornecedor','Imposto','Manutenção','Marketing','Equipamento','Outros'];

type FilterTab = 'all' | 'payable' | 'receivable' | 'overdue';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const emptyForm = (): Partial<FinancialEntry> => ({
  type: 'payable', description: '', amount: 0, dueDate: new Date().toISOString().slice(0, 10),
  status: 'pending', category: '', notes: '', recurrence: 'none',
});


export default function ContasPage() {
  const { user } = useAuth();
  const [entries, setEntries] = useState<FinancialEntry[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [tab, setTab] = useState<FilterTab>('all');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<FinancialEntry>>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [payingEntry, setPayingEntry] = useState<FinancialEntry | null>(null);

  const load = async () => {
    if (!user) return;
    const [data, sups] = await Promise.all([db.getFinancialEntries(user.id), db.getSuppliers(user.id)]);
    // Update overdue statuses
    const now = new Date().toISOString().slice(0, 10);
    const enriched = data.map(e => e.status === 'pending' && e.dueDate < now ? { ...e, status: 'overdue' as const } : e);
    setEntries(enriched);
    setSuppliers(sups);
  };

  useEffect(() => { load(); }, [user]);

  const filtered = entries.filter(e => {
    const inMonth = !month || e.dueDate.startsWith(month);
    if (!inMonth) return false;
    if (tab === 'payable') return e.type === 'payable';
    if (tab === 'receivable') return e.type === 'receivable';
    if (tab === 'overdue') return e.status === 'overdue';
    return true;
  });

  const totPayable    = entries.filter(e => e.type === 'payable'    && e.status !== 'cancelled' && e.dueDate.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const totReceivable = entries.filter(e => e.type === 'receivable' && e.status !== 'cancelled' && e.dueDate.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const totPaid       = entries.filter(e => e.status === 'paid'     && e.dueDate.startsWith(month)).reduce((s, e) => s + e.amount, 0);
  const totOverdue    = entries.filter(e => e.status === 'overdue'  && e.dueDate.startsWith(month)).reduce((s, e) => s + e.amount, 0);

  const open = (e?: FinancialEntry) => {
    setForm(e ? { ...e } : { ...emptyForm(), type: tab === 'receivable' ? 'receivable' : 'payable' });
    setModal(true);
  };
  const close = () => { setModal(false); setForm(emptyForm()); };
  const set = (k: keyof FinancialEntry, v: unknown) => setForm(p => ({ ...p, [k]: v }));

  const save = async () => {
    if (!user || !form.description?.trim() || !form.amount || !form.dueDate) return;
    setSaving(true);
    setSaveError('');
    try {
      await db.upsertFinancialEntry(user.id, form as FinancialEntry & { type: string; description: string; amount: number; dueDate: string });
      await load();
      close();
    } catch (err) {
      setSaveError('Erro ao salvar. Verifique se o SQL de migração foi executado no Supabase.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const confirmMarkPaid = async (e: FinancialEntry, isCash: boolean) => {
    const today = new Date().toISOString().slice(0, 10);
    await db.markFinancialEntryPaid(e.id, today);
    setEntries(prev => prev.map(x => x.id === e.id ? { ...x, status: 'paid', paidDate: today } : x));
    if (isCash && user) {
      const session = await db.getCurrentCashSession(user.id);
      if (session) {
        const entryType = e.type === 'payable' ? 'withdrawal' : 'deposit';
        const label = e.type === 'payable' ? `Pgto: ${e.description}` : `Receb.: ${e.description}`;
        await db.addCashEntry(user.id, session.id, entryType, e.amount, label);
      }
    }
    setPayingEntry(null);
  };

  const del = async (id: string) => {
    if (!confirm('Excluir lançamento?')) return;
    await db.deleteFinancialEntry(id);
    setEntries(prev => prev.filter(e => e.id !== id));
  };

  const TABS: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'Todos' },
    { key: 'payable', label: 'A Pagar' },
    { key: 'receivable', label: 'A Receber' },
    { key: 'overdue', label: 'Vencidas' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Wallet size={22} className="text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Contas a Pagar / Receber</h1>
            <p className="text-sm text-slate-500">Fluxo de caixa e obrigações financeiras</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="month" value={month} onChange={e => setMonth(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <button onClick={() => open()} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium">
            <Plus size={16} /> Novo lançamento
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'A Pagar', value: totPayable, icon: TrendingDown, color: 'red' },
          { label: 'A Receber', value: totReceivable, icon: TrendingUp, color: 'emerald' },
          { label: 'Pago/Recebido', value: totPaid, icon: CheckCircle, color: 'blue' },
          { label: 'Vencido', value: totOverdue, icon: AlertCircle, color: 'amber' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4">
            <div className={`text-${color}-500 mb-2`}><Icon size={18} /></div>
            <p className="text-xs text-slate-500">{label}</p>
            <p className={`text-xl font-bold text-${color}-600 mt-0.5`}>{fmt(value)}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-3 py-2 rounded-xl text-sm font-medium transition-colors ${tab === t.key ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'}`}>
            {t.label}
            {t.key === 'overdue' && totOverdue > 0 && <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-1.5">{entries.filter(e => e.status === 'overdue').length}</span>}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
          <Wallet size={40} className="opacity-20" />
          <p className="text-sm">Nenhum lançamento encontrado</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-slate-600">Descrição</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-slate-600">Categoria</th>
                <th className="hidden sm:table-cell text-left px-4 py-3 font-semibold text-slate-600">Vencimento</th>
                <th className="text-right px-3 py-3 font-semibold text-slate-600">Valor</th>
                <th className="text-left px-3 py-3 font-semibold text-slate-600">Status</th>
                <th className="w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(e => {
                const cfg = STATUS_CFG[e.status];
                const isP = e.type === 'payable';
                return (
                  <tr key={e.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="flex-shrink-0">{isP ? <TrendingDown size={13} className="text-red-400" /> : <TrendingUp size={13} className="text-emerald-500" />}</span>
                        <div className="min-w-0">
                          <p className="font-medium text-slate-800 truncate">{e.description}</p>
                          {e.notes && <p className="text-xs text-slate-400 truncate">{e.notes}</p>}
                          <div className="sm:hidden flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                            <Calendar size={10} />
                            {new Date(e.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                            {e.category && <span>· {e.category}</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="hidden sm:table-cell px-4 py-3 text-xs text-slate-500">{e.category || '—'}</td>
                    <td className="hidden sm:table-cell px-4 py-3">
                      <div className="flex items-center gap-1 text-xs text-slate-600">
                        <Calendar size={11} />
                        {new Date(e.dueDate + 'T00:00:00').toLocaleDateString('pt-BR')}
                      </div>
                    </td>
                    <td className={`px-3 py-3 text-right font-bold whitespace-nowrap ${isP ? 'text-red-600' : 'text-emerald-600'}`}>
                      {isP ? '−' : '+'}{fmt(e.amount)}
                    </td>
                    <td className="px-3 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    </td>
                    <td className="px-2 py-3">
                      <div className="flex items-center gap-0.5">
                        {(e.status === 'pending' || e.status === 'overdue') && (
                          <button onClick={() => setPayingEntry(e)} title="Marcar como pago" className="p-1.5 text-slate-400 hover:text-emerald-600">
                            <CheckCircle size={14} />
                          </button>
                        )}
                        <button onClick={() => open(e)} className="p-1.5 text-slate-400 hover:text-blue-600"><Edit2 size={14} /></button>
                        <button onClick={() => del(e.id)} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {payingEntry && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-800">Como foi pago?</h2>
              <button onClick={() => setPayingEntry(null)} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <p className="text-sm text-slate-600 bg-slate-50 rounded-lg px-3 py-2">
              <span className={payingEntry.type === 'payable' ? 'text-red-600 font-medium' : 'text-emerald-600 font-medium'}>
                {payingEntry.type === 'payable' ? '📤' : '📥'} {payingEntry.description}
              </span>
              <span className="ml-2 font-bold">R$ {payingEntry.amount.toFixed(2).replace('.', ',')}</span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => confirmMarkPaid(payingEntry, true)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-emerald-400 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold transition-colors"
              >
                <Banknote size={22} />
                <span className="text-sm">Dinheiro</span>
                <span className="text-[10px] text-emerald-600 font-normal">Registra no caixa</span>
              </button>
              <button
                onClick={() => confirmMarkPaid(payingEntry, false)}
                className="flex flex-col items-center gap-2 py-4 rounded-xl border-2 border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold transition-colors"
              >
                <CreditCard size={22} />
                <span className="text-sm">Outro</span>
                <span className="text-[10px] text-slate-500 font-normal">PIX, cartão, etc.</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">{form.id ? 'Editar lançamento' : 'Novo lançamento'}</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="overflow-y-auto flex-1 px-6 py-4 space-y-4">
              <div className="flex gap-2">
                {(['payable', 'receivable'] as FinancialEntryType[]).map(t => (
                  <button key={t} onClick={() => set('type', t)}
                    className={`flex-1 py-2 rounded-xl text-sm font-medium border-2 ${form.type === t ? (t === 'payable' ? 'border-red-400 bg-red-50 text-red-700' : 'border-emerald-400 bg-emerald-50 text-emerald-700') : 'border-slate-200 text-slate-600'}`}>
                    {t === 'payable' ? '📤 A Pagar' : '📥 A Receber'}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Descrição *</label>
                <input value={form.description ?? ''} onChange={e => set('description', e.target.value)} placeholder="ex: Aluguel do imóvel"
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Valor *</label>
                  <input type="text" inputMode="numeric" value={numToCurrency(form.amount ?? 0)} onChange={e => set('amount', parseCurrency(e.target.value))}
                    placeholder="R$ 0,00" className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Vencimento *</label>
                  <input type="date" value={form.dueDate ?? ''} onChange={e => set('dueDate', e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-slate-700">Categoria</label>
                  <select value={form.category ?? ''} onChange={e => set('category', e.target.value)}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">Selecione</option>
                    {CATEGORIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700">Fornecedor</label>
                  <select value={form.supplierId ?? ''} onChange={e => set('supplierId', e.target.value || null)}
                    className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                    <option value="">—</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Recorrência</label>
                <select value={form.recurrence ?? 'none'} onChange={e => set('recurrence', e.target.value)}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="none">Sem recorrência</option>
                  <option value="weekly">Semanal</option>
                  <option value="monthly">Mensal</option>
                  <option value="yearly">Anual</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Observações</label>
                <textarea value={form.notes ?? ''} onChange={e => set('notes', e.target.value)} rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            {saveError && (
              <div className="mx-6 mb-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700 flex items-start gap-2">
                <AlertCircle size={13} className="flex-shrink-0 mt-0.5" />
                {saveError}
              </div>
            )}
            <div className="flex-shrink-0 px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={close} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={save} disabled={saving || !form.description?.trim()}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 flex items-center gap-2">
                <Save size={14} />{saving ? 'Salvando...' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


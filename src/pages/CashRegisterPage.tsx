import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import type { CashSession, CashEntry } from '../lib/types';
import { Wallet, Lock, Unlock, History, X, Check, Loader2, ArrowUpRight, ArrowDownRight, ShoppingBag } from 'lucide-react';

function fmt(n: number) { return n.toFixed(2).replace('.', ','); }

function EntryBadge({ type }: { type: CashEntry['type'] }) {
  if (type === 'sale') return (
    <span className="flex items-center gap-1 text-emerald-700 text-xs font-semibold">
      <ShoppingBag className="w-3.5 h-3.5" /> Venda
    </span>
  );
  if (type === 'deposit') return (
    <span className="flex items-center gap-1 text-blue-700 text-xs font-semibold">
      <ArrowUpRight className="w-3.5 h-3.5" /> Suprimento
    </span>
  );
  return (
    <span className="flex items-center gap-1 text-red-700 text-xs font-semibold">
      <ArrowDownRight className="w-3.5 h-3.5" /> Sangria
    </span>
  );
}

export default function CashRegisterPage() {
  const { user: _user } = useAuth();
  const restaurantId = useRestaurantId();
  const [session, setSession] = useState<CashSession | null>(null);
  const [sessions, setSessions] = useState<CashSession[]>([]);
  const [entries, setEntries] = useState<CashEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'current' | 'history'>('current');

  const [openModal, setOpenModal] = useState(false);
  const [closeModal, setCloseModal] = useState(false);
  const [entryModal, setEntryModal] = useState<'withdrawal' | 'deposit' | null>(null);

  const [openAmt, setOpenAmt] = useState('');
  const [openNotes, setOpenNotes] = useState('');
  const [closeAmt, setCloseAmt] = useState('');
  const [closeNotes, setCloseNotes] = useState('');
  const [entryAmt, setEntryAmt] = useState('');
  const [entryDesc, setEntryDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!restaurantId) return;
    const [cur, hist] = await Promise.all([
      db.getCurrentCashSession(restaurantId),
      db.getCashSessions(restaurantId),
    ]);
    setSession(cur);
    setSessions(hist);
    if (cur) {
      const e = await db.getCashEntries(cur.id);
      setEntries(e);
    } else {
      setEntries([]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  const handleOpen = async () => {
    if (!restaurantId || !openAmt) return;
    setSaving(true);
    await db.openCashSession(restaurantId, Number(openAmt), openNotes);
    setOpenModal(false);
    setOpenAmt('');
    setOpenNotes('');
    await load();
    setSaving(false);
  };

  const handleClose = async () => {
    if (!restaurantId || !session || !closeAmt) return;
    setSaving(true);
    await db.closeCashSession(session.id, Number(closeAmt), closeNotes);
    setCloseModal(false);
    setCloseAmt('');
    setCloseNotes('');
    await load();
    setSaving(false);
  };

  const handleEntry = async () => {
    if (!restaurantId || !session || !entryModal || !entryAmt) return;
    setSaving(true);
    await db.addCashEntry(restaurantId, session.id, entryModal, Number(entryAmt), entryDesc);
    setEntryModal(null);
    setEntryAmt('');
    setEntryDesc('');
    await load();
    setSaving(false);
  };

  if (!restaurantId) return null;

  const balance = session
    ? session.openingAmount + session.totalDeposits + session.totalSales - session.totalWithdrawals
    : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestao de Caixa</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Controle de abertura, fechamento, sangria e suprimento</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => setTab('current')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'current' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'}`}>
          Caixa atual
        </button>
        <button onClick={() => setTab('history')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${tab === 'history' ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'}`}>
          Historico
        </button>
      </div>

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : tab === 'current' ? (
        <>
          {!session ? (
            /* No open session */
            <div className="card p-8 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto">
                <Wallet className="w-7 h-7 text-slate-400" />
              </div>
              <div>
                <p className="font-bold text-slate-900 text-lg">Caixa fechado</p>
                <p className="text-slate-400 text-sm mt-1">Abra o caixa para comecar a registrar movimentacoes</p>
              </div>
              <button onClick={() => setOpenModal(true)} className="btn-primary mx-auto flex items-center gap-2">
                <Unlock className="w-4 h-4" /> Abrir caixa
              </button>
            </div>
          ) : (
            /* Active session */
            <div className="space-y-4">
              {/* Balance card */}
              <div className="card p-5 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border-emerald-200">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center">
                      <Wallet className="w-4 h-4 text-white" />
                    </div>
                    <span className="font-bold text-slate-900">Caixa aberto</span>
                    <span className="text-xs text-slate-500">{new Date(session.openedAt).toLocaleString('pt-BR')}</span>
                  </div>
                  <button onClick={() => setCloseModal(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-700 text-white text-xs font-bold hover:bg-slate-800 transition-colors">
                    <Lock className="w-3.5 h-3.5" /> Fechar caixa
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-white rounded-xl p-3 border border-emerald-100">
                    <p className="text-xs text-slate-400 mb-1">Abertura</p>
                    <p className="font-bold text-slate-900">R$ {fmt(session.openingAmount)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-emerald-100">
                    <p className="text-xs text-slate-400 mb-1">Vendas</p>
                    <p className="font-bold text-emerald-600">R$ {fmt(session.totalSales)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-emerald-100">
                    <p className="text-xs text-slate-400 mb-1">Sangrias</p>
                    <p className="font-bold text-red-600">-R$ {fmt(session.totalWithdrawals)}</p>
                  </div>
                  <div className="bg-white rounded-xl p-3 border border-emerald-200">
                    <p className="text-xs text-slate-400 mb-1">Saldo atual</p>
                    <p className="font-black text-xl text-emerald-700">R$ {fmt(balance ?? 0)}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button onClick={() => setEntryModal('withdrawal')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-red-50 border border-red-200 text-red-700 font-bold text-sm hover:bg-red-100 transition-colors">
                  <ArrowDownRight className="w-4 h-4" /> Sangria
                </button>
                <button onClick={() => setEntryModal('deposit')} className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-sm hover:bg-blue-100 transition-colors">
                  <ArrowUpRight className="w-4 h-4" /> Suprimento
                </button>
              </div>

              {/* Entries */}
              {entries.length > 0 && (
                <div className="card overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Movimentacoes desta sessao</p>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {entries.map(e => (
                      <div key={e.id} className="flex items-center justify-between px-4 py-3">
                        <div>
                          <EntryBadge type={e.type} />
                          {e.description && <p className="text-xs text-slate-500 mt-0.5">{e.description}</p>}
                          <p className="text-xs text-slate-400">{new Date(e.createdAt).toLocaleString('pt-BR')}</p>
                        </div>
                        <span className={`font-bold text-sm ${e.type === 'withdrawal' ? 'text-red-600' : 'text-emerald-600'}`}>
                          {e.type === 'withdrawal' ? '-' : '+'}R$ {fmt(e.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        /* History */
        <div className="space-y-3">
          {sessions.length === 0 ? (
            <div className="card p-12 text-center">
              <History className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhuma sessao registrada</p>
            </div>
          ) : (
            sessions.map(s => (
              <div key={s.id} className="card p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${s.status === 'open' ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                    <span className="text-sm font-bold text-slate-900">
                      {new Date(s.openedAt).toLocaleDateString('pt-BR')} — {new Date(s.openedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${s.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {s.status === 'open' ? 'Aberto' : 'Fechado'}
                    </span>
                  </div>
                  {s.closedAt && (
                    <span className="text-xs text-slate-400">Fechado: {new Date(s.closedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                  )}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <div><p className="text-xs text-slate-400">Abertura</p><p className="font-bold">R$ {fmt(s.openingAmount)}</p></div>
                  <div><p className="text-xs text-slate-400">Vendas</p><p className="font-bold text-emerald-600">R$ {fmt(s.totalSales)}</p></div>
                  <div><p className="text-xs text-slate-400">Sangrias</p><p className="font-bold text-red-600">-R$ {fmt(s.totalWithdrawals)}</p></div>
                  <div><p className="text-xs text-slate-400">Fechamento</p><p className="font-bold">{s.closingAmount !== null ? `R$ ${fmt(s.closingAmount)}` : '—'}</p></div>
                </div>
                {s.notes && <p className="text-xs text-slate-400 mt-2 italic">{s.notes}</p>}
              </div>
            ))
          )}
        </div>
      )}

      {/* Open modal */}
      {openModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Abrir caixa</p>
              <button onClick={() => setOpenModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Valor inicial (troco)</label>
                <input type="number" min="0" step="0.01" value={openAmt} onChange={e => setOpenAmt(e.target.value)} className="input w-full" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observacoes</label>
                <input value={openNotes} onChange={e => setOpenNotes(e.target.value)} className="input w-full" placeholder="Opcional..." />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setOpenModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleOpen} disabled={saving || !openAmt} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                Abrir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Close modal */}
      {closeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Fechar caixa</p>
              <button onClick={() => setCloseModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1">
                <div className="flex justify-between"><span className="text-slate-500">Saldo esperado:</span><span className="font-bold">R$ {fmt(balance ?? 0)}</span></div>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Valor contado no caixa</label>
                <input type="number" min="0" step="0.01" value={closeAmt} onChange={e => setCloseAmt(e.target.value)} className="input w-full" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Observacoes</label>
                <input value={closeNotes} onChange={e => setCloseNotes(e.target.value)} className="input w-full" placeholder="Opcional..." />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setCloseModal(false)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleClose} disabled={saving || !closeAmt} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry modal (sangria / suprimento) */}
      {entryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">{entryModal === 'withdrawal' ? 'Sangria' : 'Suprimento'}</p>
              <button onClick={() => setEntryModal(null)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Valor</label>
                <input type="number" min="0.01" step="0.01" value={entryAmt} onChange={e => setEntryAmt(e.target.value)} className="input w-full" placeholder="0,00" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Descricao</label>
                <input value={entryDesc} onChange={e => setEntryDesc(e.target.value)} className="input w-full" placeholder={entryModal === 'withdrawal' ? 'Ex: Pagamento fornecedor...' : 'Ex: Troco adicional...'} />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setEntryModal(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={handleEntry} disabled={saving || !entryAmt} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

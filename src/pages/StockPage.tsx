import { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { MenuItem } from '../lib/types';
import { Package, AlertTriangle, Plus, Minus, ToggleLeft, ToggleRight, History, X, Check, Loader2 } from 'lucide-react';

type Movement = { id: string; delta: number; reason: string; createdAt: string };

function StockBadge({ stock }: { stock: number | null | undefined }) {
  if (stock === null || stock === undefined) return <span className="text-xs text-slate-400">Sem controle</span>;
  if (stock === 0) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">Esgotado</span>;
  if (stock <= 5) return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-700 border border-amber-200">{stock} restantes</span>;
  return <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">{stock} em estoque</span>;
}

export default function StockPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adjustId, setAdjustId] = useState<string | null>(null);
  const [delta, setDelta] = useState(0);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [historyItem, setHistoryItem] = useState<string | null>(null);
  const [movements, setMovements] = useState<Movement[]>([]);
  const [movLoading, setMovLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'low' | 'out'>('all');

  const load = async () => {
    if (!user) return;
    const data = await db.getMenuItems(user.id);
    setItems(data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  const tracked = useMemo(() => items.filter(i => i.stock !== null && i.stock !== undefined), [items]);
  const untracked = useMemo(() => items.filter(i => i.stock === null || i.stock === undefined), [items]);

  const filtered = useMemo(() => {
    if (filter === 'low') return tracked.filter(i => (i.stock ?? 0) > 0 && (i.stock ?? 0) <= 10);
    if (filter === 'out') return tracked.filter(i => (i.stock ?? 0) === 0);
    return tracked;
  }, [tracked, filter]);

  const outCount = tracked.filter(i => (i.stock ?? 0) === 0).length;
  const lowCount = tracked.filter(i => (i.stock ?? 0) > 0 && (i.stock ?? 0) <= 10).length;

  const openAdjust = (id: string) => {
    setAdjustId(id);
    setDelta(0);
    setReason('');
  };

  const saveAdjust = async () => {
    if (!user || adjustId === null || delta === 0) return;
    setSaving(true);
    await db.addStockMovement(user.id, adjustId, delta, reason);
    await load();
    setSaving(false);
    setAdjustId(null);
  };

  const enableTracking = async (item: MenuItem) => {
    await db.updateMenuItem(item.id, { stock: 0 });
    await load();
  };

  const disableTracking = async (item: MenuItem) => {
    await db.updateMenuItem(item.id, { stock: null as unknown as undefined });
    await load();
  };

  const openHistory = async (id: string) => {
    if (!user) return;
    setHistoryItem(id);
    setMovLoading(true);
    const data = await db.getStockMovements(user.id, id);
    setMovements(data);
    setMovLoading(false);
  };

  if (!user) return null;

  const adjustItem = items.find(i => i.id === adjustId);
  const histItem = items.find(i => i.id === historyItem);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Gestao de Estoque</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Controle de quantidade por produto com historico de movimentacoes</p>
        </div>
      </div>

      {/* Alerts */}
      {(outCount > 0 || lowCount > 0) && (
        <div className="flex flex-wrap gap-3">
          {outCount > 0 && (
            <button onClick={() => setFilter('out')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${filter === 'out' ? 'bg-red-600 text-white border-red-600' : 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'}`}>
              <AlertTriangle className="w-4 h-4" /> {outCount} produto{outCount !== 1 ? 's' : ''} esgotado{outCount !== 1 ? 's' : ''}
            </button>
          )}
          {lowCount > 0 && (
            <button onClick={() => setFilter('low')} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-all ${filter === 'low' ? 'bg-amber-600 text-white border-amber-600' : 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100'}`}>
              <AlertTriangle className="w-4 h-4" /> {lowCount} com estoque baixo
            </button>
          )}
          {filter !== 'all' && (
            <button onClick={() => setFilter('all')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-500 text-sm hover:bg-slate-50 transition-colors">
              <X className="w-4 h-4" /> Ver todos
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Tracked items */}
          {filtered.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Produtos com controle de estoque ({filtered.length})</p>
              </div>
              <div className="divide-y divide-slate-100">
                {filtered.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
                      <StockBadge stock={item.stock} />
                    </div>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <button onClick={() => openHistory(item.id)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors" title="Historico">
                        <History className="w-4 h-4 text-slate-400" />
                      </button>
                      <button onClick={() => openAdjust(item.id)} className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors">
                        Ajustar
                      </button>
                      <button onClick={() => disableTracking(item)} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors" title="Desativar controle">
                        <ToggleRight className="w-4.5 h-4.5 text-emerald-500" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Untracked items */}
          {untracked.length > 0 && filter === 'all' && (
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sem controle de estoque ({untracked.length})</p>
              </div>
              <div className="divide-y divide-slate-100">
                {untracked.map(item => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 opacity-70">
                    <span className="text-xl">{item.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-700 text-sm truncate">{item.name}</p>
                      <StockBadge stock={null} />
                    </div>
                    <button onClick={() => enableTracking(item)} className="px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1">
                      <ToggleLeft className="w-4 h-4" /> Ativar controle
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {items.length === 0 && (
            <div className="card p-16 text-center">
              <Package className="w-10 h-10 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">Nenhum produto encontrado</p>
              <p className="text-slate-400 text-sm mt-1">Adicione produtos no Cardapio primeiro</p>
            </div>
          )}
        </>
      )}

      {/* Adjust modal */}
      {adjustId && adjustItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Ajustar estoque — {adjustItem.emoji} {adjustItem.name}</p>
              <button onClick={() => setAdjustId(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-xs font-semibold text-slate-500 mb-2">Estoque atual: <span className="text-slate-900">{adjustItem.stock ?? 0}</span></p>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Quantidade (+ entrada / - saida)</label>
                <div className="flex items-center gap-2">
                  <button onClick={() => setDelta(d => d - 1)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                    <Minus className="w-4 h-4" />
                  </button>
                  <input
                    type="number"
                    value={delta}
                    onChange={e => setDelta(Number(e.target.value))}
                    className="input w-24 text-center font-bold text-lg"
                  />
                  <button onClick={() => setDelta(d => d + 1)} className="p-2 rounded-xl border border-slate-200 hover:bg-slate-100 transition-colors">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-1.5">Novo estoque: <span className={`font-bold ${Math.max(0, (adjustItem.stock ?? 0) + delta) === 0 ? 'text-red-600' : 'text-emerald-600'}`}>{Math.max(0, (adjustItem.stock ?? 0) + delta)}</span></p>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Motivo</label>
                <input value={reason} onChange={e => setReason(e.target.value)} className="input w-full" placeholder="Ex: Reposicao, Venda manual, Perda..." />
              </div>
            </div>
            <div className="px-5 pb-5 flex gap-2">
              <button onClick={() => setAdjustId(null)} className="btn-secondary flex-1">Cancelar</button>
              <button onClick={saveAdjust} disabled={saving || delta === 0} className="btn-primary flex-1 flex items-center justify-center gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? 'Salvando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyItem && histItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <p className="font-bold text-slate-900">Historico — {histItem.emoji} {histItem.name}</p>
              <button onClick={() => setHistoryItem(null)} className="p-1 rounded-lg hover:bg-slate-100"><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {movLoading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-emerald-500" /></div>
              ) : movements.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-sm">Nenhuma movimentacao registrada</div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {movements.map(m => (
                    <div key={m.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-700">{m.reason || 'Ajuste manual'}</p>
                        <p className="text-xs text-slate-400">{new Date(m.createdAt).toLocaleString('pt-BR')}</p>
                      </div>
                      <span className={`font-bold text-sm ${m.delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                        {m.delta > 0 ? '+' : ''}{m.delta}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

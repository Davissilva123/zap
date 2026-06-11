import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { PurchaseOrder, PurchaseOrderItem, Supplier } from '../lib/types';
import { ClipboardList, Plus, Edit2, Trash2, X, Save, ChevronDown, ChevronRight, Send, Package, CheckCircle2 } from 'lucide-react';

const STATUS_CFG = {
  draft:     { label: 'Rascunho',  cls: 'bg-slate-100 text-slate-600' },
  sent:      { label: 'Enviado',   cls: 'bg-blue-100 text-blue-700'   },
  received:  { label: 'Recebido', cls: 'bg-green-100 text-green-700'  },
  cancelled: { label: 'Cancelado', cls: 'bg-red-100 text-red-600'     },
};

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

interface ItemForm { id?: string; name: string; quantity: string; unit: string; unitCost: string }
const emptyItem = (): ItemForm => ({ name: '', quantity: '', unit: 'un', unitCost: '' });

export default function PurchaseOrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [itemForms, setItemForms] = useState<Record<string, ItemForm[]>>({});
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<PurchaseOrder>>({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    if (!user) return;
    const [pos, sups] = await Promise.all([db.getPurchaseOrders(user.id), db.getSuppliers(user.id)]);
    setOrders(pos);
    setSuppliers(sups.filter(s => s.active));
  };

  useEffect(() => { load(); }, [user]);

  const toggleExpand = async (id: string) => {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!itemForms[id]) {
      const items = await db.getPurchaseOrderItems(id);
      setItemForms(prev => ({ ...prev, [id]: items.map(i => ({ id: i.id, name: i.name, quantity: String(i.quantity), unit: i.unit, unitCost: String(i.unitCost) })) }));
    }
  };

  const openNew = () => { setForm({ status: 'draft', notes: '' }); setModal(true); };
  const close = () => { setModal(false); setForm({}); };

  const saveOrder = async () => {
    if (!user) return;
    setSaving(true);
    const id = await db.upsertPurchaseOrder(user.id, form);
    await load();
    setSaving(false);
    close();
    setExpanded(id);
    setItemForms(prev => ({ ...prev, [id]: [emptyItem()] }));
  };

  const addItemRow = (orderId: string) => setItemForms(prev => ({ ...prev, [orderId]: [...(prev[orderId] ?? []), emptyItem()] }));

  const updateItemRow = (orderId: string, idx: number, field: keyof ItemForm, val: string) =>
    setItemForms(prev => ({ ...prev, [orderId]: prev[orderId].map((r, i) => i === idx ? { ...r, [field]: val } : r) }));

  const removeItemRow = async (orderId: string, idx: number) => {
    const row = itemForms[orderId]?.[idx];
    if (row?.id) await db.deletePurchaseOrderItem(row.id);
    setItemForms(prev => ({ ...prev, [orderId]: prev[orderId].filter((_, i) => i !== idx) }));
  };

  const saveItems = async (orderId: string) => {
    if (!user) return;
    setSaving(true);
    const forms = itemForms[orderId] ?? [];
    await Promise.all(forms.filter(f => f.name.trim()).map(f =>
      db.upsertPurchaseOrderItem(user.id, { id: f.id, orderId, name: f.name.trim(), quantity: parseFloat(f.quantity) || 0, unit: f.unit, unitCost: parseFloat(f.unitCost) || 0 })
    ));
    const total = forms.reduce((s, f) => s + (parseFloat(f.quantity) || 0) * (parseFloat(f.unitCost) || 0), 0);
    await db.upsertPurchaseOrder(user.id, { id: orderId, total });
    await load();
    setSaving(false);
  };

  const setStatus = async (id: string, status: PurchaseOrder['status']) => {
    const updates: Partial<PurchaseOrder> = { id, status };
    if (status === 'received') updates.receivedDate = new Date().toISOString().slice(0, 10);
    await db.upsertPurchaseOrder(user.id!, updates);
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
  };

  const del = async (id: string) => {
    if (!confirm('Excluir pedido de compra?')) return;
    await db.deletePurchaseOrder(id);
    setOrders(prev => prev.filter(o => o.id !== id));
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ClipboardList size={22} className="text-emerald-600" />
          <div>
            <h1 className="text-xl font-bold text-slate-800">Pedidos de Compra</h1>
            <p className="text-sm text-slate-500">{orders.filter(o => o.status === 'sent').length} aguardando recebimento</p>
          </div>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-medium">
          <Plus size={16} /> Novo pedido
        </button>
      </div>

      <div className="space-y-3">
        {orders.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-3">
            <ClipboardList size={40} className="opacity-20" />
            <p className="text-sm">Nenhum pedido de compra</p>
          </div>
        )}
        {orders.map(order => {
          const cfg = STATUS_CFG[order.status];
          const isOpen = expanded === order.id;
          const forms = itemForms[order.id] ?? [];

          return (
            <div key={order.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <button onClick={() => toggleExpand(order.id)} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-slate-50 text-left">
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-slate-800">#{order.id.slice(-6).toUpperCase()}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg.cls}`}>{cfg.label}</span>
                    {order.supplierName && <span className="text-sm text-slate-500">{order.supplierName}</span>}
                  </div>
                  <div className="flex items-center gap-4 mt-0.5 text-xs text-slate-400">
                    <span>{new Date(order.createdAt).toLocaleDateString('pt-BR')}</span>
                    {order.expectedDate && <span>Previsão: {new Date(order.expectedDate + 'T00:00:00').toLocaleDateString('pt-BR')}</span>}
                    {order.total > 0 && <span className="font-semibold text-slate-600">{fmt(order.total)}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {order.status === 'draft' && (
                    <button onClick={e => { e.stopPropagation(); setStatus(order.id, 'sent'); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-xs hover:bg-blue-100">
                      <Send size={12} /> Enviar
                    </button>
                  )}
                  {order.status === 'sent' && (
                    <button onClick={e => { e.stopPropagation(); setStatus(order.id, 'received'); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-lg text-xs hover:bg-green-100">
                      <CheckCircle2 size={12} /> Recebido
                    </button>
                  )}
                  <button onClick={e => { e.stopPropagation(); del(order.id); }} className="p-1.5 text-slate-400 hover:text-red-500"><Trash2 size={14} /></button>
                  {isOpen ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-3">
                  <table className="w-full text-sm mb-3">
                    <thead>
                      <tr className="text-xs text-slate-500 border-b border-slate-100">
                        <th className="text-left pb-2 font-medium">Item</th>
                        <th className="text-left pb-2 font-medium w-24">Qtd</th>
                        <th className="text-left pb-2 font-medium w-20">Un</th>
                        <th className="text-left pb-2 font-medium w-28">Custo unit</th>
                        <th className="text-left pb-2 font-medium w-24">Total</th>
                        <th className="w-8"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {forms.map((row, idx) => {
                        const rowTotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.unitCost) || 0);
                        return (
                          <tr key={idx}>
                            <td className="py-1.5 pr-2">
                              <input value={row.name} onChange={e => updateItemRow(order.id, idx, 'name', e.target.value)}
                                placeholder="ex: Farinha"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input value={row.quantity} onChange={e => updateItemRow(order.id, idx, 'quantity', e.target.value)}
                                type="number" min="0"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={row.unit} onChange={e => updateItemRow(order.id, idx, 'unit', e.target.value)}
                                className="w-full border border-slate-200 rounded-lg px-1 py-1 text-xs focus:outline-none">
                                {['un','kg','g','L','ml','cx','pct'].map(u => <option key={u}>{u}</option>)}
                              </select>
                            </td>
                            <td className="py-1.5 pr-2">
                              <input value={row.unitCost} onChange={e => updateItemRow(order.id, idx, 'unitCost', e.target.value)}
                                type="number" min="0" step="0.01" placeholder="0,00"
                                className="w-full border border-slate-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-emerald-500" />
                            </td>
                            <td className="py-1.5 pr-2 text-xs font-medium text-slate-600 whitespace-nowrap">{fmt(rowTotal)}</td>
                            <td><button onClick={() => removeItemRow(order.id, idx)} className="text-red-400 hover:text-red-600"><Trash2 size={12} /></button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between">
                    <button onClick={() => addItemRow(order.id)} className="flex items-center gap-1.5 text-sm text-emerald-600 hover:text-emerald-700 font-medium">
                      <Plus size={14} /> Adicionar item
                    </button>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-slate-600 font-medium">Total: {fmt(forms.reduce((s, f) => s + (parseFloat(f.quantity)||0)*(parseFloat(f.unitCost)||0), 0))}</span>
                      <button onClick={() => saveItems(order.id)} disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-60 text-white rounded-lg text-sm font-medium">
                        <Save size={14} />{saving ? 'Salvando...' : 'Salvar itens'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
              <h2 className="font-semibold text-slate-800">Novo pedido de compra</h2>
              <button onClick={close} className="p-1.5 rounded-lg hover:bg-slate-100"><X size={16} /></button>
            </div>
            <div className="px-6 py-4 space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Fornecedor</label>
                <select value={form.supplierId ?? ''} onChange={e => setForm(p => ({ ...p, supplierId: e.target.value || null }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Selecione (opcional)</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Data de entrega prevista</label>
                <input type="date" value={form.expectedDate ?? ''} onChange={e => setForm(p => ({ ...p, expectedDate: e.target.value }))}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Observações</label>
                <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} rows={2}
                  className="mt-1 w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 flex gap-3 justify-end">
              <button onClick={close} className="px-4 py-2 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50">Cancelar</button>
              <button onClick={saveOrder} disabled={saving}
                className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-60 flex items-center gap-2">
                <Save size={14} />{saving ? 'Criando...' : 'Criar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

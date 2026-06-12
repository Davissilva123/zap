import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, RestaurantSettings } from '../lib/types';
import { LayoutGrid, Loader2, CheckCircle, DollarSign, Clock, Printer, Percent, X } from 'lucide-react';
import { printOrder } from '../lib/print';

function elapsed(createdAt: string) {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

type DiscountModal = { table: string; type: 'percent' | 'fixed'; value: string };

export default function ComandasPage() {
  const restaurantId = useRestaurantId();
  const { operatorInfo } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [discountModal, setDiscountModal] = useState<DiscountModal | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

  // Garçom só pode dar desconto se o dono habilitou a permissão
  const isWaiter = operatorInfo?.role === 'waiter';
  const canDiscount = !isWaiter || (settings?.waiterDiscountEnabled ?? false);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [all, st] = await Promise.all([db.getOrders(restaurantId), db.getSettings(restaurantId)]);
    const active = all.filter(o =>
      o.deliveryType === 'table' &&
      ['PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERING'].includes(o.status)
    );
    setOrders(active);
    setSettings(st);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    load();
    const channel = supabase
      .channel(`comandas:${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${restaurantId}` }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [restaurantId, load]);

  const closeTable = async (tableName: string, tableOrders: Order[]) => {
    if (!confirm(`Fechar conta da ${tableName}? Todos os pedidos ativos serão marcados como concluídos.`)) return;
    setClosing(tableName);
    await Promise.all(tableOrders.map(o => db.updateOrder(o.id, { status: 'COMPLETED' })));
    await load();
    setClosing(null);
  };

  const printTable = (tableName: string, tableOrders: Order[]) => {
    if (!settings) return;
    const totalDiscount = tableOrders.reduce((s, o) => s + (o.discount || 0), 0);
    const merged: Order = {
      ...tableOrders[0],
      items: tableOrders.flatMap(o => o.items),
      total: tableOrders.reduce((s, o) => s + o.total, 0),
      discount: totalDiscount,
      customerName: `Mesa ${tableName}`,
      notes: tableOrders.filter(o => o.notes).map(o => o.notes).join(' | ') || undefined,
    };
    printOrder(merged, settings);
  };

  const openDiscountModal = (tableName: string) => {
    setDiscountModal({ table: tableName, type: 'percent', value: '' });
  };

  const applyDiscount = async (tableOrders: Order[]) => {
    if (!discountModal || !discountModal.value) return;
    const numValue = Number(discountModal.value.replace(',', '.'));
    if (isNaN(numValue) || numValue <= 0) return;

    const gross = tableOrders.reduce((s, o) => s + o.total, 0);
    const discountAmount = discountModal.type === 'percent'
      ? Math.min(gross * numValue / 100, gross)
      : Math.min(numValue, gross);

    setApplyingDiscount(true);
    // Zera desconto de todos os pedidos e aplica no primeiro
    const sorted = [...tableOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await Promise.all(sorted.slice(1).map(o => db.updateOrder(o.id, { discount: 0 })));
    await db.updateOrder(sorted[0].id, { discount: discountAmount });
    setDiscountModal(null);
    setApplyingDiscount(false);
    await load();
  };

  const removeDiscount = async (tableOrders: Order[]) => {
    setApplyingDiscount(true);
    await Promise.all(tableOrders.map(o => db.updateOrder(o.id, { discount: 0 })));
    setApplyingDiscount(false);
    await load();
  };

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  // Group by table name
  const byTable: Record<string, Order[]> = {};
  orders.forEach(o => {
    const t = o.tableName || 'Sem mesa';
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push(o);
  });
  const tables = Object.entries(byTable).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <LayoutGrid className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Comandas</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              <span className="text-violet-600 font-semibold">{tables.length} mesa{tables.length !== 1 ? 's' : ''} ativa{tables.length !== 1 ? 's' : ''}</span>
              {' · '}
              <span className="text-emerald-600 font-semibold">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
        </div>
      </div>

      {tables.length === 0 && (
        <div className="card p-16 text-center">
          <LayoutGrid className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma mesa com pedido ativo</p>
          <p className="text-slate-400 text-sm mt-1">Os pedidos de mesa aparecerão aqui</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.map(([tableName, tableOrders]) => {
          const gross = tableOrders.reduce((s, o) => s + o.total, 0);
          const totalDiscount = tableOrders.reduce((s, o) => s + (o.discount || 0), 0);
          const netTotal = gross - totalDiscount;
          const oldest = tableOrders.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
          const allItems = tableOrders.flatMap(o => o.items);
          const itemMap: Record<string, { name: string; emoji: string; qty: number; price: number }> = {};
          allItems.forEach(i => {
            if (!itemMap[i.menuItemId + i.name]) itemMap[i.menuItemId + i.name] = { name: i.name, emoji: i.emoji, qty: 0, price: i.price };
            itemMap[i.menuItemId + i.name].qty += i.quantity;
          });
          const isClosing = closing === tableName;
          const isDiscountOpen = discountModal?.table === tableName;

          return (
            <div key={tableName} className="card overflow-hidden">
              {/* Header */}
              <div className="bg-violet-50 border-b border-violet-100 px-5 py-4 flex items-center justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-base">Mesa {tableName}</p>
                  <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {elapsed(oldest.createdAt)} · {tableOrders.length} pedido{tableOrders.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`text-2xl font-extrabold leading-none ${totalDiscount > 0 ? 'text-emerald-600' : 'text-emerald-600'}`}>
                    R$ {netTotal.toFixed(2).replace('.', ',')}
                  </p>
                  {totalDiscount > 0 && (
                    <p className="text-[11px] text-slate-400 mt-0.5 line-through">R$ {gross.toFixed(2).replace('.', ',')}</p>
                  )}
                  <p className="text-[11px] text-slate-400 mt-0.5">total acumulado</p>
                </div>
              </div>

              {/* Items summary */}
              <div className="px-5 py-3 space-y-1.5 max-h-52 overflow-y-auto">
                {Object.values(itemMap).map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-slate-700">{item.emoji} {item.name}</span>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-500 bg-slate-100 rounded-full px-2 py-0.5">{item.qty}x</span>
                      <span className="text-xs text-slate-500 font-semibold">R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}</span>
                    </div>
                  </div>
                ))}
                {tableOrders.some(o => o.notes) && (
                  <div className="pt-1.5 border-t border-slate-100">
                    {tableOrders.filter(o => o.notes).map(o => (
                      <p key={o.id} className="text-xs text-slate-500 italic">Obs: {o.notes}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* Discount inline form */}
              {isDiscountOpen && discountModal && (
                <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-amber-700">Aplicar desconto</span>
                    <button onClick={() => setDiscountModal(null)} className="text-amber-400 hover:text-amber-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDiscountModal(d => d ? { ...d, type: 'percent' } : d)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${discountModal.type === 'percent' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-600'}`}
                    >
                      <Percent className="w-3 h-3" /> %
                    </button>
                    <button
                      onClick={() => setDiscountModal(d => d ? { ...d, type: 'fixed' } : d)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${discountModal.type === 'fixed' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-600'}`}
                    >
                      R$
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountModal.value}
                      onChange={e => setDiscountModal(d => d ? { ...d, value: e.target.value } : d)}
                      placeholder={discountModal.type === 'percent' ? 'Ex: 10' : 'Ex: 5,00'}
                      className="flex-1 px-3 py-1.5 border border-amber-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <button
                      onClick={() => applyDiscount(tableOrders)}
                      disabled={!discountModal.value || applyingDiscount}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 transition-colors disabled:opacity-50"
                    >
                      {applyingDiscount ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                    </button>
                  </div>
                  {discountModal.value && (
                    <p className="text-[11px] text-amber-600 font-medium">
                      Desconto: R$ {(discountModal.type === 'percent'
                        ? Math.min(gross * Number(discountModal.value.replace(',', '.')) / 100, gross)
                        : Math.min(Number(discountModal.value.replace(',', '.')), gross)
                      ).toFixed(2).replace('.', ',')}
                      {' '}→ Total: R$ {(gross - (discountModal.type === 'percent'
                        ? Math.min(gross * Number(discountModal.value.replace(',', '.')) / 100, gross)
                        : Math.min(Number(discountModal.value.replace(',', '.')), gross)
                      )).toFixed(2).replace('.', ',')}
                    </p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="px-4 pb-3 flex gap-2">
                <button
                  onClick={() => printTable(tableName, tableOrders)}
                  disabled={!settings}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
                {canDiscount && !isDiscountOpen && (
                  <button
                    onClick={() => openDiscountModal(tableName)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-[13px] font-medium hover:bg-amber-100 transition-colors"
                  >
                    <Percent className="w-4 h-4" /> Desconto
                  </button>
                )}
                <button
                  onClick={() => closeTable(tableName, tableOrders)}
                  disabled={isClosing}
                  className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-emerald-500 text-white text-[13px] font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60"
                >
                  {isClosing ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Fechar conta</>}
                </button>
              </div>

              {/* Per-order status dots */}
              <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                {tableOrders.map(o => (
                  <span key={o.id} className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    o.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    o.status === 'PAID' ? 'bg-emerald-100 text-emerald-700' :
                    o.status === 'PREPARING' ? 'bg-blue-100 text-blue-700' :
                    o.status === 'READY' ? 'bg-orange-100 text-orange-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {o.status === 'PENDING' ? 'Pendente' : o.status === 'PAID' ? 'Pago' : o.status === 'PREPARING' ? 'Preparando' : o.status === 'READY' ? 'Pronto' : o.status}
                    {' '}· R$ {o.total.toFixed(2).replace('.', ',')}
                  </span>
                ))}
              </div>

              {/* Footer: total e desconto aplicado */}
              <div className="px-5 pb-4 flex items-center justify-between border-t border-slate-100 pt-3">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                  <span className="text-sm font-bold text-slate-700">
                    Total a cobrar: <span className="text-emerald-600">R$ {netTotal.toFixed(2).replace('.', ',')}</span>
                  </span>
                </div>
                {totalDiscount > 0 && (
                  <button
                    onClick={() => removeDiscount(tableOrders)}
                    disabled={applyingDiscount}
                    title="Remover desconto"
                    className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3 h-3" /> Desconto: -R$ {totalDiscount.toFixed(2).replace('.', ',')}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

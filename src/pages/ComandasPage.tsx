import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useRestaurantId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, RestaurantSettings } from '../lib/types';
import { LayoutGrid, Loader2, CheckCircle, DollarSign, Clock, Printer } from 'lucide-react';
import { printOrder } from '../lib/print';

function elapsed(createdAt: string) {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

export default function ComandasPage() {
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [all, st] = await Promise.all([db.getOrders(restaurantId), db.getSettings(restaurantId)]);
    const active = all.filter(o =>
      o.deliveryType === 'table' &&
      ['PENDING', 'PAID', 'PREPARING', 'DELIVERING'].includes(o.status)
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
    const merged: Order = {
      ...tableOrders[0],
      items: tableOrders.flatMap(o => o.items),
      total: tableOrders.reduce((s, o) => s + o.total, 0),
      customerName: `Mesa ${tableName}`,
      notes: tableOrders.filter(o => o.notes).map(o => o.notes).join(' | ') || undefined,
    };
    printOrder(merged, settings);
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
          const total = tableOrders.reduce((s, o) => s + o.total, 0);
          const oldest = tableOrders.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
          const allItems = tableOrders.flatMap(o => o.items);
          const itemMap: Record<string, { name: string; emoji: string; qty: number; price: number }> = {};
          allItems.forEach(i => {
            if (!itemMap[i.menuItemId + i.name]) itemMap[i.menuItemId + i.name] = { name: i.name, emoji: i.emoji, qty: 0, price: i.price };
            itemMap[i.menuItemId + i.name].qty += i.quantity;
          });
          const isClosing = closing === tableName;

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
                  <p className="text-2xl font-extrabold text-emerald-600 leading-none">R$ {total.toFixed(2).replace('.', ',')}</p>
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

              {/* Actions */}
              <div className="px-4 pb-4 flex gap-2">
                <button
                  onClick={() => printTable(tableName, tableOrders)}
                  disabled={!settings}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-600 text-[13px] font-medium hover:bg-slate-50 transition-colors disabled:opacity-40"
                >
                  <Printer className="w-4 h-4" /> Imprimir
                </button>
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
                    o.status === 'PREPARING' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {o.status === 'PENDING' ? 'Pendente' : o.status === 'PAID' ? 'Pago' : o.status === 'PREPARING' ? 'Preparando' : o.status}
                    {' '}· R$ {o.total.toFixed(2).replace('.', ',')}
                  </span>
                ))}
              </div>

              {/* DollarSign total accent */}
              <div className="px-5 pb-4 flex items-center gap-2 border-t border-slate-100 pt-3">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                <span className="text-sm font-bold text-slate-700">Total a cobrar: <span className="text-emerald-600">R$ {total.toFixed(2).replace('.', ',')}</span></span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

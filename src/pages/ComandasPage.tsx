import { useEffect, useState, useCallback } from 'react';
import { db } from '../lib/db';
import { useAuth, useRestaurantId } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, RestaurantSettings } from '../lib/types';
import { LayoutGrid, Loader2, CheckCircle, Clock, Printer, Percent, X, ChefHat, Truck, AlertCircle } from 'lucide-react';
import { printOrder } from '../lib/print';

function elapsed(createdAt: string) {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string; icon: typeof Clock }> = {
  PENDING:   { label: 'Aguardando',  color: 'text-amber-700',  bg: 'bg-amber-50 border-amber-200',   icon: AlertCircle },
  PAID:      { label: 'Pago',        color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', icon: CheckCircle },
  PREPARING: { label: 'Preparando',  color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',     icon: ChefHat },
  READY:     { label: 'Pronto',      color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: ChefHat },
  DELIVERING:{ label: 'A caminho',   color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',     icon: Truck },
};

type DiscountModal = { table: string; type: 'percent' | 'fixed'; value: string };

function tableLabelName(name: string) {
  // Avoid "Mesa Mesa 1" if tableName already starts with "Mesa"
  return /^mesa\s/i.test(name) ? name : `Mesa ${name}`;
}

export default function ComandasPage() {
  const restaurantId = useRestaurantId();
  const { operatorInfo } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [closing, setClosing] = useState<string | null>(null);
  const [discountModal, setDiscountModal] = useState<DiscountModal | null>(null);
  const [applyingDiscount, setApplyingDiscount] = useState(false);

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
    if (!confirm(`Fechar a conta da ${tableLabelName(tableName)}? Todos os pedidos serão marcados como concluídos.`)) return;
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
      customerName: tableLabelName(tableName),
      notes: tableOrders.filter(o => o.notes).map(o => o.notes).join(' | ') || undefined,
    };
    printOrder(merged, settings);
  };

  const applyDiscount = async (tableOrders: Order[]) => {
    if (!discountModal?.value) return;
    const num = Number(discountModal.value.replace(',', '.'));
    if (isNaN(num) || num <= 0) return;
    const gross = tableOrders.reduce((s, o) => s + o.total, 0);
    const amount = discountModal.type === 'percent'
      ? Math.min(gross * num / 100, gross)
      : Math.min(num, gross);
    setApplyingDiscount(true);
    const sorted = [...tableOrders].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    await Promise.all(sorted.slice(1).map(o => db.updateOrder(o.id, { discount: 0 })));
    await db.updateOrder(sorted[0].id, { discount: amount });
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

  const byTable: Record<string, Order[]> = {};
  orders.forEach(o => {
    const t = o.tableName || 'Sem mesa';
    if (!byTable[t]) byTable[t] = [];
    byTable[t].push(o);
  });
  const tables = Object.entries(byTable).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-violet-100 flex items-center justify-center flex-shrink-0">
          <LayoutGrid className="w-5 h-5 text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Comandas</h1>
          <p className="text-slate-400 text-sm">
            {tables.length === 0
              ? 'Nenhuma mesa ativa'
              : <><span className="text-violet-600 font-semibold">{tables.length} mesa{tables.length !== 1 ? 's' : ''}</span> · <span className="text-emerald-600 font-semibold">{orders.length} pedido{orders.length !== 1 ? 's' : ''}</span></>
            }
          </p>
        </div>
      </div>

      {tables.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center">
            <LayoutGrid className="w-7 h-7 text-slate-300" />
          </div>
          <p className="text-slate-500 font-medium">Nenhuma mesa com pedido ativo</p>
          <p className="text-slate-400 text-sm">Os pedidos de mesa aparecem aqui em tempo real</p>
        </div>
      )}

      <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {tables.map(([tableName, tableOrders]) => {
          const gross = tableOrders.reduce((s, o) => s + o.total, 0);
          const totalDiscount = tableOrders.reduce((s, o) => s + (o.discount || 0), 0);
          const net = gross - totalDiscount;
          const oldest = tableOrders.reduce((a, b) => a.createdAt < b.createdAt ? a : b);
          const isClosing = closing === tableName;
          const isDiscountOpen = discountModal?.table === tableName;

          // Merge items by name+id
          const itemMap: Record<string, { name: string; emoji: string; qty: number; price: number }> = {};
          tableOrders.flatMap(o => o.items).forEach(i => {
            const k = i.menuItemId + i.name;
            if (!itemMap[k]) itemMap[k] = { name: i.name, emoji: i.emoji, qty: 0, price: i.price };
            itemMap[k].qty += i.quantity;
          });
          const items = Object.values(itemMap);

          // Notes
          const notes = tableOrders.filter(o => o.notes).map(o => o.notes).filter(Boolean);

          // Per-order status summary
          const statusGroups: Record<string, number> = {};
          tableOrders.forEach(o => { statusGroups[o.status] = (statusGroups[o.status] || 0) + 1; });

          return (
            <div key={tableName} className="bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">

              {/* ── Card header ── */}
              <div className="px-5 pt-5 pb-4 flex items-start justify-between gap-3 border-b border-slate-100">
                <div>
                  <p className="font-bold text-slate-900 text-[17px] leading-tight">{tableLabelName(tableName)}</p>
                  <div className="flex items-center gap-1.5 mt-1 text-slate-400 text-xs">
                    <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>{elapsed(oldest.createdAt)}</span>
                    <span className="text-slate-200">·</span>
                    <span>{tableOrders.length} pedido{tableOrders.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-2xl font-extrabold text-emerald-600 leading-none tracking-tight">
                    R$ {net.toFixed(2).replace('.', ',')}
                  </p>
                  {totalDiscount > 0 && (
                    <p className="text-xs text-slate-400 line-through mt-0.5">R$ {gross.toFixed(2).replace('.', ',')}</p>
                  )}
                </div>
              </div>

              {/* ── Items ── */}
              <div className="px-5 py-3 space-y-2 flex-1 max-h-48 overflow-y-auto">
                {items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.emoji && <span className="text-base leading-none flex-shrink-0">{item.emoji}</span>}
                      <span className="text-sm text-slate-700 font-medium truncate">{item.name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs font-bold text-slate-400 bg-slate-100 rounded-full px-2 py-0.5">{item.qty}x</span>
                      <span className="text-sm font-semibold text-slate-600 w-16 text-right">
                        R$ {(item.price * item.qty).toFixed(2).replace('.', ',')}
                      </span>
                    </div>
                  </div>
                ))}
                {notes.length > 0 && (
                  <div className="pt-2 border-t border-slate-100 space-y-0.5">
                    {notes.map((n, i) => (
                      <p key={i} className="text-xs text-amber-600 italic">⚠️ {n}</p>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Status por pedido ── */}
              <div className="px-5 pb-3 flex flex-wrap gap-1.5">
                {Object.entries(statusGroups).map(([status, count]) => {
                  const cfg = STATUS_MAP[status];
                  if (!cfg) return null;
                  const Icon = cfg.icon;
                  return (
                    <span key={status} className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg border ${cfg.bg} ${cfg.color}`}>
                      <Icon className="w-3 h-3" />
                      {cfg.label}{count > 1 ? ` ×${count}` : ''}
                    </span>
                  );
                })}
              </div>

              {/* ── Desconto inline ── */}
              {isDiscountOpen && discountModal && (
                <div className="mx-4 mb-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-amber-700">Aplicar desconto</span>
                    <button onClick={() => setDiscountModal(null)} className="text-amber-400 hover:text-amber-600">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDiscountModal(d => d ? { ...d, type: 'percent' } : d)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${discountModal.type === 'percent' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-600'}`}
                    >
                      %
                    </button>
                    <button
                      onClick={() => setDiscountModal(d => d ? { ...d, type: 'fixed' } : d)}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${discountModal.type === 'fixed' ? 'bg-amber-500 text-white' : 'bg-white border border-amber-200 text-amber-600'}`}
                    >
                      R$
                    </button>
                    <input
                      type="number" min="0" step="0.01"
                      value={discountModal.value}
                      onChange={e => setDiscountModal(d => d ? { ...d, value: e.target.value } : d)}
                      placeholder={discountModal.type === 'percent' ? '10' : '5,00'}
                      className="flex-1 px-3 py-1.5 border border-amber-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                      autoFocus
                    />
                    <button
                      onClick={() => applyDiscount(tableOrders)}
                      disabled={!discountModal.value || applyingDiscount}
                      className="px-3 py-1.5 bg-amber-500 text-white rounded-lg text-xs font-bold hover:bg-amber-600 disabled:opacity-50 transition-colors"
                    >
                      {applyingDiscount ? <Loader2 className="w-3 h-3 animate-spin" /> : 'OK'}
                    </button>
                  </div>
                  {discountModal.value && (() => {
                    const num = Number(discountModal.value.replace(',', '.'));
                    if (isNaN(num) || num <= 0) return null;
                    const amt = discountModal.type === 'percent' ? Math.min(gross * num / 100, gross) : Math.min(num, gross);
                    return (
                      <p className="text-[11px] text-amber-700 mt-1.5 font-medium">
                        −R$ {amt.toFixed(2).replace('.', ',')} → total R$ {(gross - amt).toFixed(2).replace('.', ',')}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="px-4 pb-4 flex gap-2 border-t border-slate-100 pt-3">
                <button
                  onClick={() => printTable(tableName, tableOrders)}
                  disabled={!settings}
                  title="Imprimir comanda"
                  className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-600 text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-40 flex-shrink-0"
                >
                  <Printer className="w-4 h-4" />
                </button>

                {canDiscount && (
                  <button
                    onClick={() => isDiscountOpen
                      ? setDiscountModal(null)
                      : setDiscountModal({ table: tableName, type: 'percent', value: '' })}
                    title="Dar desconto"
                    className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors flex-shrink-0 ${
                      isDiscountOpen
                        ? 'border-amber-300 bg-amber-50 text-amber-700'
                        : totalDiscount > 0
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    <Percent className="w-4 h-4" />
                    {totalDiscount > 0 && <span className="text-xs">−R$ {totalDiscount.toFixed(2).replace('.', ',')}</span>}
                  </button>
                )}

                <button
                  onClick={() => closeTable(tableName, tableOrders)}
                  disabled={isClosing}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 transition-colors disabled:opacity-60 min-w-0"
                >
                  {isClosing
                    ? <Loader2 className="w-4 h-4 animate-spin" />
                    : <><CheckCircle className="w-4 h-4 flex-shrink-0" /><span>Fechar conta</span></>
                  }
                </button>
              </div>

              {/* ── Total footer ── */}
              <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <span className="text-xs text-slate-400 font-medium">Total a cobrar</span>
                <div className="flex items-center gap-2">
                  {totalDiscount > 0 && (
                    <button
                      onClick={() => removeDiscount(tableOrders)}
                      disabled={applyingDiscount}
                      className="text-[11px] text-red-400 hover:text-red-600 flex items-center gap-0.5 transition-colors"
                    >
                      <X className="w-3 h-3" /> desconto
                    </button>
                  )}
                  <span className="text-base font-extrabold text-emerald-600">R$ {net.toFixed(2).replace('.', ',')}</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

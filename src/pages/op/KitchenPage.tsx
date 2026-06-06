import { useEffect, useState, useCallback } from 'react';
import { db } from '../../lib/db';
import { useRestaurantId } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import type { Order, RestaurantSettings } from '../../lib/types';
import { Clock, ChefHat, CheckCircle2, Truck, ShoppingBag, LayoutGrid, Loader2, AlertCircle } from 'lucide-react';

function elapsed(createdAt: string) {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h ${m % 60}min`;
}

function elapsedColor(createdAt: string) {
  const m = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
  if (m < 10) return 'text-emerald-600 bg-emerald-50';
  if (m < 20) return 'text-amber-600 bg-amber-50';
  return 'text-red-600 bg-red-50';
}

function useTimerTick() {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick(n => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
}

interface CardProps {
  order: Order;
  updating: string | null;
  onAction: (order: Order) => void;
  actionLabel: string;
  actionColor: string;
  borderColor: string;
  headerColor: string;
}

function OrderCard({ order, updating, onAction, actionLabel, actionColor, borderColor, headerColor }: CardProps) {
  return (
    <div className={`rounded-2xl border-2 ${borderColor} overflow-hidden bg-white shadow-sm`}>
      {/* Header */}
      <div className={`${headerColor} px-4 py-3 flex items-start justify-between gap-2`}>
        <div className="min-w-0">
          <p className="font-bold text-slate-900 text-base leading-tight truncate">{order.customerName}</p>
          <p className="text-slate-600 text-xs mt-0.5 flex items-center gap-1">
            {order.deliveryType === 'delivery' ? <Truck className="w-3 h-3 flex-shrink-0" /> :
             order.deliveryType === 'table' ? <LayoutGrid className="w-3 h-3 flex-shrink-0" /> :
             <ShoppingBag className="w-3 h-3 flex-shrink-0" />}
            {order.deliveryType === 'delivery' ? 'Delivery' :
             order.deliveryType === 'table' ? `Mesa ${order.tableName}` : 'Retirada'}
            {order.scheduledFor && (
              <span className="ml-1 font-semibold text-violet-600">
                · Agendado {new Date(order.scheduledFor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg flex-shrink-0 flex items-center gap-1 ${elapsedColor(order.createdAt)}`}>
          <Clock className="w-3 h-3" />{elapsed(order.createdAt)}
        </span>
      </div>

      {/* Items */}
      <div className="px-4 py-3 space-y-2">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <span className="text-slate-500 font-bold text-sm w-6 flex-shrink-0 text-right">{item.quantity}×</span>
            <div className="min-w-0">
              <p className="text-slate-900 text-sm font-semibold leading-snug">{item.emoji} {item.name}</p>
              {item.selectedOptions && item.selectedOptions.length > 0 && (
                <p className="text-slate-400 text-xs mt-0.5">{item.selectedOptions.map(o => o.optionName).join(', ')}</p>
              )}
            </div>
          </div>
        ))}
        {order.scheduledFor && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-slate-100">
            <AlertCircle className="w-3.5 h-3.5 text-violet-500 flex-shrink-0" />
            <span className="text-xs text-violet-600 font-semibold">
              Agendado para {new Date(order.scheduledFor).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })} — {new Date(order.scheduledFor).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>
        )}
      </div>

      {/* Action button */}
      <div className="px-4 pb-4">
        {updating === order.id ? (
          <div className="flex justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin text-slate-400" />
          </div>
        ) : (
          <button
            onClick={() => onAction(order)}
            className={`w-full py-2.5 rounded-xl ${actionColor} text-white font-bold text-sm transition-all active:scale-95 flex items-center justify-center gap-2`}
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}

export default function KitchenPage() {
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  useTimerTick();

  const load = useCallback(async () => {
    if (!restaurantId) return;
    const [all, st] = await Promise.all([db.getOrders(restaurantId), db.getSettings(restaurantId)]);
    const since = new Date(Date.now() - 86400000).toISOString();
    setOrders(all.filter(o =>
      (o.status === 'PENDING' || o.status === 'PREPARING') && o.createdAt >= since
    ));
    setSettings(st);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    load();

    // Polling a cada 10s — garante atualização mesmo quando real-time falha por RLS do operador
    const poll = setInterval(() => load(), 10000);

    // Real-time como bônus (funciona quando o dono está logado)
    const channel = supabase
      .channel(`kitchen:${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${restaurantId}` }, () => load())
      .subscribe();

    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, load]);

  const accept = async (order: Order) => {
    setUpdating(order.id);
    await db.updateOrder(order.id, { status: 'PREPARING' });
    await load();
    setUpdating(null);
  };

  const done = async (order: Order) => {
    setUpdating(order.id);
    const next = order.deliveryType === 'delivery' ? 'DELIVERING' : 'COMPLETED';
    await db.updateOrder(order.id, { status: next });
    await load();
    setUpdating(null);
  };

  const pending = orders.filter(o => o.status === 'PENDING').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const preparing = orders.filter(o => o.status === 'PREPARING').sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Estimated wait: base delivery time + queue pressure
  const baseMin = (() => {
    const t = settings?.deliveryTime ?? '30';
    const match = t.match(/\d+/);
    return match ? Number(match[0]) : 30;
  })();
  const estimatedWait = baseMin + pending.length * 8 + preparing.length * 4;

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-orange-100 flex items-center justify-center">
            <ChefHat className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cozinha</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              <span className="text-amber-600 font-semibold">{pending.length} aguardando</span>
              {' · '}
              <span className="text-blue-600 font-semibold">{preparing.length} em preparo</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-blue-50 border border-blue-100">
            <Clock className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-xs font-bold text-blue-700">~{estimatedWait}min espera</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            Atualiza a cada 10s
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" /> até 10min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> 10-20min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" /> +20min</span>
      </div>

      {orders.length === 0 && (
        <div className="card p-16 text-center">
          <ChefHat className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum pedido no momento</p>
          <p className="text-slate-400 text-sm mt-1">Novos pedidos aparecerão aqui automaticamente</p>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6 items-start">
        {/* PENDING */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Novos ({pending.length})</h2>
          </div>
          {pending.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Nenhum pedido aguardando</p>
            </div>
          )}
          {pending.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updating}
              onAction={accept}
              actionLabel="Aceitar e iniciar preparo"
              actionColor="bg-amber-500 hover:bg-amber-600"
              borderColor="border-amber-200"
              headerColor="bg-amber-50"
            />
          ))}
        </div>

        {/* PREPARING */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 pb-1">
            <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <h2 className="font-bold text-slate-700 text-sm uppercase tracking-wider">Em preparo ({preparing.length})</h2>
          </div>
          {preparing.length === 0 && (
            <div className="rounded-2xl border-2 border-dashed border-slate-200 p-10 text-center">
              <p className="text-slate-400 text-sm">Nenhum pedido em preparo</p>
            </div>
          )}
          {preparing.map(order => (
            <OrderCard
              key={order.id}
              order={order}
              updating={updating}
              onAction={done}
              actionLabel={order.deliveryType === 'delivery' ? '✓ Saiu para entrega!' : '✓ Pronto para servir!'}
              actionColor="bg-emerald-500 hover:bg-emerald-600"
              borderColor="border-blue-200"
              headerColor="bg-blue-50"
            />
          ))}
        </div>
      </div>

      {/* Footer tip */}
      <p className="text-xs text-slate-400 text-center pb-2">
        A página atualiza automaticamente. Mostrando pedidos das últimas 24 horas.
      </p>
    </div>
  );
}

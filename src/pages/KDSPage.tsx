import { useEffect, useState, useRef } from 'react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { useRestaurantId } from '../lib/auth';
import type { Order } from '../lib/types';
import { ChefHat, Truck, CheckCircle, Clock, RefreshCw, Volume2, VolumeX } from 'lucide-react';
import { playNewOrderSound } from '../lib/sound';

const STATUS_FLOW: Record<string, { next: Order['status']; label: string; cls: string }> = {
  PENDING:    { next: 'PREPARING', label: 'Iniciar preparo',   cls: 'bg-blue-500 hover:bg-blue-600' },
  PAID:       { next: 'PREPARING', label: 'Iniciar preparo',   cls: 'bg-blue-500 hover:bg-blue-600' },
  PREPARING:  { next: 'DELIVERING', label: 'Pronto p/ entrega', cls: 'bg-teal-500 hover:bg-teal-600' },
  DELIVERING: { next: 'COMPLETED', label: 'Concluir',           cls: 'bg-emerald-500 hover:bg-emerald-600' },
};

// Delivery flow: kitchen advances PREPARING → READY ("pronto na cozinha")
// Owner then assigns driver and advances READY → DELIVERING → COMPLETED
// Non-delivery (table/pickup): normal flow PREPARING → DELIVERING → COMPLETED
function getAdvanceConfig(order: Order): { next: Order['status']; label: string; cls: string } | null {
  if (order.status === 'PREPARING' && order.deliveryType === 'delivery') {
    return { next: 'READY', label: 'Pronto na cozinha', cls: 'bg-orange-500 hover:bg-orange-600' };
  }
  // READY delivery: kitchen done, waiting for owner to dispatch
  if (order.status === 'READY') return null;
  // DELIVERING delivery: owner dispatched, no kitchen action
  if (order.status === 'DELIVERING' && order.deliveryType === 'delivery') return null;
  return STATUS_FLOW[order.status] ?? null;
}

function elapsed(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return '< 1min';
  if (m < 60) return `${m}min`;
  return `${Math.floor(m / 60)}h${(m % 60).toString().padStart(2, '0')}`;
}

function urgencyColor(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 10) return 'border-slate-600';
  if (m < 20) return 'border-amber-400';
  return 'border-red-500 animate-pulse';
}

const TYPE_ICON: Record<string, string> = { delivery: '🛵', pickup: '🏠', table: '🪑' };

export default function KDSPage() {
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [soundOn, setSoundOn] = useState(true);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const ACTIVE = ['PENDING', 'PAID', 'PREPARING', 'READY', 'DELIVERING'];

  const load = async () => {
    if (!restaurantId) return;
    const all = await db.getOrders(restaurantId);
    setOrders(all.filter(o => ACTIVE.includes(o.status)));
    setLoading(false);
  };

  useEffect(() => { load(); }, [restaurantId]);

  // Tick every 30s for elapsed time
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Realtime subscription
  useEffect(() => {
    if (!restaurantId) return;
    const ch = supabase.channel(`kds-orders:${restaurantId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `user_id=eq.${restaurantId}` }, (payload) => {
        const o = payload.new as Order | null;
        if (o && !prevIdsRef.current.has(o.id) && ACTIVE.includes(o.status)) {
          if (soundOn) playNewOrderSound();
          prevIdsRef.current.add(o.id);
        }
        load();
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [restaurantId, soundOn]);

  const advance = async (order: Order) => {
    const cfg = getAdvanceConfig(order);
    if (!cfg) return;
    // For delivery orders in PREPARING, "Pronto na cozinha" → DELIVERING means "ready, awaiting driver"
    const nextStatus = cfg.next;
    await db.updateOrder(order.id, { status: nextStatus });
    setOrders(prev => {
      const updated = prev.map(o => o.id === order.id ? { ...o, status: nextStatus } : o);
      return updated.filter(o => ACTIVE.includes(o.status));
    });
  };

  const cols: Record<string, Order[]> = { PENDING: [], PAID: [], PREPARING: [], READY: [], DELIVERING: [] };
  for (const o of orders) if (cols[o.status]) cols[o.status].push(o);
  // Merge PENDING+PAID into same column; merge READY+DELIVERING into "Pronto/Entrega" column
  const pendingCol = [...cols.PENDING, ...cols.PAID].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const readyCol = [...cols.READY, ...cols.DELIVERING].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

  void now; // used in urgencyColor/elapsed via closure

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col" style={{ fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 bg-slate-800 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <ChefHat size={24} className="text-emerald-400" />
          <span className="text-xl font-bold tracking-wide">KDS — Display de Cozinha</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-slate-400 text-sm">{new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
          <button onClick={() => setSoundOn(s => !s)} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600">
            {soundOn ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} className="text-slate-400" />}
          </button>
          <button onClick={load} className="p-2 rounded-lg bg-slate-700 hover:bg-slate-600">
            <RefreshCw size={16} className="text-slate-400" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center text-slate-400">Carregando pedidos...</div>
      ) : (
        <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-auto">
          {/* Column: Aguardando */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Clock size={16} className="text-amber-400" />
              <span className="font-semibold text-amber-400 uppercase text-sm tracking-widest">Aguardando</span>
              <span className="ml-auto bg-amber-400 text-slate-900 text-xs font-bold rounded-full px-2">{pendingCol.length}</span>
            </div>
            {pendingCol.map(order => <KDSCard key={order.id} order={order} onAdvance={advance} />)}
          </div>

          {/* Column: Preparando */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <ChefHat size={16} className="text-blue-400" />
              <span className="font-semibold text-blue-400 uppercase text-sm tracking-widest">Preparando</span>
              <span className="ml-auto bg-blue-400 text-slate-900 text-xs font-bold rounded-full px-2">{cols.PREPARING.length}</span>
            </div>
            {cols.PREPARING.map(order => <KDSCard key={order.id} order={order} onAdvance={advance} />)}
          </div>

          {/* Column: Pronto / Entrega */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 px-1">
              <Truck size={16} className="text-teal-400" />
              <span className="font-semibold text-teal-400 uppercase text-sm tracking-widest">Pronto / Entrega</span>
              <span className="ml-auto bg-teal-400 text-slate-900 text-xs font-bold rounded-full px-2">{readyCol.length}</span>
            </div>
            {readyCol.map(order => <KDSCard key={order.id} order={order} onAdvance={advance} />)}
          </div>
        </div>
      )}
    </div>
  );
}

function KDSCard({ order, onAdvance }: { order: Order; onAdvance: (o: Order) => void }) {
  const cfg = getAdvanceConfig(order);
  const id = order.id.slice(-6).toUpperCase();
  const isReadyDelivery = order.status === 'READY' && order.deliveryType === 'delivery';
  const isDeliveringDelivery = order.status === 'DELIVERING' && order.deliveryType === 'delivery';

  return (
    <div className={`bg-slate-800 rounded-xl border-2 ${urgencyColor(order.createdAt)} p-4 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">{TYPE_ICON[order.deliveryType] ?? '📋'}</span>
          <span className="font-bold text-lg">#{id}</span>
          {order.tableName && <span className="text-slate-400 text-sm">Mesa {order.tableName}</span>}
        </div>
        <div className="flex items-center gap-1 text-sm text-slate-400">
          <Clock size={12} />
          {elapsed(order.createdAt)}
        </div>
      </div>

      <div className="text-sm text-slate-300 font-medium">{order.customerName}</div>

      <div className="space-y-1">
        {order.items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="bg-slate-700 text-white text-xs font-bold rounded px-1.5 py-0.5 flex-shrink-0">{item.quantity}x</span>
            <div>
              <span className="text-white text-sm font-medium">{item.name}</span>
              {item.selectedOptions?.map(opt => (
                <div key={opt.optionId} className="text-xs text-slate-400">+ {opt.optionName}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {order.notes && (
        <div className="bg-amber-900/40 border border-amber-700 rounded-lg px-3 py-2 text-xs text-amber-300">
          ⚠️ {order.notes}
        </div>
      )}

      {cfg && (
        <button
          onClick={() => onAdvance(order)}
          className={`w-full py-2.5 rounded-lg text-white font-semibold text-sm transition-colors ${cfg.cls}`}
        >
          {cfg.label}
        </button>
      )}

      {isReadyDelivery && (
        <div className="flex items-center gap-1.5 text-xs text-amber-400 justify-center bg-amber-900/30 rounded-lg px-3 py-2">
          <Clock size={12} />
          Pronto — aguardando entregador
        </div>
      )}

      {isDeliveringDelivery && (
        <div className="flex items-center gap-1.5 text-xs text-teal-400 justify-center bg-teal-900/30 rounded-lg px-3 py-2">
          <CheckCircle size={12} />
          Saiu para entrega
        </div>
      )}

      {order.status === 'DELIVERING' && order.deliveryType !== 'delivery' && (
        <div className="flex items-center gap-1.5 text-xs text-teal-400 justify-center">
          <CheckCircle size={12} />
          Saiu para entrega
        </div>
      )}
    </div>
  );
}

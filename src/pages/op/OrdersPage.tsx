import { useEffect, useRef, useState } from 'react';
import { db } from '../../lib/db';
import { useAuth, useRestaurantId } from '../../lib/auth';
import { PAYMENT_METHOD_LABELS } from '../../lib/xgate';
import { playNewOrderSound, unlockAudio } from '../../lib/sound';
import { printOrder } from '../../lib/print';
import { supabase } from '../../lib/supabase';
import type { Order, RestaurantSettings } from '../../lib/types';
import { Clock, CheckCircle, XCircle, Eye, X, Truck, ShoppingBag, MapPin, Inbox, Loader2, Printer, Volume2, VolumeX, Ban, Star, LayoutGrid, Tag, Search, CalendarDays, ChefHat } from 'lucide-react';
import { showNewOrderNotification, requestNotificationPermission } from '../../lib/notifications';

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  PAID: { label: 'Pago', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CANCELLED: { label: 'Cancelado', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  PREPARING: { label: 'Preparando', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  READY: { label: 'Pronto na cozinha', icon: ChefHat, color: 'text-orange-600', bg: 'bg-orange-50' },
  DELIVERING: { label: 'Entregando', icon: Truck, color: 'text-teal-600', bg: 'bg-teal-50' },
  COMPLETED: { label: 'Concluído', icon: CheckCircle, color: 'text-slate-600', bg: 'bg-slate-100' },
};

function formatAddress(addr: { street: string; number: string; complement: string; neighborhood: string; city: string; state: string }) {
  const parts = [addr.street, addr.number].filter(Boolean);
  if (addr.complement) parts.push(`(${addr.complement})`);
  parts.push(addr.neighborhood, addr.city);
  if (addr.state) parts.push(addr.state);
  return parts.filter(Boolean).join(', ');
}

export default function OpOrdersPage() {
  const { user, operatorInfo } = useAuth();
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const knownIdsRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef<RestaurantSettings | null>(null);

  // Role permissions
  const canConfirmPayment = operatorInfo?.role !== 'waiter';
  const canCancel = operatorInfo?.role !== 'waiter';

  const load = async () => {
    if (!restaurantId) return;
    setLoading(true);
    try {
      const [o, s] = await Promise.all([db.getOrders(restaurantId), db.getSettings(restaurantId)]);
      setOrders(o);
      setSettings(s);
      settingsRef.current = s;
      knownIdsRef.current = new Set(o.map(x => x.id));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handler = () => { unlockAudio(); requestNotificationPermission(); };
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    load();

    // Polling a cada 15s para manter sincronia com a cozinha
    const pollInterval = setInterval(() => load(), 15000);

    const channel = supabase
      .channel(`op-orders:${restaurantId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${restaurantId}` }, (payload) => {
        const newOrder = payload.new as Order & { user_id: string; customer_name: string; customer_phone: string; payment_method: string; delivery_address: unknown; delivery_type: string; pix_tx_id: string; pix_qr_code: string; pix_copy_paste: string; created_at: string; paid_at: string | null };
        if (knownIdsRef.current.has(newOrder.id)) return;
        knownIdsRef.current.add(newOrder.id);
        if (soundEnabled) playNewOrderSound();
        showNewOrderNotification(newOrder.customer_name, Number(newOrder.total));

        const mapped: Order = {
          id: newOrder.id,
          userId: newOrder.user_id,
          items: newOrder.items,
          total: Number(newOrder.total),
          status: newOrder.status as Order['status'],
          customerName: newOrder.customer_name,
          customerPhone: newOrder.customer_phone,
          paymentMethod: newOrder.payment_method as Order['paymentMethod'],
          deliveryAddress: newOrder.delivery_address as Order['deliveryAddress'],
          deliveryType: newOrder.delivery_type as Order['deliveryType'],
          pixTxId: newOrder.pix_tx_id,
          pixQrCode: newOrder.pix_qr_code,
          pixCopyPaste: newOrder.pix_copy_paste,
          createdAt: newOrder.created_at,
          paidAt: newOrder.paid_at,
          discount: 0,
        };

        setOrders(prev => [mapped, ...prev]);
        if (autoPrint && settingsRef.current) printOrder(mapped, settingsRef.current);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${restaurantId}` }, () => {
        load();
      })
      .subscribe();

    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(channel);
    };
  }, [restaurantId, soundEnabled, autoPrint]);

  if (!user) return null;

  const filtered = orders.filter(o => {
    if (filter && o.status !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!o.customerName.toLowerCase().includes(q) && !o.customerPhone?.toLowerCase().includes(q)) return false;
    }
    if (dateFrom && o.createdAt.slice(0, 10) < dateFrom) return false;
    if (dateTo && o.createdAt.slice(0, 10) > dateTo) return false;
    return true;
  });
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

  const updateStatus = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    await db.updateOrder(orderId, { status: newStatus as Order['status'], paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined });
    if (newStatus === 'PAID' && order?.paymentMethod === 'cash') {
      const session = await db.getCurrentCashSession(restaurantId);
      if (session) {
        await db.addCashEntry(restaurantId, session.id, 'sale', order.total, `Pedido #${order.id.slice(-6).toUpperCase()}`);
      }
    }
    load();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : null);
    }
  };

  const cancelOrder = async (orderId: string) => {
    if (!confirm('Cancelar este pedido?')) return;
    await db.updateOrder(orderId, { status: 'CANCELLED' });
    load();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: 'CANCELLED' } : null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Pedidos</h1>
          <p className="text-slate-500 mt-0.5 text-sm">{orders.length} pedidos recebidos</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setSoundEnabled(s => !s)}
            title={soundEnabled ? 'Silenciar notificações' : 'Ativar notificações sonoras'}
            className={`p-2 rounded-xl border transition-colors ${soundEnabled ? 'border-emerald-200 bg-emerald-50 text-emerald-600' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
          >
            {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setAutoPrint(a => !a)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium transition-colors ${autoPrint ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
          >
            <Printer className="w-4 h-4" />
            {autoPrint ? 'Auto-imprimir ON' : 'Auto-imprimir OFF'}
          </button>
        </div>
      </div>

      {/* Search + date filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente ou telefone..."
            className="input-field pl-9 w-full"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2">
              <X className="w-4 h-4 text-slate-400 hover:text-slate-600" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <CalendarDays className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            className="input-field text-sm py-2 w-full sm:w-36" title="Data início" />
          <span className="text-slate-400 text-sm flex-shrink-0">até</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            className="input-field text-sm py-2 w-full sm:w-36" title="Data fim" />
          {(dateFrom || dateTo) && (
            <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="p-1.5 rounded-lg hover:bg-slate-100">
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {[['', 'Todos'], ['PENDING', 'Pendente'], ['PAID', 'Pago'], ['PREPARING', 'Preparando'], ['READY', 'Pronto na cozinha'], ['DELIVERING', 'Entregando'], ['COMPLETED', 'Concluído'], ['CANCELLED', 'Cancelado']].map(([f, label]) => {
          const cfg = f ? statusConfig[f] : null;
          const active = filter === f;
          return (
            <button key={f} onClick={() => setFilter(f)} className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[13px] font-medium transition-all duration-150 ${active ? `${cfg?.bg || 'bg-slate-100'} ${cfg?.color || 'text-slate-900'} shadow-sm` : 'text-slate-500 hover:bg-slate-100/60'}`}>
              {f && cfg && <cfg.icon className="w-3.5 h-3.5" />}
              {label}
            </button>
          );
        })}
      </div>

      {loading && orders.length === 0 && (
        <div className="text-center py-16">
          <Loader2 className="w-7 h-7 animate-spin text-emerald-500 mx-auto" />
        </div>
      )}

      {!loading && filtered.length === 0 && (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-base font-medium">Nenhum pedido encontrado</p>
        </div>
      )}

      <div className="grid gap-2.5">
        {filtered.map(order => {
          const cfg = statusConfig[order.status] || statusConfig.PENDING;
          const payCfg = PAYMENT_METHOD_LABELS[order.paymentMethod];
          return (
            <div key={order.id} className="card-hover">
              <div className="flex items-start gap-3 p-3 sm:p-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${cfg.bg}`}>
                  <cfg.icon className={`w-5 h-5 ${cfg.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900 text-[15px]">{order.customerName}</span>
                    <span className="badge bg-slate-100 text-slate-500 py-0.5 text-[10px]">{payCfg?.emoji} {payCfg?.label}</span>
                    <span className="badge bg-slate-100 text-slate-500 py-0.5 text-[10px]">
                      {order.deliveryType === 'delivery' ? <Truck className="w-3 h-3" /> : order.deliveryType === 'table' ? <LayoutGrid className="w-3 h-3" /> : <ShoppingBag className="w-3 h-3" />}
                      {order.deliveryType === 'delivery' ? 'Delivery' : order.deliveryType === 'table' ? (order.tableName || 'Mesa') : 'Retirada'}
                    </span>
                    {order.couponCode && <span className="badge bg-emerald-50 text-emerald-600 py-0.5 text-[10px]"><Tag className="w-3 h-3" />{order.couponCode}</span>}
                    {order.rating && <span className="badge bg-amber-50 text-amber-600 py-0.5 text-[10px]"><Star className="w-3 h-3" />{order.rating}</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`badge ${cfg.bg} ${cfg.color} py-0.5`}>{cfg.label}</span>
                    <span className="text-[12px] text-slate-400">{formatDate(order.createdAt)}</span>
                    {order.deliveryType === 'delivery' && order.deliveryAddress && (
                      <span className="text-[12px] text-slate-400 truncate flex items-center gap-0.5"><MapPin className="w-3 h-3 flex-shrink-0" />{formatAddress(order.deliveryAddress)}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  <span className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight mr-1">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  {settings && (
                    <button onClick={(e) => { e.stopPropagation(); printOrder(order, settings); }} className="p-1.5 rounded-xl hover:bg-blue-50 transition-colors" title="Imprimir">
                      <Printer className="w-4 h-4 text-blue-400" />
                    </button>
                  )}
                  {canCancel && order.status !== 'CANCELLED' && order.status !== 'COMPLETED' && (
                    <button onClick={(e) => { e.stopPropagation(); cancelOrder(order.id); }} className="p-1.5 rounded-xl hover:bg-red-50 transition-colors" title="Cancelar">
                      <Ban className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                  <button onClick={() => setSelectedOrder(order)} className="p-1.5 rounded-xl hover:bg-slate-100/80 transition-colors">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-3xl shadow-elevated w-full max-w-lg p-5 sm:p-7 z-10 max-h-[90vh] overflow-y-auto animate-scale-in">
            <div className="flex items-center justify-between mb-7">
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Detalhes do Pedido</h3>
              <button onClick={() => setSelectedOrder(null)} className="p-2 rounded-xl hover:bg-slate-100/80 transition-colors">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <div className="space-y-5">
              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Cliente</p>
                <p className="font-semibold text-slate-900">{selectedOrder.customerName}</p>
                <p className="text-sm text-slate-500 mt-0.5">{selectedOrder.customerPhone}</p>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Status</p>
                  {(() => { const c = statusConfig[selectedOrder.status] || statusConfig.PENDING; return <span className={`badge ${c.bg} ${c.color}`}><c.icon className="w-3.5 h-3.5" /> {c.label}</span>; })()}
                </div>
                <div className="flex gap-1.5 flex-wrap justify-end">
                  {canConfirmPayment && selectedOrder.status === 'PENDING' && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'PAID')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100/80 transition-colors">Confirmar pgto</button>
                  )}
                  {!canConfirmPayment && selectedOrder.status === 'PENDING' && (
                    <span className="px-3 py-1.5 text-[12px] text-slate-400 rounded-lg bg-slate-50">Aguardando caixa</span>
                  )}
                  {(selectedOrder.status === 'PAID' || selectedOrder.status === 'PENDING') && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'PREPARING')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100/80 transition-colors">Preparar</button>
                  )}
                  {selectedOrder.status === 'READY' && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'DELIVERING')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100/80 transition-colors">Saiu p/ entrega</button>
                  )}
                  {selectedOrder.status === 'PREPARING' && selectedOrder.deliveryType === 'delivery' && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'DELIVERING')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100/80 transition-colors">Saiu p/ entrega</button>
                  )}
                  {selectedOrder.status === 'PREPARING' && selectedOrder.deliveryType !== 'delivery' && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'COMPLETED')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200/80 transition-colors">Entregue</button>
                  )}
                  {selectedOrder.status === 'DELIVERING' && (
                    <button onClick={() => updateStatus(selectedOrder.id, 'COMPLETED')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200/80 transition-colors">Entregue</button>
                  )}
                  {canCancel && selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'COMPLETED' && (
                    <button onClick={() => cancelOrder(selectedOrder.id)} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-red-50 text-red-500 hover:bg-red-100/80 transition-colors flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  )}
                </div>
              </div>

              {settings && (
                <button onClick={() => printOrder(selectedOrder, settings)} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100/80 transition-colors">
                  <Printer className="w-4 h-4" /> Imprimir Cupom
                </button>
              )}

              <div className="h-px bg-slate-100" />

              <div className="grid grid-cols-1 xs:grid-cols-2 gap-3">
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Pagamento</p>
                  <p className="text-sm text-slate-700 font-medium">{PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod]?.emoji} {PAYMENT_METHOD_LABELS[selectedOrder.paymentMethod]?.label}</p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Entrega</p>
                  <p className="text-sm text-slate-700 font-medium flex items-center gap-1">
                    {selectedOrder.deliveryType === 'delivery' ? <Truck className="w-3.5 h-3.5" /> : selectedOrder.deliveryType === 'table' ? <LayoutGrid className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                    {selectedOrder.deliveryType === 'delivery' ? 'Delivery' : selectedOrder.deliveryType === 'table' ? (selectedOrder.tableName || 'Mesa') : 'Retirada'}
                  </p>
                </div>
              </div>

              {selectedOrder.deliveryType === 'delivery' && selectedOrder.deliveryAddress && (
                <div className="p-3.5 bg-slate-50 rounded-xl">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">Endereço</p>
                  <p className="text-sm text-slate-700 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5 text-slate-400" />
                    {formatAddress(selectedOrder.deliveryAddress)}
                  </p>
                </div>
              )}

              <div>
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Itens</p>
                <div className="space-y-1.5">
                  {selectedOrder.items.map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-slate-50/80 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{item.emoji}</span>
                        <span className="text-sm text-slate-700 font-medium">{item.name}</span>
                        <span className="text-xs text-slate-400 font-medium">x{item.quantity}</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-900">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                    </div>
                  ))}
                </div>
              </div>

              {(selectedOrder.discount > 0 || selectedOrder.couponCode) && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 flex items-center gap-1"><Tag className="w-3.5 h-3.5" /> Cupom {selectedOrder.couponCode && `(${selectedOrder.couponCode})`}</span>
                  <span className="text-emerald-600 font-semibold">-R$ {(selectedOrder.discount || 0).toFixed(2).replace('.', ',')}</span>
                </div>
              )}
              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <span className="font-semibold text-slate-700">Total</span>
                <span className="text-xl font-bold text-emerald-600 tracking-tight">R$ {selectedOrder.total.toFixed(2).replace('.', ',')}</span>
              </div>

              {selectedOrder.rating && (
                <div className="p-3 bg-amber-50 rounded-xl border border-amber-100">
                  <p className="text-[11px] font-semibold text-amber-600 uppercase tracking-wider mb-1.5">Avaliação do cliente</p>
                  <div className="flex items-center gap-1 mb-1">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= selectedOrder.rating! ? 'fill-amber-400 text-amber-400' : 'text-amber-200'}`} />
                    ))}
                    <span className="text-xs text-amber-700 font-bold ml-1">{selectedOrder.rating}/5</span>
                  </div>
                  {selectedOrder.ratingComment && <p className="text-xs text-amber-700 italic">"{selectedOrder.ratingComment}"</p>}
                </div>
              )}

              <p className="text-[12px] text-slate-400">{formatDate(selectedOrder.createdAt)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseCustomer } from '../lib/supabaseCustomer';
import { useCustomerAuth } from '../lib/customerAuth';
import { db } from '../lib/db';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { Order, RestaurantSettings } from '../lib/types';
import { ArrowLeft, Clock, CheckCircle, XCircle, Truck, ShoppingBag, Package, LogOut, User, Loader2, Ban, ChefHat, MapPin, Zap, RotateCcw, Gift, Star, DollarSign, WifiOff, LocateFixed } from 'lucide-react';

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string; pulse?: boolean }> = {
  PENDING: { label: 'Aguardando', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50', pulse: true },
  PAID: { label: 'Pago', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50', pulse: true },
  CANCELLED: { label: 'Cancelado', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  PREPARING: { label: 'Preparando', icon: Package, color: 'text-blue-600', bg: 'bg-blue-50', pulse: true },
  DELIVERING: { label: 'Em entrega', icon: Truck, color: 'text-teal-600', bg: 'bg-teal-50', pulse: true },
  COMPLETED: { label: 'Entregue', icon: CheckCircle, color: 'text-slate-500', bg: 'bg-slate-100' },
};

function formatAddress(addr: { street: string; number: string; complement: string; neighborhood: string; city: string; state: string }) {
  const parts = [addr.street, addr.number].filter(Boolean);
  if (addr.complement) parts.push(`(${addr.complement})`);
  parts.push(addr.neighborhood, addr.city);
  if (addr.state) parts.push(addr.state);
  return parts.filter(Boolean).join(', ');
}

interface OrderRowDb {
  id: string; user_id: string; customer_user_id: string | null; items: Order['items'];
  total: number; status: string; customer_name: string; customer_phone: string;
  payment_method: string; delivery_address: Order['deliveryAddress']; delivery_type: string;
  pix_tx_id: string; pix_qr_code: string; pix_copy_paste: string;
  created_at: string; paid_at: string | null;
  driver_id?: string | null; driver_name?: string | null;
}

function rowToOrder(r: OrderRowDb): Order {
  return {
    id: r.id, userId: r.user_id, customerUserId: r.customer_user_id ?? undefined,
    items: r.items, total: Number(r.total), status: r.status as Order['status'],
    customerName: r.customer_name, customerPhone: r.customer_phone,
    paymentMethod: r.payment_method as Order['paymentMethod'],
    deliveryAddress: r.delivery_address, deliveryType: r.delivery_type as Order['deliveryType'],
    discount: 0,
    pixTxId: r.pix_tx_id, pixQrCode: r.pix_qr_code, pixCopyPaste: r.pix_copy_paste,
    createdAt: r.created_at, paidAt: r.paid_at,
    driverId: r.driver_id ?? undefined,
    driverName: r.driver_name ?? undefined,
  };
}

export default function CustomerPortalPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { customer, loading: authLoading, signOut } = useCustomerAuth();
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const autoRateTriggered = useRef(false);
  const [cashbackRedeemed, setCashbackRedeemed] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const [ratingOrder, setRatingOrder] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingSubmitting, setRatingSubmitting] = useState(false);
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);
  const [driverLoc, setDriverLoc] = useState<{ lat: number; lng: number; lastAt: string | null } | null>(null);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabaseCustomer.channel> | null>(null);
  const trackingInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!slug) return;
    db.getPublicMenu(slug).then(data => {
      if (data) setSettings(data.settings);
    });
  }, [slug]);

  useEffect(() => {
    if (!customer || !settings) return;

    const load = async () => {
      setLoading(true);
      const { data, error } = await supabaseCustomer
        .from('orders')
        .select('*')
        .eq('user_id', settings.userId)
        .order('created_at', { ascending: false });
      if (!error && data) setOrders((data as OrderRowDb[]).map(rowToOrder));
      if (customer && (settings.cashbackPercent ?? 0) > 0) {
        const redeemed = await db.getCashbackRedeemed(settings.userId, customer.id);
        setCashbackRedeemed(redeemed);
      }
      setLoading(false);
    };

    load();

    // Real-time: listen for status updates on this restaurant's orders
    channelRef.current = supabaseCustomer
      .channel(`customer-portal:${settings.userId}:${customer.id}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `user_id=eq.${settings.userId}`,
      }, (payload) => {
        const updated = rowToOrder(payload.new as OrderRowDb);
        setOrders(prev => prev.map(o => o.id === updated.id ? updated : o));
        setUpdatedIds(prev => new Set([...prev, updated.id]));
        setTimeout(() => setUpdatedIds(prev => { const s = new Set(prev); s.delete(updated.id); return s; }), 3000);
      })
      .subscribe();

    return () => {
      if (channelRef.current) supabaseCustomer.removeChannel(channelRef.current);
    };
  }, [customer, settings]);

  // Auto-open rating when customer arrives via ?avaliar=1 link
  useEffect(() => {
    if (autoRateTriggered.current || loading || orders.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('avaliar') !== '1') return;
    autoRateTriggered.current = true;
    window.history.replaceState({}, '', window.location.pathname);
    const target = orders.find(o => o.status === 'COMPLETED' && !o.rating);
    if (target) {
      setExpandedId(target.id);
      setRatingOrder(target.id);
    }
  }, [loading, orders]);

  const refreshDriverLoc = useCallback(async (orderId: string) => {
    const { data } = await supabaseCustomer.rpc('get_driver_location_for_order', { p_order_id: orderId });
    const rows = data as Array<{ lat: number; lng: number; driver_name: string; last_location_at: string | null }> | null;
    if (rows && rows.length > 0 && rows[0].lat && rows[0].lng) {
      setDriverLoc({ lat: rows[0].lat, lng: rows[0].lng, lastAt: rows[0].last_location_at });
    } else {
      setDriverLoc(null);
    }
  }, []);

  useEffect(() => {
    if (!trackingOrderId) {
      if (trackingInterval.current) clearInterval(trackingInterval.current);
      setDriverLoc(null);
      return;
    }
    setTrackingLoading(true);
    refreshDriverLoc(trackingOrderId).finally(() => setTrackingLoading(false));
    trackingInterval.current = setInterval(() => refreshDriverLoc(trackingOrderId), 10000);
    return () => { if (trackingInterval.current) clearInterval(trackingInterval.current); };
  }, [trackingOrderId, refreshDriverLoc]);

  const handleCancel = async (orderId: string) => {
    if (!confirm('Cancelar este pedido?')) return;
    setCancelling(orderId);
    await supabaseCustomer.from('orders').update({ status: 'CANCELLED' }).eq('id', orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: 'CANCELLED' } : o));
    setCancelling(null);
  };

  const handleSignOut = async () => {
    await signOut();
    navigate(`/m/${slug}`);
  };

  const handleRepeatOrder = (order: Order) => {
    sessionStorage.setItem(`repeat_cart_${slug}`, JSON.stringify(order.items));
    navigate(`/m/${slug}`);
  };

  const handleSubmitRating = async () => {
    if (!ratingOrder || !ratingValue) return;
    setRatingSubmitting(true);
    await supabaseCustomer
      .from('orders')
      .update({ rating: ratingValue, rating_comment: ratingComment.trim() || null })
      .eq('id', ratingOrder);
    setOrders(prev => prev.map(o => o.id === ratingOrder
      ? { ...o, rating: ratingValue, ratingComment: ratingComment.trim() || undefined }
      : o
    ));
    setRatingOrder(null);
    setRatingValue(0);
    setRatingComment('');
    setRatingSubmitting(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit'
  });

  const accent = settings?.accentColor || '#059669';
  const customerName = customer?.user_metadata?.name || customer?.email?.split('@')[0] || 'Cliente';

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
        <Loader2 className="w-8 h-8 animate-spin text-slate-300" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-[#f5f5f5] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-5">
          <User className="w-9 h-9 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-800">Acesso restrito</h2>
        <p className="text-slate-400 mt-2 text-sm">Faça login para ver seus pedidos</p>
        <button
          onClick={() => navigate(`/m/${slug}`)}
          className="mt-5 px-6 py-3 rounded-2xl text-white font-bold text-sm"
          style={{ backgroundColor: accent }}
        >
          Ir para o cardápio
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white border-b border-black/5 shadow-sm">
        <div className="max-w-xl mx-auto px-4 py-3.5 flex items-center gap-3">
          <button
            onClick={() => navigate(`/m/${slug}`)}
            className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="font-extrabold text-slate-900 text-base truncate leading-tight">{settings?.name || 'Cardápio'}</p>
            <p className="text-xs text-slate-400 font-medium truncate">{customerName}</p>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-500 bg-red-50 hover:bg-red-100 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Sair
          </button>
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 pt-5 pb-12">

        {/* Loyalty + Cashback cards */}
        {!loading && settings && (settings.loyaltyEnabled || (settings.cashbackPercent ?? 0) > 0) && (() => {
          const completedOrders = orders.filter(o => ['COMPLETED', 'DELIVERING', 'PREPARING', 'PAID'].includes(o.status));
          const loyaltyCount = completedOrders.length;
          const loyaltyProgress = settings.loyaltyOrdersNeeded > 0 ? loyaltyCount % settings.loyaltyOrdersNeeded : 0;
          const loyaltyPct = settings.loyaltyOrdersNeeded > 0 ? (loyaltyProgress / settings.loyaltyOrdersNeeded) * 100 : 0;
          const rewardsEarned = settings.loyaltyOrdersNeeded > 0 ? Math.floor(loyaltyCount / settings.loyaltyOrdersNeeded) : 0;
          const cashbackEarned = (settings.cashbackPercent ?? 0) > 0
            ? completedOrders.reduce((s, o) => s + o.total, 0) * (settings.cashbackPercent / 100)
            : 0;
          const cashbackTotal = Math.max(0, cashbackEarned - cashbackRedeemed);
          return (
            <div className="grid grid-cols-1 gap-3 mb-5">
              {settings.loyaltyEnabled && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: accent + '20' }}>
                      <Gift className="w-5 h-5" style={{ color: accent }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm">Programa de Fidelidade</p>
                      <p className="text-xs text-slate-400 font-medium">{loyaltyCount} pedido{loyaltyCount !== 1 ? 's' : ''} concluído{loyaltyCount !== 1 ? 's' : ''} no total</p>
                    </div>
                    {rewardsEarned > 0 && (
                      <span className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold" style={{ backgroundColor: accent, color: '#fff' }}>
                        <Star className="w-3 h-3 fill-white" /> {rewardsEarned}x premiado
                      </span>
                    )}
                  </div>
                  {loyaltyCount % settings.loyaltyOrdersNeeded === 0 && loyaltyCount > 0 ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <Star className="w-4 h-4 text-emerald-500 fill-emerald-500 flex-shrink-0" />
                      <p className="text-sm font-semibold text-emerald-700">🎉 Você ganhou: <strong>{settings.loyaltyReward}</strong></p>
                    </div>
                  ) : (
                    <>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-slate-500">{loyaltyProgress} de {settings.loyaltyOrdersNeeded} pedidos</span>
                        <span style={{ color: accent }}>{settings.loyaltyOrdersNeeded - loyaltyProgress} para ganhar</span>
                      </div>
                      <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${loyaltyPct}%`, backgroundColor: accent }} />
                      </div>
                      <p className="text-xs text-slate-400 mt-1.5">Recompensa: <span className="font-semibold text-slate-600">{settings.loyaltyReward || '—'}</span></p>
                    </>
                  )}
                </div>
              )}
              {(settings.cashbackPercent ?? 0) > 0 && (
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-black/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 text-sm">Cashback Acumulado</p>
                      <p className="text-xs text-slate-400 font-medium">{settings.cashbackPercent}% de cada pedido concluído</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-xl font-extrabold text-emerald-600">R$ {cashbackTotal.toFixed(2).replace('.', ',')}</p>
                      <p className="text-[10px] text-slate-400 font-medium mt-0.5">{completedOrders.length} pedido{completedOrders.length !== 1 ? 's' : ''}</p>
                    </div>
                  </div>
                  {cashbackTotal >= 1 && settings.cashbackEnabled ? (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-100">
                      <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                      <p className="text-xs text-emerald-700 font-semibold">Disponível! Aplique como desconto no próximo pedido diretamente no checkout.</p>
                    </div>
                  ) : cashbackTotal < 1 ? (
                    <p className="text-xs text-slate-400 text-center py-1">Faça mais pedidos para acumular cashback (mín. R$ 1,00).</p>
                  ) : (
                    <p className="text-xs text-slate-400 text-center py-1">Resgate disponível em breve.</p>
                  )}
                  {cashbackRedeemed > 0 && (
                    <p className="text-[11px] text-slate-400 text-center">R$ {cashbackRedeemed.toFixed(2).replace('.', ',')} já resgatado</p>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        <h2 className="text-lg font-extrabold text-slate-900 mb-4">Meus Pedidos</h2>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex-shrink-0" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3.5 bg-slate-100 rounded-full w-1/3" />
                    <div className="h-3 bg-slate-100 rounded-full w-1/2" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-20 h-20 rounded-3xl bg-white shadow-sm flex items-center justify-center mx-auto mb-4">
              <ChefHat className="w-9 h-9 text-slate-200" />
            </div>
            <p className="font-semibold text-slate-500">Nenhum pedido ainda</p>
            <button
              onClick={() => navigate(`/m/${slug}`)}
              className="mt-4 px-5 py-2.5 rounded-2xl text-white font-bold text-sm"
              style={{ backgroundColor: accent }}
            >
              Ver o cardápio
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(order => {
              const cfg = statusConfig[order.status] || statusConfig.PENDING;
              const payCfg = PAYMENT_METHOD_LABELS[order.paymentMethod];
              const isExpanded = expandedId === order.id;
              const isCancelling = cancelling === order.id;
              const justUpdated = updatedIds.has(order.id);
              const canCancel = order.status === 'PENDING';

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-2xl overflow-hidden shadow-sm border transition-all duration-300 ${justUpdated ? 'border-2' : 'border-black/5'}`}
                  style={justUpdated ? { borderColor: accent } : {}}
                >
                  {/* Order summary row */}
                  <button
                    className="w-full text-left px-4 py-4"
                    onClick={() => setExpandedId(isExpanded ? null : order.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
                        <cfg.icon className={`w-5 h-5 ${cfg.color} ${cfg.pulse ? 'animate-pulse' : ''}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            #{order.id.slice(-8).toUpperCase()}
                          </span>
                          <span className="text-sm font-extrabold text-slate-900 flex-shrink-0">
                            R$ {order.total.toFixed(2).replace('.', ',')}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.label}
                          </span>
                          <span className="text-xs text-slate-400">{formatDate(order.createdAt)}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-1 truncate">
                          {order.items.map(i => `${i.quantity}x ${i.name}`).join(' · ')}
                        </p>
                      </div>
                    </div>
                  </button>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-50 pt-3 space-y-3">
                      {/* Status progress */}
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">Status do pedido</p>
                        <div className="flex items-center gap-1">
                          {(['PENDING', 'PREPARING', order.deliveryType === 'delivery' ? 'DELIVERING' : null, 'COMPLETED'] as const).filter(Boolean).map((s, i, arr) => {
                            const sCfg = statusConfig[s!];
                            const statuses = ['PENDING', 'PAID', 'PREPARING', 'DELIVERING', 'COMPLETED'];
                            const currentIdx = statuses.indexOf(order.status);
                            const stepIdx = statuses.indexOf(s!);
                            const done = currentIdx >= stepIdx && order.status !== 'CANCELLED';
                            const _active = order.status === s || (s === 'PENDING' && order.status === 'PAID'); void _active;
                            return (
                              <div key={s} className="flex items-center flex-1 last:flex-none">
                                <div
                                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 transition-all"
                                  style={done ? { backgroundColor: accent, color: '#fff' } : { backgroundColor: '#f1f5f9', color: '#94a3b8' }}
                                >
                                  {sCfg && <sCfg.icon className="w-3.5 h-3.5" />}
                                </div>
                                {i < arr.length - 1 && (
                                  <div className="flex-1 h-0.5 mx-1 rounded-full" style={{ backgroundColor: done ? accent : '#e2e8f0' }} />
                                )}
                              </div>
                            );
                          })}
                        </div>
                        {order.status === 'CANCELLED' && (
                          <p className="text-xs text-red-500 font-medium mt-2">Pedido cancelado</p>
                        )}
                      </div>

                      {/* Items */}
                      <div>
                        <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Itens</p>
                        <div className="space-y-1">
                          {order.items.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-slate-600">{item.quantity}x {item.name}</span>
                              <span className="font-semibold text-slate-900">R$ {(item.price * item.quantity).toFixed(2).replace('.', ',')}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Delivery info */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pagamento</p>
                          <p className="text-sm font-medium text-slate-700">{payCfg?.emoji} {payCfg?.label}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entrega</p>
                          <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                            {order.deliveryType === 'delivery' ? <Truck className="w-3.5 h-3.5" /> : <ShoppingBag className="w-3.5 h-3.5" />}
                            {order.deliveryType === 'delivery' ? 'Delivery' : 'Retirada'}
                          </p>
                        </div>
                      </div>

                      {order.deliveryType === 'delivery' && order.deliveryAddress && (
                        <div className="flex items-start gap-1.5 text-xs text-slate-500">
                          <MapPin className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-slate-400" />
                          {formatAddress(order.deliveryAddress)}
                        </div>
                      )}

                      {/* Driver tracking */}
                      {order.status === 'DELIVERING' && order.deliveryType === 'delivery' && (
                        <div className="rounded-xl overflow-hidden border border-teal-100">
                          <button
                            className="w-full flex items-center justify-between px-3 py-2.5 bg-teal-50 hover:bg-teal-100 transition-colors"
                            onClick={() => setTrackingOrderId(trackingOrderId === order.id ? null : order.id)}
                          >
                            <div className="flex items-center gap-2">
                              <Truck className="w-4 h-4 text-teal-600" />
                              <span className="text-sm font-bold text-teal-700">Rastrear minha entrega</span>
                              {order.driverName && (
                                <span className="text-xs text-teal-500">· {order.driverName}</span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-teal-600">
                              {trackingOrderId === order.id ? 'Fechar' : 'Ver mapa'}
                            </span>
                          </button>
                          {trackingOrderId === order.id && (
                            <div className="bg-white">
                              {trackingLoading ? (
                                <div className="flex items-center justify-center py-10">
                                  <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
                                </div>
                              ) : driverLoc ? (
                                <>
                                  <iframe
                                    key={`${driverLoc.lat},${driverLoc.lng}`}
                                    title="mapa-entrega"
                                    width="100%"
                                    height="240"
                                    src={`https://www.openstreetmap.org/export/embed.html?bbox=${driverLoc.lng - 0.005},${driverLoc.lat - 0.005},${driverLoc.lng + 0.005},${driverLoc.lat + 0.005}&layer=mapnik&marker=${driverLoc.lat},${driverLoc.lng}`}
                                    style={{ border: 0, display: 'block' }}
                                  />
                                  {driverLoc.lastAt && (
                                    <div className="flex items-center gap-1.5 px-3 py-2 border-t border-slate-100">
                                      <LocateFixed className="w-3 h-3 text-teal-500 flex-shrink-0" />
                                      <p className="text-[10px] text-slate-500">
                                        Atualizado: <span className="font-semibold">{new Date(driverLoc.lastAt).toLocaleTimeString('pt-BR')}</span>
                                        <span className="text-slate-300 ml-1">· atualiza a cada 10s</span>
                                      </p>
                                    </div>
                                  )}
                                </>
                              ) : (
                                <div className="flex flex-col items-center justify-center py-10 text-center px-4">
                                  <WifiOff className="w-6 h-6 text-slate-300 mb-2" />
                                  <p className="text-sm font-medium text-slate-400">Sinal GPS indisponivel</p>
                                  <p className="text-xs text-slate-300 mt-1">Verificando automaticamente...</p>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Rating section */}
                      {order.status === 'COMPLETED' && (
                        order.rating ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <div className="flex items-center gap-1 mb-1">
                              {[1,2,3,4,5].map(s => (
                                <Star key={s} className={`w-4 h-4 ${s <= order.rating! ? 'fill-amber-400 text-amber-400' : 'text-amber-200'}`} />
                              ))}
                              <span className="text-xs text-amber-700 font-bold ml-1">Sua avaliacao</span>
                            </div>
                            {order.ratingComment && <p className="text-xs text-amber-700 italic">"{order.ratingComment}"</p>}
                          </div>
                        ) : ratingOrder === order.id ? (
                          <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 space-y-3">
                            <p className="text-xs font-bold text-amber-700">Como foi sua experiencia?</p>
                            <div className="flex gap-1">
                              {[1,2,3,4,5].map(s => (
                                <button key={s} onClick={() => setRatingValue(s)} className="transition-transform active:scale-110">
                                  <Star className={`w-8 h-8 ${s <= ratingValue ? 'fill-amber-400 text-amber-400' : 'text-amber-200'}`} />
                                </button>
                              ))}
                            </div>
                            <textarea
                              value={ratingComment}
                              onChange={e => setRatingComment(e.target.value)}
                              rows={2}
                              placeholder="Comentario opcional..."
                              className="w-full text-sm px-3 py-2 rounded-xl border border-amber-200 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300 resize-none"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => { setRatingOrder(null); setRatingValue(0); setRatingComment(''); }} className="flex-1 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-500">Cancelar</button>
                              <button
                                onClick={handleSubmitRating}
                                disabled={!ratingValue || ratingSubmitting}
                                className="flex-1 py-2 rounded-xl text-sm font-bold text-white disabled:opacity-50 flex items-center justify-center gap-1.5"
                                style={{ backgroundColor: accent }}
                              >
                                {ratingSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                                Avaliar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => { setRatingOrder(order.id); setRatingValue(0); setRatingComment(''); }}
                            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-700 text-sm font-semibold hover:bg-amber-100 transition-colors"
                          >
                            <Star className="w-4 h-4" /> Avaliar este pedido
                          </button>
                        )
                      )}

                      {/* Actions */}
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleRepeatOrder(order)}
                          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-colors"
                          style={{ backgroundColor: accent + '15', color: accent }}
                        >
                          <RotateCcw className="w-4 h-4" /> Repetir pedido
                        </button>
                        {canCancel && (
                          <button
                            onClick={() => handleCancel(order.id)}
                            disabled={!!isCancelling}
                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-500 text-sm font-semibold hover:bg-red-100 transition-colors disabled:opacity-60"
                          >
                            {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ban className="w-4 h-4" />}
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="text-center pb-8 text-[11px] text-slate-300 font-semibold flex items-center justify-center gap-1.5 tracking-wide uppercase">
        <Zap className="w-3 h-3" /> Powered by ZapMenu
      </div>
    </div>
  );
}

import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabaseCustomer } from '../lib/supabaseCustomer';
import { useCustomerAuth } from '../lib/customerAuth';
import { db } from '../lib/db';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import type { Order, RestaurantSettings } from '../lib/types';
import { ArrowLeft, Clock, CheckCircle, XCircle, Truck, ShoppingBag, Package, LogOut, User, Loader2, Ban, ChefHat, MapPin, Zap, RotateCcw } from 'lucide-react';

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
}

function rowToOrder(r: OrderRowDb): Order {
  return {
    id: r.id, userId: r.user_id, customerUserId: r.customer_user_id ?? undefined,
    items: r.items, total: Number(r.total), status: r.status as Order['status'],
    customerName: r.customer_name, customerPhone: r.customer_phone,
    paymentMethod: r.payment_method as Order['paymentMethod'],
    deliveryAddress: r.delivery_address, deliveryType: r.delivery_type as Order['deliveryType'],
    pixTxId: r.pix_tx_id, pixQrCode: r.pix_qr_code, pixCopyPaste: r.pix_copy_paste,
    createdAt: r.created_at, paidAt: r.paid_at,
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
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [updatedIds, setUpdatedIds] = useState<Set<string>>(new Set());
  const channelRef = useRef<ReturnType<typeof supabaseCustomer.channel> | null>(null);

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
                            const active = order.status === s || (s === 'PENDING' && order.status === 'PAID');
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

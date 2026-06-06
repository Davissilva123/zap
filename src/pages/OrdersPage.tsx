import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { PAYMENT_METHOD_LABELS } from '../lib/xgate';
import { sendWhatsAppNotification } from '../lib/whatsapp';
import { playNewOrderSound, unlockAudio } from '../lib/sound';
import { printOrder } from '../lib/print';
import { supabase } from '../lib/supabase';
import type { Order, RestaurantSettings } from '../lib/types';
import { Clock, CheckCircle, XCircle, Eye, X, Truck, ShoppingBag, MapPin, Inbox, MessageCircle, Loader2, Printer, Volume2, VolumeX, Ban, Star, LayoutGrid, Tag } from 'lucide-react';

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string; bg: string }> = {
  PENDING: { label: 'Pendente', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
  PAID: { label: 'Pago', icon: CheckCircle, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  CANCELLED: { label: 'Cancelado', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  PREPARING: { label: 'Preparando', icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
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

export default function OrdersPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [filter, setFilter] = useState<string>('');
  const [sendingWhatsapp, setSendingWhatsapp] = useState<string | null>(null);
  const [whatsappSent, setWhatsappSent] = useState<Record<string, boolean>>({});
  const [whatsappError, setWhatsappError] = useState<string>('');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [autoPrint, setAutoPrint] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const settingsRef = useRef<RestaurantSettings | null>(null);

  const load = async () => {
    if (!user) return;
    const [o, s] = await Promise.all([db.getOrders(user.id), db.getSettings(user.id)]);
    setOrders(o);
    setSettings(s);
    settingsRef.current = s;
    knownIdsRef.current = new Set(o.map(x => x.id));
  };

  // Unlock audio on first interaction
  useEffect(() => {
    const handler = () => unlockAudio();
    window.addEventListener('click', handler, { once: true });
    return () => window.removeEventListener('click', handler);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();

    // Real-time subscription for new orders
    const channel = supabase
      .channel(`orders:${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` }, (payload) => {
        const newOrder = payload.new as Order & { user_id: string; customer_name: string; customer_phone: string; payment_method: string; delivery_address: unknown; delivery_type: string; pix_tx_id: string; pix_qr_code: string; pix_copy_paste: string; created_at: string; paid_at: string | null };
        if (knownIdsRef.current.has(newOrder.id)) return;
        knownIdsRef.current.add(newOrder.id);

        if (soundEnabled) playNewOrderSound();

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
        };

        setOrders(prev => [mapped, ...prev]);

        if (autoPrint && settingsRef.current) {
          printOrder(mapped, settingsRef.current);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, soundEnabled, autoPrint]);

  if (!user) return null;

  const filtered = orders.filter(o => !filter || o.status === filter);
  const formatDate = (d: string) => new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  const whatsappConfigured = settings?.whatsappEnabled && settings?.whatsappApiToken && settings?.whatsappPhoneNumberId;

  const updateStatus = async (orderId: string, newStatus: string) => {
    const order = orders.find(o => o.id === orderId);
    await db.updateOrder(orderId, { status: newStatus as Order['status'], paidAt: newStatus === 'PAID' ? new Date().toISOString() : undefined });
    load();
    if (selectedOrder?.id === orderId) {
      setSelectedOrder(prev => prev ? { ...prev, status: newStatus as Order['status'] } : null);
    }
    if (whatsappConfigured && order && settings) {
      setSendingWhatsapp(orderId);
      setWhatsappError('');
      try {
        await sendWhatsAppNotification(settings.whatsappApiToken, settings.whatsappPhoneNumberId, { ...order, status: newStatus as Order['status'] }, settings.name, newStatus);
        setWhatsappSent(prev => ({ ...prev, [orderId]: true }));
      } catch (err) {
        setWhatsappError(String(err));
      } finally {
        setSendingWhatsapp(null);
      }
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

  const sendManualWhatsapp = async (order: Order, status: string) => {
    if (!whatsappConfigured || !settings) return;
    setSendingWhatsapp(order.id);
    setWhatsappError('');
    try {
      await sendWhatsAppNotification(settings.whatsappApiToken, settings.whatsappPhoneNumberId, order, settings.name, status);
      setWhatsappSent(prev => ({ ...prev, [order.id]: true }));
    } catch (err) {
      setWhatsappError(String(err));
    } finally {
      setSendingWhatsapp(null);
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
            title={autoPrint ? 'Desativar impressão automática' : 'Ativar impressão automática'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-[13px] font-medium transition-colors ${autoPrint ? 'border-blue-200 bg-blue-50 text-blue-600' : 'border-slate-200 bg-white text-slate-400 hover:bg-slate-50'}`}
          >
            <Printer className="w-4 h-4" />
            {autoPrint ? 'Auto-imprimir ON' : 'Auto-imprimir OFF'}
          </button>
          {whatsappConfigured && (
            <div className="badge bg-emerald-50 text-emerald-700 py-1.5 px-3 gap-1.5">
              <MessageCircle className="w-3.5 h-3.5" /> WhatsApp ativo
            </div>
          )}
        </div>
      </div>

      {whatsappError && (
        <div className="card p-4 flex items-center gap-3 border-red-100 bg-red-50/50 animate-scale-in">
          <XCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800">Erro ao enviar WhatsApp</p>
            <p className="text-xs text-red-600 mt-0.5">{whatsappError}</p>
          </div>
          <button onClick={() => setWhatsappError('')} className="p-1 rounded-lg hover:bg-red-100"><X className="w-4 h-4 text-red-500" /></button>
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap">
        {[['', 'Todos'], ['PENDING', 'Pendente'], ['PAID', 'Pago'], ['PREPARING', 'Preparando'], ['DELIVERING', 'Entregando'], ['COMPLETED', 'Concluído'], ['CANCELLED', 'Cancelado']].map(([f, label]) => {
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

      {filtered.length === 0 ? (
        <div className="text-center py-16 animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
            <Inbox className="w-6 h-6 text-slate-400" />
          </div>
          <p className="text-slate-500 text-base font-medium">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="grid gap-2.5">
          {filtered.map(order => {
            const cfg = statusConfig[order.status] || statusConfig.PENDING;
            const payCfg = PAYMENT_METHOD_LABELS[order.paymentMethod];
            const isSending = sendingWhatsapp === order.id;
            const wasSent = whatsappSent[order.id];
            const canCancel = order.status !== 'CANCELLED' && order.status !== 'COMPLETED';
            return (
              <div key={order.id} className="card-hover">
                <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 flex-wrap sm:flex-nowrap">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg}`}>
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
                      {wasSent && <span className="badge bg-emerald-50 text-emerald-600 py-0.5 text-[10px]"><MessageCircle className="w-3 h-3" />Enviado</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`badge ${cfg.bg} ${cfg.color} py-0.5`}>{cfg.label}</span>
                      <span className="text-[12px] text-slate-400">{formatDate(order.createdAt)}</span>
                      {order.deliveryType === 'delivery' && order.deliveryAddress && (
                        <span className="text-[12px] text-slate-400 truncate flex items-center gap-0.5"><MapPin className="w-3 h-3 flex-shrink-0" />{formatAddress(order.deliveryAddress)}</span>
                      )}
                    </div>
                  </div>
                  <span className="text-sm sm:text-[17px] font-bold text-slate-900 tracking-tight flex-shrink-0 ml-auto sm:ml-0">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  {isSending && <Loader2 className="w-5 h-5 animate-spin text-emerald-500 flex-shrink-0" />}
                  {whatsappConfigured && !wasSent && !isSending && (
                    <button onClick={(e) => { e.stopPropagation(); sendManualWhatsapp(order, order.status); }} className="p-2 rounded-xl hover:bg-emerald-50 transition-colors flex-shrink-0" title="Enviar notificação WhatsApp">
                      <MessageCircle className="w-4 h-4 text-emerald-500" />
                    </button>
                  )}
                  {settings && (
                    <button onClick={(e) => { e.stopPropagation(); printOrder(order, settings); }} className="p-2 rounded-xl hover:bg-blue-50 transition-colors flex-shrink-0" title="Imprimir cupom">
                      <Printer className="w-4 h-4 text-blue-400" />
                    </button>
                  )}
                  {canCancel && (
                    <button onClick={(e) => { e.stopPropagation(); cancelOrder(order.id); }} className="p-2 rounded-xl hover:bg-red-50 transition-colors flex-shrink-0" title="Cancelar pedido">
                      <Ban className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                  <button onClick={() => setSelectedOrder(order)} className="p-2 rounded-xl hover:bg-slate-100/80 transition-colors flex-shrink-0">
                    <Eye className="w-4 h-4 text-slate-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setSelectedOrder(null)} />
          <div className="relative bg-white rounded-3xl shadow-elevated w-full max-w-lg p-7 z-10 max-h-[85vh] overflow-y-auto animate-scale-in">
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
                  {selectedOrder.status === 'PENDING' && <button onClick={() => updateStatus(selectedOrder.id, 'PAID')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100/80 transition-colors">Confirmar pgto</button>}
                  {(selectedOrder.status === 'PAID' || selectedOrder.status === 'PENDING') && <button onClick={() => updateStatus(selectedOrder.id, 'PREPARING')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100/80 transition-colors">Preparar</button>}
                  {selectedOrder.status === 'PREPARING' && selectedOrder.deliveryType === 'delivery' && <button onClick={() => updateStatus(selectedOrder.id, 'DELIVERING')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100/80 transition-colors">Saiu para entrega</button>}
                  {selectedOrder.status === 'PREPARING' && selectedOrder.deliveryType === 'pickup' && <button onClick={() => updateStatus(selectedOrder.id, 'COMPLETED')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200/80 transition-colors">Entregue</button>}
                  {selectedOrder.status === 'DELIVERING' && <button onClick={() => updateStatus(selectedOrder.id, 'COMPLETED')} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-slate-100 text-slate-600 hover:bg-slate-200/80 transition-colors">Entregue</button>}
                  {selectedOrder.status !== 'CANCELLED' && selectedOrder.status !== 'COMPLETED' && (
                    <button onClick={() => cancelOrder(selectedOrder.id)} className="px-3 py-1.5 text-[12px] font-semibold rounded-lg bg-red-50 text-red-500 hover:bg-red-100/80 transition-colors flex items-center gap-1">
                      <Ban className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  )}
                </div>
              </div>

              {/* Print button */}
              {settings && (
                <button
                  onClick={() => printOrder(selectedOrder, settings)}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-600 text-sm font-semibold hover:bg-blue-100/80 transition-colors"
                >
                  <Printer className="w-4 h-4" /> Imprimir Cupom
                </button>
              )}

              {whatsappConfigured && (
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-100/50 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4 text-emerald-600" />
                      <span className="text-xs text-emerald-700 font-medium">
                        {sendingWhatsapp === selectedOrder.id ? 'Enviando...' : whatsappSent[selectedOrder.id] ? 'Notificação enviada' : 'Enviar WhatsApp'}
                      </span>
                      {sendingWhatsapp === selectedOrder.id && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500" />}
                    </div>
                    {!whatsappSent[selectedOrder.id] && sendingWhatsapp !== selectedOrder.id && (
                      <button onClick={() => sendManualWhatsapp(selectedOrder, selectedOrder.status)} className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors">Enviar agora</button>
                    )}
                    {whatsappSent[selectedOrder.id] && (
                      <button onClick={() => sendManualWhatsapp(selectedOrder, selectedOrder.status)} className="px-3 py-1 text-[11px] font-semibold rounded-lg bg-white text-emerald-700 border border-emerald-200 hover:bg-emerald-50 transition-colors" disabled={sendingWhatsapp === selectedOrder.id}>Reenviar</button>
                    )}
                  </div>
                </div>
              )}

              <div className="h-px bg-slate-100" />

              <div className="grid grid-cols-2 gap-4">
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

              {selectedOrder.pixTxId && (
                <div className="p-3 bg-slate-50 rounded-xl">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">TX ID</p>
                  <code className="text-[11px] text-slate-500 break-all font-mono">{selectedOrder.pixTxId}</code>
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

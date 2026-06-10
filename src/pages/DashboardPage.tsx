import { useEffect, useRef, useState } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Scan, Category, MenuItem, RestaurantSettings, Order } from '../lib/types';
import { Eye, UtensilsCrossed, Grid3X3, TrendingUp, ArrowUpRight, PowerOff, Loader2, Receipt, DollarSign, ShoppingBag, BarChart2, Clock, CalendarDays, Wifi } from 'lucide-react';

function LiveBadge() {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-[11px] font-bold text-emerald-700">
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse block" />
      Ao vivo
    </span>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const [scans, setScans] = useState<Scan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [settings, setSettings] = useState<RestaurantSettings | null>(null);
  const [closingToggle, setClosingToggle] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const [newOrderFlash, setNewOrderFlash] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [s, c, i, st, o] = await Promise.all([
        db.getScans(user.id),
        db.getCategories(user.id),
        db.getMenuItems(user.id),
        db.getSettings(user.id),
        db.getOrders(user.id),
      ]);
      setScans(s);
      setCategories(c);
      setItems(i);
      setSettings(st);
      setOrders(o);
      knownIdsRef.current = new Set(o.map(x => x.id));
    };
    load();
  }, [user]);

  // Realtime subscription for live order updates
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const raw = payload.new as any;
          if (knownIdsRef.current.has(raw.id)) return;
          knownIdsRef.current.add(raw.id);

          const mapped: Order = {
            id: raw.id,
            userId: raw.user_id,
            customerUserId: raw.customer_user_id ?? undefined,
            items: raw.items,
            total: Number(raw.total),
            discount: Number(raw.discount ?? 0),
            couponCode: raw.coupon_code ?? undefined,
            status: raw.status,
            customerName: raw.customer_name,
            customerPhone: raw.customer_phone,
            paymentMethod: raw.payment_method,
            deliveryAddress: raw.delivery_address,
            deliveryType: raw.delivery_type,
            tableName: raw.table_name ?? undefined,
            notes: raw.notes ?? undefined,
            pixTxId: raw.pix_tx_id,
            pixQrCode: raw.pix_qr_code,
            pixCopyPaste: raw.pix_copy_paste,
            scheduledFor: raw.scheduled_for ?? null,
            createdAt: raw.created_at,
            paidAt: raw.paid_at,
          };

          setOrders(prev => [mapped, ...prev]);
          setNewOrderFlash(true);
          setTimeout(() => setNewOrderFlash(false), 3000);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders', filter: `user_id=eq.${user.id}` },
        (payload) => {
          const raw = payload.new as any;
          setOrders(prev => prev.map(o => o.id === raw.id
            ? { ...o, status: raw.status, paidAt: raw.paid_at }
            : o
          ));
        }
      )
      .subscribe((status) => {
        setRealtimeConnected(status === 'SUBSCRIBED');
      });

    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const toggleClosed = async () => {
    if (!user || !settings) return;
    setClosingToggle(true);
    const next = !settings.manualClosed;
    await db.updateSettings(user.id, { manualClosed: next });
    setSettings(s => s ? { ...s, manualClosed: next } : s);
    setClosingToggle(false);
  };

  if (!user) return null;

  const totalItems = items.length;
  const totalCategories = categories.length;
  const availableItems = items.filter(i => i.available).length;

  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const activeOrders = orders.filter(o => o.status !== 'CANCELLED');
  const todayOrders = activeOrders.filter(o => o.createdAt.slice(0, 10) === today);
  const monthOrders = activeOrders.filter(o => o.createdAt.slice(0, 7) === thisMonth);
  const pendingOrders = orders.filter(o => o.status === 'PENDING' || o.status === 'PAID' || o.status === 'PREPARING');
  const scheduledOrders = activeOrders.filter(o => o.scheduledFor);
  const todayRevenue = todayOrders
    .filter(o => ['COMPLETED', 'DELIVERING', 'PAID', 'PREPARING'].includes(o.status))
    .reduce((s, o) => s + o.total - (o.discount ?? 0), 0);
  const avgTicket = activeOrders.length ? activeOrders.reduce((s, o) => s + o.total, 0) / activeOrders.length : 0;
  const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (13 - i));
    const dayStr = d.toISOString().slice(0, 10);
    const count = scans.filter(s => s.scannedAt.slice(0, 10) === dayStr).length;
    return { day: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''), count, date: dayStr };
  });
  const maxCount = Math.max(...last14.map(d => d.count), 1);

  const stats = [
    { label: 'Itens no Cardápio', value: totalItems, icon: UtensilsCrossed, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', accent: 'border-l-blue-500' },
    { label: 'Categorias', value: totalCategories, icon: Grid3X3, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', accent: 'border-l-violet-500' },
    { label: 'Disponíveis', value: availableItems, icon: TrendingUp, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', accent: 'border-l-amber-500' },
    { label: 'Scans total', value: scans.length, icon: Eye, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', accent: 'border-l-emerald-500' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="text-slate-500 mt-0.5 text-sm">Visão geral do seu ZapMenu</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap justify-end">
          {realtimeConnected && <LiveBadge />}
          {settings && (
            <button
              onClick={toggleClosed}
              disabled={closingToggle}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl border text-sm font-semibold transition-all ${
                settings.manualClosed
                  ? 'bg-red-50 border-red-200 text-red-600 hover:bg-red-100'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
              }`}
            >
              {closingToggle ? <Loader2 className="w-4 h-4 animate-spin" /> : <PowerOff className="w-4 h-4" />}
              {settings.manualClosed ? 'Restaurante fechado' : 'Restaurante aberto'}
            </button>
          )}
        </div>
      </div>

      {/* Live order metrics */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest">Pedidos em tempo real</p>
          {realtimeConnected && <Wifi className="w-3 h-3 text-emerald-500" />}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className={`card p-4 sm:p-5 border-l-4 border-l-orange-500 transition-all duration-500 ${newOrderFlash ? 'ring-2 ring-orange-400 bg-orange-50/30' : ''}`}>
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">Pedidos hoje</p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0 relative">
                <Receipt className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-orange-600" strokeWidth={1.75} />
                {newOrderFlash && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-orange-500 animate-ping" />
                )}
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{todayOrders.length}</p>
          </div>

          <div className="card p-4 sm:p-5 border-l-4 border-l-emerald-500">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">Receita hoje</p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0">
                <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{fmt(todayRevenue)}</p>
          </div>

          <div className={`card p-4 sm:p-5 border-l-4 ${pendingOrders.length > 0 ? 'border-l-red-500' : 'border-l-slate-300'}`}>
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">Pendentes agora</p>
              <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center flex-shrink-0 relative ${pendingOrders.length > 0 ? 'bg-red-50' : 'bg-slate-50'}`}>
                <Clock className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${pendingOrders.length > 0 ? 'text-red-500' : 'text-slate-400'}`} strokeWidth={1.75} />
                {pendingOrders.length > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">{pendingOrders.length}</span>
                )}
              </div>
            </div>
            <p className={`text-2xl sm:text-3xl font-bold tracking-tight ${pendingOrders.length > 0 ? 'text-red-600' : 'text-slate-900'}`}>{pendingOrders.length}</p>
          </div>

          <div className="card p-4 sm:p-5 border-l-4 border-l-blue-500">
            <div className="flex items-start justify-between mb-2 sm:mb-3">
              <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">Agendados</p>
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <CalendarDays className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-blue-600" strokeWidth={1.75} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{scheduledOrders.length}</p>
          </div>
        </div>
      </div>

      {/* Scheduled orders preview */}
      {scheduledOrders.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-blue-500" />
            <span className="text-sm font-semibold text-slate-900">Pedidos agendados</span>
            <span className="ml-auto text-xs text-slate-400">{scheduledOrders.length} pedido{scheduledOrders.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-slate-50">
            {scheduledOrders.slice(0, 4).map(o => (
              <div key={o.id} className="px-4 py-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-800 truncate">{o.customerName}</p>
                  <p className="text-xs text-slate-400">{o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-bold text-blue-600">{o.scheduledFor ? new Date(o.scheduledFor).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{fmt(o.total)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Period metrics */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Desempenho</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { label: 'Ticket médio', value: fmt(avgTicket), icon: BarChart2, iconBg: 'bg-blue-50', iconColor: 'text-blue-600', accent: 'border-l-blue-500' },
            { label: 'Pedidos do mês', value: monthOrders.length, icon: ShoppingBag, iconBg: 'bg-violet-50', iconColor: 'text-violet-600', accent: 'border-l-violet-500' },
            { label: 'Itens disponíveis', value: availableItems, icon: TrendingUp, iconBg: 'bg-amber-50', iconColor: 'text-amber-600', accent: 'border-l-amber-500' },
            { label: 'Categorias', value: totalCategories, icon: Grid3X3, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', accent: 'border-l-emerald-500' },
          ].map(s => (
            <div key={s.label} className={`card p-4 sm:p-5 border-l-4 ${s.accent}`}>
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">{s.label}</p>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${s.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <s.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${s.iconColor}`} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scans chart */}
      <div className="card p-6">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h3 className="font-semibold text-slate-900 text-[15px]">Scans nos últimos 14 dias</h3>
            <p className="text-sm text-slate-400 mt-0.5">{scans.length} scans no total</p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <Eye className="w-3 h-3" />
            Ativo
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-40">
          {last14.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
              <div className="relative w-full">
                <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[11px] font-bold text-slate-700 opacity-0 group-hover:opacity-100 transition-opacity bg-white border border-slate-200 rounded-md px-1.5 py-0.5 shadow-sm whitespace-nowrap z-10">
                  {d.count} scan{d.count !== 1 ? 's' : ''}
                </span>
                <div
                  className="w-full rounded-t-md bg-emerald-500 transition-all duration-500 min-h-[3px] group-hover:bg-emerald-400"
                  style={{ height: `${Math.max((d.count / maxCount) * 100, 4)}%`, opacity: d.count > 0 ? 1 : 0.1 }}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-medium uppercase">{d.day}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cardápio metrics */}
      <div>
        <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-widest mb-3">Cardápio</p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map(stat => (
            <div key={stat.label} className={`card p-4 sm:p-5 border-l-4 ${stat.accent}`}>
              <div className="flex items-start justify-between mb-2 sm:mb-3">
                <p className="text-[11px] sm:text-[13px] font-medium text-slate-500 leading-snug">{stat.label}</p>
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg ${stat.iconBg} flex items-center justify-center flex-shrink-0`}>
                  <stat.icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${stat.iconColor}`} strokeWidth={1.75} />
                </div>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
            </div>
          ))}
        </div>
      </div>

      {totalItems === 0 && (
        <div className="card p-5 border-l-4 border-l-blue-500 bg-blue-50/30">
          <p className="text-sm font-semibold text-blue-900 mb-1">Configure seu cardápio</p>
          <p className="text-sm text-blue-700">Comece adicionando categorias e itens ao seu cardápio para que os clientes possam visualizá-los via QR Code.</p>
        </div>
      )}
    </div>
  );
}

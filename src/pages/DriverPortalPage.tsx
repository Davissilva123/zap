import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { db } from '../lib/db';
import type { Order } from '../lib/types';
import { Bike, MapPin, Phone, Navigation, CheckCircle, Loader2, RefreshCw, Package, Zap, LocateFixed, WifiOff } from 'lucide-react';
import { supabase } from '../lib/supabase';

function formatAddress(addr: Order['deliveryAddress']): string {
  if (!addr) return '';
  const parts = [addr.street, addr.number].filter(Boolean);
  if (addr.complement) parts.push(addr.complement);
  parts.push(addr.neighborhood, addr.city);
  if (addr.state) parts.push(addr.state);
  return parts.filter(Boolean).join(', ');
}

function openMaps(addr: Order['deliveryAddress']) {
  if (!addr) return;
  const query = encodeURIComponent(formatAddress(addr));
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank');
}

function openWaze(addr: Order['deliveryAddress']) {
  if (!addr) return;
  const query = encodeURIComponent(formatAddress(addr));
  window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
}

export default function DriverPortalPage() {
  const { token } = useParams<{ token: string }>();
  const [driver, setDriver] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [completing, setCompleting] = useState<string | null>(null);
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [navModal, setNavModal] = useState<Order | null>(null);
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState('');
  const watchIdRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!token) return;
    const [d, o] = await Promise.all([
      db.getDriverByToken(token),
      db.getDriverOrders(token),
    ]);
    if (!d) { setError('Link inválido ou expirado.'); setLoading(false); return; }
    setDriver(d);
    setOrders(o);
    setLoading(false);
  }, [token]);

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  const toggleGps = () => {
    if (gpsActive) {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      setGpsActive(false);
      setGpsError('');
      return;
    }
    if (!navigator.geolocation) { setGpsError('GPS nao disponivel neste dispositivo'); return; }
    setGpsError('');
    const id = navigator.geolocation.watchPosition(
      async pos => {
        if (!driver) return;
        await supabase.from('drivers').update({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          last_location_at: new Date().toISOString(),
        }).eq('id', driver.id);
      },
      () => setGpsError('Erro ao obter localizacao. Verifique as permissoes.'),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
    );
    watchIdRef.current = id;
    setGpsActive(true);
  };

  useEffect(() => {
    return () => { if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current); };
  }, []);

  const handleComplete = async (order: Order) => {
    if (!token) return;
    setCompleting(order.id);
    await db.completeDriverOrder(token, order.id);
    setCompleted(prev => new Set([...prev, order.id]));
    setCompleting(null);
    setTimeout(() => load(), 500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-4">
          <Bike className="w-8 h-8 text-red-400" />
        </div>
        <p className="text-white font-bold text-lg">Link inválido</p>
        <p className="text-slate-400 text-sm mt-2">{error}</p>
      </div>
    );
  }

  const active = orders.filter(o => !completed.has(o.id));

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-white/[0.06] px-5 py-4">
        <div className="flex items-center gap-3 max-w-lg mx-auto">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Zap className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="font-bold text-white text-sm leading-none">ZapMenu</p>
            <p className="text-emerald-400 text-xs mt-0.5 font-medium">Portal do Entregador</p>
          </div>
          <div className="ml-auto text-right space-y-1">
            <p className="text-white font-bold text-sm">{driver?.name}</p>
            <div className="flex items-center gap-2 justify-end">
              <button onClick={load} className="flex items-center gap-1 text-slate-400 text-xs hover:text-slate-200 transition-colors">
                <RefreshCw className="w-3 h-3" /> Atualizar
              </button>
              <button
                onClick={toggleGps}
                className={`flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full transition-colors ${gpsActive ? 'bg-emerald-500 text-white' : 'bg-slate-700 text-slate-400 hover:text-slate-200'}`}
              >
                {gpsActive ? <LocateFixed className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
                {gpsActive ? 'GPS ativo' : 'GPS off'}
              </button>
            </div>
            {gpsError && <p className="text-xs text-red-400">{gpsError}</p>}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-lg mx-auto px-4 py-5 space-y-4">
        {active.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <Package className="w-8 h-8 text-slate-500" />
            </div>
            <p className="text-slate-300 font-semibold">Nenhuma entrega no momento</p>
            <p className="text-slate-500 text-sm mt-1">Esta tela atualiza a cada 30 segundos</p>
          </div>
        ) : (
          <>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-widest">
              {active.length} entrega{active.length !== 1 ? 's' : ''} em andamento
            </p>
            {active.map(order => (
              <div key={order.id} className="bg-slate-800 rounded-2xl border border-white/[0.06] overflow-hidden">
                {/* Order header */}
                <div className="px-4 pt-4 pb-3 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between">
                    <p className="font-bold text-white">{order.customerName}</p>
                    <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                      R$ {order.total.toFixed(2).replace('.', ',')}
                    </span>
                  </div>
                  {order.customerPhone && (
                    <a
                      href={`tel:${order.customerPhone}`}
                      className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-400 hover:text-emerald-400 transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      {order.customerPhone}
                    </a>
                  )}
                </div>

                {/* Address */}
                {order.deliveryAddress && (
                  <div className="px-4 py-3 border-b border-white/[0.06]">
                    <div className="flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-300 leading-relaxed">{formatAddress(order.deliveryAddress)}</p>
                    </div>
                    {order.notes && (
                      <p className="text-xs text-amber-400 mt-2 bg-amber-400/10 rounded-lg px-3 py-1.5">
                        ⚠️ {order.notes}
                      </p>
                    )}
                  </div>
                )}

                {/* Items summary */}
                <div className="px-4 py-2.5 border-b border-white/[0.06]">
                  <p className="text-xs text-slate-500">
                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(' · ')}
                  </p>
                </div>

                {/* Actions */}
                <div className="p-3 flex gap-2">
                  <button
                    onClick={() => setNavModal(order)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-500 text-white text-sm font-bold hover:bg-blue-600 active:scale-95 transition-all"
                  >
                    <Navigation className="w-4 h-4" />
                    Navegar
                  </button>
                  <button
                    onClick={() => handleComplete(order)}
                    disabled={completing === order.id}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 text-white text-sm font-bold hover:bg-emerald-600 active:scale-95 disabled:opacity-50 transition-all"
                  >
                    {completing === order.id
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle className="w-4 h-4" />}
                    Entregue
                  </button>
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Nav app picker modal */}
      {navModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setNavModal(null)}>
          <div className="bg-slate-800 rounded-2xl w-full max-w-sm border border-white/[0.06] overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-white/[0.06]">
              <p className="font-bold text-white text-sm">Abrir navegação</p>
              <p className="text-xs text-slate-400 mt-0.5 truncate">{formatAddress(navModal.deliveryAddress)}</p>
            </div>
            <div className="p-3 space-y-2">
              <button
                onClick={() => { openMaps(navModal.deliveryAddress); setNavModal(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors text-left"
              >
                <span className="text-2xl">🗺️</span>
                <div>
                  <p className="text-sm font-bold text-white">Google Maps</p>
                  <p className="text-xs text-slate-400">Abrir no Google Maps</p>
                </div>
              </button>
              <button
                onClick={() => { openWaze(navModal.deliveryAddress); setNavModal(null); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors text-left"
              >
                <span className="text-2xl">🚗</span>
                <div>
                  <p className="text-sm font-bold text-white">Waze</p>
                  <p className="text-xs text-slate-400">Abrir no Waze</p>
                </div>
              </button>
            </div>
            <div className="px-3 pb-3">
              <button onClick={() => setNavModal(null)} className="w-full py-3 rounded-xl text-slate-400 text-sm font-semibold hover:bg-slate-700 transition-colors">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

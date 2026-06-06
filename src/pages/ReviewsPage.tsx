import { useEffect, useState } from 'react';
import { db } from '../lib/db';
import { useRestaurantId } from '../lib/auth';
import type { Order } from '../lib/types';
import { Star, MessageSquare, TrendingUp, Inbox } from 'lucide-react';

function Stars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'lg' }) {
  const sz = size === 'lg' ? 'w-5 h-5' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} className={`${sz} ${s <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`} />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const restaurantId = useRestaurantId();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    db.getOrders(restaurantId).then(all => {
      setOrders(all.filter(o => o.rating != null).sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
      setLoading(false);
    });
  }, [restaurantId]);

  const rated = orders;
  const avgRating = rated.length ? rated.reduce((s, o) => s + (o.rating ?? 0), 0) / rated.length : 0;
  const dist = [5, 4, 3, 2, 1].map(s => ({ star: s, count: rated.filter(o => o.rating === s).length }));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Avaliações</h1>
        <p className="text-slate-500 mt-0.5 text-sm">O que seus clientes estão dizendo</p>
      </div>

      {rated.length === 0 ? (
        <div className="card p-16 text-center">
          <Inbox className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhuma avaliação ainda</p>
          <p className="text-slate-400 text-sm mt-1">As avaliações aparecem aqui após os clientes concluírem um pedido</p>
        </div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card p-6 flex items-center gap-5">
              <div className="text-center">
                <p className="text-5xl font-extrabold text-slate-900 tracking-tight">{avgRating.toFixed(1)}</p>
                <Stars rating={Math.round(avgRating)} size="lg" />
                <p className="text-xs text-slate-400 mt-1.5">{rated.length} avaliação{rated.length !== 1 ? 'ões' : ''}</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {dist.map(({ star, count }) => (
                  <div key={star} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-500 w-3">{star}</span>
                    <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />
                    <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-400 transition-all"
                        style={{ width: rated.length ? `${(count / rated.length) * 100}%` : '0%' }}
                      />
                    </div>
                    <span className="text-xs text-slate-400 w-4 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card p-6 flex flex-col gap-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Resumo
              </div>
              {[5, 4, 3].map(threshold => {
                const pct = rated.length ? Math.round((rated.filter(o => (o.rating ?? 0) >= threshold).length / rated.length) * 100) : 0;
                const labels: Record<number, string> = { 5: 'Excelente (5★)', 4: 'Bom ou mais (4★+)', 3: 'Regular ou mais (3★+)' };
                return (
                  <div key={threshold} className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">{labels[threshold]}</span>
                    <span className="font-bold text-slate-800">{pct}%</span>
                  </div>
                );
              })}
              <div className="pt-1 border-t border-slate-100 flex items-center justify-between text-sm">
                <span className="text-slate-500">Com comentário</span>
                <span className="font-bold text-slate-800">{rated.filter(o => o.ratingComment).length}</span>
              </div>
            </div>
          </div>

          {/* Review list */}
          <div className="space-y-3">
            {rated.map(order => (
              <div key={order.id} className="card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 font-bold text-slate-500 text-sm">
                      {order.customerName.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 text-sm">{order.customerName}</p>
                      <p className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Stars rating={order.rating!} />
                    <span className="text-xs text-slate-400">R$ {order.total.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
                {order.ratingComment && (
                  <div className="mt-3 flex gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-600 italic">{order.ratingComment}</p>
                  </div>
                )}
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {order.items.slice(0, 3).map((item, i) => (
                    <span key={i} className="text-[11px] bg-slate-50 text-slate-500 px-2 py-0.5 rounded-full border border-slate-100">
                      {item.emoji} {item.name} ×{item.quantity}
                    </span>
                  ))}
                  {order.items.length > 3 && (
                    <span className="text-[11px] bg-slate-50 text-slate-400 px-2 py-0.5 rounded-full border border-slate-100">+{order.items.length - 3}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

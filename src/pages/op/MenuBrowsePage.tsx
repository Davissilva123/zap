import { useEffect, useState } from 'react';
import { db } from '../../lib/db';
import { useRestaurantId } from '../../lib/auth';
import type { Category, MenuItem } from '../../lib/types';
import { UtensilsCrossed, Inbox, Search } from 'lucide-react';

const fmt = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

export default function OpMenuBrowsePage() {
  const restaurantId = useRestaurantId();
  const [categories, setCategories] = useState<Category[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [filterCat, setFilterCat] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    Promise.all([db.getCategories(restaurantId), db.getMenuItems(restaurantId)]).then(([c, i]) => {
      setCategories(c);
      setItems(i.filter(x => x.available));
      setLoading(false);
    });
  }, [restaurantId]);

  const visible = items.filter(i =>
    (!filterCat || i.categoryId === filterCat) &&
    (!search || i.name.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cardápio</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Consulta do cardápio para atendimento</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar item..."
          className="input w-full pl-10"
        />
      </div>

      {/* Category tabs */}
      <div className="flex gap-1.5 flex-wrap">
        <button
          onClick={() => setFilterCat('')}
          className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${!filterCat ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
        >
          Todos
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setFilterCat(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-[13px] font-medium transition-all ${filterCat === cat.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
          >
            {cat.emoji} {cat.name}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Carregando cardápio...</div>
      ) : visible.length === 0 ? (
        <div className="card p-16 text-center">
          <Inbox className="w-8 h-8 text-slate-200 mx-auto mb-2" />
          <p className="text-slate-400 text-sm">Nenhum item encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {visible.map(item => (
            <div key={item.id} className="card p-3 flex flex-col gap-2">
              {item.imageUrl && (
                <img src={item.imageUrl} alt={item.name} className="w-full h-24 object-cover rounded-xl" />
              )}
              <div className="flex-1">
                <p className="font-semibold text-slate-900 text-sm leading-tight">
                  {item.emoji} {item.name}
                </p>
                {item.description && (
                  <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1.5">
                  {item.promoPrice ? (
                    <>
                      <span className="text-emerald-600 font-bold text-sm">{fmt(item.promoPrice)}</span>
                      <span className="text-slate-400 text-xs line-through">{fmt(item.price)}</span>
                    </>
                  ) : (
                    <span className="text-emerald-600 font-bold text-sm">{fmt(item.price)}</span>
                  )}
                </div>
              </div>
              {item.featured && (
                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full self-start">
                  ⭐ Destaque
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 text-xs text-slate-400 pt-2">
        <UtensilsCrossed className="w-3.5 h-3.5" />
        <span>{visible.length} item{visible.length !== 1 ? 'ns' : ''} disponíve{visible.length !== 1 ? 'is' : 'l'}</span>
      </div>
    </div>
  );
}

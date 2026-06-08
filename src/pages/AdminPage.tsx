import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import { db } from '../lib/db';
import type { RestaurantSettings } from '../lib/types';
import { Shield, Users, Store, Calendar, Search, RefreshCw, ExternalLink, Zap } from 'lucide-react';

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL as string | undefined;

export default function AdminPage() {
  const { user } = useAuth();
  const [restaurants, setRestaurants] = useState<RestaurantSettings[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const isSuperAdmin = !!(user?.email && SUPER_ADMIN_EMAIL && user.email === SUPER_ADMIN_EMAIL);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await db.getAllRestaurants();
      setRestaurants(data);
    } catch (e: any) {
      setError(e?.message ?? 'Erro ao carregar restaurantes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) load();
    else setLoading(false);
  }, [user]);

  if (!isSuperAdmin) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-4">
        <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center mb-4">
          <Shield className="w-7 h-7 text-red-400" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 mb-2">Acesso restrito</h2>
        <p className="text-slate-500 text-sm">Esta área é exclusiva para super-administradores.</p>
      </div>
    );
  }

  const filtered = restaurants.filter(r =>
    r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.slug.toLowerCase().includes(search.toLowerCase()) ||
    (r.phone && r.phone.includes(search))
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Shield className="w-5 h-5 text-violet-500" />
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Painel Super-Admin</h1>
          </div>
          <p className="text-slate-500 text-sm">Visão geral de todos os restaurantes na plataforma</p>
        </div>
        <button onClick={load} className="btn-secondary" disabled={loading}>
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Restaurantes', value: restaurants.length, icon: Store, color: 'text-emerald-600 bg-emerald-50' },
          { label: 'Com PIX', value: restaurants.filter(r => r.mercadoPagoToken).length, icon: Zap, color: 'text-blue-600 bg-blue-50' },
          { label: 'Com WhatsApp', value: restaurants.filter(r => r.whatsappEnabled).length, icon: Users, color: 'text-violet-600 bg-violet-50' },
          { label: 'Cadastrados hoje', value: restaurants.filter(r => r.userId && new Date(r.userId).toDateString() === new Date().toDateString()).length, icon: Calendar, color: 'text-amber-600 bg-amber-50' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2.5 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-black text-slate-900 mb-0.5">{s.value}</div>
            <div className="text-xs text-slate-400 font-medium">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, slug ou telefone..."
          className="input w-full pl-10"
        />
      </div>

      {error && (
        <div className="card p-5 bg-red-50 border border-red-200 text-red-700 text-sm">
          <strong>Erro:</strong> {error}
          <br />
          <span className="text-xs text-red-500 mt-1 block">
            Execute o SQL de <code>supabase-features-v7.sql</code> para criar a função <code>get_all_restaurants()</code>.
          </span>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900 text-sm">
              {filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}
            </h3>
          </div>
          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum restaurante encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(r => (
                <div key={r.userId} className="px-5 py-4 hover:bg-slate-50/50 transition-colors">
                  <div className="flex items-center gap-4">
                    {r.logoUrl ? (
                      <img src={r.logoUrl} alt={r.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <Store className="w-5 h-5 text-slate-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 text-sm">{r.name}</span>
                        {r.mercadoPagoToken && (
                          <span className="badge bg-blue-50 text-blue-600 text-[10px] py-0.5">PIX</span>
                        )}
                        {r.whatsappEnabled && (
                          <span className="badge bg-green-50 text-green-600 text-[10px] py-0.5">WhatsApp</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-slate-400 font-mono">/m/{r.slug}</span>
                        {r.phone && <span className="text-xs text-slate-400">{r.phone}</span>}
                      </div>
                    </div>
                    <a
                      href={`/m/${r.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-lg hover:bg-slate-100 transition-colors flex-shrink-0"
                      title="Ver cardápio"
                    >
                      <ExternalLink className="w-4 h-4 text-slate-400" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

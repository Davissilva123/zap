import { useEffect, useState, useMemo } from 'react';
import { db } from '../lib/db';
import { useAuth } from '../lib/auth';
import type { CustomerRecord } from '../lib/types';
import { Users, Star, TrendingUp, AlertTriangle, XCircle, MessageCircle, Search, ChevronDown, ChevronUp, Phone } from 'lucide-react';

type Segment = 'all' | 'loyal' | 'active' | 'at_risk' | 'inactive';

const SEG_LABEL: Record<string, string> = {
  all: 'Todos', loyal: 'Fieis', active: 'Ativos', at_risk: 'Em risco', inactive: 'Inativos',
};
const SEG_COLOR: Record<string, string> = {
  loyal: 'text-violet-700 bg-violet-50 border-violet-200',
  active: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  at_risk: 'text-amber-700 bg-amber-50 border-amber-200',
  inactive: 'text-slate-500 bg-slate-100 border-slate-200',
};
const SEG_DOT: Record<string, string> = {
  loyal: 'bg-violet-500', active: 'bg-emerald-500', at_risk: 'bg-amber-500', inactive: 'bg-slate-400',
};

function daysSince(iso: string) {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function fmt(n: number) {
  return n.toFixed(2).replace('.', ',');
}

export default function CRMPage() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState<CustomerRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState<Segment>('all');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<'totalSpent' | 'totalOrders' | 'lastOrderAt'>('totalSpent');
  const [sortAsc, setSortAsc] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    db.getCRMCustomers(user.id).then(data => { setCustomers(data); setLoading(false); });
  }, [user]);

  const counts = useMemo(() => ({
    all: customers.length,
    loyal: customers.filter(c => c.segment === 'loyal').length,
    active: customers.filter(c => c.segment === 'active').length,
    at_risk: customers.filter(c => c.segment === 'at_risk').length,
    inactive: customers.filter(c => c.segment === 'inactive').length,
  }), [customers]);

  const filtered = useMemo(() => {
    let list = customers;
    if (segment !== 'all') list = list.filter(c => c.segment === segment);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
    }
    return [...list].sort((a, b) => {
      const va = sortKey === 'lastOrderAt' ? new Date(a[sortKey]).getTime() : a[sortKey];
      const vb = sortKey === 'lastOrderAt' ? new Date(b[sortKey]).getTime() : b[sortKey];
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
  }, [customers, segment, search, sortKey, sortAsc]);

  const totalRevenue = useMemo(() => filtered.reduce((s, c) => s + c.totalSpent, 0), [filtered]);

  const toggleSort = (key: typeof sortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const openWhatsApp = (phone: string, name: string) => {
    const num = phone.replace(/\D/g, '');
    const msg = encodeURIComponent(`Ola ${name}! Temos novidades para voce.`);
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank');
  };

  if (!user) return null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">CRM de Clientes</h1>
        <p className="text-slate-500 mt-0.5 text-sm">Base consolidada de clientes derivada dos pedidos</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {(['loyal', 'active', 'at_risk', 'inactive'] as Segment[]).map(seg => (
          <button
            key={seg}
            onClick={() => setSegment(s => s === seg ? 'all' : seg)}
            className={`card p-4 text-left transition-all border-2 ${segment === seg ? 'border-emerald-400 shadow-sm' : 'border-transparent'}`}
          >
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{SEG_LABEL[seg]}</p>
            <p className="text-2xl font-black text-slate-900">{counts[seg]}</p>
            <div className={`inline-flex items-center gap-1 mt-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${SEG_COLOR[seg]}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${SEG_DOT[seg]}`} />
              {seg === 'loyal' ? 'Fiel' : seg === 'active' ? 'Ativo' : seg === 'at_risk' ? 'Em risco' : 'Inativo'}
            </div>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone..."
            className="input w-full pl-9"
          />
        </div>
        <div className="flex gap-2">
          {(['all', 'loyal', 'active', 'at_risk', 'inactive'] as Segment[]).map(seg => (
            <button
              key={seg}
              onClick={() => setSegment(seg)}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all ${segment === seg ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-400'}`}
            >
              {SEG_LABEL[seg]}
            </button>
          ))}
        </div>
      </div>

      {/* Summary row */}
      <div className="text-sm text-slate-500">
        <span className="font-semibold text-slate-900">{filtered.length}</span> clientes &bull; Faturamento acumulado: <span className="font-semibold text-emerald-600">R$ {fmt(totalRevenue)}</span>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-12 flex items-center justify-center">
          <div className="w-7 h-7 border-4 border-emerald-200 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="card p-16 text-center">
          <Users className="w-10 h-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">Nenhum cliente encontrado</p>
          <p className="text-slate-400 text-sm mt-1">Os clientes aparecem automaticamente conforme os pedidos chegam</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          {/* Header */}
          <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <div className="col-span-4">Cliente</div>
            <button className="col-span-2 flex items-center gap-1 hover:text-slate-700 transition-colors" onClick={() => toggleSort('totalOrders')}>
              Pedidos {sortKey === 'totalOrders' ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
            </button>
            <button className="col-span-2 flex items-center gap-1 hover:text-slate-700 transition-colors" onClick={() => toggleSort('totalSpent')}>
              Total gasto {sortKey === 'totalSpent' ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
            </button>
            <button className="col-span-2 flex items-center gap-1 hover:text-slate-700 transition-colors" onClick={() => toggleSort('lastOrderAt')}>
              Ultimo pedido {sortKey === 'lastOrderAt' ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />) : null}
            </button>
            <div className="col-span-2">Segmento</div>
          </div>

          <div className="divide-y divide-slate-100">
            {filtered.map(c => (
              <div key={c.phone}>
                <button
                  className="w-full grid grid-cols-12 gap-2 px-4 py-3 hover:bg-slate-50 transition-colors text-left"
                  onClick={() => setExpanded(e => e === c.phone ? null : c.phone)}
                >
                  <div className="col-span-4 flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                      <span className="text-white text-xs font-bold">{c.name.slice(0, 1).toUpperCase()}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 text-sm truncate">{c.name}</p>
                      <p className="text-xs text-slate-400 font-mono">{c.phone}</p>
                    </div>
                  </div>
                  <div className="col-span-2 flex items-center text-sm font-bold text-slate-700">{c.totalOrders}</div>
                  <div className="col-span-2 flex items-center text-sm font-bold text-emerald-600">R$ {fmt(c.totalSpent)}</div>
                  <div className="col-span-2 flex items-center text-xs text-slate-500">{daysSince(c.lastOrderAt)}d atras</div>
                  <div className="col-span-2 flex items-center">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${SEG_COLOR[c.segment]}`}>
                      {c.segment === 'loyal' ? 'Fiel' : c.segment === 'active' ? 'Ativo' : c.segment === 'at_risk' ? 'Em risco' : 'Inativo'}
                    </span>
                  </div>
                </button>

                {/* Expanded actions */}
                {expanded === c.phone && (
                  <div className="px-4 pb-3 pt-1 bg-slate-50 border-t border-slate-100 flex flex-wrap gap-2">
                    <button
                      onClick={() => openWhatsApp(c.phone, c.name)}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-green-500 text-white text-xs font-bold hover:bg-green-600 transition-colors"
                    >
                      <MessageCircle className="w-3.5 h-3.5" /> Enviar WhatsApp
                    </button>
                    <a
                      href={`tel:${c.phone}`}
                      className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-white transition-colors"
                    >
                      <Phone className="w-3.5 h-3.5" /> Ligar
                    </a>
                    <div className="ml-auto flex items-center gap-3 text-xs text-slate-400">
                      {c.segment === 'loyal' && <span className="flex items-center gap-1"><Star className="w-3 h-3 text-violet-500" /> Cliente fiel — {c.totalOrders} pedidos</span>}
                      {c.segment === 'active' && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> Cliente ativo</span>}
                      {c.segment === 'at_risk' && <span className="flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-500" /> Sem pedir ha {daysSince(c.lastOrderAt)} dias</span>}
                      {c.segment === 'inactive' && <span className="flex items-center gap-1"><XCircle className="w-3 h-3 text-slate-400" /> Inativo ha {daysSince(c.lastOrderAt)} dias</span>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="card p-4 bg-blue-50/50 border-blue-100">
        <p className="text-xs font-bold text-blue-800 mb-2">Segmentacao automatica</p>
        <div className="grid sm:grid-cols-2 gap-1.5 text-xs text-blue-700">
          <span><strong>Fiel:</strong> 5+ pedidos e pediu nos ultimos 30 dias</span>
          <span><strong>Ativo:</strong> 2+ pedidos e pediu nos ultimos 60 dias</span>
          <span><strong>Em risco:</strong> Sem pedir entre 60-120 dias</span>
          <span><strong>Inativo:</strong> Sem pedir ha mais de 120 dias</span>
        </div>
      </div>
    </div>
  );
}

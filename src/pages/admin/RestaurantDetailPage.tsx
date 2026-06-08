import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/db';
import {
  ArrowLeft, Store, ShoppingBag, DollarSign, Phone, MapPin,
  FileText, Plus, Trash2, ToggleLeftLeft, RefreshCw, Mail, AlertTriangle, Clock,
} from 'lucide-react';

type Detail = Awaited<ReturnType<typeof db.getRestaurantDetailAdmin>>;
type Order = { id: string; status: string; total: number; customerName: string; deliveryType: string; paymentMethod: string; createdAt: string };
type Note = { id: string; note: string; createdBy: string; createdAt: string };

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  PENDING:    { label: 'Pendente',   cls: 'bg-amber-50 text-amber-700' },
  PAID:       { label: 'Pago',       cls: 'bg-blue-50 text-blue-700' },
  PREPARING:  { label: 'Preparando', cls: 'bg-violet-50 text-violet-700' },
  DELIVERING: { label: 'Entregando', cls: 'bg-orange-50 text-orange-700' },
  COMPLETED:  { label: 'Concluído',  cls: 'bg-emerald-50 text-emerald-700' },
  CANCELLED:  { label: 'Cancelado',  cls: 'bg-red-50 text-red-700' },
};

const FEATURE_FLAGS = [
  { key: 'loyalty',    label: 'Programa de fidelidade' },
  { key: 'coupons',    label: 'Cupons de desconto' },
  { key: 'scheduling', label: 'Agendamento de pedidos' },
  { key: 'reviews',    label: 'Avaliações de clientes' },
  { key: 'whatsapp',   label: 'WhatsApp notifications' },
  { key: 'delivery',   label: 'Entrega (delivery)' },
];

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ago = (d: string) => {
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora'; if (h < 24) return `${h}h atrás`; return `${Math.floor(h / 24)}d atrás`;
};

export default function RestaurantDetailPage() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [flags, setFlags] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [tab, setTab] = useState<'overview' | 'orders' | 'flags' | 'notes'>('overview');

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const [d, o, n, f] = await Promise.all([
        db.getRestaurantDetailAdmin(userId).catch(() => null),
        db.getRestaurantOrdersAdmin(userId).catch(() => []),
        db.getRestaurantNotes(userId).catch(() => []),
        db.getFeatureFlags(userId).catch(() => ({})),
      ]);
      setDetail(d); setOrders(o); setNotes(n); setFlags(f);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const handleAddNote = async () => {
    if (!userId || !newNote.trim()) return;
    setAddingNote(true);
    try {
      await db.addRestaurantNote(userId, newNote.trim());
      setNewNote('');
      const n = await db.getRestaurantNotes(userId);
      setNotes(n);
    } finally {
      setAddingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    if (!userId) return;
    await db.deleteRestaurantNote(noteId);
    setNotes(prev => prev.filter(n => n.id !== noteId));
  };

  const handleToggleLeftFlag = async (flagKey: string) => {
    if (!userId) return;
    const newVal = !flags[flagKey];
    setFlags(prev => ({ ...prev, [flagKey]: newVal }));
    await db.setFeatureFlag(userId, flagKey, newVal).catch(() => {
      setFlags(prev => ({ ...prev, [flagKey]: !newVal }));
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="text-center py-20">
        <Store className="w-10 h-10 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-400">Restaurante não encontrado</p>
        <button onClick={() => navigate('/admin/restaurantes')} className="btn-secondary mt-4">
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
      </div>
    );
  }

  const planBadge = detail.planStatus === 'trial' ? 'bg-blue-50 text-blue-700'
    : detail.planStatus === 'active' ? 'bg-emerald-50 text-emerald-700'
    : detail.planStatus === 'blocked' ? 'bg-red-50 text-red-700'
    : 'bg-slate-100 text-slate-500';

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/restaurantes')} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-xl font-bold text-slate-900 truncate">{detail.restaurantName}</h1>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${planBadge}`}>
              {detail.planName} · {detail.planStatus}
            </span>
            {detail.blocked && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Bloqueado</span>
            )}
          </div>
          <p className="text-slate-400 text-sm truncate">/{detail.slug}</p>
        </div>
        <button onClick={load} className="btn-secondary flex-shrink-0">
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: ShoppingBag, label: 'Pedidos', value: detail.orderCount.toString(), color: 'bg-violet-100 text-violet-600' },
          { icon: DollarSign, label: 'Receita total', value: R(detail.totalRevenue), color: 'bg-emerald-100 text-emerald-600' },
          { icon: Clock, label: 'Último pedido', value: detail.lastOrderAt ? ago(detail.lastOrderAt) : '—', color: 'bg-blue-100 text-blue-600' },
        ].map((s, i) => (
          <div key={i} className="card p-4">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${s.color}`}>
              <s.icon className="w-4 h-4" />
            </div>
            <div className="text-lg font-black text-slate-900 leading-none mb-0.5">{s.value}</div>
            <div className="text-xs text-slate-400">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit overflow-x-auto">
        {([['overview', 'Visão geral'], ['orders', 'Pedidos'], ['flags', 'Feature flags'], ['notes', 'Notas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
              tab === key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
            {key === 'notes' && notes.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded-full text-[10px] font-bold">{notes.length}</span>
            )}
          </button>
        ))}
      </div>

      {/* ---- OVERVIEW ---- */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Informações</p>
            {detail.phone && (
              <div className="flex items-center gap-3 text-sm">
                <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <a href={`tel:${detail.phone}`} className="text-slate-700 hover:text-violet-600">{detail.phone}</a>
              </div>
            )}
            {detail.address && (
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700">{detail.address}</span>
              </div>
            )}
            {detail.description && (
              <div className="flex items-start gap-3 text-sm">
                <FileText className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                <span className="text-slate-600">{detail.description}</span>
              </div>
            )}
          </div>

          <div className="card p-5 space-y-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">Plano e cobrança</p>
            <div className="grid grid-cols-2 gap-y-2 text-sm">
              <span className="text-slate-400">Plano</span>
              <span className="font-semibold text-slate-800 text-right">{detail.planName} · {R(detail.planPrice)}/mês</span>
              <span className="text-slate-400">Status</span>
              <span className={`font-semibold text-right capitalize ${detail.planStatus === 'active' ? 'text-emerald-600' : detail.planStatus === 'trial' ? 'text-blue-600' : 'text-red-600'}`}>{detail.planStatus}</span>
              {detail.trialEndsAt && (
                <>
                  <span className="text-slate-400">Trial expira</span>
                  <span className="font-semibold text-slate-800 text-right">{new Date(detail.trialEndsAt).toLocaleDateString('pt-BR')}</span>
                </>
              )}
              <span className="text-slate-400">Pagamento</span>
              <span className={`font-semibold text-right ${detail.paymentStatus === 'active' ? 'text-emerald-600' : detail.paymentStatus === 'past_due' ? 'text-red-600' : 'text-slate-400'}`}>
                {detail.paymentStatus === 'active' ? 'Em dia' : detail.paymentStatus === 'past_due' ? 'Atrasado' : 'Não configurado'}
              </span>
              {detail.stripeSubscriptionId && (
                <>
                  <span className="text-slate-400">Stripe ID</span>
                  <span className="font-mono text-xs text-slate-500 text-right truncate">{detail.stripeSubscriptionId}</span>
                </>
              )}
            </div>
          </div>

          {detail.blocked && (
            <div className="card p-4 bg-red-50 border border-red-200">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-800">Restaurante bloqueado</p>
                  {detail.blockedReason && <p className="text-xs text-red-600 mt-0.5">{detail.blockedReason}</p>}
                </div>
              </div>
            </div>
          )}

          <a
            href={`mailto:?subject=ZapMenu - ${detail.restaurantName}&body=Olá! Entrando em contato sobre sua conta ZapMenu.`}
            className="card p-4 flex items-center gap-3 hover:bg-slate-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Mail className="w-4.5 h-4.5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Enviar e-mail</p>
              <p className="text-xs text-slate-400">Abre seu cliente de e-mail com o assunto preenchido</p>
            </div>
          </a>
        </div>
      )}

      {/* ---- PEDIDOS ---- */}
      {tab === 'orders' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Últimos 30 pedidos</h3>
          </div>
          {orders.length === 0 ? (
            <div className="p-8 text-center">
              <ShoppingBag className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhum pedido ainda</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {orders.map(o => {
                const s = STATUS_LABELS[o.status] ?? { label: o.status, cls: 'bg-slate-100 text-slate-500' };
                return (
                  <div key={o.id} className="px-5 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{o.customerName}</p>
                      <p className="text-xs text-slate-400">{ago(o.createdAt)} · {o.deliveryType === 'delivery' ? 'Delivery' : o.deliveryType === 'pickup' ? 'Retirada' : 'Mesa'}</p>
                    </div>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${s.cls}`}>{s.label}</span>
                    <span className="text-sm font-bold text-slate-900 flex-shrink-0">{R(o.total)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ---- FEATURE FLAGS ---- */}
      {tab === 'flags' && (
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="font-bold text-slate-900 text-sm">Feature flags</h3>
            <p className="text-xs text-slate-400 mt-0.5">Ative ou desative features para este restaurante</p>
          </div>
          <div className="divide-y divide-slate-50">
            {FEATURE_FLAGS.map(f => {
              const enabled = flags[f.key] ?? true;
              return (
                <div key={f.key} className="px-5 py-3.5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <ToggleLeft className={`w-4 h-4 ${enabled ? 'text-violet-500' : 'text-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-700">{f.label}</span>
                  </div>
                  <button
                    onClick={() => handleToggleLeftFlag(f.key)}
                    className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-violet-500' : 'bg-slate-200'}`}
                  >
                    <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${enabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---- NOTAS ---- */}
      {tab === 'notes' && (
        <div className="space-y-4">
          <div className="card p-4">
            <textarea
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
              placeholder="Adicionar nota interna sobre este restaurante..."
              rows={3}
              className="w-full text-sm resize-none border-0 outline-none text-slate-700 placeholder:text-slate-300"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleAddNote}
                disabled={addingNote || !newNote.trim()}
                className="btn-primary text-xs px-3 py-1.5"
              >
                <Plus className="w-3.5 h-3.5" />
                {addingNote ? 'Salvando...' : 'Adicionar nota'}
              </button>
            </div>
          </div>

          {notes.length === 0 ? (
            <div className="card p-8 text-center">
              <FileText className="w-8 h-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">Nenhuma nota ainda</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-slate-700 flex-1">{n.note}</p>
                    <button
                      onClick={() => handleDeleteNote(n.id)}
                      className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">
                    {n.createdBy} · {new Date(n.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db } from '../../lib/db';
import {
  ArrowLeft, Store, ShoppingBag, DollarSign, Phone, MapPin,
  FileText, Plus, Trash2, Settings, RefreshCw, Mail, AlertTriangle, Clock,
  CheckCircle, XCircle, Wallet, Printer, X, Power, Edit3,
} from 'lucide-react';
import { maskPhone } from '../../lib/masks';

type Detail = Awaited<ReturnType<typeof db.getRestaurantDetailAdmin>>;
type Order = { id: string; status: string; total: number; customerName: string; deliveryType: string; paymentMethod: string; createdAt: string };
type Note = { id: string; note: string; createdBy: string; createdAt: string };
type Payment = { id: string; amount: number; method: string; status: string; reference: string | null; notes: string | null; paidAt: string | null; dueAt: string | null; createdAt: string; createdBy: string | null };

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
  const [tab, setTab] = useState<'overview' | 'orders' | 'flags' | 'notes' | 'payments' | 'edit'>('overview');
  const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', description: '' });
  const [editLoading, setEditLoading] = useState(false);
  const [editError, setEditError] = useState('');
  const [disableLoading, setDisableLoading] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loadingPayments, setLoadingPayments] = useState(false);
  const [paymentsError, setPaymentsError] = useState('');
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordForm, setRecordForm] = useState({ amount: '', method: 'pix', notes: '', reference: '' });
  const [recordingPayment, setRecordingPayment] = useState(false);
  const [recordError, setRecordError] = useState('');
  const [receiptPayment, setReceiptPayment] = useState<Payment | null>(null);

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
      if (d) setEditForm({ name: d.restaurantName, phone: d.phone ?? '', address: d.address ?? '', description: d.description ?? '' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const loadPayments = async () => {
    if (!userId) return;
    setLoadingPayments(true);
    setPaymentsError('');
    try {
      const data = await db.getRestaurantPaymentHistory(userId);
      setPayments(data as Payment[]);
    } catch (e: any) {
      console.error('getRestaurantPaymentHistory error:', e);
      setPaymentsError(e?.message ?? 'Erro ao carregar pagamentos');
    } finally {
      setLoadingPayments(false);
    }
  };

  useEffect(() => { if (tab === 'payments') loadPayments(); }, [tab]);

  const handleRecordPayment = async () => {
    if (!userId || !recordForm.amount) return;
    setRecordingPayment(true);
    setRecordError('');
    try {
      await db.recordPayment(
        userId,
        Number(recordForm.amount),
        recordForm.method,
        recordForm.notes || undefined,
        recordForm.reference || undefined,
      );
      setShowRecordModal(false);
      setRecordForm({ amount: '', method: 'pix', notes: '', reference: '' });
      await loadPayments();
    } catch (e: any) {
      console.error('record_payment error:', e);
      setRecordError(e?.message ?? 'Erro ao registrar pagamento. Verifique se o SQL foi executado no Supabase.');
    } finally {
      setRecordingPayment(false);
    }
  };

  const printReceipt = (p: Payment) => {
    if (!detail) return;
    const fmt = (d: string) => new Date(d).toLocaleDateString('pt-BR');
    const w = window.open('', '_blank', 'width=440,height=660');
    if (!w) return;
    w.document.write(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante - ZapMenu</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 32px 28px; color: #1e293b; }
    .center { text-align: center; }
    .logo { width: 52px; height: 52px; background: #10b981; border-radius: 14px; display: flex; align-items: center; justify-content: center; margin: 0 auto 10px; }
    .logo span { color: #fff; font-weight: 900; font-size: 22px; }
    h1 { font-size: 18px; font-weight: 900; margin-bottom: 2px; }
    .sub { font-size: 12px; color: #94a3b8; }
    .divider { border: none; border-top: 2px dashed #e2e8f0; margin: 16px 0; }
    .row { display: flex; justify-content: space-between; align-items: center; padding: 5px 0; font-size: 14px; }
    .lbl { color: #94a3b8; }
    .val { font-weight: 600; text-align: right; max-width: 60%; }
    .amount { color: #059669; font-weight: 900; font-size: 20px; }
    .paid { color: #059669; font-weight: 700; }
    .notes-box { background: #f8fafc; border-radius: 8px; padding: 10px; margin-top: 8px; font-size: 12px; color: #64748b; font-style: italic; }
    .footer { text-align: center; font-size: 10px; color: #cbd5e1; margin-top: 4px; }
    @media print { body { padding: 16px; } }
  </style>
</head>
<body>
  <div class="center" style="padding-bottom:16px;border-bottom:2px dashed #e2e8f0;margin-bottom:16px;">
    <div class="logo"><span>Z</span></div>
    <h1>ZapMenu</h1>
    <p class="sub">Comprovante de Pagamento</p>
  </div>
  <div class="row"><span class="lbl">Restaurante</span><span class="val">${detail.restaurantName}</span></div>
  <div class="row"><span class="lbl">Valor</span><span class="amount">${R(p.amount)}</span></div>
  <div class="row"><span class="lbl">Método</span><span class="val">${p.method.toUpperCase()}</span></div>
  <div class="row"><span class="lbl">Status</span><span class="paid">${p.status === 'paid' ? '✓ Pago' : p.status === 'overdue' ? 'Vencido' : 'Pendente'}</span></div>
  ${p.paidAt ? `<div class="row"><span class="lbl">Data do pagamento</span><span class="val">${fmt(p.paidAt)}</span></div>` : ''}
  ${p.reference ? `<div class="row"><span class="lbl">Referência</span><span class="val">${p.reference}</span></div>` : ''}
  ${p.notes ? `<hr class="divider"><div class="notes-box"><strong>Obs:</strong> ${p.notes}</div>` : ''}
  <hr class="divider">
  <p class="footer">Emitido em ${new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ZapMenu</p>
  <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };<\/script>
</body>
</html>`);
    w.document.close();
  };

  const handleDeletePayment = async (paymentId: string) => {
    if (!confirm('Excluir este pagamento do histórico?')) return;
    try {
      await db.deletePayment(paymentId);
      setPayments(prev => prev.filter(p => p.id !== paymentId));
    } catch (e: any) {
      alert(e?.message ?? 'Erro ao excluir pagamento');
    }
  };

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

  const handleSaveEdit = async () => {
    if (!userId || !editForm.name.trim()) { setEditError('Nome é obrigatório'); return; }
    setEditLoading(true); setEditError('');
    try {
      await db.updateRestaurantSettingsAdmin(userId, editForm);
      await load();
      setTab('overview');
    } catch (e: any) { setEditError(e?.message ?? 'Erro ao salvar'); }
    finally { setEditLoading(false); }
  };

  const handleToggleDisabled = async (disabled: boolean) => {
    if (!userId) return;
    setDisableLoading(true);
    try { await db.toggleRestaurantDisabled(userId, disabled); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setDisableLoading(false); }
  };

  const handleSettingsFlag = async (flagKey: string) => {
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
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700">🚫 Bloqueado</span>
            )}
            {detail.disabled && (
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-600">⛔ Desativado</span>
            )}
          </div>
          <p className="text-slate-400 text-sm truncate">/{detail.slug}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={() => handleToggleDisabled(!detail.disabled)}
            disabled={disableLoading}
            title={detail.disabled ? 'Reativar restaurante' : 'Desativar restaurante'}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold transition-colors disabled:opacity-50 ${
              detail.disabled
                ? 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            <Power className="w-3.5 h-3.5" />
            {detail.disabled ? 'Reativar' : 'Desativar'}
          </button>
          <button onClick={() => setTab('edit')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold bg-violet-50 text-violet-600 hover:bg-violet-100 transition-colors">
            <Edit3 className="w-3.5 h-3.5" /> Editar dados
          </button>
          <button onClick={load} className="btn-secondary flex-shrink-0">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
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
        {([['overview', 'Visão geral'], ['edit', 'Editar dados'], ['orders', 'Pedidos'], ['payments', 'Pagamentos'], ['flags', 'Feature flags'], ['notes', 'Notas']] as const).map(([key, label]) => (
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

          {detail.disabled && (
            <div className="card p-4 bg-slate-100 border border-slate-300">
              <div className="flex items-start gap-3">
                <Power className="w-5 h-5 text-slate-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-bold text-slate-800">Restaurante desativado</p>
                  {detail.disabledReason && <p className="text-xs text-slate-600 mt-0.5">{detail.disabledReason}</p>}
                </div>
                <button
                  onClick={() => handleToggleDisabled(false)}
                  disabled={disableLoading}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 disabled:opacity-50"
                >
                  Reativar
                </button>
              </div>
            </div>
          )}

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

      {/* ---- EDITAR DADOS ---- */}
      {tab === 'edit' && (
        <div className="card p-6 space-y-5">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Editar dados do restaurante</p>
          <p className="text-xs text-slate-500 -mt-2">As alterações são refletidas imediatamente no painel do dono.</p>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Nome do restaurante</label>
              <input
                type="text"
                value={editForm.name}
                onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                className="input w-full"
                placeholder="Nome do restaurante"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Telefone / WhatsApp</label>
              <input
                type="tel"
                value={editForm.phone}
                onChange={e => setEditForm(f => ({ ...f, phone: maskPhone(e.target.value) }))}
                className="input w-full"
                placeholder="(11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Endereço</label>
              <input
                type="text"
                value={editForm.address}
                onChange={e => setEditForm(f => ({ ...f, address: e.target.value }))}
                className="input w-full"
                placeholder="Rua, número, bairro, cidade"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Descrição</label>
              <textarea
                value={editForm.description}
                onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                rows={3}
                className="input w-full resize-none"
                placeholder="Breve descrição do restaurante"
              />
            </div>
          </div>

          {editError && <p className="text-sm text-red-600 font-medium">{editError}</p>}

          <div className="flex gap-2 pt-1">
            <button onClick={() => { setTab('overview'); setEditError(''); }} className="flex-1 btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleSaveEdit}
              disabled={editLoading}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
            >
              {editLoading
                ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                : <><CheckCircle className="w-4 h-4" /> Salvar alterações</>
              }
            </button>
          </div>
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
                    <Settings className={`w-4 h-4 ${enabled ? 'text-violet-500' : 'text-slate-300'}`} />
                    <span className="text-sm font-medium text-slate-700">{f.label}</span>
                  </div>
                  <button
                    onClick={() => handleSettingsFlag(f.key)}
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

      {/* ---- PAGAMENTOS ---- */}
      {tab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">Histórico de pagamentos</h3>
              <p className="text-xs text-slate-400 mt-0.5">Pagamentos manuais registrados pelo admin</p>
            </div>
            <div className="flex gap-2">
              <button onClick={loadPayments} className="btn-secondary" disabled={loadingPayments}>
                <RefreshCw className={`w-4 h-4 ${loadingPayments ? 'animate-spin' : ''}`} />
              </button>
              <button onClick={() => setShowRecordModal(true)} className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" /> Registrar pagamento
              </button>
            </div>
          </div>

          {paymentsError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
              Erro: {paymentsError}
            </div>
          )}

          <div className="card overflow-hidden">
            {loadingPayments ? (
              <div className="p-10 flex items-center justify-center">
                <div className="w-7 h-7 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
              </div>
            ) : payments.length === 0 ? (
              <div className="p-8 text-center">
                <Wallet className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-slate-400 text-sm">Nenhum pagamento registrado</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-50">
                {payments.map(p => {
                  const isPaid = p.status === 'paid';
                  const isOverdue = p.status === 'overdue';
                  return (
                    <div key={p.id} className="px-5 py-3.5 flex items-center gap-3">
                      <div className="flex-shrink-0">
                        {isPaid
                          ? <CheckCircle className="w-5 h-5 text-emerald-500" />
                          : isOverdue
                          ? <XCircle className="w-5 h-5 text-red-400" />
                          : <Clock className="w-5 h-5 text-amber-400" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-slate-900">{R(p.amount)}</span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isPaid ? 'bg-emerald-50 text-emerald-700' : isOverdue ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'
                          }`}>
                            {isPaid ? 'Pago' : isOverdue ? 'Vencido' : 'Pendente'}
                          </span>
                          <span className="text-[10px] text-slate-400 capitalize">{p.method.toUpperCase()}</span>
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {p.paidAt
                            ? `Pago em ${new Date(p.paidAt).toLocaleDateString('pt-BR')}`
                            : p.dueAt
                            ? `Vence ${new Date(p.dueAt).toLocaleDateString('pt-BR')}`
                            : `Registrado ${new Date(p.createdAt).toLocaleDateString('pt-BR')}`}
                          {p.reference && ` · Ref: ${p.reference}`}
                        </p>
                        {p.notes && <p className="text-xs text-slate-500 mt-0.5 italic">{p.notes}</p>}
                      </div>
                      {p.createdBy && (
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            onClick={() => { setReceiptPayment(p); }}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-300 hover:text-blue-500 transition-colors"
                            title="Ver / imprimir comprovante"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeletePayment(p.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Modal: Registrar pagamento */}
          {showRecordModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowRecordModal(false)} />
              <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 p-6">
                <h3 className="text-base font-black text-slate-900 mb-4">Registrar pagamento</h3>
                <div className="space-y-3">
                  <div>
                    <label className="label">Valor (R$)</label>
                    <input
                      type="number"
                      value={recordForm.amount}
                      onChange={e => setRecordForm(f => ({ ...f, amount: e.target.value }))}
                      className="input"
                      placeholder="89.00"
                    />
                  </div>
                  <div>
                    <label className="label">Forma de pagamento</label>
                    <select
                      value={recordForm.method}
                      onChange={e => setRecordForm(f => ({ ...f, method: e.target.value }))}
                      className="input"
                    >
                      <option value="pix">PIX</option>
                      <option value="card">Cartão</option>
                      <option value="boleto">Boleto</option>
                      <option value="manual">Outro (manual)</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Referência (mês, número do pedido…)</label>
                    <input
                      value={recordForm.reference}
                      onChange={e => setRecordForm(f => ({ ...f, reference: e.target.value }))}
                      className="input"
                      placeholder="2026-06"
                    />
                  </div>
                  <div>
                    <label className="label">Observações (opcional)</label>
                    <textarea
                      value={recordForm.notes}
                      onChange={e => setRecordForm(f => ({ ...f, notes: e.target.value }))}
                      rows={2}
                      className="input resize-none"
                      placeholder="Comprovante recebido via WhatsApp"
                    />
                  </div>
                </div>
                {recordError && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700">
                    {recordError}
                  </div>
                )}
                <div className="flex gap-2 mt-4">
                  <button onClick={() => { setShowRecordModal(false); setRecordError(''); }} className="btn-secondary flex-1">Cancelar</button>
                  <button
                    onClick={handleRecordPayment}
                    disabled={recordingPayment || !recordForm.amount}
                    className="btn-primary flex-1"
                  >
                    {recordingPayment ? 'Registrando...' : 'Confirmar pago'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Modal: Comprovante */}
          {receiptPayment && detail && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm print:hidden" onClick={() => setReceiptPayment(null)} />
              <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-sm z-10 overflow-hidden">
                {/* Ações — ocultas na impressão */}
                <div className="flex items-center justify-between px-5 pt-4 pb-2 print:hidden">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Comprovante</span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => receiptPayment && printReceipt(receiptPayment)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" /> Imprimir
                    </button>
                    <button onClick={() => setReceiptPayment(null)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Conteúdo do comprovante */}
                <div id="receipt-content" className="px-6 pb-6 pt-2">
                  <div className="text-center border-b border-dashed border-slate-200 pb-4 mb-4">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-500 flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-black text-lg">Z</span>
                    </div>
                    <p className="font-black text-slate-900 text-lg">ZapMenu</p>
                    <p className="text-xs text-slate-400">Comprovante de Pagamento</p>
                  </div>

                  <div className="space-y-2.5 text-sm mb-4">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Restaurante</span>
                      <span className="font-semibold text-slate-800 text-right max-w-[55%] truncate">{detail.restaurantName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Valor</span>
                      <span className="font-black text-emerald-600 text-base">{R(receiptPayment.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Método</span>
                      <span className="font-semibold text-slate-800 capitalize">{receiptPayment.method.toUpperCase()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Status</span>
                      <span className={`font-bold ${receiptPayment.status === 'paid' ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {receiptPayment.status === 'paid' ? '✓ Pago' : receiptPayment.status === 'overdue' ? 'Vencido' : 'Pendente'}
                      </span>
                    </div>
                    {receiptPayment.paidAt && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Data do pagamento</span>
                        <span className="font-semibold text-slate-800">
                          {new Date(receiptPayment.paidAt).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                    {receiptPayment.reference && (
                      <div className="flex justify-between">
                        <span className="text-slate-400">Referência</span>
                        <span className="font-semibold text-slate-800">{receiptPayment.reference}</span>
                      </div>
                    )}
                    {receiptPayment.notes && (
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-slate-400 block mb-1 text-xs">Observações</span>
                        <p className="text-slate-700 text-xs italic">{receiptPayment.notes}</p>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-dashed border-slate-200 pt-3 text-center">
                    <p className="text-[10px] text-slate-300">
                      Emitido em {new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })} · ZapMenu
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
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

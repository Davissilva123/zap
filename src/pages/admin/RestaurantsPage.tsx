import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../lib/db';
import { useAdminRole } from '../../lib/adminContext';
import type { RestaurantSettings } from '../../lib/types';
import {
  Store, RefreshCw, ExternalLink, Copy, Check, Search,
  ShoppingBag, DollarSign, Clock, ChevronDown, AlertTriangle,
  Ban, Unlock, Download, Mail, X, History, Eye, CreditCard, Power, EyeOff,
} from 'lucide-react';

const SUPER_ADMIN_EMAIL = (import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com').toLowerCase();

type Stat = { userId: string; orderCount: number; totalRevenue: number; lastOrderAt: string | null };
type Plan = {
  userId: string; planSlug: string; planName: string; planPrice: number;
  status: string; trialStartsAt: string | null; trialEndsAt: string | null;
  blockedReason: string | null; expiresAt: string | null; paymentStatus?: string;
};
type Email = { userId: string; email: string };
type Log = { id: string; userId: string; oldPlanSlug: string | null; newPlanSlug: string; oldStatus: string | null; newStatus: string; notes: string | null; changedAt: string; changedByEmail: string | null };

const R = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const ago = (d: string | null) => {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'agora'; if (h < 24) return `${h}h`; return `${Math.floor(h / 24)}d`;
};
const trialDaysLeft = (endsAt: string | null) => {
  if (!endsAt) return null;
  const diff = new Date(endsAt).getTime() - Date.now();
  return Math.ceil(diff / 86400000);
};

const PLAN_OPTIONS = [
  { slug: 'basic', label: 'Básico' },
  { slug: 'pro', label: 'Pro' },
  { slug: 'premium', label: 'Premium' },
];

const statusBadge = (plan: Plan | undefined) => {
  if (!plan) return <span className="badge bg-slate-100 text-slate-400 text-[10px]">Sem plano</span>;
  const { status, trialEndsAt } = plan;
  if (status === 'blocked') return <span className="badge bg-red-100 text-red-600 text-[10px] font-bold">🚫 Bloqueado</span>;
  if (status === 'trial') {
    const d = trialDaysLeft(trialEndsAt);
    const expired = d !== null && d <= 0;
    if (expired) return <span className="badge bg-red-50 text-red-500 text-[10px]">Trial expirado</span>;
    const color = d !== null && d <= 2 ? 'bg-red-50 text-red-500' : d !== null && d <= 5 ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600';
    return <span className={`badge ${color} text-[10px]`}>⏱ Trial · {d}d</span>;
  }
  if (status === 'active') return <span className="badge bg-emerald-50 text-emerald-600 text-[10px] font-bold">✅ Ativo</span>;
  if (status === 'cancelled') return <span className="badge bg-slate-100 text-slate-500 text-[10px]">Cancelado</span>;
  if (status === 'expired') return <span className="badge bg-red-50 text-red-400 text-[10px]">Expirado</span>;
  return <span className="badge bg-slate-100 text-slate-400 text-[10px]">{status}</span>;
};

const planColor = (slug: string) => {
  if (slug === 'premium') return 'bg-violet-100 text-violet-700';
  if (slug === 'pro') return 'bg-blue-100 text-blue-700';
  return 'bg-slate-100 text-slate-500';
};

export default function AdminRestaurantsPage() {
  const navigate = useNavigate();
  const adminRole = useAdminRole();
  const canBlock = adminRole !== 'limited';
  const [restaurants, setRestaurants] = useState<RestaurantSettings[]>([]);
  const [stats, setStats] = useState<Stat[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState<'orders' | 'revenue' | 'name' | 'trial'>('trial');
  const [changingPlan, setChangingPlan] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const [hideInactive, setHideInactive] = useState(false);

  // Block modal
  const [blockTarget, setBlockTarget] = useState<RestaurantSettings | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [blockLoading, setBlockLoading] = useState(false);

  // Disable modal
  const [disableTarget, setDisableTarget] = useState<RestaurantSettings | null>(null);
  const [disableLoading, setDisableLoading] = useState(false);

  // Log drawer
  const [logTarget, setLogTarget] = useState<string | null>(null);
  const [logData, setLogData] = useState<Log[]>([]);
  const [logLoading, setLogLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [r, s, p, e] = await Promise.all([
        db.getAllRestaurants(),
        db.getRestaurantStats().catch(() => []),
        db.getRestaurantPlans().catch(() => []),
        db.getOwnerEmails().catch(() => []),
      ]);
      // Exclude super admin from all views
      const superAdminUserId = e.find((em: { userId: string; email: string }) => em.email.toLowerCase() === SUPER_ADMIN_EMAIL)?.userId;
      const filteredR = superAdminUserId ? r.filter(x => x.userId !== superAdminUserId) : r;
      const filteredS = superAdminUserId ? s.filter((x: any) => x.userId !== superAdminUserId) : s;
      const filteredP = superAdminUserId ? p.filter((x: any) => x.userId !== superAdminUserId) : p;
      const filteredE = superAdminUserId ? e.filter((x: any) => x.userId !== superAdminUserId) : e;
      setRestaurants(filteredR); setStats(filteredS); setPlans(filteredP); setEmails(filteredE);
    } catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const getStat = (uid: string) => stats.find(s => s.userId === uid);
  const getPlan = (uid: string) => plans.find(p => p.userId === uid);
  const getEmail = (uid: string) => emails.find(e => e.userId === uid)?.email ?? '—';

  const handleSetPlan = async (userId: string, slug: string) => {
    setChangingPlan(userId);
    try { await db.setRestaurantPlan(userId, slug, 'active'); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setChangingPlan(null); }
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    setBlockLoading(true);
    try {
      await db.blockRestaurant(blockTarget.userId, blockReason);
      setBlockTarget(null); setBlockReason('');
      await load();
    } catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setBlockLoading(false); }
  };

  const handleUnblock = async (userId: string) => {
    try { await db.unblockRestaurant(userId); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
  };

  const handleDisable = async () => {
    if (!disableTarget) return;
    setDisableLoading(true);
    try { await db.toggleRestaurantDisabled(disableTarget.userId, true); setDisableTarget(null); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
    finally { setDisableLoading(false); }
  };

  const handleEnable = async (userId: string) => {
    try { await db.toggleRestaurantDisabled(userId, false); await load(); }
    catch (e: any) { alert('Erro: ' + (e?.message ?? e)); }
  };

  const openLog = async (userId: string) => {
    setLogTarget(userId); setLogLoading(true);
    try { const l = await db.getPlanChangeLog(userId); setLogData(l); }
    catch { setLogData([]); }
    finally { setLogLoading(false); }
  };

  const copyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/m/${slug}`);
    setCopied(slug); setTimeout(() => setCopied(null), 2000);
  };

  const exportCsv = () => {
    const rows = [
      ['Nome', 'Email', 'Slug', 'Plano', 'Status', 'Trial até', 'Pedidos', 'Receita', 'Último pedido', 'Bloqueado'],
      ...restaurants.map(r => {
        const p = getPlan(r.userId);
        const s = getStat(r.userId);
        const d = trialDaysLeft(p?.trialEndsAt ?? null);
        return [
          r.name,
          getEmail(r.userId),
          r.slug,
          p?.planName ?? 'Sem plano',
          p?.status ?? '—',
          p?.trialEndsAt ? new Date(p.trialEndsAt).toLocaleDateString('pt-BR') : '—',
          String(s?.orderCount ?? 0),
          String(s?.totalRevenue ?? 0),
          s?.lastOrderAt ? new Date(s.lastOrderAt).toLocaleDateString('pt-BR') : '—',
          r.blocked ? 'Sim' : 'Não',
        ];
      }),
    ];
    const csv = rows.map(row => row.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = `zapmenu-restaurantes-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  const filtered = restaurants
    .filter(r => {
      if (hideInactive && (r.disabled || r.blocked)) return false;
      const q = search.toLowerCase();
      const email = getEmail(r.userId).toLowerCase();
      const matchSearch = r.name.toLowerCase().includes(q) || r.slug.includes(q) || email.includes(q) || (r.phone ?? '').includes(q);
      const plan = getPlan(r.userId);
      const planSlug = plan?.planSlug ?? 'basic';
      const status = plan?.status ?? 'none';
      const matchPlan = filterPlan === 'all' || planSlug === filterPlan;
      const matchStatus = filterStatus === 'all' || status === filterStatus
        || (filterStatus === 'expiring' && status === 'trial' && (trialDaysLeft(plan?.trialEndsAt ?? null) ?? 99) <= 3)
        || (filterStatus === 'disabled' && r.disabled);
      return matchSearch && matchPlan && matchStatus;
    })
    .sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'revenue') return (getStat(b.userId)?.totalRevenue ?? 0) - (getStat(a.userId)?.totalRevenue ?? 0);
      if (sortBy === 'trial') {
        const da = trialDaysLeft(getPlan(a.userId)?.trialEndsAt ?? null) ?? 9999;
        const db2 = trialDaysLeft(getPlan(b.userId)?.trialEndsAt ?? null) ?? 9999;
        return da - db2;
      }
      return (getStat(b.userId)?.orderCount ?? 0) - (getStat(a.userId)?.orderCount ?? 0);
    });

  const blockedCount = restaurants.filter(r => r.blocked).length;
  const disabledCount = restaurants.filter(r => r.disabled).length;
  const expiringCount = plans.filter(p => p.status === 'trial' && (trialDaysLeft(p.trialEndsAt) ?? 99) <= 3 && (trialDaysLeft(p.trialEndsAt) ?? -1) >= 0).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Restaurantes</h1>
          <p className="text-slate-500 text-sm mt-0.5">{restaurants.length} clientes cadastrados</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setHideInactive(v => !v)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-xl border transition-colors ${
              hideInactive
                ? 'bg-slate-800 text-white border-slate-800'
                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
            }`}
          >
            <EyeOff className="w-3.5 h-3.5" />
            {hideInactive ? 'Mostrar inativos' : 'Ocultar inativos'}
          </button>
          <button onClick={exportCsv} className="btn-secondary text-xs">
            <Download className="w-3.5 h-3.5" /> Exportar CSV
          </button>
          <button onClick={load} disabled={loading} className="btn-secondary">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Quick stats bar */}
      {(blockedCount > 0 || disabledCount > 0 || expiringCount > 0) && (
        <div className="flex gap-2 flex-wrap">
          {disabledCount > 0 && (
            <button onClick={() => { setFilterStatus('disabled'); setHideInactive(false); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 border border-slate-300 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition-colors">
              <Power className="w-3.5 h-3.5" /> {disabledCount} desativado{disabledCount > 1 ? 's' : ''}
            </button>
          )}
          {blockedCount > 0 && (
            <button onClick={() => { setFilterStatus('blocked'); setHideInactive(false); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 border border-red-200 rounded-xl text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors">
              <Ban className="w-3.5 h-3.5" /> {blockedCount} bloqueado{blockedCount > 1 ? 's' : ''}
            </button>
          )}
          {expiringCount > 0 && (
            <button onClick={() => { setFilterStatus('expiring'); setSortBy('trial'); }} className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-600 hover:bg-amber-100 transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" /> {expiringCount} trial{expiringCount > 1 ? 's' : ''} expirando em 3 dias
            </button>
          )}
          {filterStatus !== 'all' && (
            <button onClick={() => setFilterStatus('all')} className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-medium text-slate-500 hover:bg-slate-200 transition-colors">
              <X className="w-3 h-3" /> Limpar filtro
            </button>
          )}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Nome, email, slug ou telefone…" className="input w-full pl-10" />
        </div>
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl">
          {[{ v: 'all', l: 'Todos' }, { v: 'basic', l: 'Básico' }, { v: 'pro', l: 'Pro' }, { v: 'premium', l: 'Premium' }].map(f => (
            <button key={f.v} onClick={() => setFilterPlan(f.v)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${filterPlan === f.v ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}>
              {f.l}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} className="input text-xs pr-8">
          <option value="trial">↑ Trial expirando</option>
          <option value="orders">↓ Pedidos</option>
          <option value="revenue">↓ Receita</option>
          <option value="name">A → Z</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="card p-14 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-900">{filtered.length} restaurante{filtered.length !== 1 ? 's' : ''}</span>
            <span className="text-xs text-slate-400">Clique no plano/status para alterar</span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Store className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Nenhum restaurante encontrado</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {filtered.map(r => {
                const stat = getStat(r.userId);
                const plan = getPlan(r.userId);
                const email = getEmail(r.userId);
                const planSlug = plan?.planSlug ?? 'basic';
                const isChanging = changingPlan === r.userId;
                const isBlocked = r.blocked || plan?.status === 'blocked';
                const isDisabled = r.disabled ?? false;
                const daysLeft = trialDaysLeft(plan?.trialEndsAt ?? null);

                return (
                  <div key={r.userId} className={`px-4 sm:px-5 py-4 hover:bg-slate-50/40 transition-colors ${isDisabled ? 'bg-slate-50/80 opacity-60' : isBlocked ? 'bg-red-50/30' : ''}`}>
                    <div className="flex items-start gap-3">
                      {/* Logo */}
                      {r.logoUrl ? (
                        <img src={r.logoUrl} alt={r.name} className="w-10 h-10 rounded-xl object-cover flex-shrink-0 mt-0.5" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Store className="w-5 h-5 text-slate-400" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        {/* Name + status */}
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-bold text-slate-900 text-sm">{r.name}</span>
                          {statusBadge(plan)}
                          {r.mercadoPagoToken && <span className="badge bg-blue-50 text-blue-600 text-[10px]">PIX</span>}
                          {r.whatsappEnabled && <span className="badge bg-green-50 text-green-600 text-[10px]">WhatsApp</span>}
                        </div>

                        {/* Email + slug */}
                        <div className="flex items-center gap-x-2 gap-y-1 flex-wrap mb-2">
                          {email !== '—' ? (
                            <a
                              href={`mailto:${email}?subject=ZapMenu - ${r.name}&body=Olá ${r.name},%0D%0A%0D%0AEntrando em contato sobre sua conta ZapMenu.`}
                              className="flex items-center gap-1 text-xs text-slate-500 hover:text-violet-600 transition-colors min-w-0"
                              title="Enviar email"
                            >
                              <Mail className="w-3 h-3 text-slate-400 flex-shrink-0" />
                              <span className="truncate">{email}</span>
                            </a>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-slate-400"><Mail className="w-3 h-3" /> —</span>
                          )}
                          <span className="text-xs text-slate-300 hidden sm:inline">·</span>
                          <span className="text-xs text-slate-400 font-mono hidden sm:inline">/m/{r.slug}</span>
                          {plan?.paymentStatus === 'past_due' && (
                            <span className="flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-100 text-orange-700">
                              <CreditCard className="w-2.5 h-2.5" /> Pagamento atrasado
                            </span>
                          )}
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-x-4 gap-y-1 text-xs text-slate-400 flex-wrap mb-3">
                          <span className="flex items-center gap-1"><ShoppingBag className="w-3 h-3" /> {stat?.orderCount ?? 0} pedidos</span>
                          <span className="flex items-center gap-1"><DollarSign className="w-3 h-3" /> {stat ? R(stat.totalRevenue) : 'R$ 0,00'}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {ago(stat?.lastOrderAt ?? null)}</span>
                          {plan?.status === 'trial' && daysLeft !== null && (
                            <span className={`font-semibold ${daysLeft <= 0 ? 'text-red-500' : daysLeft <= 3 ? 'text-amber-600' : 'text-blue-600'}`}>
                              Trial: {daysLeft <= 0 ? 'EXPIRADO' : `${daysLeft}d restantes`}
                            </span>
                          )}
                          {isBlocked && plan?.blockedReason && (
                            <span className="text-red-400 italic truncate max-w-xs">"{plan.blockedReason}"</span>
                          )}
                        </div>

                        {/* Actions — inside the info column so never overflow over the logo */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {/* Plan selector */}
                          {!isBlocked && (
                            <div className="relative">
                              <select
                                value={planSlug}
                                onChange={e => handleSetPlan(r.userId, e.target.value)}
                                disabled={isChanging}
                                className={`appearance-none text-[11px] font-bold pl-2.5 pr-6 py-1.5 rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-violet-500/30 cursor-pointer disabled:opacity-50 ${planColor(planSlug)}`}
                              >
                                {PLAN_OPTIONS.map(o => (
                                  <option key={o.slug} value={o.slug}>{o.label}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 pointer-events-none opacity-60" />
                              {isChanging && (
                                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                                  <div className="w-3 h-3 border-2 border-slate-300 border-t-violet-500 rounded-full animate-spin" />
                                </div>
                              )}
                            </div>
                          )}

                          <div className="w-px h-5 bg-slate-200" />

                          {/* Disable / Enable */}
                          {canBlock && (isDisabled ? (
                            <button onClick={() => handleEnable(r.userId)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-semibold transition-colors" title="Reativar restaurante">
                              <Power className="w-3.5 h-3.5" /> Reativar
                            </button>
                          ) : (
                            <button onClick={() => setDisableTarget(r)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Desativar restaurante">
                              <Power className="w-4 h-4 text-slate-400" />
                            </button>
                          ))}

                          {/* Block / Unblock */}
                          {canBlock && !isDisabled && (isBlocked ? (
                            <button onClick={() => handleUnblock(r.userId)} className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-semibold transition-colors" title="Desbloquear">
                              <Unlock className="w-3.5 h-3.5" /> Desbloquear
                            </button>
                          ) : (
                            <button onClick={() => { setBlockTarget(r); setBlockReason(''); }} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors" title="Bloquear restaurante">
                              <Ban className="w-4 h-4 text-red-400" />
                            </button>
                          ))}

                          <button onClick={() => navigate(`/admin/restaurantes/${r.userId}`)} className="p-1.5 rounded-lg hover:bg-violet-50 transition-colors" title="Ver detalhes">
                            <Eye className="w-4 h-4 text-violet-400" />
                          </button>

                          <button onClick={() => openLog(r.userId)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Histórico de planos">
                            <History className="w-4 h-4 text-slate-400" />
                          </button>

                          <button onClick={() => copyLink(r.slug)} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Copiar link do cardápio">
                            {copied === r.slug ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-slate-400" />}
                          </button>

                          <a href={`/m/${r.slug}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors" title="Abrir cardápio">
                            <ExternalLink className="w-4 h-4 text-slate-400" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Block modal */}
      {blockTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setBlockTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in p-6">
            <div className="w-12 h-12 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-4">
              <Ban className="w-6 h-6 text-red-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Bloquear restaurante</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              <strong>{blockTarget.name}</strong> ficará inacessível para os clientes.
            </p>
            <div className="mb-5">
              <label className="block text-sm font-semibold text-slate-700 mb-2">Motivo do bloqueio</label>
              <textarea
                value={blockReason}
                onChange={e => setBlockReason(e.target.value)}
                rows={3}
                placeholder="Ex: inadimplência, violação de termos…"
                className="input w-full resize-none"
                autoFocus
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setBlockTarget(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button
                onClick={handleBlock}
                disabled={blockLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {blockLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Ban className="w-4 h-4" /> Bloquear</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Disable modal */}
      {disableTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="fixed inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDisableTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm z-10 animate-scale-in p-6">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
              <Power className="w-6 h-6 text-slate-600" />
            </div>
            <h3 className="text-base font-bold text-slate-900 text-center mb-1">Desativar restaurante</h3>
            <p className="text-sm text-slate-500 text-center mb-5">
              <strong>{disableTarget.name}</strong> ficará inacessível para o dono e seus clientes. Você pode reativar a qualquer momento.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDisableTarget(null)} className="flex-1 btn-secondary">Cancelar</button>
              <button
                onClick={handleDisable}
                disabled={disableLoading}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold rounded-xl transition-colors text-sm"
              >
                {disableLoading
                  ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  : <><Power className="w-4 h-4" /> Desativar</>
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Plan change log drawer */}
      {logTarget && (
        <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm" onClick={() => setLogTarget(null)} />
          <div className="relative bg-white w-full max-w-md h-full shadow-2xl flex flex-col z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900 text-sm">Histórico de mudanças</h3>
              <button onClick={() => setLogTarget(null)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4">
              {logLoading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-4 border-slate-200 border-t-violet-500 rounded-full animate-spin" />
                </div>
              ) : logData.length === 0 ? (
                <div className="text-center py-12">
                  <History className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                  <p className="text-slate-400 text-sm">Nenhum histórico encontrado</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {logData.map(log => (
                    <div key={log.id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          {log.oldPlanSlug && (
                            <span className="text-xs text-slate-400">{log.oldPlanSlug}</span>
                          )}
                          {log.oldPlanSlug && <span className="text-slate-300 text-xs">→</span>}
                          <span className={`text-xs font-bold ${log.newStatus === 'blocked' ? 'text-red-600' : log.newStatus === 'active' ? 'text-emerald-600' : 'text-blue-600'}`}>
                            {log.newPlanSlug} · {log.newStatus}
                          </span>
                        </div>
                        <span className="text-[10px] text-slate-400 flex-shrink-0">
                          {new Date(log.changedAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      {log.notes && <p className="text-xs text-slate-500 italic">"{log.notes}"</p>}
                      {log.changedByEmail && <p className="text-[10px] text-slate-400 mt-1">por {log.changedByEmail}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

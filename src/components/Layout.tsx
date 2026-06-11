import { LayoutDashboard, UtensilsCrossed, Grid3X3, QrCode, Settings, LogOut, Receipt, Menu, Zap, BarChart2, Tag, LayoutGrid, Users, Star, ClipboardList, Bike, Lock, Store, UserCheck, Package, Wallet, Package2, Clock, Megaphone, TrendingDown, DollarSign, ScrollText, MonitorPlay, ShoppingBag, BookOpen, Truck, FileBarChart } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useState, useEffect } from 'react';
import { db } from '../lib/db';
import { supabase } from '../lib/supabase';
import { PlanContext } from '../lib/planContext';
import { canAccess, PLAN_DISPLAY, FEATURE_MIN_PLAN, type PlanSlug, type FeatureKey } from '../lib/planFeatures';

type NavItem = {
  to: string;
  icon: typeof LayoutDashboard;
  label: string;
  feature: FeatureKey;
};

const BASE_NAV: NavItem[] = [
  { to: '/dashboard',  icon: LayoutDashboard, label: 'Dashboard',      feature: 'dashboard'  },
  { to: '/menu',       icon: UtensilsCrossed, label: 'Cardápio',        feature: 'menu'       },
  { to: '/categories', icon: Grid3X3,         label: 'Categorias',      feature: 'categories' },
  { to: '/orders',     icon: Receipt,         label: 'Pedidos',         feature: 'orders'     },
  { to: '/reports',    icon: BarChart2,       label: 'Relatórios',      feature: 'reports'    },
  { to: '/coupons',    icon: Tag,             label: 'Cupons',          feature: 'coupons'    },
  { to: '/tables',     icon: LayoutGrid,      label: 'Mesas',           feature: 'tables'     },
  { to: '/reviews',    icon: Star,            label: 'Avaliações',      feature: 'reviews'    },
  { to: '/comandas',   icon: ClipboardList,   label: 'Comandas',        feature: 'comandas'   },
  { to: '/drivers',    icon: Bike,            label: 'Entregadores',    feature: 'drivers'    },
  { to: '/crm',         icon: UserCheck,       label: 'CRM',             feature: 'crm'        },
  { to: '/estoque',    icon: Package,         label: 'Estoque',         feature: 'stock'      },
  { to: '/caixa',      icon: Wallet,          label: 'Caixa',           feature: 'cashregister'},
  { to: '/combos',     icon: Package2,        label: 'Combos',          feature: 'combos'     },
  { to: '/promocoes',  icon: Clock,           label: 'Promoções',       feature: 'promotions' },
  { to: '/campanhas',  icon: Megaphone,       label: 'Campanhas',       feature: 'campaigns'  },
  { to: '/pdv',            icon: ShoppingBag,   label: 'PDV',             feature: 'pdv'            },
  { to: '/kds',            icon: MonitorPlay,   label: 'KDS Cozinha',     feature: 'kds'            },
  { to: '/fichas',         icon: BookOpen,      label: 'Fichas Técnicas', feature: 'recipes'        },
  { to: '/fornecedores',   icon: Truck,         label: 'Fornecedores',    feature: 'suppliers'      },
  { to: '/compras',        icon: ClipboardList, label: 'Pedidos de Compra', feature: 'purchase_orders' },
  { to: '/contas',         icon: Wallet,        label: 'Contas',          feature: 'contas'         },
  { to: '/dre',            icon: FileBarChart,  label: 'DRE',             feature: 'dre'            },
  { to: '/cmv',        icon: TrendingDown,    label: 'CMV',             feature: 'cmv'        },
  { to: '/financas',   icon: DollarSign,      label: 'Finanças',        feature: 'financas'   },
  { to: '/fiscal',     icon: ScrollText,      label: 'Fiscal',          feature: 'fiscal'     },
  { to: '/operators',  icon: Users,           label: 'Operadores',      feature: 'operators'  },
  { to: '/branches',   icon: Store,           label: 'Filiais',         feature: 'settings'   },
  { to: '/qrcode',     icon: QrCode,          label: 'QR Code',         feature: 'qrcode'     },
  { to: '/settings',   icon: Settings,        label: 'Configurações',   feature: 'settings'   },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [planStatus, setPlanStatus] = useState<'loading' | 'ok' | 'trial_warning' | 'expired' | 'blocked' | 'disabled'>('loading');
  const [daysRemaining, setDaysRemaining] = useState(0);
  const [planSlug, setPlanSlug] = useState<PlanSlug>('');
  const [planDisplayName, setPlanDisplayName] = useState('');

  const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com';

  useEffect(() => {
    if (!user) return;

    if (user.email === SUPER_ADMIN_EMAIL) {
      setPlanStatus('ok');
      setPlanSlug('premium'); // superadmin acessa tudo
      return;
    }

    (async () => {
      const params = new URLSearchParams(window.location.search);
      if (params.get('checkout') === 'success') {
        const sessionId = localStorage.getItem('stripe_session_id');
        if (sessionId) {
          localStorage.removeItem('stripe_session_id');
          try {
            const result = await db.verifyStripeSession(sessionId);
            if (result.activated) {
              window.history.replaceState({}, '', window.location.pathname);
              setPlanStatus('ok');
              return;
            }
          } catch { /* segue para checar getMyPlan */ }
        }
      }

      const key = `zm_onboarded_${user.id}`;
      if (!localStorage.getItem(key)) {
        const s = await db.getSettings(user.id).catch(() => null);
        if (s && s.name && s.name.includes('@')) {
          navigate('/onboarding');
          return;
        }
        localStorage.setItem(key, '1');
      }

      try {
        const [plan, settings] = await Promise.all([
          db.getMyPlan(),
          db.getSettings(user.id).catch(() => null),
        ]);

        // Restaurante desativado pelo admin
        if (settings?.disabled) { setPlanStatus('disabled'); return; }

        let resolvedPlan = plan;
        if (!resolvedPlan || resolvedPlan.status === 'none') {
          await supabase.rpc('create_trial_plan', { p_user_id: user.id }).catch(() => {});
          resolvedPlan = await db.getMyPlan().catch(() => null);
        }

        if (!resolvedPlan || resolvedPlan.status === 'none') { navigate('/planos?new=1'); return; }
        if (resolvedPlan.isBlocked) { setPlanStatus('blocked'); return; }
        if (resolvedPlan.status === 'cancelled' || resolvedPlan.status === 'expired') { navigate('/planos'); return; }

        // Armazena o plano para feature gating
        const slug = (resolvedPlan.planSlug ?? 'basic') as PlanSlug;
        setPlanSlug(slug);
        setPlanDisplayName(resolvedPlan.planName ?? PLAN_DISPLAY[slug] ?? 'Básico');

        if (resolvedPlan.status === 'trial') {
          if (resolvedPlan.trialEndsAt && new Date(resolvedPlan.trialEndsAt) < new Date()) {
            navigate('/planos');
            return;
          }
          setDaysRemaining(resolvedPlan.daysRemaining);
          setPlanStatus('trial_warning');
          return;
        }
        setPlanStatus('ok');
      } catch {
        setPlanStatus('ok');
      }
    })();
  }, [user?.id]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const initials = user?.name
    ?.split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || '?';

  const handleNavClick = (item: NavItem) => {
    setMobileOpen(false);
    if (!canAccess(planSlug, item.feature)) {
      navigate(`/upgrade?feature=${item.feature}`);
    }
  };

  const sidebar = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <Zap className="w-[18px] h-[18px] text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-[15px] tracking-tight leading-none">ZapMenu</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block" />
              <span className="text-[10px] text-emerald-500/70 font-medium">Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Menu</p>
        {BASE_NAV.map(item => {
          const locked = planSlug !== '' && !canAccess(planSlug, item.feature);
          const minPlan = FEATURE_MIN_PLAN[item.feature];
          if (locked) {
            return (
              <button
                key={item.to}
                onClick={() => handleNavClick(item)}
                title={`Requer plano ${PLAN_DISPLAY[minPlan]}`}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-slate-600/50 hover:bg-white/5 hover:text-slate-400 transition-all duration-150 group"
              >
                <item.icon className="w-[17px] h-[17px] flex-shrink-0 opacity-50" strokeWidth={1.75} />
                <span className="flex-1 text-left opacity-60">{item.label}</span>
                <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Lock className="w-3 h-3" />
                  <span className="text-[10px] font-bold">{PLAN_DISPLAY[minPlan]}</span>
                </span>
                <Lock className="w-3 h-3 opacity-40 group-hover:opacity-0 transition-opacity" />
              </button>
            );
          }
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-emerald-500/10 text-emerald-400'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
                }`
              }
              onClick={() => setMobileOpen(false)}
            >
              <item.icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={1.75} />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Plano badge */}
      {planSlug && (
        <div className="px-4 py-2 border-t border-white/[0.06]">
          <button
            onClick={() => navigate('/planos')}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Plano</span>
              <span className="text-xs font-bold text-emerald-400">{planDisplayName || PLAN_DISPLAY[planSlug]}</span>
            </div>
            <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">Upgrade →</span>
          </button>
        </div>
      )}

      {/* User */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-[11px] font-bold">{initials}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-200 text-[13px] font-semibold truncate leading-snug">{user?.name}</p>
            <p className="text-slate-600 text-[11px] truncate leading-snug">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium text-slate-500 hover:text-red-400 hover:bg-red-500/5 transition-all duration-150"
        >
          <LogOut className="w-[17px] h-[17px]" strokeWidth={1.75} />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );

  return (
    <PlanContext.Provider value={{ planSlug, planName: planDisplayName || PLAN_DISPLAY[planSlug] || 'Básico' }}>
      <div className="min-h-screen bg-slate-100 flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex flex-col w-[230px] bg-[#0d1117] fixed inset-y-0 border-r border-white/[0.04]">
          {sidebar}
        </aside>

        {/* Mobile overlay */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden animate-fade-in">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
            <aside className="fixed inset-y-0 left-0 w-[230px] bg-[#0d1117] z-50 flex flex-col border-r border-white/[0.04] shadow-2xl animate-slide-in-right">
              {sidebar}
            </aside>
          </div>
        )}

        {/* Main */}
        <div className="flex-1 lg:ml-[230px] min-h-screen flex flex-col">
          {/* Mobile header */}
          <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200/60 px-4 py-3 flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
                <Zap className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="font-bold text-slate-900 text-sm tracking-tight">ZapMenu</span>
            </div>
          </header>

          {/* Banner: período de teste */}
          {planStatus === 'trial_warning' && (
            <div className={`border-b px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap ${daysRemaining <= 2 ? 'bg-red-50 border-red-200' : daysRemaining <= 5 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
              <p className={`text-sm font-semibold ${daysRemaining <= 2 ? 'text-red-800' : daysRemaining <= 5 ? 'text-amber-800' : 'text-emerald-800'}`}>
                {daysRemaining <= 2 ? '🚨' : daysRemaining <= 5 ? '⚠️' : '🎉'}{' '}
                {daysRemaining === 0
                  ? 'Seu período de teste encerra hoje! Assine para continuar.'
                  : <>Você está no <strong>período de teste</strong> — restam <strong>{daysRemaining} dia{daysRemaining !== 1 ? 's' : ''}</strong>.</>}
              </p>
              <button onClick={() => navigate('/planos')} className={`text-xs font-bold px-3 py-1.5 text-white rounded-lg transition-colors flex-shrink-0 ${daysRemaining <= 2 ? 'bg-red-600 hover:bg-red-700' : daysRemaining <= 5 ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                Ver preços
              </button>
            </div>
          )}

          {/* Tela de desativação pelo admin */}
          {planStatus === 'disabled' ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">⛔</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Restaurante desativado</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Esta conta foi desativada pela administração. Entre em contato com o suporte para mais informações.
                </p>
                <button onClick={handleLogout} className="w-full py-3 bg-slate-700 hover:bg-slate-800 text-white font-bold rounded-xl transition-colors text-sm">
                  Sair da conta
                </button>
              </div>
            </div>
          ) : planStatus === 'blocked' ? (
            <div className="flex-1 flex items-center justify-center p-8">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-3xl">🚫</span>
                </div>
                <h2 className="text-xl font-black text-slate-900 mb-2">Acesso suspenso</h2>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">
                  Seu acesso foi suspenso por falta de pagamento. Entre em contato com o suporte para regularizar.
                </p>
                <button onClick={() => navigate('/planos')} className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl transition-colors text-sm">
                  Regularizar agora
                </button>
                <button onClick={handleLogout} className="mt-3 text-xs text-slate-400 hover:underline block mx-auto">Sair da conta</button>
              </div>
            </div>
          ) : (
            <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full overflow-x-hidden">
              <Outlet />
            </main>
          )}
        </div>
      </div>
    </PlanContext.Provider>
  );
}

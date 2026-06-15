import { Receipt, BarChart2, UtensilsCrossed, Tag, LogOut, Zap, LayoutGrid, ChefHat, MonitorPlay, Shield, CreditCard, ChevronDown, Wallet, ClipboardList, X } from 'lucide-react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useState } from 'react';
import KDSPage from '../pages/KDSPage';

const ROLE_LABELS = {
  waiter:  { label: 'Garçom',  color: 'bg-blue-500/15 text-blue-300' },
  cashier: { label: 'Caixa',   color: 'bg-amber-500/15 text-amber-300' },
  admin:   { label: 'Admin',   color: 'bg-violet-500/15 text-violet-300' },
  kitchen: { label: 'Cozinha', color: 'bg-orange-500/15 text-orange-300' },
};

type RoleKey = 'waiter' | 'cashier' | 'admin' | 'kitchen';
type NavItem = { to: string; icon: typeof Receipt; label: string };

const VIEW_OPTIONS: { value: RoleKey; label: string; icon: typeof Shield }[] = [
  { value: 'admin',   label: 'Admin',   icon: Shield },
  { value: 'cashier', label: 'Caixa',   icon: CreditCard },
  { value: 'waiter',  label: 'Garçom',  icon: UtensilsCrossed },
  { value: 'kitchen', label: 'Cozinha', icon: ChefHat },
];

const VIEW_AS_KEY = 'op_view_as';

function getNavItems(role: RoleKey): NavItem[] {
  const orders:  NavItem = { to: '/op/pedidos',   icon: Receipt,        label: 'Pedidos' };
  const tables:  NavItem = { to: '/op/mesas',     icon: LayoutGrid,     label: 'Mesas' };
  const kitchen: NavItem = { to: '/op/cozinha',   icon: ChefHat,        label: 'Cozinha' };
  const reports: NavItem = { to: '/op/relatorios', icon: BarChart2,     label: 'Relatórios' };
  const menu:    NavItem = { to: '/op/cardapio',  icon: UtensilsCrossed, label: 'Cardápio' };
  const coupons: NavItem = { to: '/op/cupons',    icon: Tag,            label: 'Cupons' };
  const pdv:     NavItem = { to: '/op/pdv',       icon: MonitorPlay,    label: 'PDV' };
  const caixa:    NavItem = { to: '/op/caixa',     icon: Wallet,         label: 'Caixa' };
  const comandas: NavItem = { to: '/op/comandas',  icon: ClipboardList,  label: 'Comandas' };
  const browse:   NavItem = { to: '/op/menu',      icon: UtensilsCrossed, label: 'Cardápio' };

  if (role === 'waiter')  return [orders, tables, comandas, coupons, browse];
  if (role === 'cashier') return [orders, tables, pdv, caixa, coupons, reports];
  if (role === 'kitchen') return [kitchen];
  return [orders, tables, kitchen, pdv, menu, reports, coupons]; // admin
}

export default function OperatorLayout() {
  const { user, operatorInfo, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [viewDropdown, setViewDropdown] = useState(false);

  // Persist viewAs across reconnections / re-mounts — save synchronously to avoid race conditions
  const [viewAs, setViewAs] = useState<RoleKey>(() => {
    const saved = localStorage.getItem(VIEW_AS_KEY) as RoleKey | null;
    return saved && ['admin', 'cashier', 'waiter', 'kitchen'].includes(saved) ? saved : 'admin';
  });

  const changeViewAs = (newRole: RoleKey) => {
    localStorage.setItem(VIEW_AS_KEY, newRole); // save BEFORE setState
    setViewAs(newRole);
  };

  const handleLogout = async () => {
    localStorage.removeItem(VIEW_AS_KEY);
    await logout();
    navigate('/login', { replace: true });
  };

  if (!operatorInfo) return null;
  const role = operatorInfo.role;
  const roleCfg = ROLE_LABELS[role];
  const effectiveRole: RoleKey = role === 'admin' ? viewAs : role;

  // Kitchen operators (or admin viewing as kitchen): full-screen KDS, sem sidebar
  if (effectiveRole === 'kitchen') {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col">
        <header className="sticky top-0 z-30 bg-[#0d1117] border-b border-white/[0.06] px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-white font-bold text-sm leading-none tracking-tight">{operatorInfo.restaurantName}</p>
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-orange-500/15 text-orange-300 mt-0.5 inline-block">Cozinha</span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === 'admin' && (
              <button
                onClick={() => changeViewAs('admin')}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-white/10 transition-colors"
              >
                ← Voltar ao painel
              </button>
            )}
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition-all text-xs font-medium"
            >
              <LogOut className="w-3.5 h-3.5" /> Sair
            </button>
          </div>
        </header>
        <main className="flex-1 overflow-hidden">
          <KDSPage />
        </main>
      </div>
    );
  }

  const navItems = getNavItems(effectiveRole);

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13.5px] font-medium transition-all duration-150 ${
      isActive ? 'bg-emerald-500/10 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-100'
    }`;

  const sidebar = (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-white/[0.06]">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/30 flex-shrink-0">
            <Zap className="w-[18px] h-[18px] text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-bold text-[15px] tracking-tight leading-none truncate">{operatorInfo.restaurantName}</p>
            <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full mt-1 ${roleCfg.color}`}>
              {roleCfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Role switcher (admin only) */}
      {role === 'admin' && (
        <div className="px-3 py-2 border-b border-white/[0.06] relative">
          <p className="px-2 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-1.5">Visualizar como</p>
          <button
            onClick={() => setViewDropdown(v => !v)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-[13px] font-medium transition-colors"
          >
            <div className="flex items-center gap-2">
              {(() => { const opt = VIEW_OPTIONS.find(o => o.value === viewAs)!; return <><opt.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} /><span>{opt.label}</span></>; })()}
            </div>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${viewDropdown ? 'rotate-180' : ''}`} />
          </button>
          {viewDropdown && (
            <div className="absolute left-3 right-3 top-full mt-1 z-50 bg-[#1a2030] border border-white/10 rounded-xl overflow-hidden shadow-xl">
              {VIEW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    changeViewAs(opt.value);
                    setViewDropdown(false);
                    setMobileOpen(false);
                    if (opt.value !== 'kitchen') navigate('/op/pedidos', { replace: true });
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-[13px] font-medium transition-colors ${viewAs === opt.value ? 'bg-emerald-500/15 text-emerald-400' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'}`}
                >
                  <opt.icon className="w-4 h-4 flex-shrink-0" strokeWidth={1.75} />
                  {opt.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 text-[10px] font-semibold text-slate-600 uppercase tracking-widest mb-2">Menu</p>
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileOpen(false)}>
            <item.icon className="w-[17px] h-[17px] flex-shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User */}
      <div className="px-3 pb-4 border-t border-white/[0.06] pt-3 space-y-1">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0 shadow-md">
            <span className="text-white text-[11px] font-bold">
              {operatorInfo.operatorName.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-slate-200 text-[13px] font-semibold truncate leading-snug">{operatorInfo.operatorName}</p>
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
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[230px] bg-[#0d1117] fixed inset-y-0 border-r border-white/[0.04]">
        {sidebar}
      </aside>

      {/* "Visualizar como" drawer — mobile only (admin) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative bg-white rounded-t-3xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-slate-100">
              <p className="font-bold text-slate-900 text-base">Visualizar como</p>
              <button onClick={() => setMobileOpen(false)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3 pb-8">
              {VIEW_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => {
                    changeViewAs(opt.value);
                    setMobileOpen(false);
                    if (opt.value !== 'kitchen') navigate('/op/pedidos', { replace: true });
                  }}
                  className={`flex items-center gap-3 px-4 py-3.5 rounded-2xl border text-sm font-semibold transition-colors ${
                    viewAs === opt.value
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-100 bg-slate-50 text-slate-600 active:bg-slate-100'
                  }`}
                >
                  <opt.icon className="w-5 h-5 flex-shrink-0" strokeWidth={1.75} />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[230px] min-h-screen flex flex-col min-w-0 overflow-x-hidden">
        {/* Mobile header — slim */}
        <header className="lg:hidden sticky top-0 z-30 bg-[#0d1117] border-b border-white/[0.06] px-4 h-12 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="w-6 h-6 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3 h-3 text-white" />
            </div>
            <span className="font-bold text-white text-sm tracking-tight truncate">{operatorInfo.restaurantName}</span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleCfg.color}`}>
              {roleCfg.label}
            </span>
            {role === 'admin' && (
              <button
                onClick={() => setMobileOpen(true)}
                className="text-[10px] font-bold text-slate-400 px-2 py-1 rounded-lg border border-white/10 active:bg-white/10 transition-colors"
              >
                Trocar
              </button>
            )}
            <button onClick={handleLogout} className="p-1.5 rounded-lg text-slate-500 active:bg-white/10 transition-colors">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </header>

        <main className="flex-1 w-full overflow-x-hidden">
          <div className="max-w-5xl mx-auto px-3 sm:px-5 lg:px-8 py-3 sm:py-5 lg:py-8 pb-24 lg:pb-8 min-w-0">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 safe-area-bottom">
        <div className="flex">
          {navItems.slice(0, 5).map(item => {
            const isActive = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={`flex-1 flex flex-col items-center gap-1 py-2 transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}
              >
                <item.icon className="w-[22px] h-[22px]" strokeWidth={isActive ? 2 : 1.75} />
                <span className={`text-[10px] font-semibold ${isActive ? 'text-emerald-600' : 'text-slate-400'}`}>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

import { Receipt, BarChart2, UtensilsCrossed, Tag, LogOut, Menu, Zap, X, LayoutGrid } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useState } from 'react';

const ROLE_LABELS = {
  waiter: { label: 'Garçom', color: 'bg-blue-500/15 text-blue-300' },
  cashier: { label: 'Caixa', color: 'bg-amber-500/15 text-amber-300' },
  admin: { label: 'Admin', color: 'bg-violet-500/15 text-violet-300' },
};

type NavItem = { to: string; icon: typeof Receipt; label: string };

function getNavItems(role: 'waiter' | 'cashier' | 'admin'): NavItem[] {
  const orders: NavItem = { to: '/op/pedidos', icon: Receipt, label: 'Pedidos' };
  const tables: NavItem = { to: '/op/mesas', icon: LayoutGrid, label: 'Mesas' };
  const reports: NavItem = { to: '/op/relatorios', icon: BarChart2, label: 'Relatórios' };
  const menu: NavItem = { to: '/op/cardapio', icon: UtensilsCrossed, label: 'Cardápio' };
  const coupons: NavItem = { to: '/op/cupons', icon: Tag, label: 'Cupons' };

  if (role === 'waiter') return [orders, tables];
  if (role === 'cashier') return [orders, tables, reports];
  return [orders, tables, menu, reports, coupons]; // admin
}

export default function OperatorLayout() {
  const { user, operatorInfo, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => { await logout(); navigate('/login'); };

  if (!operatorInfo) return null;
  const role = operatorInfo.role;
  const roleCfg = ROLE_LABELS[role];
  const navItems = getNavItems(role);

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
    <div className="min-h-screen bg-slate-100 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[230px] bg-[#0d1117] fixed inset-y-0 border-r border-white/[0.04]">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[230px] bg-[#0d1117] z-50 flex flex-col border-r border-white/[0.04] shadow-2xl">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main */}
      <div className="flex-1 lg:ml-[230px] min-h-screen flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-slate-200/60 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100 transition-colors text-slate-600">
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <Zap className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight truncate">{operatorInfo.restaurantName}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${roleCfg.color.replace('/15', '/20')}`} style={{backgroundColor: 'rgb(239 246 255)'}}>
              {roleCfg.label}
            </span>
          </div>
          <button onClick={handleLogout} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500">
            <X className="w-4 h-4" />
          </button>
        </header>

        <main className="flex-1 p-5 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

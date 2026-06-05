import { LayoutDashboard, UtensilsCrossed, Grid3X3, QrCode, Settings, LogOut, ChefHat, Receipt } from 'lucide-react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/auth';
import { useState } from 'react';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Cardápio' },
  { to: '/categories', icon: Grid3X3, label: 'Categorias' },
  { to: '/orders', icon: Receipt, label: 'Pedidos' },
  { to: '/qrcode', icon: QrCode, label: 'QR Code' },
  { to: '/settings', icon: Settings, label: 'Configurações' },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `nav-link ${isActive ? 'nav-link-active' : 'nav-link-inactive'}`;

  const sidebar = (
    <>
      <div className="px-5 pt-7 pb-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shadow-glow">
            <ChefHat className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <h2 className="font-bold text-slate-900 text-[15px] tracking-tight">Cardápio Digital</h2>
            <p className="text-[11px] text-slate-400 truncate max-w-[140px] leading-tight mt-0.5">{user?.name}</p>
          </div>
        </div>
      </div>

      <div className="px-3 mx-3 h-px bg-slate-100" />

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {navItems.map(item => (
          <NavLink key={item.to} to={item.to} className={linkClass} onClick={() => setMobileOpen(false)}>
            <item.icon className="w-[18px] h-[18px]" strokeWidth={1.75} />
            <span className="tracking-[-0.01em]">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 pb-5 pt-2">
        <div className="h-px bg-slate-100 mx-3 mb-3" />
        <button
          onClick={handleLogout}
          className="nav-link nav-link-inactive w-full text-red-500 hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="w-[18px] h-[18px]" strokeWidth={1.75} />
          <span className="tracking-[-0.01em]">Sair</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-50/80 gradient-mesh flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex flex-col w-[260px] bg-white/90 backdrop-blur-sm border-r border-slate-200/50 fixed inset-y-0">
        {sidebar}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden animate-fade-in">
          <div className="fixed inset-0 bg-slate-900/20 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="fixed inset-y-0 left-0 w-[260px] bg-white z-50 flex flex-col shadow-elevated animate-slide-in-right">
            {sidebar}
          </aside>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 lg:ml-[260px]">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-30 bg-white/80 backdrop-blur-lg border-b border-slate-200/50 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setMobileOpen(true)} className="p-2 -ml-2 rounded-xl hover:bg-slate-100/80 transition-colors">
            <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center">
              <ChefHat className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-slate-900 text-sm tracking-tight">Cardápio Digital</span>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

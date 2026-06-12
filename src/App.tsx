import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'monospace', background: '#fff1f2', color: '#9f1239', minHeight: '100vh' }}>
          <h2 style={{ fontSize: 18, marginBottom: 12 }}>Erro na renderização</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error.message}{'\n\n'}{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}
import { CustomerAuthProvider } from './lib/customerAuth';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import OperatorLayout from './components/OperatorLayout';
import DashboardPage from './pages/DashboardPage';
import MenuPage from './pages/MenuPage';
import CategoriesPage from './pages/CategoriesPage';
import OrdersPage from './pages/OrdersPage';
import QRCodePage from './pages/QRCodePage';
import SettingsPage from './pages/SettingsPage';
import ReportsPage from './pages/ReportsPage';
import CouponsPage from './pages/CouponsPage';
import TablesPage from './pages/TablesPage';
import ComandasPage from './pages/ComandasPage';
import DriversPage from './pages/DriversPage';
import DriverPortalPage from './pages/DriverPortalPage';
import OperatorsPage from './pages/OperatorsPage';
import OpOrdersPage from './pages/op/OrdersPage';
import OpTablesPage from './pages/op/TablesPage';
import OpKitchenPage from './pages/op/KitchenPage';
import OpMenuBrowsePage from './pages/op/MenuBrowsePage';
import ReviewsPage from './pages/ReviewsPage';
import PublicMenuPage from './pages/PublicMenuPage';
import CustomerPortalPage from './pages/CustomerPortalPage';
import AdminDashboardPage from './pages/admin/DashboardPage';
import AdminRestaurantsPage from './pages/admin/RestaurantsPage';
import AdminPlansPage from './pages/admin/PlansPage';
import AdminAnalyticsPage from './pages/admin/AnalyticsPage';
import AdminRestaurantDetailPage from './pages/admin/RestaurantDetailPage';
import AdminCobrancasPage from './pages/admin/CobrancasPage';
import AdminMarketingPage from './pages/admin/MarketingPage';
import AdminTeamPage from './pages/admin/TeamPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PlanosPage from './pages/PlanosPage';
import UpgradePage from './pages/UpgradePage';
import BranchesPage from './pages/BranchesPage';
import CRMPage from './pages/CRMPage';
import StockPage from './pages/StockPage';
import CashRegisterPage from './pages/CashRegisterPage';
import CombosPage from './pages/CombosPage';
import PromotionsPage from './pages/PromotionsPage';
import CampaignsPage from './pages/CampaignsPage';
import CMVPage from './pages/CMVPage';
import FinancasPage from './pages/FinancasPage';
import FiscalPage from './pages/FiscalPage';
import KDSPage from './pages/KDSPage';
import PDVPage from './pages/PDVPage';
import RecipesPage from './pages/RecipesPage';
import SuppliersPage from './pages/SuppliersPage';
import PurchaseOrdersPage from './pages/PurchaseOrdersPage';
import ContasPage from './pages/ContasPage';
import DREPage from './pages/DREPage';

const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
  </div>
);

function HomeRoute() {
  const { user, loading, isOperator, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (user && isOperator) return <Navigate to="/op/pedidos" replace />;
  if (user) {
    if (adminRole) return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <LandingPage />;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (isOperator) return <Navigate to="/op/pedidos" replace />;
  if (adminRole) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function OperatorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  // Só redireciona se definitivamente não for operador (não durante transições de auth)
  if (!isOperator) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!adminRole) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (user && isOperator) return <Navigate to="/op/pedidos" replace />;
  if (user) {
    if (adminRole) return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing / home */}
          <Route path="/" element={<HomeRoute />} />

          {/* Auth */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />

          {/* Onboarding (owner auth required, no sidebar) */}
          <Route path="/onboarding" element={<OwnerRoute><OnboardingPage /></OwnerRoute>} />

          {/* Escolha de plano (paywall) */}
          <Route path="/planos" element={<OwnerRoute><PlanosPage reason="expired" /></OwnerRoute>} />

          {/* Super-Admin routes (own layout, violet theme) */}
          <Route path="/admin" element={<SuperAdminRoute><AdminLayout /></SuperAdminRoute>}>
            <Route index element={<AdminDashboardPage />} />
            <Route path="restaurantes" element={<AdminRestaurantsPage />} />
            <Route path="restaurantes/:userId" element={<AdminRestaurantDetailPage />} />
            <Route path="analytics" element={<AdminAnalyticsPage />} />
            <Route path="cobrancas" element={<AdminCobrancasPage />} />
            <Route path="planos" element={<AdminPlansPage />} />
            <Route path="marketing" element={<AdminMarketingPage />} />
            <Route path="equipe" element={<AdminTeamPage />} />
          </Route>

          {/* Owner routes (with sidebar Layout) */}
          <Route element={<OwnerRoute><Layout /></OwnerRoute>}>
            <Route path="/dashboard"  element={<DashboardPage />} />
            <Route path="/menu"       element={<MenuPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/orders"     element={<OrdersPage />} />
            <Route path="/reports"    element={<ReportsPage />} />
            <Route path="/reviews"    element={<ReviewsPage />} />
            <Route path="/coupons"    element={<CouponsPage />} />
            <Route path="/tables"     element={<TablesPage />} />
            <Route path="/comandas"   element={<ComandasPage />} />
            <Route path="/drivers"    element={<DriversPage />} />
            <Route path="/operators"  element={<OperatorsPage />} />
            <Route path="/branches"   element={<BranchesPage />} />
            <Route path="/crm"        element={<CRMPage />} />
            <Route path="/estoque"    element={<StockPage />} />
            <Route path="/caixa"      element={<CashRegisterPage />} />
            <Route path="/combos"     element={<CombosPage />} />
            <Route path="/promocoes"  element={<PromotionsPage />} />
            <Route path="/campanhas"  element={<CampaignsPage />} />
            <Route path="/cmv"          element={<CMVPage />} />
            <Route path="/financas"     element={<FinancasPage />} />
            <Route path="/fiscal"       element={<FiscalPage />} />
            <Route path="/kds"          element={<KDSPage />} />
            <Route path="/pdv"          element={<PDVPage />} />
            <Route path="/fichas"       element={<RecipesPage />} />
            <Route path="/fornecedores" element={<SuppliersPage />} />
            <Route path="/compras"      element={<PurchaseOrdersPage />} />
            <Route path="/contas"       element={<ContasPage />} />
            <Route path="/dre"          element={<DREPage />} />
            <Route path="/qrcode"       element={<QRCodePage />} />
            <Route path="/settings"   element={<SettingsPage />} />
            <Route path="/upgrade"    element={<UpgradePage />} />
          </Route>

          {/* Operator routes */}
          <Route path="/op" element={<OperatorRoute><OperatorLayout /></OperatorRoute>}>
            <Route index element={<Navigate to="/op/pedidos" replace />} />
            <Route path="pedidos" element={<OpOrdersPage />} />
            <Route path="mesas" element={<OpTablesPage />} />
            <Route path="cozinha" element={<OpKitchenPage />} />
            <Route path="relatorios" element={<ReportsPage />} />
            <Route path="cardapio" element={<MenuPage />} />
            <Route path="cupons" element={<CouponsPage />} />
            <Route path="pdv" element={<PDVPage />} />
            <Route path="caixa" element={<CashRegisterPage />} />
            <Route path="comandas" element={<ComandasPage />} />
            <Route path="menu" element={<OpMenuBrowsePage />} />
          </Route>

          {/* Driver portal (public, token-based) */}
          <Route path="/entregador/:token" element={<DriverPortalPage />} />

          {/* Public customer routes */}
          <Route path="/m/:slug/*" element={
            <CustomerAuthProvider>
              <Routes>
                <Route index element={<PublicMenuPage />} />
                <Route path="conta" element={<CustomerPortalPage />} />
              </Routes>
            </CustomerAuthProvider>
          } />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
    </ErrorBoundary>
  );
}

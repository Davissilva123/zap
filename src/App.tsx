import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Component, lazy, Suspense, type ReactNode } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { CustomerAuthProvider } from './lib/customerAuth';

// ── Shells / guards (eagerly loaded — small, needed before auth resolves) ──
import Layout from './components/Layout';
import AdminLayout from './components/AdminLayout';
import OperatorLayout from './components/OperatorLayout';

// ── Public / entry pages (eagerly loaded — no auth, must be instant) ──
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import PublicMenuPage from './pages/PublicMenuPage';
import CustomerPortalPage from './pages/CustomerPortalPage';

// ── Authenticated pages (lazy — split into separate chunks) ──
const OnboardingPage       = lazy(() => import('./pages/OnboardingPage'));
const PlanosPage           = lazy(() => import('./pages/PlanosPage'));
const DashboardPage        = lazy(() => import('./pages/DashboardPage'));
const MenuPage             = lazy(() => import('./pages/MenuPage'));
const CategoriesPage       = lazy(() => import('./pages/CategoriesPage'));
const OrdersPage           = lazy(() => import('./pages/OrdersPage'));
const QRCodePage           = lazy(() => import('./pages/QRCodePage'));
const SettingsPage         = lazy(() => import('./pages/SettingsPage'));
const ReportsPage          = lazy(() => import('./pages/ReportsPage'));
const CouponsPage          = lazy(() => import('./pages/CouponsPage'));
const TablesPage           = lazy(() => import('./pages/TablesPage'));
const ComandasPage         = lazy(() => import('./pages/ComandasPage'));
const DriversPage          = lazy(() => import('./pages/DriversPage'));
const DriverPortalPage     = lazy(() => import('./pages/DriverPortalPage'));
const OperatorsPage        = lazy(() => import('./pages/OperatorsPage'));
const ReviewsPage          = lazy(() => import('./pages/ReviewsPage'));
const BranchesPage         = lazy(() => import('./pages/BranchesPage'));
const CRMPage              = lazy(() => import('./pages/CRMPage'));
const StockPage            = lazy(() => import('./pages/StockPage'));
const CashRegisterPage     = lazy(() => import('./pages/CashRegisterPage'));
const CombosPage           = lazy(() => import('./pages/CombosPage'));
const PromotionsPage       = lazy(() => import('./pages/PromotionsPage'));
const CampaignsPage        = lazy(() => import('./pages/CampaignsPage'));
const CMVPage              = lazy(() => import('./pages/CMVPage'));
const FinancasPage         = lazy(() => import('./pages/FinancasPage'));
const FiscalPage           = lazy(() => import('./pages/FiscalPage'));
const KDSPage              = lazy(() => import('./pages/KDSPage'));
const PDVPage              = lazy(() => import('./pages/PDVPage'));
const RecipesPage          = lazy(() => import('./pages/RecipesPage'));
const SuppliersPage        = lazy(() => import('./pages/SuppliersPage'));
const PurchaseOrdersPage   = lazy(() => import('./pages/PurchaseOrdersPage'));
const ContasPage           = lazy(() => import('./pages/ContasPage'));
const DREPage              = lazy(() => import('./pages/DREPage'));
const UpgradePage          = lazy(() => import('./pages/UpgradePage'));

// Admin
const AdminDashboardPage        = lazy(() => import('./pages/admin/DashboardPage'));
const AdminRestaurantsPage      = lazy(() => import('./pages/admin/RestaurantsPage'));
const AdminPlansPage            = lazy(() => import('./pages/admin/PlansPage'));
const AdminAnalyticsPage        = lazy(() => import('./pages/admin/AnalyticsPage'));
const AdminRestaurantDetailPage = lazy(() => import('./pages/admin/RestaurantDetailPage'));
const AdminCobrancasPage        = lazy(() => import('./pages/admin/CobrancasPage'));
const AdminMarketingPage        = lazy(() => import('./pages/admin/MarketingPage'));
const AdminTeamPage             = lazy(() => import('./pages/admin/TeamPage'));

// Operator
const OpOrdersPage    = lazy(() => import('./pages/op/OrdersPage'));
const OpTablesPage    = lazy(() => import('./pages/op/TablesPage'));
const OpKitchenPage   = lazy(() => import('./pages/op/KitchenPage'));
const OpMenuBrowsePage      = lazy(() => import('./pages/op/MenuBrowsePage'));
const PrivacyPolicyPage     = lazy(() => import('./pages/PrivacyPolicyPage'));
const TermsPage             = lazy(() => import('./pages/TermsPage'));

// ── Error boundary ──────────────────────────────────────────────────────────
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

// ── Shared loading UI ───────────────────────────────────────────────────────
const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
  </div>
);

// ── Route guards ────────────────────────────────────────────────────────────
const SUPER_ADMIN_EMAIL = import.meta.env.VITE_SUPER_ADMIN_EMAIL ?? 'sdavi6790@gmail.com';
// SUPER_ADMIN_EMAIL kept for reference; actual check uses adminRole from context
void SUPER_ADMIN_EMAIL;

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

function OwnerRoute({ children }: { children: ReactNode }) {
  const { user, loading, isOperator, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (isOperator) return <Navigate to="/op/pedidos" replace />;
  if (adminRole) return <Navigate to="/admin" replace />;
  return <>{children}</>;
}

function OperatorRoute({ children }: { children: ReactNode }) {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!isOperator) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function SuperAdminRoute({ children }: { children: ReactNode }) {
  const { user, loading, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!adminRole) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  const { user, loading, isOperator, adminRole } = useAuth();
  if (loading) return <Spinner />;
  if (user && isOperator) return <Navigate to="/op/pedidos" replace />;
  if (user) {
    if (adminRole) return <Navigate to="/admin" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

// ── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<Spinner />}>
            <Routes>
              {/* Landing */}
              <Route path="/" element={<HomeRoute />} />

              {/* Auth */}
              <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
              <Route path="/reset-password" element={<ResetPasswordPage />} />

              {/* Onboarding */}
              <Route path="/onboarding" element={<OwnerRoute><OnboardingPage /></OwnerRoute>} />

              {/* Paywall */}
              <Route path="/planos" element={<OwnerRoute><PlanosPage reason="expired" /></OwnerRoute>} />

              {/* Super-Admin */}
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

              {/* Owner */}
              <Route element={<OwnerRoute><Layout /></OwnerRoute>}>
                <Route path="/dashboard"    element={<DashboardPage />} />
                <Route path="/menu"         element={<MenuPage />} />
                <Route path="/categories"   element={<CategoriesPage />} />
                <Route path="/orders"       element={<OrdersPage />} />
                <Route path="/reports"      element={<ReportsPage />} />
                <Route path="/reviews"      element={<ReviewsPage />} />
                <Route path="/coupons"      element={<CouponsPage />} />
                <Route path="/tables"       element={<TablesPage />} />
                <Route path="/comandas"     element={<ComandasPage />} />
                <Route path="/drivers"      element={<DriversPage />} />
                <Route path="/operators"    element={<OperatorsPage />} />
                <Route path="/branches"     element={<BranchesPage />} />
                <Route path="/crm"          element={<CRMPage />} />
                <Route path="/estoque"      element={<StockPage />} />
                <Route path="/caixa"        element={<CashRegisterPage />} />
                <Route path="/combos"       element={<CombosPage />} />
                <Route path="/promocoes"    element={<PromotionsPage />} />
                <Route path="/campanhas"    element={<CampaignsPage />} />
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
                <Route path="/settings"     element={<SettingsPage />} />
                <Route path="/upgrade"      element={<UpgradePage />} />
              </Route>

              {/* Operator */}
              <Route path="/op" element={<OperatorRoute><OperatorLayout /></OperatorRoute>}>
                <Route index element={<Navigate to="/op/pedidos" replace />} />
                <Route path="pedidos"   element={<OpOrdersPage />} />
                <Route path="mesas"     element={<OpTablesPage />} />
                <Route path="cozinha"   element={<OpKitchenPage />} />
                <Route path="relatorios" element={<ReportsPage />} />
                <Route path="cardapio"  element={<MenuPage />} />
                <Route path="cupons"    element={<CouponsPage />} />
                <Route path="pdv"       element={<PDVPage />} />
                <Route path="caixa"     element={<CashRegisterPage />} />
                <Route path="comandas"  element={<ComandasPage />} />
                <Route path="menu"      element={<OpMenuBrowsePage />} />
              </Route>

              {/* Legal pages (public) */}
              <Route path="/privacidade" element={<PrivacyPolicyPage />} />
              <Route path="/termos"      element={<TermsPage />} />

              {/* Driver portal */}
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
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

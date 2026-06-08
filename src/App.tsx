import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { CustomerAuthProvider } from './lib/customerAuth';
import LoginPage from './pages/LoginPage';
import LandingPage from './pages/LandingPage';
import OnboardingPage from './pages/OnboardingPage';
import AdminPage from './pages/AdminPage';
import Layout from './components/Layout';
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
import ReviewsPage from './pages/ReviewsPage';
import PublicMenuPage from './pages/PublicMenuPage';
import CustomerPortalPage from './pages/CustomerPortalPage';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="w-8 h-8 border-4 border-emerald-200 border-t-emerald-600 rounded-full animate-spin" />
  </div>
);

function HomeRoute() {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (user && isOperator) return <Navigate to="/op/pedidos" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}

function OwnerRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (isOperator) return <Navigate to="/op/pedidos" replace />;
  return <>{children}</>;
}

function OperatorRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/" replace />;
  if (!isOperator) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, isOperator } = useAuth();
  if (loading) return <Spinner />;
  if (user && isOperator) return <Navigate to="/op/pedidos" replace />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Landing / home */}
          <Route path="/" element={<HomeRoute />} />

          {/* Auth */}
          <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />

          {/* Onboarding (owner auth required, no sidebar) */}
          <Route path="/onboarding" element={<OwnerRoute><OnboardingPage /></OwnerRoute>} />

          {/* Owner routes (with sidebar Layout) */}
          <Route element={<OwnerRoute><Layout /></OwnerRoute>}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/categories" element={<CategoriesPage />} />
            <Route path="/orders" element={<OrdersPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/reviews" element={<ReviewsPage />} />
            <Route path="/coupons" element={<CouponsPage />} />
            <Route path="/tables" element={<TablesPage />} />
            <Route path="/comandas" element={<ComandasPage />} />
            <Route path="/drivers" element={<DriversPage />} />
            <Route path="/operators" element={<OperatorsPage />} />
            <Route path="/qrcode" element={<QRCodePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/admin" element={<AdminPage />} />
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
  );
}

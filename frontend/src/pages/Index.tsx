import React, { useState, useCallback, useEffect } from 'react';
import { isApiConfigured, getToken } from '@/lib/api';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { InventoryProvider, useInventory } from '@/contexts/InventoryContext';
import LoginPage from '@/components/LoginPage';
import AppSidebar from '@/components/AppSidebar';
import AppHeader from '@/components/AppHeader';
import KpiTicker from '@/components/KpiTicker';
import DashboardPage from './DashboardPage';
import ProductsPage from './ProductsPage';
import OrdersPage from './OrdersPage';
import AnalyticsPage from './AnalyticsPage';
import FinancialsPage from './FinancialsPage';
import PredictionsPage from './PredictionsPage';
import ReplenishmentPage from './ReplenishmentPage';
import ManufacturingPage from './ManufacturingPage';
import AlertsPage from './AlertsPage';
import ActivityPage from './ActivityPage';
import UsersPage from './UsersPage';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import CustomersPage from './CustomersPage';
import QuotationsPage from './QuotationsPage';
import CashFlowPage from './CashFlowPage';
import SimulationPage from './SimulationPage';
import AgentPage from './AgentPage';
import { AgentProvider } from '@/contexts/AgentContext';
import { NAV_PAGE_EVENT } from '@/lib/navPage';
import InventoryCopilotLauncher from '@/components/copilot/InventoryCopilotLauncher';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your inventory and sales' },
  products: { title: 'Products', subtitle: 'Manage your inventory' },
  orders: { title: 'Orders', subtitle: 'Track and manage orders' },
  customers: { title: 'Customers', subtitle: 'Customer profiles & order history' },
  purchaseOrders: { title: 'Purchase Orders', subtitle: 'Manage supplier purchase orders & GRN' },
  quotations: { title: 'Quotations', subtitle: 'Manage quotations & proforma invoices' },
  analytics: { title: 'Analytics', subtitle: 'Revenue, profit, aging & margin insights' },
  financials: { title: 'Financials', subtitle: 'P&L dashboard from delivered orders and operating expenses' },
  cashFlow: { title: 'Cash Flow', subtitle: 'AI projected inflows, outflows & liquidity' },
  predictions: { title: 'AI Predictions', subtitle: 'Smart restock & demand forecasting' },
  replenishment: { title: 'Intelligent Replenishment', subtitle: 'Demand forecasting & auto-reorder planning' },
  manufacturing: { title: 'Manufacturing Hub', subtitle: 'Production planning, BOM & raw materials' },
  simulation: { title: 'Inventory simulation', subtitle: 'What-if demand, lead time & seasonality (not live data)' },
  alerts: { title: 'Alerts & Notifications', subtitle: 'Stay on top of important events' },
  activity: { title: 'Activity Log', subtitle: 'Who did what and when' },
  users: { title: 'User Management', subtitle: 'Manage staff and viewer accounts' },
  agent: { title: 'Inventory Agent', subtitle: 'Autonomous decisions, approvals, and agent timeline' },
};

function InventoryShell({
  currentPage,
  setCurrentPage,
  pageInfo,
}: {
  currentPage: string;
  setCurrentPage: (p: string) => void;
  pageInfo: { title: string; subtitle: string };
}) {
  const { inventoryHydrating } = useInventory();
  const offlineMongo = isApiConfigured() && !getToken();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    if (!mobileNavOpen) return;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileNavOpen]);

  useEffect(() => {
    const onNav = (ev: Event) => {
      const ce = ev as CustomEvent<{ page?: string }>;
      const p = ce.detail?.page;
      if (typeof p === 'string' && p.length > 0) setCurrentPage(p);
    };
    window.addEventListener(NAV_PAGE_EVENT, onNav);
    return () => window.removeEventListener(NAV_PAGE_EVENT, onNav);
  }, [setCurrentPage]);

  const handleHeaderNavigate = useCallback(
    (
      page: string,
      opts?: {
        openPurchaseOrderModal?: boolean;
        productsLowStock?: boolean;
        scrollDashboardAnomalies?: boolean;
      }
    ) => {
      setCurrentPage(page);
      if (opts?.openPurchaseOrderModal) sessionStorage.setItem('inveto:openPO', '1');
      if (opts?.productsLowStock) sessionStorage.setItem('inveto:productsFilter', 'lowStock');
      if (opts?.scrollDashboardAnomalies) sessionStorage.setItem('inveto:scrollAnomalies', '1');
      window.dispatchEvent(new Event('inveto:nav-intent'));
    },
    [setCurrentPage]
  );

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {offlineMongo && (
        <div
          className="shrink-0 border-b border-amber-500/45 bg-amber-500/12 px-3 py-2 text-center text-xs text-amber-950 sm:px-4 sm:py-2.5 sm:text-sm dark:text-amber-100/95"
          role="status"
        >
          <strong>Offline demo mode:</strong> You signed in without reaching the API. Edits stay in this browser only and are{' '}
          <strong>not written to MongoDB</strong>. Run <code className="rounded bg-background/60 px-1 py-0.5 text-xs">npm run dev:full</code>, then sign in with a seeded user (e.g. admin@inveto.com / admin123).
        </div>
      )}
      <div className="flex flex-1 min-h-0 min-w-0">
        {inventoryHydrating && (
        <div
          className="fixed left-1/2 top-3 z-[120] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-md"
          role="status"
          aria-live="polite"
        >
          Loading data from server…
        </div>
        )}
        <AppSidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          mobileOpen={mobileNavOpen}
          onMobileClose={() => setMobileNavOpen(false)}
        />
        <div className="flex min-w-0 flex-1 flex-col">
        <AppHeader
          title={pageInfo.title}
          subtitle={pageInfo.subtitle}
          onNavigate={handleHeaderNavigate}
          onMenuClick={() => setMobileNavOpen(true)}
        />
        <KpiTicker />
        <main className="flex-1 overflow-auto p-3 sm:p-4 md:p-6">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'products' && <ProductsPage />}
          {currentPage === 'orders' && <OrdersPage />}
          {currentPage === 'customers' && <CustomersPage />}
          {currentPage === 'purchaseOrders' && <PurchaseOrdersPage />}
          {currentPage === 'quotations' && <QuotationsPage />}
          {currentPage === 'analytics' && <AnalyticsPage />}
          {currentPage === 'financials' && <FinancialsPage />}
          {currentPage === 'cashFlow' && <CashFlowPage />}
          {currentPage === 'predictions' && <PredictionsPage />}
          {currentPage === 'replenishment' && <ReplenishmentPage />}
          {currentPage === 'manufacturing' && <ManufacturingPage />}
          {currentPage === 'simulation' && <SimulationPage />}
          {currentPage === 'alerts' && <AlertsPage />}
          {currentPage === 'activity' && <ActivityPage />}
          {currentPage === 'users' && <UsersPage />}
          {currentPage === 'agent' && <AgentPage />}
        </main>
        </div>
      </div>
      <InventoryCopilotLauncher />
    </div>
  );
}

function AppContent() {
  const { isAuthenticated } = useAuth();
  const [currentPage, setCurrentPage] = useState('dashboard');

  if (!isAuthenticated) return <LoginPage />;

  const pageInfo = pageTitles[currentPage] || pageTitles.dashboard;

  return (
    <InventoryProvider>
      <AgentProvider>
        <InventoryShell currentPage={currentPage} setCurrentPage={setCurrentPage} pageInfo={pageInfo} />
      </AgentProvider>
    </InventoryProvider>
  );
}

export default function Index() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}

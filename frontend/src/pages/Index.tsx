import React, { useState } from 'react';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { InventoryProvider, useInventory } from '@/contexts/InventoryContext';
import LoginPage from '@/components/LoginPage';
import AppSidebar from '@/components/AppSidebar';
import AppHeader from '@/components/AppHeader';
import DashboardPage from './DashboardPage';
import ProductsPage from './ProductsPage';
import OrdersPage from './OrdersPage';
import AnalyticsPage from './AnalyticsPage';
import PredictionsPage from './PredictionsPage';
import ReplenishmentPage from './ReplenishmentPage';
import ManufacturingPage from './ManufacturingPage';
import AlertsPage from './AlertsPage';
import ActivityPage from './ActivityPage';
import UsersPage from './UsersPage';
import PurchaseOrdersPage from './PurchaseOrdersPage';
import CustomersPage from './CustomersPage';
import QuotationsPage from './QuotationsPage';

const pageTitles: Record<string, { title: string; subtitle: string }> = {
  dashboard: { title: 'Dashboard', subtitle: 'Overview of your inventory and sales' },
  products: { title: 'Products', subtitle: 'Manage your inventory' },
  orders: { title: 'Orders', subtitle: 'Track and manage orders' },
  customers: { title: 'Customers', subtitle: 'Customer profiles & order history' },
  purchaseOrders: { title: 'Purchase Orders', subtitle: 'Manage supplier purchase orders & GRN' },
  quotations: { title: 'Quotations', subtitle: 'Manage quotations & proforma invoices' },
  analytics: { title: 'Analytics', subtitle: 'Revenue, profit, aging & margin insights' },
  predictions: { title: 'AI Predictions', subtitle: 'Smart restock & demand forecasting' },
  replenishment: { title: 'Intelligent Replenishment', subtitle: 'Demand forecasting & auto-reorder planning' },
  manufacturing: { title: 'Manufacturing Hub', subtitle: 'Production planning, BOM & raw materials' },
  alerts: { title: 'Alerts & Notifications', subtitle: 'Stay on top of important events' },
  activity: { title: 'Activity Log', subtitle: 'Who did what and when' },
  users: { title: 'User Management', subtitle: 'Manage staff and viewer accounts' },
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

  return (
    <div className="flex min-h-screen bg-background">
      {inventoryHydrating && (
        <div
          className="fixed top-3 left-1/2 z-[100] -translate-x-1/2 rounded-full border border-border bg-card px-4 py-2 text-sm text-muted-foreground shadow-md"
          role="status"
          aria-live="polite"
        >
          Loading data from server…
        </div>
      )}
      <AppSidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader title={pageInfo.title} subtitle={pageInfo.subtitle} />
        <main className="flex-1 p-6 overflow-auto">
          {currentPage === 'dashboard' && <DashboardPage />}
          {currentPage === 'products' && <ProductsPage />}
          {currentPage === 'orders' && <OrdersPage />}
          {currentPage === 'customers' && <CustomersPage />}
          {currentPage === 'purchaseOrders' && <PurchaseOrdersPage />}
          {currentPage === 'quotations' && <QuotationsPage />}
          {currentPage === 'analytics' && <AnalyticsPage />}
          {currentPage === 'predictions' && <PredictionsPage />}
          {currentPage === 'replenishment' && <ReplenishmentPage />}
          {currentPage === 'manufacturing' && <ManufacturingPage />}
          {currentPage === 'alerts' && <AlertsPage />}
          {currentPage === 'activity' && <ActivityPage />}
          {currentPage === 'users' && <UsersPage />}
        </main>
      </div>
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
      <InventoryShell currentPage={currentPage} setCurrentPage={setCurrentPage} pageInfo={pageInfo} />
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

import React, { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Bell,
  Users,
  Activity,
  Brain,
  TrendingUp,
  LogOut,
  RefreshCw,
  Factory,
  Truck,
  UserCheck,
  FileText,
  Wallet,
  FlaskConical,
  Bot,
  BarChart2,
  X,
} from 'lucide-react';
import brandMark from '@/assets/inveron-brand.png';

interface AppSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Boxes },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: UserCheck },
  { id: 'purchaseOrders', label: 'Purchase Orders', icon: Truck },
  { id: 'quotations', label: 'Quotations', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'financials', label: 'Financials', icon: BarChart2 },
  { id: 'cashFlow', label: 'Cash Flow', icon: Wallet },
  { id: 'predictions', label: 'AI Predictions', icon: Brain },
  { id: 'agent', label: 'Inventory Agent', icon: Bot },
  { id: 'replenishment', label: 'Replenishment', icon: RefreshCw },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory },
  { id: 'simulation', label: 'Simulation', icon: FlaskConical },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
];

export default function AppSidebar({ currentPage, onNavigate, mobileOpen, onMobileClose }: AppSidebarProps) {
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!mobileOpen) return;
    const onResize = () => {
      if (window.matchMedia('(min-width: 1024px)').matches) onMobileClose();
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [mobileOpen, onMobileClose]);

  const go = (id: string) => {
    onNavigate(id);
    onMobileClose();
  };

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation menu"
        className={`fixed inset-0 z-[108] bg-background/70 backdrop-blur-sm transition-opacity duration-200 lg:hidden ${
          mobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={onMobileClose}
      />

      <aside
        className={`flex h-screen min-h-0 flex-col bg-sidebar-bg lg:h-auto lg:min-h-screen
        fixed inset-y-0 left-0 z-[109] w-[min(17.5rem,90vw)] max-w-[100vw] border-r border-sidebar-fg/10 shadow-2xl
        transition-transform duration-200 ease-out
        lg:static lg:z-auto lg:w-64 lg:max-w-none lg:translate-x-0 lg:border-r-0 lg:shadow-none
        ${mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-sidebar-fg/10 p-4 lg:border-0 lg:p-6">
          <div className="flex min-w-0 items-center gap-3">
            <img src={brandMark} alt="" className="h-9 w-9 shrink-0 rounded-xl lg:h-10 lg:w-10" width={40} height={40} />
            <span className="truncate text-lg font-display font-bold tracking-tight text-sidebar-fg lg:text-xl">Inveron</span>
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="rounded-lg p-2 text-sidebar-fg/80 hover:bg-sidebar-active/15 hover:text-sidebar-active lg:hidden"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 py-2 pb-4">
          {navItems.map((item) => {
            if (item.adminOnly && user?.role !== 'admin') return null;
            const Icon = item.icon;
            const active = currentPage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                className={`sidebar-link w-full text-left ${active ? 'active' : ''}`}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mx-3 mb-4 mt-auto shrink-0 rounded-xl bg-sidebar-active/10 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full gradient-primary text-sm font-bold text-primary-foreground">
              {(user?.name?.trim()?.charAt(0) || '?').toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-sidebar-fg">{user?.name ?? 'User'}</p>
              <p className="text-xs capitalize text-sidebar-fg/60">{user?.role}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onMobileClose();
              logout();
            }}
            className="mt-3 flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-sidebar-fg/70 transition-colors hover:bg-sidebar-active/10 hover:text-sidebar-active"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}

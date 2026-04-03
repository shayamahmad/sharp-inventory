import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { LayoutDashboard, ShoppingCart, Boxes, Bell, Users, Activity, Brain, TrendingUp, LogOut, RefreshCw, Factory, Truck, UserCheck, FileText, ClipboardList, Wallet, FlaskConical } from 'lucide-react';
import invetoLogo from '@/assets/inveto-logo.png';

interface AppSidebarProps {
  currentPage: string;
  onNavigate: (page: string) => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'products', label: 'Products', icon: Boxes },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'customers', label: 'Customers', icon: UserCheck },
  { id: 'purchaseOrders', label: 'Purchase Orders', icon: Truck },
  { id: 'quotations', label: 'Quotations', icon: FileText },
  { id: 'analytics', label: 'Analytics', icon: TrendingUp },
  { id: 'cashFlow', label: 'Cash Flow', icon: Wallet },
  { id: 'predictions', label: 'AI Predictions', icon: Brain },
  { id: 'replenishment', label: 'Replenishment', icon: RefreshCw },
  { id: 'manufacturing', label: 'Manufacturing', icon: Factory },
  { id: 'simulation', label: 'Simulation', icon: FlaskConical },
  { id: 'alerts', label: 'Alerts', icon: Bell },
  { id: 'activity', label: 'Activity Log', icon: Activity },
  { id: 'users', label: 'User Management', icon: Users, adminOnly: true },
];

export default function AppSidebar({ currentPage, onNavigate }: AppSidebarProps) {
  const { user, logout } = useAuth();

  return (
    <aside className="w-64 min-h-screen bg-sidebar-bg flex flex-col shrink-0">
      <div className="p-6 flex items-center gap-3">
        <img src={invetoLogo} alt="INVETO Logo" className="w-10 h-10 rounded-xl object-cover" />
        <span className="text-xl font-display font-bold text-sidebar-fg tracking-tight">INVETO</span>
      </div>

      <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
        {navItems.map(item => {
          if (item.adminOnly && user?.role !== 'admin') return null;
          const Icon = item.icon;
          const active = currentPage === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)}
              className={`sidebar-link w-full ${active ? 'active' : ''}`}>
              <Icon className="h-5 w-5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="p-4 mx-3 mb-4 rounded-xl bg-sidebar-active/10">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center text-sm font-bold text-primary-foreground">
            {user?.name.charAt(0)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-fg truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-fg/60 capitalize">{user?.role}</p>
          </div>
        </div>
        <button onClick={logout} className="mt-3 w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-sidebar-fg/70 hover:text-sidebar-active hover:bg-sidebar-active/10 transition-colors">
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </div>
    </aside>
  );
}

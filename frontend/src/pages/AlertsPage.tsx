import React, { useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useLiveNotifications } from '@/hooks/useLiveNotifications';
import { Bell, AlertTriangle, TrendingUp, ShoppingCart, Shield, Check } from 'lucide-react';

const typeIcons: Record<string, React.ElementType> = {
  low_stock: AlertTriangle,
  dead_stock: AlertTriangle,
  high_demand: TrendingUp,
  order: ShoppingCart,
  admin: Shield,
};

const typeColors: Record<string, string> = {
  low_stock: 'bg-destructive/10 text-destructive',
  dead_stock: 'bg-warning/10 text-warning',
  high_demand: 'bg-success/10 text-success',
  order: 'bg-info/10 text-info',
  admin: 'bg-primary/10 text-primary',
};

export default function AlertsPage() {
  const { products, orders } = useInventory();
  const { notifications: notifs, markRead, markAllRead } = useLiveNotifications(products, orders);
  const [filter, setFilter] = useState('all');

  const filtered = notifs.filter((n) => filter === 'all' || n.type === filter);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {['all', 'low_stock', 'dead_stock', 'high_demand', 'order', 'admin'].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
              {f.replace('_', ' ')}
            </button>
          ))}
        </div>
        <button onClick={markAllRead} className="text-xs text-primary font-medium hover:underline flex items-center gap-1">
          <Check className="h-3.5 w-3.5" /> Mark all read
        </button>
      </div>

      <div className="space-y-2">
        {filtered.map(n => {
          const Icon = typeIcons[n.type] || Bell;
          return (
            <div key={n.id} onClick={() => markRead(n.id)}
              className={`flex items-start gap-4 p-4 rounded-xl border transition-all cursor-pointer ${!n.read ? 'bg-primary/5 border-primary/20 shadow-sm' : 'bg-card border-border hover:bg-secondary/50'}`}>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${typeColors[n.type]}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-foreground">{n.title}</h4>
                  {!n.read && <span className="w-2 h-2 rounded-full bg-primary" />}
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{n.message}</p>
                <p className="text-xs text-muted-foreground/60 mt-1">{n.timestamp}</p>
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">No alerts found.</div>
        )}
      </div>
    </div>
  );
}

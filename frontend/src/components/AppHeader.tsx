import React, { useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useLiveNotifications } from '@/hooks/useLiveNotifications';
import { Sun, Moon, Bell } from 'lucide-react';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
}

export default function AppHeader({ title, subtitle }: AppHeaderProps) {
  const { isDark, toggle } = useTheme();
  const { products, orders } = useInventory();
  const { notifications, markRead } = useLiveNotifications(products, orders);
  const [showNotif, setShowNotif] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 border-b border-border bg-card/80 backdrop-blur-sm px-6 flex items-center justify-between shrink-0">
      <div>
        <h1 className="text-xl font-display font-bold text-foreground">{title}</h1>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button onClick={toggle} className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors">
          {isDark ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
        </button>
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)} className="p-2.5 rounded-lg bg-secondary hover:bg-secondary/80 transition-colors relative">
            <Bell className="h-4 w-4 text-foreground" />
            {unread > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
                {unread}
              </span>
            )}
          </button>
          {showNotif && (
            <div className="absolute right-0 top-12 w-80 bg-card border border-border rounded-xl shadow-lg z-50 animate-fade-in overflow-hidden">
              <div className="p-3 border-b border-border">
                <h3 className="font-display font-semibold text-foreground text-sm">Notifications</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {notifications.slice(0, 8).map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => markRead(n.id)}
                    className={`w-full text-left p-3 border-b border-border/50 hover:bg-secondary/50 transition-colors ${!n.read ? 'bg-primary/5' : ''}`}
                  >
                    <p className="text-sm font-medium text-foreground">{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{n.timestamp}</p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

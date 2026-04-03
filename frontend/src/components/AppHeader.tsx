import React, { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useInventory } from '@/contexts/InventoryContext';
import { useLiveNotifications } from '@/hooks/useLiveNotifications';
import { Sun, Moon, Bell, Maximize2, RefreshCw, Menu } from 'lucide-react';
import { isApiConfigured, getToken } from '@/lib/api';
import VoiceCommandsBar from '@/components/VoiceCommandsBar';
import VoiceAssistantPanel from '@/components/VoiceAssistantPanel';
import CommandCenterOverlay from '@/components/CommandCenterOverlay';

interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onNavigate?: (
    page: string,
    opts?: {
      openPurchaseOrderModal?: boolean;
      productsLowStock?: boolean;
      scrollDashboardAnomalies?: boolean;
    }
  ) => void;
  /** Opens mobile navigation drawer */
  onMenuClick?: () => void;
}

export default function AppHeader({ title, subtitle, onNavigate, onMenuClick }: AppHeaderProps) {
  const { isDark, toggle } = useTheme();
  const { products, orders, refreshInventory, inventoryHydrating } = useInventory();
  const canReloadFromServer = isApiConfigured() && !!getToken();
  const { notifications, markRead } = useLiveNotifications(products, orders);
  const [showNotif, setShowNotif] = useState(false);
  const [commandCenterOpen, setCommandCenterOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [assistantMicOnOpen, setAssistantMicOnOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    if (!commandCenterOpen) return;
    const p = document.documentElement.requestFullscreen?.();
    if (p) void p.catch(() => {});
  }, [commandCenterOpen]);

  const nav = onNavigate ?? (() => {});
  const consumeAssistantMicBootstrap = useCallback(() => setAssistantMicOnOpen(false), []);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border bg-card/80 px-3 backdrop-blur-sm sm:h-16 sm:gap-3 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="shrink-0 rounded-lg p-2 text-foreground hover:bg-secondary lg:hidden"
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          )}
          <div className="min-w-0">
            <h1 className="truncate text-base font-display font-bold text-foreground sm:text-lg md:text-xl">{title}</h1>
            {subtitle && (
              <p className="hidden truncate text-xs text-muted-foreground sm:block">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2 md:gap-3">
          <VoiceCommandsBar
            onNavigate={nav}
            onOpenAssistant={() => {
              setAssistantMicOnOpen(true);
              setAssistantOpen(true);
            }}
          />
          {canReloadFromServer && (
            <span
              className="hidden md:inline-flex items-center gap-2 text-[10px] text-muted-foreground tabular-nums max-w-[140px] leading-tight"
              title="Inventory reloads from the API about every 28 seconds while this tab is visible. Other Inveron tabs pull fresh data when you save here. Use refresh for an immediate pull (e.g. after Compass edits)."
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-500/35 animate-ping" aria-hidden />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500/90" aria-hidden />
              </span>
              <span className="truncate">Live sync</span>
            </span>
          )}
          {canReloadFromServer && (
            <button
              type="button"
              onClick={() => void refreshInventory()}
              disabled={inventoryHydrating}
              className="rounded-lg bg-secondary p-2 transition-colors hover:bg-secondary/80 disabled:opacity-50 sm:p-2.5"
              title="Reload all data from the server now (e.g. after editing in MongoDB Compass)"
              aria-label="Reload data from server"
            >
              <RefreshCw className={`h-4 w-4 text-foreground ${inventoryHydrating ? 'animate-spin' : ''}`} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setCommandCenterOpen(true)}
            className="rounded-lg bg-secondary p-2 transition-colors hover:bg-secondary/80 sm:p-2.5"
            title="Command center"
            aria-label="Open command center full screen"
          >
            <Maximize2 className="h-4 w-4 text-foreground" />
          </button>
          <button
            type="button"
            onClick={toggle}
            className="rounded-lg bg-secondary p-2 transition-colors hover:bg-secondary/80 sm:p-2.5"
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="h-4 w-4 text-foreground" /> : <Moon className="h-4 w-4 text-foreground" />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotif(!showNotif)}
              className="relative rounded-lg bg-secondary p-2 transition-colors hover:bg-secondary/80 sm:p-2.5"
              aria-expanded={showNotif}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4 text-foreground" />
              {unread > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center font-bold">
                  {unread}
                </span>
              )}
            </button>
            {showNotif && (
              <div className="animate-fade-in absolute right-0 top-11 z-50 max-h-[min(24rem,70vh)] w-[min(20rem,calc(100vw-1.25rem))] overflow-hidden rounded-xl border border-border bg-card shadow-lg sm:top-14 sm:w-80">
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
      {commandCenterOpen && (
        <CommandCenterOverlay open={commandCenterOpen} onClose={() => setCommandCenterOpen(false)} />
      )}
      <VoiceAssistantPanel
        open={assistantOpen}
        onClose={() => {
          setAssistantOpen(false);
          setAssistantMicOnOpen(false);
        }}
        onNavigate={nav}
        autoStartListening={assistantMicOnOpen}
        onAutoStartListeningConsumed={consumeAssistantMicBootstrap}
      />
    </>
  );
}

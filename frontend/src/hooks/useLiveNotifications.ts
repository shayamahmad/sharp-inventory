import { useMemo, useState, useCallback } from 'react';
import type { Notification, Product, Order } from '@/lib/mockData';

const READ_KEY = 'inveto_notification_read_ids';

function buildLiveNotifications(products: Product[], orders: Order[]): Notification[] {
  const list: Notification[] = [];
  const ts = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  for (const p of products) {
    if (p.stock <= p.minStock) {
      list.push({
        id: `low-${p.id}`,
        type: 'low_stock',
        title: 'Low stock',
        message: `${p.name} has ${p.stock} ${p.unit} on hand (minimum ${p.minStock}).`,
        read: false,
        timestamp: ts,
      });
    }
    if (p.stock > 0 && p.salesLast30 < 2) {
      list.push({
        id: `dead-${p.id}`,
        type: 'dead_stock',
        title: 'Slow-moving stock',
        message: `${p.name}: only ${p.salesLast30} sold in the last 30 days with ${p.stock} in stock.`,
        read: false,
        timestamp: ts,
      });
    }
  }

  for (const o of orders) {
    if (o.status !== 'Placed' && o.status !== 'Processing') continue;
    list.push({
      id: `order-${o.id}`,
      type: 'order',
      title: `Order ${o.status}`,
      message: `${o.id} — ${o.customerName} · ${formatCurrencyInr(o.total)}`,
      read: false,
      timestamp: ts,
    });
  }

  const highDemand = products.filter((p) => p.salesLast30 >= 50 && p.stock <= p.minStock * 2);
  for (const p of highDemand) {
    list.push({
      id: `demand-${p.id}`,
      type: 'high_demand',
      title: 'High demand',
      message: `${p.name} is selling fast (${p.salesLast30} / 30d) — check reorder.`,
      read: false,
      timestamp: ts,
    });
  }

  return list;
}

function formatCurrencyInr(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export function useLiveNotifications(products: Product[], orders: Order[]) {
  const [readIds, setReadIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(READ_KEY);
      return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      return new Set();
    }
  });

  const persist = useCallback((next: Set<string>) => {
    setReadIds(next);
    try {
      localStorage.setItem(READ_KEY, JSON.stringify([...next]));
    } catch {
      /* ignore */
    }
  }, []);

  const base = useMemo(() => buildLiveNotifications(products, orders), [products, orders]);

  const notifications: Notification[] = useMemo(
    () => base.map((n) => ({ ...n, read: readIds.has(n.id) })),
    [base, readIds]
  );

  const markRead = useCallback(
    (id: string) => {
      if (readIds.has(id)) return;
      persist(new Set([...readIds, id]));
    },
    [readIds, persist]
  );

  const markAllRead = useCallback(() => {
    persist(new Set(base.map((n) => n.id)));
  }, [base, persist]);

  return { notifications, markRead, markAllRead };
}

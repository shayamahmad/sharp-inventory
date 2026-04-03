import React, { useEffect, useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency, getStockStatus } from '@/lib/mockData';
import { computeInventoryHealth } from '@/lib/inventoryHealthScore';

function todayYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export default function KpiTicker() {
  const { products, orders, purchaseOrders } = useInventory();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const kpis = useMemo(() => {
    void tick;
    const now = new Date();
    const ymd = todayYmd(now);
    const todayRevenue = orders.filter((o) => o.date === ymd).reduce((s, o) => s + o.total, 0);
    const pendingOrders = orders.filter((o) => o.status === 'Placed' || o.status === 'Processing').length;
    const criticalStock = products.filter((p) => {
      const st = getStockStatus(p);
      return st === 'critical' || st === 'out';
    }).length;
    const topSeller = [...products].sort((a, b) => b.salesLast30 - a.salesLast30)[0];
    const lowStockItems = products.filter((p) => getStockStatus(p) !== 'ok').length;
    const activePOs = purchaseOrders.filter((po) => po.status !== 'Closed').length;
    const health = computeInventoryHealth(products, orders, purchaseOrders).total;

    const sep = ' · ';
    return [
      `Today's revenue ${formatCurrency(todayRevenue)}`,
      `Pending orders ${pendingOrders}`,
      `Critical stock alerts ${criticalStock}`,
      `Top seller (30d) ${topSeller ? topSeller.name : '—'}`,
      `Low stock items ${lowStockItems}`,
      `Active POs ${activePOs}`,
      `Health score ${health}`,
    ].join(` ${sep} `);
  }, [products, orders, purchaseOrders, tick]);

  const pad = '  ·  ';

  return (
    <div
      className="h-8 shrink-0 border-b border-border bg-muted/60 overflow-hidden flex items-center"
      aria-live="polite"
    >
      <div className="kpi-ticker-track flex whitespace-nowrap text-[11px] text-muted-foreground tabular-nums leading-8">
        <span className="shrink-0 px-4">{kpis}{pad}</span>
        <span className="shrink-0 px-4">{kpis}{pad}</span>
      </div>
    </div>
  );
}

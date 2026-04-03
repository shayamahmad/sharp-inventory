import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency, predictDaysUntilStockout } from '@/lib/mockData';
import { monthlySales } from '@/lib/mockData';
import { computeInventoryHealth } from '@/lib/inventoryHealthScore';
import { buildCashFlowForecast } from '@/lib/cashFlowForecast';
import { X } from 'lucide-react';

function tierColor(tier: 'poor' | 'fair' | 'good'): string {
  if (tier === 'poor') return '#ef4444';
  if (tier === 'fair') return '#eab308';
  return '#22c55e';
}

export default function CommandCenterOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { products, orders, purchaseOrders } = useInventory();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = window.setInterval(() => setTick((t) => t + 1), 60_000);
    return () => window.clearInterval(id);
  }, [open]);

  const todayStr = new Date().toISOString().slice(0, 10);

  const snapshot = useMemo(() => {
    void tick;
    const health = computeInventoryHealth(products, orders, purchaseOrders);
    const cash = buildCashFlowForecast(
      orders,
      purchaseOrders,
      products,
      monthlySales.map((m) => ({ revenue: m.revenue, profit: m.profit })),
      30
    );
    const stockoutRisks = [...products]
      .map((p) => ({
        name: p.name,
        days: predictDaysUntilStockout(p),
      }))
      .filter((r) => r.days != null && r.days < 999)
      .sort((a, b) => (a.days ?? 0) - (b.days ?? 0))
      .slice(0, 5);

    const todayOrders = orders.filter((o) => o.date === todayStr);
    const todayValue = todayOrders.reduce((s, o) => s + o.total, 0);

    const anomalies: { label: string; description: string; severity: 'Warning' | 'Critical' }[] = [];
    products
      .filter((p) => p.salesLast30 === 0 && p.stock > 0)
      .forEach((p) =>
        anomalies.push({ label: p.name, description: 'Zero sales (30d) with stock', severity: 'Warning' })
      );
    const avgSales = products.length ? products.reduce((s, p) => s + p.salesLast30, 0) / products.length : 0;
    products
      .filter((p) => p.salesLast30 > avgSales * 3)
      .forEach((p) =>
        anomalies.push({ label: p.name, description: `Sales spike vs avg`, severity: 'Warning' })
      );
    const crit = anomalies.find((a) => a.severity === 'Critical') ?? anomalies[0];

    const unitsByProduct = new Map<string, { name: string; units: number }>();
    todayOrders.forEach((o) => {
      o.items.forEach((it) => {
        const cur = unitsByProduct.get(it.productId) ?? { name: it.productName, units: 0 };
        cur.units += it.quantity;
        unitsByProduct.set(it.productId, cur);
      });
    });
    let topToday: { name: string; units: number } | null = null;
    unitsByProduct.forEach((v) => {
      if (!topToday || v.units > topToday.units) topToday = { name: v.name, units: v.units };
    });
    const topSellerToday = topToday;

    return {
      health,
      cashNet: cash.series[cash.series.length - 1]?.netCashPosition ?? 0,
      cashGap: cash.hasCashGap,
      stockoutRisks,
      todayCount: todayOrders.length,
      todayValue,
      anomalyCount: anomalies.length,
      topAnomaly: crit?.description ?? 'None detected',
      topSellerToday,
    };
  }, [products, orders, purchaseOrders, todayStr, tick]);

  const exit = useCallback(async () => {
    if (document.fullscreenElement) {
      try {
        await document.exitFullscreen();
      } catch {
        /* ignore */
      }
    }
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') void exit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, exit]);

  useEffect(() => {
    const onFs = () => {
      if (!document.fullscreenElement) onClose();
    };
    document.addEventListener('fullscreenchange', onFs);
    return () => document.removeEventListener('fullscreenchange', onFs);
  }, [onClose]);

  if (!open) return null;

  const stroke = tierColor(snapshot.health.tier);
  const dashOffset = 100 - snapshot.health.total;

  return (
    <div className="fixed inset-0 z-[300] flex flex-col overflow-auto bg-slate-950 p-4 text-slate-100 sm:p-6 md:p-10">
      <div className="mb-4 flex flex-col gap-4 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-display font-bold tracking-tight sm:text-2xl md:text-3xl">Executive command center</h1>
        <div className="flex shrink-0 items-center justify-between gap-3 sm:justify-end sm:gap-4">
          <span className="flex items-center gap-2 text-lg">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500" />
            </span>
            Live
          </span>
          <button
            type="button"
            onClick={() => void exit()}
            className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600"
            aria-label="Exit command center"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        <div className="lg:col-span-5 flex flex-col items-center justify-center rounded-2xl border border-slate-700 bg-slate-900/80 p-8">
          <p className="text-slate-400 text-lg mb-4">Inventory health</p>
          <div className="relative w-72 h-44">
            <svg viewBox="0 0 200 120" className="w-full h-full">
              <path
                d="M 12 92 A 88 88 0 0 1 188 92"
                fill="none"
                stroke="#334155"
                strokeWidth="16"
                strokeLinecap="round"
              />
              <path
                d="M 12 92 A 88 88 0 0 1 188 92"
                fill="none"
                stroke={stroke}
                strokeWidth="16"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={dashOffset}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-2 pointer-events-none">
              <span className="text-6xl font-bold tabular-nums" style={{ color: stroke }}>
                {snapshot.health.total}
              </span>
              <span className="text-sm text-slate-500 uppercase tracking-widest">/ 100</span>
            </div>
          </div>
        </div>

        <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <p className="text-slate-400 text-lg">Top stockout risks</p>
            <ul className="mt-4 space-y-3">
              {snapshot.stockoutRisks.map((r) => (
                <li key={r.name} className="flex justify-between items-baseline gap-2">
                  <span className="text-xl truncate">{r.name}</span>
                  <span
                    className={`text-2xl font-bold tabular-nums shrink-0 ${(r.days ?? 0) <= 7 ? 'text-red-400' : 'text-amber-300'}`}
                  >
                    {r.days}d
                  </span>
                </li>
              ))}
              {snapshot.stockoutRisks.length === 0 && (
                <li className="text-slate-500 text-xl">No near-term risks</li>
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <p className="text-slate-400 text-lg">Today&apos;s orders</p>
            <p className="text-5xl font-bold tabular-nums mt-4">{snapshot.todayCount}</p>
            <p className="text-2xl text-slate-300 mt-2 tabular-nums">{formatCurrency(snapshot.todayValue)}</p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <p className="text-slate-400 text-lg">Active anomalies</p>
            <p className="text-5xl font-bold tabular-nums mt-4">{snapshot.anomalyCount}</p>
            <p className="text-xl text-slate-300 mt-3 line-clamp-3">{snapshot.topAnomaly}</p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6">
            <p className="text-slate-400 text-lg">Cash flow (30d net)</p>
            <p
              className={`text-4xl font-bold tabular-nums mt-4 ${snapshot.cashGap ? 'text-red-400' : 'text-emerald-400'}`}
            >
              {formatCurrency(snapshot.cashNet)}
            </p>
            {snapshot.cashGap && <p className="text-xl text-red-300 mt-2">Gap risk in window</p>}
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900/80 p-6 sm:col-span-2">
            <p className="text-slate-400 text-lg">Top selling product today</p>
            {snapshot.topSellerToday ? (
              <>
                <p className="text-3xl font-semibold mt-4 truncate">{snapshot.topSellerToday.name}</p>
                <p className="text-4xl font-bold tabular-nums mt-2 text-emerald-400">
                  {snapshot.topSellerToday.units} units
                </p>
              </>
            ) : (
              <p className="text-2xl text-slate-500 mt-4">No sales recorded today</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

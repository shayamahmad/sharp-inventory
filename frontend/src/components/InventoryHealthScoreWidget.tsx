import React, { useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import {
  computeInventoryHealth,
  weakestHealthComponents,
  type HealthComponent,
} from '@/lib/inventoryHealthScore';
import { Activity, TrendingUp } from 'lucide-react';

function tierGaugeColor(tier: 'poor' | 'fair' | 'good'): string {
  if (tier === 'poor') return 'hsl(var(--destructive))';
  if (tier === 'fair') return 'hsl(var(--warning))';
  return 'hsl(var(--success))';
}

function ComponentSubBar({ c }: { c: HealthComponent }) {
  const fillPct = c.maxPoints > 0 ? (c.points / c.maxPoints) * 100 : 0;
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-medium text-foreground">{c.label}</span>
        <span className="tabular-nums text-muted-foreground">
          {c.points.toFixed(1)} / {c.maxPoints} pts
          <span className="text-muted-foreground/70 ml-1">({c.metricPct}%)</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-secondary overflow-hidden border border-border/50">
        <div
          className="h-full rounded-full bg-primary/85 transition-[width] duration-500"
          style={{ width: `${fillPct}%` }}
        />
      </div>
    </div>
  );
}

export default function InventoryHealthScoreWidget() {
  const { products, orders, purchaseOrders, inventoryHydrating } = useInventory();

  const health = useMemo(
    () => computeInventoryHealth(products, orders, purchaseOrders),
    [products, orders, purchaseOrders]
  );

  const draggers = useMemo(() => weakestHealthComponents(health.components, 3), [health.components]);

  const strokeColor = tierGaugeColor(health.tier);
  const dashOffset = 100 - health.total;

  if (inventoryHydrating && products.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground">
        Loading inventory health…
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-border bg-gradient-to-b from-card to-secondary/20 shadow-sm overflow-hidden">
      <div className="px-5 pt-5 pb-2 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            AI inventory health
          </p>
          <h2 className="mt-1 text-lg sm:text-xl font-display font-bold text-foreground">
            Composite score — how resilient is your stock?
          </h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xl">
            Weighted from stockout exposure, slow inventory (DSI), supplier on-time delivery, order outcomes, and gross margin mix.
          </p>
        </div>
      </div>

      <div className="px-5 pb-5 flex flex-col gap-8 items-stretch">
        <div className="flex flex-col items-center shrink-0 mx-auto">
          <div className="relative w-[220px] h-[130px]">
            <svg viewBox="0 0 200 120" className="w-full h-full" aria-hidden>
              <path
                d="M 12 92 A 88 88 0 0 1 188 92"
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth="14"
                strokeLinecap="round"
              />
              <path
                d="M 12 92 A 88 88 0 0 1 188 92"
                fill="none"
                stroke={strokeColor}
                strokeWidth="14"
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={100}
                strokeDashoffset={dashOffset}
                className="transition-[stroke-dashoffset,stroke] duration-700 ease-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-end pb-1 pointer-events-none">
              <span
                className="text-5xl font-display font-bold tabular-nums leading-none"
                style={{ color: strokeColor }}
              >
                {health.total}
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-1 font-semibold">
                out of 100
              </span>
            </div>
          </div>
          <p className="text-xs text-center text-muted-foreground mt-2 max-w-[200px]">
            {health.tier === 'poor' && 'Priority attention — multiple risk signals.'}
            {health.tier === 'fair' && 'Room to improve — a few levers will lift the score.'}
            {health.tier === 'good' && 'Strong position — keep monitoring weak spots.'}
          </p>
        </div>

        <div className="flex-1 min-w-0 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            Score breakdown
          </div>
          <div className="space-y-3.5">
            {health.components.map((c) => (
              <ComponentSubBar key={c.id} c={c} />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-border bg-secondary/30 px-5 py-4">
        <h3 className="text-sm font-display font-semibold text-foreground mb-3">
          What&apos;s dragging your score?
        </h3>
        {draggers.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing major — components are at or near their caps. Keep watching stock and supplier performance.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {draggers.map((c) => (
              <li
                key={c.id}
                className="flex gap-3 text-sm rounded-lg bg-card/80 border border-border/60 px-3 py-2.5"
              >
                <span className="shrink-0 font-semibold text-foreground w-36 sm:w-44">{c.label}</span>
                <span className="text-muted-foreground">{c.fixSuggestion}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

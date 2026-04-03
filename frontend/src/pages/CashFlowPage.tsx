import React, { useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { monthlySales, formatCurrency } from '@/lib/mockData';
import { buildCashFlowForecast } from '@/lib/cashFlowForecast';
import {
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Wallet, AlertTriangle } from 'lucide-react';

export default function CashFlowPage() {
  const { orders, purchaseOrders, products, inventoryHydrating } = useInventory();
  const [horizon, setHorizon] = useState<30 | 60 | 90>(30);

  const monthlyStats = useMemo(
    () => monthlySales.map((m) => ({ revenue: m.revenue, profit: m.profit })),
    []
  );

  const forecast = useMemo(
    () => buildCashFlowForecast(orders, purchaseOrders, products, monthlyStats, horizon),
    [orders, purchaseOrders, products, monthlyStats, horizon]
  );

  const chartData = forecast.series;

  if (inventoryHydrating && orders.length === 0 && purchaseOrders.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-12 text-center">Loading cash flow data…</div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="gradient-primary rounded-xl p-6 flex items-center gap-4">
        <Wallet className="h-10 w-10 text-primary-foreground" />
        <div>
          <h2 className="text-xl font-display font-bold text-primary-foreground">AI cash flow forecaster</h2>
          <p className="text-primary-foreground/70 text-sm">
            Pipeline orders &amp; POs plus rolling monthly revenue/spend averages from historical mock data.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Horizon</span>
        {([30, 60, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setHorizon(d)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              horizon === d
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {d} days
          </button>
        ))}
        <span className="text-xs text-muted-foreground ml-auto">
          Opening balance (model): {formatCurrency(forecast.openingCash)} · Baseline inflow ~{formatCurrency(forecast.avgDailyBaselineInflow)}/day · Baseline outflow ~
          {formatCurrency(forecast.avgDailyBaselineOutflow)}/day
        </span>
      </div>

      {forecast.hasCashGap && (
        <div className="rounded-xl border-2 border-destructive/60 bg-destructive/10 px-4 py-3 flex flex-wrap items-center gap-3">
          <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
          <div>
            <p className="font-display font-semibold text-destructive">Cash gap risk</p>
            <p className="text-sm text-foreground">
              Projected net cash position drops below zero in this window. Estimated shortfall:{' '}
              <span className="font-bold tabular-nums">{formatCurrency(forecast.cashGapShortfall)}</span>
            </p>
          </div>
        </div>
      )}

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-foreground mb-4">Projected cumulative flows &amp; net position</h3>
        <div className="h-[340px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="isoDate"
                stroke="hsl(var(--muted-foreground))"
                fontSize={9}
                interval={horizon <= 30 ? 5 : horizon <= 60 ? 11 : 14}
                angle={-30}
                textAnchor="end"
                height={54}
              />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => (Math.abs(v) >= 100000 ? `₹${(v / 100000).toFixed(1)}L` : `₹${(v / 1000).toFixed(0)}k`)}
              />
              <Tooltip
                formatter={(value: number, name: string) => [formatCurrency(value), name]}
                labelFormatter={(_, payload) =>
                  payload?.[0]?.payload?.isoDate ? String(payload[0].payload.isoDate) : ''
                }
                contentStyle={{
                  background: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  color: 'hsl(var(--foreground))',
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="cumulativeInflow"
                name="Cumulative inflows"
                stroke="hsl(var(--success))"
                fill="hsl(var(--success) / 0.15)"
                strokeWidth={2}
              />
              <Area
                type="monotone"
                dataKey="cumulativeOutflow"
                name="Cumulative outflows"
                stroke="hsl(var(--destructive))"
                fill="hsl(var(--destructive) / 0.12)"
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="netCashPosition"
                name="Net cash position"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Green: cumulative expected cash in (baseline + Placed/Processing orders on scheduled dates). Red: cumulative
          expected cash out (baseline + open POs by expected delivery). Blue: opening balance + inflows − outflows.
        </p>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <h3 className="font-display font-semibold text-foreground">Upcoming cash events</h3>
          <p className="text-xs text-muted-foreground mt-1">Sorted by date · pipeline only (excludes Shipped/Delivered/Cancelled orders and Received/Closed POs)</p>
        </div>
        <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-secondary/90 backdrop-blur z-10">
              <tr className="border-b border-border">
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Date</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Type</th>
                <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Description</th>
                <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase">Amount</th>
              </tr>
            </thead>
            <tbody>
              {forecast.events.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                    No pipeline orders or open POs in range — chart reflects rolling baseline only.
                  </td>
                </tr>
              ) : (
                forecast.events.map((e, i) => (
                  <tr key={`${e.date}-${e.label}-${i}`} className="border-b border-border/50 hover:bg-secondary/30">
                    <td className="px-4 py-2.5 tabular-nums text-foreground">{e.date}</td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                          e.type === 'inflow' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'
                        }`}
                      >
                        {e.type === 'inflow' ? 'Inflow' : 'Outflow'}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-foreground">
                      <div className="font-medium">{e.label}</div>
                      <div className="text-xs text-muted-foreground">{e.detail}</div>
                    </td>
                    <td className={`px-4 py-2.5 text-right font-semibold tabular-nums ${e.type === 'inflow' ? 'text-success' : 'text-destructive'}`}>
                      {e.type === 'inflow' ? '+' : '−'}
                      {formatCurrency(e.amount)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

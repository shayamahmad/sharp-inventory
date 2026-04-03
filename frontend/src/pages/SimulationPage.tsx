import React, { useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency } from '@/lib/mockData';
import { runInventorySimulation, type SimulationParams } from '@/lib/inventorySimulation';
import { Button } from '@/components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { FlaskConical, RotateCcw, AlertTriangle } from 'lucide-react';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DEFAULTS: SimulationParams = {
  salesGrowthRate: 0,
  supplierDelayDays: 0,
  spikeMonth: new Date().getMonth(),
  spikeMultiplier: 1,
};

export default function SimulationPage() {
  const { products, purchaseOrders } = useInventory();
  const [growthPct, setGrowthPct] = useState(0);
  const [delay, setDelay] = useState(0);
  const [spikeMonth, setSpikeMonth] = useState(DEFAULTS.spikeMonth);
  const [spikeMult, setSpikeMult] = useState(1);
  const [ran, setRan] = useState(false);

  const params: SimulationParams = useMemo(
    () => ({
      salesGrowthRate: growthPct / 100,
      supplierDelayDays: delay,
      spikeMonth,
      spikeMultiplier: spikeMult,
    }),
    [growthPct, delay, spikeMonth, spikeMult]
  );

  const result = useMemo(() => {
    if (!ran) return null;
    return runInventorySimulation(products, purchaseOrders, params, 90);
  }, [ran, products, purchaseOrders, params]);

  const chartData = useMemo(() => {
    if (!result) return [];
    const days = 90;
    const arr: Record<string, number | string>[] = [];
    for (let d = 0; d < days; d++) {
      const row: Record<string, number | string> = { day: d + 1 };
      result.top5AtRisk.forEach((p) => {
        row[`s_${p.productId}`] = p.series[d]?.stock ?? 0;
      });
      arr.push(row);
    }
    return arr;
  }, [result]);

  const reset = () => {
    setGrowthPct(0);
    setDelay(0);
    setSpikeMonth(new Date().getMonth());
    setSpikeMult(1);
    setRan(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="rounded-xl border-2 border-dashed border-amber-500/50 bg-amber-500/5 p-4 flex gap-3 items-start">
        <FlaskConical className="h-6 w-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="font-display font-bold text-foreground">Simulation mode — not live data</p>
          <p className="text-sm text-muted-foreground mt-1">
            Scenarios below are projections only. They do not change inventory, orders, or POs in the system.
          </p>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl p-6 space-y-6">
        <h2 className="font-display font-semibold text-lg text-foreground">Scenario inputs</h2>

        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Sales growth rate: {growthPct >= 0 ? '+' : ''}
              {growthPct}%
            </label>
            <input
              type="range"
              min={-50}
              max={200}
              value={growthPct}
              onChange={(e) => setGrowthPct(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">−50% to +200% applied to daily demand (from salesLast30).</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Supplier delay (extra days): {delay}d
            </label>
            <input
              type="range"
              min={0}
              max={30}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">Added to average PO lead time per supplier (or default 7d).</p>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">Seasonal spike month</label>
            <select
              value={spikeMonth}
              onChange={(e) => setSpikeMonth(Number(e.target.value))}
              className="w-full h-10 rounded-lg border border-input bg-background px-3 text-sm"
            >
              {MONTHS.map((m, i) => (
                <option key={m} value={i}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground block mb-2">
              Spike multiplier: {spikeMult.toFixed(1)}×
            </label>
            <input
              type="range"
              min={100}
              max={500}
              value={Math.round(spikeMult * 100)}
              onChange={(e) => setSpikeMult(Number(e.target.value) / 100)}
              className="w-full accent-primary"
            />
            <p className="text-xs text-muted-foreground mt-1">1×–5× demand on days in the selected calendar month.</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          <Button type="button" onClick={() => setRan(true)} className="gap-2">
            <FlaskConical className="h-4 w-4" /> Run simulation
          </Button>
          <Button type="button" variant="outline" onClick={reset} className="gap-2">
            <RotateCcw className="h-4 w-4" /> Reset simulation
          </Button>
        </div>
      </div>

      {result && (
        <>
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Projected revenue at risk (unmet demand × price, 90d)</p>
              <p className="text-3xl font-display font-bold text-foreground tabular-nums mt-2">
                {formatCurrency(result.revenueAtRisk)}
              </p>
              <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">Simulation estimate only.</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" /> Products projected to stock out
              </p>
              <p className="text-3xl font-display font-bold text-foreground tabular-nums mt-2">
                {result.stockoutList.length}
              </p>
            </div>
          </div>

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">
              Projected stock — top 5 at-risk SKUs (simulation)
            </h3>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: 8,
                    }}
                  />
                  <Legend />
                  {result.top5AtRisk.map((p, i) => {
                    const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6'];
                    return (
                      <Line
                        key={p.productId}
                        type="monotone"
                        dataKey={`s_${p.productId}`}
                        stroke={colors[i % colors.length]}
                        dot={false}
                        strokeWidth={2}
                        name={p.productName}
                      />
                    );
                  })}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-display font-semibold text-foreground mb-3">Stockout timeline (simulated)</h3>
              <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {result.stockoutList.length === 0 && <li className="text-muted-foreground">No stockouts in 90d under this scenario.</li>}
                {result.stockoutList.map((s) => (
                  <li key={s.productName} className="flex justify-between border-b border-border/50 py-1">
                    <span className="text-foreground">{s.productName}</span>
                    <span className="text-destructive font-semibold tabular-nums">Day {s.stockoutDay}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="font-display font-semibold text-foreground mb-3">Preemptive PO suggestions (simulation)</h3>
              <ul className="space-y-2 text-sm max-h-64 overflow-y-auto">
                {result.preemptivePO.length === 0 && <li className="text-muted-foreground">No preemptive buys suggested.</li>}
                {result.preemptivePO.map((po) => (
                  <li key={po.productName} className="border-b border-border/50 py-2">
                    <p className="font-medium text-foreground">
                      {po.productName} — {po.quantity} units
                    </p>
                    <p className="text-xs text-muted-foreground">{po.rationale}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

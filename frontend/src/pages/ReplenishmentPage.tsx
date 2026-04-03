import React, { useState, useMemo, useEffect } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency } from '@/lib/mockData';
import {
  supplierLeadDaysMapFromPOs,
  computeOptimalROP,
  ropMinStockStatus,
  DEFAULT_SUPPLIER_LEAD_DAYS,
  SAFETY_STOCK_DAILY_MULTIPLIER,
} from '@/lib/reorderPointOptimizer';
import { generateHistory, forecastDemand, computeReplenishment, seasonalFactors, type ReplenishmentPlan } from '@/lib/manufacturingData';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Package,
  ChevronDown,
  ChevronUp,
  Calculator,
  SlidersHorizontal,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const trendIcon = { rising: TrendingUp, falling: TrendingDown, stable: Minus };
const urgencyStyles: Record<string, string> = {
  critical: 'bg-destructive/15 text-destructive border-destructive/30',
  soon: 'bg-warning/15 text-warning border-warning/30',
  planned: 'bg-primary/15 text-primary border-primary/30',
  adequate: 'bg-success/15 text-success border-success/30',
};

const ropStatusBadge: Record<
  ReturnType<typeof ropMinStockStatus>,
  { label: string; className: string }
> = {
  dangerously_low: {
    label: 'Dangerously Low',
    className: 'bg-destructive/15 text-destructive border-destructive/40',
  },
  needs_update: {
    label: 'Needs Update',
    className: 'bg-warning/15 text-warning border-warning/40',
  },
  good: { label: 'Good', className: 'bg-success/15 text-success border-success/40' },
};

export default function ReplenishmentPage() {
  const { products, purchaseOrders, setProducts, addLog } = useInventory();
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<'replenishment' | 'rop'>('replenishment');
  const [selectedProduct, setSelectedProduct] = useState(products[0]?.id || '');
  const [expandedCard, setExpandedCard] = useState<string | null>(null);

  const supplierLeadTimes = useMemo(() => supplierLeadDaysMapFromPOs(purchaseOrders), [purchaseOrders]);

  const ropRows = useMemo(
    () =>
      products.map((p) => {
        const breakdown = computeOptimalROP(p, supplierLeadTimes);
        const status = ropMinStockStatus(p.minStock, breakdown.optimalROP);
        const gap = breakdown.optimalROP - p.minStock;
        return { product: p, breakdown, status, gap };
      }),
    [products, supplierLeadTimes]
  );

  const applyAllROP = () => {
    setProducts((prev) =>
      prev.map((p) => {
        const { optimalROP } = computeOptimalROP(p, supplierLeadTimes);
        return { ...p, minStock: optimalROP };
      })
    );
    addLog(user?.name || 'System', 'ROP optimizer', 'Applied optimal reorder points (minStock) to all products');
  };

  useEffect(() => {
    if (products.length === 0) return;
    if (!selectedProduct || !products.some((p) => p.id === selectedProduct)) {
      setSelectedProduct(products[0]!.id);
    }
  }, [products, selectedProduct]);

  const product = products.find(p => p.id === selectedProduct) || products[0];
  const dailyRate = product ? product.salesLast30 / 30 : 0;
  const history = product ? generateHistory(dailyRate, product.category) : [];
  const forecast = product ? forecastDemand(history, product.category) : [];

  const chartData = [
    ...history.map(h => ({ month: h.month, actual: h.quantity, type: 'history' })),
    ...forecast.map(f => ({ month: f.month, predicted: f.predicted, lower: f.lower, upper: f.upper, type: 'forecast' })),
  ];

  const plans: ReplenishmentPlan[] = products.map(p => {
    const plan = computeReplenishment(p);
    const supplierLead = supplierLeadTimes.get(p.supplier);
    if (supplierLead != null) plan.leadTimeDays = supplierLead;
    return plan;
  }).sort((a, b) => {
    const order = { critical: 0, soon: 1, planned: 2, adequate: 3 };
    return order[a.urgency] - order[b.urgency];
  });

  const seasonalData = Object.entries(seasonalFactors).map(([cat, factors]) => {
    const currentMonth = 2;
    return { category: cat, current: factors[currentMonth], next: factors[(currentMonth + 1) % 12], peak: Math.max(...factors), peakMonth: ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][factors.indexOf(Math.max(...factors))] };
  });

  const summaryCards = [
    { id: 'critical', label: 'Critical', count: plans.filter(p => p.urgency === 'critical').length, icon: AlertTriangle, cls: 'text-destructive bg-destructive/10', items: plans.filter(p => p.urgency === 'critical') },
    { id: 'soon', label: 'Reorder Soon', count: plans.filter(p => p.urgency === 'soon').length, icon: Clock, cls: 'text-warning bg-warning/10', items: plans.filter(p => p.urgency === 'soon') },
    { id: 'planned', label: 'Planned', count: plans.filter(p => p.urgency === 'planned').length, icon: Package, cls: 'text-primary bg-primary/10', items: plans.filter(p => p.urgency === 'planned') },
    { id: 'adequate', label: 'Adequate', count: plans.filter(p => p.urgency === 'adequate').length, icon: ShieldCheck, cls: 'text-success bg-success/10', items: plans.filter(p => p.urgency === 'adequate') },
  ];

  const toggleCard = (id: string) => setExpandedCard(expandedCard === id ? null : id);

  return (
    <TooltipProvider delayDuration={200}>
    <div className="space-y-6 animate-fade-in">
      <div className="gradient-primary rounded-xl p-6 flex items-center gap-4">
        <RefreshCw className="h-10 w-10 text-primary-foreground" />
        <div><h2 className="text-xl font-display font-bold text-primary-foreground">Intelligent Replenishment</h2><p className="text-primary-foreground/70 text-sm">Advanced demand forecasting with supplier lead time learning</p></div>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: 'replenishment' as const, label: 'Forecast & plans', icon: RefreshCw },
          { id: 'rop' as const, label: 'ROP Optimizer', icon: SlidersHorizontal },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${
                mainTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {mainTab === 'rop' && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-primary" />
                Reorder point optimizer
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Optimal ROP = (avg daily demand × lead time) + safety stock, with safety stock = avg daily × {SAFETY_STOCK_DAILY_MULTIPLIER}. Avg daily = salesLast30 ÷ 30. Lead time = supplier average from completed POs or {DEFAULT_SUPPLIER_LEAD_DAYS} days if none.
              </p>
            </div>
            <Button
              type="button"
              onClick={applyAllROP}
              disabled={products.length === 0}
              className="shrink-0"
            >
              Apply all recommendations
            </Button>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-12 px-4">No products to optimize.</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Product</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Current min stock</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Optimal ROP</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Gap</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {ropRows.map(({ product: p, breakdown: b, status, gap }) => {
                  const leadSource = supplierLeadTimes.has(p.supplier) ? 'PO history avg' : `default ${DEFAULT_SUPPLIER_LEAD_DAYS}d`;
                  const badge = ropStatusBadge[status];
                  return (
                    <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{p.name}</span>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                type="button"
                                className="text-muted-foreground hover:text-foreground rounded p-0.5"
                                aria-label="ROP calculation details"
                              >
                                <Info className="h-4 w-4" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="right" className="max-w-sm text-xs space-y-1.5 p-3">
                              <p className="font-semibold text-foreground">How this ROP was calculated</p>
                              <p className="text-muted-foreground">
                                <span className="font-medium text-foreground">ROP</span> = (avg daily × lead days) + safety stock
                              </p>
                              <p className="font-mono text-[11px] leading-relaxed text-foreground">
                                = ({b.avgDailyDemand.toFixed(4)} × {b.leadTimeDays}) + {b.safetyStock.toFixed(4)}
                                <br />
                                = {b.rawROP.toFixed(4)} → ceil → <span className="font-semibold">{b.optimalROP}</span>
                              </p>
                              <p className="text-muted-foreground border-t border-border pt-1.5 mt-1.5">
                                Avg daily = {p.salesLast30} ÷ 30 = {b.avgDailyDemand.toFixed(4)}<br />
                                Lead ({p.supplier}): {b.leadTimeDays}d ({leadSource})<br />
                                Safety = avg daily × {SAFETY_STOCK_DAILY_MULTIPLIER} = {b.safetyStock.toFixed(4)}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{p.supplier}</p>
                      </td>
                      <td className="px-4 py-3 text-sm text-center tabular-nums text-foreground">{p.minStock}</td>
                      <td className="px-4 py-3 text-sm text-center tabular-nums font-semibold text-foreground">{b.optimalROP}</td>
                      <td className={`px-4 py-3 text-sm text-center tabular-nums font-medium ${gap > 0 ? 'text-warning' : gap < 0 ? 'text-muted-foreground' : 'text-foreground'}`}>
                        {gap > 0 ? `+${gap}` : gap}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${badge.className}`}>
                          {badge.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          )}
        </div>
      )}

      {mainTab === 'replenishment' && (
      <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        {summaryCards.map(c => {
          const Icon = c.icon; const isOpen = expandedCard === c.id;
          return (
            <div key={c.id}>
              <div className="stat-card flex items-center gap-4 cursor-pointer" onClick={() => toggleCard(c.id)}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.cls}`}><Icon className="h-6 w-6" /></div>
                <div className="flex-1"><p className="text-2xl font-display font-bold text-foreground">{c.count}</p><p className="text-xs text-muted-foreground">{c.label}</p></div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {isOpen && (
                <div className="mt-2 bg-card border border-border rounded-xl p-4 space-y-2 animate-fade-in">
                  {c.items.length > 0 ? c.items.map(p => (
                    <div key={p.productId} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                      <div><p className="text-sm font-medium text-foreground">{p.productName}</p><p className="text-xs text-muted-foreground">Stock: {p.currentStock} · Reorder: {p.reorderPoint} · Lead: {p.leadTimeDays}d</p></div>
                      <div className="text-right"><p className="text-sm font-semibold text-foreground">EOQ: {p.economicOrderQty}</p><p className="text-xs text-muted-foreground">{formatCurrency(p.estimatedCost)}</p></div>
                    </div>
                  )) : <p className="text-sm text-muted-foreground text-center py-2">No items</p>}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h3 className="font-display font-semibold text-foreground">Demand Forecast (6-Month Projection)</h3>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="px-3 py-2 rounded-lg bg-secondary border border-border text-foreground text-sm">
            {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
            <RechartsTooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 8, color: 'hsl(var(--foreground))' }} />
            <Legend />
            <Area type="monotone" dataKey="actual" stroke="hsl(var(--primary))" fill="hsl(var(--primary) / 0.3)" name="Actual Sales" strokeWidth={2} />
            <Area type="monotone" dataKey="upper" stroke="none" fill="hsl(var(--accent) / 0.15)" name="Upper Bound" />
            <Area type="monotone" dataKey="predicted" stroke="hsl(var(--accent-foreground))" fill="hsl(var(--accent) / 0.3)" name="Predicted" strokeWidth={2} strokeDasharray="6 3" />
            <Area type="monotone" dataKey="lower" stroke="none" fill="hsl(var(--accent) / 0.08)" name="Lower Bound" />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-foreground mb-4">Seasonal Demand Index by Category</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Category</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Current (Mar)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Next (Apr)</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Trend</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Peak Month</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Peak Factor</th>
            </tr></thead>
            <tbody>{seasonalData.map(s => {
              const trendDir = s.next > s.current * 1.05 ? 'rising' : s.next < s.current * 0.95 ? 'falling' : 'stable';
              const TIcon = trendIcon[trendDir];
              const trendColor = trendDir === 'rising' ? 'text-success' : trendDir === 'falling' ? 'text-destructive' : 'text-muted-foreground';
              return (
                <tr key={s.category} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{s.category}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{s.current.toFixed(1)}x</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{s.next.toFixed(1)}x</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 text-sm ${trendColor}`}><TIcon className="h-4 w-4" /> {trendDir}</span></td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-foreground">{s.peakMonth}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{s.peak.toFixed(1)}x</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h3 className="font-display font-semibold text-foreground">Auto-Replenishment Plans</h3></div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead><tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Product</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Urgency</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Stock</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Reorder Pt</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Safety</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">EOQ</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Lead Time</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Next Order</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Trend</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Est. Cost</th>
            </tr></thead>
            <tbody>{plans.map(p => {
              const TIcon = trendIcon[p.seasonalTrend];
              const trendColor = p.seasonalTrend === 'rising' ? 'text-success' : p.seasonalTrend === 'falling' ? 'text-destructive' : 'text-muted-foreground';
              return (
                <tr key={p.productId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{p.productName}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold border ${urgencyStyles[p.urgency]}`}>{p.urgency}</span></td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.currentStock}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.reorderPoint}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.safetyStock}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-foreground">{p.economicOrderQty}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.leadTimeDays}d</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.nextOrderDate}</td>
                  <td className="px-4 py-3 text-center"><span className={`inline-flex items-center gap-1 text-sm ${trendColor}`}><TIcon className="h-4 w-4" /></span></td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{formatCurrency(p.estimatedCost)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      </div>
      </>
      )}
    </div>
    </TooltipProvider>
  );
}

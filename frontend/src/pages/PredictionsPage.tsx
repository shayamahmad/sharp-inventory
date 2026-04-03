import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { isApiConfigured, getToken } from '@/lib/api';
import { formatCurrency, predictDaysUntilStockout, getStockStatus, type Product } from '@/lib/mockData';
import { build30DayDemandForecast } from '@/lib/demandForecast';
import {
  Brain,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Clock,
  ChevronDown,
  ChevronUp,
  LineChart as LineChartIcon,
  Info,
  RefreshCw,
  ArrowRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

type PredictionRow = Product & {
  daysLeft: number | null;
  status: ReturnType<typeof getStockStatus>;
  dailyRate: number;
  restockRecommendation: number;
  reasoning: string;
  leadTime: number;
  salesLast30N: number;
};

function num(n: unknown, fallback = 0): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}

function truncateReason(s: string, max = 80): string {
  const t = s.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max).trim()}…`;
}

/** Primary restock bucket for UI tags (order matches section priority for labels). */
function restockBucket(p: PredictionRow): 'urgent' | 'warning' | 'dead' | 'high' | null {
  if (p.daysLeft !== null && p.daysLeft <= 7) return 'urgent';
  if (p.daysLeft !== null && p.daysLeft > 7 && p.daysLeft <= 21) return 'warning';
  if (p.salesLast30N <= 3) return 'dead';
  if (p.salesLast30N > 80) return 'high';
  return null;
}

function forecastOptionLabel(p: Product, row: PredictionRow | undefined): string {
  if (!row) return p.name;
  const b = restockBucket(row);
  const tag =
    b === 'urgent' ? ' [Urgent]' : b === 'warning' ? ' [Warning]' : b === 'dead' ? ' [Dead]' : b === 'high' ? ' [Hot]' : '';
  const cover = row.daysLeft != null ? ` ${row.daysLeft}d` : '';
  return `${p.name}${tag}${cover ? ` ·${cover}` : ''}`;
}

export default function PredictionsPage() {
  const { products, purchaseOrders, refreshInventory, inventoryHydrating } = useInventory();
  const canPullServer = isApiConfigured() && !!getToken();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [mainTab, setMainTab] = useState<'restock' | 'forecast'>('restock');
  const [forecastProductId, setForecastProductId] = useState<string>(() => products[0]?.id ?? '');

  const dayMs = 86_400_000;

  // Supplier lead time calculation (skip invalid dates so averages stay finite)
  const supplierLeadTimes = useMemo(() => {
    const map = new Map<string, number>();
    const suppliers = [...new Set(purchaseOrders.map((po) => po.supplier).filter(Boolean))];
    suppliers.forEach((supplier) => {
      const completed = purchaseOrders.filter((po) => po.supplier === supplier && po.dateSent && po.dateReceived);
      let sum = 0;
      let n = 0;
      for (const po of completed) {
        const t0 = new Date(po.dateSent!).getTime();
        const t1 = new Date(po.dateReceived!).getTime();
        if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) continue;
        sum += Math.ceil((t1 - t0) / dayMs);
        n++;
      }
      if (n > 0) map.set(supplier, Math.round(sum / n));
    });
    return map;
  }, [purchaseOrders]);

  const predictions: PredictionRow[] = useMemo(() => {
    return products
      .map((p) => {
        const salesLast30N = num(p.salesLast30, 0);
        const stockN = num(p.stock, 0);
        const costN = num(p.cost, 0);
        const minStockN = num(p.minStock, 0);
        const safeP: Product = { ...p, salesLast30: salesLast30N, stock: stockN, cost: costN, minStock: minStockN };

        const daysLeft = predictDaysUntilStockout(safeP);
        const dailyRate = salesLast30N / 30;
        const restockRecommendation =
          dailyRate > 0 ? Math.max(0, Math.ceil(dailyRate * 30 * 1.2)) : Math.max(0, Math.ceil(minStockN * 1.2));

        const supplierLead = p.supplier ? supplierLeadTimes.get(p.supplier) : undefined;
        const leadTime = supplierLead != null && Number.isFinite(supplierLead) && supplierLead > 0 ? supplierLead : 7;

        let reasoning = '';
        if (dailyRate > 0 && daysLeft != null) {
          const stockoutDate = new Date();
          stockoutDate.setDate(stockoutDate.getDate() + daysLeft);
          reasoning = `Sales velocity is ${dailyRate.toFixed(1)} units/day, current stock will last ${daysLeft} days${supplierLead ? ` (supplier avg lead time: ${supplierLead}d)` : ''}, and minimum stock threshold is ${minStockN} — restock recommended before ${stockoutDate.toLocaleDateString('en-IN')}.`;
        } else if (dailyRate > 0 && daysLeft == null) {
          reasoning = `Sales velocity is ${dailyRate.toFixed(1)} units/day; could not estimate days of cover (check stock and sales fields).`;
        } else {
          reasoning = `No sales recorded in the last 30 days. Consider discounting or discontinuing this product.`;
        }

        return {
          ...p,
          salesLast30: salesLast30N,
          stock: stockN,
          cost: costN,
          minStock: minStockN,
          daysLeft,
          status: getStockStatus(safeP),
          dailyRate,
          restockRecommendation,
          reasoning,
          leadTime,
          salesLast30N,
        };
      })
      .sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));
  }, [products, supplierLeadTimes]);

  const urgentItems = predictions.filter((p) => p.daysLeft !== null && p.daysLeft <= 7);
  const warningItems = predictions.filter((p) => p.daysLeft !== null && p.daysLeft > 7 && p.daysLeft <= 21);
  const deadStock = predictions.filter((p) => p.salesLast30N <= 3);
  const highDemand = predictions.filter((p) => p.salesLast30N > 80);

  const predictionById = useMemo(() => new Map(predictions.map((r) => [r.id, r])), [predictions]);

  const toggleSection = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  /** Snapshot primitives so forecasts recompute when Mongo/API updates stock or sales (not just object identity). */
  const forecastProductSnapshot = useMemo(() => {
    const p = products.find((x) => x.id === forecastProductId) ?? products[0];
    if (!p) return null;
    return {
      id: p.id,
      salesLast30: num(p.salesLast30, 0),
      stock: num(p.stock, 0),
    };
  }, [products, forecastProductId]);

  const demandForecast = useMemo(() => {
    if (!forecastProductSnapshot) return null;
    return build30DayDemandForecast(
      forecastProductSnapshot.salesLast30,
      forecastProductSnapshot.id,
      undefined,
      forecastProductSnapshot.stock
    );
  }, [forecastProductSnapshot]);

  const forecastChartRevision = forecastProductSnapshot
    ? `${forecastProductSnapshot.id}:${forecastProductSnapshot.salesLast30}:${forecastProductSnapshot.stock}`
    : 'none';

  const selectedPrediction = forecastProductId ? predictionById.get(forecastProductId) : undefined;

  const stockChartKey = useMemo(() => {
    const tl = demandForecast?.stockTimeline;
    if (!tl?.length) return `empty-${forecastChartRevision}`;
    return `${forecastChartRevision}|${tl.map((r) => `${r.label}:${r.stock}`).join('|')}`;
  }, [demandForecast?.stockTimeline, forecastChartRevision]);

  const demandChartKey = useMemo(() => {
    const rows = demandForecast?.chartRows;
    if (!rows?.length) return `empty-${forecastChartRevision}`;
    return `${forecastChartRevision}|${rows.map((r) => `${r.day}:${r.predicted}`).join('|')}`;
  }, [demandForecast?.chartRows, forecastChartRevision]);

  React.useEffect(() => {
    if (products.length === 0) return;
    if (!forecastProductId || !products.some((p) => p.id === forecastProductId)) {
      setForecastProductId(products[0]!.id);
    }
  }, [products, forecastProductId]);

  const sections = [
    { id: 'urgent', label: 'Urgent Restock', count: urgentItems.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', items: urgentItems },
    { id: 'warning', label: 'Warning', count: warningItems.length, icon: Clock, color: 'text-warning', bg: 'bg-warning/10', items: warningItems },
    { id: 'dead', label: 'Dead Stock', count: deadStock.length, icon: TrendingDown, color: 'text-muted-foreground', bg: 'bg-muted', items: deadStock },
    { id: 'high', label: 'High Demand', count: highDemand.length, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', items: highDemand },
  ];

  return (
    <TooltipProvider>
    <div className="space-y-6 animate-fade-in">
      <div className="gradient-primary flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-center sm:gap-4 sm:p-6">
        <Brain className="h-10 w-10 shrink-0 text-primary-foreground" />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-xl font-bold text-primary-foreground">AI Stock Predictions</h2>
          <p className="text-sm text-primary-foreground/70">
            Restock insights and demand forecast use the same live product list and salesLast30 / stock from your workspace.
          </p>
        </div>
        {canPullServer && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="shrink-0 gap-2 border-0 bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
            disabled={inventoryHydrating}
            onClick={() => void refreshInventory()}
          >
            <RefreshCw className={`h-4 w-4 ${inventoryHydrating ? 'animate-spin' : ''}`} />
            Sync data
          </Button>
        )}
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {[
          { id: 'restock' as const, label: 'Restock insights', icon: Brain },
          { id: 'forecast' as const, label: 'Forecast', icon: LineChartIcon },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMainTab(tab.id)}
              className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors sm:px-4 sm:py-3 ${
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

      {products.length > 0 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-secondary/25 px-3 py-3 text-xs sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-4 sm:gap-y-1 sm:text-sm">
          <span className="font-semibold text-foreground">Linked snapshot</span>
          <span className="text-muted-foreground">
            Urgent <strong className="text-destructive">{urgentItems.length}</strong>
            <span className="mx-1.5 text-border">·</span>
            Warning <strong className="text-warning">{warningItems.length}</strong>
            <span className="mx-1.5 text-border">·</span>
            Dead <strong>{deadStock.length}</strong>
            <span className="mx-1.5 text-border">·</span>
            High demand <strong className="text-success">{highDemand.length}</strong>
          </span>
          <span className="hidden h-4 w-px bg-border sm:block" aria-hidden />
          <span className="text-muted-foreground">
            Forecast SKU:{' '}
            <strong className="text-foreground">{products.find((x) => x.id === forecastProductId)?.name ?? '—'}</strong>
            {selectedPrediction && (
              <>
                {' '}
                · {(Number.isFinite(selectedPrediction.dailyRate) ? selectedPrediction.dailyRate : 0).toFixed(1)}/day
                {selectedPrediction.daysLeft != null ? ` · ${selectedPrediction.daysLeft}d cover` : ' · No velocity'}
                {restockBucket(selectedPrediction) && (
                  <span className="ml-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    {restockBucket(selectedPrediction) === 'urgent'
                      ? 'Urgent'
                      : restockBucket(selectedPrediction) === 'warning'
                        ? 'Warning'
                        : restockBucket(selectedPrediction) === 'dead'
                          ? 'Dead stock'
                          : 'High demand'}
                  </span>
                )}
              </>
            )}
          </span>
        </div>
      )}

      {mainTab === 'forecast' && (
        <div className="space-y-5 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 font-display font-semibold text-foreground">
                <LineChartIcon className="h-5 w-5 shrink-0 text-primary" />
                AI demand forecast (30 days)
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Same <span className="text-foreground">stock</span> and <span className="text-foreground">salesLast30</span> as
                Restock insights. Charts refresh when you sync data or edit products.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-1 sm:min-w-[220px]">
              <label htmlFor="forecast-product" className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Product
              </label>
              <select
                id="forecast-product"
                value={forecastProductId}
                onChange={(e) => setForecastProductId(e.target.value)}
                className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground"
                disabled={products.length === 0}
              >
                {products.length === 0 ? (
                  <option value="">No products</option>
                ) : (
                  products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {forecastOptionLabel(p, predictionById.get(p.id))}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {urgentItems.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>Quick focus:</span>
              {urgentItems.slice(0, 3).map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`rounded-full border px-2 py-1 font-medium transition-colors ${
                    forecastProductId === u.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:bg-secondary'
                  }`}
                  onClick={() => setForecastProductId(u.id)}
                >
                  {u.name} ({u.daysLeft}d)
                </button>
              ))}
            </div>
          )}

          {selectedPrediction && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-sm">
              <p className="font-medium text-foreground">Restock context for this SKU</p>
              <p className="mt-1 text-muted-foreground">
                Lead time <strong className="text-foreground">{selectedPrediction.leadTime}d</strong>
                <span className="mx-2">·</span>
                Suggested reorder qty <strong className="text-foreground">{selectedPrediction.restockRecommendation}</strong>
                <span className="mx-2">·</span>
                Status <strong className="text-foreground">{selectedPrediction.status}</strong>
              </p>
              <p className="mt-2 text-xs italic text-muted-foreground">{truncateReason(selectedPrediction.reasoning, 160)}</p>
            </div>
          )}

          {products.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/30 py-16 text-center text-sm text-muted-foreground">
              Add products to see demand forecasts.
            </div>
          ) : demandForecast && (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-secondary/40 border border-border px-4 py-3">
                <span className="text-sm font-medium text-foreground">Forecast accuracy</span>
                <span className="text-2xl font-display font-bold text-primary tabular-nums">
                  {demandForecast.hasSignal ? `${demandForecast.accuracyPct}%` : '—'}
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button type="button" className="text-muted-foreground hover:text-foreground p-1 rounded" aria-label="How accuracy is calculated">
                      <Info className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs">
                    Compares total predicted vs actual daily demand over the latter half of the 30-day history window used to fit the model (one-step-ahead SES).
                  </TooltipContent>
                </Tooltip>
                {!demandForecast.hasSignal && (
                  <span className="text-xs text-muted-foreground">No sales in the last 30 days — forecast is flat at zero.</span>
                )}
              </div>

              {demandForecast.stockTimeline && demandForecast.stockTimeline.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-foreground">On-hand stock (reconstructed past → projected future)</h4>
                  <div className="h-[260px] w-full min-h-[220px]">
                    <ResponsiveContainer key={`st-${stockChartKey}`} width="100%" height="100%">
                      <LineChart data={demandForecast.stockTimeline} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={9} interval={4} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                        <RechartsTooltip
                          contentStyle={{
                            background: 'hsl(var(--card))',
                            border: '1px solid hsl(var(--border))',
                            borderRadius: '8px',
                            color: 'hsl(var(--foreground))',
                          }}
                          formatter={(value: number) => [value, 'Units on hand']}
                        />
                        <Line
                          type="monotone"
                          dataKey="stock"
                          name="stock"
                          stroke="hsl(var(--accent))"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              <div className="h-[320px] w-full min-h-[280px]">
                <h4 className="text-sm font-semibold text-foreground mb-2">Daily demand forecast (next 30 days)</h4>
                <ResponsiveContainer key={`dm-${demandChartKey}`} width="100%" height="100%">
                  <LineChart data={demandForecast.chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={4} />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickFormatter={(v) => (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : `${v}`)}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        background: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px',
                        color: 'hsl(var(--foreground))',
                      }}
                      formatter={(value: number, name: string) => [value.toFixed(2), name === 'predicted' ? 'Predicted demand' : name === 'upper' ? 'Upper bound' : 'Lower bound']}
                    />
                    <Legend
                      formatter={(value) =>
                        value === 'predicted' ? 'Predicted demand' : value === 'upper' ? 'Upper bound' : 'Lower bound'
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="predicted"
                      name="predicted"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2.5}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="upper"
                      name="upper"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="lower"
                      name="lower"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}

      {mainTab === 'restock' && (
      <>
      {products.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-muted/30 py-16 px-4 text-center text-sm text-muted-foreground">
          No products in inventory. Add products on the Products page (or sync from the API) to see restock insights.
        </div>
      ) : (
        <>
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {sections.map(s => {
          const Icon = s.icon;
          const isOpen = expandedSection === s.id;
          return (
            <div key={s.id}>
              <div className="stat-card flex items-center gap-4 cursor-pointer" onClick={() => toggleSection(s.id)}>
                <div className={`w-12 h-12 rounded-xl ${s.bg} flex items-center justify-center`}><Icon className={`h-6 w-6 ${s.color}`} /></div>
                <div className="flex-1"><p className="text-2xl font-display font-bold text-foreground">{s.count}</p><p className="text-xs text-muted-foreground">{s.label}</p></div>
                {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
              {isOpen && s.items.length > 0 && (
                <div className="mt-2 bg-card border border-border rounded-xl p-4 space-y-2 animate-fade-in">
                  {s.items.map(p => (
                    <div key={p.id} className="p-3 rounded-lg bg-secondary/50">
                      <div className="flex items-center justify-between">
                        <div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.category} · {p.stock} {p.unit} left</p></div>
                        <div className="text-right">
                          {s.id === 'dead' ? (
                            <><p className="text-sm font-semibold text-warning">{p.salesLast30N} sold/30d</p><p className="text-xs text-muted-foreground">{formatCurrency(Math.max(0, p.stock) * Math.max(0, num(p.cost, 0)))} tied up</p></>
                          ) : (
                            <><p className={`text-sm font-semibold ${s.id === 'urgent' ? 'text-destructive' : s.id === 'high' ? 'text-success' : 'text-warning'}`}>{p.daysLeft !== null ? `${p.daysLeft} days left` : 'No sales'}</p><p className="text-xs text-muted-foreground">{(Number.isFinite(p.dailyRate) ? p.dailyRate : 0).toFixed(1)}/day · Restock: {p.restockRecommendation}</p></>
                          )}
                        </div>
                      </div>
                      {/* AI Reasoning */}
                      <p className="mt-2 border-t border-border/50 pt-2 text-xs italic text-muted-foreground">
                        💡 {truncateReason(p.reasoning, 220)}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 gap-1 px-2 text-xs text-primary"
                        onClick={() => {
                          setForecastProductId(p.id);
                          setMainTab('forecast');
                        }}
                      >
                        Open in Forecast <ArrowRight className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              {isOpen && s.items.length === 0 && <div className="mt-2 bg-card border border-border rounded-xl p-4 text-center text-sm text-muted-foreground animate-fade-in">No items in this category</div>}
            </div>
          );
        })}
      </div>

      {/* Prediction Table */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-3 py-3 sm:px-5"><h3 className="font-display font-semibold text-foreground">Stock Prediction Details</h3></div>
        <div className="-mx-1 overflow-x-auto sm:mx-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Product</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Category</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Daily Rate</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Days Left</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Lead Time</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Restock Qty</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Cost</th>
              </tr>
            </thead>
            <tbody>
              {predictions.map(p => {
                const urgency = p.daysLeft === null ? 'text-muted-foreground' : p.daysLeft <= 7 ? 'text-destructive font-bold' : p.daysLeft <= 21 ? 'text-warning font-semibold' : 'text-success';
                return (
                  <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                    <td className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                      <p className="mt-0.5 text-xs italic text-muted-foreground">💡 {truncateReason(p.reasoning)}</p>
                      <Button
                        type="button"
                        variant="link"
                        className="mt-1 h-auto p-0 text-xs"
                        onClick={() => {
                          setForecastProductId(p.id);
                          setMainTab('forecast');
                        }}
                      >
                        Forecast view →
                      </Button>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{(Number.isFinite(p.dailyRate) ? p.dailyRate : 0).toFixed(1)}/day</td>
                    <td className={`px-4 py-3 text-sm text-center ${urgency}`}>{p.daysLeft === null ? 'No sales' : p.daysLeft === 0 ? 'OUT!' : `${p.daysLeft} days`}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.leadTime}d</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.restockRecommendation} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{formatCurrency(Math.max(0, p.restockRecommendation) * Math.max(0, num(p.cost, 0)))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dead Stock */}
      {deadStock.length > 0 && (
        <div className="bg-card border border-warning/30 rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingDown className="h-5 w-5 text-warning" /> Dead Stock Warning</h3>
          <p className="text-sm text-muted-foreground mb-3">These items have minimal or zero sales. Consider discounts or discontinuation.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {deadStock.map(p => (
              <div key={p.id} className="p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.salesLast30N} sold · {p.stock} in stock</p></div><span className="text-sm font-semibold text-warning">{formatCurrency(Math.max(0, p.stock) * Math.max(0, num(p.cost, 0)))} tied up</span></div>
                <p className="text-xs text-muted-foreground mt-2 italic">💡 {truncateReason(p.reasoning, 220)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
        </>
      )}
      </>
      )}
    </div>
    </TooltipProvider>
  );
}

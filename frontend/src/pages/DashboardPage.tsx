import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency, getStockStatus, predictDaysUntilStockout } from '@/lib/mockData';
import {
  buildMonthlySalesChartSeries,
  buildCategorySalesFromProducts,
  formatChartMonth,
} from '@/lib/aggregates';

const PIE_COLORS = [
  'hsl(262, 83%, 58%)',
  'hsl(173, 80%, 40%)',
  'hsl(43, 96%, 56%)',
  'hsl(0, 84%, 60%)',
  'hsl(199, 89%, 48%)',
  'hsl(280, 65%, 60%)',
  'hsl(24, 95%, 53%)',
  'hsl(142, 71%, 45%)',
];
import { TrendingUp, ShoppingCart, Package, AlertTriangle, ArrowUpRight, ArrowDownRight, X, Search, Zap } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { Input } from '@/components/ui/input';
import { processNLQuery } from '@/lib/nlQueryEngine';
import InventoryHealthScoreWidget from '@/components/InventoryHealthScoreWidget';

export default function DashboardPage() {
  const { products, orders, purchaseOrders } = useInventory();
  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [nlQuery, setNlQuery] = useState('');
  const [nlResult, setNlResult] = useState<ReturnType<typeof processNLQuery>>(null);

  const monthlySales = useMemo(
    () => buildMonthlySalesChartSeries(orders, products, 8),
    [orders, products]
  );

  const categorySales = useMemo(() => {
    return buildCategorySalesFromProducts(products).map((c, i) => ({
      ...c,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));
  }, [products]);

  const totalRevenue = monthlySales.reduce((s, m) => s + m.revenue, 0);
  const totalOrders = orders.length;
  const lowStockCount = products.filter(p => getStockStatus(p) !== 'ok').length;
  const totalProfit = monthlySales.reduce((s, m) => s + m.profit, 0);
  const topProducts = [...products].sort((a, b) => b.salesLast30 - a.salesLast30).slice(0, 5);
  const worstProducts = [...products].sort((a, b) => a.salesLast30 - b.salesLast30).slice(0, 5);
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayOrders = orders.filter((o) => o.date === todayStr);
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const summaryDateLabel = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Anomaly detection
  const anomalies: { label: string; description: string; severity: 'Warning' | 'Critical' }[] = [];
  // Zero sales products that previously had sales
  products.filter(p => p.salesLast30 === 0 && p.stock > 0).forEach(p => {
    anomalies.push({ label: p.name, description: 'Zero sales in last 30 days with stock available', severity: 'Warning' });
  });
  // Sales spikes >3x average
  const avgSales = products.length ? products.reduce((s, p) => s + p.salesLast30, 0) / products.length : 0;
  products.filter(p => p.salesLast30 > avgSales * 3).forEach(p => {
    anomalies.push({ label: p.name, description: `Sales spike: ${p.salesLast30} units (avg: ${avgSales.toFixed(0)})`, severity: 'Warning' });
  });
  // Supplier delivery discrepancy
  const supplierDiscrepancies = new Map<string, number>();
  purchaseOrders.filter(po => po.discrepancy).forEach(po => {
    supplierDiscrepancies.set(po.supplier, (supplierDiscrepancies.get(po.supplier) || 0) + 1);
  });
  supplierDiscrepancies.forEach((count, supplier) => {
    if (count >= 2) anomalies.push({ label: supplier, description: `${count} POs with delivery discrepancies`, severity: 'Critical' });
  });

  const handleNLSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nlQuery.trim()) return;
    const result = processNLQuery(nlQuery, products, orders);
    setNlResult(result);
  };

  const stats = [
    { id: 'revenue', label: 'Total Revenue', value: formatCurrency(totalRevenue), change: '+12.5%', up: true, icon: TrendingUp, color: 'text-primary' },
    { id: 'orders', label: 'Total Orders', value: totalOrders.toString(), change: '+8.2%', up: true, icon: ShoppingCart, color: 'text-accent' },
    { id: 'products', label: 'Products', value: products.length.toString(), change: `${lowStockCount} alerts`, up: false, icon: Package, color: 'text-info' },
    { id: 'profit', label: 'Net Profit', value: formatCurrency(totalProfit), change: '+15.3%', up: true, icon: TrendingUp, color: 'text-success' },
  ];

  const ordersByStatus = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => ({ status: s, count: orders.filter(o => o.status === s).length }));
  const productsByCategory = [...new Set(products.map(p => p.category))].map(cat => ({
    category: cat, count: products.filter(p => p.category === cat).length,
    totalStock: products.filter(p => p.category === cat).reduce((s, p) => s + p.stock, 0),
    totalValue: products.filter(p => p.category === cat).reduce((s, p) => s + p.stock * p.price, 0),
  }));

  const renderDetail = (id: string) => {
    if (id === 'revenue') return (
      <div className="space-y-3">
        <h4 className="font-display font-semibold text-foreground">Revenue Breakdown</h4>
        {monthlySales.map(m => (
          <div key={m.month} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm font-medium text-foreground">{m.month}</span>
            <div className="text-right"><p className="text-sm font-semibold text-foreground">{formatCurrency(m.revenue)}</p><p className="text-xs text-success">{formatCurrency(m.profit)} profit</p></div>
          </div>
        ))}
      </div>
    );
    if (id === 'orders') return (
      <div className="space-y-3">
        <h4 className="font-display font-semibold text-foreground">Orders by Status</h4>
        {ordersByStatus.map(o => (
          <div key={o.status} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm font-medium text-foreground">{o.status}</span><span className="text-sm font-bold text-foreground">{o.count}</span>
          </div>
        ))}
      </div>
    );
    if (id === 'products') return (
      <div className="space-y-3">
        <h4 className="font-display font-semibold text-foreground">Products by Category</h4>
        {productsByCategory.map(c => (
          <div key={c.category} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <div><p className="text-sm font-medium text-foreground">{c.category}</p><p className="text-xs text-muted-foreground">{c.count} products · {c.totalStock} units</p></div>
            <span className="text-sm font-semibold text-foreground">{formatCurrency(c.totalValue)}</span>
          </div>
        ))}
        <h4 className="font-display font-semibold text-foreground mt-4">⚠️ Stock Alerts</h4>
        {products.filter(p => getStockStatus(p) !== 'ok').map(p => (
          <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
            <div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div>
            <span className="text-sm font-bold text-destructive">{p.stock} left</span>
          </div>
        ))}
      </div>
    );
    if (id === 'profit') return (
      <div className="space-y-3">
        <h4 className="font-display font-semibold text-foreground">Monthly Profit</h4>
        {monthlySales.map(m => (
          <div key={m.month} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
            <span className="text-sm font-medium text-foreground">{m.month}</span>
            <div className="text-right"><p className="text-sm font-semibold text-success">{formatCurrency(m.profit)}</p><p className="text-xs text-muted-foreground">{m.revenue > 0 ? `${((m.profit / m.revenue) * 100).toFixed(1)}% margin` : '—'}</p></div>
          </div>
        ))}
      </div>
    );
    return null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <InventoryHealthScoreWidget />

      {/* NL Search */}
      <form onSubmit={handleNLSearch} className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input value={nlQuery} onChange={e => setNlQuery(e.target.value)}
          placeholder='Ask anything... e.g. "which products run out in 10 days?"'
          className="pl-12 h-12 text-base" />
        <Zap className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary" />
      </form>

      {nlResult && (
        <div className="bg-card border border-primary/20 rounded-xl p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display font-semibold text-foreground">{nlResult.title}</h3>
            <button onClick={() => setNlResult(null)} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button>
          </div>
          {nlResult.items.length > 0 ? (
            <div className="space-y-2">
              {nlResult.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div><p className="text-sm font-medium text-foreground">{item.label}</p>{item.sublabel && <p className="text-xs text-muted-foreground">{item.sublabel}</p>}</div>
                  <span className="text-sm font-semibold text-foreground">{item.value}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-muted-foreground">No results. Try: "top sellers", "low stock", "orders delivered"</p>}
        </div>
      )}

      {/* Daily Summary */}
      <div className="gradient-primary rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-primary-foreground/70 text-sm font-medium">Today&apos;s summary — {summaryDateLabel}</p>
          <p className="text-primary-foreground text-2xl font-display font-bold mt-1">{formatCurrency(todaySales)} in sales · {todayOrders.length} orders</p>
        </div>
        <div className="text-right">
          <p className="text-primary-foreground/70 text-sm">🏆 Top Product Today</p>
          <p className="text-primary-foreground font-semibold">{topProducts[0]?.name}</p>
        </div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(s => {
          const Icon = s.icon;
          const isExpanded = expandedCard === s.id;
          return (
            <div key={s.label}>
              <div className="stat-card cursor-pointer" onClick={() => setExpandedCard(isExpanded ? null : s.id)}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm text-muted-foreground font-medium">{s.label}</span>
                  <Icon className={`h-5 w-5 ${s.color}`} />
                </div>
                <p className="text-2xl font-display font-bold text-foreground">{s.value}</p>
                <div className="flex items-center gap-1 mt-1">
                  {s.up ? <ArrowUpRight className="h-3.5 w-3.5 text-success" /> : <AlertTriangle className="h-3.5 w-3.5 text-warning" />}
                  <span className={`text-xs font-medium ${s.up ? 'text-success' : 'text-warning'}`}>{s.change}</span>
                  <span className="text-xs text-primary ml-auto">Click for details ›</span>
                </div>
              </div>
              {isExpanded && (
                <div className="mt-2 bg-card border border-border rounded-xl p-4 animate-fade-in">
                  <div className="flex justify-end mb-2"><button onClick={(e) => { e.stopPropagation(); setExpandedCard(null); }} className="p-1 rounded hover:bg-secondary text-muted-foreground"><X className="h-4 w-4" /></button></div>
                  {renderDetail(s.id)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Anomalies Card */}
      {anomalies.length > 0 && (
        <div className="bg-card border border-warning/30 rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-3 flex items-center gap-2"><Zap className="h-5 w-5 text-warning" /> Anomalies Detected ({anomalies.length})</h3>
          <div className="space-y-2">
            {anomalies.slice(0, 6).map((a, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div><p className="text-sm font-medium text-foreground">{a.label}</p><p className="text-xs text-muted-foreground">{a.description}</p></div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.severity === 'Critical' ? 'bg-destructive/15 text-destructive' : 'bg-warning/15 text-warning'}`}>{a.severity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Revenue & Profit Trend</h3>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={monthlySales} margin={{ left: 4, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="month"
                stroke="hsl(var(--muted-foreground))"
                fontSize={11}
                tickFormatter={(v) => formatChartMonth(String(v))}
              />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
              <Legend />
              <Line type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} connectNulls name="Revenue" />
              <Line type="monotone" dataKey="profit" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} connectNulls name="Profit" />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4">Sales by Category</h3>
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie data={categorySales} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90} innerRadius={50} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                {categorySales.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
              </Pie>
              <Tooltip formatter={(v: number) => formatCurrency(v)} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top & Worst */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><ArrowUpRight className="h-5 w-5 text-success" /> Best Selling Products</h3>
          <div className="space-y-3">
            {topProducts.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3"><span className="text-lg font-bold text-primary w-6">#{i + 1}</span><div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div></div>
                <div className="text-right"><p className="text-sm font-semibold text-foreground">{p.salesLast30} sold</p><p className="text-xs text-success">{formatCurrency(p.salesLast30 * (p.price - p.cost))} profit</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="bg-card rounded-xl p-5 border border-border">
          <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2"><ArrowDownRight className="h-5 w-5 text-destructive" /> Worst Selling Products</h3>
          <div className="space-y-3">
            {worstProducts.map((p, i) => (
              <div key={p.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                <div className="flex items-center gap-3"><span className="text-lg font-bold text-destructive w-6">#{i + 1}</span><div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></div></div>
                <div className="text-right"><p className="text-sm font-semibold text-foreground">{p.salesLast30} sold</p><p className="text-xs text-muted-foreground">{formatCurrency(p.price)} / {p.unit}</p></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

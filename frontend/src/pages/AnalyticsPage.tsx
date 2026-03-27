import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency } from '@/lib/mockData';
import {
  buildMonthlySalesFromOrders,
  buildCategorySalesFromProducts,
  fallbackMonthlyFromProducts,
} from '@/lib/aggregates';

const PIE_COLORS = [
  'hsl(25, 95%, 53%)',
  'hsl(165, 70%, 42%)',
  'hsl(262, 60%, 55%)',
  'hsl(340, 75%, 55%)',
  'hsl(200, 80%, 50%)',
  'hsl(45, 93%, 47%)',
  'hsl(160, 40%, 50%)',
  'hsl(0, 60%, 55%)',
];
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, LineChart, Line, Legend } from 'recharts';

const datePresets = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
  { label: 'This Month', days: 30 },
  { label: 'Last Month', days: 60 },
  { label: 'This Quarter', days: 90 },
];

export default function AnalyticsPage() {
  const { products, orders } = useInventory();
  const [activeTab, setActiveTab] = useState<'overview' | 'aging' | 'heatmap' | 'trends'>('overview');
  const [dateRange, setDateRange] = useState(30);
  const [heatmapCatFilter, setHeatmapCatFilter] = useState('All');

  const monthlySales = useMemo(() => {
    const rows = buildMonthlySalesFromOrders(orders, products);
    if (rows.length === 0) return fallbackMonthlyFromProducts(products, orders.length);
    return rows.slice(-8);
  }, [orders, products]);

  const categoryRevenue = useMemo(
    () =>
      buildCategorySalesFromProducts(products).map((c, i) => ({
        ...c,
        fill: PIE_COLORS[i % PIE_COLORS.length],
      })),
    [products]
  );

  const profitByProduct = products.map(p => ({
    name: p.name.length > 15 ? p.name.slice(0, 15) + '…' : p.name,
    profit: (p.price - p.cost) * p.salesLast30,
    revenue: p.price * p.salesLast30,
  })).sort((a, b) => b.profit - a.profit);

  // Aging Report
  const agingData = useMemo(() => products.map(p => {
    const dailyRate = p.salesLast30 / 30;
    const dsi = dailyRate > 0 ? Math.round(p.stock / dailyRate) : 999;
    const agingStatus = dsi > 180 ? 'Dead Stock' : dsi > 90 ? 'Aging' : 'Healthy';
    return { ...p, dsi, agingStatus, inventoryValue: p.stock * p.cost };
  }).sort((a, b) => b.dsi - a.dsi), [products]);

  const totalAgingValue = agingData.filter(p => p.agingStatus === 'Aging').reduce((s, p) => s + p.inventoryValue, 0);
  const totalDeadValue = agingData.filter(p => p.agingStatus === 'Dead Stock').reduce((s, p) => s + p.inventoryValue, 0);

  // Margin Heatmap
  const heatmapData = useMemo(() => {
    return products.filter(p => heatmapCatFilter === 'All' || p.category === heatmapCatFilter).map(p => {
      const margin = p.price > 0 ? ((p.price - p.cost) / p.price) * 100 : 0;
      return { ...p, margin };
    }).sort((a, b) => b.margin - a.margin);
  }, [products, heatmapCatFilter]);

  const getMarginColor = (margin: number) => {
    if (margin >= 60) return 'bg-success/30 border-success/40';
    if (margin >= 40) return 'bg-success/15 border-success/25';
    if (margin >= 20) return 'bg-warning/15 border-warning/25';
    return 'bg-destructive/15 border-destructive/25';
  };

  // Cohort Trends (simulated weekly data by category)
  const categories = useMemo(() => [...new Set(products.map((p) => p.category))], [products]);
  const weeklyTrends = useMemo(() => {
    const weeks = Array.from({ length: 12 }, (_, i) => `W${i + 1}`);
    return weeks.map((week, wi) => {
      const entry: Record<string, string | number> = { week };
      categories.forEach((cat) => {
        const catProducts = products.filter((p) => p.category === cat);
        const base = catProducts.reduce((s, p) => s + p.salesLast30 / 4, 0);
        entry[cat] = Math.round(base * (0.8 + Math.random() * 0.4) * (1 + wi * 0.02));
      });
      return entry;
    });
  }, [products, categories]);

  const categoryColors = ['hsl(25, 95%, 53%)', 'hsl(165, 70%, 42%)', 'hsl(262, 60%, 55%)', 'hsl(340, 75%, 55%)', 'hsl(200, 80%, 50%)', 'hsl(45, 93%, 47%)', 'hsl(160, 40%, 50%)', 'hsl(0, 60%, 55%)'];

  // Fastest growing / declining
  const categoryGrowth = categories.map(cat => {
    const first = weeklyTrends[0]?.[cat] || 0;
    const last = weeklyTrends[weeklyTrends.length - 1]?.[cat] || 0;
    return { cat, growth: first > 0 ? ((last - first) / first) * 100 : 0 };
  });
  const fastest = categoryGrowth.sort((a, b) => b.growth - a.growth)[0];
  const declining = categoryGrowth.sort((a, b) => a.growth - b.growth)[0];

  const tabs = [
    { id: 'overview' as const, label: 'Overview' },
    { id: 'aging' as const, label: 'Aging Report' },
    { id: 'heatmap' as const, label: 'Margin Heatmap' },
    { id: 'trends' as const, label: 'Trends' },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Date Range Picker */}
      <div className="flex flex-wrap gap-2 items-center">
        <span className="text-sm text-muted-foreground mr-2">Date Range:</span>
        {datePresets.map(p => (
          <button key={p.label} onClick={() => setDateRange(p.days)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${dateRange === p.days ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground hover:text-foreground'}`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'overview' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="font-display font-semibold text-foreground mb-4">Monthly Revenue</h3>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={monthlySales}>
                  <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} /><stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                  <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revGrad)" strokeWidth={3} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="font-display font-semibold text-foreground mb-4">Category Revenue Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart><Pie data={categoryRevenue} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={55} paddingAngle={3}>{categoryRevenue.map((entry, i) => <Cell key={i} fill={entry.fill} />)}</Pie><Tooltip formatter={(v: number) => formatCurrency(v)} /></PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 mt-2 justify-center">
                {categoryRevenue.map(c => (<div key={c.name} className="flex items-center gap-1.5 text-xs text-muted-foreground"><div className="w-2.5 h-2.5 rounded-full" style={{ background: c.fill }} />{c.name}</div>))}
              </div>
            </div>
          </div>
          <div className="bg-card rounded-xl p-5 border border-border">
            <h3 className="font-display font-semibold text-foreground mb-4">Profit by Product (Last 30 Days)</h3>
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={profitByProduct} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} width={120} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Bar dataKey="profit" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} name="Profit" />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} name="Revenue" opacity={0.4} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      {activeTab === 'aging' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="stat-card"><p className="text-xs text-muted-foreground">Aging Inventory Value</p><p className="text-xl font-display font-bold text-warning">{formatCurrency(totalAgingValue)}</p><p className="text-xs text-muted-foreground">{agingData.filter(p => p.agingStatus === 'Aging').length} products</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Dead Stock Value</p><p className="text-xl font-display font-bold text-destructive">{formatCurrency(totalDeadValue)}</p><p className="text-xs text-muted-foreground">{agingData.filter(p => p.agingStatus === 'Dead Stock').length} products</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Healthy Products</p><p className="text-xl font-display font-bold text-success">{agingData.filter(p => p.agingStatus === 'Healthy').length}</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Product</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Daily Sales</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">DSI (Days)</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Inventory Value</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr></thead>
              <tbody>{agingData.map(p => (
                <tr key={p.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3"><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.category}</p></td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{p.stock} {p.unit}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{(p.salesLast30 / 30).toFixed(1)}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-foreground">{p.dsi >= 999 ? '∞' : p.dsi}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{formatCurrency(p.inventoryValue)}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.agingStatus === 'Dead Stock' ? 'bg-destructive/15 text-destructive' : p.agingStatus === 'Aging' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{p.agingStatus}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'heatmap' && (
        <div className="space-y-4">
          <div className="flex gap-2">
            <button onClick={() => setHeatmapCatFilter('All')} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${heatmapCatFilter === 'All' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>All</button>
            {categories.map(c => <button key={c} onClick={() => setHeatmapCatFilter(c)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${heatmapCatFilter === c ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'}`}>{c}</button>)}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {heatmapData.map(p => (
              <div key={p.id} className={`rounded-xl p-4 border cursor-pointer hover:shadow-md transition-all ${getMarginColor(p.margin)}`} title={`Revenue: ${formatCurrency(p.price)} | Cost: ${formatCurrency(p.cost)} | Margin: ${formatCurrency(p.price - p.cost)}`}>
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                <p className="text-2xl font-display font-bold text-foreground mt-1">{p.margin.toFixed(1)}%</p>
                <p className="text-xs text-muted-foreground">{p.category} · {formatCurrency(p.price - p.cost)}/unit</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            {fastest && <span className="text-xs px-3 py-1 rounded-full bg-success/15 text-success font-medium">🚀 Fastest Growing: {fastest.cat} (+{fastest.growth.toFixed(0)}%)</span>}
            {declining && declining.growth < 0 && <span className="text-xs px-3 py-1 rounded-full bg-destructive/15 text-destructive font-medium">📉 Declining: {declining.cat} ({declining.growth.toFixed(0)}%)</span>}
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Category Revenue Trends (Weekly)</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={weeklyTrends}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }} />
                <Legend />
                {categories.map((cat, i) => (
                  <Line key={cat} type="monotone" dataKey={cat} stroke={categoryColors[i % categoryColors.length]} strokeWidth={2} dot={false} name={cat} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

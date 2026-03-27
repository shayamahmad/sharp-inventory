import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency, predictDaysUntilStockout, getStockStatus } from '@/lib/mockData';
import { Brain, AlertTriangle, TrendingDown, TrendingUp, Clock, ChevronDown, ChevronUp } from 'lucide-react';

export default function PredictionsPage() {
  const { products, purchaseOrders } = useInventory();
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  // Supplier lead time calculation
  const supplierLeadTimes = useMemo(() => {
    const map = new Map<string, number>();
    const suppliers = [...new Set(purchaseOrders.map(po => po.supplier))];
    suppliers.forEach(supplier => {
      const completed = purchaseOrders.filter(po => po.supplier === supplier && po.dateSent && po.dateReceived);
      if (completed.length > 0) {
        const avg = completed.reduce((sum, po) => {
          return sum + Math.ceil((new Date(po.dateReceived!).getTime() - new Date(po.dateSent!).getTime()) / (1000 * 60 * 60 * 24));
        }, 0) / completed.length;
        map.set(supplier, Math.round(avg));
      }
    });
    return map;
  }, [purchaseOrders]);

  const predictions = products.map(p => {
    const daysLeft = predictDaysUntilStockout(p);
    const dailyRate = p.salesLast30 / 30;
    const restockRecommendation = Math.ceil(dailyRate * 30 * 1.2);
    const supplierLead = supplierLeadTimes.get(p.supplier);
    const leadTime = supplierLead || 7; // Use supplier avg or default

    // AI Reasoning sentence
    let reasoning = '';
    if (dailyRate > 0) {
      const stockoutDate = new Date();
      stockoutDate.setDate(stockoutDate.getDate() + (daysLeft || 0));
      reasoning = `Sales velocity is ${dailyRate.toFixed(1)} units/day, current stock will last ${daysLeft ?? '∞'} days${supplierLead ? ` (supplier avg lead time: ${supplierLead}d)` : ''}, and minimum stock threshold is ${p.minStock} — restock recommended before ${stockoutDate.toLocaleDateString('en-IN')}.`;
    } else {
      reasoning = `No sales recorded in the last 30 days. Consider discounting or discontinuing this product.`;
    }

    return { ...p, daysLeft, status: getStockStatus(p), dailyRate, restockRecommendation, reasoning, leadTime };
  }).sort((a, b) => (a.daysLeft ?? 999) - (b.daysLeft ?? 999));

  const urgentItems = predictions.filter(p => p.daysLeft !== null && p.daysLeft <= 7);
  const warningItems = predictions.filter(p => p.daysLeft !== null && p.daysLeft > 7 && p.daysLeft <= 21);
  const deadStock = predictions.filter(p => p.salesLast30 <= 3);
  const highDemand = predictions.filter(p => p.salesLast30 > 80);

  const toggleSection = (id: string) => setExpandedSection(expandedSection === id ? null : id);

  const sections = [
    { id: 'urgent', label: 'Urgent Restock', count: urgentItems.length, icon: AlertTriangle, color: 'text-destructive', bg: 'bg-destructive/10', items: urgentItems },
    { id: 'warning', label: 'Warning', count: warningItems.length, icon: Clock, color: 'text-warning', bg: 'bg-warning/10', items: warningItems },
    { id: 'dead', label: 'Dead Stock', count: deadStock.length, icon: TrendingDown, color: 'text-muted-foreground', bg: 'bg-muted', items: deadStock },
    { id: 'high', label: 'High Demand', count: highDemand.length, icon: TrendingUp, color: 'text-success', bg: 'bg-success/10', items: highDemand },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="gradient-primary rounded-xl p-6 flex items-center gap-4">
        <Brain className="h-10 w-10 text-primary-foreground" />
        <div>
          <h2 className="text-xl font-display font-bold text-primary-foreground">AI Stock Predictions</h2>
          <p className="text-primary-foreground/70 text-sm">Based on 30-day sales velocity + supplier lead time data</p>
        </div>
      </div>

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
                            <><p className="text-sm font-semibold text-warning">{p.salesLast30} sold/30d</p><p className="text-xs text-muted-foreground">{formatCurrency(p.stock * p.cost)} tied up</p></>
                          ) : (
                            <><p className={`text-sm font-semibold ${s.id === 'urgent' ? 'text-destructive' : s.id === 'high' ? 'text-success' : 'text-warning'}`}>{p.daysLeft !== null ? `${p.daysLeft} days left` : 'No sales'}</p><p className="text-xs text-muted-foreground">{p.dailyRate.toFixed(1)}/day · Restock: {p.restockRecommendation}</p></>
                          )}
                        </div>
                      </div>
                      {/* AI Reasoning */}
                      <p className="text-xs text-muted-foreground mt-2 italic border-t border-border/50 pt-2">💡 {p.reasoning}</p>
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
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border"><h3 className="font-display font-semibold text-foreground">Stock Prediction Details</h3></div>
        <div className="overflow-x-auto">
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
                      <p className="text-xs text-muted-foreground italic mt-0.5">💡 {p.reasoning.slice(0, 80)}...</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{p.category}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.stock} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.dailyRate.toFixed(1)}/day</td>
                    <td className={`px-4 py-3 text-sm text-center ${urgency}`}>{p.daysLeft === null ? 'No sales' : p.daysLeft === 0 ? 'OUT!' : `${p.daysLeft} days`}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.leadTime}d</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{p.restockRecommendation} {p.unit}</td>
                    <td className="px-4 py-3 text-sm text-center text-foreground">{formatCurrency(p.restockRecommendation * p.cost)}</td>
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
                <div className="flex items-center justify-between"><div><p className="text-sm font-medium text-foreground">{p.name}</p><p className="text-xs text-muted-foreground">{p.salesLast30} sold · {p.stock} in stock</p></div><span className="text-sm font-semibold text-warning">{formatCurrency(p.stock * p.cost)} tied up</span></div>
                <p className="text-xs text-muted-foreground mt-2 italic">💡 {p.reasoning}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

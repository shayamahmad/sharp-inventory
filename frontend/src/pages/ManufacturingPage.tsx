import React, { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency } from '@/lib/mockData';
import { analyzeBomProductionCost } from '@/lib/bomCostAnalysis';
import { isApiConfigured, getToken, apiJson } from '@/lib/api';
import { Factory, Layers, Boxes, ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Clock, Play, ClipboardCheck, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const statusStyles: Record<string, string> = { Planned: 'bg-muted text-muted-foreground', 'In Progress': 'bg-primary/15 text-primary', 'Quality Check': 'bg-warning/15 text-warning', Completed: 'bg-success/15 text-success' };
const priorityStyles: Record<string, string> = { Low: 'text-muted-foreground', Medium: 'text-foreground', High: 'text-warning font-semibold', Urgent: 'text-destructive font-bold' };
const statusIcons: Record<string, React.ElementType> = { Planned: Clock, 'In Progress': Play, 'Quality Check': AlertTriangle, Completed: CheckCircle };

const qcItems = ['Visual Inspection', 'Dimensions Check', 'Weight Check', 'Packaging', 'Labelling'];

export default function ManufacturingPage() {
  const {
    addLog,
    qcChecklists,
    setQCChecklists,
    rawMaterials,
    setRawMaterials,
    billsOfMaterials,
    productionOrders,
    setProductionOrders,
    products,
  } = useInventory();
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'production' | 'bom' | 'materials' | 'forecast'>('production');
  const [expandedBOM, setExpandedBOM] = useState<string | null>(null);
  const [showQC, setShowQC] = useState<string | null>(null);
  const [qcState, setQcState] = useState<{ name: string; passed: boolean | null; note: string }[]>([]);

  const lowStockMaterials = rawMaterials.filter(m => m.currentStock <= m.minStock);

  // Material Forecast
  const materialForecast = useMemo(() => {
    const activeProd = productionOrders.filter(o => o.status === 'Planned' || o.status === 'In Progress');
    const materialNeeds = new Map<string, { name: string; required: number; current: number; unit: string }>();
    activeProd.forEach(order => {
      const bom = billsOfMaterials.find(b => b.productId === order.productId);
      if (!bom) return;
      bom.materials.forEach(m => {
        const existing = materialNeeds.get(m.materialId) || { name: m.materialName, required: 0, current: m.currentStock, unit: m.unit };
        existing.required += m.quantityPerUnit * order.batchSize;
        materialNeeds.set(m.materialId, existing);
      });
    });
    return Array.from(materialNeeds.entries()).map(([id, data]) => ({
      id, ...data, shortfall: Math.max(0, data.required - data.current),
      status: data.current >= data.required ? 'OK' : data.current >= data.required * 0.5 ? 'Low' : 'Critical',
    }));
  }, [productionOrders, billsOfMaterials]);

  const openQC = (orderId: string) => {
    const existing = qcChecklists.find(q => q.productionOrderId === orderId);
    setQcState(existing ? [...existing.items] : qcItems.map(name => ({ name, passed: null, note: '' })));
    setShowQC(orderId);
  };

  const commitMaterialUnitCost = (materialId: string, value: string) => {
    const v = Number(value);
    if (!Number.isFinite(v) || v < 0) return;
    const prevRow = rawMaterials.find((r) => r.materialId === materialId);
    if (!prevRow || prevRow.costPerUnit === v) return;
    setRawMaterials((prev) => prev.map((x) => (x.materialId === materialId ? { ...x, costPerUnit: v } : x)));
    if (isApiConfigured() && getToken()) {
      void apiJson('PATCH', `/api/raw-materials/${encodeURIComponent(materialId)}`, { costPerUnit: v }).catch((err) =>
        console.error('Raw material PATCH', err)
      );
    }
    addLog(user?.name || 'System', 'Raw material cost', `${prevRow.materialName}: ${formatCurrency(prevRow.costPerUnit)} → ${formatCurrency(v)}`);
  };

  const submitQC = () => {
    if (!showQC) return;
    const allPassed = qcState.every(i => i.passed === true);
    setQCChecklists(prev => {
      const filtered = prev.filter(q => q.productionOrderId !== showQC);
      return [...filtered, { productionOrderId: showQC, items: qcState, completedBy: user?.name, completedAt: new Date().toISOString() }];
    });
    if (allPassed) {
      setProductionOrders(prev => prev.map(o => o.id === showQC ? { ...o, status: 'Completed' as const, completionPercent: 100 } : o));
      addLog(user?.name || 'System', 'QC Passed', `Production order ${showQC} passed QC and marked Completed`);
    } else {
      addLog(user?.name || 'System', 'QC Failed', `Production order ${showQC} has QC failures`);
    }
    setShowQC(null);
  };

  const tabs = [
    { id: 'production' as const, label: 'Production Planning', icon: Factory },
    { id: 'bom' as const, label: 'Bill of Materials', icon: Layers },
    { id: 'materials' as const, label: 'Raw Materials', icon: Boxes },
    { id: 'forecast' as const, label: 'Material Forecast', icon: TrendingUp },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="gradient-primary rounded-xl p-6 flex items-center gap-4">
        <Factory className="h-10 w-10 text-primary-foreground" />
        <div><h2 className="text-xl font-display font-bold text-primary-foreground">Manufacturing Hub</h2><p className="text-primary-foreground/70 text-sm">Production planning, BOM management & raw material tracking</p></div>
      </div>

      <div className="flex gap-2 border-b border-border pb-0">
        {tabs.map(tab => { const Icon = tab.icon; return (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <Icon className="h-4 w-4" />{tab.label}
          </button>
        ); })}
      </div>

      {activeTab === 'production' && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-semibold text-foreground mb-4">Production Timeline</h3>
            <div className="space-y-3">
              {productionOrders.filter(o => o.status !== 'Completed').map(order => {
                const SIcon = statusIcons[order.status];
                const qc = qcChecklists.find(q => q.productionOrderId === order.id);
                const qcPassed = qc && qc.items.every(i => i.passed === true);
                const qcFailed = qc && qc.items.some(i => i.passed === false);
                return (
                  <div key={order.id} className="flex items-center gap-4 p-3 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                    <SIcon className={`h-5 w-5 shrink-0 ${order.status === 'In Progress' ? 'text-primary' : order.status === 'Quality Check' ? 'text-warning' : 'text-muted-foreground'}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-foreground truncate">{order.productName}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusStyles[order.status]}`}>{order.status}</span>
                          {qcPassed && <span className="text-xs px-2 py-0.5 rounded-full bg-success/15 text-success">QC Passed ✓</span>}
                          {qcFailed && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">QC Failed ✗</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{order.id}</span><span>Batch: {order.batchSize}</span><span>{order.assignedTo}</span><span className={priorityStyles[order.priority]}>{order.priority}</span>
                      </div>
                      <div className="mt-2 w-full bg-muted rounded-full h-2 overflow-hidden"><div className="h-full rounded-full gradient-primary transition-all" style={{ width: `${order.completionPercent}%` }} /></div>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>{order.startDate}</span><span className="font-medium text-foreground">{order.completionPercent}%</span><span>{order.endDate}</span>
                      </div>
                      {(order.status === 'Quality Check' || order.status === 'In Progress') && hasPermission('edit') && (
                        <Button size="sm" variant="outline" className="mt-2 gap-1" onClick={() => openQC(order.id)}>
                          <ClipboardCheck className="h-3 w-3" /> QC Checklist
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="font-display font-semibold text-foreground mb-3">Recently Completed</h3>
            {productionOrders.filter(o => o.status === 'Completed').map(order => (
              <div key={order.id} className="flex items-center gap-3 p-3 rounded-lg bg-success/5">
                <CheckCircle className="h-5 w-5 text-success" />
                <div className="flex-1"><span className="text-sm font-medium text-foreground">{order.productName}</span><span className="text-xs text-muted-foreground ml-2">Batch: {order.batchSize} · {order.assignedTo}</span></div>
                <span className="text-xs text-muted-foreground">{order.startDate} → {order.endDate}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'bom' && (
        <div className="space-y-3">
          {billsOfMaterials.map((bom) => {
            const expanded = expandedBOM === bom.productId;
            const sellingPrice = products.find((p) => p.id === bom.productId)?.price ?? 0;
            const analysis = analyzeBomProductionCost(bom, rawMaterials, sellingPrice);
            const { materialsResolved, componentCostPerUnit, allocatedLaborOverheadPerUnit, totalProductionCostPerUnit, grossMarginInr, grossMarginPct, marginBand } = analysis;
            const marginColor =
              marginBand === 'high' ? 'text-success' : marginBand === 'mid' ? 'text-warning' : 'text-destructive';
            const marginBg =
              marginBand === 'high' ? 'bg-success/15 text-success border-success/30' : marginBand === 'mid' ? 'bg-warning/15 text-warning border-warning/30' : 'bg-destructive/15 text-destructive border-destructive/30';
            return (
              <div key={bom.productId} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedBOM(expanded ? null : bom.productId)} className="w-full flex items-center justify-between p-4 hover:bg-secondary/30 transition-colors text-left">
                  <div>
                    <h4 className="font-medium text-foreground">{bom.productName}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {bom.materials.length} materials · Batch: {bom.outputPerBatch} units · Live cost/unit:{' '}
                      {formatCurrency(totalProductionCostPerUnit)}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${marginBg}`}>{grossMarginPct.toFixed(1)}% margin</span>
                    <span className="text-sm font-semibold text-foreground">{formatCurrency(componentCostPerUnit)} mat.</span>
                    {expanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border">
                    <table className="w-full">
                      <thead><tr className="bg-secondary/50">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Material</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Qty/Unit</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Cost/Unit</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Subtotal</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                        <th className="px-4 py-2 text-center text-xs font-semibold text-muted-foreground uppercase">Can Produce</th>
                      </tr></thead>
                      <tbody>
                        {materialsResolved.map((m) => {
                          const canProduce = Math.floor(m.currentStock / m.quantityPerUnit);
                          const lowStock = m.currentStock <= m.minStock;
                          const line = m.quantityPerUnit * m.costPerUnit;
                          return (
                            <tr key={m.materialId} className="border-b border-border/50">
                              <td className="px-4 py-2.5 text-sm text-foreground">{m.materialName}</td>
                              <td className="px-4 py-2.5 text-sm text-center text-foreground">{m.quantityPerUnit} {m.unit}</td>
                              <td className="px-4 py-2.5 text-sm text-center text-foreground">{formatCurrency(m.costPerUnit)}</td>
                              <td className="px-4 py-2.5 text-sm text-center text-foreground">{formatCurrency(line)}</td>
                              <td className={`px-4 py-2.5 text-sm text-center ${lowStock ? 'text-destructive font-semibold' : 'text-foreground'}`}>{m.currentStock} {m.unit}</td>
                              <td className="px-4 py-2.5 text-sm text-center font-medium text-foreground">{canProduce} units</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot className="border-t-2 border-border bg-muted/40 sticky bottom-0">
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-foreground">Cost summary — components / unit</td>
                          <td className="px-4 py-2.5 text-sm text-center font-bold text-foreground tabular-nums">{formatCurrency(componentCostPerUnit)}</td>
                          <td colSpan={2} className="px-4 py-2.5 text-xs text-muted-foreground">Uses live raw material costs</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-foreground">Labor + overhead / unit</td>
                          <td className="px-4 py-2 text-sm text-center font-semibold text-foreground tabular-nums">{formatCurrency(allocatedLaborOverheadPerUnit)}</td>
                          <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground">({formatCurrency(bom.laborCostPerBatch)} + {formatCurrency(bom.overheadPerBatch)}) ÷ {bom.outputPerBatch}</td>
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-foreground">Total production cost / unit</td>
                          <td className="px-4 py-2.5 text-sm text-center font-bold text-primary tabular-nums">{formatCurrency(totalProductionCostPerUnit)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2 text-sm font-semibold text-foreground">Selling price (product)</td>
                          <td className="px-4 py-2 text-sm text-center font-semibold text-foreground tabular-nums">{formatCurrency(sellingPrice)}</td>
                          <td colSpan={2} />
                        </tr>
                        <tr>
                          <td colSpan={3} className="px-4 py-2.5 text-sm font-bold text-foreground">Gross production margin</td>
                          <td className={`px-4 py-2.5 text-sm text-center font-bold tabular-nums ${marginColor}`}>
                            {formatCurrency(grossMarginInr)} ({grossMarginPct.toFixed(1)}%)
                          </td>
                          <td colSpan={2} />
                        </tr>
                      </tfoot>
                    </table>
                    <div className="px-4 py-4 border-t border-border bg-secondary/25 space-y-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Cost analysis</h5>
                      <p className="text-sm text-foreground">
                        Component cost per finished unit is{' '}
                        <span className="font-semibold tabular-nums">{formatCurrency(componentCostPerUnit)}</span> (Σ qty × live raw cost). With allocated labor and overhead, total production cost is{' '}
                        <span className="font-semibold tabular-nums">{formatCurrency(totalProductionCostPerUnit)}</span> vs selling price{' '}
                        <span className="font-semibold tabular-nums">{formatCurrency(sellingPrice)}</span>.
                        Gross margin is{' '}
                        <span className={`font-semibold tabular-nums ${marginColor}`}>
                          {formatCurrency(grossMarginInr)} ({grossMarginPct.toFixed(1)}%)
                        </span>
                        {marginBand === 'high' ? ' — healthy vs 30% target.' : marginBand === 'mid' ? ' — monitor pricing and material costs.' : ' — review BOM, pricing, or suppliers urgently.'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="space-y-4">
          {lowStockMaterials.length > 0 && (
            <div className="bg-card border border-warning/30 rounded-xl p-4">
              <h3 className="font-display font-semibold text-foreground mb-2 flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-warning" /> Low Stock Materials ({lowStockMaterials.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {lowStockMaterials.map(m => (
                  <div key={m.materialId} className="flex items-center justify-between p-3 rounded-lg bg-warning/5 border border-warning/20">
                    <div><p className="text-sm font-medium text-foreground">{m.materialName}</p><p className="text-xs text-muted-foreground">{m.supplier} · Lead: {m.leadTimeDays}d</p></div>
                    <div className="text-right"><p className="text-sm font-semibold text-warning">{m.currentStock} {m.unit}</p><p className="text-xs text-muted-foreground">Min: {m.minStock}</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-border"><h3 className="font-display font-semibold text-foreground">All Raw Materials</h3></div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-secondary/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Material</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Stock</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Min</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Cost</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Supplier</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Lead</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
                </tr></thead>
                <tbody>{rawMaterials.map(m => {
                  const low = m.currentStock <= m.minStock;
                  return (
                    <tr key={m.materialId} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      <td className="px-4 py-3 text-xs text-muted-foreground font-mono">{m.materialId}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{m.materialName}</td>
                      <td className={`px-4 py-3 text-sm text-center ${low ? 'text-destructive font-semibold' : 'text-foreground'}`}>{m.currentStock} {m.unit}</td>
                      <td className="px-4 py-3 text-sm text-center text-muted-foreground">{m.minStock}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">
                        {hasPermission('edit') ? (
                          <Input
                            key={`${m.materialId}-${m.costPerUnit}`}
                            type="number"
                            min={0}
                            step={0.01}
                            defaultValue={m.costPerUnit}
                            className="h-8 w-28 text-right mx-auto text-sm tabular-nums"
                            onBlur={(e) => commitMaterialUnitCost(m.materialId, e.target.value)}
                          />
                        ) : (
                          formatCurrency(m.costPerUnit)
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{m.supplier}</td>
                      <td className="px-4 py-3 text-sm text-center text-foreground">{m.leadTimeDays}d</td>
                      <td className="px-4 py-3 text-center"><span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${low ? 'bg-destructive/15 text-destructive' : 'bg-success/15 text-success'}`}>{low ? 'Low' : 'OK'}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'forecast' && (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="stat-card"><p className="text-xs text-muted-foreground">Materials Tracked</p><p className="text-xl font-display font-bold text-foreground">{materialForecast.length}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Shortfalls</p><p className="text-xl font-display font-bold text-destructive">{materialForecast.filter(m => m.status === 'Critical').length}</p></div>
            <div className="stat-card"><p className="text-xs text-muted-foreground">Low Stock</p><p className="text-xl font-display font-bold text-warning">{materialForecast.filter(m => m.status === 'Low').length}</p></div>
          </div>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full">
              <thead><tr className="border-b border-border bg-secondary/50">
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Material</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Required</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Current Stock</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Shortfall</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Status</th>
              </tr></thead>
              <tbody>{materialForecast.map(m => (
                <tr key={m.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{m.name}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{m.required.toFixed(0)} {m.unit}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{m.current} {m.unit}</td>
                  <td className={`px-4 py-3 text-sm text-center font-medium ${m.shortfall > 0 ? 'text-destructive' : 'text-success'}`}>{m.shortfall > 0 ? m.shortfall.toFixed(0) : '—'}</td>
                  <td className="px-4 py-3 text-center"><span className={`text-xs px-2 py-0.5 rounded-full font-medium ${m.status === 'Critical' ? 'bg-destructive/15 text-destructive' : m.status === 'Low' ? 'bg-warning/15 text-warning' : 'bg-success/15 text-success'}`}>{m.status}</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </div>
      )}

      {/* QC Checklist Modal */}
      {showQC && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowQC(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">QC Checklist — {showQC}</h3>
            <div className="space-y-3">
              {qcState.map((item, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{item.name}</p>
                    <Input value={item.note} onChange={e => setQcState(prev => prev.map((it, idx) => idx === i ? { ...it, note: e.target.value } : it))} placeholder="Note (optional)" className="mt-1 h-8 text-xs" />
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setQcState(prev => prev.map((it, idx) => idx === i ? { ...it, passed: true } : it))}
                      className={`px-3 py-1.5 rounded text-xs font-medium ${item.passed === true ? 'bg-success text-success-foreground' : 'bg-secondary text-muted-foreground'}`}>Pass</button>
                    <button onClick={() => setQcState(prev => prev.map((it, idx) => idx === i ? { ...it, passed: false } : it))}
                      className={`px-3 py-1.5 rounded text-xs font-medium ${item.passed === false ? 'bg-destructive text-destructive-foreground' : 'bg-secondary text-muted-foreground'}`}>Fail</button>
                  </div>
                </div>
              ))}
              {qcState.some(i => i.passed === false) && <p className="text-xs text-destructive">⚠️ Order cannot be marked Completed with failed checks.</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowQC(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitQC} className="flex-1 gradient-primary text-primary-foreground" disabled={qcState.some(i => i.passed === null)}>Submit QC</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

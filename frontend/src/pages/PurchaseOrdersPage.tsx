import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency } from '@/lib/mockData';
import { nextPrefixedId } from '@/lib/ids';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, ChevronDown, ChevronUp, AlertTriangle, Truck, Package, CheckCircle } from 'lucide-react';

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Sent: 'bg-info/10 text-info',
  Acknowledged: 'bg-primary/10 text-primary',
  'In Transit': 'bg-warning/10 text-warning',
  Received: 'bg-success/10 text-success',
  Closed: 'bg-secondary text-muted-foreground',
};

const statusFlow = ['Draft', 'Sent', 'Acknowledged', 'In Transit', 'Received', 'Closed'] as const;
type POFlowStatus = (typeof statusFlow)[number];

export default function PurchaseOrdersPage() {
  const { hasPermission, user } = useAuth();
  const { purchaseOrders, setPurchaseOrders, products, setProducts, addLog } = useInventory();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGRN, setShowGRN] = useState<string | null>(null);
  const [grnQty, setGrnQty] = useState(0);

  // New PO form
  const [newPO, setNewPO] = useState({ supplier: '', productId: '', quantity: 0, expectedDelivery: '' });

  const filtered = purchaseOrders.filter(po =>
    (po.id.toLowerCase().includes(search.toLowerCase()) || po.supplier.toLowerCase().includes(search.toLowerCase()) || po.productName.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'All' || po.status === statusFilter)
  );

  // Supplier lead time tracking
  const getSupplierLeadTimes = (supplier: string) => {
    const completed = purchaseOrders.filter(po => po.supplier === supplier && po.dateSent && po.dateReceived);
    if (completed.length === 0) return null;
    const totalDays = completed.reduce((sum, po) => {
      const sent = new Date(po.dateSent!);
      const received = new Date(po.dateReceived!);
      return sum + Math.ceil((received.getTime() - sent.getTime()) / (1000 * 60 * 60 * 24));
    }, 0);
    return Math.round(totalDays / completed.length);
  };

  const advancePO = (poId: string) => {
    const po = purchaseOrders.find(p => p.id === poId);
    if (!po) return;
    const currentIdx = statusFlow.indexOf(po.status as POFlowStatus);
    if (currentIdx < 0 || currentIdx >= statusFlow.length - 1) return;
    const nextStatus = statusFlow[currentIdx + 1];

    if (nextStatus === 'Received') {
      setShowGRN(poId);
      setGrnQty(po.quantityOrdered);
      return;
    }

    setPurchaseOrders(prev => prev.map(p => {
      if (p.id !== poId) return p;
      const updated = { ...p, status: nextStatus };
      if (nextStatus === 'Sent') updated.dateSent = new Date().toISOString().split('T')[0];
      return updated;
    }));
    addLog(user?.name || 'System', 'PO Status Update', `${poId} moved to ${nextStatus}`);
  };

  const receiveGRN = () => {
    if (!showGRN) return;
    const po = purchaseOrders.find(p => p.id === showGRN);
    if (!po) return;

    const discrepancy = grnQty < po.quantityOrdered;
    setPurchaseOrders(prev => prev.map(p => p.id === showGRN ? {
      ...p,
      status: 'Received' as const,
      quantityReceived: grnQty,
      dateReceived: new Date().toISOString().split('T')[0],
      discrepancy,
    } : p));

    // Increment product stock by actual received qty
    setProducts(prev => prev.map(p => p.id === po.productId ? { ...p, stock: p.stock + grnQty, lastRestocked: new Date().toISOString().split('T')[0] } : p));
    addLog(user?.name || 'System', 'GRN Received', `${po.productName}: ordered ${po.quantityOrdered}, received ${grnQty}${discrepancy ? ' (DISCREPANCY)' : ''}`);
    setShowGRN(null);
  };

  const addPO = () => {
    const product = products.find(p => p.id === newPO.productId);
    if (!product || newPO.quantity <= 0 || !newPO.supplier || !newPO.expectedDelivery) return;
    const id = nextPrefixedId('PO', purchaseOrders.map((p) => p.id));
    setPurchaseOrders(prev => [...prev, {
      id, supplier: newPO.supplier, productId: product.id, productName: product.name,
      quantityOrdered: newPO.quantity, quantityReceived: null,
      expectedDelivery: newPO.expectedDelivery, status: 'Draft', discrepancy: false,
    }]);
    addLog(user?.name || 'System', 'PO Created', `${id} for ${product.name} (${newPO.quantity} units)`);
    setNewPO({ supplier: '', productId: '', quantity: 0, expectedDelivery: '' });
    setShowAddModal(false);
  };

  const uniqueSuppliers = [...new Set(purchaseOrders.map(po => po.supplier))];

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Supplier Lead Time Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {uniqueSuppliers.slice(0, 4).map(supplier => {
          const avgLead = getSupplierLeadTimes(supplier);
          return (
            <div key={supplier} className="stat-card">
              <p className="text-xs text-muted-foreground truncate">{supplier}</p>
              <p className="text-xl font-display font-bold text-foreground mt-1">{avgLead !== null ? `${avgLead} days` : 'N/A'}</p>
              <p className="text-xs text-muted-foreground">Avg Lead Time</p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search purchase orders..." className="pl-10 h-10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-4 rounded-lg border border-input bg-card text-foreground text-sm">
          <option value="All">All Statuses</option>
          {statusFlow.map(s => <option key={s}>{s}</option>)}
        </select>
        {hasPermission('add') && (
          <Button onClick={() => setShowAddModal(true)} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> New PO
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map(po => {
          const avgLead = getSupplierLeadTimes(po.supplier);
          return (
            <div key={po.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <button className="w-full px-5 py-4 flex items-center justify-between" onClick={() => setExpanded(expanded === po.id ? null : po.id)}>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-primary">{po.id}</span>
                  <span className="text-sm text-foreground font-medium">{po.productName}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[po.status]}`}>{po.status}</span>
                  {po.discrepancy && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Discrepancy</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-foreground">{po.quantityOrdered} units</span>
                  <span className="text-xs text-muted-foreground">{po.expectedDelivery}</span>
                  {expanded === po.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {expanded === po.id && (
                <div className="px-5 pb-4 border-t border-border/50 pt-3 animate-fade-in space-y-3">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
                    <div><span className="text-muted-foreground block text-xs">Supplier</span><span className="text-foreground font-medium">{po.supplier}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Qty Ordered</span><span className="text-foreground font-medium">{po.quantityOrdered}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Qty Received</span><span className="text-foreground font-medium">{po.quantityReceived ?? '—'}</span></div>
                    <div><span className="text-muted-foreground block text-xs">Avg Lead Time</span><span className="text-foreground font-medium">{avgLead ? `${avgLead} days` : 'N/A'}</span></div>
                  </div>
                  {po.discrepancy && po.quantityReceived !== null && (
                    <div className="p-3 rounded-lg bg-warning/10 border border-warning/20 text-sm text-warning">
                      ⚠️ Received {po.quantityReceived} of {po.quantityOrdered} ordered — shortfall of {po.quantityOrdered - po.quantityReceived} units
                    </div>
                  )}
                  {hasPermission('edit') && po.status !== 'Closed' && po.status !== 'Received' && (
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => advancePO(po.id)}>
                        Advance to {statusFlow[statusFlow.indexOf(po.status as POFlowStatus) + 1]}
                      </Button>
                    </div>
                  )}
                  {hasPermission('edit') && po.status === 'Received' && (
                    <Button size="sm" variant="outline" onClick={() => setPurchaseOrders(prev => prev.map(p => p.id === po.id ? { ...p, status: 'Closed' as const } : p))}>
                      Close PO
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">No purchase orders found.</div>}
      </div>

      {/* Add PO Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-foreground">Create Purchase Order</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Supplier *</label>
                <Input value={newPO.supplier} onChange={e => setNewPO(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. TechWorld Pvt Ltd" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Product *</label>
                <select value={newPO.productId} onChange={e => setNewPO(p => ({ ...p, productId: e.target.value }))}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                  <option value="">Select product...</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Quantity *</label>
                  <Input type="number" value={newPO.quantity || ''} onChange={e => setNewPO(p => ({ ...p, quantity: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Expected Delivery *</label>
                  <Input type="date" value={newPO.expectedDelivery} onChange={e => setNewPO(p => ({ ...p, expectedDelivery: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={addPO} className="flex-1 gradient-primary text-primary-foreground"
                  disabled={!newPO.supplier || !newPO.productId || newPO.quantity <= 0 || !newPO.expectedDelivery}>
                  Create PO
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* GRN Modal */}
      {showGRN && (() => {
        const po = purchaseOrders.find(p => p.id === showGRN);
        if (!po) return null;
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
            <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in">
              <h3 className="text-lg font-display font-bold text-foreground mb-4">Goods Receipt Note (GRN)</h3>
              <p className="text-sm text-muted-foreground mb-4">{po.productName} — Ordered: {po.quantityOrdered} units</p>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Actual Quantity Received *</label>
                <Input type="number" value={grnQty} onChange={e => setGrnQty(Number(e.target.value))} min={0} max={po.quantityOrdered * 2} />
                {grnQty < po.quantityOrdered && grnQty >= 0 && (
                  <p className="text-xs text-warning mt-1 flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Shortfall: {po.quantityOrdered - grnQty} units</p>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <Button variant="outline" onClick={() => setShowGRN(null)} className="flex-1">Cancel</Button>
                <Button onClick={receiveGRN} className="flex-1 gradient-primary text-primary-foreground" disabled={grnQty < 0}>
                  Confirm Receipt
                </Button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency } from '@/lib/mockData';
import type { Quotation } from '@/contexts/InventoryContext';
import { nextPrefixedId } from '@/lib/ids';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, X, FileText, ChevronDown, ChevronUp, Trash2, Download } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

const statusColors: Record<string, string> = {
  Draft: 'bg-muted text-muted-foreground',
  Sent: 'bg-info/10 text-info',
  Accepted: 'bg-success/10 text-success',
  Rejected: 'bg-destructive/10 text-destructive',
  Expired: 'bg-warning/10 text-warning',
};

export default function QuotationsPage() {
  const { hasPermission, user } = useAuth();
  const { quotations, setQuotations, products, orders, setOrders, customers, addLog } = useInventory();
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newQt, setNewQt] = useState({ customerName: '', validityDate: '', items: [{ productId: '', productName: '', quantity: 1, price: 0 }] });

  const addItemRow = () => setNewQt(p => ({ ...p, items: [...p.items, { productId: '', productName: '', quantity: 1, price: 0 }] }));
  const removeItem = (i: number) => setNewQt(p => ({ ...p, items: p.items.filter((_, idx) => idx !== i) }));
  const updateItem = (i: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setNewQt(p => ({ ...p, items: p.items.map((item, idx) => idx === i ? { productId, productName: product.name, quantity: item.quantity, price: product.price } : item) }));
  };

  const createQuotation = () => {
    const validItems = newQt.items.filter(i => i.productId);
    if (!newQt.customerName || validItems.length === 0 || !newQt.validityDate) return;
    const total = validItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = nextPrefixedId('QT', quotations.map((q) => q.id));
    setQuotations(prev => [...prev, { id, customerName: newQt.customerName, items: validItems, validityDate: newQt.validityDate, status: 'Draft', total, createdDate: new Date().toISOString().split('T')[0] }]);
    addLog(user?.name || 'System', 'Quotation Created', `${id} for ${newQt.customerName} — ${formatCurrency(total)}`);
    setNewQt({ customerName: '', validityDate: '', items: [{ productId: '', productName: '', quantity: 1, price: 0 }] });
    setShowAdd(false);
  };

  const updateStatus = (id: string, status: Quotation['status']) => {
    setQuotations(prev => prev.map(q => q.id === id ? { ...q, status } : q));
    addLog(user?.name || 'System', 'Quotation Updated', `${id} → ${status}`);
  };

  const convertToOrder = (qt: typeof quotations[0]) => {
    const orderId = nextPrefixedId('ORD', orders.map((o) => o.id));
    setOrders(prev => [...prev, {
      id: orderId, customerName: qt.customerName, items: qt.items, total: qt.total,
      status: 'Placed' as const, date: new Date().toISOString().split('T')[0], createdBy: user?.name || 'Unknown',
    }]);
    setQuotations(prev => prev.map(q => q.id === qt.id ? { ...q, status: 'Accepted' as const } : q));
    addLog(user?.name || 'System', 'Quotation Converted', `${qt.id} → Order ${orderId}`);
  };

  const downloadProforma = (qt: typeof quotations[0]) => {
    const doc = new jsPDF();
    doc.setFontSize(20);
    doc.text('INVETO', 14, 22);
    doc.setFontSize(10);
    doc.text('Proforma Invoice', 14, 30);
    doc.text(`Quotation: ${qt.id}`, 14, 38);
    doc.text(`Customer: ${qt.customerName}`, 14, 44);
    doc.text(`Date: ${qt.createdDate}`, 14, 50);
    doc.text(`Valid Until: ${qt.validityDate}`, 14, 56);

    const tableData = qt.items.map(i => [i.productName, String(i.quantity), formatCurrency(i.price), formatCurrency(i.quantity * i.price)]);
    autoTable(doc, {
      startY: 64,
      head: [['Product', 'Qty', 'Unit Price', 'Subtotal']],
      body: tableData,
      theme: 'striped',
    });

    type Doc = InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } };
    const finalY = (doc as Doc).lastAutoTable.finalY + 10;
    const subtotal = qt.total;
    const gst = subtotal * 0.18;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 14, finalY);
    doc.text(`GST (18%): ${formatCurrency(gst)}`, 14, finalY + 7);
    doc.setFontSize(12);
    doc.text(`Grand Total: ${formatCurrency(subtotal + gst)}`, 14, finalY + 16);
    doc.save(`Proforma_${qt.id}.pdf`);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-3">
          {['All', 'Draft', 'Sent', 'Accepted', 'Rejected', 'Expired'].map(f => (
            <button key={f} className="px-3 py-1.5 rounded-lg text-xs font-medium bg-secondary text-muted-foreground hover:text-foreground">{f}</button>
          ))}
        </div>
        {hasPermission('add') && (
          <Button onClick={() => setShowAdd(true)} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> New Quotation
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {quotations.map(qt => (
          <div key={qt.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
            <button className="w-full px-5 py-4 flex items-center justify-between" onClick={() => setExpanded(expanded === qt.id ? null : qt.id)}>
              <div className="flex items-center gap-4">
                <FileText className="h-4 w-4 text-primary" />
                <span className="font-mono text-sm font-semibold text-primary">{qt.id}</span>
                <span className="text-sm text-foreground font-medium">{qt.customerName}</span>
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[qt.status]}`}>{qt.status}</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-sm font-semibold text-foreground">{formatCurrency(qt.total)}</span>
                <span className="text-xs text-muted-foreground">Valid: {qt.validityDate}</span>
                {expanded === qt.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
              </div>
            </button>
            {expanded === qt.id && (
              <div className="px-5 pb-4 border-t border-border/50 pt-3 animate-fade-in">
                <table className="w-full mb-3">
                  <thead><tr className="text-xs text-muted-foreground uppercase"><th className="text-left py-1">Product</th><th className="text-center py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Subtotal</th></tr></thead>
                  <tbody>
                    {qt.items.map((item, i) => (
                      <tr key={i} className="text-sm border-b border-border/30 last:border-0">
                        <td className="py-2 text-foreground">{item.productName}</td>
                        <td className="py-2 text-center text-foreground">{item.quantity}</td>
                        <td className="py-2 text-right text-muted-foreground">{formatCurrency(item.price)}</td>
                        <td className="py-2 text-right font-medium text-foreground">{formatCurrency(item.quantity * item.price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex gap-2 flex-wrap">
                  {qt.status === 'Draft' && hasPermission('edit') && <Button size="sm" variant="outline" onClick={() => updateStatus(qt.id, 'Sent')}>Mark as Sent</Button>}
                  {qt.status === 'Sent' && hasPermission('edit') && <Button size="sm" variant="outline" onClick={() => updateStatus(qt.id, 'Accepted')}>Accept</Button>}
                  {qt.status === 'Sent' && hasPermission('edit') && <Button size="sm" variant="destructive" onClick={() => updateStatus(qt.id, 'Rejected')}>Reject</Button>}
                  {qt.status === 'Accepted' && hasPermission('add') && <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => convertToOrder(qt)}>Convert to Order</Button>}
                  <Button size="sm" variant="outline" onClick={() => downloadProforma(qt)} className="gap-1"><Download className="h-3 w-3" /> Proforma PDF</Button>
                </div>
              </div>
            )}
          </div>
        ))}
        {quotations.length === 0 && <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">No quotations yet.</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg animate-fade-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-foreground">New Quotation</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Customer Name *</label>
                <Input value={newQt.customerName} onChange={e => setNewQt(p => ({ ...p, customerName: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Validity Date *</label>
                <Input type="date" value={newQt.validityDate} onChange={e => setNewQt(p => ({ ...p, validityDate: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Items</label>
                {newQt.items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center mb-2">
                    <select value={item.productId} onChange={e => updateItem(i, e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                      <option value="">Select product...</option>
                      {products.map(p => <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)}</option>)}
                    </select>
                    <Input type="number" min={1} value={item.quantity} onChange={e => setNewQt(p => ({ ...p, items: p.items.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it) }))} className="w-20 h-10" />
                    {newQt.items.length > 1 && <button onClick={() => removeItem(i)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground"><Trash2 className="h-4 w-4" /></button>}
                  </div>
                ))}
                <button onClick={addItemRow} className="text-sm text-primary font-medium hover:underline">+ Add item</button>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
                <Button onClick={createQuotation} className="flex-1 gradient-primary text-primary-foreground" disabled={!newQt.customerName || !newQt.validityDate}>Create</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { formatCurrency, Order } from '@/lib/mockData';
import { nextPrefixedId } from '@/lib/ids';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, ChevronDown, ChevronUp, X, Trash2, Download, RotateCcw, Printer, MessageSquare } from 'lucide-react';
import { generateInvoicePDF } from '@/lib/invoiceGenerator';
import { openWarehousePicklistPrint } from '@/lib/warehousePicklist';
import CommentThreadPanel, { countUnreadThreadComments, type ThreadComment } from '@/components/CommentThreadPanel';

const statusColors: Record<string, string> = {
  Placed: 'bg-info/10 text-info',
  Processing: 'bg-warning/10 text-warning',
  Shipped: 'bg-primary/10 text-primary',
  Delivered: 'bg-success/10 text-success',
  Cancelled: 'bg-destructive/10 text-destructive',
};

interface OrderItem { productId: string; productName: string; quantity: number; price: number; }

export default function OrdersPage() {
  const { hasPermission, user } = useAuth();
  const { orders, setOrders, products, setProducts, customers, createCustomer, addLog, getAvailableStock, returns, setReturns, users } = useInventory();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [orderComments, setOrderComments] = useState<Record<string, ThreadComment[]>>({});
  const [orderCommentViewed, setOrderCommentViewed] = useState<Record<string, string>>({});
  const [commentOrderId, setCommentOrderId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newCustomer, setNewCustomer] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [newItems, setNewItems] = useState<OrderItem[]>([{ productId: '', productName: '', quantity: 1, price: 0 }]);
  const [igstMode, setIgstMode] = useState(false);
  const [showReturn, setShowReturn] = useState<string | null>(null);
  const [returnItems, setReturnItems] = useState<{ productId: string; productName: string; quantity: number; reason: string; condition: 'Resellable' | 'Damaged' | 'Defective' }[]>([]);

  const filtered = orders.filter(o =>
    (o.id.toLowerCase().includes(search.toLowerCase()) || o.customerName.toLowerCase().includes(search.toLowerCase())) &&
    (statusFilter === 'All' || o.status === statusFilter) &&
    (!commentsOnly || (orderComments[o.id]?.length ?? 0) > 0)
  );

  const updateStatus = (orderId: string, newStatus: Order['status']) => {
    const prevOrder = orders.find((o) => o.id === orderId);
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    addLog(user?.name || 'System', 'Order Updated', `Order ${orderId} status changed to ${newStatus}.`, {
      editDiff: { old: `Status: ${prevOrder?.status ?? '—'}`, new: `Status: ${newStatus}` },
    });
  };

  const statusFlow: Order['status'][] = ['Placed', 'Processing', 'Shipped', 'Delivered'];

  const addItemRow = () => setNewItems(prev => [...prev, { productId: '', productName: '', quantity: 1, price: 0 }]);
  const removeItemRow = (i: number) => setNewItems(prev => prev.filter((_, idx) => idx !== i));
  const updateItem = (i: number, productId: string) => {
    const product = products.find(p => p.id === productId);
    if (!product) return;
    setNewItems(prev => prev.map((item, idx) => idx === i ? { productId, productName: product.name, quantity: item.quantity, price: product.price } : item));
  };
  const updateQty = (i: number, qty: number) => {
    setNewItems(prev => prev.map((item, idx) => idx === i ? { ...item, quantity: Math.max(1, qty) } : item));
  };

  const addOrder = async () => {
    const validItems = newItems.filter(i => i.productId && i.quantity > 0);
    const custName = selectedCustomerId ? customers.find(c => c.id === selectedCustomerId)?.name || newCustomer : newCustomer;
    if (!custName || validItems.length === 0) return;

    // Check available stock
    for (const item of validItems) {
      const avail = getAvailableStock(item.productId);
      if (item.quantity > avail) {
        alert(`Insufficient available stock for ${item.productName}. Available: ${avail}`);
        return;
      }
    }

    // If new customer, add to customers (and MongoDB when API mode)
    if (!selectedCustomerId && custName) {
      const existing = customers.find(c => c.name === custName);
      if (!existing) {
        const cr = await createCustomer({
          name: custName,
          email: `${custName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
          phone: '',
        });
        if (!cr.ok) {
          alert(cr.error ?? 'Could not save new customer');
          return;
        }
      }
    }

    const total = validItems.reduce((s, i) => s + i.quantity * i.price, 0);
    const id = nextPrefixedId('ORD', orders.map((o) => o.id));
    const order: Order = {
      id, customerName: custName, items: validItems, total,
      status: 'Placed', date: new Date().toISOString().split('T')[0], createdBy: user?.name || 'Unknown',
    };
    setOrders(prev => [...prev, order]);
    addLog(user?.name || 'System', 'Created Order', `Order ${id} for ${custName} — ${formatCurrency(total)}`);
    setNewCustomer('');
    setSelectedCustomerId('');
    setNewItems([{ productId: '', productName: '', quantity: 1, price: 0 }]);
    setShowAddModal(false);
  };

  const initiateReturn = (order: Order) => {
    setShowReturn(order.id);
    setReturnItems(order.items.map(i => ({ ...i, quantity: 0, reason: 'Changed Mind', condition: 'Resellable' as const })));
  };

  const submitReturn = () => {
    if (!showReturn) return;
    const validItems = returnItems.filter(i => i.quantity > 0);
    if (validItems.length === 0) return;

    const rma = {
      id: nextPrefixedId('RMA', returns.map((r) => r.id)),
      orderId: showReturn,
      items: validItems,
      status: 'Approved' as const,
      timestamp: new Date().toISOString(),
      userName: user?.name || 'System',
    };
    setReturns(prev => [...prev, rma]);

    // Add resellable items back to stock
    validItems.forEach(item => {
      if (item.condition === 'Resellable') {
        setProducts(prev => prev.map(p => p.id === item.productId ? { ...p, stock: p.stock + item.quantity } : p));
      }
    });

    addLog(user?.name || 'System', 'Return Processed', `RMA ${rma.id} for order ${showReturn}: ${validItems.map(i => `${i.productName} x${i.quantity} (${i.condition})`).join(', ')}`);
    setShowReturn(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." className="pl-10 h-10" />
        </div>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="h-10 px-4 rounded-lg border border-input bg-card text-foreground text-sm">
          <option value="All">All Statuses</option>
          {['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map(s => <option key={s}>{s}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setCommentsOnly((c) => !c)}
          className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors ${
            commentsOnly ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-card text-foreground hover:bg-secondary'
          }`}
        >
          Comments
        </button>
        {hasPermission('add') && (
          <Button onClick={() => setShowAddModal(true)} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> New Order
          </Button>
        )}
      </div>

      <div className="space-y-3">
        {filtered.map(order => {
          const orderReturns = returns.filter(r => r.orderId === order.id);
          const unread = countUnreadThreadComments(orderComments[order.id] ?? [], orderCommentViewed[order.id]);
          return (
            <div key={order.id} className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-md transition-shadow">
              <button className="w-full px-5 py-4 flex items-center justify-between" onClick={() => setExpanded(expanded === order.id ? null : order.id)}>
                <div className="flex items-center gap-4">
                  <span className="font-mono text-sm font-semibold text-primary relative inline-flex items-center">
                    {order.id}
                    {unread > 0 && (
                      <span className="ml-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                        {unread > 9 ? '9+' : unread}
                      </span>
                    )}
                  </span>
                  <span className="text-sm text-foreground font-medium">{order.customerName}</span>
                  <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${statusColors[order.status]}`}>{order.status}</span>
                  {orderReturns.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-warning/15 text-warning">RMA</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm font-semibold text-foreground">{formatCurrency(order.total)}</span>
                  <span className="text-xs text-muted-foreground">{order.date}</span>
                  {expanded === order.id ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>
              {expanded === order.id && (
                <div className="px-5 pb-4 border-t border-border/50 pt-3 animate-fade-in">
                  <table className="w-full mb-3">
                    <thead><tr className="text-xs text-muted-foreground uppercase"><th className="text-left py-1">Product</th><th className="text-center py-1">Qty</th><th className="text-right py-1">Price</th><th className="text-right py-1">Subtotal</th></tr></thead>
                    <tbody>
                      {order.items.map((item, i) => (
                        <tr key={i} className="text-sm border-b border-border/30 last:border-0">
                          <td className="py-2 text-foreground">{item.productName}</td>
                          <td className="py-2 text-center text-foreground">{item.quantity}</td>
                          <td className="py-2 text-right text-muted-foreground">{formatCurrency(item.price)}</td>
                          <td className="py-2 text-right font-medium text-foreground">{formatCurrency(item.quantity * item.price)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs text-muted-foreground">Created by: {order.createdBy}</span>
                    <div className="flex gap-2 flex-wrap">
                      {order.status === 'Processing' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => openWarehousePicklistPrint(order, products)}
                          className="gap-1"
                        >
                          <Printer className="h-3 w-3" /> Print picklist
                        </Button>
                      )}
                      <Button size="sm" variant="outline" onClick={() => generateInvoicePDF(order, products, { igst: igstMode })} className="gap-1">
                        <Download className="h-3 w-3" /> Invoice
                      </Button>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground">
                        <input type="checkbox" checked={igstMode} onChange={e => setIgstMode(e.target.checked)} className="rounded" /> IGST
                      </label>
                      {order.status === 'Delivered' && hasPermission('edit') && (
                        <Button size="sm" variant="outline" onClick={() => initiateReturn(order)} className="gap-1">
                          <RotateCcw className="h-3 w-3" /> Raise Return
                        </Button>
                      )}
                      {hasPermission('edit') && order.status !== 'Delivered' && order.status !== 'Cancelled' && (
                        <>
                          {statusFlow.slice(statusFlow.indexOf(order.status) + 1, statusFlow.indexOf(order.status) + 2).map(s => (
                            <Button key={s} size="sm" variant="outline" onClick={() => updateStatus(order.id, s)}>Move to {s}</Button>
                          ))}
                          <Button size="sm" variant="destructive" onClick={() => updateStatus(order.id, 'Cancelled')}>Cancel</Button>
                        </>
                      )}
                      <Button size="sm" variant="secondary" className="gap-1" onClick={() => setCommentOrderId(order.id)}>
                        <MessageSquare className="h-3 w-3" /> Comments
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">No orders found.</div>}
      </div>

      {/* Add Order Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg animate-fade-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-foreground">Create New Order</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Select Existing Customer</label>
                <select value={selectedCustomerId} onChange={e => { setSelectedCustomerId(e.target.value); if (e.target.value) setNewCustomer(''); }}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                  <option value="">— Or type new below —</option>
                  {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
                </select>
              </div>
              {!selectedCustomerId && (
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">New Customer Name *</label>
                  <Input value={newCustomer} onChange={e => setNewCustomer(e.target.value)} placeholder="e.g. Vikram Singh" />
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-foreground mb-2 block">Order Items *</label>
                <div className="space-y-2">
                  {newItems.map((item, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <select value={item.productId} onChange={e => updateItem(i, e.target.value)}
                        className="flex-1 h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                        <option value="">Select product...</option>
                        {products.filter(p => p.stock > 0).map(p => (
                          <option key={p.id} value={p.id}>{p.name} — {formatCurrency(p.price)} ({getAvailableStock(p.id)} avail)</option>
                        ))}
                      </select>
                      <Input type="number" min={1} value={item.quantity} onChange={e => updateQty(i, Number(e.target.value))} className="w-20 h-10" placeholder="Qty" />
                      <span className="text-sm font-medium text-foreground w-24 text-right">{item.productId ? formatCurrency(item.quantity * item.price) : '—'}</span>
                      {newItems.length > 1 && (
                        <button onClick={() => removeItemRow(i)} className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  ))}
                </div>
                <button onClick={addItemRow} className="mt-2 text-sm text-primary font-medium hover:underline">+ Add another item</button>
              </div>
              <div className="border-t border-border pt-3 flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">Total:</span>
                <span className="text-lg font-display font-bold text-foreground">
                  {formatCurrency(newItems.filter(i => i.productId).reduce((s, i) => s + i.quantity * i.price, 0))}
                </span>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={addOrder} className="flex-1 gradient-primary text-primary-foreground"
                  disabled={(!newCustomer && !selectedCustomerId) || newItems.every(i => !i.productId)}>
                  Create Order
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Return Modal */}
      <CommentThreadPanel
        open={!!commentOrderId}
        onClose={() => setCommentOrderId(null)}
        title={commentOrderId ? `Order ${commentOrderId}` : ''}
        comments={commentOrderId ? orderComments[commentOrderId] ?? [] : []}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        currentUser={{ id: user?.id ?? '0', name: user?.name ?? 'User' }}
        onAfterOpen={() => {
          if (commentOrderId) {
            setOrderCommentViewed((v) => ({ ...v, [commentOrderId]: new Date().toISOString() }));
          }
        }}
        onSend={(text, mentions) => {
          if (!commentOrderId) return;
          const msg: ThreadComment = {
            id: `oc_${Date.now()}`,
            userId: user?.id ?? '0',
            userName: user?.name ?? 'User',
            text,
            ts: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            mentions,
          };
          setOrderComments((prev) => ({
            ...prev,
            [commentOrderId]: [...(prev[commentOrderId] ?? []), msg],
          }));
        }}
      />

      {showReturn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowReturn(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg animate-fade-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">Raise Return — {showReturn}</h3>
            <div className="space-y-3">
              {returnItems.map((item, i) => (
                <div key={i} className="p-3 rounded-lg bg-secondary/50 space-y-2">
                  <p className="text-sm font-medium text-foreground">{item.productName}</p>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-muted-foreground">Qty to Return</label>
                      <Input type="number" min={0} value={item.quantity} onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, quantity: Number(e.target.value) } : it))} className="h-8" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Reason</label>
                      <select value={item.reason} onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, reason: e.target.value } : it))}
                        className="w-full h-8 px-2 rounded border border-input bg-card text-foreground text-xs">
                        {['Wrong Item', 'Damaged', 'Changed Mind', 'Other'].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground">Condition</label>
                      <select value={item.condition} onChange={e => setReturnItems(prev => prev.map((it, idx) => idx === i ? { ...it, condition: e.target.value as 'Resellable' | 'Damaged' | 'Defective' } : it))}
                        className="w-full h-8 px-2 rounded border border-input bg-card text-foreground text-xs">
                        {['Resellable', 'Damaged', 'Defective'].map(c => <option key={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowReturn(null)} className="flex-1">Cancel</Button>
                <Button onClick={submitReturn} className="flex-1 gradient-primary text-primary-foreground"
                  disabled={returnItems.every(i => i.quantity === 0)}>Submit Return</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useMemo } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { formatCurrency, type Order } from '@/lib/mockData';
import type { Customer } from '@/contexts/InventoryContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, X, ChevronDown, ChevronUp } from 'lucide-react';

function normEmail(email: string | undefined): string {
  return (email ?? '').trim().toLowerCase();
}

function normName(name: string | undefined): string {
  return (name ?? '').trim().toLowerCase();
}

/** One row per real customer: merge duplicate DB rows that share the same email. */
function groupCustomersByEmail(customers: Customer[]): Customer[][] {
  const map = new Map<string, Customer[]>();
  for (const c of customers) {
    const key = normEmail(c.email) ? `e:${normEmail(c.email)}` : `id:${c.id}`;
    const g = map.get(key);
    if (g) g.push(c);
    else map.set(key, [c]);
  }
  return [...map.values()];
}

type MergedCustomerRow = Customer & {
  totalOrders: number;
  lifetimeValue: number;
  avgOrderValue: number;
  lastOrder: string;
  custOrders: Order[];
  mergeCount: number;
};

export default function CustomersPage() {
  const { customers, createCustomer, orders, addLog } = useInventory();
  const { hasPermission, user } = useAuth();
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newCust, setNewCust] = useState({ name: '', email: '', phone: '' });

  const mergedCustomerRows = useMemo((): MergedCustomerRow[] => {
    return groupCustomersByEmail(customers).map((group) => {
      const primary = group[0];
      const nameKeys = new Set(group.map((c) => normName(c.name)));
      const custOrders = orders.filter((o) => nameKeys.has(normName(o.customerName)));
      const totalOrders = custOrders.length;
      const lifetimeValue = custOrders.reduce((s, o) => s + o.total, 0);
      const avgOrderValue = totalOrders > 0 ? lifetimeValue / totalOrders : 0;
      const lastOrder = [...custOrders].sort((a, b) => b.date.localeCompare(a.date))[0]?.date || 'N/A';
      const displayName = group.reduce((a, b) => (a.name.length >= b.name.length ? a : b)).name;
      const displayPhone = group.find((c) => c.phone?.trim())?.phone ?? primary.phone ?? '';
      const mergeCount = group.length;
      return {
        ...primary,
        name: displayName,
        phone: displayPhone,
        totalOrders,
        lifetimeValue,
        avgOrderValue,
        lastOrder,
        custOrders,
        mergeCount,
      };
    });
  }, [customers, orders]);

  const customerStats = useMemo(() => {
    const q = search.trim().toLowerCase();
    return mergedCustomerRows.filter(
      (c) =>
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q) ||
        (c.phone && c.phone.toLowerCase().includes(q))
    );
  }, [mergedCustomerRows, search]);

  const addCustomer = async () => {
    if (!newCust.name || !newCust.email) return;
    const res = await createCustomer({ name: newCust.name, email: newCust.email, phone: newCust.phone });
    if (!res.ok) {
      alert(res.error ?? 'Could not save customer');
      return;
    }
    addLog(user?.name || 'System', 'Customer Added', `Added customer ${newCust.name}`);
    setNewCust({ name: '', email: '', phone: '' });
    setShowAdd(false);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Customers</p>
          <p className="text-2xl font-display font-bold text-foreground">{mergedCustomerRows.length}</p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Total Revenue</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {formatCurrency(mergedCustomerRows.reduce((s, c) => s + c.lifetimeValue, 0))}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground">Avg Order Value</p>
          <p className="text-2xl font-display font-bold text-foreground">
            {formatCurrency(
              mergedCustomerRows.reduce((s, c) => s + c.avgOrderValue, 0) / Math.max(mergedCustomerRows.length, 1)
            )}
          </p>
        </div>
        <div className="stat-card">
          <p className="text-xs text-muted-foreground" title="Customers with more than one order (merged by email)">
            Repeat Customers
          </p>
          <p className="text-2xl font-display font-bold text-foreground">
            {mergedCustomerRows.filter((c) => c.totalOrders > 1).length}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customers..." className="pl-10 h-10" />
        </div>
        {hasPermission('add') && (
          <Button onClick={() => setShowAdd(true)} className="gradient-primary text-primary-foreground gap-2">
            <Plus className="h-4 w-4" /> Add Customer
          </Button>
        )}
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase">Email</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Orders</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Lifetime Value</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Avg Order</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase">Last Order</th>
              <th className="px-4 py-3 text-center text-xs font-semibold text-muted-foreground uppercase" />
            </tr>
          </thead>
          <tbody>
            {customerStats.map((c) => (
              <React.Fragment key={c.id}>
                <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setExpanded(expanded === c.id ? null : c.id)}>
                  <td className="px-4 py-3">
                    <p className="text-sm font-medium text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.phone}</p>
                    {c.mergeCount > 1 && (
                      <p className="text-[10px] text-amber-500/90 mt-0.5">
                        {c.mergeCount} duplicate records (same email) — delete extras in Compass
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{c.email}</td>
                  <td className="px-4 py-3 text-sm text-center font-medium text-foreground">{c.totalOrders}</td>
                  <td className="px-4 py-3 text-sm text-center font-semibold text-success">{formatCurrency(c.lifetimeValue)}</td>
                  <td className="px-4 py-3 text-sm text-center text-foreground">{formatCurrency(c.avgOrderValue)}</td>
                  <td className="px-4 py-3 text-sm text-center text-muted-foreground">{c.lastOrder}</td>
                  <td className="px-4 py-3 text-center">{expanded === c.id ? <ChevronUp className="h-4 w-4 text-muted-foreground inline" /> : <ChevronDown className="h-4 w-4 text-muted-foreground inline" />}</td>
                </tr>
                {expanded === c.id && (
                  <tr>
                    <td colSpan={7} className="p-4 bg-secondary/20">
                      <h4 className="text-sm font-semibold text-foreground mb-2">Order History</h4>
                      {c.custOrders.length > 0 ? (
                        <div className="space-y-2">
                          {c.custOrders.map(o => (
                            <div key={o.id} className="flex items-center justify-between p-3 rounded-lg bg-card border border-border/50">
                              <div className="flex items-center gap-3">
                                <span className="font-mono text-xs text-primary">{o.id}</span>
                                <span className="text-xs text-muted-foreground">{o.date}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <span className="text-xs text-muted-foreground">{o.items.length} items</span>
                                <span className="text-sm font-semibold text-foreground">{formatCurrency(o.total)}</span>
                                <span className={`text-xs px-2 py-0.5 rounded-full ${o.status === 'Delivered' ? 'bg-success/10 text-success' : 'bg-primary/10 text-primary'}`}>{o.status}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-sm text-muted-foreground">No orders yet.</p>}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
        {customerStats.length === 0 && <div className="p-12 text-center text-muted-foreground">No customers found.</div>}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAdd(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-foreground">Add Customer</h3>
              <button onClick={() => setShowAdd(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Name *</label>
                <Input value={newCust.name} onChange={e => setNewCust(p => ({ ...p, name: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Email *</label>
                <Input type="email" value={newCust.email} onChange={e => setNewCust(p => ({ ...p, email: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Phone</label>
                <Input value={newCust.phone} onChange={e => setNewCust(p => ({ ...p, phone: e.target.value }))} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAdd(false)} className="flex-1">Cancel</Button>
                <Button onClick={addCustomer} className="flex-1 gradient-primary text-primary-foreground" disabled={!newCust.name || !newCust.email}>Add</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

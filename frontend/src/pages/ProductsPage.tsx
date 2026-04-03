import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useInventory } from '@/contexts/InventoryContext';
import { categories, formatCurrency, getStockStatus, Product } from '@/lib/mockData';
import { nextPrefixedId } from '@/lib/ids';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search, Plus, Trash2, Edit2, ArrowUpDown, X, Package, Upload, CheckSquare, ChevronDown, ChevronUp, MessageSquare } from 'lucide-react';
import CommentThreadPanel, { countUnreadThreadComments, type ThreadComment } from '@/components/CommentThreadPanel';
import Papa from 'papaparse';

const stockBadge: Record<string, string> = {
  ok: 'bg-success/10 text-success',
  low: 'bg-warning/10 text-warning',
  critical: 'bg-destructive/10 text-destructive',
  out: 'bg-destructive/20 text-destructive font-bold',
};
const stockLabel: Record<string, string> = { ok: 'In Stock', low: 'Low Stock', critical: 'Critical', out: 'Out of Stock' };
const abcColors: Record<string, string> = { A: 'bg-success/15 text-success', B: 'bg-warning/15 text-warning', C: 'bg-muted text-muted-foreground' };
const reasonCodes = ['Damage', 'Theft', 'Audit Correction', 'Return', 'Opening Balance', 'Other'] as const;

const emptyProduct = { name: '', category: 'Electronics', price: 0, cost: 0, stock: 0, minStock: 10, unit: 'pcs', supplier: '', salesLast30: 0, binLocation: 'A-00' };

export default function ProductsPage() {
  const { hasPermission, user } = useAuth();
  const { products, setProducts, getReservedStock, getAvailableStock, addLog, productVariants, setProductVariants, users } = useInventory();
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [abcFilter, setAbcFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'name' | 'price' | 'stock'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newProduct, setNewProduct] = useState(emptyProduct);
  const [showAdjust, setShowAdjust] = useState<string | null>(null);
  const [adjustQty, setAdjustQty] = useState(0);
  const [adjustReason, setAdjustReason] = useState<string>('Audit Correction');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkAdjust, setShowBulkAdjust] = useState(false);
  const [bulkQty, setBulkQty] = useState(0);
  const [bulkReason, setBulkReason] = useState<string>('Audit Correction');
  const [showImport, setShowImport] = useState(false);
  const [importData, setImportData] = useState<Record<string, string>[]>([]);
  const [importMapping, setImportMapping] = useState<Record<string, string>>({});
  const [importHeaders, setImportHeaders] = useState<string[]>([]);
  const [expandedVariant, setExpandedVariant] = useState<string | null>(null);
  const [showVariantModal, setShowVariantModal] = useState<string | null>(null);
  const [variantAttrs, setVariantAttrs] = useState({ sizes: 'S,M,L,XL', colors: 'Red,Blue' });
  const [stockFilterMode, setStockFilterMode] = useState<'all' | 'low'>('all');
  const [commentsOnly, setCommentsOnly] = useState(false);
  const [productComments, setProductComments] = useState<Record<string, ThreadComment[]>>({});
  const [productCommentViewed, setProductCommentViewed] = useState<Record<string, string>>({});
  const [commentProductId, setCommentProductId] = useState<string | null>(null);

  useEffect(() => {
    const apply = () => {
      if (sessionStorage.getItem('inveto:productsFilter') === 'lowStock') {
        setStockFilterMode('low');
        sessionStorage.removeItem('inveto:productsFilter');
      }
    };
    apply();
    window.addEventListener('inveto:nav-intent', apply);
    return () => window.removeEventListener('inveto:nav-intent', apply);
  }, []);

  const isAdmin = user?.role === 'admin';

  // ABC Analysis
  const abcData = useMemo(() => {
    const sorted = [...products].sort((a, b) => (b.price * b.salesLast30) - (a.price * a.salesLast30));
    const totalRev = sorted.reduce((s, p) => s + p.price * p.salesLast30, 0);
    let cumulative = 0;
    const map: Record<string, 'A' | 'B' | 'C'> = {};
    sorted.forEach(p => {
      cumulative += p.price * p.salesLast30;
      const pct = cumulative / totalRev;
      map[p.id] = pct <= 0.8 ? (cumulative - p.price * p.salesLast30 < totalRev * 0.5 ? 'A' : 'B') : 'C';
    });
    // Recalculate properly: top 20% products = A, next 30% = B, rest = C
    const aCount = Math.ceil(sorted.length * 0.2);
    const bCount = Math.ceil(sorted.length * 0.3);
    sorted.forEach((p, i) => {
      if (i < aCount) map[p.id] = 'A';
      else if (i < aCount + bCount) map[p.id] = 'B';
      else map[p.id] = 'C';
    });
    return map;
  }, [products]);

  const abcSummary = useMemo(() => {
    const totalRev = products.reduce((s, p) => s + p.price * p.salesLast30, 0);
    return {
      A: { count: products.filter(p => abcData[p.id] === 'A').length, rev: products.filter(p => abcData[p.id] === 'A').reduce((s, p) => s + p.price * p.salesLast30, 0), pct: 0 },
      B: { count: products.filter(p => abcData[p.id] === 'B').length, rev: products.filter(p => abcData[p.id] === 'B').reduce((s, p) => s + p.price * p.salesLast30, 0), pct: 0 },
      C: { count: products.filter(p => abcData[p.id] === 'C').length, rev: products.filter(p => abcData[p.id] === 'C').reduce((s, p) => s + p.price * p.salesLast30, 0), pct: 0 },
    };
  }, [products, abcData]);
  Object.values(abcSummary).forEach(v => { const total = Object.values(abcSummary).reduce((s, x) => s + x.rev, 0); v.pct = total > 0 ? (v.rev / total) * 100 : 0; });

  const filtered = useMemo(() => {
    const result = products.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) &&
      (categoryFilter === 'All' || p.category === categoryFilter) &&
      (abcFilter === 'All' || abcData[p.id] === abcFilter) &&
      (stockFilterMode === 'all' || getStockStatus(p) !== 'ok') &&
      (!commentsOnly || (productComments[p.id]?.length ?? 0) > 0)
    );
    result.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      if (sortBy === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortBy === 'price') return (a.price - b.price) * dir;
      return (a.stock - b.stock) * dir;
    });
    return result;
  }, [products, search, categoryFilter, abcFilter, sortBy, sortDir, abcData, stockFilterMode, commentsOnly, productComments]);

  const toggleSort = (field: 'name' | 'price' | 'stock') => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('asc'); }
  };

  const deleteProduct = (id: string) => {
    if (isAdmin && confirm('Are you sure you want to delete this product?')) {
      const p = products.find(pr => pr.id === id);
      setProducts(prev => prev.filter(p => p.id !== id));
      addLog(user?.name || 'Admin', 'Deleted Product', `Removed ${p?.name}`);
    }
  };

  const addProduct = () => {
    if (!newProduct.name || !newProduct.supplier || newProduct.price <= 0) return;
    const id = nextPrefixedId('P', products.map((p) => p.id));
    const product: Product = { id, ...newProduct, lastRestocked: new Date().toISOString().split('T')[0] };
    setProducts(prev => [...prev, product]);
    addLog(user?.name || 'System', 'Added Product', `${product.name} (${product.stock} ${product.unit})`);
    setNewProduct(emptyProduct);
    setShowAddModal(false);
  };

  const adjustStock = () => {
    if (!showAdjust || adjustQty === 0) return;
    const p = products.find(pr => pr.id === showAdjust);
    if (!p) return;
    const newStock = Math.max(0, p.stock + adjustQty);
    setProducts(prev => prev.map(pr => pr.id === showAdjust ? { ...pr, stock: newStock } : pr));
    addLog(user?.name || 'System', 'Stock Adjusted', `${p.name}: ${adjustQty > 0 ? '+' : ''}${adjustQty} (${adjustReason}). New stock: ${newStock}.`, {
      editDiff: { old: `Stock ${p.stock} ${p.unit}`, new: `Stock ${newStock} ${p.unit}` },
    });
    setShowAdjust(null);
    setAdjustQty(0);
  };

  const bulkAdjustStock = () => {
    if (selectedIds.size === 0 || bulkQty === 0) return;
    setProducts(prev => prev.map(p => {
      if (!selectedIds.has(p.id)) return p;
      const newStock = Math.max(0, p.stock + bulkQty);
      addLog(user?.name || 'System', 'Bulk Stock Adjusted', `${p.name}: ${bulkQty > 0 ? '+' : ''}${bulkQty} (${bulkReason}). New: ${newStock}`);
      return { ...p, stock: newStock };
    }));
    setSelectedIds(new Set());
    setShowBulkAdjust(false);
    setBulkQty(0);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map(p => p.id)));
  };

  // CSV Import
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      complete: (results) => {
        setImportHeaders(results.meta.fields || []);
        setImportData((results.data as Record<string, string>[]) ?? []);
        const autoMap: Record<string, string> = {};
        const fields = ['name', 'category', 'price', 'cost', 'stock', 'minStock', 'unit', 'supplier', 'salesLast30', 'binLocation'];
        fields.forEach(f => {
          const match = (results.meta.fields || []).find(h => h.toLowerCase().replace(/[^a-z0-9]/g, '').includes(f.toLowerCase()));
          if (match) autoMap[f] = match;
        });
        setImportMapping(autoMap);
        setShowImport(true);
      }
    });
  };

  const confirmImport = () => {
    let skipped = 0;
    const idPool: string[] = products.map((p) => p.id);
    const additions: Product[] = [];
    importData.forEach((row) => {
      const name = row[importMapping.name];
      const price = parseFloat(row[importMapping.price]);
      if (!name || isNaN(price) || price <= 0) {
        skipped++;
        return;
      }
      const id = nextPrefixedId('P', idPool);
      idPool.push(id);
      additions.push({
        id,
        name,
        binLocation: (importMapping.binLocation && row[importMapping.binLocation]) || `Z-${id.replace(/\D/g, '').slice(-2).padStart(2, '0')}`,
        category: row[importMapping.category] || 'Electronics',
        price,
        cost: parseFloat(row[importMapping.cost]) || 0,
        stock: parseInt(row[importMapping.stock]) || 0,
        minStock: parseInt(row[importMapping.minStock]) || 10,
        unit: row[importMapping.unit] || 'pcs',
        supplier: row[importMapping.supplier] || 'Unknown',
        salesLast30: parseInt(row[importMapping.salesLast30]) || 0,
        lastRestocked: new Date().toISOString().split('T')[0],
      });
    });
    const imported = additions.length;
    if (imported > 0) setProducts((prev) => [...prev, ...additions]);
    addLog(user?.name || 'System', 'CSV Import', `Imported ${imported} products, skipped ${skipped}`);
    setShowImport(false);
    setImportData([]);
    alert(`Imported: ${imported}, Skipped: ${skipped}`);
  };

  // Variant generation
  const generateVariants = (productId: string) => {
    const sizes = variantAttrs.sizes.split(',').map(s => s.trim()).filter(Boolean);
    const colors = variantAttrs.colors.split(',').map(s => s.trim()).filter(Boolean);
    const p = products.find(pr => pr.id === productId);
    if (!p) return;
    const variants = sizes.flatMap(size => colors.map(color => ({
      sku: `${productId}-${size}-${color}`.toUpperCase(),
      attributes: { Size: size, Color: color },
      stock: Math.floor(p.stock / (sizes.length * colors.length)),
      price: p.price,
    })));
    setProductVariants(prev => ({ ...prev, [productId]: variants }));
    addLog(user?.name || 'System', 'Variants Created', `${p.name}: ${variants.length} variants generated`);
    setShowVariantModal(null);
  };

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ABC Summary */}
      <div className="grid grid-cols-3 gap-3">
        {(['A', 'B', 'C'] as const).map(grade => (
          <div key={grade} className="stat-card cursor-pointer" onClick={() => setAbcFilter(abcFilter === grade ? 'All' : grade)}>
            <div className="flex items-center justify-between">
              <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${abcColors[grade]}`}>{grade}</span>
              <span className="text-xs text-muted-foreground">{abcSummary[grade].pct.toFixed(0)}% revenue</span>
            </div>
            <p className="text-xl font-display font-bold text-foreground mt-1">{abcSummary[grade].count} products</p>
            <p className="text-xs text-muted-foreground">{formatCurrency(abcSummary[grade].rev)}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search products..." className="pl-10 h-10" />
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-10 px-4 rounded-lg border border-input bg-card text-foreground text-sm">
          <option value="All">All Categories</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button
          type="button"
          onClick={() => setStockFilterMode((m) => (m === 'low' ? 'all' : 'low'))}
          className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors ${
            stockFilterMode === 'low'
              ? 'border-warning bg-warning/15 text-warning'
              : 'border-input bg-card text-foreground hover:bg-secondary'
          }`}
        >
          Low / critical stock
        </button>
        <button
          type="button"
          onClick={() => setCommentsOnly((c) => !c)}
          className={`h-10 px-4 rounded-lg border text-sm font-medium transition-colors ${
            commentsOnly ? 'border-primary bg-primary/10 text-primary' : 'border-input bg-card text-foreground hover:bg-secondary'
          }`}
        >
          Comments
        </button>
        {selectedIds.size > 0 && hasPermission('edit') && (
          <Button onClick={() => setShowBulkAdjust(true)} variant="outline" className="gap-2">
            <CheckSquare className="h-4 w-4" /> Bulk Adjust ({selectedIds.size})
          </Button>
        )}
        {hasPermission('add') && (
          <>
            <label className="cursor-pointer">
              <input type="file" accept=".csv,.xlsx" onChange={handleFileUpload} className="hidden" />
              <span className="inline-flex items-center gap-2 h-10 px-4 rounded-lg border border-input bg-card text-foreground text-sm hover:bg-secondary transition-colors cursor-pointer">
                <Upload className="h-4 w-4" /> Import CSV
              </span>
            </label>
            <Button onClick={() => setShowAddModal(true)} className="gradient-primary text-primary-foreground gap-2">
              <Plus className="h-4 w-4" /> Add Product
            </Button>
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                {hasPermission('edit') && <th className="px-3 py-3 text-center"><input type="checkbox" checked={selectedIds.size === filtered.length && filtered.length > 0} onChange={toggleAll} className="rounded" /></th>}
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">ID</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('name')}>
                  <span className="flex items-center gap-1">Product <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Category</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">ABC</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('price')}>
                  <span className="flex items-center gap-1">Price <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer" onClick={() => toggleSort('stock')}>
                  <span className="flex items-center gap-1">Total <ArrowUpDown className="h-3 w-3" /></span>
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Avail</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reserved</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const status = getStockStatus(p);
                const reserved = getReservedStock(p.id);
                const available = getAvailableStock(p.id);
                const variants = productVariants[p.id];
                const unread = countUnreadThreadComments(productComments[p.id] ?? [], productCommentViewed[p.id]);
                return (
                  <React.Fragment key={p.id}>
                    <tr className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                      {hasPermission('edit') && <td className="px-3 py-3 text-center"><input type="checkbox" checked={selectedIds.has(p.id)} onChange={() => toggleSelect(p.id)} className="rounded" /></td>}
                      <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{p.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div>
                            <p className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                              {p.name}
                              {unread > 0 && (
                                <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
                                  {unread > 9 ? '9+' : unread}
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground">{p.supplier}</p>
                          </div>
                          {variants && <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary">{variants.length} variants</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{p.category}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2 py-0.5 rounded-full font-bold ${abcColors[abcData[p.id]]}`}>{abcData[p.id]}</span></td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{formatCurrency(p.price)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-foreground">{p.stock}</td>
                      <td className="px-4 py-3 text-sm font-medium text-success">{available}</td>
                      <td className="px-4 py-3 text-sm text-warning">{reserved > 0 ? reserved : '—'}</td>
                      <td className="px-4 py-3"><span className={`text-xs px-2.5 py-1 rounded-full font-medium ${stockBadge[status]}`}>{stockLabel[status]}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {hasPermission('edit') && (
                            <>
                              <button
                                type="button"
                                onClick={() => setCommentProductId(p.id)}
                                className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground"
                                title="Comments"
                              >
                                <MessageSquare className="h-4 w-4" />
                              </button>
                              <button onClick={() => { setShowAdjust(p.id); setAdjustQty(0); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Adjust Stock">
                                <Package className="h-4 w-4" />
                              </button>
                              {!variants && (
                                <button onClick={() => { setShowVariantModal(p.id); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground" title="Add Variants">
                                  <Edit2 className="h-4 w-4" />
                                </button>
                              )}
                              {variants && (
                                <button onClick={() => setExpandedVariant(expandedVariant === p.id ? null : p.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors text-muted-foreground hover:text-foreground">
                                  {expandedVariant === p.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                                </button>
                              )}
                            </>
                          )}
                          {isAdmin && (
                            <button onClick={() => deleteProduct(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {expandedVariant === p.id && variants && (
                      <tr>
                        <td colSpan={11} className="px-8 py-3 bg-secondary/20">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {variants.map(v => (
                              <div key={v.sku} className="p-3 rounded-lg bg-card border border-border/50">
                                <p className="text-xs font-mono text-primary">{v.sku}</p>
                                <p className="text-sm text-foreground">{Object.entries(v.attributes).map(([k, val]) => `${k}: ${val}`).join(' · ')}</p>
                                <p className="text-xs text-muted-foreground">Stock: {v.stock} · {formatCurrency(v.price)}</p>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && <div className="p-12 text-center text-muted-foreground">No products found matching your criteria.</div>}
      </div>

      {/* Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAddModal(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-lg shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-display font-bold text-foreground">Add New Product</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1.5 rounded-lg hover:bg-secondary text-muted-foreground"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Product Name *</label>
                <Input value={newProduct.name} onChange={e => setNewProduct(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Wireless Headphones" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Category</label>
                  <select value={newProduct.category} onChange={e => setNewProduct(p => ({ ...p, category: e.target.value }))}
                    className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                    {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Unit</label>
                  <Input value={newProduct.unit} onChange={e => setNewProduct(p => ({ ...p, unit: e.target.value }))} placeholder="pcs" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Price (₹) *</label>
                  <Input type="number" value={newProduct.price || ''} onChange={e => setNewProduct(p => ({ ...p, price: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Cost (₹)</label>
                  <Input type="number" value={newProduct.cost || ''} onChange={e => setNewProduct(p => ({ ...p, cost: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Initial Stock</label>
                  <Input type="number" value={newProduct.stock || ''} onChange={e => setNewProduct(p => ({ ...p, stock: Number(e.target.value) }))} />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1 block">Min Stock Level</label>
                  <Input type="number" value={newProduct.minStock || ''} onChange={e => setNewProduct(p => ({ ...p, minStock: Number(e.target.value) }))} />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Supplier *</label>
                <Input value={newProduct.supplier} onChange={e => setNewProduct(p => ({ ...p, supplier: e.target.value }))} placeholder="e.g. TechWorld Pvt Ltd" />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Bin location</label>
                <Input value={newProduct.binLocation} onChange={e => setNewProduct(p => ({ ...p, binLocation: e.target.value }))} placeholder="e.g. A-01" />
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAddModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={addProduct} className="flex-1 gradient-primary text-primary-foreground"
                  disabled={!newProduct.name || !newProduct.supplier || newProduct.price <= 0}>Add Product</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Adjust Modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowAdjust(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">Adjust Stock</h3>
            <p className="text-sm text-muted-foreground mb-4">{products.find(p => p.id === showAdjust)?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Reason *</label>
                <select value={adjustReason} onChange={e => setAdjustReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                  {reasonCodes.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Quantity (+/-) *</label>
                <Input type="number" value={adjustQty} onChange={e => setAdjustQty(Number(e.target.value))} />
                <p className="text-xs text-muted-foreground mt-1">Positive = stock in, Negative = stock out</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowAdjust(null)} className="flex-1">Cancel</Button>
                <Button onClick={adjustStock} className="flex-1 gradient-primary text-primary-foreground" disabled={adjustQty === 0}>Confirm</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Adjust Modal */}
      {showBulkAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowBulkAdjust(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">Bulk Stock Adjust ({selectedIds.size} products)</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Reason</label>
                <select value={bulkReason} onChange={e => setBulkReason(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                  {reasonCodes.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Quantity (+/-)</label>
                <Input type="number" value={bulkQty} onChange={e => setBulkQty(Number(e.target.value))} />
              </div>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowBulkAdjust(false)} className="flex-1">Cancel</Button>
                <Button onClick={bulkAdjustStock} className="flex-1 gradient-primary text-primary-foreground" disabled={bulkQty === 0}>Apply to All</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CSV Import Mapping Modal */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowImport(false)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-2xl shadow-lg animate-fade-in max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">Map CSV Columns</h3>
            <p className="text-sm text-muted-foreground mb-4">{importData.length} rows found</p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              {['name', 'category', 'price', 'cost', 'stock', 'minStock', 'unit', 'supplier', 'binLocation'].map(field => (
                <div key={field}>
                  <label className="text-xs font-medium text-foreground mb-1 block capitalize">{field} {field === 'name' || field === 'price' ? '*' : ''}</label>
                  <select value={importMapping[field] || ''} onChange={e => setImportMapping(p => ({ ...p, [field]: e.target.value }))}
                    className="w-full h-9 px-3 rounded-lg border border-input bg-card text-foreground text-sm">
                    <option value="">— unmapped —</option>
                    {importHeaders.map(h => <option key={h}>{h}</option>)}
                  </select>
                </div>
              ))}
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setShowImport(false)} className="flex-1">Cancel</Button>
              <Button onClick={confirmImport} className="flex-1 gradient-primary text-primary-foreground" disabled={!importMapping.name || !importMapping.price}>Import</Button>
            </div>
          </div>
        </div>
      )}

      <CommentThreadPanel
        open={!!commentProductId}
        onClose={() => setCommentProductId(null)}
        title={commentProductId ? `Product ${products.find((x) => x.id === commentProductId)?.name ?? commentProductId}` : ''}
        comments={commentProductId ? productComments[commentProductId] ?? [] : []}
        users={users.map((u) => ({ id: u.id, name: u.name }))}
        currentUser={{ id: user?.id ?? '0', name: user?.name ?? 'User' }}
        onAfterOpen={() => {
          if (commentProductId) {
            setProductCommentViewed((v) => ({ ...v, [commentProductId]: new Date().toISOString() }));
          }
        }}
        onSend={(text, mentions) => {
          if (!commentProductId) return;
          const msg: ThreadComment = {
            id: `pc_${Date.now()}`,
            userId: user?.id ?? '0',
            userName: user?.name ?? 'User',
            text,
            ts: new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' }),
            mentions,
          };
          setProductComments((prev) => ({
            ...prev,
            [commentProductId]: [...(prev[commentProductId] ?? []), msg],
          }));
        }}
      />

      {/* Variant Modal */}
      {showVariantModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm" onClick={() => setShowVariantModal(null)}>
          <div className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-lg animate-fade-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-lg font-display font-bold text-foreground mb-4">Create Variants</h3>
            <p className="text-sm text-muted-foreground mb-4">{products.find(p => p.id === showVariantModal)?.name}</p>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Sizes (comma-separated)</label>
                <Input value={variantAttrs.sizes} onChange={e => setVariantAttrs(p => ({ ...p, sizes: e.target.value }))} />
              </div>
              <div>
                <label className="text-sm font-medium text-foreground mb-1 block">Colors (comma-separated)</label>
                <Input value={variantAttrs.colors} onChange={e => setVariantAttrs(p => ({ ...p, colors: e.target.value }))} />
              </div>
              <p className="text-xs text-muted-foreground">Will generate {variantAttrs.sizes.split(',').filter(Boolean).length * variantAttrs.colors.split(',').filter(Boolean).length} variant SKUs</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setShowVariantModal(null)} className="flex-1">Cancel</Button>
                <Button onClick={() => generateVariants(showVariantModal)} className="flex-1 gradient-primary text-primary-foreground">Generate</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

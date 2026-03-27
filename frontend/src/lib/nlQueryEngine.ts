import type { Order, Product } from '@/lib/mockData';

// ── Natural Language Query Engine ──
export interface QueryResult {
  type: 'products' | 'orders' | 'text';
  title: string;
  items: { label: string; value: string; sublabel?: string }[];
}

export function processNLQuery(query: string, products: Product[], orders: Order[]): QueryResult | null {
  const q = query.toLowerCase().trim();

  // Stock out predictions
  if (q.includes('run out') || q.includes('stockout') || q.includes('out of stock') || q.includes('stock out')) {
    const daysMatch = q.match(/(\d+)\s*days?/);
    const days = daysMatch ? parseInt(daysMatch[1]) : 10;
    const items = products.filter(p => {
      if (p.salesLast30 === 0) return false;
      const dailyRate = p.salesLast30 / 30;
      const daysLeft = Math.floor(p.stock / dailyRate);
      return daysLeft <= days;
    }).map(p => {
      const dailyRate = p.salesLast30 / 30;
      const daysLeft = Math.floor(p.stock / dailyRate);
      return { label: p.name, value: `${daysLeft} days left`, sublabel: `${p.stock} ${p.unit} · ${dailyRate.toFixed(1)}/day` };
    });
    return { type: 'products', title: `Products running out within ${days} days`, items };
  }

  // Low stock
  if (q.includes('low stock') || q.includes('low inventory') || q.includes('critical stock')) {
    const items = products.filter(p => p.stock <= p.minStock && p.stock > 0).map(p => ({
      label: p.name, value: `${p.stock} left`, sublabel: `Min: ${p.minStock} ${p.unit}`
    }));
    return { type: 'products', title: 'Low Stock Products', items };
  }

  // Top sellers
  if (q.includes('top sell') || q.includes('best sell') || q.includes('most sold') || q.includes('top product')) {
    const n = parseInt(q.match(/(\d+)/)?.[1] || '5');
    const items = [...products].sort((a, b) => b.salesLast30 - a.salesLast30).slice(0, n).map((p, i) => ({
      label: `#${i + 1} ${p.name}`, value: `${p.salesLast30} sold`, sublabel: p.category
    }));
    return { type: 'products', title: `Top ${n} Selling Products`, items };
  }

  // Bottom sellers
  if (q.includes('worst sell') || q.includes('least sold') || q.includes('bottom') || q.includes('dead stock')) {
    const items = [...products].sort((a, b) => a.salesLast30 - b.salesLast30).slice(0, 5).map((p, i) => ({
      label: `#${i + 1} ${p.name}`, value: `${p.salesLast30} sold`, sublabel: p.category
    }));
    return { type: 'products', title: 'Worst Selling Products', items };
  }

  // Category filter
  const catMatch = q.match(/(?:category|in)\s+(\w[\w\s&]*)/i);
  if (catMatch || q.includes('electronics') || q.includes('clothing') || q.includes('food') || q.includes('sports') || q.includes('beauty') || q.includes('toys') || q.includes('books') || q.includes('home')) {
    const categories = ['Electronics', 'Clothing', 'Food & Beverages', 'Home & Garden', 'Sports', 'Beauty', 'Toys', 'Books'];
    const cat = categories.find(c => q.includes(c.toLowerCase().split(' ')[0].toLowerCase()));
    if (cat) {
      const items = products.filter(p => p.category === cat).map(p => ({
        label: p.name, value: `${p.stock} in stock`, sublabel: `₹${p.price}`
      }));
      return { type: 'products', title: `${cat} Products`, items };
    }
  }

  // Order status
  if (q.includes('order') || q.includes('pending') || q.includes('shipped') || q.includes('delivered') || q.includes('placed')) {
    const statusMatch = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].find(s => q.includes(s.toLowerCase()));
    if (statusMatch) {
      const items = orders.filter((o) => o.status === statusMatch).map((o) => ({
        label: `${o.id} — ${o.customerName}`, value: `₹${o.total}`, sublabel: o.date
      }));
      return { type: 'orders', title: `${statusMatch} Orders`, items };
    }
    // All recent orders
    const items = orders.slice(0, 10).map((o) => ({
      label: `${o.id} — ${o.customerName}`, value: `₹${o.total} · ${o.status}`, sublabel: o.date
    }));
    return { type: 'orders', title: 'Recent Orders', items };
  }

  // Profit
  if (q.includes('profit') || q.includes('margin') || q.includes('most profitable')) {
    const items = [...products].sort((a, b) => (b.price - b.cost) * b.salesLast30 - (a.price - a.cost) * a.salesLast30).slice(0, 5).map((p, i) => ({
      label: `#${i + 1} ${p.name}`, value: `₹${((p.price - p.cost) * p.salesLast30).toLocaleString()} profit`, sublabel: `${(((p.price - p.cost) / p.price) * 100).toFixed(1)}% margin`
    }));
    return { type: 'products', title: 'Most Profitable Products', items };
  }

  // Revenue
  if (q.includes('revenue') || q.includes('sales total') || q.includes('how much')) {
    const totalRev = products.reduce((s, p) => s + p.price * p.salesLast30, 0);
    return { type: 'text', title: 'Revenue Summary', items: [
      { label: 'Total Revenue (30d)', value: `₹${totalRev.toLocaleString()}` },
      { label: 'Total Products', value: String(products.length) },
      { label: 'Total Units Sold', value: String(products.reduce((s, p) => s + p.salesLast30, 0)) },
    ]};
  }

  return null;
}

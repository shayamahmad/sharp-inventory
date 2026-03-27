import type { Order, Product } from '@/lib/mockData';

export interface MonthlySalesRow {
  month: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface CategorySalesRow {
  name: string;
  value: number;
}

/** Revenue / profit by calendar month from orders + product costs (excludes Cancelled). */
export function buildMonthlySalesFromOrders(orders: Order[], products: Product[]): MonthlySalesRow[] {
  const costByProduct = new Map(products.map((p) => [p.id, p.cost]));
  const byMonth = new Map<string, { revenue: number; profit: number; orders: number }>();

  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    const key = o.date.length >= 7 ? o.date.slice(0, 7) : o.date;
    let profit = 0;
    for (const it of o.items) {
      const c = costByProduct.get(it.productId) ?? 0;
      profit += it.quantity * (it.price - c);
    }
    const cur = byMonth.get(key) ?? { revenue: 0, profit: 0, orders: 0 };
    cur.revenue += o.total;
    cur.profit += profit;
    cur.orders += 1;
    byMonth.set(key, cur);
  }

  const months = [...byMonth.keys()].sort();
  return months.map((month) => ({ month, ...byMonth.get(month)! }));
}

/** Category revenue from product 30d movement (same basis as product cards). */
export function buildCategorySalesFromProducts(products: Product[]): CategorySalesRow[] {
  const m = new Map<string, number>();
  for (const p of products) {
    m.set(p.category, (m.get(p.category) ?? 0) + p.price * p.salesLast30);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

/** Fallback when there are no dated orders yet. */
export function fallbackMonthlyFromProducts(products: Product[], orderCount: number): MonthlySalesRow[] {
  const revenue = products.reduce((s, p) => s + p.price * p.salesLast30, 0);
  const profit = products.reduce((s, p) => s + (p.price - p.cost) * p.salesLast30, 0);
  return [{ month: 'Portfolio (30d)', revenue, profit, orders: orderCount }];
}

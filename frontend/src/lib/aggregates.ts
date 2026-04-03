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

/** Last `count` calendar months ending at `endYm` (YYYY-MM), oldest first. */
export function monthRange(endYm: string, count: number): string[] {
  const parts = endYm.split('-').map(Number);
  const y = parts[0]!;
  const m = parts[1]!;
  if (!y || !m) return [endYm];
  const end = new Date(y, m - 1, 1);
  const list: string[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1);
    list.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return list;
}

/** Short label for chart axis, e.g. 2026-03 → Mar '26 */
export function formatChartMonth(ym: string): string {
  if (ym.length < 7) return ym;
  const [yy, mm] = ym.split('-').map(Number);
  if (!yy || !mm) return ym;
  const d = new Date(yy, mm - 1, 1);
  return d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
}

/** Raw revenue / profit by calendar month from orders (excludes Cancelled). */
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

/**
 * Chart-ready series: fills missing months with zeros so line/area charts always have
 * multiple points (seed data is often a single month like 2026-03).
 */
export function buildMonthlySalesChartSeries(
  orders: Order[],
  products: Product[],
  trailingMonths = 8
): MonthlySalesRow[] {
  const byMonth = new Map<string, { revenue: number; profit: number; orders: number }>();
  const costByProduct = new Map(products.map((p) => [p.id, p.cost]));

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

  const keys = [...byMonth.keys()].sort();
  if (keys.length === 0) {
    return fallbackMonthlyFromProducts(products, orders.length, trailingMonths);
  }

  const endYm = keys[keys.length - 1]!;
  const range = monthRange(endYm, trailingMonths);
  return range.map((month) => ({
    month,
    revenue: byMonth.get(month)?.revenue ?? 0,
    profit: byMonth.get(month)?.profit ?? 0,
    orders: byMonth.get(month)?.orders ?? 0,
  }));
}

/** Category revenue from product 30d movement (same basis as product cards). */
export function buildCategorySalesFromProducts(products: Product[]): CategorySalesRow[] {
  const m = new Map<string, number>();
  for (const p of products) {
    m.set(p.category, (m.get(p.category) ?? 0) + p.price * p.salesLast30);
  }
  return [...m.entries()].map(([name, value]) => ({ name, value }));
}

/** When there are no dated orders — spread 30d portfolio across trailing months so charts render a line. */
export function fallbackMonthlyFromProducts(
  products: Product[],
  orderCount: number,
  trailingMonths = 8
): MonthlySalesRow[] {
  const revenue = products.reduce((s, p) => s + p.price * p.salesLast30, 0);
  const profit = products.reduce((s, p) => s + (p.price - p.cost) * p.salesLast30, 0);
  const endYm = new Date().toISOString().slice(0, 7);
  const range = monthRange(endYm, trailingMonths);
  const n = range.length || 1;
  const baseRev = revenue / n;
  const baseProf = profit / n;
  const baseOrd = orderCount / n;
  return range.map((month, i) => {
    const w = 0.82 + (i / Math.max(n - 1, 1)) * 0.36;
    return {
      month,
      revenue: Math.round(baseRev * w),
      profit: Math.round(baseProf * w),
      orders: Math.max(0, Math.round(baseOrd * w)),
    };
  });
}

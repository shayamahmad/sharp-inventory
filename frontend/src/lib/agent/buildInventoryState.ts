import type { Product, Order } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';
import type { InventoryState, Supplier } from './types';

const MS_PER_DAY = 86_400_000;

function safeNum(n: unknown): number {
  const x = Number(n);
  return Number.isFinite(x) ? x : 0;
}

function daysUntilStockoutProduct(p: Product): number | null {
  const sales = safeNum(p.salesLast30);
  const stock = safeNum(p.stock);
  if (sales <= 0 || stock < 0) return null;
  const daily = sales / 30;
  if (daily <= 0) return null;
  const days = Math.floor(stock / daily);
  return Number.isFinite(days) ? days : null;
}

function supplierLeadFromPos(pos: readonly PurchaseOrder[], supplierName: string): number {
  const completed = pos.filter(
    (po) => po.supplier === supplierName && po.dateSent && po.dateReceived
  );
  if (completed.length === 0) return 7;
  let sum = 0;
  let n = 0;
  for (const po of completed) {
    const t0 = new Date(po.dateSent!).getTime();
    const t1 = new Date(po.dateReceived!).getTime();
    if (!Number.isFinite(t0) || !Number.isFinite(t1) || t1 < t0) continue;
    sum += Math.ceil((t1 - t0) / MS_PER_DAY);
    n++;
  }
  if (n === 0) return 7;
  return Math.max(1, Math.round(sum / n));
}

function uniqueSupplierNames(products: readonly Product[], pos: readonly PurchaseOrder[]): string[] {
  const s = new Set<string>();
  products.forEach((p) => {
    if (p.supplier?.trim()) s.add(p.supplier.trim());
  });
  pos.forEach((po) => {
    if (po.supplier?.trim()) s.add(po.supplier.trim());
  });
  return [...s].sort();
}

/**
 * Pure adapter: builds agent snapshot from existing app collections (no mutation).
 */
export function buildInventoryState(
  products: readonly Product[],
  purchaseOrders: readonly PurchaseOrder[],
  orders: readonly Order[]
): InventoryState {
  const dailySalesRate: Record<string, number> = {};
  const daysUntilStockout: Record<string, number> = {};

  for (const p of products) {
    const sales = safeNum(p.salesLast30);
    dailySalesRate[p.id] = sales / 30;
    const d = daysUntilStockoutProduct(p);
    if (d != null) daysUntilStockout[p.id] = d;
  }

  const names = uniqueSupplierNames(products, purchaseOrders);
  const suppliers: Supplier[] = names.map((name) => ({
    id: slugId(name),
    name,
    leadTimeDays: supplierLeadFromPos(purchaseOrders, name),
  }));

  return {
    products,
    purchaseOrders,
    suppliers,
    orders,
    metrics: { dailySalesRate, daysUntilStockout },
  };
}

function slugId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 64) || 'supplier';
}

import type { Product } from '@/lib/mockData';
import { computeInventoryHealth } from '@/lib/inventoryHealthScore';
import type { Order } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';

export type VoiceNavIntent = {
  page: string;
  openPurchaseOrderModal?: boolean;
  productsLowStock?: boolean;
  scrollDashboardAnomalies?: boolean;
};

const PAGE_SYNONYMS: [RegExp, string][] = [
  [/(dashboard|home|overview)/i, 'dashboard'],
  [/(products?|inventory|catalog)/i, 'products'],
  [/(^orders?$|sales orders)/i, 'orders'],
  [/(customers?)/i, 'customers'],
  [/(analytics|reports?)/i, 'analytics'],
  [/(alerts?|notifications?)/i, 'alerts'],
  [/(purchase orders?|p\.?\s*o\.?s?)/i, 'purchaseOrders'],
  [/(manufacturing|production|bom)/i, 'manufacturing'],
  [/(replenishment|reorder)/i, 'replenishment'],
  [/(predictions?|demand forecast)/i, 'predictions'],
  [/(cash flow|cashflow)/i, 'cashFlow'],
  [/(quotations?|quotes?)/i, 'quotations'],
  [/(activity|logs?)/i, 'activity'],
  [/(users?|staff)/i, 'users'],
  [/(simulation|what[- ]?if|digital twin)/i, 'simulation'],
];

export function matchGoToPage(text: string): string | null {
  const m = text.match(/go to\s+(.+)/i);
  if (!m) return null;
  const target = m[1].trim();
  for (const [pat, id] of PAGE_SYNONYMS) {
    if (pat.test(target)) return id;
  }
  return null;
}

export function matchStockQuestion(
  text: string,
  products: Product[]
): { label: string; count: number } | null {
  const m = text.match(/how many units (?:of|for)?\s*(.+)/i);
  if (!m) return null;
  const q = m[1].replace(/\?/g, '').trim().toLowerCase();
  if (!q) return null;

  const byProduct = products.find(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      q.includes(p.name.toLowerCase().slice(0, Math.min(8, p.name.length)))
  );
  if (byProduct) return { label: byProduct.name, count: byProduct.stock };

  const byCat = products.filter((p) => p.category.toLowerCase().includes(q) || q.includes(p.category.toLowerCase()));
  if (byCat.length > 0) {
    const count = byCat.reduce((s, p) => s + p.stock, 0);
    return { label: `category “${byCat[0].category}”`, count };
  }
  return null;
}

export function processVoiceTranscript(
  raw: string,
  ctx: {
    products: Product[];
    orders: Order[];
    purchaseOrders: PurchaseOrder[];
  }
): { type: 'toast'; message: string } | { type: 'nav'; intent: VoiceNavIntent } | { type: 'none' } {
  const text = raw.toLowerCase().trim();

  if (/show\s+low\s+stock|low\s+stock/i.test(text)) {
    return { type: 'nav', intent: { page: 'products', productsLowStock: true } };
  }
  if (/critical\s+alerts?/i.test(text)) {
    return { type: 'nav', intent: { page: 'alerts' } };
  }
  if (/create\s+purchase\s+order|new\s+purchase\s+order|open\s+po/i.test(text)) {
    return { type: 'nav', intent: { page: 'purchaseOrders', openPurchaseOrderModal: true } };
  }
  if (/health\s+score|inventory\s+health/i.test(text)) {
    const h = computeInventoryHealth(ctx.products, ctx.orders, ctx.purchaseOrders);
    return { type: 'toast', message: `Inventory health score: ${h.total} / 100` };
  }
  if (/top\s+sellers?/i.test(text)) {
    return { type: 'nav', intent: { page: 'analytics' } };
  }
  if (/anomalies?/i.test(text)) {
    return { type: 'nav', intent: { page: 'dashboard', scrollDashboardAnomalies: true } };
  }

  const page = matchGoToPage(text);
  if (page) return { type: 'nav', intent: { page } };

  const stock = matchStockQuestion(text, ctx.products);
  if (stock) {
    return { type: 'toast', message: `${stock.label}: ${stock.count} units in stock` };
  }

  return { type: 'none' };
}

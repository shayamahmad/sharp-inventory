import type { Product } from '@/lib/mockData';
import { computeInventoryHealth } from '@/lib/inventoryHealthScore';
import type { Order } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';
import type { Customer } from '@/contexts/InventoryContext';
import { processNLQuery, type QueryResult } from '@/lib/nlQueryEngine';
import { formatCurrency } from '@/lib/mockData';

export type VoiceNavIntent = {
  page: string;
  openPurchaseOrderModal?: boolean;
  productsLowStock?: boolean;
  scrollDashboardAnomalies?: boolean;
};

export type VoiceProcessResult =
  | { type: 'toast'; message: string }
  | { type: 'nav'; intent: VoiceNavIntent }
  | { type: 'none'; heard: string };

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

/** Match "open X" / "show X page" */
export function matchOpenPage(text: string): string | null {
  const m = text.match(/(?:open|show|take me to)\s+(?:the\s+)?(.+)/i);
  if (!m) return null;
  const target = m[1]
    .replace(/\s+page$/i, '')
    .replace(/^the\s+/i, '')
    .trim();
  for (const [pat, id] of PAGE_SYNONYMS) {
    if (pat.test(target)) return id;
  }
  return null;
}

export function matchStockQuestion(
  text: string,
  products: Product[]
): { label: string; count: number } | null {
  const patterns = [
    /how many units (?:of|for)?\s*(.+)/i,
    /how much stock (?:do we have )?(?:for|of|on)?\s*(.+)/i,
    /stock (?:for|of|level)\s+(.+)/i,
    /units (?:left|remaining) (?:for|on)?\s*(.+)/i,
  ];
  let q = '';
  for (const p of patterns) {
    const m = text.match(p);
    if (m) {
      q = m[1].replace(/\?/g, '').trim().toLowerCase();
      break;
    }
  }
  if (!q) return null;

  const byProduct = products.find(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      q.includes(p.name.toLowerCase().slice(0, Math.min(10, p.name.length)))
  );
  if (byProduct) return { label: byProduct.name, count: byProduct.stock };

  const byCat = products.filter(
    (p) => p.category.toLowerCase().includes(q) || q.includes(p.category.toLowerCase().split(' ')[0] ?? '')
  );
  if (byCat.length > 0) {
    const count = byCat.reduce((s, p) => s + p.stock, 0);
    return { label: `category “${byCat[0].category}”`, count };
  }
  return null;
}

function fuzzyProduct(products: Product[], phrase: string): Product | null {
  const q = phrase.replace(/\?/g, '').trim().toLowerCase();
  if (q.length < 2) return null;
  return (
    products.find(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        q.split(/\s+/).some((w) => w.length > 2 && p.name.toLowerCase().includes(w))
    ) ?? null
  );
}

/** Turn NL / structured query into one spoken line + detail for toast */
export function queryResultToVoiceSummary(result: QueryResult, maxItems = 5): string {
  const lines: string[] = [result.title];
  const slice = result.items.slice(0, maxItems);
  for (const it of slice) {
    const sub = it.sublabel ? ` (${it.sublabel})` : '';
    lines.push(`• ${it.label}: ${it.value}${sub}`);
  }
  if (result.items.length > maxItems) {
    lines.push(`…and ${result.items.length - maxItems} more — see Analytics or Dashboard for full lists.`);
  }
  return lines.join('\n');
}

function orderRevenue(orders: Order[]): number {
  return orders.filter((o) => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
}

function fallbackInventoryAnswer(
  text: string,
  ctx: {
    products: Product[];
    orders: Order[];
    purchaseOrders: PurchaseOrder[];
    customers: Customer[];
  }
): string | null {
  const q = text.toLowerCase().trim();

  if (/(how many|number of|count).*customer/.test(q) || /total customer/.test(q)) {
    return `You have ${ctx.customers.length} customers in Inveron.`;
  }
  if (/(how many|number of|count).*order/.test(q) && !/pending|status|placed|processing/.test(q)) {
    return `There are ${ctx.orders.length} orders on record.`;
  }
  if (/pending order|orders pending|open order/.test(q)) {
    const n = ctx.orders.filter((o) => o.status === 'Placed' || o.status === 'Processing').length;
    return `${n} orders are Placed or Processing.`;
  }
  if (/delivered order|completed order/.test(q)) {
    const n = ctx.orders.filter((o) => o.status === 'Delivered').length;
    return `${n} orders are Delivered.`;
  }
  if (/revenue from order|order revenue|sales from order|total sales/i.test(text)) {
    return `Order-based revenue (non-cancelled) is about ${formatCurrency(orderRevenue(ctx.orders))}.`;
  }
  if (/how many product|product count|sku|items in catalog/.test(q)) {
    return `You have ${ctx.products.length} products in the catalog.`;
  }
  if (/purchase order| p o |how many po/.test(q) && /how many|count|active|open/.test(q)) {
    const active = ctx.purchaseOrders.filter((po) => po.status !== 'Closed').length;
    return `${ctx.purchaseOrders.length} purchase orders total; ${active} are not closed.`;
  }

  const priceM = text.match(/(?:price|cost|how much (?:is|for)|what(?:'s| is) the price of)\s+(.+)/i);
  if (priceM) {
    const p = fuzzyProduct(ctx.products, priceM[1]);
    if (p) {
      return `${p.name} is ${formatCurrency(p.price)} per ${p.unit}, ${p.stock} in stock, category ${p.category}.`;
    }
  }

  const aboutM = text.match(/(?:tell me about|what (?:do you know|can you say) about|info (?:on|about))\s+(.+)/i);
  if (aboutM) {
    const p = fuzzyProduct(ctx.products, aboutM[1]);
    if (p) {
      return `${p.name}: ${p.stock} ${p.unit} at ${formatCurrency(p.price)}, min stock ${p.minStock}, supplier ${p.supplier}.`;
    }
    const cust = ctx.customers.find(
      (c) =>
        c.name.toLowerCase().includes(aboutM[1].toLowerCase().slice(0, 20)) ||
        c.email.toLowerCase().includes(aboutM[1].toLowerCase().trim())
    );
    if (cust) {
      const oc = ctx.orders.filter((o) => o.customerName === cust.name).length;
      return `${cust.name}, ${cust.email}. ${oc} orders under that name.`;
    }
  }

  return null;
}

export function processVoiceTranscript(
  raw: string,
  ctx: {
    products: Product[];
    orders: Order[];
    purchaseOrders: PurchaseOrder[];
    customers?: Customer[];
  }
): VoiceProcessResult {
  const text = raw.trim();
  const textLower = text.toLowerCase();
  const customers = ctx.customers ?? [];

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
    return { type: 'toast', message: `Inventory health score: ${h.total} out of 100.` };
  }
  if (/top\s+sellers?/i.test(text)) {
    return { type: 'nav', intent: { page: 'analytics' } };
  }
  if (/anomalies?/i.test(text)) {
    return { type: 'nav', intent: { page: 'dashboard', scrollDashboardAnomalies: true } };
  }

  let page = matchGoToPage(textLower);
  if (!page) page = matchOpenPage(textLower);
  if (page) return { type: 'nav', intent: { page } };

  const stock = matchStockQuestion(textLower, ctx.products);
  if (stock) {
    return { type: 'toast', message: `${stock.label}: ${stock.count} units in stock.` };
  }

  const nl = processNLQuery(text, ctx.products, ctx.orders);
  if (nl && nl.items.length > 0) {
    return { type: 'toast', message: queryResultToVoiceSummary(nl) };
  }
  if (nl && nl.items.length === 0) {
    return {
      type: 'toast',
      message: `${nl.title}: no matching rows in your current Inveron data.`,
    };
  }

  const fb = fallbackInventoryAnswer(text, {
    products: ctx.products,
    orders: ctx.orders,
    purchaseOrders: ctx.purchaseOrders,
    customers,
  });
  if (fb) return { type: 'toast', message: fb };

  return {
    type: 'none',
    heard: text,
  };
}

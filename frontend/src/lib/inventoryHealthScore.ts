import type { Product, Order } from '@/lib/mockData';
import { getStockStatus } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';

export const HEALTH_WEIGHTS = {
  stockoutRisk: 30,
  deadStock: 20,
  supplier: 20,
  fulfillment: 15,
  margin: 15,
} as const;

export type HealthComponentId = keyof typeof HEALTH_WEIGHTS;

export interface HealthComponent {
  id: HealthComponentId;
  label: string;
  maxPoints: number;
  points: number;
  /** Underlying metric 0–100 for context */
  metricPct: number;
  detail: string;
  fixSuggestion: string;
}

export interface InventoryHealthResult {
  total: number;
  tier: 'poor' | 'fair' | 'good';
  components: HealthComponent[];
}

function grossMarginPct(p: Product): number {
  if (p.price <= 0) return 0;
  return ((p.price - p.cost) / p.price) * 100;
}

/** Days sales of inventory: stock ÷ average daily units (30-day window). */
export function productDSI(p: Product): number {
  if (p.salesLast30 <= 0) return 9999;
  const daily = p.salesLast30 / 30;
  return p.stock / daily;
}

export function computeInventoryHealth(
  products: Product[],
  orders: Order[],
  purchaseOrders: PurchaseOrder[]
): InventoryHealthResult {
  const n = products.length;

  const stockoutGood =
    n === 0 ? 0 : products.filter((p) => {
      const s = getStockStatus(p);
      return s !== 'critical' && s !== 'out';
    }).length;
  const stockoutRate = n ? stockoutGood / n : 1;
  const stockoutPoints = stockoutRate * HEALTH_WEIGHTS.stockoutRisk;

  const dsiGood =
    n === 0
      ? 0
      : products.filter((p) => {
          const dsi = productDSI(p);
          return dsi < 180;
        }).length;
  const dsiRate = n ? dsiGood / n : 1;
  const deadStockPoints = dsiRate * HEALTH_WEIGHTS.deadStock;

  const completedPOs = purchaseOrders.filter((po) => po.dateReceived && po.expectedDelivery);
  let onTime = 0;
  let late = 0;
  for (const po of completedPOs) {
    const rec = new Date(po.dateReceived!).getTime();
    const exp = new Date(po.expectedDelivery).getTime();
    if (Number.isNaN(rec) || Number.isNaN(exp)) continue;
    if (rec <= exp) onTime++;
    else late++;
  }
  const poDenom = onTime + late;
  const supplierRate = poDenom === 0 ? 1 : onTime / poDenom;
  const supplierPoints = supplierRate * HEALTH_WEIGHTS.supplier;

  const delivered = orders.filter((o) => o.status === 'Delivered').length;
  const cancelled = orders.filter((o) => o.status === 'Cancelled').length;
  const fulfillDenom = delivered + cancelled;
  const fulfillRate = fulfillDenom === 0 ? 1 : delivered / fulfillDenom;
  const fulfillmentPoints = fulfillRate * HEALTH_WEIGHTS.fulfillment;

  const marginGood =
    n === 0 ? 0 : products.filter((p) => grossMarginPct(p) > 20).length;
  const marginRate = n ? marginGood / n : 1;
  const marginPoints = marginRate * HEALTH_WEIGHTS.margin;

  const total = Math.round(
    Math.min(100, Math.max(0, stockoutPoints + deadStockPoints + supplierPoints + fulfillmentPoints + marginPoints))
  );

  const tier: InventoryHealthResult['tier'] =
    total < 40 ? 'poor' : total <= 70 ? 'fair' : 'good';

  const components: HealthComponent[] = [
    {
      id: 'stockoutRisk',
      label: 'Stockout risk',
      maxPoints: HEALTH_WEIGHTS.stockoutRisk,
      points: stockoutPoints,
      metricPct: Math.round(stockoutRate * 100),
      detail: n ? `${stockoutGood} of ${n} SKUs not critical or out` : 'No products',
      fixSuggestion: 'Replenish critical and out-of-stock items and review reorder points.',
    },
    {
      id: 'deadStock',
      label: 'Dead stock (DSI)',
      maxPoints: HEALTH_WEIGHTS.deadStock,
      points: deadStockPoints,
      metricPct: Math.round(dsiRate * 100),
      detail: n ? `${dsiGood} of ${n} SKUs under 180 days of inventory` : 'No products',
      fixSuggestion: 'Clear or promote SKUs with very high days-of-inventory vs sales.',
    },
    {
      id: 'supplier',
      label: 'Supplier reliability',
      maxPoints: HEALTH_WEIGHTS.supplier,
      points: supplierPoints,
      metricPct: Math.round(supplierRate * 100),
      detail:
        poDenom === 0
          ? 'No completed POs with delivery dates yet'
          : `${onTime} on-time vs ${late} late (received)`,
      fixSuggestion: 'Align promised dates with suppliers and escalate recurring late deliveries.',
    },
    {
      id: 'fulfillment',
      label: 'Order fulfillment',
      maxPoints: HEALTH_WEIGHTS.fulfillment,
      points: fulfillmentPoints,
      metricPct: Math.round(fulfillRate * 100),
      detail:
        fulfillDenom === 0
          ? 'No delivered or cancelled orders in dataset'
          : `${delivered} delivered vs ${cancelled} cancelled`,
      fixSuggestion: 'Cut cancellations with accurate stock, pricing, and delivery promises.',
    },
    {
      id: 'margin',
      label: 'Margin health',
      maxPoints: HEALTH_WEIGHTS.margin,
      points: marginPoints,
      metricPct: Math.round(marginRate * 100),
      detail: n ? `${marginGood} of ${n} SKUs above 20% gross margin` : 'No products',
      fixSuggestion: 'Renegotiate costs or adjust prices on SKUs below 20% gross margin.',
    },
  ];

  return { total, tier, components };
}

export function weakestHealthComponents(components: HealthComponent[], limit = 3): HealthComponent[] {
  return [...components]
    .map((c) => ({ c, ratio: c.maxPoints > 0 ? c.points / c.maxPoints : 1 }))
    .filter((x) => x.ratio < 0.999)
    .sort((a, b) => a.ratio - b.ratio)
    .slice(0, limit)
    .map((x) => x.c);
}

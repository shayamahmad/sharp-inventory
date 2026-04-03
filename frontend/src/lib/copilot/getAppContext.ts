import type { Product, Order } from '@/lib/mockData';
import { formatCurrency, getStockStatus } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';
import { computeInventoryHealth } from '@/lib/inventoryHealthScore';

export interface CopilotAlertItem {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
}

export interface CopilotAnomalyItem {
  label: string;
  description: string;
  severity: 'Warning' | 'Critical';
}

export interface CopilotHealthSnapshot {
  total: number;
  tier: 'poor' | 'fair' | 'good';
  components: {
    id: string;
    label: string;
    points: number;
    maxPoints: number;
    metricPct: number;
    detail: string;
  }[];
}

export interface CopilotProductSnapshot {
  id: string;
  name: string;
  category: string;
  stock: number;
  minStock: number;
  price: number;
  cost: number;
  salesLast30: number;
  unit: string;
  stockStatus: ReturnType<typeof getStockStatus>;
}

export interface CopilotOrderSnapshot {
  id: string;
  date: string;
  customerName: string;
  status: string;
  total: number;
  totalFormatted: string;
}

export interface CopilotPOSnapshot {
  id: string;
  supplier: string;
  productId: string;
  productName: string;
  status: string;
  quantityOrdered: number;
  expectedDelivery: string;
  discrepancy: boolean;
}

export interface CopilotAppContext {
  products: CopilotProductSnapshot[];
  orders: CopilotOrderSnapshot[];
  purchaseOrders: CopilotPOSnapshot[];
  alerts: CopilotAlertItem[];
  healthScore: CopilotHealthSnapshot;
  anomalies: CopilotAnomalyItem[];
  /** Meta for model: counts and caps */
  meta: { productCount: number; orderCount: number; poCount: number; alertsCount: number };
}

function formatInr(n: number): string {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

function buildAlerts(products: Product[], orders: Order[]): CopilotAlertItem[] {
  const list: CopilotAlertItem[] = [];
  const ts = new Date().toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });

  for (const p of products) {
    const min = Number(p.minStock);
    const minSafe = Number.isFinite(min) && min >= 0 ? min : 0;
    if (p.stock <= minSafe) {
      list.push({
        id: `low-${p.id}`,
        type: 'low_stock',
        title: 'Low stock',
        message: `${p.name ?? p.id} has ${p.stock} ${p.unit ?? ''} on hand (minimum ${minSafe}).`,
        timestamp: ts,
      });
    }
    if (p.stock > 0 && p.salesLast30 < 2) {
      list.push({
        id: `dead-${p.id}`,
        type: 'dead_stock',
        title: 'Slow-moving stock',
        message: `${p.name ?? p.id}: only ${p.salesLast30} sold in the last 30 days with ${p.stock} in stock.`,
        timestamp: ts,
      });
    }
  }

  for (const o of orders) {
    if (o.status !== 'Placed' && o.status !== 'Processing') continue;
    list.push({
      id: `order-${o.id}`,
      type: 'order',
      title: `Order ${o.status}`,
      message: `${o.id} — ${o.customerName} · ${formatInr(o.total)}`,
      timestamp: ts,
    });
  }

  const highDemand = products.filter((p) => {
    const m = Number(p.minStock);
    const ms = Number.isFinite(m) && m >= 0 ? m : 0;
    return p.salesLast30 >= 50 && p.stock <= ms * 2;
  });
  for (const p of highDemand) {
    list.push({
      id: `demand-${p.id}`,
      type: 'high_demand',
      title: 'High demand',
      message: `${p.name} is selling fast (${p.salesLast30} / 30d) — check reorder.`,
      timestamp: ts,
    });
  }

  return list;
}

function buildAnomalies(products: Product[], purchaseOrders: PurchaseOrder[]): CopilotAnomalyItem[] {
  const anomalies: CopilotAnomalyItem[] = [];
  products
    .filter((p) => p.salesLast30 === 0 && p.stock > 0)
    .forEach((p) => {
      anomalies.push({
        label: p.name,
        description: 'Zero sales in last 30 days with stock available',
        severity: 'Warning',
      });
    });
  const avgSales = products.length ? products.reduce((s, p) => s + p.salesLast30, 0) / products.length : 0;
  products
    .filter((p) => p.salesLast30 > avgSales * 3)
    .forEach((p) => {
      anomalies.push({
        label: p.name,
        description: `Sales spike: ${p.salesLast30} units (avg: ${avgSales.toFixed(0)})`,
        severity: 'Warning',
      });
    });
  const supplierDiscrepancies = new Map<string, number>();
  purchaseOrders.filter((po) => po.discrepancy).forEach((po) => {
    supplierDiscrepancies.set(po.supplier, (supplierDiscrepancies.get(po.supplier) || 0) + 1);
  });
  supplierDiscrepancies.forEach((count, supplier) => {
    if (count >= 2) {
      anomalies.push({
        label: supplier,
        description: `${count} POs with delivery discrepancies`,
        severity: 'Critical',
      });
    }
  });
  return anomalies;
}

function safeProducts(products: Product[] | null | undefined): CopilotProductSnapshot[] {
  if (!Array.isArray(products)) return [];
  return products.map((p) => ({
    id: p?.id ?? '',
    name: p?.name ?? 'Unknown',
    category: p?.category ?? '',
    stock: Number.isFinite(p?.stock) ? p.stock : 0,
    minStock: Number.isFinite(p?.minStock) ? p.minStock : 0,
    price: Number.isFinite(p?.price) ? p.price : 0,
    cost: Number.isFinite(p?.cost) ? p.cost : 0,
    salesLast30: Number.isFinite(p?.salesLast30) ? p.salesLast30 : 0,
    unit: p?.unit ?? '',
    stockStatus: getStockStatus(p),
  }));
}

function safeOrders(orders: Order[] | null | undefined): CopilotOrderSnapshot[] {
  if (!Array.isArray(orders)) return [];
  return orders.map((o) => ({
    id: o?.id ?? '',
    date: o?.date ?? '',
    customerName: o?.customerName ?? '',
    status: o?.status ?? '',
    total: Number.isFinite(o?.total) ? o.total : 0,
    totalFormatted: formatCurrency(Number.isFinite(o?.total) ? o.total : 0),
  }));
}

function safePOs(pos: PurchaseOrder[] | null | undefined): CopilotPOSnapshot[] {
  if (!Array.isArray(pos)) return [];
  return pos.map((po) => ({
    id: po?.id ?? '',
    supplier: po?.supplier ?? '',
    productId: po?.productId ?? '',
    productName: po?.productName ?? '',
    status: po?.status ?? '',
    quantityOrdered: Number.isFinite(po?.quantityOrdered) ? po.quantityOrdered : 0,
    expectedDelivery: po?.expectedDelivery ?? '',
    discrepancy: Boolean(po?.discrepancy),
  }));
}

/**
 * Collects a JSON-serializable snapshot of app inventory state for the copilot.
 * Null-safe on all inputs.
 */
export function getAppContext(
  products: Product[] | null | undefined,
  orders: Order[] | null | undefined,
  purchaseOrders: PurchaseOrder[] | null | undefined
): CopilotAppContext {
  const pRaw = safeProducts(products);
  const oRaw = safeOrders(orders);
  const poRaw = safePOs(purchaseOrders);

  const health = computeInventoryHealth(
    Array.isArray(products) ? products : [],
    Array.isArray(orders) ? orders : [],
    Array.isArray(purchaseOrders) ? purchaseOrders : []
  );

  const healthScore: CopilotHealthSnapshot = {
    total: health.total,
    tier: health.tier,
    components: health.components.map((c) => ({
      id: c.id,
      label: c.label,
      points: c.points,
      maxPoints: c.maxPoints,
      metricPct: c.metricPct,
      detail: c.detail,
    })),
  };

  const alerts = buildAlerts(Array.isArray(products) ? products : [], Array.isArray(orders) ? orders : []);
  const anomalies = buildAnomalies(Array.isArray(products) ? products : [], Array.isArray(purchaseOrders) ? purchaseOrders : []);

  return {
    products: pRaw,
    orders: oRaw,
    purchaseOrders: poRaw,
    alerts,
    healthScore,
    anomalies,
    meta: {
      productCount: pRaw.length,
      orderCount: oRaw.length,
      poCount: poRaw.length,
      alertsCount: alerts.length,
    },
  };
}

export function serializeCopilotContext(ctx: CopilotAppContext): string {
  try {
    return JSON.stringify(ctx);
  } catch {
    return '{}';
  }
}

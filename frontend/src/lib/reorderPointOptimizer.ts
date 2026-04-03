import type { Product } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';

export const DEFAULT_SUPPLIER_LEAD_DAYS = 7;
export const SAFETY_STOCK_DAILY_MULTIPLIER = 2;

/** Per-supplier average calendar days from PO sent to received (completed POs only). */
export function supplierLeadDaysMapFromPOs(purchaseOrders: PurchaseOrder[]): Map<string, number> {
  const map = new Map<string, number>();
  const suppliers = [...new Set(purchaseOrders.map((po) => po.supplier))];
  for (const supplier of suppliers) {
    const completed = purchaseOrders.filter(
      (po) => po.supplier === supplier && po.dateSent && po.dateReceived
    );
    if (completed.length === 0) continue;
    const avg =
      completed.reduce((sum, po) => {
        const days = Math.ceil(
          (new Date(po.dateReceived!).getTime() - new Date(po.dateSent!).getTime()) /
            (1000 * 60 * 60 * 24)
        );
        return sum + days;
      }, 0) / completed.length;
    map.set(supplier, Math.round(avg));
  }
  return map;
}

export function leadDaysForSupplier(
  supplier: string,
  leadMap: Map<string, number>,
  defaultDays = DEFAULT_SUPPLIER_LEAD_DAYS
): number {
  return leadMap.get(supplier) ?? defaultDays;
}

export interface OptimalROPBreakdown {
  optimalROP: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  /** Raw before ceil, for tooltip transparency */
  rawROP: number;
}

/**
 * ROP = (average daily demand × lead time) + safety stock,
 * safety stock = average daily demand × 2,
 * average daily demand = salesLast30 / 30.
 */
export function computeOptimalROP(
  product: Product,
  leadMap: Map<string, number>
): OptimalROPBreakdown {
  const avgDailyDemand = product.salesLast30 / 30;
  const leadTimeDays = leadDaysForSupplier(product.supplier, leadMap);
  const safetyStock = avgDailyDemand * SAFETY_STOCK_DAILY_MULTIPLIER;
  const rawROP = avgDailyDemand * leadTimeDays + safetyStock;
  const optimalROP = Math.max(0, Math.ceil(rawROP));
  return { optimalROP, avgDailyDemand, leadTimeDays, safetyStock, rawROP };
}

export type ROPStatusLevel = 'dangerously_low' | 'needs_update' | 'good';

export function ropMinStockStatus(currentMinStock: number, optimalROP: number): ROPStatusLevel {
  if (optimalROP <= 0) return 'good';
  if (currentMinStock < optimalROP * 0.5) return 'dangerously_low';
  if (currentMinStock < optimalROP * 0.8) return 'needs_update';
  return 'good';
}

import type { Product } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';
import { supplierLeadDaysMapFromPOs, DEFAULT_SUPPLIER_LEAD_DAYS } from '@/lib/reorderPointOptimizer';

export interface SimulationParams {
  salesGrowthRate: number;
  supplierDelayDays: number;
  spikeMonth: number;
  spikeMultiplier: number;
}

export interface SimulatedProductResult {
  productId: string;
  productName: string;
  stockoutDay: number | null;
  minProjectedStock: number;
  series: { day: number; stock: number }[];
  recommendedPOQty: number;
}

export interface SimulationRunResult {
  products: SimulatedProductResult[];
  top5AtRisk: SimulatedProductResult[];
  stockoutList: { productName: string; stockoutDay: number }[];
  revenueAtRisk: number;
  preemptivePO: { productName: string; quantity: number; rationale: string }[];
}

function monthOfSimDay(today: Date, dayOffset: number): number {
  const d = new Date(today);
  d.setDate(d.getDate() + dayOffset);
  return d.getMonth();
}

export function runInventorySimulation(
  products: Product[],
  purchaseOrders: PurchaseOrder[],
  params: SimulationParams,
  horizonDays = 90,
  today: Date = new Date()
): SimulationRunResult {
  const leadMap = supplierLeadDaysMapFromPOs(purchaseOrders);
  const { salesGrowthRate: growth, supplierDelayDays: delay, spikeMonth: spikeM, spikeMultiplier: spikeMult } =
    params;

  const productResults: SimulatedProductResult[] = [];
  let revenueAtRisk = 0;

  for (const p of products) {
    const baseDaily = p.salesLast30 / 30;
    const leadBase = leadMap.get(p.supplier) ?? DEFAULT_SUPPLIER_LEAD_DAYS;
    const leadAdj = leadBase + delay;
    const safety = baseDaily * 2 * (1 + growth);
    const rop = Math.ceil(baseDaily * (1 + growth) * leadAdj + safety);

    const series: { day: number; stock: number }[] = [];
    let stock = p.stock;
    let minS = stock;
    let stockoutDay: number | null = null;

    for (let day = 0; day < horizonDays; day++) {
      const isSpike = monthOfSimDay(today, day) === spikeM;
      const demand = baseDaily * (1 + growth) * (isSpike ? spikeMult : 1);
      const fulfilled = Math.min(stock, demand);
      const unmet = demand - fulfilled;
      revenueAtRisk += unmet * p.price;
      stock -= demand;
      if (stock < minS) minS = stock;
      if (stockoutDay === null && stock < 0) stockoutDay = day + 1;
      series.push({ day: day + 1, stock: Math.max(0, stock) });
    }

    const willStockout = stockoutDay !== null;
    const coverDays = 30 + leadAdj;
    const recDaily = baseDaily * (1 + growth) * spikeMult;
    const recommendedPOQty = willStockout
      ? Math.max(rop, Math.ceil(recDaily * coverDays - p.stock))
      : Math.max(0, Math.ceil(rop - p.stock));

    productResults.push({
      productId: p.id,
      productName: p.name,
      stockoutDay,
      minProjectedStock: minS,
      series,
      recommendedPOQty: Math.max(0, recommendedPOQty),
    });
  }

  const withRisk = [...productResults].sort((a, b) => {
    if (a.stockoutDay != null && b.stockoutDay != null) return a.stockoutDay - b.stockoutDay;
    if (a.stockoutDay != null) return -1;
    if (b.stockoutDay != null) return 1;
    return a.minProjectedStock - b.minProjectedStock;
  });

  const top5AtRisk = withRisk.slice(0, 5);
  const stockoutList = productResults
    .filter((r) => r.stockoutDay != null)
    .sort((a, b) => (a.stockoutDay ?? 0) - (b.stockoutDay ?? 0))
    .map((r) => ({ productName: r.productName, stockoutDay: r.stockoutDay! }));

  const preemptivePO = productResults
    .filter((r) => r.stockoutDay != null && r.recommendedPOQty > 0)
    .sort((a, b) => (a.stockoutDay ?? 99) - (b.stockoutDay ?? 99))
    .slice(0, 12)
    .map((r) => ({
      productName: r.productName,
      quantity: r.recommendedPOQty,
      rationale: `Simulated stockout ~day ${r.stockoutDay}; preemptive buy ~${r.recommendedPOQty} u to cover lead + buffer.`,
    }));

  return {
    products: productResults,
    top5AtRisk,
    stockoutList,
    revenueAtRisk,
    preemptivePO,
  };
}

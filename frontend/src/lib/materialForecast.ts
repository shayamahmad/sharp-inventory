import type { BOMItem, BillOfMaterials, ProductionOrder } from '@/lib/manufacturingData';

export type MaterialForecastStatus = 'Critical' | 'Warning' | 'Good';

export interface MaterialForecastRow {
  materialId: string;
  materialName: string;
  unit: string;
  requiredQty: number;
  currentStock: number;
  shortfall: number;
  daysUntilStockout: number | null;
  status: MaterialForecastStatus;
  costPerUnit: number;
  shortfallValue: number;
  consumptionPerDay: number;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Planned + In Progress production: aggregate material need and implied daily burn
 * from each order’s batch over its remaining schedule (start→end).
 */
export function buildMaterialForecastFromProduction(
  productionOrders: ProductionOrder[],
  billsOfMaterials: BillOfMaterials[],
  rawMaterials: BOMItem[],
  today: Date = new Date()
): MaterialForecastRow[] {
  const active = productionOrders.filter((o) => o.status === 'Planned' || o.status === 'In Progress');
  const today0 = startOfLocalDay(today);

  const agg = new Map<
    string,
    { name: string; unit: string; required: number; consumptionPerDay: number }
  >();

  for (const order of active) {
    const bom = billsOfMaterials.find((b) => b.productId === order.productId);
    if (!bom) continue;
    const start = parseYmd(order.startDate);
    const end = parseYmd(order.endDate);
    const spanDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (86400000)) + 1);
    const remainingStart = start > today0 ? start : today0;
    const remainingDays = Math.max(1, Math.ceil((end.getTime() - remainingStart.getTime()) / (86400000)) + 1);

    for (const line of bom.materials) {
      const lineRequired = line.quantityPerUnit * order.batchSize;
      const burnRate = lineRequired / remainingDays;
      const cur = agg.get(line.materialId) ?? {
        name: line.materialName,
        unit: line.unit,
        required: 0,
        consumptionPerDay: 0,
      };
      cur.required += lineRequired;
      cur.consumptionPerDay += burnRate;
      agg.set(line.materialId, cur);
    }
  }

  const rmById = new Map(rawMaterials.map((r) => [r.materialId, r]));

  const rows: MaterialForecastRow[] = [];
  for (const [materialId, v] of agg) {
    const rm = rmById.get(materialId);
    const currentStock = rm?.currentStock ?? 0;
    const costPerUnit = rm?.costPerUnit ?? 0;
    const shortfall = Math.max(0, v.required - currentStock);
    const daily = v.consumptionPerDay;
    const daysUntilStockout =
      daily > 1e-6 ? Math.floor(currentStock / daily) : currentStock > 0 ? 9999 : 0;

    const surplus = currentStock - v.required;
    const extraDaysAfterPlan = daily > 1e-6 && surplus > 0 ? surplus / daily : surplus > 0 ? 9999 : 0;

    let status: MaterialForecastStatus;
    if (shortfall > 0) status = 'Critical';
    else if (extraDaysAfterPlan < 30) status = 'Warning';
    else status = 'Good';

    rows.push({
      materialId,
      materialName: rm?.materialName ?? v.name,
      unit: rm?.unit ?? v.unit,
      requiredQty: v.required,
      currentStock,
      shortfall,
      daysUntilStockout: daily > 1e-6 ? Math.max(0, daysUntilStockout) : null,
      status,
      costPerUnit,
      shortfallValue: shortfall * costPerUnit,
      consumptionPerDay: daily,
    });
  }

  return rows;
}

export function materialForecastSummary(rows: MaterialForecastRow[]): {
  atRiskCount: number;
  totalShortfallValue: number;
} {
  const atRisk = rows.filter((r) => r.status === 'Critical' || r.status === 'Warning').length;
  const totalShortfallValue = rows.reduce((s, r) => s + r.shortfallValue, 0);
  return { atRiskCount: atRisk, totalShortfallValue };
}

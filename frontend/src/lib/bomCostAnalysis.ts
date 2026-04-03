import type { BillOfMaterials, BOMItem } from '@/lib/manufacturingData';

export interface BOMCostAnalysis {
  materialsResolved: BOMItem[];
  componentCostPerUnit: number;
  allocatedLaborOverheadPerUnit: number;
  totalProductionCostPerUnit: number;
  sellingPrice: number;
  grossMarginInr: number;
  grossMarginPct: number;
  marginBand: 'high' | 'mid' | 'low';
}

const costById = (catalog: BOMItem[], id: string): number | undefined =>
  catalog.find((r) => r.materialId === id)?.costPerUnit;

/**
 * Resolves each BOM line’s cost from the live raw-materials catalog when present.
 */
export function resolveBomMaterialsWithCatalog(
  bom: BillOfMaterials,
  rawMaterialsCatalog: BOMItem[]
): BOMItem[] {
  return bom.materials.map((m) => {
    const live = costById(rawMaterialsCatalog, m.materialId);
    return {
      ...m,
      costPerUnit: live ?? m.costPerUnit,
      currentStock: rawMaterialsCatalog.find((r) => r.materialId === m.materialId)?.currentStock ?? m.currentStock,
    };
  });
}

export function analyzeBomProductionCost(
  bom: BillOfMaterials,
  rawMaterialsCatalog: BOMItem[],
  sellingPrice: number
): BOMCostAnalysis {
  const materialsResolved = resolveBomMaterialsWithCatalog(bom, rawMaterialsCatalog);
  const componentCostPerUnit = materialsResolved.reduce(
    (s, m) => s + m.quantityPerUnit * m.costPerUnit,
    0
  );
  const allocatedLaborOverheadPerUnit =
    (bom.laborCostPerBatch + bom.overheadPerBatch) / Math.max(bom.outputPerBatch, 1);
  const totalProductionCostPerUnit = componentCostPerUnit + allocatedLaborOverheadPerUnit;
  const grossMarginInr = sellingPrice - totalProductionCostPerUnit;
  const grossMarginPct =
    sellingPrice > 0 ? (grossMarginInr / sellingPrice) * 100 : 0;
  const marginBand: BOMCostAnalysis['marginBand'] =
    grossMarginPct > 30 ? 'high' : grossMarginPct >= 10 ? 'mid' : 'low';

  return {
    materialsResolved,
    componentCostPerUnit,
    allocatedLaborOverheadPerUnit,
    totalProductionCostPerUnit,
    sellingPrice,
    grossMarginInr,
    grossMarginPct,
    marginBand,
  };
}

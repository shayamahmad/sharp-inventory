import { formatCurrency } from './mockData';

// ── Seasonal demand multipliers (monthly) ──
export const seasonalFactors: Record<string, number[]> = {
  Electronics:        [0.8, 0.7, 0.9, 0.9, 1.0, 1.0, 0.9, 0.9, 1.1, 1.2, 1.5, 1.6],
  Clothing:           [1.0, 0.8, 0.9, 1.0, 1.0, 0.8, 0.7, 0.8, 1.1, 1.3, 1.4, 1.5],
  'Food & Beverages': [1.0, 1.0, 1.0, 1.1, 1.2, 1.3, 1.2, 1.1, 1.0, 1.1, 1.2, 1.3],
  'Home & Garden':    [0.7, 0.8, 1.2, 1.4, 1.3, 1.1, 0.9, 0.8, 0.9, 1.0, 0.9, 0.8],
  Sports:             [0.8, 0.9, 1.1, 1.2, 1.3, 1.4, 1.3, 1.1, 1.0, 0.9, 0.8, 0.7],
  Beauty:             [1.0, 1.1, 1.2, 1.0, 1.0, 0.9, 0.9, 1.0, 1.0, 1.1, 1.3, 1.4],
  Toys:               [0.5, 0.5, 0.6, 0.7, 0.7, 0.8, 0.8, 0.9, 1.0, 1.2, 1.8, 2.0],
  Books:              [0.9, 0.8, 0.9, 1.0, 1.0, 1.2, 1.3, 1.2, 1.0, 0.9, 0.8, 0.9],
};

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// ── Historical sales data (simulated 6-month history) ──
export interface HistoricalSale {
  month: string;
  monthIndex: number;
  quantity: number;
}

export function generateHistory(baseDailyRate: number, category: string): HistoricalSale[] {
  const factors = seasonalFactors[category] || Array(12).fill(1);
  const currentMonth = 2; // March (0-indexed)
  const history: HistoricalSale[] = [];

  for (let i = 5; i >= 0; i--) {
    const mIdx = (currentMonth - i + 12) % 12;
    const factor = factors[mIdx];
    const noise = 0.85 + Math.random() * 0.3;
    const qty = Math.round(baseDailyRate * 30 * factor * noise);
    history.push({ month: monthNames[mIdx], monthIndex: mIdx, quantity: Math.max(0, qty) });
  }
  return history;
}

// ── Demand Forecasting ──
export interface ForecastPoint {
  month: string;
  monthIndex: number;
  predicted: number;
  lower: number;
  upper: number;
}

export function forecastDemand(history: HistoricalSale[], category: string, monthsAhead: number = 6): ForecastPoint[] {
  const factors = seasonalFactors[category] || Array(12).fill(1);
  const avgMonthly = history.reduce((s, h) => s + h.quantity, 0) / history.length;
  // Simple trend from linear regression
  const n = history.length;
  const xMean = (n - 1) / 2;
  const yMean = avgMonthly;
  let num = 0, den = 0;
  history.forEach((h, i) => {
    num += (i - xMean) * (h.quantity - yMean);
    den += (i - xMean) ** 2;
  });
  const trend = den !== 0 ? num / den : 0;

  const lastMonthIndex = history[history.length - 1].monthIndex;
  const forecast: ForecastPoint[] = [];
  for (let i = 1; i <= monthsAhead; i++) {
    const mIdx = (lastMonthIndex + i) % 12;
    const base = avgMonthly + trend * (n + i - 1);
    const seasonal = factors[mIdx];
    const predicted = Math.max(0, Math.round(base * seasonal));
    const uncertainty = Math.round(predicted * 0.15 * Math.sqrt(i));
    forecast.push({
      month: monthNames[mIdx],
      monthIndex: mIdx,
      predicted,
      lower: Math.max(0, predicted - uncertainty),
      upper: predicted + uncertainty,
    });
  }
  return forecast;
}

// ── Intelligent Replenishment ──
export interface ReplenishmentPlan {
  productId: string;
  productName: string;
  category: string;
  currentStock: number;
  avgDailyDemand: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  economicOrderQty: number;
  nextOrderDate: string;
  forecastedDemand30: number;
  seasonalTrend: 'rising' | 'falling' | 'stable';
  urgency: 'critical' | 'soon' | 'planned' | 'adequate';
  estimatedCost: number;
}

export function computeReplenishment(product: {
  id: string; name: string; category: string; stock: number; cost: number;
  salesLast30: number; unit: string; minStock: number;
}): ReplenishmentPlan {
  const dailyDemand = product.salesLast30 / 30;
  const leadTimeDays = 5 + Math.floor(Math.random() * 10); // 5-14 days
  const factors = seasonalFactors[product.category] || Array(12).fill(1);
  const currentFactor = factors[2]; // March
  const nextFactor = factors[3]; // April

  // Safety stock = Z * σ * √(LT), simplified
  const demandVariability = dailyDemand * 0.25;
  const safetyStock = Math.ceil(1.65 * demandVariability * Math.sqrt(leadTimeDays));
  const reorderPoint = Math.ceil(dailyDemand * leadTimeDays + safetyStock);

  // EOQ = √(2DS/H) where D=annual demand, S=order cost, H=holding cost
  const annualDemand = dailyDemand * 365;
  const orderCost = product.cost * 0.1 + 500; // Fixed cost per order
  const holdingCost = product.cost * 0.2; // 20% of item cost
  const eoq = Math.ceil(Math.sqrt((2 * annualDemand * orderCost) / Math.max(holdingCost, 1)));

  const daysUntilReorder = dailyDemand > 0
    ? Math.max(0, Math.floor((product.stock - reorderPoint) / dailyDemand))
    : 999;

  const today = new Date(2026, 2, 25);
  const orderDate = new Date(today);
  orderDate.setDate(orderDate.getDate() + daysUntilReorder);

  const forecastedDemand30 = Math.round(dailyDemand * 30 * (nextFactor / Math.max(currentFactor, 0.1)));

  const trend: 'rising' | 'falling' | 'stable' =
    nextFactor > currentFactor * 1.1 ? 'rising' :
    nextFactor < currentFactor * 0.9 ? 'falling' : 'stable';

  const urgency: ReplenishmentPlan['urgency'] =
    product.stock <= 0 ? 'critical' :
    product.stock <= reorderPoint ? 'soon' :
    daysUntilReorder <= 14 ? 'planned' : 'adequate';

  return {
    productId: product.id,
    productName: product.name,
    category: product.category,
    currentStock: product.stock,
    avgDailyDemand: dailyDemand,
    leadTimeDays,
    safetyStock,
    reorderPoint,
    economicOrderQty: eoq,
    nextOrderDate: orderDate.toISOString().split('T')[0],
    forecastedDemand30,
    seasonalTrend: trend,
    urgency,
    estimatedCost: eoq * product.cost,
  };
}

// ── Manufacturing: Bill of Materials ──
export interface BOMItem {
  materialId: string;
  materialName: string;
  quantityPerUnit: number;
  unit: string;
  costPerUnit: number;
  currentStock: number;
  minStock: number;
  supplier: string;
  leadTimeDays: number;
}

export interface BillOfMaterials {
  productId: string;
  productName: string;
  category: string;
  outputPerBatch: number;
  laborCostPerBatch: number;
  overheadPerBatch: number;
  materials: BOMItem[];
  totalMaterialCost: number;
  totalCostPerUnit: number;
}

export const rawMaterials: BOMItem[] = [
  { materialId: 'RM001', materialName: 'Lithium Battery Cell', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 180, currentStock: 500, minStock: 200, supplier: 'BatteryTech India', leadTimeDays: 10 },
  { materialId: 'RM002', materialName: 'Bluetooth Chipset', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 250, currentStock: 300, minStock: 100, supplier: 'ChipMaster Pvt Ltd', leadTimeDays: 14 },
  { materialId: 'RM003', materialName: 'Silicone Ear Tips', quantityPerUnit: 6, unit: 'pcs', costPerUnit: 8, currentStock: 2000, minStock: 500, supplier: 'SiliFlex Corp', leadTimeDays: 7 },
  { materialId: 'RM004', materialName: 'ABS Plastic Shell', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 35, currentStock: 800, minStock: 300, supplier: 'PlastiMold India', leadTimeDays: 5 },
  { materialId: 'RM005', materialName: 'Cotton Fabric (Grade A)', quantityPerUnit: 1.5, unit: 'meters', costPerUnit: 120, currentStock: 350, minStock: 150, supplier: 'TextileCraft Mills', leadTimeDays: 8 },
  { materialId: 'RM006', materialName: 'Elastic Band', quantityPerUnit: 0.5, unit: 'meters', costPerUnit: 15, currentStock: 600, minStock: 200, supplier: 'TextileCraft Mills', leadTimeDays: 5 },
  { materialId: 'RM007', materialName: 'Organic Tea Leaves', quantityPerUnit: 100, unit: 'grams', costPerUnit: 0.8, currentStock: 50000, minStock: 20000, supplier: 'TeaGarden Assam', leadTimeDays: 12 },
  { materialId: 'RM008', materialName: 'Cardboard Box (Tea)', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 12, currentStock: 1500, minStock: 500, supplier: 'PackRight India', leadTimeDays: 4 },
  { materialId: 'RM009', materialName: 'LED Chip (Smart)', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 65, currentStock: 200, minStock: 80, supplier: 'BrightChip Corp', leadTimeDays: 10 },
  { materialId: 'RM010', materialName: 'WiFi Module', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 90, currentStock: 150, minStock: 60, supplier: 'ChipMaster Pvt Ltd', leadTimeDays: 14 },
  { materialId: 'RM011', materialName: 'PVC Yoga Mat Sheet', quantityPerUnit: 1, unit: 'sheet', costPerUnit: 280, currentStock: 120, minStock: 40, supplier: 'PolyFlex Industries', leadTimeDays: 7 },
  { materialId: 'RM012', materialName: 'Anti-slip Texture Coating', quantityPerUnit: 0.2, unit: 'liters', costPerUnit: 350, currentStock: 50, minStock: 15, supplier: 'CoatPro Labs', leadTimeDays: 9 },
  { materialId: 'RM013', materialName: 'Vitamin C Serum Base', quantityPerUnit: 30, unit: 'ml', costPerUnit: 3.5, currentStock: 8000, minStock: 3000, supplier: 'BioChemEssence', leadTimeDays: 11 },
  { materialId: 'RM014', materialName: 'Glass Dropper Bottle', quantityPerUnit: 1, unit: 'pcs', costPerUnit: 22, currentStock: 600, minStock: 200, supplier: 'GlassWorks India', leadTimeDays: 6 },
  { materialId: 'RM015', materialName: 'Speaker Driver 40mm', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 150, currentStock: 250, minStock: 80, supplier: 'AudioParts India', leadTimeDays: 12 },
  { materialId: 'RM016', materialName: 'Rubber Sole (Running)', quantityPerUnit: 2, unit: 'pcs', costPerUnit: 320, currentStock: 80, minStock: 30, supplier: 'SoleTech India', leadTimeDays: 10 },
  { materialId: 'RM017', materialName: 'Mesh Fabric (Sports)', quantityPerUnit: 0.8, unit: 'meters', costPerUnit: 180, currentStock: 120, minStock: 50, supplier: 'TextileCraft Mills', leadTimeDays: 8 },
];

export const billsOfMaterials: BillOfMaterials[] = [
  {
    productId: 'P001', productName: 'Wireless Earbuds Pro', category: 'Electronics',
    outputPerBatch: 50, laborCostPerBatch: 5000, overheadPerBatch: 3000,
    materials: [rawMaterials[0], rawMaterials[1], rawMaterials[2], rawMaterials[3]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P002', productName: 'Cotton T-Shirt Premium', category: 'Clothing',
    outputPerBatch: 100, laborCostPerBatch: 8000, overheadPerBatch: 2000,
    materials: [rawMaterials[4], rawMaterials[5]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P003', productName: 'Organic Green Tea', category: 'Food & Beverages',
    outputPerBatch: 200, laborCostPerBatch: 3000, overheadPerBatch: 1500,
    materials: [rawMaterials[6], rawMaterials[7]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P004', productName: 'Smart LED Bulb', category: 'Home & Garden',
    outputPerBatch: 80, laborCostPerBatch: 4000, overheadPerBatch: 2500,
    materials: [rawMaterials[8], rawMaterials[9], rawMaterials[3]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P005', productName: 'Yoga Mat Premium', category: 'Sports',
    outputPerBatch: 40, laborCostPerBatch: 3500, overheadPerBatch: 1500,
    materials: [rawMaterials[10], rawMaterials[11]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P006', productName: 'Face Serum Vitamin C', category: 'Beauty',
    outputPerBatch: 150, laborCostPerBatch: 6000, overheadPerBatch: 2000,
    materials: [rawMaterials[12], rawMaterials[13]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P009', productName: 'Bluetooth Speaker', category: 'Electronics',
    outputPerBatch: 30, laborCostPerBatch: 4500, overheadPerBatch: 3500,
    materials: [rawMaterials[0], rawMaterials[1], rawMaterials[14], rawMaterials[3]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
  {
    productId: 'P010', productName: 'Running Shoes', category: 'Sports',
    outputPerBatch: 60, laborCostPerBatch: 9000, overheadPerBatch: 3000,
    materials: [rawMaterials[15], rawMaterials[16]],
    totalMaterialCost: 0, totalCostPerUnit: 0,
  },
];

// Compute BOM costs
billsOfMaterials.forEach(bom => {
  bom.totalMaterialCost = bom.materials.reduce((s, m) => s + m.quantityPerUnit * m.costPerUnit, 0);
  bom.totalCostPerUnit = bom.totalMaterialCost + (bom.laborCostPerBatch + bom.overheadPerBatch) / bom.outputPerBatch;
});

// ── Production Orders ──
export interface ProductionOrder {
  id: string;
  productId: string;
  productName: string;
  batchSize: number;
  status: 'Planned' | 'In Progress' | 'Quality Check' | 'Completed';
  startDate: string;
  endDate: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  completionPercent: number;
  assignedTo: string;
}

export const productionOrders: ProductionOrder[] = [
  { id: 'PRD001', productId: 'P001', productName: 'Wireless Earbuds Pro', batchSize: 100, status: 'In Progress', startDate: '2026-03-22', endDate: '2026-03-28', priority: 'High', completionPercent: 65, assignedTo: 'Line A' },
  { id: 'PRD002', productId: 'P002', productName: 'Cotton T-Shirt Premium', batchSize: 200, status: 'Planned', startDate: '2026-03-26', endDate: '2026-03-30', priority: 'Urgent', completionPercent: 0, assignedTo: 'Line B' },
  { id: 'PRD003', productId: 'P006', productName: 'Face Serum Vitamin C', batchSize: 150, status: 'Quality Check', startDate: '2026-03-18', endDate: '2026-03-25', priority: 'Medium', completionPercent: 90, assignedTo: 'Line C' },
  { id: 'PRD004', productId: 'P004', productName: 'Smart LED Bulb', batchSize: 80, status: 'Planned', startDate: '2026-03-27', endDate: '2026-04-01', priority: 'Urgent', completionPercent: 0, assignedTo: 'Line A' },
  { id: 'PRD005', productId: 'P009', productName: 'Bluetooth Speaker', batchSize: 60, status: 'In Progress', startDate: '2026-03-20', endDate: '2026-03-27', priority: 'Medium', completionPercent: 45, assignedTo: 'Line D' },
  { id: 'PRD006', productId: 'P010', productName: 'Running Shoes', batchSize: 60, status: 'Completed', startDate: '2026-03-10', endDate: '2026-03-18', priority: 'Low', completionPercent: 100, assignedTo: 'Line B' },
  { id: 'PRD007', productId: 'P003', productName: 'Organic Green Tea', batchSize: 400, status: 'In Progress', startDate: '2026-03-21', endDate: '2026-03-26', priority: 'High', completionPercent: 78, assignedTo: 'Line C' },
  { id: 'PRD008', productId: 'P005', productName: 'Yoga Mat Premium', batchSize: 40, status: 'Planned', startDate: '2026-03-28', endDate: '2026-04-02', priority: 'Low', completionPercent: 0, assignedTo: 'Line D' },
];

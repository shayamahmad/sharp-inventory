import type { Order, Product } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';

export interface MonthlyStat {
  revenue: number;
  profit: number;
}

export interface CashEventRow {
  date: string;
  type: 'inflow' | 'outflow';
  label: string;
  amount: number;
  detail: string;
}

export interface CashFlowDayPoint {
  dayIndex: number;
  dateLabel: string;
  isoDate: string;
  dailyInflow: number;
  dailyOutflow: number;
  cumulativeInflow: number;
  cumulativeOutflow: number;
  netCashPosition: number;
}

export interface CashFlowForecastResult {
  horizonDays: number;
  openingCash: number;
  avgDailyBaselineInflow: number;
  avgDailyBaselineOutflow: number;
  series: CashFlowDayPoint[];
  events: CashEventRow[];
  minNetInWindow: number;
  cashGapShortfall: number;
  hasCashGap: boolean;
}

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function dayOffsetFromToday(eventDate: Date, todayStart: Date): number {
  const e = startOfLocalDay(eventDate);
  return Math.round((e.getTime() - todayStart.getTime()) / (1000 * 60 * 60 * 24));
}

const OPENING_CASH_DEFAULT = 420000;

const PIPELINE_STATUSES = ['Draft', 'Sent', 'Acknowledged', 'In Transit'] as const;

export function buildCashFlowForecast(
  orders: Order[],
  purchaseOrders: PurchaseOrder[],
  products: Product[],
  monthlyHistory: MonthlyStat[],
  horizonDays: 30 | 60 | 90,
  today: Date = new Date()
): CashFlowForecastResult {
  const n = monthlyHistory.length;
  const totalRev = monthlyHistory.reduce((s, m) => s + m.revenue, 0);
  const totalSpend = monthlyHistory.reduce((s, m) => s + Math.max(0, m.revenue - m.profit), 0);
  const avgMonthlyRevenue = n ? totalRev / n : 0;
  const avgMonthlySpend = n ? totalSpend / n : 0;
  const avgDailyBaselineInflow = avgMonthlyRevenue / 30;
  const avgDailyBaselineOutflow = avgMonthlySpend / 30;

  const productMap = new Map(products.map((p) => [p.id, p]));
  const todayStart = startOfLocalDay(today);

  const openingCash =
    monthlyHistory.length > 0
      ? Math.max(OPENING_CASH_DEFAULT, monthlyHistory[monthlyHistory.length - 1]!.profit * 2.2)
      : OPENING_CASH_DEFAULT;

  const dailyExtraIn = new Map<number, number>();
  const dailyExtraOut = new Map<number, number>();
  const events: CashEventRow[] = [];

  const pipelineOrders = orders.filter((o) => o.status === 'Placed' || o.status === 'Processing');
  for (const o of pipelineOrders) {
    let offset = dayOffsetFromToday(parseLocalDate(o.date), todayStart);
    if (offset < 0) offset = 0;
    if (offset >= horizonDays) continue;
    dailyExtraIn.set(offset, (dailyExtraIn.get(offset) ?? 0) + o.total);
    events.push({
      date: formatISODate(addDays(todayStart, offset)),
      type: 'inflow',
      label: `Order ${o.id} (${o.status})`,
      amount: o.total,
      detail: o.customerName,
    });
  }

  const pipelinePOs = purchaseOrders.filter((po) =>
    PIPELINE_STATUSES.includes(po.status as (typeof PIPELINE_STATUSES)[number])
  );
  for (const po of pipelinePOs) {
    const p = productMap.get(po.productId);
    const unitCost = p?.cost ?? 0;
    const amount = unitCost * po.quantityOrdered;
    let offset = dayOffsetFromToday(parseLocalDate(po.expectedDelivery), todayStart);
    if (offset < 0) offset = 0;
    if (offset >= horizonDays) continue;
    dailyExtraOut.set(offset, (dailyExtraOut.get(offset) ?? 0) + amount);
    events.push({
      date: formatISODate(addDays(todayStart, offset)),
      type: 'outflow',
      label: `PO ${po.id} (${po.status})`,
      amount,
      detail: `${po.productName} × ${po.quantityOrdered}`,
    });
  }

  events.sort((a, b) => a.date.localeCompare(b.date));

  const series: CashFlowDayPoint[] = [];
  let cumIn = 0;
  let cumOut = 0;
  let minNet = openingCash;

  for (let d = 0; d < horizonDays; d++) {
    const dayDate = addDays(todayStart, d);
    const iso = formatISODate(dayDate);
    const dailyInflow = avgDailyBaselineInflow + (dailyExtraIn.get(d) ?? 0);
    const dailyOutflow = avgDailyBaselineOutflow + (dailyExtraOut.get(d) ?? 0);
    cumIn += dailyInflow;
    cumOut += dailyOutflow;
    const netCashPosition = openingCash + cumIn - cumOut;
    if (netCashPosition < minNet) minNet = netCashPosition;

    series.push({
      dayIndex: d + 1,
      dateLabel: d === 0 ? 'Today' : iso,
      isoDate: iso,
      dailyInflow,
      dailyOutflow,
      cumulativeInflow: cumIn,
      cumulativeOutflow: cumOut,
      netCashPosition,
    });
  }

  const hasCashGap = minNet < 0;
  const cashGapShortfall = hasCashGap ? Math.abs(minNet) : 0;

  return {
    horizonDays,
    openingCash,
    avgDailyBaselineInflow,
    avgDailyBaselineOutflow,
    series,
    events,
    minNetInWindow: minNet,
    cashGapShortfall,
    hasCashGap,
  };
}

function addDays(start: Date, days: number): Date {
  const x = new Date(start);
  x.setDate(x.getDate() + days);
  return x;
}

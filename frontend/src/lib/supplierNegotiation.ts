import type { Product } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';

export const VOLUME_DISCOUNT_SPEND_THRESHOLD = 500_000;

export type PriceTrend = 'increasing' | 'stable' | 'decreasing';

export interface SupplierNegotiationProfile {
  supplier: string;
  totalOrders: number;
  totalSpend: number;
  avgLeadTimeDays: number | null;
  onTimePct: number | null;
  priceTrend: PriceTrend;
  trendNote: string;
  briefBullets: string[];
  briefPlainText: string;
}

function poSortDate(po: PurchaseOrder): number {
  const s = po.dateSent || po.expectedDelivery;
  return new Date(s + 'T12:00:00').getTime();
}

export function buildSupplierProfiles(
  purchaseOrders: PurchaseOrder[],
  products: Product[]
): SupplierNegotiationProfile[] {
  const productById = new Map(products.map((p) => [p.id, p]));
  const supplierSet = new Set<string>();
  purchaseOrders.forEach((po) => supplierSet.add(po.supplier));
  products.forEach((p) => supplierSet.add(p.supplier));

  const list: SupplierNegotiationProfile[] = [];

  for (const supplier of supplierSet) {
    const pos = purchaseOrders.filter((po) => po.supplier === supplier).sort((a, b) => poSortDate(a) - poSortDate(b));

    if (pos.length === 0) {
      list.push({
        supplier,
        totalOrders: 0,
        totalSpend: 0,
        avgLeadTimeDays: null,
        onTimePct: null,
        priceTrend: 'stable',
        trendNote: 'No PO history for this supplier yet.',
        briefBullets: [
          'No purchase orders on record — obtain written quotes, standard lead times, and MOQs before the first bulk purchase.',
          'Ask for references and sample batches to validate quality and delivery discipline.',
          'Negotiate payment terms (e.g. net 30) and return policy up front rather than after issues arise.',
        ],
        briefPlainText: '',
      });
      const last = list[list.length - 1]!;
      last.briefPlainText = last.briefBullets.map((b) => `• ${b}`).join('\n');
      continue;
    }

    let totalSpend = 0;
    for (const po of pos) {
      const p = productById.get(po.productId);
      const unit = p?.cost ?? 0;
      totalSpend += unit * po.quantityOrdered;
    }

    const completed = pos.filter((po) => po.dateSent && po.dateReceived);
    let leadSum = 0;
    let onTime = 0;
    let late = 0;
    for (const po of completed) {
      const sent = new Date(po.dateSent! + 'T12:00:00').getTime();
      const rec = new Date(po.dateReceived! + 'T12:00:00').getTime();
      const exp = new Date(po.expectedDelivery + 'T12:00:00').getTime();
      const days = Math.max(1, Math.ceil((rec - sent) / (1000 * 60 * 60 * 24)));
      leadSum += days;
      if (rec <= exp) onTime++;
      else late++;
    }
    const avgLeadTimeDays = completed.length ? Math.round(leadSum / completed.length) : null;
    const onTimePct =
      onTime + late > 0 ? Math.round((100 * onTime) / (onTime + late)) : completed.length > 0 ? 100 : null;

    const unitCosts = pos
      .map((po) => {
        const p = productById.get(po.productId);
        return p ? p.cost : null;
      })
      .filter((x): x is number => x != null && x > 0);

    let priceTrend: PriceTrend = 'stable';
    let trendNote = 'Insufficient PO history to establish a unit-cost trend.';
    if (unitCosts.length >= 4) {
      const mid = Math.floor(unitCosts.length / 2);
      const older = unitCosts.slice(0, mid);
      const recent = unitCosts.slice(mid);
      const avgOld = older.reduce((a, b) => a + b, 0) / older.length;
      const avgNew = recent.reduce((a, b) => a + b, 0) / recent.length;
      const delta = avgOld > 0 ? ((avgNew - avgOld) / avgOld) * 100 : 0;
      if (delta > 3) {
        priceTrend = 'increasing';
        trendNote = `Implied unit costs are up ~${delta.toFixed(0)}% in more recent POs vs earlier (using current product cost as proxy).`;
      } else if (delta < -3) {
        priceTrend = 'decreasing';
        trendNote = `Recent PO lines imply ~${Math.abs(delta).toFixed(0)}% lower unit costs vs earlier activity.`;
      } else {
        trendNote = 'Unit cost levels across POs are relatively flat.';
      }
    } else if (unitCosts.length > 0) {
      trendNote = 'Few POs — trend is indicative only.';
    }

    const bullets: string[] = [];
    if (avgLeadTimeDays != null && avgLeadTimeDays > 10) {
      bullets.push(
        `Average lead time is ${avgLeadTimeDays} days — push for a written SLA (e.g. ≤10 days) or expedited shipping terms on the next contract renewal.`
      );
    }
    if (onTimePct != null && onTimePct < 80) {
      bullets.push(
        `On-time delivery is ${onTimePct}% — request root-cause review, penalty clauses for late shipments, or backup supplier qualification.`
      );
    }
    if (totalSpend >= VOLUME_DISCOUNT_SPEND_THRESHOLD) {
      bullets.push(
        `Lifetime PO spend is about ₹${(totalSpend / 1000).toFixed(0)}k — ask for tiered or volume rebates on the next frame agreement.`
      );
    }
    if (priceTrend === 'increasing') {
      bullets.push(
        'Cost trajectory is rising — negotiate price holds, indexed caps, or multi-year lock for core SKUs.'
      );
    }
    if (bullets.length === 0) {
      bullets.push('Maintain quarterly business reviews and document performance (lead time, fill rate, quality) for the next negotiation.');
      bullets.push('Benchmark their pricing against alternate quotes for the same commodity SKUs.');
    }
    if (bullets.length < 3 && avgLeadTimeDays != null && avgLeadTimeDays <= 10 && onTimePct != null && onTimePct >= 80) {
      bullets.push('Performance is solid — use that track record to ask for early-payment discounts or extended payment terms instead of price cuts.');
    }
    const briefBullets = bullets.slice(0, 5);
    const briefPlainText = briefBullets.map((b) => `• ${b}`).join('\n');

    list.push({
      supplier,
      totalOrders: pos.length,
      totalSpend,
      avgLeadTimeDays,
      onTimePct,
      priceTrend,
      trendNote,
      briefBullets,
      briefPlainText,
    });
  }

  return list.sort((a, b) => b.totalSpend - a.totalSpend);
}

import type { InventoryState, AgentAction, AutoDraftPoDraftData } from '../types';
import { makeAgentActionId } from '../actionId';

const OPEN_PO: ReadonlySet<string> = new Set(['Draft', 'Sent', 'Acknowledged', 'In Transit']);

function fmtInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

function addDaysYmd(now: Date, days: number): string {
  const d = new Date(now.getTime());
  d.setDate(d.getDate() + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function leadForProduct(state: InventoryState, supplierName: string): number {
  const s = state.suppliers.find((x) => x.name === supplierName);
  return s != null && s.leadTimeDays > 0 ? s.leadTimeDays : 7;
}

function hasOpenPoForProduct(state: InventoryState, productId: string, supplier: string): boolean {
  return state.purchaseOrders.some(
    (po) =>
      po.productId === productId &&
      po.supplier === supplier &&
      OPEN_PO.has(po.status)
  );
}

export function decideAutoDraftPo(state: InventoryState, now: Date): readonly AgentAction[] {
  const out: AgentAction[] = [];

  for (const p of state.products) {
    const daily = state.metrics.dailySalesRate[p.id] ?? 0;
    if (daily <= 0) continue;

    const daysLeft = state.metrics.daysUntilStockout[p.id];
    if (daysLeft == null) continue;

    const lead = leadForProduct(state, p.supplier);
    if (daysLeft >= lead) continue;

    if (hasOpenPoForProduct(state, p.id, p.supplier)) continue;

    let confidence = 70;
    if (daysLeft < 3) confidence = 95;
    else if (daysLeft < 5) confidence = 85;

    const qty = Math.max(0, Math.ceil(daily * 30 * 1.2));
    const stock = Number(p.stock) || 0;
    const price = Number(p.price) || 0;
    const impact = daily * price * lead;

    const expectedDelivery = addDaysYmd(now, lead);
    const lineTotalInr = Math.max(0, qty * (Number(p.cost) || 0));

    const draftData: AutoDraftPoDraftData = {
      kind: 'auto-draft-po',
      supplier: p.supplier,
      productId: p.id,
      productName: p.name,
      quantity: qty,
      expectedDelivery,
      lineTotalInr,
    };

    const reasoning = [
      `Stock cover is below supplier lead time.`,
      `Current stock: ${stock} ${p.unit}.`,
      `Daily rate (30d avg): ${daily.toFixed(2)} ${p.unit}/day.`,
      `Estimated days until stockout: ${daysLeft}.`,
      `Supplier lead time used: ${lead} days.`,
      `Suggested order qty: ${qty} ${p.unit} (30d demand × 1.2, rounded up).`,
    ].join(' ');

    out.push({
      id: makeAgentActionId('auto-draft-po', p.id, now),
      timestamp: now.toISOString(),
      type: 'auto-draft-po',
      status: 'pending-approval',
      confidence,
      title: `Auto-draft PO: ${p.name}`,
      reasoning,
      impact: fmtInr(impact),
      targetId: p.id,
      targetName: p.name,
      draftData,
    });
  }

  return out;
}

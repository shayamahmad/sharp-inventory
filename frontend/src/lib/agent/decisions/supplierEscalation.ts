import type { InventoryState, AgentAction } from '../types';
import { makeAgentActionId } from '../actionId';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isDelayed(po: InventoryState['purchaseOrders'][number], todayYmd: string): boolean {
  if (po.status === 'Closed' || po.status === 'Received') return false;
  const exp = po.expectedDelivery?.trim();
  if (!exp) return false;
  if (exp >= todayYmd) return false;
  const received = po.quantityReceived;
  const ordered = po.quantityOrdered;
  if (received == null) return true;
  return received < ordered;
}

export function decideSupplierEscalation(state: InventoryState, now: Date): readonly AgentAction[] {
  const out: AgentAction[] = [];
  const todayYmd = ymd(now);

  const bySupplier = new Map<
    string,
    { delayed: typeof state.purchaseOrders; delays: number[]; revenue: number }
  >();

  for (const po of state.purchaseOrders) {
    if (!isDelayed(po, todayYmd)) continue;
    let delayDays = 1;
    const expT = new Date(po.expectedDelivery + 'T12:00:00').getTime();
    if (Number.isFinite(expT)) {
      delayDays = Math.max(1, Math.ceil((now.getTime() - expT) / 86_400_000));
    }
    const rev =
      po.amountInrAtCreation != null && Number.isFinite(po.amountInrAtCreation)
        ? po.amountInrAtCreation
        : (() => {
            const pr = state.products.find((p) => p.id === po.productId);
            const c = pr ? Number(pr.cost) || 0 : 0;
            return c * po.quantityOrdered;
          })();

    const cur = bySupplier.get(po.supplier) ?? { delayed: [], delays: [], revenue: 0 };
    cur.delayed.push(po);
    cur.delays.push(delayDays);
    cur.revenue += rev;
    bySupplier.set(po.supplier, cur);
  }

  for (const [name, agg] of bySupplier) {
    if (agg.delayed.length < 2) continue;

    const avgDelay = agg.delays.reduce((a, b) => a + b, 0) / agg.delays.length;
    const targetId = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .slice(0, 80);

    const reasoning = [
      `Supplier **${name}** has ${agg.delayed.length} overdue / behind-schedule POs (expected delivery before ${todayYmd}).`,
      `Average calendar delay ≈ ${avgDelay.toFixed(1)} days vs expected receipt.`,
      `Aggregate exposure ≈ ₹${Math.round(agg.revenue).toLocaleString('en-IN')} (PO value at creation or cost×qty).`,
      `Negotiation brief: (1) enforce SLA penalty clause, (2) request priority allocation on open lines, (3) qualify alternate suppliers for top SKUs.`,
    ].join('\n');

    out.push({
      id: makeAgentActionId('supplier-escalation', targetId, now),
      timestamp: now.toISOString(),
      type: 'supplier-escalation',
      status: 'executed',
      confidence: 88,
      title: `Supplier escalation: ${name}`,
      reasoning,
      impact: `₹${Math.round(agg.revenue).toLocaleString('en-IN')} tied to delayed POs`,
      targetId,
      targetName: name,
      draftData: {
        poIds: agg.delayed.map((p) => p.id),
        avgDelayDays: avgDelay,
        affectedOrders: agg.delayed.length,
      },
    });
  }

  return out;
}

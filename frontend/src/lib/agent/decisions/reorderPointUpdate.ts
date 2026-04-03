import type { InventoryState, AgentAction, ReorderPointDraftData } from '../types';
import { makeAgentActionId } from '../actionId';

function leadForProduct(state: InventoryState, supplierName: string): number {
  const s = state.suppliers.find((x) => x.name === supplierName);
  return s != null && s.leadTimeDays > 0 ? s.leadTimeDays : 7;
}

export function decideReorderPointUpdate(state: InventoryState, now: Date): readonly AgentAction[] {
  const out: AgentAction[] = [];

  for (const p of state.products) {
    const demand = state.metrics.dailySalesRate[p.id] ?? 0;
    if (demand <= 0) continue;

    const lead = leadForProduct(state, p.supplier);
    const rop = demand * lead + demand * 2;
    if (!Number.isFinite(rop) || rop <= 0) continue;

    const minStock = Number(p.minStock) || 0;
    const threshold = 0.6 * rop;
    if (minStock >= threshold) continue;

    const newMin = Math.ceil(rop);

    const draftData: ReorderPointDraftData = {
      kind: 'reorder-point-update',
      productId: p.id,
      oldMinStock: minStock,
      newMinStock: newMin,
    };

    const reasoning = [
      `ROP formula: demand × leadTime + (demand × 2) safety.`,
      `Demand (30d/30): ${demand.toFixed(3)} / day. Lead time: ${lead} days.`,
      `ROP = ${demand.toFixed(3)} × ${lead} + (${demand.toFixed(3)} × 2) = ${rop.toFixed(2)}.`,
      `Current minStock ${minStock} is below 60% of ROP (${threshold.toFixed(2)}).`,
      `Proposed new minStock (ceil ROP): ${newMin}.`,
    ].join(' ');

    out.push({
      id: makeAgentActionId('reorder-point-update', p.id, now),
      timestamp: now.toISOString(),
      type: 'reorder-point-update',
      status: 'pending-approval',
      confidence: 82,
      title: `Reorder point review: ${p.name}`,
      reasoning,
      impact: `Align min stock to ROP (${newMin} ${p.unit})`,
      targetId: p.id,
      targetName: p.name,
      draftData,
    });
  }

  return out;
}

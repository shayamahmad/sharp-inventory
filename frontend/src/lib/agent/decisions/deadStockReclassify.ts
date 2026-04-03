import type { InventoryState, AgentAction } from '../types';
import { makeAgentActionId } from '../actionId';

function recoveryForValue(valueInr: number): { label: string; recovery: number } {
  if (valueInr > 50_000) return { label: 'bundle liquidation (est. 70% recovery)', recovery: valueInr * 0.7 };
  if (valueInr >= 10_000) return { label: '15% discount program (est. 85% of book value)', recovery: valueInr * 0.85 };
  return { label: 'write-off (no recovery assumed)', recovery: 0 };
}

export function decideDeadStockReclassify(state: InventoryState, now: Date): readonly AgentAction[] {
  const out: AgentAction[] = [];

  for (const p of state.products) {
    const daily = state.metrics.dailySalesRate[p.id] ?? 0;
    if (daily <= 0) continue;

    const stock = Number(p.stock) || 0;
    if (stock <= 0) continue;

    const dsi = stock / daily;
    if (!Number.isFinite(dsi) || dsi <= 180) continue;

    const cost = Number(p.cost) || 0;
    const valueInr = stock * cost;
    const { label, recovery } = recoveryForValue(valueInr);
    const impactInr = Math.max(0, valueInr - recovery);

    const reasoning = [
      `Days sales of inventory (DSI) = stock / daily rate = ${dsi.toFixed(0)} days (> 180 threshold).`,
      `Current on-hand: ${stock} ${p.unit} at cost ${cost.toFixed(2)} → book value ${Math.round(valueInr).toLocaleString('en-IN')} INR.`,
      `Recommended path: ${label}.`,
    ].join(' ');

    out.push({
      id: makeAgentActionId('dead-stock-reclassify', p.id, now),
      timestamp: now.toISOString(),
      type: 'dead-stock-reclassify',
      status: 'executed',
      confidence: 90,
      title: `Dead stock review: ${p.name}`,
      reasoning,
      impact: `₹${Math.round(impactInr).toLocaleString('en-IN')} (book − projected recovery)`,
      targetId: p.id,
      targetName: p.name,
      draftData: { strategy: label, bookValueInr: valueInr, projectedRecoveryInr: recovery },
    });
  }

  return out;
}

import { computeInventoryHealth } from '@/lib/inventoryHealthScore';
import type { InventoryState, AgentAction } from '../types';
import { makeAgentActionId } from '../actionId';

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function deadishCount(state: InventoryState): number {
  let n = 0;
  for (const p of state.products) {
    const daily = state.metrics.dailySalesRate[p.id] ?? 0;
    if (daily <= 0) continue;
    const stock = Number(p.stock) || 0;
    if (stock <= 0) continue;
    const dsi = stock / daily;
    if (Number.isFinite(dsi) && dsi > 180) n++;
  }
  return n;
}

function reorderCandidateCount(state: InventoryState): number {
  let n = 0;
  for (const p of state.products) {
    const demand = state.metrics.dailySalesRate[p.id] ?? 0;
    if (demand <= 0) continue;
    const s = state.suppliers.find((x) => x.name === p.supplier);
    const lead = s != null && s.leadTimeDays > 0 ? s.leadTimeDays : 7;
    const rop = demand * lead + demand * 2;
    const minStock = Number(p.minStock) || 0;
    if (minStock < 0.6 * rop) n++;
  }
  return n;
}

function escalationSupplierCount(state: InventoryState, now: Date): number {
  const todayYmd = ymd(now);
  const map = new Map<string, number>();
  for (const po of state.purchaseOrders) {
    if (po.status === 'Closed' || po.status === 'Received') continue;
    const exp = po.expectedDelivery?.trim();
    if (!exp || exp >= todayYmd) continue;
    const received = po.quantityReceived;
    if (received != null && received >= po.quantityOrdered) continue;
    map.set(po.supplier, (map.get(po.supplier) ?? 0) + 1);
  }
  return [...map.values()].filter((c) => c >= 2).length;
}

function topImpactSkus(state: InventoryState): { name: string; exposure: number }[] {
  const rows = state.products
    .map((p) => {
      const daily = state.metrics.dailySalesRate[p.id] ?? 0;
      const stock = Number(p.stock) || 0;
      const cost = Number(p.cost) || 0;
      const days = state.metrics.daysUntilStockout[p.id];
      const exposure = stock * cost + (days != null && days < 14 ? daily * Number(p.price || 0) * 7 : 0);
      return { name: p.name, exposure };
    })
    .sort((a, b) => b.exposure - a.exposure)
    .slice(0, 3);
  return rows;
}

function cashFlowHint(state: InventoryState, now: Date): string {
  const cutoff = new Date(now.getTime() - 7 * 86_400_000);
  const y = cutoff.getFullYear();
  const m = String(cutoff.getMonth() + 1).padStart(2, '0');
  const d = String(cutoff.getDate()).padStart(2, '0');
  const cutYmd = `${y}-${m}-${d}`;

  let sum = 0;
  for (const o of state.orders) {
    if (o.date >= cutYmd) sum += o.total;
  }
  const openPoValue = state.purchaseOrders
    .filter((po) => po.status !== 'Closed' && po.status !== 'Draft')
    .reduce((s, po) => s + (po.amountInrAtCreation ?? 0), 0);

  if (sum < 10_000 && openPoValue > 50_000) {
    return 'Cash flow risk: low inbound revenue last 7d vs elevated open PO outflows — tighten approval gates.';
  }
  if (openPoValue > sum * 3 && sum > 0) {
    return 'Cash flow risk: committed PO spend outpacing recent sales velocity — review payment terms.';
  }
  return 'Cash flow: recent order intake vs open PO commitments appears balanced; continue monitoring weekly.';
}

export function decideDailyBriefing(state: InventoryState, now: Date): readonly AgentAction[] {
  const dayKey = `briefing-${ymd(now)}`;
  const health = computeInventoryHealth(
    [...state.products],
    [...state.orders],
    [...state.purchaseOrders]
  );

  const dead = deadishCount(state);
  const reorderN = reorderCandidateCount(state);
  const escN = escalationSupplierCount(state, now);
  const top = topImpactSkus(state);
  const cash = cashFlowHint(state, now);

  let strategy =
    health.tier === 'poor'
      ? 'Prioritize stockout SKUs and supplier recovery; defer non-critical buys.'
      : health.tier === 'fair'
        ? 'Balance reorders with working capital; escalate worst two suppliers only.'
        : 'Maintain cadence; shift focus to margin mix and dead-stock clearance.';

  const topLines = top.map((t) => `• ${t.name}: exposure index ≈ ₹${Math.round(t.exposure).toLocaleString('en-IN')}`).join('\n');

  const reasoning = [
    `Daily operations snapshot (pending approvals are merged at run-time in the agent log).`,
    `Dead-stock candidates (DSI > 180): **${dead}**.`,
    `Reorder-point misalignments (min < 0.6×ROP): **${reorderN}**.`,
    `Suppliers with ≥2 delayed POs: **${escN}**.`,
    `Inventory health score: **${health.total}/100** (${health.tier}).`,
    `Top SKUs by exposure index:\n${topLines || '• —'}`,
    `Cash: ${cash}`,
  ].join('\n');

  return [
    {
      id: makeAgentActionId('daily-briefing', dayKey, now),
      timestamp: now.toISOString(),
      type: 'daily-briefing',
      status: 'executed',
      confidence: 100,
      title: `Daily briefing ${ymd(now)}`,
      reasoning,
      impact: `Health ${health.total}/100 · focus: ${health.tier}`,
      targetId: dayKey,
      targetName: 'Workspace',
      draftData: { healthTotal: health.total, healthTier: health.tier, strategy },
    },
  ];
}

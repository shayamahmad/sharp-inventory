import type { DecisionFn, EngineToggles, InventoryState, AgentAction } from '../types';
import { decideAutoDraftPo } from './autoDraftPo';
import { decideDeadStockReclassify } from './deadStockReclassify';
import { decideSupplierEscalation } from './supplierEscalation';
import { decideReorderPointUpdate } from './reorderPointUpdate';
import { decideDailyBriefing } from './dailyBriefing';

const PIPELINE: ReadonlyArray<{ key: keyof EngineToggles; fn: DecisionFn }> = [
  { key: 'autoDraftPo', fn: decideAutoDraftPo },
  { key: 'deadStockReclassify', fn: decideDeadStockReclassify },
  { key: 'supplierEscalation', fn: decideSupplierEscalation },
  { key: 'reorderPointUpdate', fn: decideReorderPointUpdate },
  { key: 'dailyBriefing', fn: decideDailyBriefing },
];

/**
 * Runs decision functions in order; each isolated in try/catch (failures dropped).
 */
export function runDecisionPipeline(
  state: InventoryState,
  now: Date,
  toggles: EngineToggles
): AgentAction[] {
  const acc: AgentAction[] = [];
  for (const { key, fn } of PIPELINE) {
    if (!toggles[key]) continue;
    try {
      acc.push(...fn(state, now));
    } catch {
      /* fault isolation */
    }
  }
  return acc;
}

export {
  decideAutoDraftPo,
  decideDeadStockReclassify,
  decideSupplierEscalation,
  decideReorderPointUpdate,
  decideDailyBriefing,
};

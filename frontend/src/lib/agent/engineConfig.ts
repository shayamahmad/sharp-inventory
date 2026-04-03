import type { EngineToggles } from './types';
import { DEFAULT_ENGINE_TOGGLES } from './types';
import { AGENT_ENGINE_CONFIG_KEY } from './agentStorage';

export function readEngineToggles(): EngineToggles {
  if (typeof window === 'undefined') return { ...DEFAULT_ENGINE_TOGGLES };
  try {
    const raw = window.localStorage.getItem(AGENT_ENGINE_CONFIG_KEY);
    if (!raw) return { ...DEFAULT_ENGINE_TOGGLES };
    const o = JSON.parse(raw) as Record<string, boolean>;
    return {
      autoDraftPo: o.autoDraftPo !== false,
      deadStockReclassify: o.deadStockReclassify !== false,
      supplierEscalation: o.supplierEscalation !== false,
      reorderPointUpdate: o.reorderPointUpdate !== false,
      dailyBriefing: o.dailyBriefing !== false,
    };
  } catch {
    return { ...DEFAULT_ENGINE_TOGGLES };
  }
}

export function writeEngineToggles(t: EngineToggles): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENT_ENGINE_CONFIG_KEY, JSON.stringify(t));
  } catch {
    /* ignore */
  }
}

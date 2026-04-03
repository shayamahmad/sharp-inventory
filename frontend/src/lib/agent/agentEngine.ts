import type { InventoryState, AgentAction, EngineToggles } from './types';
import { runDecisionPipeline } from './decisions';
import {
  readAgentLog,
  writeAgentLog,
  withSignature,
  isSignatureRecent,
  appendEntries,
  type PersistedAgentEntry,
} from './agentStorage';
import { actionSignature } from './actionId';
import { readEngineToggles } from './engineConfig';

export const AGENT_TICK_MS = 60_000;

export type StateGetter = () => InventoryState;

export interface AgentRunMeta {
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  appendedCount: number;
  nextTickInMs: number;
}

type RunListener = (log: PersistedAgentEntry[], meta: AgentRunMeta) => void;

/**
 * Singleton orchestration: one interval, non-overlapping runs, 24h dedup on type+targetId.
 */
export class InventoryAgentEngine {
  private static instance: InventoryAgentEngine | null = null;

  static getInstance(): InventoryAgentEngine {
    if (!InventoryAgentEngine.instance) {
      InventoryAgentEngine.instance = new InventoryAgentEngine();
    }
    return InventoryAgentEngine.instance;
  }

  private intervalId: ReturnType<typeof setInterval> | null = null;
  private executing = false;
  private stateGetter: StateGetter | null = null;
  private listeners = new Set<RunListener>();
  private lastRunAt: number | null = null;
  private lastDurationMs = 0;

  private constructor() {}

  registerStateGetter(fn: StateGetter): void {
    this.stateGetter = fn;
  }

  subscribe(fn: RunListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  getLastRunAt(): number | null {
    return this.lastRunAt;
  }

  getLastDurationMs(): number {
    return this.lastDurationMs;
  }

  start(): void {
    if (this.intervalId != null) return;
    this.intervalId = setInterval(() => {
      void this.safeTick();
    }, AGENT_TICK_MS);
  }

  stop(): void {
    if (this.intervalId != null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emit(log: PersistedAgentEntry[], meta: AgentRunMeta): void {
    for (const fn of this.listeners) {
      try {
        fn(log, meta);
      } catch {
        /* ignore listener errors */
      }
    }
  }

  private mergeBriefingPending(
    actions: AgentAction[],
    pendingCount: number
  ): AgentAction[] {
    if (pendingCount === 0) return actions;
    return actions.map((a) => {
      if (a.type !== 'daily-briefing') return a;
      return {
        ...a,
        reasoning: `${a.reasoning}\n• Pending approvals (current log): **${pendingCount}**.`,
      };
    });
  }

  private async safeTick(): Promise<void> {
    if (this.executing) return;
    if (!this.stateGetter) return;

    this.executing = true;
    const t0 = performance.now();
    const startedAt = new Date().toISOString();
    const now = new Date();
    const nowMs = now.getTime();

    try {
      const state = this.stateGetter();
      const toggles = readEngineToggles();
      let proposed = runDecisionPipeline(state, now, toggles);

      const file = readAgentLog();
      const pendingCount = file.entries.filter((e) => e.status === 'pending-approval').length;
      proposed = this.mergeBriefingPending(proposed, pendingCount);

      const fresh: PersistedAgentEntry[] = [];
      const seenThisRun = new Set<string>();
      for (const a of proposed) {
        const sig = actionSignature(a.type, a.targetId);
        if (seenThisRun.has(sig)) continue;
        seenThisRun.add(sig);
        if (isSignatureRecent(file, a.type, a.targetId, nowMs)) continue;
        fresh.push(withSignature(a));
      }

      const next = appendEntries(file, fresh);
      writeAgentLog(next);

      const finishedAt = new Date().toISOString();
      this.lastRunAt = nowMs;
      this.lastDurationMs = Math.round(performance.now() - t0);

      this.emit(next.entries, {
        startedAt,
        finishedAt,
        durationMs: this.lastDurationMs,
        appendedCount: fresh.length,
        nextTickInMs: AGENT_TICK_MS,
      });
    } catch {
      /* silent */
    } finally {
      this.executing = false;
    }
  }

  /** Optional manual run (e.g. tests) — same guards except interval */
  runOnceNow(): void {
    void this.safeTick();
  }
}

export function getAgentEngine(): InventoryAgentEngine {
  return InventoryAgentEngine.getInstance();
}

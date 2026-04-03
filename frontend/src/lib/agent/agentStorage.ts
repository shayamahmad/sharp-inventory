import type { AgentAction } from './types';
import { actionSignature } from './actionId';

/** Persisted agent log (spec: `agent-log`) */
export const AGENT_LOG_KEY = 'agent-log';
export const AGENT_ENGINE_CONFIG_KEY = 'sharp-inventory-agent-engines';

const LOG_VERSION = 1 as const;

export interface PersistedAgentEntry extends AgentAction {
  signature: string;
}

export interface AgentLogFile {
  v: typeof LOG_VERSION;
  entries: PersistedAgentEntry[];
}

export function emptyLogFile(): AgentLogFile {
  return { v: LOG_VERSION, entries: [] };
}

export function readAgentLog(): AgentLogFile {
  if (typeof window === 'undefined') return emptyLogFile();
  try {
    const raw = window.localStorage.getItem(AGENT_LOG_KEY);
    if (!raw) return emptyLogFile();
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      (parsed as AgentLogFile).v === LOG_VERSION &&
      Array.isArray((parsed as AgentLogFile).entries)
    ) {
      return parsed as AgentLogFile;
    }
  } catch {
    /* ignore */
  }
  return emptyLogFile();
}

export function writeAgentLog(file: AgentLogFile): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(AGENT_LOG_KEY, JSON.stringify(file));
  } catch {
    /* ignore */
  }
}

export function withSignature(a: AgentAction): PersistedAgentEntry {
  return {
    ...a,
    signature: actionSignature(a.type, a.targetId),
  };
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

export function isSignatureRecent(file: AgentLogFile, type: string, targetId: string, nowMs: number): boolean {
  const sig = actionSignature(type, targetId);
  for (let i = file.entries.length - 1; i >= 0; i--) {
    const e = file.entries[i];
    if (e.signature !== sig) continue;
    const t = Date.parse(e.timestamp);
    if (!Number.isFinite(t)) continue;
    if (nowMs - t < WINDOW_MS) return true;
  }
  return false;
}

export function appendEntries(file: AgentLogFile, newEntries: readonly PersistedAgentEntry[]): AgentLogFile {
  if (newEntries.length === 0) return file;
  return {
    v: LOG_VERSION,
    entries: [...file.entries, ...newEntries],
  };
}

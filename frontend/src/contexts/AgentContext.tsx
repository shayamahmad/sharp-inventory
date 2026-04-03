import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { useAuth } from '@/contexts/AuthContext';
import { nextPrefixedId } from '@/lib/ids';
import { buildInventoryState } from '@/lib/agent/buildInventoryState';
import { getAgentEngine, AGENT_TICK_MS } from '@/lib/agent/agentEngine';
import type { AgentAction, EngineToggles } from '@/lib/agent/types';
import { isAutoDraftPoDraft, isReorderDraft } from '@/lib/agent/types';
import {
  readAgentLog,
  writeAgentLog,
  withSignature,
  emptyLogFile,
  type PersistedAgentEntry,
} from '@/lib/agent/agentStorage';
import { readEngineToggles, writeEngineToggles } from '@/lib/agent/engineConfig';

interface AgentContextValue {
  agentLog: readonly PersistedAgentEntry[];
  addAgentAction: (a: Omit<AgentAction, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => void;
  approveAction: (id: string) => void;
  dismissAction: (id: string) => void;
  clearLog: () => void;
  agentEnabled: boolean;
  setAgentEnabled: (v: boolean) => void;
  engineToggles: EngineToggles;
  setEngineToggles: (t: EngineToggles) => void;
  lastRunAt: number | null;
  lastDurationMs: number;
  countdownSec: number;
  actionsTodayCount: number;
  pendingApprovalCount: number;
  refreshLog: () => void;
}

const AgentContext = createContext<AgentContextValue | undefined>(undefined);

function startOfTodayMs(now: Date): number {
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return d.getTime();
}

export function AgentProvider({ children }: { children: ReactNode }) {
  const { products, purchaseOrders, orders, setPurchaseOrders, setProducts, addLog } = useInventory();
  const { user } = useAuth();

  const [agentLog, setAgentLog] = useState<PersistedAgentEntry[]>(() => readAgentLog().entries);
  const [agentEnabled, setAgentEnabled] = useState(true);
  const [engineToggles, setEngineTogglesState] = useState<EngineToggles>(() => readEngineToggles());
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const [lastDurationMs, setLastDurationMs] = useState(0);
  const [nowTick, setNowTick] = useState(() => Date.now());

  const snapshotRef = useRef(() =>
    buildInventoryState(products, purchaseOrders, orders)
  );
  snapshotRef.current = () => buildInventoryState(products, purchaseOrders, orders);

  const refreshLog = useCallback(() => {
    setAgentLog(readAgentLog().entries);
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const engine = getAgentEngine();

  useEffect(() => {
    engine.registerStateGetter(() => snapshotRef.current());
  }, [engine]);

  useEffect(() => {
    const unsub = engine.subscribe((entries, meta) => {
      setAgentLog(entries);
      setLastRunAt(Date.parse(meta.finishedAt));
      setLastDurationMs(meta.durationMs);
    });
    return unsub;
  }, [engine]);

  useEffect(() => {
    if (agentEnabled) engine.start();
    else engine.stop();
    return () => {
      engine.stop();
    };
  }, [agentEnabled, engine]);

  const countdownSec = useMemo(() => {
    const last = engine.getLastRunAt();
    if (last == null) return Math.floor(AGENT_TICK_MS / 1000);
    const elapsed = nowTick - last;
    const left = AGENT_TICK_MS - (elapsed % AGENT_TICK_MS);
    return Math.max(0, Math.floor(left / 1000));
  }, [nowTick, engine, lastRunAt]);

  const actionsTodayCount = useMemo(() => {
    const t0 = startOfTodayMs(new Date(nowTick));
    return agentLog.filter((e) => Date.parse(e.timestamp) >= t0).length;
  }, [agentLog, nowTick]);

  const pendingApprovalCount = useMemo(
    () => agentLog.filter((e) => e.status === 'pending-approval').length,
    [agentLog]
  );

  const setEngineToggles = useCallback((t: EngineToggles) => {
    setEngineTogglesState(t);
    writeEngineToggles(t);
  }, []);

  const addAgentAction = useCallback(
    (a: Omit<AgentAction, 'id' | 'timestamp'> & { id?: string; timestamp?: string }) => {
      const ts = a.timestamp ?? new Date().toISOString();
      const id = a.id ?? `manual-${Date.now()}`;
      const full: AgentAction = {
        ...a,
        id,
        timestamp: ts,
      };
      const file = readAgentLog();
      const next = {
        v: 1 as const,
        entries: [...file.entries, withSignature(full)],
      };
      writeAgentLog(next);
      setAgentLog(next.entries);
    },
    []
  );

  const updateEntry = useCallback((id: string, patch: Partial<AgentAction>) => {
    const file = readAgentLog();
    const entries = file.entries.map((e) => (e.id === id ? { ...e, ...patch, signature: e.signature } : e));
    const next = { v: 1 as const, entries };
    writeAgentLog(next);
    setAgentLog(entries);
  }, []);

  const dismissAction = useCallback(
    (id: string) => {
      updateEntry(id, { status: 'dismissed' });
      addLog(user?.name || 'System', 'Agent', `Dismissed agent action ${id}`);
    },
    [updateEntry, addLog, user?.name]
  );

  const approveAction = useCallback(
    (id: string) => {
      const entry = readAgentLog().entries.find((e) => e.id === id);
      if (!entry || entry.status !== 'pending-approval') return;

      if (entry.type === 'auto-draft-po' && isAutoDraftPoDraft(entry.draftData)) {
        const d = entry.draftData;
        setPurchaseOrders((prev) => {
          const poId = nextPrefixedId('PO', prev.map((p) => p.id));
          return [
            ...prev,
            {
              id: poId,
              supplier: d.supplier,
              productId: d.productId,
              productName: d.productName,
              quantityOrdered: d.quantity,
              quantityReceived: null,
              expectedDelivery: d.expectedDelivery,
              status: 'Draft' as const,
              discrepancy: false,
              poCurrency: 'INR' as const,
              lineTotalForeign: d.lineTotalInr,
              amountInrAtCreation: d.lineTotalInr,
              rateInrPerUnitAtCreation: 1,
            },
          ];
        });
        addLog(
          user?.name || 'System',
          'Agent approved',
          `Auto-created PO for ${d.productName} (qty ${d.quantity}) — Auto-created by Inventory Agent`
        );
        updateEntry(id, { status: 'approved' });
        return;
      }

      if (entry.type === 'reorder-point-update' && isReorderDraft(entry.draftData)) {
        const d = entry.draftData;
        setProducts((prev) =>
          prev.map((p) => (p.id === d.productId ? { ...p, minStock: d.newMinStock } : p))
        );
        addLog(
          user?.name || 'System',
          'Agent approved',
          `Updated minStock for ${d.productId}: ${d.oldMinStock} → ${d.newMinStock} — Auto-created by Inventory Agent`
        );
        updateEntry(id, { status: 'approved' });
      }
    },
    [setPurchaseOrders, setProducts, addLog, user?.name, updateEntry]
  );

  const clearLog = useCallback(() => {
    const empty = emptyLogFile();
    writeAgentLog(empty);
    setAgentLog([]);
  }, []);

  const value = useMemo<AgentContextValue>(
    () => ({
      agentLog,
      addAgentAction,
      approveAction,
      dismissAction,
      clearLog,
      agentEnabled,
      setAgentEnabled,
      engineToggles,
      setEngineToggles,
      lastRunAt: lastRunAt ?? engine.getLastRunAt(),
      lastDurationMs: lastDurationMs || engine.getLastDurationMs(),
      countdownSec,
      actionsTodayCount,
      pendingApprovalCount,
      refreshLog,
    }),
    [
      agentLog,
      addAgentAction,
      approveAction,
      dismissAction,
      clearLog,
      agentEnabled,
      engineToggles,
      setEngineToggles,
      lastRunAt,
      lastDurationMs,
      countdownSec,
      actionsTodayCount,
      pendingApprovalCount,
      refreshLog,
      engine,
    ]
  );

  return <AgentContext.Provider value={value}>{children}</AgentContext.Provider>;
}

export function useAgent(): AgentContextValue {
  const ctx = useContext(AgentContext);
  if (!ctx) throw new Error('useAgent must be used within AgentProvider');
  return ctx;
}

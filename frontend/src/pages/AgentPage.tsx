import React, { useMemo, useState } from 'react';
import { Bot, ChevronDown, ChevronRight, Clock, Gauge, Sparkles } from 'lucide-react';
import { useAgent } from '@/contexts/AgentContext';
import { Button } from '@/components/ui/button';
import { parseImpactInr } from '@/lib/agent/parseImpactInr';
import type { AgentActionStatus, AgentActionType, EngineToggleKey } from '@/lib/agent/types';
import type { PersistedAgentEntry } from '@/lib/agent/agentStorage';

type StatusFilter = 'all' | AgentActionStatus;
type TypeFilter = 'all' | AgentActionType;

const ENGINE_ROWS: { key: EngineToggleKey; label: string }[] = [
  { key: 'autoDraftPo', label: 'Auto-draft purchase orders' },
  { key: 'deadStockReclassify', label: 'Dead stock reclassification' },
  { key: 'supplierEscalation', label: 'Supplier escalation' },
  { key: 'reorderPointUpdate', label: 'Reorder point optimization' },
  { key: 'dailyBriefing', label: 'Daily briefing' },
];

function typeLabel(t: AgentActionType): string {
  switch (t) {
    case 'auto-draft-po':
      return 'Auto-draft PO';
    case 'dead-stock-reclassify':
      return 'Dead stock';
    case 'supplier-escalation':
      return 'Supplier escalation';
    case 'reorder-point-update':
      return 'Reorder point';
    case 'daily-briefing':
      return 'Daily briefing';
  }
}

function confidenceBadgeClass(c: number): string {
  if (c >= 90) return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/35';
  if (c >= 80) return 'bg-amber-500/15 text-amber-950 dark:text-amber-100 border-amber-500/35';
  return 'bg-muted text-muted-foreground border-border';
}

function RobotBadge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-violet-500/35 bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-violet-800 dark:text-violet-200">
      <Bot className="h-3 w-3" aria-hidden />
      Auto-created by Inventory Agent
    </span>
  );
}

export default function AgentPage() {
  const {
    agentLog,
    approveAction,
    dismissAction,
    clearLog,
    agentEnabled,
    setAgentEnabled,
    engineToggles,
    setEngineToggles,
    lastRunAt,
    lastDurationMs,
    countdownSec,
    actionsTodayCount,
  } = useAgent();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());

  const weekMs = 7 * 24 * 60 * 60 * 1000;
  const weeklyStats = useMemo(() => {
    const now = Date.now();
    const inWeek = agentLog.filter((e) => now - Date.parse(e.timestamp) <= weekMs);
    let impactSum = 0;
    for (const e of inWeek) {
      const v = parseImpactInr(e.impact);
      if (v != null) impactSum += v;
    }
    return { count: inWeek.length, impactSum };
  }, [agentLog, weekMs]);

  const pending = useMemo(
    () =>
      agentLog
        .filter((e) => e.status === 'pending-approval')
        .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp)),
    [agentLog]
  );

  const timeline = useMemo(() => {
    let list: readonly PersistedAgentEntry[] = agentLog;
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter((e) => e.type === typeFilter);
    return [...list].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  }, [agentLog, statusFilter, typeFilter]);

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const lastRunLabel =
    lastRunAt != null
      ? new Date(lastRunAt).toLocaleString('en-IN', {
          day: '2-digit',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      : '—';

  return (
    <div className="mx-auto max-w-5xl space-y-8 animate-fade-in">
      <div className="rounded-xl border border-violet-500/30 bg-gradient-to-r from-violet-500/12 via-violet-600/5 to-transparent p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-600/20 text-violet-700 dark:text-violet-300">
              <Sparkles className="h-6 w-6" aria-hidden />
            </span>
            <div>
              <h2 className="font-display text-lg font-bold text-foreground sm:text-xl">Inventory Agent</h2>
              <p className="text-sm text-muted-foreground">Violet ops layer — deterministic rules, no external APIs.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                agentEnabled
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'
                  : 'border-muted-foreground/30 bg-muted text-muted-foreground'
              }`}
            >
              {agentEnabled ? 'Active' : 'Paused'}
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-violet-500/50 text-violet-600 focus:ring-violet-500"
                checked={agentEnabled}
                onChange={(e) => setAgentEnabled(e.target.checked)}
              />
              Run agent
            </label>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-lg border border-violet-500/20 bg-background/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              Last run
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground">{lastRunLabel}</p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-background/80 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Gauge className="h-3.5 w-3.5" />
              Next tick
            </p>
            <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">
              {countdownSec}s · last {lastDurationMs}ms
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/20 bg-background/80 px-3 py-2">
            <p className="text-xs font-medium text-muted-foreground">Actions today</p>
            <p className="mt-1 text-sm font-semibold text-foreground tabular-nums">{actionsTodayCount}</p>
          </div>
        </div>
      </div>

      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-foreground">Pending approvals</h3>
          <RobotBadge />
        </div>
        {pending.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing waiting — draft POs and reorder updates appear here.</p>
        ) : (
          <ul className="space-y-3">
            {pending.map((e) => (
              <li
                key={e.id}
                className="rounded-xl border border-violet-500/25 bg-card p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${confidenceBadgeClass(e.confidence)}`}
                      >
                        {e.confidence}% confidence
                      </span>
                      <span className="text-xs text-muted-foreground">{typeLabel(e.type)}</span>
                    </div>
                    <h4 className="font-medium text-foreground">{e.title}</h4>
                    <p className="whitespace-pre-wrap text-sm text-muted-foreground">{e.reasoning}</p>
                    <p className="text-sm font-semibold text-violet-700 dark:text-violet-300">{e.impact}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
                    <Button
                      type="button"
                      size="sm"
                      className="bg-violet-600 text-white hover:bg-violet-600/90"
                      onClick={() => approveAction(e.id)}
                    >
                      Approve
                    </Button>
                    <Button type="button" size="sm" variant="outline" onClick={() => dismissAction(e.id)}>
                      Dismiss
                    </Button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h3 className="font-display text-base font-semibold text-foreground">Timeline</h3>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted-foreground">Status</span>
            <select
              value={statusFilter}
              onChange={(ev) => setStatusFilter(ev.target.value as StatusFilter)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="executed">Executed</option>
              <option value="pending-approval">Pending approval</option>
              <option value="approved">Approved</option>
              <option value="dismissed">Dismissed</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-foreground">
            <span className="text-muted-foreground">Type</span>
            <select
              value={typeFilter}
              onChange={(ev) => setTypeFilter(ev.target.value as TypeFilter)}
              className="rounded-md border border-input bg-background px-2 py-1.5 text-sm"
            >
              <option value="all">All</option>
              <option value="auto-draft-po">Auto-draft PO</option>
              <option value="dead-stock-reclassify">Dead stock</option>
              <option value="supplier-escalation">Supplier escalation</option>
              <option value="reorder-point-update">Reorder point</option>
              <option value="daily-briefing">Daily briefing</option>
            </select>
          </label>
        </div>

        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No entries match these filters.</p>
        ) : (
          <ul className="space-y-2">
            {timeline.map((e) => {
              const open = expanded.has(e.id);
              return (
                <li key={e.id} className="rounded-lg border border-border bg-card">
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm hover:bg-muted/50"
                    onClick={() => toggleExpanded(e.id)}
                  >
                    {open ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                    <span className="min-w-0 flex-1 truncate font-medium text-foreground">{e.title}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{typeLabel(e.type)}</span>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${confidenceBadgeClass(e.confidence)}`}
                    >
                      {e.confidence}%
                    </span>
                  </button>
                  {open && (
                    <div className="space-y-2 border-t border-border px-3 py-3 text-sm">
                      <p className="text-xs text-muted-foreground">
                        {new Date(e.timestamp).toLocaleString('en-IN')} · {e.status} · {e.targetName}
                      </p>
                      <p className="whitespace-pre-wrap text-muted-foreground">{e.reasoning}</p>
                      <p className="font-semibold text-violet-700 dark:text-violet-300">{e.impact}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-violet-500/20 bg-muted/20 p-4 space-y-4">
        <h3 className="font-display text-base font-semibold text-foreground">Settings</h3>
        <p className="text-sm text-muted-foreground">Toggle decision engines (saved in this browser). Rolling 7-day window for stats.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {ENGINE_ROWS.map((row) => (
            <label
              key={row.key}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-border bg-background px-3 py-2"
            >
              <span className="text-sm text-foreground">{row.label}</span>
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-violet-500/50 text-violet-600"
                checked={engineToggles[row.key]}
                onChange={(ev) => setEngineToggles({ ...engineToggles, [row.key]: ev.target.checked })}
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-dashed border-violet-500/30 bg-violet-500/5 px-3 py-3">
          <div>
            <p className="text-xs text-muted-foreground">Last 7 days</p>
            <p className="text-sm font-semibold text-foreground">
              {weeklyStats.count} actions · ₹{weeklyStats.impactSum.toLocaleString('en-IN', { maximumFractionDigits: 0 })} impact (parsed)
            </p>
          </div>
          <Button type="button" variant="destructive" size="sm" className="ml-auto" onClick={() => clearLog()}>
            Reset agent log
          </Button>
        </div>
      </section>
    </div>
  );
}

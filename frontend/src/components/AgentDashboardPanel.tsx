import React, { useMemo } from 'react';
import { Bot, ChevronRight, AlertCircle } from 'lucide-react';
import { useAgent } from '@/contexts/AgentContext';
import { Button } from '@/components/ui/button';
import { navigateAppPage } from '@/lib/navPage';
import type { AgentActionStatus, AgentActionType } from '@/lib/agent/types';

function typeLabel(t: AgentActionType): string {
  switch (t) {
    case 'auto-draft-po':
      return 'Draft PO';
    case 'dead-stock-reclassify':
      return 'Dead stock';
    case 'supplier-escalation':
      return 'Supplier';
    case 'reorder-point-update':
      return 'Reorder';
    case 'daily-briefing':
      return 'Briefing';
  }
}

function statusChip(s: AgentActionStatus): string {
  switch (s) {
    case 'pending-approval':
      return 'Pending';
    case 'executed':
      return 'Done';
    case 'approved':
      return 'Approved';
    case 'dismissed':
      return 'Dismissed';
  }
}

export default function AgentDashboardPanel() {
  const { agentLog, pendingApprovalCount } = useAgent();

  const lastFive = useMemo(() => {
    return [...agentLog]
      .sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
      .slice(0, 5);
  }, [agentLog]);

  return (
    <div className="space-y-3 rounded-xl border border-violet-500/25 bg-gradient-to-br from-violet-500/10 via-background to-background p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-600/20 text-violet-700 dark:text-violet-300">
            <Bot className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <h3 className="font-display text-sm font-semibold text-foreground">Inventory Agent</h3>
            <p className="text-xs text-muted-foreground">Autonomous decisions — review pending items on the Agent page.</p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0 border-violet-500/40 text-violet-700 hover:bg-violet-500/10 dark:text-violet-200"
          onClick={() => navigateAppPage('agent')}
        >
          Open Agent
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {pendingApprovalCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-lg border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-sm text-amber-950 dark:text-amber-100/95"
          role="status"
        >
          <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            <strong>{pendingApprovalCount}</strong> agent action{pendingApprovalCount === 1 ? '' : 's'} awaiting your approval.
          </span>
        </div>
      )}

      {lastFive.length === 0 ? (
        <p className="text-sm text-muted-foreground">No agent actions yet. The agent runs every 60s when enabled.</p>
      ) : (
        <ul className="space-y-2">
          {lastFive.map((e) => (
            <li
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-card/80 px-3 py-2 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-foreground">{e.title}</p>
                <p className="text-xs text-muted-foreground">
                  {typeLabel(e.type)} · {statusChip(e.status)}
                </p>
              </div>
              <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                {new Date(e.timestamp).toLocaleString('en-IN', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

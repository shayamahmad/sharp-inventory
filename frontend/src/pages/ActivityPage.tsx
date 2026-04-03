import React, { useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { Activity, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import type { ActivityLog } from '@/lib/mockData';
import {
  categorizeActivityAction,
  toneCircleClass,
  userInitials,
  parseActivityTimestamp,
  plainEnglishSummary,
} from '@/lib/activityTimeline';

function parseYmd(s: string): number {
  const d = new Date(s + 'T12:00:00');
  return Number.isNaN(d.getTime()) ? NaN : d.getTime();
}

export default function ActivityPage() {
  const { activityLogs, users } = useInventory();
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState<string>('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [actionPick, setActionPick] = useState<Set<string>>(() => new Set());

  const allActions = useMemo(() => [...new Set(activityLogs.map((l) => l.action))].sort(), [activityLogs]);
  const userNames = useMemo(() => [...new Set(activityLogs.map((l) => l.userName))].sort(), [activityLogs]);

  const toggleAction = (a: string) => {
    setActionPick((prev) => {
      const next = new Set(prev);
      if (next.has(a)) next.delete(a);
      else next.add(a);
      return next;
    });
  };

  const filtered = useMemo(() => {
    const fromT = dateFrom ? parseYmd(dateFrom) : null;
    const toT = dateTo ? parseYmd(dateTo) : null;
    const q = search.trim().toLowerCase();

    return activityLogs.filter((log) => {
      if (userFilter !== 'All' && log.userName !== userFilter) return false;
      if (actionPick.size > 0 && !actionPick.has(log.action)) return false;
      const ts = parseActivityTimestamp(log.timestamp);
      if (fromT != null && !Number.isNaN(fromT) && ts < fromT) return false;
      if (toT != null && !Number.isNaN(toT) && ts > toT + 86400000) return false;
      if (q) {
        const blob = `${log.userName} ${log.action} ${log.details} ${log.timestamp}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }
      return true;
    });
  }, [activityLogs, userFilter, actionPick, dateFrom, dateTo, search]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => parseActivityTimestamp(b.timestamp) - parseActivityTimestamp(a.timestamp)),
    [filtered]
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-card border border-border rounded-xl p-5 space-y-4">
        <h3 className="font-display font-semibold text-foreground flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Activity timeline
        </h3>
        <p className="text-sm text-muted-foreground">
          Visual audit trail with filters. {sorted.length} of {activityLogs.length} entries shown.
        </p>

        <div className="flex flex-col lg:flex-row flex-wrap gap-3 items-stretch lg:items-end">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keywords…"
              className="pl-10 h-10"
            />
          </div>
          <div className="min-w-[160px]">
            <label className="text-xs text-muted-foreground block mb-1">User</label>
            <select
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-input bg-card text-foreground text-sm"
            >
              <option value="All">All users</option>
              {userNames.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <div>
              <label className="text-xs text-muted-foreground block mb-1">From</label>
              <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-10 w-[150px]" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground block mb-1">To</label>
              <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-10 w-[150px]" />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Action type (multi-select)</p>
          <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto p-2 rounded-lg border border-border bg-secondary/30">
            {allActions.map((a) => (
              <button
                key={a}
                type="button"
                onClick={() => toggleAction(a)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  actionPick.has(a)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-card text-muted-foreground border-border hover:border-primary/50'
                }`}
              >
                {a}
              </button>
            ))}
          </div>
          {actionPick.size > 0 && (
            <button type="button" className="text-xs text-primary mt-2 hover:underline" onClick={() => setActionPick(new Set())}>
              Clear action filters
            </button>
          )}
        </div>
      </div>

      <div className="relative pl-2">
        <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" aria-hidden />
        <ul className="space-y-0">
          {sorted.map((log) => (
            <TimelineNode key={log.id} log={log} users={users} />
          ))}
        </ul>
        {sorted.length === 0 && (
          <p className="text-sm text-muted-foreground py-12 text-center border border-dashed border-border rounded-xl">
            No entries match your filters.
          </p>
        )}
      </div>
    </div>
  );
}

function TimelineNode({ log, users }: { log: ActivityLog; users: { id: string; name: string }[] }) {
  const tone = categorizeActivityAction(log.action);
  const circle = toneCircleClass(tone);
  const initials = userInitials(log.userName);
  const uid = users.find((u) => u.name === log.userName)?.id;

  return (
    <li className="relative flex gap-4 pb-8 last:pb-2">
      <div className="relative z-10 flex flex-col items-center shrink-0 w-10">
        <div
          className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-[11px] font-bold shadow-sm ${circle}`}
          title={tone}
        >
          {initials}
        </div>
      </div>
      <div className="flex-1 min-w-0 rounded-xl border border-border bg-card/80 p-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <p className="text-sm font-bold text-foreground">{log.action}</p>
          <time className="text-xs text-muted-foreground tabular-nums">{log.timestamp}</time>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {log.userName}
          {uid && <span className="ml-1 opacity-70">· ID {uid}</span>}
        </p>
        <p className="text-sm text-foreground/90 mt-2 leading-relaxed">{plainEnglishSummary(log)}</p>
        {log.editDiff && (
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
            <div className="rounded-md bg-destructive/15 px-3 py-2 line-through text-destructive">{log.editDiff.old}</div>
            <div className="rounded-md bg-success/15 px-3 py-2 text-success font-medium">{log.editDiff.new}</div>
          </div>
        )}
      </div>
    </li>
  );
}

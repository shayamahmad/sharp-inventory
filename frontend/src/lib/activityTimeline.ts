import type { ActivityLog } from '@/lib/mockData';

export type TimelineTone = 'add' | 'edit' | 'delete' | 'status';

const ADD_ACTIONS = new Set([
  'Added Product',
  'Created Order',
  'Customer Added',
  'GRN Received',
  'Quotation Created',
  'PO Created',
  'Variants Created',
]);

const DELETE_ACTIONS = new Set(['Deleted Product', 'Return Processed']);

const STATUS_ACTIONS = new Set([
  'Order Updated',
  'PO Status Update',
  'Quotation Updated',
  'Quotation Converted',
]);

export function categorizeActivityAction(action: string): TimelineTone {
  if (ADD_ACTIONS.has(action)) return 'add';
  if (DELETE_ACTIONS.has(action)) return 'delete';
  if (STATUS_ACTIONS.has(action)) return 'status';
  return 'edit';
}

export function toneCircleClass(tone: TimelineTone): string {
  switch (tone) {
    case 'add':
      return 'bg-success text-success-foreground border-success';
    case 'edit':
      return 'bg-warning text-warning-foreground border-warning';
    case 'delete':
      return 'bg-destructive text-destructive-foreground border-destructive';
    case 'status':
      return 'bg-info text-info-foreground border-info';
    default:
      return 'bg-muted text-muted-foreground border-border';
  }
}

export function userInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function parseActivityTimestamp(ts: string): number {
  const m = ts.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{1,2}:\d{2})/);
  if (m) {
    const d = new Date(`${m[1]}T${m[2]}:00`);
    if (!Number.isNaN(d.getTime())) return d.getTime();
  }
  const d2 = new Date(ts);
  return Number.isNaN(d2.getTime()) ? 0 : d2.getTime();
}

export function plainEnglishSummary(log: ActivityLog): string {
  if (log.editDiff) {
    return `Changed from “${log.editDiff.old}” to “${log.editDiff.new}”.`;
  }
  return log.details;
}


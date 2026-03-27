import React from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import { Activity, User } from 'lucide-react';

const actionColors: Record<string, string> = {
  'Created Order': 'bg-info/10 text-info',
  'Added Product': 'bg-success/10 text-success',
  'Updated Stock': 'bg-primary/10 text-primary',
  'Deleted Product': 'bg-destructive/10 text-destructive',
  'Viewed Report': 'bg-muted text-muted-foreground',
  'Stock Adjusted': 'bg-warning/10 text-warning',
  'Bulk Stock Adjusted': 'bg-warning/10 text-warning',
  'PO Created': 'bg-info/10 text-info',
  'PO Status Update': 'bg-primary/10 text-primary',
  'GRN Received': 'bg-success/10 text-success',
  'Return Processed': 'bg-destructive/10 text-destructive',
  'Customer Added': 'bg-success/10 text-success',
  'Quotation Created': 'bg-info/10 text-info',
  'Quotation Updated': 'bg-primary/10 text-primary',
  'Quotation Converted': 'bg-success/10 text-success',
  'Order Updated': 'bg-primary/10 text-primary',
  'CSV Import': 'bg-accent/10 text-accent',
  'Variants Created': 'bg-primary/10 text-primary',
};

export default function ActivityPage() {
  const { activityLogs } = useInventory();

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="bg-card border border-border rounded-xl p-5">
        <h3 className="font-display font-semibold text-foreground mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-primary" /> Multi-User Activity Log
        </h3>
        <p className="text-sm text-muted-foreground mb-5">Track who did what across the system. ({activityLogs.length} entries)</p>
        <div className="relative">
          <div className="absolute left-[23px] top-0 bottom-0 w-0.5 bg-border" />
          <div className="space-y-4">
            {activityLogs.map(log => (
              <div key={log.id} className="relative flex items-start gap-4 pl-12">
                <div className="absolute left-0 w-12 flex justify-center">
                  <div className="w-10 h-10 rounded-full bg-card border-2 border-border flex items-center justify-center z-10">
                    <User className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
                <div className="flex-1 bg-secondary/50 rounded-xl p-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">{log.userName}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${actionColors[log.action] || 'bg-muted text-muted-foreground'}`}>{log.action}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{log.timestamp}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">{log.details}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

import type { Product } from '@/lib/mockData';
import type { PurchaseOrder } from '@/contexts/InventoryContext';
import type { Order } from '@/lib/mockData';

export interface Supplier {
  id: string;
  name: string;
  leadTimeDays: number;
}

export interface InventoryState {
  products: readonly Product[];
  purchaseOrders: readonly PurchaseOrder[];
  suppliers: readonly Supplier[];
  orders: readonly Order[];
  metrics: {
    dailySalesRate: Record<string, number>;
    daysUntilStockout: Record<string, number>;
  };
}

export type AgentActionType =
  | 'auto-draft-po'
  | 'dead-stock-reclassify'
  | 'supplier-escalation'
  | 'reorder-point-update'
  | 'daily-briefing';

export type AgentActionStatus = 'executed' | 'pending-approval' | 'approved' | 'dismissed';

export interface AgentAction {
  id: string;
  timestamp: string;
  type: AgentActionType;
  status: AgentActionStatus;
  confidence: number;
  title: string;
  reasoning: string;
  impact: string;
  targetId: string;
  targetName: string;
  draftData?: unknown;
}

export type DecisionFn = (state: InventoryState, now: Date) => readonly AgentAction[];

/** Payload for approved auto-draft PO mutations */
export interface AutoDraftPoDraftData {
  kind: 'auto-draft-po';
  supplier: string;
  productId: string;
  productName: string;
  quantity: number;
  expectedDelivery: string;
  lineTotalInr: number;
}

/** Payload for approved reorder point updates */
export interface ReorderPointDraftData {
  kind: 'reorder-point-update';
  productId: string;
  oldMinStock: number;
  newMinStock: number;
}

export type AgentDraftPayload = AutoDraftPoDraftData | ReorderPointDraftData;

export function isAutoDraftPoDraft(d: unknown): d is AutoDraftPoDraftData {
  return (
    typeof d === 'object' &&
    d !== null &&
    (d as AutoDraftPoDraftData).kind === 'auto-draft-po' &&
    typeof (d as AutoDraftPoDraftData).productId === 'string'
  );
}

export function isReorderDraft(d: unknown): d is ReorderPointDraftData {
  return (
    typeof d === 'object' &&
    d !== null &&
    (d as ReorderPointDraftData).kind === 'reorder-point-update' &&
    typeof (d as ReorderPointDraftData).productId === 'string'
  );
}

export type EngineToggleKey =
  | 'autoDraftPo'
  | 'deadStockReclassify'
  | 'supplierEscalation'
  | 'reorderPointUpdate'
  | 'dailyBriefing';

export type EngineToggles = Record<EngineToggleKey, boolean>;

export const DEFAULT_ENGINE_TOGGLES: EngineToggles = {
  autoDraftPo: true,
  deadStockReclassify: true,
  supplierEscalation: true,
  reorderPointUpdate: true,
  dailyBriefing: true,
};

import React, { createContext, useContext, useState, ReactNode, useCallback, useRef, useEffect } from 'react';
import { flushSync } from 'react-dom';
import {
  products as initialProducts,
  orders as initialOrders,
  activityLogs as initialLogs,
  Product,
  Order,
  ActivityLog,
  users as initialUsers,
  User,
} from '@/lib/mockData';
import {
  rawMaterials as mockRawMaterials,
  billsOfMaterials as mockBillsOfMaterials,
  productionOrders as mockProductionOrders,
  type BOMItem,
  type BillOfMaterials,
  type ProductionOrder,
} from '@/lib/manufacturingData';
import { isApiConfigured, getToken, apiJson, syncIdList, stripEntityMeta, ApiError } from '@/lib/api';
import { nextPrefixedId } from '@/lib/ids';

function mapRawMaterialRow(row: Record<string, unknown>): BOMItem {
  const materialId = String(row.materialId ?? row.id ?? '');
  return {
    materialId,
    materialName: String(row.materialName ?? ''),
    quantityPerUnit: Number(row.quantityPerUnit ?? 0),
    unit: String(row.unit ?? ''),
    costPerUnit: Number(row.costPerUnit ?? 0),
    currentStock: Number(row.currentStock ?? 0),
    minStock: Number(row.minStock ?? 0),
    supplier: String(row.supplier ?? ''),
    leadTimeDays: Number(row.leadTimeDays ?? 0),
  };
}

function normalizeBillOfMaterials(row: Record<string, unknown>): BillOfMaterials {
  const materials = Array.isArray(row.materials)
    ? (row.materials as Record<string, unknown>[]).map((m) => mapRawMaterialRow(m))
    : [];
  return {
    productId: String(row.productId ?? ''),
    productName: String(row.productName ?? ''),
    category: String(row.category ?? ''),
    outputPerBatch: Number(row.outputPerBatch ?? 0),
    laborCostPerBatch: Number(row.laborCostPerBatch ?? 0),
    overheadPerBatch: Number(row.overheadPerBatch ?? 0),
    materials,
    totalMaterialCost: Number(row.totalMaterialCost ?? 0),
    totalCostPerUnit: Number(row.totalCostPerUnit ?? 0),
  };
}

// ── Types (unchanged) ──
export interface StockAdjustment {
  id: string;
  productId: string;
  quantity: number;
  reason: 'Damage' | 'Theft' | 'Audit Correction' | 'Return' | 'Opening Balance' | 'Other';
  userName: string;
  timestamp: string;
}

export interface PurchaseOrder {
  id: string;
  supplier: string;
  productId: string;
  productName: string;
  quantityOrdered: number;
  quantityReceived: number | null;
  expectedDelivery: string;
  status: 'Draft' | 'Sent' | 'Acknowledged' | 'In Transit' | 'Received' | 'Closed';
  dateSent?: string;
  dateReceived?: string;
  discrepancy: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
}

export interface ReturnRequest {
  id: string;
  orderId: string;
  items: { productId: string; productName: string; quantity: number; reason: string; condition: 'Resellable' | 'Damaged' | 'Defective' }[];
  status: 'Pending' | 'Approved' | 'Rejected';
  timestamp: string;
  userName: string;
}

export interface Quotation {
  id: string;
  customerName: string;
  items: { productId: string; productName: string; quantity: number; price: number }[];
  validityDate: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  total: number;
  createdDate: string;
}

export interface ProductVariant {
  sku: string;
  attributes: Record<string, string>;
  stock: number;
  price: number;
}

export interface QCChecklist {
  productionOrderId: string;
  items: { name: string; passed: boolean | null; note: string }[];
  completedBy?: string;
  completedAt?: string;
}

export interface ScheduledReport {
  frequency: 'Daily' | 'Weekly' | 'Monthly';
  dayOfWeek?: string;
  time: string;
  recipients: string[];
  sections: string[];
}

interface InventoryContextType {
  products: Product[];
  setProducts: React.Dispatch<React.SetStateAction<Product[]>>;
  orders: Order[];
  setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
  activityLogs: ActivityLog[];
  addLog: (userName: string, action: string, details: string) => void;
  purchaseOrders: PurchaseOrder[];
  setPurchaseOrders: React.Dispatch<React.SetStateAction<PurchaseOrder[]>>;
  customers: Customer[];
  setCustomers: React.Dispatch<React.SetStateAction<Customer[]>>;
  /** Persists to MongoDB when API + token active; returns error if save fails */
  createCustomer: (fields: Omit<Customer, 'id'>) => Promise<{ ok: boolean; error?: string; customer?: Customer }>;
  returns: ReturnRequest[];
  setReturns: React.Dispatch<React.SetStateAction<ReturnRequest[]>>;
  quotations: Quotation[];
  setQuotations: React.Dispatch<React.SetStateAction<Quotation[]>>;
  qcChecklists: QCChecklist[];
  setQCChecklists: React.Dispatch<React.SetStateAction<QCChecklist[]>>;
  scheduledReport: ScheduledReport | null;
  setScheduledReport: React.Dispatch<React.SetStateAction<ScheduledReport | null>>;
  productVariants: Record<string, ProductVariant[]>;
  setProductVariants: React.Dispatch<React.SetStateAction<Record<string, ProductVariant[]>>>;
  users: User[];
  setUsers: React.Dispatch<React.SetStateAction<User[]>>;
  getReservedStock: (productId: string) => number;
  getAvailableStock: (productId: string) => number;
  /** True while first load from API is in progress */
  inventoryHydrating: boolean;
  rawMaterials: BOMItem[];
  setRawMaterials: React.Dispatch<React.SetStateAction<BOMItem[]>>;
  billsOfMaterials: BillOfMaterials[];
  productionOrders: ProductionOrder[];
  setProductionOrders: React.Dispatch<React.SetStateAction<ProductionOrder[]>>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

function extractCustomers(orders: Order[]): Customer[] {
  const map = new Map<string, Customer>();
  orders.forEach((o) => {
    if (!map.has(o.customerName)) {
      map.set(o.customerName, {
        id: `C${String(map.size + 1).padStart(3, '0')}`,
        name: o.customerName,
        email: `${o.customerName.toLowerCase().replace(/\s+/g, '.')}@email.com`,
        phone: `+91 ${Math.floor(7000000000 + Math.random() * 3000000000)}`,
      });
    }
  });
  return Array.from(map.values());
}

const initialPOs: PurchaseOrder[] = [
  { id: 'PO001', supplier: 'TechWorld Pvt Ltd', productId: 'P001', productName: 'Wireless Earbuds Pro', quantityOrdered: 200, quantityReceived: 200, expectedDelivery: '2026-03-20', status: 'Closed', dateSent: '2026-03-10', dateReceived: '2026-03-20', discrepancy: false },
  { id: 'PO002', supplier: 'FashionHub India', productId: 'P002', productName: 'Cotton T-Shirt Premium', quantityOrdered: 300, quantityReceived: 280, expectedDelivery: '2026-03-15', status: 'Closed', dateSent: '2026-03-05', dateReceived: '2026-03-14', discrepancy: true },
  { id: 'PO003', supplier: 'NatureFresh Foods', productId: 'P003', productName: 'Organic Green Tea', quantityOrdered: 150, quantityReceived: null, expectedDelivery: '2026-03-30', status: 'In Transit', dateSent: '2026-03-20', discrepancy: false },
  { id: 'PO004', supplier: 'BrightLite Corp', productId: 'P004', productName: 'Smart LED Bulb', quantityOrdered: 100, quantityReceived: null, expectedDelivery: '2026-04-01', status: 'Sent', dateSent: '2026-03-22', discrepancy: false },
  { id: 'PO005', supplier: 'GlowSkin Labs', productId: 'P006', productName: 'Face Serum Vitamin C', quantityOrdered: 200, quantityReceived: 160, expectedDelivery: '2026-03-18', status: 'Closed', dateSent: '2026-03-08', dateReceived: '2026-03-17', discrepancy: true },
  { id: 'PO006', supplier: 'FitLife Sports', productId: 'P005', productName: 'Yoga Mat Premium', quantityOrdered: 50, quantityReceived: null, expectedDelivery: '2026-04-05', status: 'Draft', discrepancy: false },
];

const initialQuotations: Quotation[] = [
  { id: 'QT001', customerName: 'Ravi Kumar', items: [{ productId: 'P001', productName: 'Wireless Earbuds Pro', quantity: 10, price: 2499 }, { productId: 'P009', productName: 'Bluetooth Speaker', quantity: 5, price: 1899 }], validityDate: '2026-04-15', status: 'Sent', total: 34485, createdDate: '2026-03-25' },
  { id: 'QT002', customerName: 'Anjali Verma', items: [{ productId: 'P006', productName: 'Face Serum Vitamin C', quantity: 20, price: 899 }], validityDate: '2026-04-10', status: 'Accepted', total: 17980, createdDate: '2026-03-23' },
  { id: 'QT003', customerName: 'Manoj Tiwari', items: [{ productId: 'P010', productName: 'Running Shoes', quantity: 5, price: 3499 }], validityDate: '2026-04-20', status: 'Draft', total: 17495, createdDate: '2026-03-26' },
];

function apiInventoryEnabled(): boolean {
  return isApiConfigured() && !!getToken();
}

function sProduct(p: Product) {
  return stripEntityMeta({ ...p } as unknown as Record<string, unknown>);
}
function sOrder(o: Order) {
  return stripEntityMeta({ ...o } as unknown as Record<string, unknown>);
}
function sPO(p: PurchaseOrder) {
  return stripEntityMeta({ ...p } as unknown as Record<string, unknown>);
}
function sCustomer(c: Customer) {
  return stripEntityMeta({ ...c } as unknown as Record<string, unknown>);
}
function sReturn(r: ReturnRequest) {
  return stripEntityMeta({ ...r } as unknown as Record<string, unknown>);
}
function sQuote(q: Quotation) {
  return stripEntityMeta({ ...q } as unknown as Record<string, unknown>);
}
function sUser(u: User) {
  const o = stripEntityMeta({ ...u } as unknown as Record<string, unknown>);
  if (!o.password) delete o.password;
  return o;
}
function sProductionOrder(p: ProductionOrder) {
  return stripEntityMeta({ ...p } as unknown as Record<string, unknown>);
}

async function syncQcChecklists(prev: QCChecklist[], next: QCChecklist[]) {
  const prevM = new Map(prev.map((x) => [x.productionOrderId, x]));
  const nextM = new Map(next.map((x) => [x.productionOrderId, x]));
  for (const [poId, item] of nextM) {
    const old = prevM.get(poId);
    if (!old || JSON.stringify(old) !== JSON.stringify(item)) {
      await apiJson('PUT', `/api/qc-checklists/${encodeURIComponent(poId)}`, {
        items: item.items,
        completedBy: item.completedBy,
        completedAt: item.completedAt,
      });
    }
  }
  for (const poId of prevM.keys()) {
    if (!nextM.has(poId)) {
      await apiJson('DELETE', `/api/qc-checklists/${encodeURIComponent(poId)}`);
    }
  }
}

async function syncVariants(prev: Record<string, ProductVariant[]>, next: Record<string, ProductVariant[]>) {
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const k of keys) {
    const a = JSON.stringify(prev[k] ?? []);
    const b = JSON.stringify(next[k] ?? []);
    if (a !== b) {
      await apiJson('PUT', `/api/product-variants/${encodeURIComponent(k)}`, { variants: next[k] ?? [] });
    }
  }
}

export function InventoryProvider({ children }: { children: ReactNode }) {
  const useApi = isApiConfigured() && !!getToken();
  const isBulk = useRef(false);

  const [inventoryHydrating, setInventoryHydrating] = useState(useApi);

  const [products, setProductsInternal] = useState<Product[]>(() => (useApi ? [] : initialProducts));
  const [orders, setOrdersInternal] = useState<Order[]>(() => (useApi ? [] : initialOrders));
  const [logs, setLogs] = useState<ActivityLog[]>(() => (useApi ? [] : initialLogs));
  const [purchaseOrders, setPurchaseOrdersInternal] = useState<PurchaseOrder[]>(() => (useApi ? [] : initialPOs));
  const [customers, setCustomersInternal] = useState<Customer[]>(() => (useApi ? [] : extractCustomers(initialOrders)));
  const [returns, setReturnsInternal] = useState<ReturnRequest[]>(() => (useApi ? [] : []));
  const [quotations, setQuotationsInternal] = useState<Quotation[]>(() => (useApi ? [] : initialQuotations));
  const [qcChecklists, setQCChecklistsInternal] = useState<QCChecklist[]>(() => (useApi ? [] : []));
  const [scheduledReport, setScheduledReportInternal] = useState<ScheduledReport | null>(null);
  const [productVariants, setProductVariantsInternal] = useState<Record<string, ProductVariant[]>>({});
  const [users, setUsersInternal] = useState<User[]>(() => (useApi ? [] : initialUsers));
  const [rawMaterials, setRawMaterialsInternal] = useState<BOMItem[]>(() =>
    useApi ? [] : mockRawMaterials.map((m) => ({ ...m }))
  );
  const [billsOfMaterials, setBillsInternal] = useState<BillOfMaterials[]>(() =>
    useApi
      ? []
      : mockBillsOfMaterials.map((b) => ({ ...b, materials: b.materials.map((m) => ({ ...m })) }))
  );
  const [productionOrders, setProductionOrdersInternal] = useState<ProductionOrder[]>(() =>
    useApi ? [] : mockProductionOrders.map((o) => ({ ...o }))
  );

  const refreshFromApi = useCallback(async () => {
    if (!apiInventoryEnabled()) return;
    isBulk.current = true;
    setInventoryHydrating(true);
    try {
      const [
        p,
        o,
        al,
        po,
        cu,
        ret,
        qt,
        qc,
        pv,
        usr,
        sr,
        rm,
        bom,
        prd,
      ] = await Promise.all([
        apiJson<Product[]>('GET', '/api/products'),
        apiJson<Order[]>('GET', '/api/orders'),
        apiJson<ActivityLog[]>('GET', '/api/activity-logs'),
        apiJson<PurchaseOrder[]>('GET', '/api/purchase-orders'),
        apiJson<Customer[]>('GET', '/api/customers'),
        apiJson<ReturnRequest[]>('GET', '/api/returns'),
        apiJson<Quotation[]>('GET', '/api/quotations'),
        apiJson<QCChecklist[]>('GET', '/api/qc-checklists'),
        apiJson<Record<string, ProductVariant[]>>('GET', '/api/product-variants'),
        apiJson<User[]>('GET', '/api/users'),
        apiJson<ScheduledReport | null>('GET', '/api/scheduled-report'),
        apiJson<unknown>('GET', '/api/raw-materials'),
        apiJson<unknown>('GET', '/api/bill-of-materials'),
        apiJson<ProductionOrder[]>('GET', '/api/production-orders'),
      ]);
      const asArr = <T,>(x: unknown): T[] => (Array.isArray(x) ? x : []);
      setProductsInternal(asArr<Product>(p));
      setOrdersInternal(asArr<Order>(o));
      setLogs(asArr<ActivityLog>(al));
      setPurchaseOrdersInternal(asArr<PurchaseOrder>(po));
      setCustomersInternal(asArr<Customer>(cu));
      setReturnsInternal(asArr<ReturnRequest>(ret));
      setQuotationsInternal(asArr<Quotation>(qt));
      setQCChecklistsInternal(asArr<QCChecklist>(qc));
      setProductVariantsInternal(pv && typeof pv === 'object' && !Array.isArray(pv) ? pv : {});
      setUsersInternal(
        asArr<User>(usr).map((u) => ({ ...u, password: u.password ?? '' }))
      );
      setScheduledReportInternal(sr ?? null);
      const rmRows = asArr<Record<string, unknown>>(rm).map((row) => mapRawMaterialRow(row));
      setRawMaterialsInternal(rmRows);
      const bomRows = asArr<Record<string, unknown>>(bom).map((row) => normalizeBillOfMaterials(row));
      setBillsInternal(bomRows);
      setProductionOrdersInternal(asArr<ProductionOrder>(prd));
    } catch (e) {
      console.error('Failed to load inventory from API', e);
      if (e instanceof ApiError && e.status === 401) {
        /* session cleared by apiJson */
      }
    } finally {
      isBulk.current = false;
      setInventoryHydrating(false);
    }
  }, []);

  useEffect(() => {
    if (apiInventoryEnabled()) void refreshFromApi();
    else setInventoryHydrating(false);
  }, [refreshFromApi]);

  const setProducts = useCallback(
    (updater: React.SetStateAction<Product[]>) => {
      setProductsInternal((prev) => {
        const next = typeof updater === 'function' ? (updater as (p: Product[]) => Product[])(prev) : updater;
        if (apiInventoryEnabled() && !isBulk.current) {
          void syncIdList('/api/products', prev, next, sProduct).catch((err) => console.error('Product sync', err));
        }
        return next;
      });
    },
    []
  );

  const setRawMaterials = useCallback((updater: React.SetStateAction<BOMItem[]>) => {
    setRawMaterialsInternal((prev) =>
      typeof updater === 'function' ? (updater as (p: BOMItem[]) => BOMItem[])(prev) : updater
    );
  }, []);

  const setOrders = useCallback((updater: React.SetStateAction<Order[]>) => {
    setOrdersInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Order[]) => Order[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/orders', prev, next, sOrder).catch((err) => console.error('Order sync', err));
      }
      return next;
    });
  }, []);

  const setPurchaseOrders = useCallback((updater: React.SetStateAction<PurchaseOrder[]>) => {
    setPurchaseOrdersInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: PurchaseOrder[]) => PurchaseOrder[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/purchase-orders', prev, next, sPO).catch((err) => console.error('PO sync', err));
      }
      return next;
    });
  }, []);

  const setCustomers = useCallback((updater: React.SetStateAction<Customer[]>) => {
    setCustomersInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Customer[]) => Customer[])(prev) : updater;
      // Do not gate on isBulk: bulk hydrate uses setCustomersInternal directly, never this wrapper
      if (apiInventoryEnabled()) {
        void syncIdList('/api/customers', prev, next, sCustomer).catch((err) => console.error('Customer sync', err));
      }
      return next;
    });
  }, []);

  const createCustomer = useCallback(async (fields: Omit<Customer, 'id'>) => {
    let created!: Customer;
    flushSync(() => {
      setCustomersInternal((prev) => {
        const id = nextPrefixedId('C', prev.map((c) => c.id));
        created = { id, ...fields };
        return [...prev, created];
      });
    });

    if (apiInventoryEnabled()) {
      try {
        await apiJson('POST', '/api/customers', sCustomer(created));
      } catch (e) {
        flushSync(() => {
          setCustomersInternal((prev) => prev.filter((c) => c.id !== created.id));
        });
        const msg = e instanceof ApiError ? e.message : 'Failed to save customer';
        return { ok: false as const, error: msg };
      }
    }

    return { ok: true as const, customer: created };
  }, []);

  const setReturns = useCallback((updater: React.SetStateAction<ReturnRequest[]>) => {
    setReturnsInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: ReturnRequest[]) => ReturnRequest[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/returns', prev, next, sReturn).catch((err) => console.error('Return sync', err));
      }
      return next;
    });
  }, []);

  const setQuotations = useCallback((updater: React.SetStateAction<Quotation[]>) => {
    setQuotationsInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: Quotation[]) => Quotation[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/quotations', prev, next, sQuote).catch((err) => console.error('Quotation sync', err));
      }
      return next;
    });
  }, []);

  const setQCChecklists = useCallback((updater: React.SetStateAction<QCChecklist[]>) => {
    setQCChecklistsInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: QCChecklist[]) => QCChecklist[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncQcChecklists(prev, next).catch((err) => console.error('QC sync', err));
      }
      return next;
    });
  }, []);

  const setScheduledReport = useCallback((updater: React.SetStateAction<ScheduledReport | null>) => {
    setScheduledReportInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: ScheduledReport | null) => ScheduledReport | null)(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void apiJson('PUT', '/api/scheduled-report', next).catch((err) => console.error('Scheduled report sync', err));
      }
      return next;
    });
  }, []);

  const setProductVariants = useCallback((updater: React.SetStateAction<Record<string, ProductVariant[]>>) => {
    setProductVariantsInternal((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: Record<string, ProductVariant[]>) => Record<string, ProductVariant[]>)(prev)
          : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncVariants(prev, next).catch((err) => console.error('Variants sync', err));
      }
      return next;
    });
  }, []);

  const setUsers = useCallback((updater: React.SetStateAction<User[]>) => {
    setUsersInternal((prev) => {
      const next = typeof updater === 'function' ? (updater as (p: User[]) => User[])(prev) : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/users', prev, next, sUser).catch((err) => console.error('User sync', err));
      }
      return next;
    });
  }, []);

  const setProductionOrders = useCallback((updater: React.SetStateAction<ProductionOrder[]>) => {
    setProductionOrdersInternal((prev) => {
      const next =
        typeof updater === 'function'
          ? (updater as (p: ProductionOrder[]) => ProductionOrder[])(prev)
          : updater;
      if (apiInventoryEnabled() && !isBulk.current) {
        void syncIdList('/api/production-orders', prev, next, sProductionOrder).catch((err) =>
          console.error('Production order sync', err)
        );
      }
      return next;
    });
  }, []);

  const addLog = useCallback((userName: string, action: string, details: string) => {
    const log: ActivityLog = {
      id: `A${Date.now()}`,
      userId: '0',
      userName,
      action,
      details,
      timestamp: new Date().toLocaleString('en-IN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setLogs((prev) => [log, ...prev]);
    if (apiInventoryEnabled()) {
      void apiJson('POST', '/api/activity-logs', log).catch((err) => console.error('Activity log sync', err));
    }
  }, []);

  const getReservedStock = useCallback(
    (productId: string) => {
      return orders
        .filter((o) => o.status === 'Placed' || o.status === 'Processing')
        .reduce(
          (sum, o) => sum + o.items.filter((i) => i.productId === productId).reduce((s, i) => s + i.quantity, 0),
          0
        );
    },
    [orders]
  );

  const getAvailableStock = useCallback(
    (productId: string) => {
      const product = products.find((p) => p.id === productId);
      if (!product) return 0;
      return Math.max(0, product.stock - getReservedStock(productId));
    },
    [products, getReservedStock]
  );

  return (
    <InventoryContext.Provider
      value={{
        products,
        setProducts,
        orders,
        setOrders,
        activityLogs: logs,
        addLog,
        purchaseOrders,
        setPurchaseOrders,
        customers,
        setCustomers,
        createCustomer,
        returns,
        setReturns,
        quotations,
        setQuotations,
        qcChecklists,
        setQCChecklists,
        scheduledReport,
        setScheduledReport,
        productVariants,
        setProductVariants,
        users,
        setUsers,
        getReservedStock,
        getAvailableStock,
        inventoryHydrating,
        rawMaterials,
        setRawMaterials,
        billsOfMaterials,
        productionOrders,
        setProductionOrders,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
}

export function useInventory() {
  const ctx = useContext(InventoryContext);
  if (!ctx) throw new Error('useInventory must be used within InventoryProvider');
  return ctx;
}

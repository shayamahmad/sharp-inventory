import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useInventory } from '@/contexts/InventoryContext';
import type { Order, Product } from '@/lib/mockData';
import { formatCurrency } from '@/lib/mockData';
import type { ReturnRequest } from '@/contexts/InventoryContext';
import type { BillOfMaterials, ProductionOrder } from '@/lib/manufacturingData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TooltipProvider } from '@/components/ui/tooltip';
import {
  ArrowDownRight,
  ArrowUpRight,
  BarChart2,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileDown,
  LineChart as LineChartIcon,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  Legend,
  AreaChart,
  Area,
  BarChart,
  Cell,
  LabelList,
} from 'recharts';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import brandMark from '@/assets/inveron-brand.png';

const LS_KEY = 'financials-operating-expenses';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

type ExpenseLine = { id: string; name: string; amount: number; isDefault: boolean };

const DEFAULT_LINES: ExpenseLine[] = [
  { id: 'rent', name: 'Rent and Utilities', amount: 25000, isDefault: true },
  { id: 'salaries', name: 'Staff Salaries', amount: 85000, isDefault: true },
  { id: 'logistics', name: 'Logistics and Shipping', amount: 12000, isDefault: true },
  { id: 'marketing', name: 'Marketing and Advertising', amount: 8000, isDefault: true },
  { id: 'software', name: 'Software and Tools', amount: 3000, isDefault: true },
  { id: 'misc', name: 'Miscellaneous', amount: 5000, isDefault: true },
];

interface PersistShape {
  lines: ExpenseLine[];
  depreciation: number;
  sameExpensesAllMonths: boolean;
  /** yyyy-MM -> partial record of lineId -> amount */
  monthOverrides: Record<string, Partial<Record<string, number>>>;
}

function safeParsePersist(): PersistShape {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) {
      return {
        lines: DEFAULT_LINES.map((l) => ({ ...l })),
        depreciation: 2000,
        sameExpensesAllMonths: true,
        monthOverrides: {},
      };
    }
    const p = JSON.parse(raw) as unknown;
    if (typeof p !== 'object' || p === null) throw new Error('bad');
    const o = p as Record<string, unknown>;
    let lines: ExpenseLine[] = DEFAULT_LINES.map((l) => ({ ...l }));
    if (Array.isArray(o.lines)) {
      const parsed = o.lines.filter(
        (x): x is ExpenseLine =>
          typeof x === 'object' &&
          x !== null &&
          typeof (x as ExpenseLine).id === 'string' &&
          typeof (x as ExpenseLine).name === 'string' &&
          typeof (x as ExpenseLine).amount === 'number'
      );
      if (parsed.length > 0) lines = parsed.map((l) => ({ ...l, isDefault: Boolean(l.isDefault) }));
    }
    const depreciation = typeof o.depreciation === 'number' && Number.isFinite(o.depreciation) ? o.depreciation : 2000;
    const sameExpensesAllMonths = typeof o.sameExpensesAllMonths === 'boolean' ? o.sameExpensesAllMonths : true;
    const monthOverrides =
      typeof o.monthOverrides === 'object' && o.monthOverrides !== null && !Array.isArray(o.monthOverrides)
        ? (o.monthOverrides as Record<string, Partial<Record<string, number>>>)
        : {};
    return { lines, depreciation, sameExpensesAllMonths, monthOverrides };
  } catch {
    return {
      lines: DEFAULT_LINES.map((l) => ({ ...l })),
      depreciation: 2000,
      sameExpensesAllMonths: true,
      monthOverrides: {},
    };
  }
}

function ymKey(y: number, m: number): string {
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}

function parseOrderDate(d: string): Date | null {
  try {
    const [y, mo, da] = d.split('-').map(Number);
    if (!Number.isFinite(y) || !Number.isFinite(mo)) return null;
    return new Date(y, mo - 1, da || 1);
  } catch {
    return null;
  }
}

function inMonth(dt: Date | null, y: number, m: number): boolean {
  if (!dt || !Number.isFinite(dt.getTime())) return false;
  return dt.getFullYear() === y && dt.getMonth() === m;
}

function parseReturnTs(ts: string): Date | null {
  try {
    const part = ts.trim().split(/\s+/)[0];
    return parseOrderDate(part);
  } catch {
    return null;
  }
}

function buildProductMap(products: Product[]): Map<string, Product> {
  const m = new Map<string, Product>();
  try {
    for (const p of products) m.set(p.id, p);
  } catch {
    /* */
  }
  return m;
}

function lineCogsForOrder(o: Order, pmap: Map<string, Product>): number {
  let s = 0;
  try {
    for (const it of o.items) {
      const pr = pmap.get(it.productId);
      const unitCost = pr ? pr.cost : it.price * 0.6;
      s += unitCost * it.quantity;
    }
  } catch {
    return 0;
  }
  return s;
}

function returnsForMonth(
  returns: ReturnRequest[],
  orders: Order[],
  y: number,
  month: number
): number {
  let total = 0;
  try {
    const omap = new Map(orders.map((o) => [o.id, o]));
    for (const r of returns) {
      if (r.status !== 'Approved') continue;
      const rd = parseReturnTs(r.timestamp);
      if (!inMonth(rd, y, month)) continue;
      const ord = omap.get(r.orderId);
      if (!ord) continue;
      for (const ri of r.items) {
        const line = ord.items.find((x) => x.productId === ri.productId);
        const price = line?.price ?? 0;
        total += price * ri.quantity;
      }
    }
  } catch {
    return 0;
  }
  return total;
}

function manufacturingCostForMonth(
  pos: ProductionOrder[],
  boms: BillOfMaterials[],
  y: number,
  month: number
): number {
  let s = 0;
  try {
    const bomMap = new Map(boms.map((b) => [b.productId, b]));
    for (const po of pos) {
      if (po.status !== 'Completed') continue;
      const ed = parseOrderDate(po.endDate);
      if (!inMonth(ed, y, month)) continue;
      const bom = bomMap.get(po.productId);
      const cpu = bom?.totalCostPerUnit ?? 0;
      s += cpu * po.batchSize;
    }
  } catch {
    return 0;
  }
  return s;
}

interface MonthMetrics {
  grossRevenue: number;
  returns: number;
  netRevenue: number;
  cogsDirect: number;
  manufacturingCost: number;
  totalCogs: number;
  grossProfit: number;
  grossMarginPct: number;
}

function computeMonthMetrics(
  orders: Order[],
  products: Product[],
  returns: ReturnRequest[],
  productionOrders: ProductionOrder[],
  boms: BillOfMaterials[],
  y: number,
  month: number
): MonthMetrics {
  const empty: MonthMetrics = {
    grossRevenue: 0,
    returns: 0,
    netRevenue: 0,
    cogsDirect: 0,
    manufacturingCost: 0,
    totalCogs: 0,
    grossProfit: 0,
    grossMarginPct: 0,
  };
  try {
    const pmap = buildProductMap(products);
    let grossRevenue = 0;
    let cogsDirect = 0;
    for (const o of orders) {
      if (o.status !== 'Delivered') continue;
      const od = parseOrderDate(o.date);
      if (!inMonth(od, y, month)) continue;
      grossRevenue += Number.isFinite(o.total) ? o.total : 0;
      cogsDirect += lineCogsForOrder(o, pmap);
    }
    const ret = returnsForMonth(returns, orders, y, month);
    const netRevenue = Math.max(0, grossRevenue - ret);
    const mfg = manufacturingCostForMonth(productionOrders, boms, y, month);
    const totalCogs = cogsDirect + mfg;
    const grossProfit = netRevenue - totalCogs;
    const grossMarginPct = netRevenue > 0 ? (grossProfit / netRevenue) * 100 : 0;
    return {
      grossRevenue,
      returns: ret,
      netRevenue,
      cogsDirect,
      manufacturingCost: mfg,
      totalCogs,
      grossProfit,
      grossMarginPct,
    };
  } catch {
    return empty;
  }
}

function expenseAmountForLine(
  line: ExpenseLine,
  y: number,
  month: number,
  sameAll: boolean,
  overrides: Record<string, Partial<Record<string, number>>>
): number {
  if (sameAll) return Number.isFinite(line.amount) ? line.amount : 0;
  const key = ymKey(y, month);
  const o = overrides[key]?.[line.id];
  if (typeof o === 'number' && Number.isFinite(o)) return o;
  return Number.isFinite(line.amount) ? line.amount : 0;
}

function totalOperatingExpenses(
  lines: ExpenseLine[],
  y: number,
  month: number,
  sameAll: boolean,
  overrides: Record<string, Partial<Record<string, number>>>
): number {
  let s = 0;
  for (const l of lines) s += expenseAmountForLine(l, y, month, sameAll, overrides);
  return s;
}

export default function FinancialsPage() {
  const { orders, products, returns, productionOrders, billsOfMaterials } = useInventory();

  const [viewDate, setViewDate] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [fullYearView, setFullYearView] = useState(false);
  const [persist, setPersist] = useState<PersistShape>(() => safeParsePersist());
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState<ExpenseLine[]>(() => safeParsePersist().lines);
  const [draftDep, setDraftDep] = useState(() => safeParsePersist().depreciation);
  const [overrideCell, setOverrideCell] = useState<{ ym: string; lineId: string } | null>(null);
  const [overrideInput, setOverrideInput] = useState('');

  const y = viewDate.getFullYear();
  const m = viewDate.getMonth();

  useEffect(() => {
    setPersist(safeParsePersist());
  }, []);

  const savePersist = useCallback((next: PersistShape) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      setPersist(next);
    } catch {
      /* */
    }
  }, []);

  const selectedMetrics = useMemo(() => {
    try {
      if (fullYearView) {
        let gr = 0,
          ret = 0,
          nr = 0,
          cd = 0,
          mf = 0,
          tc = 0;
        for (let mo = 0; mo < 12; mo++) {
          const mm = computeMonthMetrics(orders, products, returns, productionOrders, billsOfMaterials, y, mo);
          gr += mm.grossRevenue;
          ret += mm.returns;
          nr += mm.netRevenue;
          cd += mm.cogsDirect;
          mf += mm.manufacturingCost;
          tc += mm.totalCogs;
        }
        const gp = nr - tc;
        const gmp = nr > 0 ? (gp / nr) * 100 : 0;
        return {
          grossRevenue: gr,
          returns: ret,
          netRevenue: nr,
          cogsDirect: cd,
          manufacturingCost: mf,
          totalCogs: tc,
          grossProfit: gp,
          grossMarginPct: gmp,
        } as MonthMetrics;
      }
      return computeMonthMetrics(orders, products, returns, productionOrders, billsOfMaterials, y, m);
    } catch {
      return {
        grossRevenue: 0,
        returns: 0,
        netRevenue: 0,
        cogsDirect: 0,
        manufacturingCost: 0,
        totalCogs: 0,
        grossProfit: 0,
        grossMarginPct: 0,
      };
    }
  }, [orders, products, returns, productionOrders, billsOfMaterials, y, m, fullYearView]);

  const prevMetrics = useMemo(() => {
    try {
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      return computeMonthMetrics(orders, products, returns, productionOrders, billsOfMaterials, py, pm);
    } catch {
      return null;
    }
  }, [orders, products, returns, productionOrders, billsOfMaterials, y, m]);

  const opExSelected = useMemo(() => {
    try {
      if (fullYearView) {
        let s = 0;
        for (let mo = 0; mo < 12; mo++) {
          s += totalOperatingExpenses(persist.lines, y, mo, persist.sameExpensesAllMonths, persist.monthOverrides);
        }
        return s;
      }
      return totalOperatingExpenses(persist.lines, y, m, persist.sameExpensesAllMonths, persist.monthOverrides);
    } catch {
      return 0;
    }
  }, [persist, y, m, fullYearView]);

  const depSelected = useMemo(() => {
    const d = Number.isFinite(persist.depreciation) ? persist.depreciation : 2000;
    return fullYearView ? d * 12 : d;
  }, [persist.depreciation, fullYearView]);

  const ebitda = selectedMetrics.grossProfit - opExSelected;
  const netProfit = ebitda - depSelected;
  const netMarginPct = selectedMetrics.netRevenue > 0 ? (netProfit / selectedMetrics.netRevenue) * 100 : 0;

  const pctDelta = (cur: number, prev: number | undefined): { pct: number; up: boolean } => {
    if (prev === undefined || !Number.isFinite(prev) || prev === 0) return { pct: 0, up: cur >= 0 };
    const pct = ((cur - prev) / Math.abs(prev)) * 100;
    return { pct: Number.isFinite(pct) ? pct : 0, up: cur >= prev };
  };

  const monthTableData = useMemo(() => {
    const rows: {
      month: string;
      monthIndex: number;
      revenue: number;
      cogs: number;
      grossProfit: number;
      grossMargin: number;
      opex: number;
      netProfit: number;
      netMargin: number;
    }[] = [];
    try {
      for (let mo = 0; mo < 12; mo++) {
        const mm = computeMonthMetrics(orders, products, returns, productionOrders, billsOfMaterials, y, mo);
        const ox = totalOperatingExpenses(persist.lines, y, mo, persist.sameExpensesAllMonths, persist.monthOverrides);
        const dep = Number.isFinite(persist.depreciation) ? persist.depreciation : 2000;
        const np = mm.grossProfit - ox - dep;
        rows.push({
          month: MONTH_NAMES[mo],
          monthIndex: mo,
          revenue: mm.grossRevenue,
          cogs: mm.totalCogs,
          grossProfit: mm.grossProfit,
          grossMargin: mm.netRevenue > 0 ? (mm.grossProfit / mm.netRevenue) * 100 : 0,
          opex: ox,
          netProfit: np,
          netMargin: mm.netRevenue > 0 ? (np / mm.netRevenue) * 100 : 0,
        });
      }
    } catch {
      /* */
    }
    return rows;
  }, [orders, products, returns, productionOrders, billsOfMaterials, y, persist]);

  const waterfallData = useMemo(() => {
    try {
      const GR = selectedMetrics.grossRevenue;
      const R = selectedMetrics.returns;
      const NR = selectedMetrics.netRevenue;
      const COGS = selectedMetrics.totalCogs;
      const GP = selectedMetrics.grossProfit;
      const OPEX = opExSelected;
      const EBITDA_VAL = ebitda;
      const DEP = depSelected;
      const NP = netProfit;

      type WRow = {
        name: string;
        bottom: number;
        height: number;
        cumulative: number;
        fill: string;
        labelAmt: number;
        isTotal?: boolean;
      };
      const success = 'hsl(var(--success))';
      const destructive = 'hsl(var(--destructive))';

      const rows: WRow[] = [];
      rows.push({ name: 'Gross Revenue', bottom: 0, height: GR, cumulative: GR, fill: success, labelAmt: GR });
      rows.push({
        name: 'Returns & Refunds',
        bottom: NR,
        height: R,
        cumulative: NR,
        fill: destructive,
        labelAmt: -R,
      });
      rows.push({ name: 'Net Revenue', bottom: 0, height: NR, cumulative: NR, fill: success, labelAmt: NR, isTotal: true });
      rows.push({
        name: 'COGS (incl. mfg.)',
        bottom: GP,
        height: COGS,
        cumulative: GP,
        fill: destructive,
        labelAmt: -COGS,
      });
      rows.push({ name: 'Gross Profit', bottom: 0, height: GP, cumulative: GP, fill: success, labelAmt: GP, isTotal: true });
      rows.push({
        name: 'Operating Expenses',
        bottom: EBITDA_VAL,
        height: OPEX,
        cumulative: EBITDA_VAL,
        fill: destructive,
        labelAmt: -OPEX,
      });
      rows.push({
        name: 'EBITDA',
        bottom: 0,
        height: EBITDA_VAL,
        cumulative: EBITDA_VAL,
        fill: success,
        labelAmt: EBITDA_VAL,
        isTotal: true,
      });
      rows.push({
        name: 'Depreciation',
        bottom: NP,
        height: DEP,
        cumulative: NP,
        fill: destructive,
        labelAmt: -DEP,
      });
      rows.push({
        name: 'Net Profit',
        bottom: 0,
        height: Math.abs(NP),
        cumulative: NP,
        fill: NP >= 0 ? success : destructive,
        labelAmt: NP,
        isTotal: true,
      });

      return rows.map((r) => ({
        ...r,
        invisible: r.bottom,
        visible: r.height,
      }));
    } catch {
      return [];
    }
  }, [selectedMetrics, opExSelected, ebitda, depSelected, netProfit]);

  const chartCompare = useMemo(
    () =>
      monthTableData.map((r) => ({
        name: r.month,
        revenue: r.revenue,
        netProfit: r.netProfit,
        cogs: r.cogs,
        opexStack: r.opex + (Number.isFinite(persist.depreciation) ? persist.depreciation : 2000),
        netProfitArea: r.netProfit,
      })),
    [monthTableData, persist.depreciation]
  );

  const insights = useMemo(() => {
    const list: { text: string; tone: 'positive' | 'warning' | 'critical'; scroll: string }[] = [];
    try {
      const gm = selectedMetrics.grossMarginPct;
      if (gm < 30)
        list.push({
          text: `Gross margin of ${gm.toFixed(1)}% is below the healthy 30% threshold — review product pricing or supplier costs.`,
          tone: 'critical',
          scroll: 'financials-pl',
        });
      if (netMarginPct > 0)
        list.push({
          text: `Net profit margin of ${netMarginPct.toFixed(1)}% — business is profitable ${fullYearView ? 'this period' : 'this month'}.`,
          tone: 'positive',
          scroll: 'financials-summary',
        });
      const retPct = selectedMetrics.grossRevenue > 0 ? (selectedMetrics.returns / selectedMetrics.grossRevenue) * 100 : 0;
      if (retPct > 5)
        list.push({
          text: `Returns are ${retPct.toFixed(1)}% of gross revenue ${fullYearView ? '(YTD)' : 'this month'} — investigate top returned products.`,
          tone: 'warning',
          scroll: 'financials-pl',
        });
      if (prevMetrics && prevMetrics.totalCogs > 0) {
        const cdx = ((selectedMetrics.totalCogs - prevMetrics.totalCogs) / prevMetrics.totalCogs) * 100;
        if (cdx > 10)
          list.push({
            text: `Cost of goods sold increased ${cdx.toFixed(1)}% vs last month — check supplier price changes.`,
            tone: 'warning',
            scroll: 'financials-waterfall',
          });
      }
      if (opExSelected > selectedMetrics.grossProfit)
        list.push({
          text: 'Operating expenses exceed gross profit — business is loss-making at operating level.',
          tone: 'critical',
          scroll: 'financials-opex',
        });
      if (prevMetrics) {
        const pm = m === 0 ? 11 : m - 1;
        const py = m === 0 ? y - 1 : y;
        const prevOp = totalOperatingExpenses(persist.lines, py, pm, persist.sameExpensesAllMonths, persist.monthOverrides);
        const prevDep = Number.isFinite(persist.depreciation) ? persist.depreciation : 2000;
        const prevNp = prevMetrics.grossProfit - prevOp - prevDep;
        const delta = netProfit - prevNp;
        if (delta > 0)
          list.push({
            text: `Net profit improved by ${formatCurrency(delta)} vs last month — positive trend.`,
            tone: 'positive',
            scroll: 'financials-comparison',
          });
      }
    } catch {
      /* */
    }
    return list.slice(0, 6);
  }, [selectedMetrics, netMarginPct, netProfit, prevMetrics, opExSelected, persist, m, y, fullYearView]);

  const scrollToId = (id: string) => {
    try {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch {
      /* */
    }
  };

  const startEdit = () => {
    setDraft(persist.lines.map((l) => ({ ...l })));
    setDraftDep(persist.depreciation);
    setEditMode(true);
  };

  const saveEdit = () => {
    savePersist({ ...persist, lines: draft.map((l) => ({ ...l })), depreciation: draftDep });
    setEditMode(false);
  };

  const cancelEdit = () => {
    setDraft(persist.lines.map((l) => ({ ...l })));
    setDraftDep(persist.depreciation);
    setEditMode(false);
  };

  const addExpense = () => {
    setDraft((d) => [...d, { id: `custom-${Date.now()}`, name: 'New expense', amount: 0, isDefault: false }]);
  };

  const removeExpense = (id: string) => {
    setDraft((d) => d.filter((x) => x.id !== id));
  };

  const exportCsv = () => {
    try {
      const headers = [
        'Month',
        'Revenue',
        'COGS',
        'Gross Profit',
        'Gross Margin %',
        'Operating Expenses',
        'Net Profit',
        'Net Margin %',
      ];
      const lines = [headers.join(',')];
      for (const r of monthTableData) {
        lines.push(
          [
            r.month,
            r.revenue.toFixed(2),
            r.cogs.toFixed(2),
            r.grossProfit.toFixed(2),
            r.grossMargin.toFixed(2),
            r.opex.toFixed(2),
            r.netProfit.toFixed(2),
            r.netMargin.toFixed(2),
          ].join(',')
        );
      }
      const totals = monthTableData.reduce(
        (a, r) => ({
          revenue: a.revenue + r.revenue,
          cogs: a.cogs + r.cogs,
          gp: a.gp + r.grossProfit,
          opex: a.opex + r.opex,
          np: a.np + r.netProfit,
        }),
        { revenue: 0, cogs: 0, gp: 0, opex: 0, np: 0 }
      );
      lines.push(
        [
          'Totals',
          totals.revenue.toFixed(2),
          totals.cogs.toFixed(2),
          totals.gp.toFixed(2),
          totals.revenue > 0 ? ((totals.gp / totals.revenue) * 100).toFixed(2) : '0',
          totals.opex.toFixed(2),
          totals.np.toFixed(2),
          totals.revenue > 0 ? ((totals.np / totals.revenue) * 100).toFixed(2) : '0',
        ].join(',')
      );
      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `financials-${y}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      /* */
    }
  };

  const exportPdf = async () => {
    try {
      const doc = new jsPDF();
      const img = new Image();
      img.src = brandMark;
      await new Promise<void>((res, rej) => {
        img.onload = () => res();
        img.onerror = () => rej();
      }).catch(() => undefined);
      try {
        doc.addImage(img, 'PNG', 14, 10, 14, 14);
      } catch {
        /* */
      }
      doc.setFontSize(16);
      doc.text('Sharp Inventory — Profit & Loss Statement', 32, 18);
      doc.setFontSize(10);
      doc.text(`Period: ${fullYearView ? `FY ${y}` : `${MONTH_NAMES[m]} ${y}`}`, 14, 28);
      doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 14, 34);

      const rows: (string | number)[][] = [
        ['Gross Revenue', selectedMetrics.grossRevenue],
        ['Returns and Refunds', -selectedMetrics.returns],
        ['Net Revenue', selectedMetrics.netRevenue],
        ['Direct Material Cost (COGS)', -selectedMetrics.cogsDirect],
        ['Manufacturing Cost', -selectedMetrics.manufacturingCost],
        ['Total COGS', -selectedMetrics.totalCogs],
        ['Gross Profit', selectedMetrics.grossProfit],
        ['Gross Margin %', `${selectedMetrics.grossMarginPct.toFixed(2)}%`],
      ];
      for (const l of persist.lines) {
        const amt = fullYearView
          ? Array.from({ length: 12 }).reduce((s, _, mo) => s + expenseAmountForLine(l, y, mo, persist.sameExpensesAllMonths, persist.monthOverrides), 0)
          : expenseAmountForLine(l, y, m, persist.sameExpensesAllMonths, persist.monthOverrides);
        rows.push([l.name, -amt]);
      }
      rows.push(['Total Operating Expenses', -opExSelected]);
      rows.push(['EBITDA', ebitda]);
      rows.push(['Depreciation', -depSelected]);
      rows.push(['Net Profit', netProfit]);
      rows.push(['Net Profit Margin %', `${netMarginPct.toFixed(2)}%`]);

      autoTable(doc, {
        startY: 40,
        head: [['Item', 'Amount (INR)']],
        body: rows.map((r) => [String(r[0]), typeof r[1] === 'number' ? r[1].toFixed(2) : r[1]]),
        styles: { fontSize: 9 },
        headStyles: { fillColor: [66, 66, 66] },
      });
      doc.save(`pl-statement-${fullYearView ? y : ymKey(y, m)}.pdf`);
    } catch {
      /* */
    }
  };

  const displayLines = editMode ? draft : persist.lines;
  const displayDep = editMode ? draftDep : persist.depreciation;
  const totalDraftOrPersist = displayLines.reduce((s, l) => s + (Number.isFinite(l.amount) ? l.amount : 0), 0);

  const prevMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setViewDate((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));

  const wfTooltip = ({
    active,
    payload,
  }: {
    active?: boolean;
    payload?: { payload: { name: string; cumulative: number; labelAmt: number } }[];
  }) => {
    if (!active || !payload?.length) return null;
    const p = payload[0].payload;
    return (
      <div className="rounded-md border border-border bg-card px-3 py-2 text-xs shadow-md">
        <p className="font-semibold text-foreground">{p.name}</p>
        <p className="text-muted-foreground">Step: {formatCurrency(p.labelAmt)}</p>
        <p className="text-muted-foreground">Cumulative: {formatCurrency(p.cumulative)}</p>
      </div>
    );
  };

  /** Recalculate summary card 4 with correct prev net profit */
  const prevPeriodForCards = useMemo(() => {
    try {
      if (fullYearView) {
        const py = y - 1;
        let rev = 0,
          cogs = 0,
          gp = 0,
          np = 0;
        for (let mo = 0; mo < 12; mo++) {
          const mm = computeMonthMetrics(orders, products, returns, productionOrders, billsOfMaterials, py, mo);
          const ox = totalOperatingExpenses(persist.lines, py, mo, persist.sameExpensesAllMonths, persist.monthOverrides);
          const dep = Number.isFinite(persist.depreciation) ? persist.depreciation : 2000;
          rev += mm.grossRevenue;
          cogs += mm.totalCogs;
          gp += mm.grossProfit;
          np += mm.grossProfit - ox - dep;
        }
        return { rev, cogs, gp, np };
      }
      if (!prevMetrics) return null;
      const pm = m === 0 ? 11 : m - 1;
      const py = m === 0 ? y - 1 : y;
      const prevOp = totalOperatingExpenses(persist.lines, py, pm, persist.sameExpensesAllMonths, persist.monthOverrides);
      const prevDep = Number.isFinite(persist.depreciation) ? persist.depreciation : 2000;
      const prevNp = prevMetrics.grossProfit - prevOp - prevDep;
      return {
        rev: prevMetrics.grossRevenue,
        cogs: prevMetrics.totalCogs,
        gp: prevMetrics.grossProfit,
        np: prevNp,
      };
    } catch {
      return null;
    }
  }, [fullYearView, y, m, prevMetrics, orders, products, returns, productionOrders, billsOfMaterials, persist]);

  const cards = useMemo(() => {
    const p = prevPeriodForCards;
    const rev = selectedMetrics.grossRevenue;
    const cogs = selectedMetrics.totalCogs;
    const gp = selectedMetrics.grossProfit;
    const np = netProfit;
    const d1 = pctDelta(rev, p?.rev);
    const d2 = pctDelta(cogs, p?.cogs);
    const d3 = pctDelta(gp, p?.gp);
    const d4 = pctDelta(np, p?.np);
    return [
      { label: 'Total Revenue', value: rev, ...d1 },
      { label: 'Cost of Goods Sold', value: cogs, ...d2 },
      { label: 'Gross Profit', value: gp, ...d3 },
      { label: 'Net Profit', value: np, ...d4 },
    ];
  }, [selectedMetrics, prevPeriodForCards, netProfit]);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="mx-auto max-w-7xl space-y-8 animate-fade-in pb-10">
        <div className="gradient-primary flex flex-col gap-4 rounded-xl p-4 sm:flex-row sm:items-start sm:justify-between sm:p-6">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/15 text-primary-foreground">
              <BarChart2 className="h-7 w-7" aria-hidden />
            </div>
            <div className="min-w-0">
              <h1 className="font-display text-xl font-bold text-primary-foreground sm:text-2xl">Financial Dashboard</h1>
              <p className="mt-1 text-sm text-primary-foreground/85">
                Profit and Loss Statement — built from your real inventory data.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 sm:justify-end">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
              onClick={() => void exportPdf()}
            >
              <FileDown className="h-4 w-4" />
              Export PDF
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="bg-primary-foreground/15 text-primary-foreground hover:bg-primary-foreground/25"
              onClick={exportCsv}
            >
              <FileDown className="h-4 w-4" />
              Export CSV
            </Button>
          </div>
        </div>

        <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium text-muted-foreground">Period</span>
            <div className="flex items-center gap-1 rounded-lg border border-border bg-background px-1">
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={prevMonth} aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="min-w-[10rem] text-center text-sm font-semibold text-foreground">
                {MONTH_NAMES[m]} {y}
              </span>
              <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={nextMonth} aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-input"
              checked={fullYearView}
              onChange={(e) => setFullYearView(e.target.checked)}
            />
            Full Year View
          </label>
        </div>

        <div id="financials-summary" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => {
            const pctStr = `${c.pct >= 0 ? '+' : ''}${c.pct.toFixed(1)}% vs prev`;
            return (
              <div key={c.label} className="stat-card">
                <p className="mb-2 text-sm font-medium text-muted-foreground">{c.label}</p>
                <p className="font-display text-2xl font-bold text-foreground">{formatCurrency(c.value)}</p>
                <div className="mt-2 flex items-center gap-1">
                  {c.up ? (
                    <ArrowUpRight className="h-3.5 w-3.5 text-success" aria-hidden />
                  ) : (
                    <ArrowDownRight className="h-3.5 w-3.5 text-destructive" aria-hidden />
                  )}
                  <span className={`text-xs font-medium ${c.up ? 'text-success' : 'text-destructive'}`}>{pctStr}</span>
                </div>
              </div>
            );
          })}
        </div>

        <div id="financials-opex" className="rounded-xl border border-border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b border-border px-4 py-3 sm:px-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Operating Expenses</h2>
            {!editMode ? (
              <Button type="button" variant="outline" size="sm" onClick={startEdit} className="gap-1">
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" className="gap-1" onClick={saveEdit}>
                  <Save className="h-4 w-4" />
                  Save
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={cancelEdit} className="gap-1">
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          <div className="overflow-x-auto px-4 py-4 sm:px-6">
            <label className="mb-4 flex cursor-pointer items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input"
                checked={persist.sameExpensesAllMonths}
                disabled={editMode}
                onChange={(e) => savePersist({ ...persist, sameExpensesAllMonths: e.target.checked })}
              />
              Use same expenses for all months
            </label>
            <table className="w-full min-w-[320px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="py-2 pr-4 font-medium">Category</th>
                  <th className="py-2 text-right font-medium">Amount (₹)</th>
                  {editMode && <th className="w-10 py-2" />}
                </tr>
              </thead>
              <tbody>
                {displayLines.map((line) => (
                  <tr key={line.id} className="border-b border-border/60">
                    <td className="py-2 pr-4 text-foreground">
                      {editMode ? (
                        <Input
                          value={line.name}
                          onChange={(e) =>
                            setDraft((d) => d.map((x) => (x.id === line.id ? { ...x, name: e.target.value } : x)))
                          }
                          className="h-8"
                        />
                      ) : (
                        line.name
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums">
                      {editMode ? (
                        <Input
                          type="number"
                          className="ml-auto h-8 w-32 text-right"
                          value={line.amount}
                          onChange={(e) =>
                            setDraft((d) =>
                              d.map((x) =>
                                x.id === line.id ? { ...x, amount: Number(e.target.value) || 0 } : x
                              )
                            )
                          }
                        />
                      ) : (
                        formatCurrency(line.amount)
                      )}
                    </td>
                    {editMode && (
                      <td className="py-2 text-right">
                        {!line.isDefault && (
                          <button
                            type="button"
                            className="rounded p-1 text-destructive hover:bg-destructive/10"
                            aria-label="Remove"
                            onClick={() => removeExpense(line.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                <tr className="font-bold text-foreground">
                  <td className="py-3">Total operating expenses</td>
                  <td className="py-3 text-right tabular-nums">{formatCurrency(editMode ? totalDraftOrPersist : opExSelected)}</td>
                  {editMode && <td />}
                </tr>
              </tbody>
            </table>
            {editMode && (
              <Button type="button" variant="secondary" size="sm" className="mt-4 gap-1" onClick={addExpense}>
                <Plus className="h-4 w-4" />
                Add Expense
              </Button>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Depreciation (P&amp;L)</span>
              {editMode ? (
                <Input
                  type="number"
                  className="h-8 w-32"
                  value={displayDep}
                  onChange={(e) => setDraftDep(Number(e.target.value) || 0)}
                />
              ) : (
                <span className="font-medium text-foreground">{formatCurrency(persist.depreciation)}</span>
              )}
            </div>
          </div>
        </div>

        <div id="financials-pl" className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <div className="border-b border-border px-4 py-3 sm:px-6">
            <h2 className="font-display text-lg font-semibold text-foreground">Profit &amp; Loss Statement</h2>
            <p className="text-xs text-muted-foreground">{fullYearView ? `Year ${y}` : `${MONTH_NAMES[m]} ${y}`}</p>
          </div>
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <tbody>
              <tr className="bg-primary text-primary-foreground">
                <td colSpan={2} className="px-4 py-2 font-bold">
                  Revenue
                </td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-4 py-2">Gross Revenue</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium">{formatCurrency(selectedMetrics.grossRevenue)}</td>
              </tr>
              <tr className="bg-background">
                <td className="px-4 py-2">Returns and Refunds</td>
                <td className="px-4 py-2 text-right tabular-nums font-medium text-destructive">
                  −{formatCurrency(selectedMetrics.returns)}
                </td>
              </tr>
              <tr className="bg-muted/20">
                <td className="px-4 py-2 font-bold text-foreground">Net Revenue</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">{formatCurrency(selectedMetrics.netRevenue)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="h-2 bg-border/40" />
              </tr>
              <tr className="bg-muted text-foreground">
                <td colSpan={2} className="px-4 py-2 font-bold">
                  Cost of Goods Sold
                </td>
              </tr>
              <tr className="bg-muted/30">
                <td className="px-4 py-2">Direct Material Cost</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(selectedMetrics.cogsDirect)}</td>
              </tr>
              <tr className="bg-background">
                <td className="px-4 py-2">Manufacturing Cost</td>
                <td className="px-4 py-2 text-right tabular-nums">{formatCurrency(selectedMetrics.manufacturingCost)}</td>
              </tr>
              <tr className="bg-muted/20">
                <td className="px-4 py-2 font-bold">Total COGS</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold text-destructive">
                  −{formatCurrency(selectedMetrics.totalCogs)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="h-2 bg-border/40" />
              </tr>
              <tr className="bg-muted/30">
                <td className="px-4 py-2 font-bold text-foreground">
                  Gross Profit{' '}
                  <span className="font-normal text-muted-foreground">({selectedMetrics.grossMarginPct.toFixed(2)}% margin)</span>
                </td>
                <td
                  className={`px-4 py-2 text-right tabular-nums font-bold ${selectedMetrics.grossProfit >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  {formatCurrency(selectedMetrics.grossProfit)}
                </td>
              </tr>
              <tr>
                <td colSpan={2} className="h-2 bg-border/40" />
              </tr>
              <tr className="bg-muted text-foreground">
                <td colSpan={2} className="px-4 py-2 font-bold">
                  Operating Expenses
                </td>
              </tr>
              {persist.lines.map((line, idx) => {
                const amt = fullYearView
                  ? Array.from({ length: 12 }).reduce(
                      (s, _, mo) => s + expenseAmountForLine(line, y, mo, persist.sameExpensesAllMonths, persist.monthOverrides),
                      0
                    )
                  : expenseAmountForLine(line, y, m, persist.sameExpensesAllMonths, persist.monthOverrides);
                return (
                  <tr key={line.id} className={idx % 2 === 0 ? 'bg-background' : 'bg-muted/20'}>
                    <td className="px-4 py-2">{line.name}</td>
                    <td className="px-4 py-2 text-right tabular-nums text-destructive">−{formatCurrency(amt)}</td>
                  </tr>
                );
              })}
              <tr className="bg-muted/40">
                <td className="px-4 py-2 font-bold">Total Operating Expenses</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold text-destructive">−{formatCurrency(opExSelected)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="h-2 bg-border/40" />
              </tr>
              <tr className="bg-muted/30">
                <td className="px-4 py-2 font-bold">EBITDA</td>
                <td className="px-4 py-2 text-right tabular-nums font-bold">{formatCurrency(ebitda)}</td>
              </tr>
              <tr className="bg-background">
                <td className="px-4 py-2">Depreciation</td>
                <td className="px-4 py-2 text-right tabular-nums text-destructive">−{formatCurrency(depSelected)}</td>
              </tr>
              <tr>
                <td colSpan={2} className="h-2 bg-border/40" />
              </tr>
              <tr className="bg-muted/30">
                <td className="px-4 py-3 text-lg font-bold text-foreground">Net Profit</td>
                <td
                  className={`px-4 py-3 text-right font-display text-2xl font-bold tabular-nums ${netProfit >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  {formatCurrency(netProfit)}
                </td>
              </tr>
              <tr className="bg-background">
                <td colSpan={2} className="px-4 pb-4 text-sm text-muted-foreground">
                  Net profit margin: {netMarginPct.toFixed(2)}%
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div id="financials-waterfall">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">P&amp;L Waterfall</h2>
          <div className="h-[380px] w-full rounded-xl border border-border bg-card p-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={waterfallData} margin={{ top: 24, right: 16, left: 8, bottom: 8 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                <RTooltip content={wfTooltip} />
                <Bar dataKey="invisible" stackId="w" fill="transparent" isAnimationActive={false} />
                <Bar dataKey="visible" stackId="w" isAnimationActive={false}>
                  {waterfallData.map((entry, index) => (
                    <Cell key={`c-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="labelAmt"
                    position="top"
                    formatter={(v: number) => formatCurrency(v)}
                    className="fill-foreground text-[9px]"
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div id="financials-comparison">
          <h2 className="mb-3 font-display text-lg font-semibold text-foreground">Month-by-month comparison ({y})</h2>
          <div className="overflow-x-auto rounded-xl border border-border bg-card">
            <table className="w-full min-w-[800px] text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-left text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Month</th>
                  <th className="px-3 py-2 text-right font-medium">Revenue</th>
                  <th className="px-3 py-2 text-right font-medium">COGS</th>
                  <th className="px-3 py-2 text-right font-medium">Gross Profit</th>
                  <th className="px-3 py-2 text-right font-medium">GM %</th>
                  <th className="px-3 py-2 text-right font-medium">OpEx</th>
                  <th className="px-3 py-2 text-right font-medium">Net Profit</th>
                  <th className="px-3 py-2 text-right font-medium">NM %</th>
                </tr>
              </thead>
              <tbody>
                {monthTableData.map((row, i) => {
                  const prevNp = i > 0 ? monthTableData[i - 1].netProfit : row.netProfit;
                  const npDelta = prevNp !== 0 ? ((row.netProfit - prevNp) / Math.abs(prevNp)) * 100 : 0;
                  const selectedRow = row.monthIndex === m && !fullYearView;
                  return (
                    <tr
                      key={row.month}
                      className={`border-b border-border/60 ${selectedRow ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                    >
                      <td className="px-3 py-2 font-medium text-foreground">{row.month}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.revenue)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.cogs)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(row.grossProfit)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.grossMargin.toFixed(1)}%</td>
                      <td
                        className={`px-3 py-2 text-right tabular-nums ${!persist.sameExpensesAllMonths ? 'cursor-pointer underline decoration-dotted' : ''}`}
                        onClick={() => {
                          if (!persist.sameExpensesAllMonths) {
                            const k = ymKey(y, row.monthIndex);
                            const lid = persist.lines[0]?.id ?? '';
                            setOverrideCell({ ym: k, lineId: lid });
                            setOverrideInput(
                              String(persist.monthOverrides[k]?.[lid] ?? persist.lines.find((l) => l.id === lid)?.amount ?? 0)
                            );
                          }
                        }}
                      >
                        {formatCurrency(row.opex)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        <span className="inline-flex items-center justify-end gap-1">
                          {formatCurrency(row.netProfit)}
                          {i > 0 && (
                            <span className={row.netProfit >= prevNp ? 'text-success' : 'text-destructive'}>
                              {row.netProfit >= prevNp ? '▲' : '▼'}
                              {Math.abs(npDelta).toFixed(0)}%
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{row.netMargin.toFixed(1)}%</td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-border font-bold text-foreground">
                  <td className="px-3 py-3">Totals</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(monthTableData.reduce((s, r) => s + r.revenue, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(monthTableData.reduce((s, r) => s + r.cogs, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(monthTableData.reduce((s, r) => s + r.grossProfit, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">—</td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(monthTableData.reduce((s, r) => s + r.opex, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">
                    {formatCurrency(monthTableData.reduce((s, r) => s + r.netProfit, 0))}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums">—</td>
                </tr>
              </tbody>
            </table>
          </div>
          {overrideCell && (
            <div className="mt-3 flex flex-wrap items-end gap-2 rounded-lg border border-border bg-muted/30 p-3 text-sm">
              <span className="text-muted-foreground">Override OpEx for {overrideCell.ym} — category:</span>
              <select
                className="rounded-md border border-input bg-background px-2 py-1"
                value={overrideCell.lineId}
                onChange={(e) => setOverrideCell({ ...overrideCell, lineId: e.target.value })}
              >
                {persist.lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <Input
                type="number"
                className="h-8 w-28"
                value={overrideInput}
                onChange={(e) => setOverrideInput(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  const v = Number(overrideInput) || 0;
                  const next = {
                    ...persist.monthOverrides,
                    [overrideCell.ym]: {
                      ...(persist.monthOverrides[overrideCell.ym] ?? {}),
                      [overrideCell.lineId]: v,
                    },
                  };
                  savePersist({ ...persist, monthOverrides: next });
                  setOverrideCell(null);
                }}
              >
                Save override
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={() => setOverrideCell(null)}>
                Close
              </Button>
            </div>
          )}
        </div>

        <div id="financials-trends" className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-display font-semibold text-foreground">Revenue vs Net Profit</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartCompare} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  <Line type="monotone" dataKey="netProfit" name="Net Profit" stroke="hsl(var(--success))" strokeWidth={2} dot />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 font-display font-semibold text-foreground">Cost composition vs revenue</h3>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartCompare} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                  <RTooltip formatter={(v: number) => formatCurrency(v)} />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="cogs"
                    name="COGS"
                    stackId="1"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.85}
                  />
                  <Area
                    type="monotone"
                    dataKey="opexStack"
                    name="OpEx + Depreciation"
                    stackId="1"
                    stroke="hsl(var(--chart-3))"
                    fill="hsl(var(--chart-3))"
                    fillOpacity={0.85}
                  />
                  <Area
                    type="monotone"
                    dataKey="netProfitArea"
                    name="Net Profit"
                    stackId="1"
                    stroke="hsl(var(--success))"
                    fill="hsl(var(--success))"
                    fillOpacity={0.85}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        <div id="financials-insights" className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-foreground">
            <Brain className="h-5 w-5 text-primary" aria-hidden />
            Financial Insights
          </h2>
          <ul className="space-y-3">
            {insights.length === 0 ? (
              <li className="text-sm text-muted-foreground">No automated insights for this period.</li>
            ) : (
              insights.map((ins, i) => (
                <li
                  key={i}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2.5"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${
                      ins.tone === 'positive'
                        ? 'bg-success/15 text-success'
                        : ins.tone === 'warning'
                          ? 'bg-warning/15 text-warning'
                          : 'bg-destructive/15 text-destructive'
                    }`}
                  >
                    {ins.tone === 'positive' ? 'OK' : ins.tone === 'warning' ? 'Watch' : 'Risk'}
                  </span>
                  <p className="min-w-0 flex-1 text-sm text-foreground">{ins.text}</p>
                  <button
                    type="button"
                    className="shrink-0 rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                    aria-label="Go to chart"
                    onClick={() => scrollToId(ins.scroll)}
                  >
                    <LineChartIcon className="h-4 w-4" />
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
    </TooltipProvider>
  );
}

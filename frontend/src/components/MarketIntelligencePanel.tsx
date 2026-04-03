import React, { useMemo, useState } from 'react';
import type { Product } from '@/lib/mockData';
import { formatCurrency } from '@/lib/mockData';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Download } from 'lucide-react';

function marginPct(price: number, cost: number): number {
  if (price <= 0) return 0;
  return ((price - cost) / price) * 100;
}

function volumeIncreasePct(price: number, cost: number, compPrice: number): number | null {
  const curM = price - cost;
  const newM = compPrice - cost;
  if (newM <= 0) return null;
  return (curM / newM - 1) * 100;
}

function recommend(price: number, cost: number, comp: number): 'Hold' | 'Match' | 'Undercut' {
  const mY = marginPct(price, cost);
  const mC = marginPct(comp, cost);
  const pctDiff = Math.abs(price - comp) / Math.max(price, 1);
  if (pctDiff < 0.04) return 'Match';
  if (price > comp && mC >= 22) return 'Undercut';
  if (mY > mC + 10) return 'Hold';
  if (comp < price * 0.92 && mC > 15) return 'Undercut';
  return 'Match';
}

const recClass: Record<string, string> = {
  Hold: 'bg-success/15 text-success border-success/30',
  Match: 'bg-warning/15 text-warning border-warning/30',
  Undercut: 'bg-info/15 text-info border-info/30',
};

export default function MarketIntelligencePanel({ products }: { products: Product[] }) {
  const [competitor, setCompetitor] = useState<Record<string, string>>({});

  const rows = useMemo(() => {
    return products.map((p) => {
      const raw = competitor[p.id]?.trim() ?? '';
      const comp = raw === '' ? NaN : Number(raw);
      const hasComp = Number.isFinite(comp) && comp > 0;
      const yourM = marginPct(p.price, p.cost);
      const matchM = hasComp ? marginPct(comp, p.cost) : NaN;
      const vol = hasComp ? volumeIncreasePct(p.price, p.cost, comp) : null;
      const rec = hasComp ? recommend(p.price, p.cost, comp) : null;
      return {
        id: p.id,
        name: p.name,
        yourPrice: p.price,
        cost: p.cost,
        comp: hasComp ? comp : null,
        yourM,
        matchM,
        vol,
        rec,
      };
    });
  }, [products, competitor]);

  const chartData = useMemo(() => {
    const rev = (id: string, price: number) => price * (products.find((p) => p.id === id)?.salesLast30 ?? 0);
    return [...rows]
      .filter((r) => r.comp != null)
      .sort((a, b) => rev(b.id, b.yourPrice) - rev(a.id, a.yourPrice))
      .slice(0, 10)
      .map((r) => ({
        name: r.name.length > 14 ? r.name.slice(0, 14) + '…' : r.name,
        yourMargin: Math.round(r.yourM * 10) / 10,
        matchMargin: Math.round((r.matchM ?? 0) * 10) / 10,
      }));
  }, [rows, products]);

  const exportCsv = () => {
    const headers = [
      'Product ID',
      'Product',
      'Your Price',
      'Competitor Price',
      'Your Margin %',
      'Margin If Match %',
      'Volume Increase %',
      'Recommendation',
    ];
    const lines = rows.map((r) =>
      [
        r.id,
        `"${r.name.replace(/"/g, '""')}"`,
        r.yourPrice,
        r.comp ?? '',
        r.yourM.toFixed(2),
        r.comp != null ? r.matchM.toFixed(2) : '',
        r.vol != null ? r.vol.toFixed(2) : '',
        r.rec ?? '',
      ].join(',')
    );
    const blob = new Blob([[headers.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `market-intelligence-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Enter a competitor price per SKU to compare margins and rough volume lift needed to hold profit if you match.
          Recommendations are heuristic (not financial advice).
        </p>
        <Button type="button" variant="outline" className="gap-2" onClick={exportCsv}>
          <Download className="h-4 w-4" /> Export analysis
        </Button>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-x-auto">
        <table className="w-full min-w-[960px]">
          <thead>
            <tr className="border-b border-border bg-secondary/50 text-left text-xs font-semibold text-muted-foreground uppercase">
              <th className="px-3 py-3">Product</th>
              <th className="px-3 py-3 text-right">Your price</th>
              <th className="px-3 py-3">Competitor price</th>
              <th className="px-3 py-3 text-right">Your margin %</th>
              <th className="px-3 py-3 text-right">Margin @ match %</th>
              <th className="px-3 py-3 text-right">Volume +% for same profit</th>
              <th className="px-3 py-3">Recommendation</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-border/50 hover:bg-secondary/20">
                <td className="px-3 py-2.5 text-sm">
                  <span className="font-medium text-foreground">{r.name}</span>
                  <span className="block text-xs text-muted-foreground font-mono">{r.id}</span>
                </td>
                <td className="px-3 py-2.5 text-sm text-right tabular-nums">{formatCurrency(r.yourPrice)}</td>
                <td className="px-3 py-2.5">
                  <Input
                    className="h-8 w-28 text-sm tabular-nums"
                    type="number"
                    min={0}
                    step={1}
                    placeholder="—"
                    value={competitor[r.id] ?? ''}
                    onChange={(e) => setCompetitor((prev) => ({ ...prev, [r.id]: e.target.value }))}
                  />
                </td>
                <td className="px-3 py-2.5 text-sm text-right tabular-nums">{r.yourM.toFixed(1)}%</td>
                <td className="px-3 py-2.5 text-sm text-right tabular-nums">{r.comp != null ? `${r.matchM.toFixed(1)}%` : '—'}</td>
                <td className="px-3 py-2.5 text-sm text-right tabular-nums">
                  {r.vol != null ? `${r.vol >= 0 ? '+' : ''}${r.vol.toFixed(1)}%` : '—'}
                </td>
                <td className="px-3 py-2.5">
                  {r.rec ? (
                    <span className={`text-xs px-2 py-1 rounded-full font-semibold border ${recClass[r.rec]}`}>{r.rec}</span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {chartData.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="font-display font-semibold text-foreground mb-4">Your margin vs competitor-matched margin (top 10 by revenue proxy)</h3>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} interval={0} angle={-25} textAnchor="end" height={70} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickFormatter={(v) => `${v}%`} />
              <Tooltip
                formatter={(v: number) => `${v}%`}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px' }}
              />
              <Legend />
              <Bar dataKey="yourMargin" name="Your margin %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="matchMargin" name="Margin if match %" fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} opacity={0.85} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

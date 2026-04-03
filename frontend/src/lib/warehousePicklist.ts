import type { Order, Product } from '@/lib/mockData';
import { binLocationForProduct } from '@/lib/mockData';

const BUSINESS_NAME = 'Sharp Inventory';

export function openWarehousePicklistPrint(order: Order, products: Product[]): void {
  const rows: { idx: number; name: string; sku: string; bin: string; qty: number }[] = [];
  order.items.forEach((item, i) => {
    const p = products.find((x) => x.id === item.productId);
    rows.push({
      idx: i + 1,
      name: item.productName,
      sku: item.productId,
      bin: p ? binLocationForProduct(p) : '—',
      qty: item.quantity,
    });
  });

  const totalItems = rows.reduce((s, r) => s + r.qty, 0);
  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const tableRows = rows
    .map(
      (r) =>
        `<tr>
          <td>${r.idx}</td>
          <td>${esc(r.name)}</td>
          <td class="mono">${esc(r.sku)}</td>
          <td class="mono">${esc(r.bin)}</td>
          <td class="right">${r.qty}</td>
          <td class="boxcell">☐</td>
        </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <title>Picklist ${esc(order.id)}</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, Segoe UI, sans-serif; margin: 0; padding: 16mm; color: #111; font-size: 11pt; }
    h1 { font-size: 18pt; margin: 0 0 4px; }
    .brand { font-size: 14pt; font-weight: 700; color: #c2410c; }
    .sub { font-size: 9pt; color: #444; margin-bottom: 16px; }
    .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; margin-bottom: 16px; font-size: 10pt; }
    .label { color: #666; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.04em; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; }
    th, td { border: 1px solid #ccc; padding: 8px 6px; text-align: left; }
    th { background: #f3f4f6; font-size: 9pt; text-transform: uppercase; }
    .mono { font-family: ui-monospace, monospace; }
    .right { text-align: right; }
    .boxcell { text-align: center; font-size: 14pt; }
    .line { border-bottom: 1px solid #111; min-height: 22px; margin-top: 4px; }
    .notes { min-height: 64px; border: 1px dashed #999; margin-top: 8px; padding: 8px; }
    @media print {
      .noprint { display: none !important; }
      body { padding: 12mm; }
    }
  </style>
</head>
<body>
  <div class="brand">${BUSINESS_NAME}</div>
  <h1>Warehouse picklist</h1>
  <p class="sub">Print this sheet to pick and pack the order. Check each line as you go.</p>

  <div class="grid2">
    <div><span class="label">Order ID</span><div><strong>${esc(order.id)}</strong></div></div>
    <div><span class="label">Created</span><div>${esc(order.date)}</div></div>
    <div><span class="label">Customer</span><div>${esc(order.customerName)}</div></div>
    <div><span class="label">Picker name</span><div class="line"></div></div>
    <div><span class="label">Pick date</span><div class="line"></div></div>
  </div>

  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Product name</th>
        <th>SKU</th>
        <th>Bin location</th>
        <th class="right">Qty to pick</th>
        <th>Picked</th>
      </tr>
    </thead>
    <tbody>${tableRows}</tbody>
  </table>

  <p><strong>Total line items (sum of qty):</strong> ${totalItems}</p>

  <p class="label" style="margin-top:20px">Signature</p>
  <div class="line" style="max-width:320px"></div>

  <p class="label" style="margin-top:16px">Notes</p>
  <div class="notes"></div>

  <p class="noprint" style="margin-top:24px;font-size:10pt;color:#666">Use your browser Print dialog (Ctrl+P). This view is print-only friendly.</p>
  <script>window.onload=function(){window.print();};</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'noopener,noreferrer');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

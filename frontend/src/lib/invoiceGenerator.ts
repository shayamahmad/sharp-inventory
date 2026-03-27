import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency, Order, Product } from '@/lib/mockData';

export function generateInvoicePDF(order: Order, products: Product[], options: { igst: boolean } = { igst: false }) {
  const doc = new jsPDF();

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVETO', 14, 22);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Smart Inventory & Order Management', 14, 28);
  doc.text('GST: 29ABCDE1234F1Z5', 14, 33);

  // Invoice details
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('TAX INVOICE', 140, 22);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`Invoice #: ${order.id}`, 140, 30);
  doc.text(`Date: ${order.date}`, 140, 36);
  doc.text(`Status: ${order.status}`, 140, 42);

  // Separator
  doc.setDrawColor(230, 126, 34);
  doc.setLineWidth(1);
  doc.line(14, 48, 196, 48);

  // Customer
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Bill To:', 14, 56);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(order.customerName, 14, 62);

  // Items table
  const tableData = order.items.map(item => [
    item.productName,
    String(item.quantity),
    formatCurrency(item.price),
    formatCurrency(item.quantity * item.price),
  ]);

  autoTable(doc, {
    startY: 72,
    head: [['Product', 'Qty', 'Unit Price', 'Subtotal']],
    body: tableData,
    theme: 'striped',
    headStyles: { fillColor: [230, 126, 34], textColor: [255, 255, 255], fontStyle: 'bold' },
    styles: { fontSize: 10 },
  });

  type Doc = InstanceType<typeof jsPDF> & { lastAutoTable: { finalY: number } };
  const finalY = (doc as Doc).lastAutoTable.finalY + 10;
  const subtotal = order.total;

  if (options.igst) {
    const igst = subtotal * 0.18;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 130, finalY);
    doc.text(`IGST (18%): ${formatCurrency(igst)}`, 130, finalY + 7);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatCurrency(subtotal + igst)}`, 130, finalY + 17);
  } else {
    const cgst = subtotal * 0.09;
    const sgst = subtotal * 0.09;
    doc.text(`Subtotal: ${formatCurrency(subtotal)}`, 130, finalY);
    doc.text(`CGST (9%): ${formatCurrency(cgst)}`, 130, finalY + 7);
    doc.text(`SGST (9%): ${formatCurrency(sgst)}`, 130, finalY + 14);
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Grand Total: ${formatCurrency(subtotal + cgst + sgst)}`, 130, finalY + 24);
  }

  // Footer
  const footerY = doc.internal.pageSize.height - 30;
  doc.setDrawColor(230, 126, 34);
  doc.line(14, footerY - 5, 196, footerY - 5);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.text('Thank you for your business!', 14, footerY);
  doc.text('INVETO — Powered by AI Inventory Intelligence', 14, footerY + 6);

  doc.save(`Invoice_${order.id}.pdf`);
}

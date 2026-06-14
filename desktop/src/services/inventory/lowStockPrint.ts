import type { LowStockRow } from '../../services/inventory/lowStockService';

export function buildLowStockPrintHtml(rows: LowStockRow[], companyName: string): string {
  const date = new Date().toLocaleDateString();
  const bodyRows = rows
    .map(
      (r) =>
        `<tr><td>${r.name}</td><td>${r.sku}</td><td align="right">${r.currentStock}</td><td align="right">${r.threshold}</td><td align="right">${r.reorderQty}</td></tr>`
    )
    .join('');
  return `<!DOCTYPE html><html><head><title>Low Stock Report</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; }
h1 { font-size: 18px; margin: 0 0 4px; }
.meta { color: #555; margin-bottom: 16px; }
table { width: 100%; border-collapse: collapse; }
th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
th { background: #f5f5f5; text-align: left; }
footer { margin-top: 16px; font-size: 12px; }
</style></head><body>
<h1>${companyName}</h1>
<div class="meta">Low Stock Report — ${date}</div>
<table><thead><tr><th>Item</th><th>SKU</th><th>Current</th><th>Min</th><th>Reorder Qty</th></tr></thead>
<tbody>${bodyRows}</tbody></table>
<footer>Total items low on stock: ${rows.length}</footer>
</body></html>`;
}

export function printLowStockReport(rows: LowStockRow[], companyName: string): void {
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(buildLowStockPrintHtml(rows, companyName));
  win.document.close();
  win.focus();
  win.print();
}

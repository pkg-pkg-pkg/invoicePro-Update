import ExcelJS from 'exceljs';
import type { SalesDocumentRow } from '../types/salesDocuments';

export async function exportSalesDocumentsExcel(
  rows: SalesDocumentRow[],
  sheetName: string,
  fileName: string
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  const ws = workbook.addWorksheet(sheetName.slice(0, 31));
  const headers = ['Number', 'Date', 'Customer', 'Amount', 'Status', 'Due Date'];
  ws.addRow(headers);
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF132D54' } };

  for (const row of rows) {
    ws.addRow([
      row.number,
      row.date,
      row.customerName,
      row.amount,
      row.status,
      row.dueDate ?? '',
    ]);
  }
  ws.columns?.forEach((c) => {
    c.width = 18;
  });

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSalesDocumentsPdf(rows: SalesDocumentRow[], title: string): void {
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#0F172A}
h1{font-size:18px;color:#0B1F3A;border-bottom:3px solid #C9A227;padding-bottom:8px}
table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
th{background:#132D54;color:#fff;text-align:left;padding:10px 8px}
td{border-bottom:1px solid #D6DFEA;padding:8px}
tr:nth-child(even){background:#F4F7FB}
.footer{margin-top:24px;font-size:11px;color:#5C6B7A}
</style></head><body>
<h1>${title}</h1>
<table><thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Amount</th><th>Status</th></tr></thead><tbody>
${rows
  .map(
    (r) =>
      `<tr><td>${r.number}</td><td>${r.date}</td><td>${r.customerName}</td><td>${r.amount.toFixed(2)}</td><td>${r.status}</td></tr>`
  )
  .join('')}
</tbody></table>
<p class="footer">PVE InvoicePro — Sales export ${new Date().toLocaleString('en-IN')}</p>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
}

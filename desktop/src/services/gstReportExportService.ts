import ExcelJS from 'exceljs';
import { downloadPDF } from './printService';

export type GstExportFormat = 'pdf' | 'excel' | 'csv';

function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  URL.revokeObjectURL(url);
  document.body.removeChild(a);
}

function rowsToCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const keys = Object.keys(rows[0]);
  const escape = (value: unknown) => {
    if (value == null) return '';
    const str = String(value);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  return [keys.join(','), ...rows.map((row) => keys.map((k) => escape(row[k])).join(','))].join('\n');
}

function buildReportHtml(title: string, sections: Array<{ heading: string; rows: Record<string, unknown>[] }>) {
  const sectionHtml = sections
    .map((section) => {
      if (!section.rows.length) {
        return `<h2>${section.heading}</h2><p>No records</p>`;
      }
      const keys = Object.keys(section.rows[0]);
      return `<h2>${section.heading}</h2>
<table><thead><tr>${keys.map((k) => `<th>${k}</th>`).join('')}</tr></thead>
<tbody>${section.rows
        .map(
          (row) =>
            `<tr>${keys.map((k) => `<td>${row[k] ?? ''}</td>`).join('')}</tr>`
        )
        .join('')}</tbody></table>`;
    })
    .join('');

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/><title>${title}</title>
<style>
body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#0F172A}
h1{font-size:20px;color:#0B1F3A;border-bottom:3px solid #C9A227;padding-bottom:8px}
h2{font-size:14px;margin-top:20px;color:#132D54}
table{width:100%;border-collapse:collapse;margin-top:8px;font-size:11px}
th{background:#132D54;color:#fff;text-align:left;padding:8px}
td{border-bottom:1px solid #D6DFEA;padding:6px}
tr:nth-child(even){background:#F4F7FB}
.footer{margin-top:24px;font-size:10px;color:#5C6B7A}
</style></head><body>
<h1>${title}</h1>
${sectionHtml}
<p class="footer">Generated ${new Date().toLocaleString('en-IN')} — PVE InvoicePro</p>
</body></html>`;
}

export async function exportGstReportPdf(title: string, sections: Array<{ heading: string; rows: Record<string, unknown>[] }>, fileName: string) {
  const html = buildReportHtml(title, sections);
  const saved = await downloadPDF(html, fileName);
  if (!saved) {
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      w.print();
    }
  }
}

export async function exportGstReportExcel(
  fileName: string,
  sheets: Array<{ name: string; rows: Record<string, unknown>[] }>
) {
  const workbook = new ExcelJS.Workbook();
  for (const sheet of sheets) {
    const ws = workbook.addWorksheet(sheet.name.slice(0, 31));
    if (!sheet.rows.length) {
      ws.addRow(['No data']);
      continue;
    }
    const keys = Object.keys(sheet.rows[0]);
    ws.addRow(keys);
    ws.getRow(1).font = { bold: true };
    for (const row of sheet.rows) {
      ws.addRow(keys.map((k) => row[k]));
    }
    ws.columns?.forEach((c) => {
      c.width = 16;
    });
  }
  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`
  );
}

export function exportGstReportCsv(rows: Record<string, unknown>[], fileName: string) {
  const csv = rowsToCsv(rows);
  triggerDownload(new Blob([csv], { type: 'text/csv;charset=utf-8' }), fileName.endsWith('.csv') ? fileName : `${fileName}.csv`);
}

export async function exportGstBundle(options: {
  title: string;
  baseFileName: string;
  format: GstExportFormat;
  sections: Array<{ heading: string; sheetName: string; rows: Record<string, unknown>[] }>;
}) {
  const { title, baseFileName, format, sections } = options;
  if (format === 'pdf') {
    await exportGstReportPdf(
      title,
      sections.map((s) => ({ heading: s.heading, rows: s.rows })),
      `${baseFileName}.pdf`
    );
    return;
  }
  if (format === 'excel') {
    await exportGstReportExcel(
      `${baseFileName}.xlsx`,
      sections.map((s) => ({ name: s.sheetName, rows: s.rows }))
    );
    return;
  }
  const merged = sections.flatMap((s) =>
    s.rows.map((row) => ({ section: s.heading, ...row }))
  );
  exportGstReportCsv(merged, `${baseFileName}.csv`);
}

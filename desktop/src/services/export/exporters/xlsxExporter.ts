import ExcelJS from 'exceljs';
import { BaseExporter } from './baseExporter';
import { ExportOptions, ExportResult } from '../exportTypes';

const serializeValue = (value: unknown) => {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return value;
};

export class XlsxExporter extends BaseExporter {
  async export<T>(data: T[], options: ExportOptions): Promise<ExportResult> {
    const rows = Array.isArray(data) ? data : [];
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(options.sheetName || 'Export');

    if (rows.length > 0) {
      const header = Object.keys(rows[0] as Record<string, unknown>);
      worksheet.addRow(header);
      const headerRow = worksheet.getRow(1);
      headerRow.font = { bold: true };

      for (const row of rows) {
        const record = row as Record<string, unknown>;
        const values = header.map((key) => serializeValue(record[key]));
        worksheet.addRow(values);
      }

      worksheet.columns?.forEach((column) => {
        column.width = 20;
      });
    }

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = this.createBlob(buffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    return this.finalizeExport(blob, options, options.fileName || 'export.xlsx');
  }
}

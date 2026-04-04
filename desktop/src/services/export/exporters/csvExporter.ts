import { BaseExporter } from './baseExporter';
import { ExportOptions, ExportResult } from '../exportTypes';

const escapeValue = (value: unknown): string => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  const str = typeof value === 'object' ? JSON.stringify(value) : String(value);
  const needsQuotes = /[",\n]/.test(str);
  const escaped = str.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export class CsvExporter extends BaseExporter {
  async export<T>(data: T[], options: ExportOptions): Promise<ExportResult> {
    const rows = Array.isArray(data) ? data : [];
    const includeHeader = options.includeHeader !== false;

    if (rows.length === 0) {
      const blob = this.createBlob('', 'text/csv;charset=utf-8;');
      return this.finalizeExport(blob, options, options.fileName || 'export.csv');
    }

    const headerKeys = Object.keys(rows[0] as Record<string, unknown>);
    const lines: string[] = [];

    if (includeHeader) {
      lines.push(headerKeys.map((key) => escapeValue(key)).join(','));
    }

    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const values = headerKeys.map((key) => escapeValue(record[key]));
      lines.push(values.join(','));
    }

    const csv = lines.join('\n');
    const blob = this.createBlob(csv, 'text/csv;charset=utf-8;');
    return this.finalizeExport(blob, options, options.fileName || 'export.csv');
  }
}

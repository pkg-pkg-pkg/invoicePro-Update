import { BaseExporter } from './baseExporter';
import { ExportOptions, ExportResult } from '../exportTypes';

export class JsonExporter extends BaseExporter {
  async export<T>(data: T[], options: ExportOptions): Promise<ExportResult> {
    const payload = Array.isArray(data) ? data : [];
    const json = JSON.stringify(payload, null, 2);
    const blob = this.createBlob(json, 'application/json');
    return this.finalizeExport(blob, options, options.fileName || 'export.json');
  }
}

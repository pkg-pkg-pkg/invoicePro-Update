export type ExportFormat = 'csv' | 'json' | 'xlsx';

export interface ExportOptions {
  format: ExportFormat;
  fileName?: string;
  includeHeader?: boolean;
  sheetName?: string;
}

export interface ExportResult {
  success: boolean;
  blob?: Blob;
  sizeInBytes?: number;
  fileName?: string;
  error?: string;
}

import { ExportOptions, ExportResult } from '../exportTypes';

export abstract class BaseExporter {
  abstract export<T>(data: T[], options: ExportOptions): Promise<ExportResult>;

  protected createBlob(content: BlobPart, type: string): Blob {
    return new Blob([content], { type });
  }

  protected triggerDownload(blob: Blob, fileName: string) {
    const url = URL.createObjectURL(blob);
    try {
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  protected finalizeExport(blob: Blob, options: ExportOptions, defaultFileName: string): ExportResult {
    const fileName = options.fileName || defaultFileName;
    this.triggerDownload(blob, fileName);
    return {
      success: true,
      blob,
      sizeInBytes: blob.size,
      fileName,
    };
  }
}

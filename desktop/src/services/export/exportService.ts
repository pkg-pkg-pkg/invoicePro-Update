import { rbac } from '../auth/rbac';
import { auditService } from '../audit/auditService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { inventoryItemService } from '../masters/inventoryItemService';
import { itemCategoryService } from '../masters/itemCategoryService';
import { unitOfMeasureService } from '../masters/unitOfMeasureService';
import { godownService } from '../masters/godownService';
import { voucherService } from '../vouchers/voucherService';
import { syncQueue } from '../sync/syncQueue';
import { CsvExporter } from './exporters/csvExporter';
import { JsonExporter } from './exporters/jsonExporter';
import { XlsxExporter } from './exporters/xlsxExporter';
import { ExportFormat, ExportOptions, ExportResult } from './exportTypes';

export type ExportScope = 'masters' | 'vouchers' | 'audit' | 'sync';

export interface ExportRequest {
  scope: ExportScope;
  entityType: string;
  format: ExportFormat;
  filters?: Record<string, unknown>;
  options?: Omit<ExportOptions, 'format'>;
}

const exporters: Record<ExportFormat, { export<T>(data: T[], options: ExportOptions): Promise<ExportResult> }> = {
  csv: new CsvExporter(),
  json: new JsonExporter(),
  xlsx: new XlsxExporter(),
};

const masterFetchers: Record<string, () => Promise<any[]>> = {
  ledger_groups: () => ledgerGroupService.list({ includeInactive: true }),
  ledger_accounts: () => ledgerAccountService.list({ includeInactive: true }),
  inventory_items: () => inventoryItemService.list({ includeInactive: true }),
  item_categories: () => itemCategoryService.list({ includeInactive: true }),
  units_of_measure: () => unitOfMeasureService.list({ includeInactive: true }),
  godowns: () => godownService.list({ includeInactive: true }),
};

const voucherFetchers: Record<string, () => Promise<any[]>> = {
  vouchers: () => voucherService.list(),
};

const syncFetchers: Record<string, () => Promise<any[]>> = {
  queue: () => syncQueue.getAll(),
};

const resolveDataLoader = (request: ExportRequest): (() => Promise<any[]>) => {
  if (request.scope === 'masters') {
    const loader = masterFetchers[request.entityType];
    if (loader) return loader;
  }
  if (request.scope === 'vouchers') {
    const loader = voucherFetchers[request.entityType];
    if (loader) return loader;
  }
  if (request.scope === 'sync') {
    const loader = syncFetchers[request.entityType];
    if (loader) return loader;
  }
  if (request.scope === 'audit' && request.entityType === 'audit_log') {
    return () => auditService.getLog(request.filters ?? {});
  }
  throw new Error(`Unsupported export target: ${request.scope}:${request.entityType}`);
};

export const exportService = {
  async export(request: ExportRequest): Promise<ExportResult> {
    if (!rbac.hasPermission('reports:export')) {
      throw new Error('Permission denied: reports:export');
    }

    const exporter = exporters[request.format];
    if (!exporter) {
      throw new Error(`Unsupported export format: ${request.format}`);
    }

    const loadData = resolveDataLoader(request);
    const data = await loadData();

    const options: ExportOptions = {
      format: request.format,
      fileName: request.options?.fileName,
      includeHeader: request.options?.includeHeader,
      sheetName: request.options?.sheetName,
    };

    try {
      const result = await exporter.export(data, options);
      await auditService.logExport(request.entityType, request.entityType, {
        scope: request.scope,
        format: request.format,
        recordCount: data.length,
      });
      return result;
    } catch (error) {
      await auditService.logExport(request.entityType, request.entityType, {
        scope: request.scope,
        format: request.format,
        recordCount: data.length,
        error: error instanceof Error ? error.message : String(error),
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Export failed',
      };
    }
  },
};

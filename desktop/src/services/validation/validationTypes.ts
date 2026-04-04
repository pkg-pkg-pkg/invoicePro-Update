export type ValidationEntity =
  | 'ledgerAccount'
  | 'ledgerGroup'
  | 'inventoryItem'
  | 'party'
  | 'voucher'
  | 'sync';

export type ValidationOperation = 'create' | 'update' | 'delete' | 'sync' | 'import';

export interface ValidationErrorDetail {
  field: string;
  code: string;
  message: string;
  entityType?: ValidationEntity;
  entityId?: string;
  operation?: ValidationOperation;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationErrorDetail[];
}

export class ValidationException extends Error {
  public readonly errors: ValidationErrorDetail[];
  public readonly entityType?: ValidationEntity;
  public readonly entityId?: string;
  public readonly operation?: ValidationOperation;

  constructor(message: string, errors: ValidationErrorDetail[], meta?: { entityType?: ValidationEntity; entityId?: string; operation?: ValidationOperation }) {
    super(message);
    this.name = 'ValidationException';
    this.errors = errors;
    this.entityType = meta?.entityType;
    this.entityId = meta?.entityId;
    this.operation = meta?.operation;
  }
}

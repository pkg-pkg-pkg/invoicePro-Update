import { validateTransactionDate } from '../appSettingsService';
import { ValidationErrorDetail, ValidationResult } from './validationTypes';

export type NumberValidationOptions = {
  min?: number;
  max?: number;
  precision?: number; // allowed decimal places
  allowZero?: boolean;
};

export const createError = (field: string, code: string, message: string): ValidationErrorDetail => ({
  field,
  code,
  message,
});

export const successResult: ValidationResult = { valid: true, errors: [] };

export const combineResults = (...results: ValidationResult[]): ValidationResult => {
  const errors = results.flatMap((r) => r.errors);
  return errors.length ? { valid: false, errors } : successResult;
};

export const validateNumber = (
  value: number,
  field: string,
  code: string,
  options: NumberValidationOptions = {}
): ValidationResult => {
  if (Number.isNaN(value)) {
    return { valid: false, errors: [createError(field, code, 'Value must be a valid number')] };
  }
  if (!options.allowZero && value === 0) {
    return { valid: false, errors: [createError(field, code, 'Value must be greater than zero')] };
  }
  if (options.min !== undefined && value < options.min) {
    return { valid: false, errors: [createError(field, code, `Value must be >= ${options.min}`)] };
  }
  if (options.max !== undefined && value > options.max) {
    return { valid: false, errors: [createError(field, code, `Value must be <= ${options.max}`)] };
  }
  if (options.precision !== undefined) {
    const factor = 10 ** options.precision;
    if (Math.round(value * factor) !== value * factor) {
      return { valid: false, errors: [createError(field, code, `Value must have at most ${options.precision} decimal places`)] };
    }
  }
  return successResult;
};

export const validateIsoDate = (field: string, value: string): ValidationResult => {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) {
    return { valid: false, errors: [createError(field, 'DATE_INVALID', 'Invalid or missing date')] };
  }
  const now = new Date();
  if (date > now) {
    return { valid: false, errors: [createError(field, 'DATE_FUTURE', 'Date cannot be in the future')] };
  }
  const fiscalCheck = validateTransactionDate(value);
  if (!fiscalCheck.ok) {
    return { valid: false, errors: [createError(field, 'DATE_OUT_OF_RANGE', fiscalCheck.message)] };
  }
  return successResult;
};

export const aggregateErrors = (errors: ValidationErrorDetail[]): ValidationResult => ({
  valid: errors.length === 0,
  errors,
});

export const validateBalancedEntries = (
  debitTotal: number,
  creditTotal: number,
  tolerance = 0.01
): ValidationResult => {
  if (Math.abs(debitTotal - creditTotal) > tolerance) {
    return {
      valid: false,
      errors: [createError('lines', 'BALANCE_MISMATCH', 'Debit and credit totals must be equal')],
    };
  }
  if (debitTotal <= 0 || creditTotal <= 0) {
    return {
      valid: false,
      errors: [createError('lines', 'BALANCE_ZERO', 'Entries must include positive debit and credit amounts')],
    };
  }
  return successResult;
};

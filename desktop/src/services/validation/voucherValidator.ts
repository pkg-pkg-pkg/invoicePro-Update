import type { CreateVoucherInput } from '../vouchers/voucherService';
import { Voucher } from '../../types/vouchers';
import { ValidationException, ValidationResult, ValidationErrorDetail } from './validationTypes';
import { aggregateErrors, createError, validateBalancedEntries, validateIsoDate, validateNumber } from './validationEngine';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { inventoryItemService } from '../masters/inventoryItemService';
import type { LedgerAccount } from '../../types/masters';

interface VoucherValidationContext {
  existingVouchers?: Voucher[];
  currentVoucherId?: string;
}

interface VoucherLike {
  type: Voucher['type'];
  date: string;
  number: string;
  lines: Voucher['lines'];
}

const requireLines = (lines: Voucher['lines'], errors: ValidationErrorDetail[]) => {
  if (!Array.isArray(lines) || lines.length === 0) {
    errors.push(createError('lines', 'LINES_REQUIRED', 'At least one voucher line is required'));
  }
  if (lines.length < 2) {
    errors.push(createError('lines', 'LINES_MINIMUM', 'Voucher must contain at least two ledger entries'));
  }
};

const ensureUniqueVoucherNumber = (input: VoucherLike, ctx: VoucherValidationContext, errors: ValidationErrorDetail[]) => {
  const trimmedNumber = input.number?.trim().toLowerCase();
  if (!trimmedNumber) {
    errors.push(createError('number', 'NUMBER_REQUIRED', 'Voucher number is required'));
    return;
  }
  const duplicate = ctx.existingVouchers?.find(
    (voucher) =>
      voucher.type === input.type &&
      voucher.number.trim().toLowerCase() === trimmedNumber &&
      voucher.id !== ctx.currentVoucherId
  );
  if (duplicate) {
    errors.push(createError('number', 'NUMBER_DUPLICATE', 'Voucher number already exists for this type'));
  }
};

const validateLineAmounts = (lines: Voucher['lines'], errors: ValidationErrorDetail[]) => {
  lines.forEach((line, index) => {
    if (!line.ledgerId) {
      errors.push(createError(`lines[${index}].ledgerId`, 'LEDGER_REQUIRED', 'Ledger is required for each line'));
    }
    const debit = Number(line.debit ?? 0);
    const credit = Number(line.credit ?? 0);
    if (debit < 0 || credit < 0) {
      errors.push(createError(`lines[${index}]`, 'NEGATIVE_AMOUNT', 'Amounts cannot be negative'));
    }
    if (debit === 0 && credit === 0) {
      errors.push(createError(`lines[${index}]`, 'ZERO_AMOUNT', 'Provide either debit or credit amount'));
    }
    if (debit > 0 && credit > 0) {
      errors.push(createError(`lines[${index}]`, 'DUAL_ENTRY', 'Entry cannot have both debit and credit values'));
    }
    if (debit > 0) {
      const result = validateNumber(debit, `lines[${index}].debit`, 'DEBIT_PRECISION', { precision: 2, min: 0.01 });
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
    if (credit > 0) {
      const result = validateNumber(credit, `lines[${index}].credit`, 'CREDIT_PRECISION', { precision: 2, min: 0.01 });
      if (!result.valid) {
        errors.push(...result.errors);
      }
    }
  });
};

const loadLedgers = async (lines: Voucher['lines'], errors: ValidationErrorDetail[]): Promise<Map<string, LedgerAccount>> => {
  const uniqueIds = Array.from(new Set(lines.map((line) => line.ledgerId).filter((id): id is string => Boolean(id))));
  const map = new Map<string, LedgerAccount>();
  await Promise.all(
    uniqueIds.map(async (id) => {
      const ledger = await ledgerAccountService.getById(id);
      if (!ledger) {
        errors.push(createError('lines', 'LEDGER_NOT_FOUND', `Ledger ${id} does not exist`));
        return;
      }
      if (ledger.isActive === false) {
        errors.push(createError('lines', 'LEDGER_INACTIVE', `Ledger ${ledger.name} is inactive`));
        return;
      }
      map.set(id, ledger);
    })
  );
  return map;
};

const validateVoucherBalance = (lines: Voucher['lines'], errors: ValidationErrorDetail[]) => {
  const totals = lines.reduce(
    (acc, line) => {
      acc.debit += Number(line.debit ?? 0);
      acc.credit += Number(line.credit ?? 0);
      return acc;
    },
    { debit: 0, credit: 0 }
  );
  const balanceResult = validateBalancedEntries(totals.debit, totals.credit);
  if (!balanceResult.valid) {
    errors.push(...balanceResult.errors);
  }
};

const inventoryVoucherTypes: Voucher['type'][] = ['SALES', 'SALES_RETURN', 'PURCHASE', 'PURCHASE_RETURN'];
const ensureStockAvailabilityTypes: Voucher['type'][] = ['SALES', 'PURCHASE_RETURN'];

const validateInventoryLines = async (voucher: VoucherLike, errors: ValidationErrorDetail[]) => {
  if (!inventoryVoucherTypes.includes(voucher.type)) {
    return;
  }
  const itemLines = voucher.lines.filter((line) => Boolean(line.itemId));
  if (!itemLines.length) {
    errors.push(createError('lines', 'ITEM_REQUIRED', `${voucher.type} vouchers require at least one inventory line`));
    return;
  }
  const uniqueItemIds = Array.from(new Set(itemLines.map((line) => line.itemId).filter((id): id is string => Boolean(id))));
  const itemMap = new Map<string, Awaited<ReturnType<typeof inventoryItemService.getById>>>();
  await Promise.all(
    uniqueItemIds.map(async (itemId) => {
      const item = await inventoryItemService.getById(itemId);
      itemMap.set(itemId, item);
    })
  );
  itemLines.forEach((line, index) => {
    const item = line.itemId ? itemMap.get(line.itemId) : null;
    if (!item || item.status !== 'ACTIVE') {
      errors.push(createError(`lines[${index}].itemId`, 'ITEM_NOT_FOUND', 'Inventory item not found or inactive'));
      return;
    }
    const quantity = Number(line.quantity ?? 0);
    if (Number.isNaN(quantity) || quantity <= 0) {
      errors.push(createError(`lines[${index}].quantity`, 'QUANTITY_INVALID', 'Quantity must be greater than zero'));
      return;
    }
    if (ensureStockAvailabilityTypes.includes(voucher.type) && item.currentStock < quantity) {
      errors.push(
        createError(
          `lines[${index}].quantity`,
          'INSUFFICIENT_STOCK',
          `Insufficient stock for ${item.name}. Available ${item.currentStock}`
        )
      );
    }
  });
};

const ensureCashLedgerPresence = (voucher: VoucherLike, ledgerMap: Map<string, LedgerAccount>, errors: ValidationErrorDetail[]) => {
  if (voucher.type !== 'PAYMENT' && voucher.type !== 'RECEIPT' && voucher.type !== 'CONTRA') {
    return;
  }
  const cashLines = voucher.lines.filter((line) => {
    if (!line.ledgerId) return false;
    const ledger = ledgerMap.get(line.ledgerId);
    return Boolean(ledger?.isCashBank);
  });
  if (!cashLines.length) {
    errors.push(createError('lines', 'CASH_LEDGER_REQUIRED', 'Payment/Receipt vouchers require a cash or bank ledger line'));
  }
};

const ensureJournalRules = (voucher: VoucherLike, errors: ValidationErrorDetail[]) => {
  if (voucher.type !== 'JOURNAL') {
    return;
  }
  if (voucher.lines.length < 2) {
    errors.push(createError('lines', 'JOURNAL_MIN_LINES', 'Journal vouchers require at least two ledger entries'));
  }
};

const validateCore = async (
  input: VoucherLike,
  ctx: VoucherValidationContext,
  options: { skipDuplicateCheck?: boolean }
): Promise<ValidationResult> => {
  const errors: ValidationErrorDetail[] = [];

  const dateResult = validateIsoDate('date', input.date);
  if (!dateResult.valid) {
    errors.push(...dateResult.errors);
  }

  if (!options.skipDuplicateCheck) {
    ensureUniqueVoucherNumber(input, ctx, errors);
  } else if (!input.number?.trim()) {
    errors.push(createError('number', 'NUMBER_REQUIRED', 'Voucher number is required'));
  }

  requireLines(input.lines, errors);
  validateLineAmounts(input.lines, errors);
  validateVoucherBalance(input.lines, errors);
  ensureJournalRules(input, errors);

  const ledgerMap = await loadLedgers(input.lines, errors);
  ensureCashLedgerPresence(input, ledgerMap, errors);

  await validateInventoryLines(input, errors);

  return aggregateErrors(errors);
};

export const voucherValidator = {
  async validateForCreate(payload: CreateVoucherInput, ctx: VoucherValidationContext = {}): Promise<ValidationResult> {
    return validateCore(payload, ctx, { skipDuplicateCheck: false });
  },

  async validatePersisted(voucher: Voucher): Promise<ValidationResult> {
    return validateCore(voucher, { currentVoucherId: voucher.id }, { skipDuplicateCheck: true });
  },

  assertValid(result: ValidationResult) {
    if (!result.valid) {
      throw new ValidationException(result.errors[0]?.message ?? 'Voucher validation failed', result.errors);
    }
  },
};

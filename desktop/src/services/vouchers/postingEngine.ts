import { LedgerAccount } from '../../types/masters';
import { Voucher, VoucherLine, VoucherType } from '../../types/vouchers';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import {
  ledgerTransactionService,
  NewLedgerTransaction,
} from '../masters/ledgerTransactionService';
import { systemLogger } from '../logging/systemLogger';

interface ResolvedLine {
  line: VoucherLine;
  ledger: LedgerAccount;
}

const needsCashBankCredit = new Set<VoucherType>(['PAYMENT']);
const needsCashBankDebit = new Set<VoucherType>(['RECEIPT']);
const contraType = 'CONTRA';

const sum = (values: number[]) => Number(values.reduce((acc, val) => acc + val, 0).toFixed(4));

const postingFail = (code: string, message: string, context?: Record<string, unknown>): never => {
  systemLogger.error('posting', {
    event: 'posting_error',
    code,
    message,
    ...context,
  });
  throw new Error(message);
};

const ensureLineAmounts = (line: VoucherLine, index: number, voucherId: string) => {
  if (!line.ledgerId) {
    postingFail('POST_LINE_LEDGER_MISSING', `Ledger is required for line ${index + 1}`, {
      lineIndex: index,
      voucherId,
    });
  }

  const debit = Number(line.debit ?? 0);
  const credit = Number(line.credit ?? 0);
  if (Number.isNaN(debit) || Number.isNaN(credit) || debit < 0 || credit < 0) {
    postingFail('POST_INVALID_AMOUNT', `Invalid debit/credit on line ${index + 1}`, {
      lineIndex: index,
      voucherId,
    });
  }

  if (debit === 0 && credit === 0) {
    postingFail('POST_ZERO_LINE', `Line ${index + 1} must have either debit or credit`, {
      lineIndex: index,
      voucherId,
    });
  }

  if (debit > 0 && credit > 0) {
    postingFail('POST_LINE_DOUBLE_ENTRY', `Line ${index + 1} cannot have both debit and credit`, {
      lineIndex: index,
      voucherId,
    });
  }
};

const ensureCashBankConstraints = (voucherType: VoucherType, lines: ResolvedLine[], voucherId: string) => {
  const cashLines = lines.filter(({ ledger }) => ledger.isCashBank);
  if (needsCashBankCredit.has(voucherType)) {
    if (!cashLines.some(({ line }) => line.credit > 0)) {
      postingFail('POST_CASHBANK_CREDIT_REQUIRED', 'Payment vouchers require a cash/bank credit line', {
        voucherType,
        voucherId,
      });
    }
  }
  if (needsCashBankDebit.has(voucherType)) {
    if (!cashLines.some(({ line }) => line.debit > 0)) {
      postingFail('POST_CASHBANK_DEBIT_REQUIRED', 'Receipt vouchers require a cash/bank debit line', {
        voucherType,
        voucherId,
      });
    }
  }
  if (voucherType === contraType) {
    if (cashLines.length !== lines.length) {
      postingFail('POST_CONTRA_NON_CASH', 'Contra vouchers must involve only cash/bank ledgers', {
        voucherType,
        voucherId,
      });
    }
    const hasDebit = lines.some(({ line }) => line.debit > 0);
    const hasCredit = lines.some(({ line }) => line.credit > 0);
    if (!hasDebit || !hasCredit) {
      postingFail('POST_CONTRA_BALANCE', 'Contra vouchers must include both debit and credit entries', {
        voucherType,
        voucherId,
      });
    }
  }
};

export async function postVoucher(voucher: Voucher): Promise<void> {
  if (voucher.status !== 'ACTIVE') {
    postingFail('POST_INACTIVE_VOUCHER', 'Only active vouchers can be posted', { voucherId: voucher.id });
  }

  if (!Array.isArray(voucher.lines) || voucher.lines.length === 0) {
    postingFail('POST_LINES_REQUIRED', 'Voucher lines are required', { voucherId: voucher.id });
  }

  const resolvedLines: ResolvedLine[] = [];
  for (let i = 0; i < voucher.lines.length; i += 1) {
    const line = voucher.lines[i];
    ensureLineAmounts(line, i, voucher.id);
    const ledgerRecord = await ledgerAccountService.getById(line.ledgerId);
    if (!ledgerRecord || ledgerRecord.isActive === false) {
      postingFail(
        'POST_LEDGER_INACTIVE',
        `Ledger not found or inactive for line ${i + 1}`,
        {
          lineIndex: i,
          ledgerId: line.ledgerId,
          voucherId: voucher.id,
        }
      );
    }
    const ledger = ledgerRecord as LedgerAccount;
    resolvedLines.push({ line, ledger });
  }

  const totalDebit = sum(resolvedLines.map(({ line }) => line.debit ?? 0));
  const totalCredit = sum(resolvedLines.map(({ line }) => line.credit ?? 0));
  if (totalDebit !== totalCredit) {
    postingFail('POST_UNBALANCED', 'Voucher is not balanced (debits must equal credits)', {
      voucherId: voucher.id,
      totalDebit,
      totalCredit,
    });
  }

  ensureCashBankConstraints(voucher.type, resolvedLines, voucher.id);

  const transactions: NewLedgerTransaction[] = resolvedLines.map(({ line }) => ({
    ledgerId: line.ledgerId,
    voucherType: voucher.type,
    voucherId: voucher.id,
    date: voucher.date,
    debit: Number((line.debit ?? 0).toFixed(4)),
    credit: Number((line.credit ?? 0).toFixed(4)),
    meta:
      line.itemId || line.quantity
        ? ({
            itemId: line.itemId,
            quantity: line.quantity,
            narration: voucher.narration,
            voucherNumber: voucher.number,
          } as Record<string, unknown>)
        : voucher.narration || voucher.number
        ? { narration: voucher.narration, voucherNumber: voucher.number }
        : { voucherNumber: voucher.number },
  }));

  await ledgerTransactionService.recordTransactions(transactions);

  for (const { line, ledger } of resolvedLines) {
    const delta = Number(((line.debit ?? 0) - (line.credit ?? 0)).toFixed(4));
    if (delta !== 0) {
      await ledgerAccountService.adjustCurrentBalance(ledger.id, delta);
    }
  }

  systemLogger.info('posting', {
    event: 'posting_success',
    code: 'POST_SUCCESS',
    message: 'Voucher posted successfully',
    voucherId: voucher.id,
    voucherType: voucher.type,
  });
}

export async function reverseVoucherPosting(voucher: Voucher): Promise<void> {
  for (const line of voucher.lines) {
    const delta = Number((-(line.debit ?? 0) + (line.credit ?? 0)).toFixed(4));
    if (!line.ledgerId || delta === 0) continue;
    await ledgerAccountService.adjustCurrentBalance(line.ledgerId, delta);
  }
  await ledgerTransactionService.deleteByVoucher(voucher.id);
}

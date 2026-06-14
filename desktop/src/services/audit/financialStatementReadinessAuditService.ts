import type { LedgerAccount, LedgerGroup, LedgerTransaction } from '../../types/masters';
import type { VoucherType } from '../../types/vouchers';
import {
  assertAssignableLedgerGroup,
  isStructuralParentGroup,
  STANDARD_SUBGROUP_IDS,
} from '../../constants/chartOfAccounts';
import { indianFYBounds, indianFYStartYearForDate } from '../../utils/indianFY';
import { accountingIntegrityAuditService } from './accountingIntegrityAuditService';
import { ledgerAccountService } from '../masters/ledgerAccountService';
import { ledgerGroupService } from '../masters/ledgerGroupService';
import { ledgerTransactionService } from '../masters/ledgerTransactionService';
import { ledgerClassificationService } from '../masters/ledgerClassificationService';
import { voucherService } from '../vouchers/voucherService';
import { trialBalanceService } from '../reports/trialBalanceService';
import { profitAndLossService } from '../reports/profitAndLossService';
import { balanceSheetService } from '../reports/balanceSheetService';

const ROUND = (n: number) => Number(n.toFixed(2));
const TOLERANCE = 0.02;

const AUDITED_VOUCHER_TYPES: VoucherType[] = [
  'SALES',
  'PURCHASE',
  'PAYMENT',
  'RECEIPT',
  'JOURNAL',
  'SALES_RETURN',
  'PURCHASE_RETURN',
];

export type ReadinessCheck = {
  id: string;
  section: string;
  label: string;
  valid: boolean;
  detail: string;
  weight: number;
};

export type StatementReadiness = {
  id: string;
  label: string;
  ready: boolean;
  score: number;
  blockers: string[];
  notes: string[];
};

export type MissingFeature = {
  id: string;
  title: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  description: string;
  existsPartially?: boolean;
};

export type FinancialStatementReadinessAudit = {
  generatedAt: string;
  readinessScore: number;
  blockingIssues: string[];
  checks: ReadinessCheck[];
  statements: StatementReadiness[];
  voucherCoverage: {
    total: number;
    withTransactions: number;
    missingTransactions: number;
    invalidVouchers: number;
    byType: Array<{ type: string; total: number; posted: number; issues: number }>;
  };
  transactionSummary: {
    totalLines: number;
    orphanLines: number;
    invalidGroupLines: number;
    zeroAmountLines: number;
    totalDebit: number;
    totalCredit: number;
  };
  trialBalance: {
    companyBalanced: boolean;
    fyBalanced: boolean;
    unbalancedMonths: string[];
    companyDr: number;
    companyCr: number;
  };
  plReadiness: {
    misclassifiedCount: number;
    crossTypeCount: number;
    incomeGroupCount: number;
    expenseGroupCount: number;
  };
  bsReadiness: {
    assetLedgers: number;
    liabilityLedgers: number;
    capitalLedgers: number;
    balanced: boolean;
    totalAssets: number;
    totalLiabilities: number;
  };
  missingFeatures: MissingFeature[];
  suggestedArchitecture: string[];
};

function monthKey(iso: string): string {
  return String(iso).slice(0, 7);
}

function fyMonths(fyStartYear: number): string[] {
  const months: string[] = [];
  for (let m = 3; m <= 11; m += 1) {
    months.push(`${fyStartYear}-${String(m + 1).padStart(2, '0')}`);
  }
  months.push(`${fyStartYear + 1}-01`, `${fyStartYear + 1}-02`, `${fyStartYear + 1}-03`);
  return months;
}

function monthBounds(ym: string): { from: string; to: string } {
  const [y, m] = ym.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, '0')}` };
}

export const financialStatementReadinessAuditService = {
  async runAudit(): Promise<FinancialStatementReadinessAudit> {
    const fyStart = indianFYStartYearForDate();
    const fy = indianFYBounds(fyStart);

    const [
      vouchers,
      ledgers,
      groups,
      transactions,
      structureAudit,
      integrityAudit,
      tbCompany,
      tbFy,
      plResult,
      bsResult,
    ] = await Promise.all([
      voucherService.list(),
      ledgerAccountService.list({ includeInactive: true }),
      ledgerGroupService.list({ includeInactive: true }),
      ledgerTransactionService.list(),
      ledgerClassificationService.runAudit(),
      accountingIntegrityAuditService.runAudit(),
      trialBalanceService.getTrialBalance({ includeInactive: true }),
      trialBalanceService.getTrialBalance({ fromDate: fy.fromISODate, toDate: fy.toISODate, includeInactive: true }),
      profitAndLossService.getProfitAndLoss({ fromDate: fy.fromISODate, toDate: fy.toISODate }),
      balanceSheetService.getBalanceSheet({ asOfDate: fy.toISODate }),
    ]);

    const ledgerMap = new Map(ledgers.map((l) => [l.id, l]));
    const groupMap = new Map(groups.map((g) => [g.id, g]));
    const activeVoucherIds = new Set(
      vouchers.filter((v) => v.status === 'ACTIVE' && !v.isDeleted).map((v) => v.id)
    );

    const txnByVoucher = new Map<string, LedgerTransaction[]>();
    for (const txn of transactions) {
      if (!txn.voucherId) continue;
      const list = txnByVoucher.get(txn.voucherId) ?? [];
      list.push(txn);
      txnByVoucher.set(txn.voucherId, list);
    }

    const checks: ReadinessCheck[] = [];
    const blockingIssues: string[] = [];

    // ── A. Voucher Coverage ──
    const auditedVouchers = vouchers.filter(
      (v) => AUDITED_VOUCHER_TYPES.includes(v.type) && v.status === 'ACTIVE' && !v.isDeleted
    );
    let withTransactions = 0;
    let missingTxn = 0;
    const byTypeMap = new Map<string, { total: number; posted: number; issues: number }>();

    for (const v of auditedVouchers) {
      const bucket = byTypeMap.get(v.type) ?? { total: 0, posted: 0, issues: 0 };
      bucket.total += 1;
      const txns = txnByVoucher.get(v.id) ?? [];
      if (txns.length > 0) {
        withTransactions += 1;
        bucket.posted += 1;
      } else {
        missingTxn += 1;
        bucket.issues += 1;
      }
      byTypeMap.set(v.type, bucket);
    }

    const invalidVoucherCount = integrityAudit.voucherRows.filter((r) => !r.valid).length;
    const voucherCoverageValid = missingTxn === 0 && invalidVoucherCount === 0;
    checks.push({
      id: 'voucher_txn_sync',
      section: 'A. Voucher Coverage',
      label: 'Every active voucher creates ledger transactions',
      valid: missingTxn === 0,
      detail:
        missingTxn === 0
          ? `${auditedVouchers.length} voucher(s) all have posted transactions`
          : `${missingTxn} voucher(s) missing ledger transactions`,
      weight: 15,
    });
    checks.push({
      id: 'voucher_integrity',
      section: 'A. Voucher Coverage',
      label: 'Voucher posting logic valid (Dr/Cr, groups, patterns)',
      valid: invalidVoucherCount === 0,
      detail:
        invalidVoucherCount === 0
          ? 'All voucher types pass integrity rules'
          : `${invalidVoucherCount} voucher(s) with posting issues`,
      weight: 10,
    });

    if (missingTxn > 0) blockingIssues.push(`${missingTxn} voucher(s) have no ledger transactions`);
    if (invalidVoucherCount > 0) blockingIssues.push(`${invalidVoucherCount} voucher(s) fail posting integrity`);

    // ── B. Ledger Transactions ──
    let orphanLines = 0;
    let invalidGroupLines = 0;
    let zeroAmountLines = 0;
    let totalDr = 0;
    let totalCr = 0;

    for (const txn of transactions) {
      totalDr += Number(txn.debit ?? 0);
      totalCr += Number(txn.credit ?? 0);
      const dr = Number(txn.debit ?? 0);
      const cr = Number(txn.credit ?? 0);
      if (dr <= 0 && cr <= 0) zeroAmountLines += 1;
      if (!txn.ledgerId || !ledgerMap.has(txn.ledgerId)) {
        orphanLines += 1;
        continue;
      }
      const ledger = ledgerMap.get(txn.ledgerId)!;
      const group = groupMap.get(ledger.groupId);
      if (!group) {
        invalidGroupLines += 1;
        continue;
      }
      if (isStructuralParentGroup(group.id)) invalidGroupLines += 1;
      else {
        try {
          assertAssignableLedgerGroup(group);
        } catch {
          invalidGroupLines += 1;
        }
      }
      if (txn.voucherId && !activeVoucherIds.has(txn.voucherId) && !txn.voucherId.startsWith('opening-')) {
        orphanLines += 1;
      }
    }

    totalDr = ROUND(totalDr);
    totalCr = ROUND(totalCr);
    const txnBalanced = Math.abs(totalDr - totalCr) <= TOLERANCE;

    checks.push({
      id: 'txn_ledger_id',
      section: 'B. Ledger Transactions',
      label: 'Every posting has valid ledgerId',
      valid: transactions.every((t) => t.ledgerId && ledgerMap.has(t.ledgerId)),
      detail: `${transactions.length} lines; ${orphanLines} orphan/invalid ledger reference(s)`,
      weight: 10,
    });
    checks.push({
      id: 'txn_group_valid',
      section: 'B. Ledger Transactions',
      label: 'Group assignment valid (leaf assignable groups)',
      valid: invalidGroupLines === 0,
      detail: invalidGroupLines === 0 ? 'All postings to valid groups' : `${invalidGroupLines} invalid group posting(s)`,
      weight: 8,
    });
    checks.push({
      id: 'txn_dr_cr',
      section: 'B. Ledger Transactions',
      label: 'No zero-amount postings; global Dr = Cr',
      valid: zeroAmountLines === 0 && txnBalanced,
      detail: `Dr ₹${totalDr.toLocaleString('en-IN')} | Cr ₹${totalCr.toLocaleString('en-IN')}${zeroAmountLines ? `; ${zeroAmountLines} zero lines` : ''}`,
      weight: 12,
    });

    if (!txnBalanced) blockingIssues.push(`Ledger transactions unbalanced: Dr ₹${totalDr} ≠ Cr ₹${totalCr}`);
    if (orphanLines > 0) blockingIssues.push(`${orphanLines} orphan transaction line(s)`);

    // ── C. Trial Balance Readiness ──
    const companyBalanced = Math.abs(tbCompany.totalDebit - tbCompany.totalCredit) <= TOLERANCE;
    const fyBalanced = Math.abs(tbFy.totalDebit - tbFy.totalCredit) <= TOLERANCE;

    const unbalancedMonths: string[] = [];
    for (const ym of fyMonths(fyStart)) {
      const { from, to } = monthBounds(ym);
      const monthTb = await trialBalanceService.getTrialBalance({ fromDate: from, toDate: to, includeInactive: true });
      if (Math.abs(monthTb.totalDebit - monthTb.totalCredit) > TOLERANCE) {
        unbalancedMonths.push(ym);
      }
    }

    checks.push({
      id: 'tb_company',
      section: 'C. Trial Balance',
      label: 'Company-wide Trial Balance: Dr = Cr',
      valid: companyBalanced,
      detail: companyBalanced
        ? `Balanced at ₹${ROUND(tbCompany.totalDebit).toLocaleString('en-IN')}`
        : `Dr ₹${tbCompany.totalDebit.toLocaleString('en-IN')} ≠ Cr ₹${tbCompany.totalCredit.toLocaleString('en-IN')}`,
      weight: 12,
    });
    checks.push({
      id: 'tb_fy',
      section: 'C. Trial Balance',
      label: `Current FY (${fy.fromISODate} – ${fy.toISODate}) balanced`,
      valid: fyBalanced,
      detail: fyBalanced ? 'FY trial balance balances' : 'FY trial balance does not balance',
      weight: 8,
    });
    checks.push({
      id: 'tb_monthly',
      section: 'C. Trial Balance',
      label: 'Month-wise trial balance (current FY)',
      valid: unbalancedMonths.length === 0,
      detail:
        unbalancedMonths.length === 0
          ? 'All 12 FY months balance individually'
          : `Unbalanced months: ${unbalancedMonths.join(', ')}`,
      weight: 5,
    });

    if (!companyBalanced) blockingIssues.push('Company trial balance does not balance');
    if (!fyBalanced) blockingIssues.push('Current financial year trial balance does not balance');

    // ── D. P&L Readiness ──
    const misclassified = structureAudit.rows.filter((r) => r.mismatch);
    const crossType: Array<{ ledger: LedgerAccount; group: LedgerGroup }> = [];

    for (const ledger of ledgers) {
      const group = groupMap.get(ledger.groupId);
      if (!group) continue;
      const hasActivity = transactions.some((t) => t.ledgerId === ledger.id);
      if (!hasActivity) continue;
      if (group.type === 'ASSET' || group.type === 'LIABILITY') {
        const net = transactions
          .filter((t) => t.ledgerId === ledger.id)
          .reduce((s, t) => s + Number(t.debit ?? 0) - Number(t.credit ?? 0), 0);
        if (Math.abs(net) > TOLERANCE) {
          const incomeLike = net < 0;
          const expenseLike = net > 0;
          if (incomeLike || expenseLike) {
            crossType.push({ ledger, group });
          }
        }
      }
    }

    const incomeGroupCount = groups.filter((g) => g.type === 'INCOME').length;
    const expenseGroupCount = groups.filter((g) => g.type === 'EXPENSE').length;

    checks.push({
      id: 'pl_groups',
      section: 'D. Profit & Loss',
      label: 'Income and Expense chart groups present',
      valid: incomeGroupCount > 0 && expenseGroupCount > 0,
      detail: `${incomeGroupCount} income group(s), ${expenseGroupCount} expense group(s)`,
      weight: 4,
    });
    checks.push({
      id: 'pl_classification',
      section: 'D. Profit & Loss',
      label: 'No misclassified Income/Expense ledgers',
      valid: misclassified.filter((r) => {
        const g = groupMap.get(r.currentGroupId);
        return g?.type === 'INCOME' || g?.type === 'EXPENSE';
      }).length === 0,
      detail:
        misclassified.length === 0
          ? 'All ledgers correctly classified'
          : `${misclassified.length} misclassified ledger(s) — run Structure Audit`,
      weight: 8,
    });
    checks.push({
      id: 'pl_cross_type',
      section: 'D. Profit & Loss',
      label: 'No Income/Expense activity in Asset/Liability groups',
      valid: crossType.length === 0,
      detail:
        crossType.length === 0
          ? 'P&L activity confined to Income/Expense groups'
          : `${crossType.length} ledger(s) with P&L-like balances in wrong group type`,
      weight: 8,
    });
    checks.push({
      id: 'pl_derivable',
      section: 'D. Profit & Loss',
      label: 'P&L derivable from postings (current FY)',
      valid: plResult.totalIncome >= 0 && plResult.totalExpense >= 0,
      detail: `Income ₹${plResult.totalIncome.toLocaleString('en-IN')} − Expense ₹${plResult.totalExpense.toLocaleString('en-IN')} = Net ₹${plResult.netProfit.toLocaleString('en-IN')}`,
      weight: 6,
    });

    // ── E. Balance Sheet Readiness ──
    const assetLedgers = ledgers.filter((l) => groupMap.get(l.groupId)?.type === 'ASSET').length;
    const liabilityLedgers = ledgers.filter((l) => groupMap.get(l.groupId)?.type === 'LIABILITY').length;
    const capitalLedgers = ledgers.filter(
      (l) =>
        l.groupId === 'grp-capital-account' ||
        l.groupId === 'grp-reserves-surplus' ||
        groupMap.get(l.groupId)?.name?.toLowerCase().includes('capital')
    ).length;

    checks.push({
      id: 'bs_structure',
      section: 'E. Balance Sheet',
      label: 'Assets, Liabilities, Capital groups populated',
      valid: assetLedgers > 0 && liabilityLedgers > 0,
      detail: `${assetLedgers} asset ledger(s), ${liabilityLedgers} liability, ${capitalLedgers} capital/reserve`,
      weight: 5,
    });
    checks.push({
      id: 'bs_balanced',
      section: 'E. Balance Sheet',
      label: 'Balance Sheet balances (Assets = Liabilities incl. P&L)',
      valid: bsResult.balanced,
      detail: bsResult.balanced
        ? `Assets ₹${bsResult.totalAssets.toLocaleString('en-IN')} = Liabilities ₹${bsResult.totalLiabilities.toLocaleString('en-IN')}`
        : `Assets ₹${bsResult.totalAssets.toLocaleString('en-IN')} ≠ Liabilities ₹${bsResult.totalLiabilities.toLocaleString('en-IN')}`,
      weight: 12,
    });

    if (!bsResult.balanced) blockingIssues.push('Balance sheet does not balance for current FY end');

    // ── Statement-level readiness ──
    const cashLedgers = ledgers.filter(
      (l) =>
        l.groupId === STANDARD_SUBGROUP_IDS.cashInHand ||
        l.groupId === 'grp-cash-bank' ||
        l.isCashBank
    );
    const bankLedgers = ledgers.filter(
      (l) => l.groupId === STANDARD_SUBGROUP_IDS.bankAccounts || Boolean(l.bankDetails?.accountNumber)
    );
    const cashTxnCount = transactions.filter((t) => cashLedgers.some((l) => l.id === t.ledgerId)).length;
    const bankTxnCount = transactions.filter((t) => bankLedgers.some((l) => l.id === t.ledgerId)).length;
    const journalVouchers = auditedVouchers.filter((v) => v.type === 'JOURNAL').length;
    const journalPosted = auditedVouchers.filter((v) => v.type === 'JOURNAL' && (txnByVoucher.get(v.id)?.length ?? 0) > 0).length;

    const statements: StatementReadiness[] = [
      buildStatement('cash_book', 'Cash Book', cashLedgers.length > 0 && cashTxnCount > 0, [
        cashLedgers.length === 0 ? 'No cash-in-hand ledger' : null,
        cashTxnCount === 0 ? 'No cash ledger transactions' : null,
      ], ['Filter ledger transactions by cash group', 'Link to Receipt/Payment vouchers']),
      buildStatement('bank_book', 'Bank Book', bankLedgers.length > 0 && bankTxnCount > 0, [
        bankLedgers.length === 0 ? 'No bank account ledger' : null,
        bankTxnCount === 0 ? 'No bank ledger transactions' : null,
      ], ['Filter by bank ledgers', 'Show contra entries']),
      buildStatement('journal_register', 'Journal Register', journalVouchers === 0 || journalPosted === journalVouchers, [
        journalVouchers > journalPosted ? `${journalVouchers - journalPosted} journal(s) not posted` : null,
      ], ['Day Book already lists journal vouchers', 'Dedicated register = filter JOURNAL type']),
      buildStatement('trial_balance', 'Trial Balance', companyBalanced && fyBalanced, [
        !companyBalanced ? 'Company TB unbalanced' : null,
        !fyBalanced ? 'FY TB unbalanced' : null,
        unbalancedMonths.length > 0 ? `${unbalancedMonths.length} month(s) unbalanced` : null,
      ], ['Report exists at Financial Reports → Trial Balance']),
      buildStatement('profit_loss', 'Profit & Loss', crossType.length === 0 && misclassified.length === 0 && plResult.netProfit !== undefined, [
        misclassified.length > 0 ? `${misclassified.length} misclassified ledger(s)` : null,
        crossType.length > 0 ? `${crossType.length} cross-type ledger(s)` : null,
      ], ['Ledger-group P&L report available']),
      buildStatement('balance_sheet', 'Balance Sheet', bsResult.balanced && assetLedgers > 0, [
        !bsResult.balanced ? 'BS does not balance' : null,
      ], ['Balance Sheet report with comparative columns']),
    ];

    const missingFeatures = buildMissingFeatures({
      companyBalanced,
      missingTxn,
      orphanLines,
      cashBookDedicated: false,
      bankBookDedicated: false,
      journalRegisterDedicated: false,
      unbalancedMonths: unbalancedMonths.length,
      misclassified: misclassified.length,
      integrityValid: integrityAudit.overallValid,
      settlementValid: integrityAudit.settlementAudit.valid,
    });

    const totalWeight = checks.reduce((s, c) => s + c.weight, 0);
    const earnedWeight = checks.filter((c) => c.valid).reduce((s, c) => s + c.weight, 0);
    const readinessScore = totalWeight > 0 ? Math.round((earnedWeight / totalWeight) * 100) : 0;

    const suggestedArchitecture = [
      'Posting layer: voucherService → postingEngine → ledgerTransactionService (single source of truth for all statements)',
      'Classification layer: chartOfAccounts + ledgerClassificationService before TB/P&L/BS',
      'Settlement layer: billReferenceService for debtor/creditor outstanding (parallel to ledger balances)',
      'Report layer: trialBalanceService, profitAndLossService, balanceSheetService all read ledgerTransactionService only',
      'Add Cash Book / Bank Book as filtered views on ledgerTransactionService by cash/bank group IDs',
      'Journal Register: Day Book filter voucherType=JOURNAL or dedicated register page',
      'Run Accounting Integrity Audit + this Readiness Audit before releasing statements to users',
    ];

    return {
      generatedAt: new Date().toISOString(),
      readinessScore,
      blockingIssues: [...new Set(blockingIssues)],
      checks,
      statements,
      voucherCoverage: {
        total: auditedVouchers.length,
        withTransactions,
        missingTransactions: missingTxn,
        invalidVouchers: invalidVoucherCount,
        byType: Array.from(byTypeMap.entries()).map(([type, v]) => ({ type, ...v })),
      },
      transactionSummary: {
        totalLines: transactions.length,
        orphanLines,
        invalidGroupLines,
        zeroAmountLines,
        totalDebit: totalDr,
        totalCredit: totalCr,
      },
      trialBalance: {
        companyBalanced,
        fyBalanced,
        unbalancedMonths,
        companyDr: tbCompany.totalDebit,
        companyCr: tbCompany.totalCredit,
      },
      plReadiness: {
        misclassifiedCount: misclassified.length,
        crossTypeCount: crossType.length,
        incomeGroupCount,
        expenseGroupCount,
      },
      bsReadiness: {
        assetLedgers,
        liabilityLedgers,
        capitalLedgers,
        balanced: bsResult.balanced,
        totalAssets: bsResult.totalAssets,
        totalLiabilities: bsResult.totalLiabilities,
      },
      missingFeatures,
      suggestedArchitecture,
    };
  },
};

function buildStatement(
  id: string,
  label: string,
  ready: boolean,
  blockers: Array<string | null>,
  notes: string[]
): StatementReadiness {
  const issues = blockers.filter(Boolean) as string[];
  const score = ready ? 100 : issues.length > 0 ? Math.max(0, 100 - issues.length * 25) : 50;
  return { id, label, ready, score, blockers: issues, notes };
}

function buildMissingFeatures(ctx: {
  companyBalanced: boolean;
  missingTxn: number;
  orphanLines: number;
  cashBookDedicated: boolean;
  bankBookDedicated: boolean;
  journalRegisterDedicated: boolean;
  unbalancedMonths: number;
  misclassified: number;
  integrityValid: boolean;
  settlementValid: boolean;
}): MissingFeature[] {
  const features: MissingFeature[] = [];

  if (!ctx.companyBalanced) {
    features.push({
      id: 'tb_balance',
      title: 'Balanced Trial Balance',
      severity: 'Critical',
      description: 'Company-wide Dr ≠ Cr. All financial statements blocked until resolved.',
    });
  }
  if (ctx.missingTxn > 0) {
    features.push({
      id: 'voucher_posting',
      title: 'Complete Voucher Posting',
      severity: 'Critical',
      description: `${ctx.missingTxn} voucher(s) without ledger transactions. Re-post or run migration.`,
    });
  }
  if (ctx.orphanLines > 0) {
    features.push({
      id: 'orphan_txn',
      title: 'Orphan Transaction Cleanup',
      severity: 'Critical',
      description: 'Remove or relink transactions pointing to missing vouchers/ledgers.',
    });
  }
  if (!ctx.integrityValid) {
    features.push({
      id: 'integrity',
      title: 'Accounting Integrity Pass',
      severity: 'Critical',
      description: 'Resolve issues in Accounting Integrity Audit before statement release.',
      existsPartially: true,
    });
  }
  if (!ctx.settlementValid) {
    features.push({
      id: 'settlement',
      title: 'Bill-wise Settlement Integrity',
      severity: 'High',
      description: 'Fix bill reference audit issues for accurate debtor/creditor statements.',
      existsPartially: true,
    });
  }
  if (!ctx.cashBookDedicated) {
    features.push({
      id: 'cash_book_ui',
      title: 'Dedicated Cash Book Report',
      severity: 'High',
      description: 'Cash ledger exists and has transactions; add filtered Cash Book UI (data layer ready).',
      existsPartially: true,
    });
  }
  if (!ctx.bankBookDedicated) {
    features.push({
      id: 'bank_book_ui',
      title: 'Dedicated Bank Book Report',
      severity: 'High',
      description: 'Add bank-ledger filtered register with running balance (data layer ready).',
      existsPartially: true,
    });
  }
  if (!ctx.journalRegisterDedicated) {
    features.push({
      id: 'journal_register_ui',
      title: 'Dedicated Journal Register',
      severity: 'Medium',
      description: 'Day Book covers all vouchers; add JOURNAL-only register for auditors.',
      existsPartially: true,
    });
  }
  if (ctx.unbalancedMonths > 0) {
    features.push({
      id: 'monthly_tb',
      title: 'Month-wise TB Reconciliation',
      severity: 'High',
      description: `${ctx.unbalancedMonths} FY month(s) fail individual trial balance — investigate period cut-off.`,
    });
  }
  if (ctx.misclassified > 0) {
    features.push({
      id: 'pl_reclass',
      title: 'P&L Ledger Reclassification',
      severity: 'High',
      description: `${ctx.misclassified} misclassified ledger(s). Run Structure Audit migration.`,
      existsPartially: true,
    });
  }
  features.push({
    id: 'fy_lock',
    title: 'Financial Year Period Lock',
    severity: 'Medium',
    description: 'Prevent voucher edits in closed periods after statements are finalized.',
  });
  features.push({
    id: 'schedule_iii',
    title: 'Schedule III / Notes to Accounts',
    severity: 'Low',
    description: 'Statutory notes and detailed schedules for audited BS/P&L.',
  });
  features.push({
    id: 'consolidation',
    title: 'Multi-company Consolidation',
    severity: 'Low',
    description: 'Group-level TB/P&L/BS across companies.',
  });

  const order = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  return features.sort((a, b) => order[a.severity] - order[b.severity]);
}

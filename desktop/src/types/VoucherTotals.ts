import { GSTDecisionResult } from '../services/vouchers/gstDecisionEngine'
import { TaxBreakup } from '../services/vouchers/gstBifurcationEngine'

export interface VoucherTotals {
  subtotal: number
  tax: number
  grandTotal: number
  taxBifurcated: TaxBreakup

  gstDecision?: GSTDecisionResult
  roundOff?: number
  taxType?: 'CGST_SGST' | 'IGST'
}

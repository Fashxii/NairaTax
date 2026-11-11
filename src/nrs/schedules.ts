/**
 * nrs/schedules.ts — Return schedules built from the ledger (Phase 4).
 *
 *  - VAT return (monthly): Schedule A (output VAT on sales) and
 *    Schedule C (input VAT on purchases), plus the net position.
 *  - WHT deduction schedule (monthly).
 *  - CIT summary (annual), fed into the existing calculateCIT engine.
 *
 * Schedule naming follows the original spec (Form VAT 002 Schedules A & C).
 * Confirm the official layout against the NRS template before filing; export
 * columns are defined separately in exportLayouts.ts so they can be changed
 * without touching these calculations.
 */

import { calculateCIT, type CITResult } from '../utils/citEngine';
import { WHT_RATE_SCHEDULE } from '../utils/whtEngine';
import { koboToNaira, sumKobo } from './money';
import { getTaxYearConfig, dueDateForPeriod } from './taxYearConfig';
import { validateTin } from './tin';
import type { CitCategory, LedgerTransaction } from './types';

export interface VatScheduleRow {
  txId: string;
  date: string;
  counterpartyName: string;
  counterpartyTin: string;
  invoiceRef: string;
  description: string;
  netKobo: number;
  vatKobo: number;
  grossKobo: number;
  /** Input VAT only: claimable when the supplier TIN is valid. */
  claimable: boolean;
}

export interface VatReturn {
  period: string;
  dueDate: string;
  scheduleA: VatScheduleRow[];
  scheduleC: VatScheduleRow[];
  standardSalesNetKobo: number;
  zeroRatedSalesKobo: number;
  exemptSalesKobo: number;
  outputVatKobo: number;
  inputVatTotalKobo: number;
  inputVatClaimableKobo: number;
  inputVatUnsupportedKobo: number;
  /** Positive = payable to NRS; negative = credit carried forward. */
  netVatKobo: number;
}

function vatRow(tx: LedgerTransaction): VatScheduleRow {
  return {
    txId: tx.id,
    date: tx.date,
    counterpartyName: tx.counterpartyName ?? '',
    counterpartyTin: tx.counterpartyTin ?? '',
    invoiceRef: tx.invoiceRef ?? '',
    description: tx.narration,
    netKobo: tx.netKobo,
    vatKobo: tx.vatKobo,
    grossKobo: tx.amountKobo,
    claimable: validateTin(tx.counterpartyTin).valid,
  };
}

const NON_TRADING: CitCategory[] = ['TRANSFER', 'TAX_PAYMENT', 'UNCLASSIFIED'];

export function buildVatReturn(period: string, txs: LedgerTransaction[]): VatReturn {
  const cfg = getTaxYearConfig(Number(period.slice(0, 4)));
  const inPeriod = txs.filter((t) => t.taxPeriod === period && !NON_TRADING.includes(t.citCategory));
  const sales = inPeriod.filter((t) => t.direction === 'INFLOW');
  const purchases = inPeriod.filter((t) => t.direction === 'OUTFLOW');

  const scheduleA = sales.filter((t) => t.vatTreatment === 'STANDARD').map(vatRow);
  const scheduleC = purchases.filter((t) => t.vatTreatment === 'STANDARD' && t.vatKobo > 0).map(vatRow);

  const outputVatKobo = sumKobo(scheduleA, (r) => r.vatKobo);
  const inputVatTotalKobo = sumKobo(scheduleC, (r) => r.vatKobo);
  const inputVatClaimableKobo = sumKobo(scheduleC.filter((r) => r.claimable), (r) => r.vatKobo);

  return {
    period,
    dueDate: dueDateForPeriod(period, cfg.vatReturnDueDay),
    scheduleA,
    scheduleC,
    standardSalesNetKobo: sumKobo(scheduleA, (r) => r.netKobo),
    zeroRatedSalesKobo: sumKobo(sales.filter((t) => t.vatTreatment === 'ZERO_RATED'), (t) => t.amountKobo),
    exemptSalesKobo: sumKobo(sales.filter((t) => t.vatTreatment === 'EXEMPT'), (t) => t.amountKobo),
    outputVatKobo,
    inputVatTotalKobo,
    inputVatClaimableKobo,
    inputVatUnsupportedKobo: inputVatTotalKobo - inputVatClaimableKobo,
    netVatKobo: outputVatKobo - inputVatClaimableKobo,
  };
}

export interface WhtScheduleRow {
  txId: string;
  date: string;
  payeeName: string;
  payeeTin: string;
  payeeType: 'company' | 'individual';
  paymentType: string;
  baseKobo: number;
  rateBps: number;
  whtKobo: number;
  creditNoteRef: string;
}

export interface WhtSchedule {
  period: string;
  dueDate: string;
  rows: WhtScheduleRow[];
  totalBaseKobo: number;
  totalWhtKobo: number;
  byPaymentType: { paymentType: string; count: number; whtKobo: number }[];
}

export function buildWhtSchedule(period: string, txs: LedgerTransaction[]): WhtSchedule {
  const cfg = getTaxYearConfig(Number(period.slice(0, 4)));
  const rows: WhtScheduleRow[] = txs
    .filter((t) => t.taxPeriod === period && t.direction === 'OUTFLOW' && t.whtKobo > 0)
    .map((t) => ({
      txId: t.id,
      date: t.date,
      payeeName: t.counterpartyName ?? t.narration,
      payeeTin: t.counterpartyTin ?? '',
      payeeType: t.payeeType,
      paymentType: WHT_RATE_SCHEDULE.find((r) => r.id === t.whtCategoryId)?.paymentType ?? t.whtCategoryId ?? '',
      baseKobo: t.netKobo,
      rateBps: t.whtRateBps,
      whtKobo: t.whtKobo,
      creditNoteRef: t.whtCreditNoteRef ?? '',
    }));
  const byType = new Map<string, { count: number; whtKobo: number }>();
  for (const r of rows) {
    const e = byType.get(r.paymentType) ?? { count: 0, whtKobo: 0 };
    byType.set(r.paymentType, { count: e.count + 1, whtKobo: e.whtKobo + r.whtKobo });
  }
  return {
    period,
    dueDate: dueDateForPeriod(period, cfg.whtRemittanceDueDay),
    rows,
    totalBaseKobo: sumKobo(rows, (r) => r.baseKobo),
    totalWhtKobo: sumKobo(rows, (r) => r.whtKobo),
    byPaymentType: [...byType.entries()].map(([paymentType, v]) => ({ paymentType, ...v })),
  };
}

export interface CitSummary {
  year: number;
  byCategory: Record<CitCategory, number>;
  turnoverKobo: number;
  otherIncomeKobo: number;
  allowableExpensesKobo: number;
  capexKobo: number;
  nonAllowableKobo: number;
  isSmallCompany: boolean;
  /** Estimate via citEngine (capital allowances not yet computed from CAPEX). */
  estimate: CITResult;
}

const ALLOWABLE: CitCategory[] = ['OPERATING_EXPENSE', 'SALARY_PAYE', 'RENT_EXPENSE'];

export function buildCitSummary(year: number, txs: LedgerTransaction[], isTechLevySector = false): CitSummary {
  const cfg = getTaxYearConfig(year);
  const inYear = txs.filter((t) => t.date.startsWith(String(year)));
  const byCategory = {
    SALES_REVENUE: 0, OTHER_INCOME: 0, OPERATING_EXPENSE: 0, CAPEX: 0, SALARY_PAYE: 0,
    RENT_EXPENSE: 0, EXEMPT_SUPPLY: 0, NON_ALLOWABLE: 0, TAX_PAYMENT: 0, TRANSFER: 0, UNCLASSIFIED: 0,
  } as Record<CitCategory, number>;
  // VAT-exclusive figures: VAT collected/paid is not income/expense.
  for (const t of inYear) byCategory[t.citCategory] += t.netKobo;

  const turnoverKobo = byCategory.SALES_REVENUE + byCategory.EXEMPT_SUPPLY;
  const otherIncomeKobo = byCategory.OTHER_INCOME;
  const allowableExpensesKobo = ALLOWABLE.reduce((s, c) => s + byCategory[c], 0);
  const isSmallCompany = turnoverKobo <= cfg.smallCompanyTurnoverThresholdKobo;

  const estimate = calculateCIT({
    grossTurnover: koboToNaira(turnoverKobo),
    totalRevenue: koboToNaira(turnoverKobo + otherIncomeKobo),
    allowableExpenses: koboToNaira(allowableExpensesKobo),
    capitalAllowances: 0,
    lossesCarriedForward: 0,
    isTechLevySector,
    // Use this year's configured small-company limit instead of the engine's built-in tiers.
    bracketOverride: isSmallCompany ? 'small' : 'auto',
  });

  return {
    year,
    byCategory,
    turnoverKobo,
    otherIncomeKobo,
    allowableExpensesKobo,
    capexKobo: byCategory.CAPEX,
    nonAllowableKobo: byCategory.NON_ALLOWABLE + byCategory.TAX_PAYMENT,
    isSmallCompany,
    estimate,
  };
}


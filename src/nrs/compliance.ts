/**
 * nrs/compliance.ts — Compliance checks (Phase 3).
 *
 * Runs a set of pure rules over the ledger and returns issues the user can fix
 * before filing. Every issue says what is wrong, why it matters, and how to fix it.
 */

import { needsReview } from './classifier';
import { formatKobo, sumKobo } from './money';
import { getTaxYearConfig } from './taxYearConfig';
import { validateTin } from './tin';
import type { LedgerTransaction, TaxpayerFacts } from './types';

export type IssueSeverity = 'error' | 'warning' | 'info';

export type IssueCode =
  | 'NEEDS_REVIEW'
  | 'UNCLASSIFIED'
  | 'MISSING_PROOF'
  | 'INVALID_TIN'
  | 'INPUT_VAT_NO_TIN'
  | 'VAT_ON_NON_STANDARD'
  | 'WHT_NO_PAYEE_TIN'
  | 'WHT_NO_CREDIT_NOTE'
  | 'SALES_NO_INVOICE'
  | 'POSSIBLE_DUPLICATE'
  | 'VAT_REGISTRATION_REQUIRED'
  | 'SMALL_COMPANY_STATUS'
  | 'THRESHOLDS_UNVERIFIED';

export interface ComplianceIssue {
  id: string;
  code: IssueCode;
  severity: IssueSeverity;
  txId?: string;
  title: string;
  why: string;
  fix: string;
}

export interface ComplianceReport {
  issues: ComplianceIssue[];
  score: number;
  counts: Record<IssueSeverity, number>;
  turnoverKobo: number;
  isSmallCompany: boolean;
}

const ALLOWABLE_FOR_PROOF = new Set(['OPERATING_EXPENSE', 'CAPEX', 'RENT_EXPENSE']);

function issue(code: IssueCode, severity: IssueSeverity, title: string, why: string, fix: string, txId?: string): ComplianceIssue {
  return { id: `${code}:${txId ?? 'ledger'}`, code, severity, txId, title, why, fix };
}

/** Checks on a single transaction. */
export function checkTransaction(tx: LedgerTransaction): ComplianceIssue[] {
  const out: ComplianceIssue[] = [];
  const cfg = getTaxYearConfig(Number(tx.date.slice(0, 4)));
  const label = `${tx.date} · ${tx.counterpartyName || tx.narration.slice(0, 40)} · ${formatKobo(tx.amountKobo)}`;

  if (tx.citCategory === 'UNCLASSIFIED') {
    out.push(issue('UNCLASSIFIED', 'warning', `Unclassified: ${label}`,
      'Unclassified items are left out of every schedule.',
      'Choose a category (e.g. operating expense, transfer, non-allowable).', tx.id));
  } else if (needsReview(tx.classification.confidence, tx.classification.reviewedAt)) {
    out.push(issue('NEEDS_REVIEW', 'warning', `Check classification: ${label}`,
      'This was sorted automatically with low confidence.',
      'Confirm or correct the category and VAT treatment.', tx.id));
  }

  if (tx.counterpartyTin && !validateTin(tx.counterpartyTin).valid) {
    out.push(issue('INVALID_TIN', 'error', `Invalid TIN on ${label}`,
      validateTin(tx.counterpartyTin).error ?? 'TIN format not recognised.',
      'Correct the TIN or clear it.', tx.id));
  }

  if (tx.direction === 'OUTFLOW') {
    if (ALLOWABLE_FOR_PROOF.has(tx.citCategory) && tx.amountKobo >= cfg.proofRequiredAboveKobo && !tx.documentProof) {
      out.push(issue('MISSING_PROOF', 'warning', `No receipt: ${label}`,
        'Deductions without supporting documents can be disallowed at audit.',
        'Attach the receipt or invoice reference.', tx.id));
    }
    if (tx.vatKobo > 0 && !validateTin(tx.counterpartyTin).valid) {
      out.push(issue('INPUT_VAT_NO_TIN', 'warning', `Input VAT without supplier TIN: ${label}`,
        `${formatKobo(tx.vatKobo)} input VAT is excluded from the claim until the supplier TIN is recorded.`,
        "Add the supplier's TIN (from their VAT invoice).", tx.id));
    }
    if (tx.whtKobo > 0) {
      if (!validateTin(tx.counterpartyTin).valid) {
        out.push(issue('WHT_NO_PAYEE_TIN', 'warning', `WHT payee has no TIN: ${label}`,
          'The WHT schedule needs the payee TIN so the payee can claim the credit.',
          "Add the payee's TIN.", tx.id));
      }
      if (!tx.whtCreditNoteRef) {
        out.push(issue('WHT_NO_CREDIT_NOTE', 'info', `No WHT receipt/credit note ref: ${label}`,
          'Record the remittance receipt once the WHT has been paid to NRS/SIRS.',
          'Add the credit note or remittance reference.', tx.id));
      }
    }
  } else if (tx.citCategory === 'SALES_REVENUE' && !tx.invoiceRef) {
    out.push(issue('SALES_NO_INVOICE', 'info', `Sale without invoice ref: ${label}`,
      'Schedule A lists output VAT by invoice.',
      'Add the invoice number you issued.', tx.id));
  }

  if (tx.vatTreatment !== 'STANDARD' && tx.vatKobo > 0) {
    out.push(issue('VAT_ON_NON_STANDARD', 'error', `VAT on ${tx.vatTreatment.toLowerCase()} item: ${label}`,
      'Only standard-rated supplies carry VAT.', 'Re-save the transaction to recompute VAT.', tx.id));
  }
  return out;
}

/** Same date, amount, direction and narration = probable duplicate (e.g. CSV + bank sync). */
export function findDuplicates(txs: LedgerTransaction[]): ComplianceIssue[] {
  const groups = new Map<string, LedgerTransaction[]>();
  for (const tx of txs) {
    const key = `${tx.date}|${tx.amountKobo}|${tx.direction}|${tx.narration.toLowerCase().replace(/\s+/g, ' ')}`;
    groups.set(key, [...(groups.get(key) ?? []), tx]);
  }
  const out: ComplianceIssue[] = [];
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    for (const tx of group.slice(1)) {
      out.push(issue('POSSIBLE_DUPLICATE', 'warning',
        `Possible duplicate: ${tx.date} · ${formatKobo(tx.amountKobo)}`,
        'The same transaction may have been imported twice, inflating your figures.',
        'Delete the duplicate if it is the same payment.', tx.id));
    }
  }
  return out;
}

/** Annual turnover = VAT-exclusive sales revenue for the tax year. */
export function annualTurnoverKobo(txs: LedgerTransaction[], year: number): number {
  return sumKobo(
    txs.filter((t) => t.direction === 'INFLOW' && t.citCategory === 'SALES_REVENUE' && t.date.startsWith(String(year))),
    (t) => t.netKobo,
  );
}

/**
 * Full report. `scopeTxs` are the transactions being checked (e.g. one month);
 * `yearTxs` are used for turnover thresholds.
 */
export function runCompliance(
  scopeTxs: LedgerTransaction[],
  yearTxs: LedgerTransaction[],
  year: number,
  facts: TaxpayerFacts,
): ComplianceReport {
  const cfg = getTaxYearConfig(year);
  const issues: ComplianceIssue[] = [
    ...scopeTxs.flatMap(checkTransaction),
    ...findDuplicates(scopeTxs),
  ];

  const turnoverKobo = annualTurnoverKobo(yearTxs, year);
  if (!facts.isVatRegistered && turnoverKobo > cfg.vatRegistrationThresholdKobo) {
    issues.push(issue('VAT_REGISTRATION_REQUIRED', 'error',
      `Turnover ${formatKobo(turnoverKobo, 0)} is above the VAT threshold`,
      `Businesses above ${formatKobo(cfg.vatRegistrationThresholdKobo, 0)} must register for, charge and file VAT.`,
      'Register for VAT and mark your profile as VAT-registered.'));
  }

  const isSmallCompany = turnoverKobo <= cfg.smallCompanyTurnoverThresholdKobo;
  if (facts.accountType === 'business') {
    issues.push(issue('SMALL_COMPANY_STATUS', 'info',
      isSmallCompany
        ? `Small company (turnover ${formatKobo(turnoverKobo, 0)})`
        : `Not a small company (turnover ${formatKobo(turnoverKobo, 0)})`,
      `Small-company limit for ${cfg.year}: ${formatKobo(cfg.smallCompanyTurnoverThresholdKobo, 0)} turnover${
        cfg.smallCompanyFixedAssetsThresholdKobo ? ` and ${formatKobo(cfg.smallCompanyFixedAssetsThresholdKobo, 0)} fixed assets` : ''
      }.`,
      isSmallCompany ? 'You still need to file a CIT return, even at 0%.' : 'Standard CIT rates apply — keep allowable-expense records complete.'));
  }

  if (!cfg.verified) {
    issues.push(issue('THRESHOLDS_UNVERIFIED', 'info',
      `${cfg.year} thresholds awaiting adviser confirmation`,
      'Statutory figures for this year have not yet been confirmed by a tax adviser.',
      'Treat threshold-based results as estimates until confirmed.'));
  }

  const counts = { error: 0, warning: 0, info: 0 } as Record<IssueSeverity, number>;
  for (const i of issues) counts[i.severity]++;

  // Score: share of transactions without problems, minus a penalty for blocking errors.
  const problemTx = new Set(issues.filter((i) => i.txId && i.severity !== 'info').map((i) => i.txId));
  const base = scopeTxs.length === 0 ? 100 : Math.round(100 * (1 - problemTx.size / scopeTxs.length));
  const ledgerErrors = issues.filter((i) => !i.txId && i.severity === 'error').length;
  const score = Math.max(0, Math.min(100, base - ledgerErrors * 15));

  const order: Record<IssueSeverity, number> = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.severity] - order[b.severity]);
  return { issues, score, counts, turnoverKobo, isSmallCompany };
}


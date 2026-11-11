/**
 * nrs.test.ts — Unit tests for the NRS Rev360 preparation layer (Phases 1–4).
 */

import { describe, it, expect } from 'vitest';
import { nairaToKobo, parseNairaString, vatFromInclusive, koboToDecimalString, applyRate } from './money';
import { validateTin, normalizeTin } from './tin';
import { getTaxYearConfig, dueDateForPeriod } from './taxYearConfig';
import { classifyTransaction, counterpartyKey, REVIEW_THRESHOLD } from './classifier';
import {
  applyPatch,
  buildTransaction,
  confirmTransaction,
  emptyPeriod,
  mergeTransactions,
  rememberCounterparty,
  transitionPeriod,
} from './ledger';
import { importBankCsv, importSmartVault, parseCsv, parseStatementDate, importMonoItem } from './importers';
import { runCompliance, annualTurnoverKobo } from './compliance';
import { buildVatReturn, buildWhtSchedule, buildCitSummary } from './schedules';
import { toCsv, VAT_SCHEDULE_A_DRAFT, WHT_SCHEDULE_DRAFT } from './exportLayouts';
import type { LedgerTransactionInput } from './types';

const input = (over: Partial<LedgerTransactionInput>): LedgerTransactionInput => ({
  source: 'MANUAL',
  sourceRef: Math.random().toString(36),
  date: '2026-10-05',
  amountKobo: nairaToKobo(107_500),
  direction: 'OUTFLOW',
  narration: 'Generic payment',
  ...over,
});

// ─── Phase 1: money, TIN, config ─────────────────────────────────────────────

describe('money', () => {
  it('converts naira to integer kobo without float drift', () => {
    expect(nairaToKobo(0.1 + 0.2)).toBe(30);
    expect(nairaToKobo('₦1,250.50')).toBe(125_050);
  });
  it('parses bank amount formats', () => {
    expect(parseNairaString('(5,000.00)')).toBe(-5000);
    expect(parseNairaString('2,000 DR')).toBe(-2000);
    expect(parseNairaString('NGN 3,500.25')).toBe(3500.25);
    expect(parseNairaString('abc')).toBeNaN();
  });
  it('extracts VAT from a VAT-inclusive amount', () => {
    // ₦107,500 incl. 7.5% VAT → ₦7,500 VAT
    expect(vatFromInclusive(nairaToKobo(107_500), 750)).toBe(nairaToKobo(7_500));
    expect(vatFromInclusive(100_000, 0)).toBe(0);
  });
  it('applies basis-point rates and formats for CSV', () => {
    expect(applyRate(nairaToKobo(100_000), 1000)).toBe(nairaToKobo(10_000));
    expect(koboToDecimalString(123_456)).toBe('1234.56');
    expect(koboToDecimalString(-5)).toBe('-0.05');
  });
});

describe('TIN validation', () => {
  it('accepts FIRS legacy, JTB and 13-digit formats', () => {
    expect(validateTin('12345678-0001')).toMatchObject({ valid: true, format: 'FIRS_LEGACY' });
    expect(validateTin('123456780001')).toMatchObject({ valid: true, normalized: '12345678-0001' });
    expect(validateTin('2345678901')).toMatchObject({ valid: true, format: 'JTB' });
    expect(validateTin('1234567890123')).toMatchObject({ valid: true, format: 'NRS_13' });
  });
  it('rejects missing, malformed and repeated-digit TINs', () => {
    expect(validateTin('').valid).toBe(false);
    expect(validateTin('12345').valid).toBe(false);
    expect(validateTin('0000000000').valid).toBe(false);
    expect(normalizeTin(' 1234 5678 9012 ')).toBe('12345678-9012');
  });
});

describe('tax year config', () => {
  it('falls back to the nearest earlier year', () => {
    expect(getTaxYearConfig(2026).year).toBe(2026);
    expect(getTaxYearConfig(2030).year).toBe(2026);
    expect(getTaxYearConfig(2010).year).toBe(2025);
  });
  it('computes due dates in the following month', () => {
    expect(dueDateForPeriod('2026-10', 21)).toBe('2026-11-21');
    expect(dueDateForPeriod('2026-12', 21)).toBe('2027-01-21');
  });
});

// ─── Phase 2: classification ─────────────────────────────────────────────────

describe('classifier', () => {
  it('classifies common Nigerian narrations', () => {
    expect(classifyTransaction({ narration: 'NIP/STAFF SALARY OCT', direction: 'OUTFLOW' })).toMatchObject({
      citCategory: 'SALARY_PAYE', vatTreatment: 'OUT_OF_SCOPE', source: 'RULE',
    });
    expect(classifyTransaction({ narration: 'TRF/Office rent Q4 Lekki', direction: 'OUTFLOW' })).toMatchObject({
      citCategory: 'RENT_EXPENSE', whtCategoryId: 'rent',
    });
    expect(classifyTransaction({ narration: 'PAYSTACK SETTLEMENT 0012', direction: 'INFLOW' })).toMatchObject({
      citCategory: 'SALES_REVENUE', vatTreatment: 'STANDARD',
    });
    expect(classifyTransaction({ narration: 'LIRS PAYE REMITTANCE', direction: 'OUTFLOW' }).citCategory).toBe('TAX_PAYMENT');
    expect(classifyTransaction({ narration: 'Air Peace flight ABV', direction: 'OUTFLOW' }).vatTreatment).toBe('EXEMPT');
  });
  it('does not mistake ordinary words for tax agencies', () => {
    expect(classifyTransaction({ narration: 'Stairs repair materials', direction: 'OUTFLOW' }).citCategory).not.toBe('TAX_PAYMENT');
  });
  it('falls back to a low-confidence default that needs review', () => {
    const r = classifyTransaction({ narration: 'TRF FROM CHIOMA', direction: 'INFLOW' });
    expect(r.source).toBe('DEFAULT');
    expect(r.confidence).toBeLessThan(REVIEW_THRESHOLD);
  });
  it('prefers counterparty memory over rules', () => {
    const key = counterpartyKey('Bisi Cleaning Services', '');
    const r = classifyTransaction(
      { narration: 'anything', direction: 'OUTFLOW', counterpartyName: 'Bisi Cleaning Services' },
      { [key]: { citCategory: 'OPERATING_EXPENSE', vatTreatment: 'STANDARD', whtCategoryId: 'technical-fees', payeeType: 'individual', updatedAt: '' } },
    );
    expect(r).toMatchObject({ source: 'COUNTERPARTY_MEMORY', whtCategoryId: 'technical-fees', payeeType: 'individual' });
  });
  it('builds stable counterparty keys from noisy narrations', () => {
    expect(counterpartyKey(undefined, 'NIP/TRF/0123456/ACME SUPPLIES LTD')).toBe('acme supplies');
  });
});

describe('ledger operations', () => {
  it('derives VAT and WHT figures on build', () => {
    const tx = buildTransaction(input({ narration: 'Audit fee - KPMG', amountKobo: nairaToKobo(107_500) }));
    expect(tx.vatTreatment).toBe('STANDARD');
    expect(tx.vatKobo).toBe(nairaToKobo(7_500));
    expect(tx.netKobo).toBe(nairaToKobo(100_000));
    expect(tx.whtRateBps).toBe(1000); // professional fees, company payee
    expect(tx.whtKobo).toBe(nairaToKobo(10_000));
    expect(tx.taxPeriod).toBe('2026-10');
  });
  it('never applies WHT to inflows', () => {
    const tx = buildTransaction(input({ direction: 'INFLOW', narration: 'Consultancy invoice 22' }));
    const patched = applyPatch(tx, { whtCategoryId: 'professional-fees' });
    expect(patched.whtKobo).toBe(0);
    expect(patched.whtCategoryId).toBeNull();
  });
  it('marks user edits as reviewed and recomputes', () => {
    const tx = buildTransaction(input({ narration: 'Mystery vendor' }));
    const patched = applyPatch(tx, { vatTreatment: 'EXEMPT' });
    expect(patched.classification).toMatchObject({ source: 'USER', confidence: 1 });
    expect(patched.classification.reviewedAt).not.toBeNull();
    expect(patched.vatKobo).toBe(0);
    expect(confirmTransaction(tx).classification.reviewedAt).not.toBeNull();
  });
  it('remembers counterparty corrections for future imports', () => {
    const tx = applyPatch(buildTransaction(input({ counterpartyName: 'Tunde Logistics' })), { citCategory: 'OPERATING_EXPENSE', whtCategoryId: 'commission' });
    const memory = rememberCounterparty({}, tx);
    const next = buildTransaction(input({ counterpartyName: 'Tunde Logistics', narration: 'x' }), memory);
    expect(next.classification.source).toBe('COUNTERPARTY_MEMORY');
    expect(next.whtCategoryId).toBe('commission');
  });
  it('merges idempotently and respects filed-period locks', () => {
    const a = buildTransaction(input({ sourceRef: 'ref-1', date: '2026-09-02' }));
    const b = buildTransaction(input({ sourceRef: 'ref-2', date: '2026-10-02' }));
    const first = mergeTransactions({}, [a, b]);
    expect(first.added).toBe(2);
    const again = mergeTransactions(first.periods, [buildTransaction(input({ sourceRef: 'ref-1', date: '2026-09-02' }))]);
    expect(again).toMatchObject({ added: 0, duplicates: 1 });

    let sep = transitionPeriod(first.periods['2026-09'], 'REVIEWED');
    sep = transitionPeriod(sep, 'FILED', 'ACK-123');
    const locked = mergeTransactions({ ...first.periods, '2026-09': sep }, [buildTransaction(input({ sourceRef: 'ref-3', date: '2026-09-10' }))]);
    expect(locked).toMatchObject({ added: 0, locked: 1 });
  });
  it('enforces the filing lifecycle', () => {
    const p = emptyPeriod('2026-10');
    expect(() => transitionPeriod(p, 'FILED')).toThrow();
    const filed = transitionPeriod(transitionPeriod(p, 'REVIEWED'), 'FILED', 'ACK-9');
    expect(filed.meta).toMatchObject({ status: 'FILED', filingRef: 'ACK-9' });
    const amending = transitionPeriod(filed, 'AMENDING');
    expect(amending.meta.amendmentCount).toBe(1);
    expect(amending.audit[0].action).toBe('STATUS_CHANGE');
  });
});

describe('importers', () => {
  it('parses quoted CSV fields', () => {
    expect(parseCsv('a,"b,c","d ""q"""\r\n1,2,3')).toEqual([['a', 'b,c', 'd "q"'], ['1', '2', '3']]);
  });
  it('parses Nigerian statement dates day-first', () => {
    expect(parseStatementDate('05/10/2026')).toBe('2026-10-05');
    expect(parseStatementDate('05-Oct-2026')).toBe('2026-10-05');
    expect(parseStatementDate('5 October 2026')).toBe('2026-10-05');
    expect(parseStatementDate('Oct 5, 2026')).toBe('2026-10-05');
    expect(parseStatementDate('2026-10-05 14:22')).toBe('2026-10-05');
    expect(parseStatementDate('31/02/2026')).toBeNull();
  });
  it('imports a debit/credit statement with a preamble', () => {
    const csv = [
      'Account Name,ACME LTD',
      'Account Number,0123456789',
      '',
      'Trans Date,Reference,Narration,Debit,Credit,Balance',
      '01/10/2026,FT001,PAYSTACK SETTLEMENT,,"215,000.00","1,000,000.00"',
      '03/10/2026,FT002,NIP/OFFICE RENT,"500,000.00",,"500,000.00"',
      'Closing Balance,,,,,500000',
    ].join('\n');
    const res = importBankCsv(csv, 'gtb.csv');
    expect(res.transactions).toHaveLength(2);
    expect(res.transactions[0]).toMatchObject({ direction: 'INFLOW', amountKobo: nairaToKobo(215_000), sourceRef: 'FT001', date: '2026-10-01' });
    expect(res.transactions[1]).toMatchObject({ direction: 'OUTFLOW', amountKobo: nairaToKobo(500_000) });
  });
  it('imports a signed single-amount statement and reports bad rows', () => {
    const csv = 'Date,Description,Amount\n2026-10-01,Sale,1000\n2026-10-02,Fuel,-500\nnot-a-date,x,1';
    const res = importBankCsv(csv);
    expect(res.transactions.map((t) => t.direction)).toEqual(['INFLOW', 'OUTFLOW']);
    expect(res.errors).toHaveLength(1);
  });
  it('rejects files with no recognisable header', () => {
    expect(importBankCsv('foo,bar\n1,2').transactions).toHaveLength(0);
  });
  it('converts Smart Vault and Mono items', () => {
    const sv = importSmartVault([{ id: 's1', merchant: 'IKEDC', category: 'Utilities / Power', date: 'Oct 5, 2026', amount: 35000, isDeductible: true }]);
    expect(sv.transactions[0]).toMatchObject({ date: '2026-10-05', amountKobo: 3_500_000, direction: 'OUTFLOW', sourceRef: 's1' });
    expect(importMonoItem({ _id: 'm1', amount: 5000, date: '2026-10-07T10:00:00Z', narration: 'x', type: 'credit' }))
      .toMatchObject({ source: 'MONO', direction: 'INFLOW', amountKobo: 500_000, date: '2026-10-07' });
  });
});

// ─── Phases 3 & 4: compliance and schedules ──────────────────────────────────

const sale = buildTransaction(input({ direction: 'INFLOW', narration: 'Invoice 101 payment', amountKobo: nairaToKobo(1_075_000), counterpartyName: 'Client A', counterpartyTin: '12345678-0001', invoiceRef: 'INV-101' }));
const purchaseWithTin = buildTransaction(input({ narration: 'Laptop purchase', amountKobo: nairaToKobo(537_500), counterpartyName: 'Slot Ltd', counterpartyTin: '2345678901' }));
const purchaseNoTin = buildTransaction(input({ narration: 'MTN data bundle', amountKobo: nairaToKobo(21_500) }));
const consultancy = buildTransaction(input({ narration: 'Legal fee retainer', amountKobo: nairaToKobo(107_500), counterpartyName: 'Ade & Co' }));
const ledger = [sale, purchaseWithTin, purchaseNoTin, consultancy];

describe('compliance', () => {
  const facts = { isVatRegistered: true, accountType: 'business' as const };
  it('flags missing TINs, proofs and WHT credit notes', () => {
    const report = runCompliance(ledger, ledger, 2026, facts);
    const codes = report.issues.map((i) => i.code);
    expect(codes).toContain('INPUT_VAT_NO_TIN');
    expect(codes).toContain('WHT_NO_PAYEE_TIN');
    expect(codes).toContain('WHT_NO_CREDIT_NOTE');
    expect(codes).toContain('MISSING_PROOF');
    expect(codes).toContain('THRESHOLDS_UNVERIFIED');
    expect(report.score).toBeGreaterThanOrEqual(0);
    expect(report.score).toBeLessThan(100);
  });
  it('flags invalid TINs as errors', () => {
    const bad = applyPatch(purchaseWithTin, { counterpartyTin: '123' });
    const report = runCompliance([bad], [bad], 2026, facts);
    expect(report.issues.find((i) => i.code === 'INVALID_TIN')?.severity).toBe('error');
  });
  it('detects possible duplicates', () => {
    const dup = { ...purchaseNoTin, id: 'dup', sourceRef: 'other' };
    expect(runCompliance([purchaseNoTin, dup], [], 2026, facts).issues.some((i) => i.code === 'POSSIBLE_DUPLICATE')).toBe(true);
  });
  it('requires VAT registration above the threshold', () => {
    const big = buildTransaction(input({ direction: 'INFLOW', narration: 'Paystack settlement', amountKobo: nairaToKobo(150_000_000) }));
    const report = runCompliance([big], [big], 2026, { isVatRegistered: false, accountType: 'business' });
    expect(report.issues.some((i) => i.code === 'VAT_REGISTRATION_REQUIRED')).toBe(true);
    expect(report.isSmallCompany).toBe(false);
    expect(annualTurnoverKobo([big], 2025)).toBe(0);
  });
});

describe('schedules', () => {
  it('builds the VAT return with claimable input VAT only', () => {
    const vat = buildVatReturn('2026-10', ledger);
    expect(vat.scheduleA).toHaveLength(1);
    expect(vat.outputVatKobo).toBe(nairaToKobo(75_000));
    // laptop (₦37,500 VAT, TIN) claimable; MTN (₦1,500) and legal fee (₦7,500) lack TINs
    expect(vat.inputVatClaimableKobo).toBe(nairaToKobo(37_500));
    expect(vat.inputVatUnsupportedKobo).toBe(nairaToKobo(9_000));
    expect(vat.netVatKobo).toBe(nairaToKobo(37_500));
    expect(vat.dueDate).toBe('2026-11-21');
  });
  it('builds the WHT schedule', () => {
    const wht = buildWhtSchedule('2026-10', ledger);
    expect(wht.rows).toHaveLength(1);
    expect(wht.totalWhtKobo).toBe(nairaToKobo(10_000));
    expect(wht.byPaymentType[0].paymentType).toBe('Professional / Consultancy Fees');
  });
  it('builds a CIT summary on VAT-exclusive figures', () => {
    const cit = buildCitSummary(2026, ledger);
    expect(cit.turnoverKobo).toBe(nairaToKobo(1_000_000));
    expect(cit.capexKobo).toBe(nairaToKobo(500_000));
    expect(cit.allowableExpensesKobo).toBe(nairaToKobo(20_000 + 100_000));
    expect(cit.isSmallCompany).toBe(true);
    expect(cit.estimate.citRate).toBe(0);
  });
  it('exports CSV with numbering, escaping and formula-injection guard', () => {
    const vat = buildVatReturn('2026-10', [applyPatch(sale, { narration: '=HYPERLINK("x"), "quoted"' })]);
    const csv = toCsv(VAT_SCHEDULE_A_DRAFT, vat.scheduleA);
    const [header, row] = csv.split('\r\n');
    expect(header.startsWith('S/N,Transaction Date')).toBe(true);
    expect(row.startsWith('1,2026-10-05,Client A,12345678-0001,INV-101,')).toBe(true);
    expect(row).toContain(`"'=HYPERLINK(""x""), ""quoted"""`);
    expect(row.endsWith('1000000.00,75000.00,1075000.00')).toBe(true);
    expect(toCsv(WHT_SCHEDULE_DRAFT, buildWhtSchedule('2026-10', ledger).rows)).toContain('10.00,10000.00');
  });
});


/**
 * taxEngine.ts — Nigerian Tax Calculation Engine
 *
 * Single source of truth for:
 *  - Personal Income Tax (PIT) progressive band computation
 *  - Consolidated Relief Allowance (CRA) formula
 *  - PAYE payslip generation for employees
 *  - Gateway savings estimator
 *
 * References:
 *  - Personal Income Tax Act (PITA) as amended
 *  - Finance Act 2023
 *  - National Pension Commission (PenCom) guidelines
 */

import { TaxCalculationResult, PayslipResult, Employee } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

/** Nigerian VAT rate (7.5%) */
export const VAT_RATE = 0.075;

/** Standard employee pension contribution rate (8%) */
export const PENSION_RATE = 0.08;

/** NHF contribution rate (2.5%) */
export const NHF_RATE = 0.025;

/** Flat annual NHIS estimate */
export const NHIS_ANNUAL_FLAT = 60000;

/** CRA flat base (₦200,000) */
export const CRA_FLAT_BASE = 200000;

/** CRA percentage component (20% of gross) */
export const CRA_PERCENT = 0.20;

/** Minimum tax rate (1% of gross) */
export const MINIMUM_TAX_RATE = 0.01;

/** Nigerian PIT progressive tax bands */
export const TAX_BANDS = [
  { band: 'First ₦300,000', limit: 300000, rate: 0.07 },
  { band: 'Next ₦300,000', limit: 300000, rate: 0.11 },
  { band: 'Next ₦500,000', limit: 500000, rate: 0.15 },
  { band: 'Next ₦500,000', limit: 500000, rate: 0.19 },
  { band: 'Next ₦1,600,000', limit: 1600000, rate: 0.21 },
  { band: 'Above ₦3,200,000', limit: Infinity, rate: 0.24 },
] as const;

/** Standard deduction amounts for the PIT calculator toggles */
export const DEDUCTION_AMOUNTS = {
  vpc: 150000,
  lifeAssurance: 100000,
  nhf: 80000,
  nhis: 50000,
  charity: 120000,
  children: 100000,       // ₦25k per child × up to 4 children
  dependantRelative: 40000, // ₦20k per dependant × up to 2
  disabled: 60000,
  mortgageInterest: 180000,
  bondExempt: 150000,
} as const;

// ─── CRA Formula ─────────────────────────────────────────────────────────────

/**
 * Calculates the Consolidated Relief Allowance (CRA).
 * Formula: max(₦200,000, 1% of gross) + 20% of gross
 */
export function calculateCRA(grossAnnual: number): number {
  const percentBase = grossAnnual * 0.01;
  const higherBase = Math.max(CRA_FLAT_BASE, percentBase);
  return higherBase + (grossAnnual * CRA_PERCENT);
}

// ─── Progressive Band Calculator ─────────────────────────────────────────────

/**
 * Applies Nigerian PIT progressive tax bands to a given taxable income.
 * Returns annual tax and per-band breakdown.
 */
export function applyProgressiveBands(taxableIncome: number): {
  annualTax: number;
  bandBreakdown: { band: string; rate: number; taxableInBand: number; taxInBand: number }[];
} {
  let remaining = taxableIncome;
  let annualTax = 0;
  const bandBreakdown: { band: string; rate: number; taxableInBand: number; taxInBand: number }[] = [];

  for (const b of TAX_BANDS) {
    if (remaining <= 0) break;
    const taxableInBand = Math.min(remaining, b.limit);
    const taxInBand = taxableInBand * b.rate;
    annualTax += taxInBand;
    remaining -= taxableInBand;

    bandBreakdown.push({
      band: b.band,
      rate: b.rate * 100,
      taxableInBand,
      taxInBand,
    });
  }

  return { annualTax, bandBreakdown };
}

// ─── PIT Calculator ──────────────────────────────────────────────────────────

/** Configuration for optional deduction toggles in the PIT calculator */
export interface PITDeductionConfig {
  pensionRate: number; // e.g. 8
  vpc: boolean;
  lifeAssurance: boolean;
  nhf: boolean;
  nhis: boolean;
  charity: boolean;
  children: boolean;
  dependantRelative: boolean;
  disabled: boolean;
  mortgageInterest: boolean;
  bondExempt: boolean;
}

/**
 * Full Personal Income Tax calculation with CRA, pension, optional deductions,
 * progressive bands, and minimum tax check.
 */
export function calculatePIT(
  grossAnnual: number,
  deductions: PITDeductionConfig
): TaxCalculationResult {
  const grossMonthly = grossAnnual / 12;
  const pensionContribution = grossAnnual * (deductions.pensionRate / 100);
  const craRelief = calculateCRA(grossAnnual);

  // Sum all deductions
  let totalDeductions = pensionContribution + craRelief;
  if (deductions.vpc) totalDeductions += DEDUCTION_AMOUNTS.vpc;
  if (deductions.lifeAssurance) totalDeductions += DEDUCTION_AMOUNTS.lifeAssurance;
  if (deductions.nhf) totalDeductions += DEDUCTION_AMOUNTS.nhf;
  if (deductions.nhis) totalDeductions += DEDUCTION_AMOUNTS.nhis;
  if (deductions.charity) totalDeductions += DEDUCTION_AMOUNTS.charity;
  if (deductions.children) totalDeductions += DEDUCTION_AMOUNTS.children;
  if (deductions.dependantRelative) totalDeductions += DEDUCTION_AMOUNTS.dependantRelative;
  if (deductions.disabled) totalDeductions += DEDUCTION_AMOUNTS.disabled;
  if (deductions.mortgageInterest) totalDeductions += DEDUCTION_AMOUNTS.mortgageInterest;
  if (deductions.bondExempt) totalDeductions += DEDUCTION_AMOUNTS.bondExempt;

  const taxableIncome = Math.max(0, grossAnnual - totalDeductions);
  const { annualTax, bandBreakdown } = applyProgressiveBands(taxableIncome);

  const monthlyTax = annualTax / 12;
  const monthlyPension = pensionContribution / 12;
  const monthlyNet = grossMonthly - monthlyTax - monthlyPension;
  const effectiveTaxRate = grossAnnual > 0 ? (annualTax / grossAnnual) * 100 : 0;

  return {
    grossAnnual,
    grossMonthly,
    craRelief,
    pensionDeduction: pensionContribution,
    taxableIncome,
    annualTax,
    monthlyTax,
    monthlyNet,
    effectiveTaxRate,
    bandBreakdown,
  };
}

// ─── PAYE Payslip Calculator ─────────────────────────────────────────────────

/**
 * Calculates a full monthly payslip for an employee including
 * statutory deductions (pension, NHF, NHIS), CRA, progressive PAYE,
 * and minimum tax check.
 */
export function calculatePayslip(emp: Employee): PayslipResult {
  const grossAnnual = emp.grossMonthlySalary * 12;

  // Statutory Deductions
  const annualPension = emp.optInPension ? grossAnnual * PENSION_RATE : 0;
  const annualNHF = emp.optInNHF ? grossAnnual * NHF_RATE : 0;
  const annualNHIS = emp.optInNHIS ? NHIS_ANNUAL_FLAT : 0;

  // CRA
  const cra = calculateCRA(grossAnnual);

  // Taxable Income
  const taxExemptions = annualPension + annualNHF + annualNHIS + cra;
  const taxableIncome = Math.max(0, grossAnnual - taxExemptions);

  // Apply progressive bands
  let { annualTax: annualPaye } = applyProgressiveBands(taxableIncome);

  // Minimum tax check (1% of gross)
  const minimumTax = grossAnnual * MINIMUM_TAX_RATE;
  if (annualPaye < minimumTax) {
    annualPaye = minimumTax;
  }

  const monthlyPaye = annualPaye / 12;
  const monthlyPension = annualPension / 12;
  const monthlyNHF = annualNHF / 12;
  const monthlyNHIS = annualNHIS / 12;
  const netPay = emp.grossMonthlySalary - (monthlyPaye + monthlyPension + monthlyNHF + monthlyNHIS);

  return {
    employeeId: emp.id,
    gross: emp.grossMonthlySalary,
    pension: monthlyPension,
    nhf: monthlyNHF,
    nhis: monthlyNHIS,
    cra: cra / 12,
    taxableIncome: taxableIncome / 12,
    paye: monthlyPaye,
    netPay,
  };
}

// ─── Gateway Savings Estimator ───────────────────────────────────────────────

export interface SavingsEstimate {
  standardMonthly: number;
  optimizedMonthly: number;
  monthlySavings: number;
  annualSavings: number;
}

/**
 * Quick savings estimate for the Gateway landing page slider.
 * Compares a standard flat PIT rate vs. an optimized rate
 * using CRA + pension + life assurance deductions.
 */
export function estimateSavings(monthlyIncome: number): SavingsEstimate {
  const annualGross = monthlyIncome * 12;
  // Standard basic tax rate (approx 12.5% for individual PIT)
  const standardAnnualTax = annualGross * 0.125;
  // Optimized PIT with DIYtax9ja reliefs (approx effective rate ~7.2%)
  const optimizedAnnualTax = annualGross * 0.072;
  const annualSavings = Math.max(0, standardAnnualTax - optimizedAnnualTax);

  return {
    standardMonthly: standardAnnualTax / 12,
    optimizedMonthly: optimizedAnnualTax / 12,
    monthlySavings: annualSavings / 12,
    annualSavings,
  };
}

// ─── Naira Formatting Utility ────────────────────────────────────────────────

/** Formats a number as Naira currency string */
export function formatNaira(amount: number, decimals: number = 0): string {
  return '₦' + amount.toLocaleString('en-NG', { maximumFractionDigits: decimals });
}

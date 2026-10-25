/**
 * taxEngine.ts — Nigerian Tax Calculation Engine
 *
 * Single source of truth for:
 *  - Personal Income Tax (PIT) progressive band computation
 *  - Rent relief (replaces the Consolidated Relief Allowance from 2026)
 *  - PAYE payslip generation for employees
 *  - Gateway savings estimator
 *
 * References:
 *  - Nigeria Tax Act (NTA) 2025, effective 1 January 2026 — PIT bands,
 *    rent relief, abolition of CRA and of the individual minimum tax
 *  - Personal Income Tax Act (PITA) as amended (pre-2026, superseded)
 *  - National Pension Commission (PenCom) guidelines
 */

import { TaxCalculationResult, PayslipResult, Employee } from '../types';
import { RENT_RELIEF_RATE, RENT_RELIEF_CAP, estimateRentRelief } from '../registration/catalog';

export { RENT_RELIEF_RATE, RENT_RELIEF_CAP };

// ─── Constants ───────────────────────────────────────────────────────────────

/** Nigerian VAT rate (7.5%) */
export const VAT_RATE = 0.075;

/** Standard employee pension contribution rate (8%) */
export const PENSION_RATE = 0.08;

/** NHF contribution rate (2.5%) */
export const NHF_RATE = 0.025;

/** Flat annual NHIS estimate */
export const NHIS_ANNUAL_FLAT = 60000;

/**
 * @deprecated CRA was abolished by the Nigeria Tax Act 2025 (from 1 Jan 2026).
 * Kept only so historic (pre-2026) computations can still reference it.
 */
export const CRA_FLAT_BASE = 200000;

/** @deprecated See CRA_FLAT_BASE. */
export const CRA_PERCENT = 0.20;

/**
 * @deprecated The 1% individual minimum tax was removed by the NTA 2025.
 * Not applied by calculatePIT / calculatePayslip.
 */
export const MINIMUM_TAX_RATE = 0.01;

/** Nigerian PIT progressive tax bands — NTA 2025 (annual chargeable income) */
export const TAX_BANDS = [
  { band: 'First ₦800,000', limit: 800_000, rate: 0 },
  { band: 'Next ₦2,200,000', limit: 2_200_000, rate: 0.15 },
  { band: 'Next ₦9,000,000', limit: 9_000_000, rate: 0.18 },
  { band: 'Next ₦13,000,000', limit: 13_000_000, rate: 0.21 },
  { band: 'Next ₦25,000,000', limit: 25_000_000, rate: 0.23 },
  { band: 'Above ₦50,000,000', limit: Infinity, rate: 0.25 },
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

// ─── Rent Relief (NTA 2025) ──────────────────────────────────────────────────

/**
 * Rent relief: 20% of annual rent actually paid, capped at ₦500,000.
 * Replaces CRA from 1 January 2026.
 */
export function calculateRentRelief(annualRent: number): number {
  return estimateRentRelief(annualRent || 0);
}

// ─── CRA Formula (legacy) ────────────────────────────────────────────────────

/**
 * Calculates the Consolidated Relief Allowance (CRA).
 * Formula: max(₦200,000, 1% of gross) + 20% of gross
 * @deprecated Abolished by the NTA 2025; not used by current computations.
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
  /** Annual rent paid (₦) — drives the NTA 2025 rent relief. Optional. */
  annualRent?: number;
  vpc: boolean;
  lifeAssurance: boolean;
  nhf: boolean;
  nhis: boolean;
  charity: boolean;
  /** @deprecated Pre-2026 PITA allowance; not a relief under the NTA 2025. */
  children: boolean;
  /** @deprecated Pre-2026 PITA allowance; not a relief under the NTA 2025. */
  dependantRelative: boolean;
  /** @deprecated Pre-2026 PITA allowance; not a relief under the NTA 2025. */
  disabled: boolean;
  mortgageInterest: boolean;
  bondExempt: boolean;
}

/**
 * Full Personal Income Tax calculation (NTA 2025) with rent relief, pension,
 * optional deductions and progressive bands. No CRA and no minimum tax.
 *
 * Note: the result field `craRelief` is retained for API compatibility and
 * now carries the rent relief amount.
 */
export function calculatePIT(
  grossAnnual: number,
  deductions: PITDeductionConfig
): TaxCalculationResult {
  const grossMonthly = grossAnnual / 12;
  const pensionContribution = grossAnnual * (deductions.pensionRate / 100);
  const craRelief = calculateRentRelief(deductions.annualRent ?? 0);

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
 * statutory deductions (pension, NHF, NHIS), rent relief (when the
 * employee's annual rent is known) and NTA 2025 progressive PAYE.
 * The `cra` field on the result now carries the monthly rent relief.
 */
export function calculatePayslip(emp: Employee): PayslipResult {
  const grossAnnual = emp.grossMonthlySalary * 12;

  // Statutory Deductions
  const annualPension = emp.optInPension ? grossAnnual * PENSION_RATE : 0;
  const annualNHF = emp.optInNHF ? grossAnnual * NHF_RATE : 0;
  const annualNHIS = emp.optInNHIS ? NHIS_ANNUAL_FLAT : 0;

  // Rent relief (replaces CRA from 2026)
  const cra = calculateRentRelief(emp.annualRent ?? 0);

  // Taxable Income
  const taxExemptions = annualPension + annualNHF + annualNHIS + cra;
  const taxableIncome = Math.max(0, grossAnnual - taxExemptions);

  // Apply progressive bands (no minimum tax under the NTA 2025)
  const { annualTax: annualPaye } = applyProgressiveBands(taxableIncome);

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
 * Compares NTA 2025 PIT with no reliefs claimed vs. PIT after typical
 * reliefs (8% pension, NHF, NHIS and rent relief on rent ≈ 20% of income).
 */
export function estimateSavings(monthlyIncome: number): SavingsEstimate {
  const annualGross = Math.max(0, monthlyIncome * 12);
  const standardAnnualTax = applyProgressiveBands(annualGross).annualTax;
  const reliefs =
    annualGross * PENSION_RATE +
    annualGross * NHF_RATE +
    NHIS_ANNUAL_FLAT +
    calculateRentRelief(annualGross * 0.2);
  const optimizedAnnualTax = applyProgressiveBands(Math.max(0, annualGross - reliefs)).annualTax;
  const annualSavings = Math.max(0, standardAnnualTax - optimizedAnnualTax);

  return {
    standardMonthly: standardAnnualTax / 12,
    optimizedMonthly: optimizedAnnualTax / 12,
    monthlySavings: annualSavings / 12,
    annualSavings,
  };
}

// ─── Stamp Duty Calculator ───────────────────────────────────────────────────

export interface StampDutyCategory {
  id: string;
  label: string;
  description: string;
  rateType: 'flat' | 'adValorem';
  flatAmount?: number;
  adValoremRate?: number;
  threshold?: number;
}

export const STAMP_DUTY_CATEGORIES: StampDutyCategory[] = [
  {
    id: 'bank-deposit',
    label: 'Electronic Bank Deposits',
    description: 'Deposits ≥ ₦10,000 into any bank account',
    rateType: 'flat',
    flatAmount: 50,
    threshold: 10000,
  },
  {
    id: 'lease',
    label: 'Lease / Tenancy Agreement',
    description: 'Rental or lease agreements for property',
    rateType: 'adValorem',
    adValoremRate: 0.0078, // ₦1.56 per ₦200 ≈ 0.78%
  },
  {
    id: 'share-transfer',
    label: 'Share / Stock Transfer',
    description: 'Transfer of shares and stock certificates',
    rateType: 'adValorem',
    adValoremRate: 0.00375, // 75 kobo per ₦200 ≈ 0.375%
  },
  {
    id: 'mortgage-deed',
    label: 'Mortgage / Deed of Assignment',
    description: 'Mortgage documents and property deeds',
    rateType: 'adValorem',
    adValoremRate: 0.0075, // ₦1.50 per ₦200 ≈ 0.75%
  },
  {
    id: 'insurance-policy',
    label: 'Insurance Policy',
    description: 'Life and general insurance policies',
    rateType: 'adValorem',
    adValoremRate: 0.005, // 0.5%
  },
  {
    id: 'power-of-attorney',
    label: 'Power of Attorney',
    description: 'Legal power of attorney documents',
    rateType: 'flat',
    flatAmount: 500,
  },
  {
    id: 'contract-agreement',
    label: 'Contract / Agreement',
    description: 'Commercial contracts and service agreements',
    rateType: 'adValorem',
    adValoremRate: 0.0075, // ₦1.50 per ₦200 ≈ 0.75%
  },
  {
    id: 'receipt',
    label: 'Receipt (above ₦4)',
    description: 'Receipts for payments above ₦4',
    rateType: 'flat',
    flatAmount: 1,
  },
];

export interface StampDutyResult {
  category: string;
  instrumentValue: number;
  rateApplied: string;
  dutyAmount: number;
  isAboveThreshold: boolean;
}

/**
 * Calculate stamp duty for a given instrument category and value.
 */
export function calculateStampDuty(
  categoryId: string,
  instrumentValue: number
): StampDutyResult {
  const cat = STAMP_DUTY_CATEGORIES.find(c => c.id === categoryId);
  if (!cat) {
    return {
      category: 'Unknown',
      instrumentValue,
      rateApplied: 'N/A',
      dutyAmount: 0,
      isAboveThreshold: false,
    };
  }

  const isAboveThreshold = cat.threshold ? instrumentValue >= cat.threshold : true;

  let dutyAmount = 0;
  let rateApplied = '';

  if (!isAboveThreshold) {
    rateApplied = 'Below threshold — no duty';
    dutyAmount = 0;
  } else if (cat.rateType === 'flat') {
    dutyAmount = cat.flatAmount || 0;
    rateApplied = `Flat ₦${(cat.flatAmount || 0).toLocaleString()}`;
  } else {
    dutyAmount = Math.round(instrumentValue * (cat.adValoremRate || 0));
    rateApplied = `${((cat.adValoremRate || 0) * 100).toFixed(3)}% ad valorem`;
  }

  return {
    category: cat.label,
    instrumentValue,
    rateApplied,
    dutyAmount,
    isAboveThreshold,
  };
}

// ─── Capital Gains Tax (CGT) Calculator ──────────────────────────────────────

/** Nigerian CGT rate: flat 10% on chargeable gains */
export const CGT_RATE = 0.10;

export interface CGTInput {
  assetDescription: string;
  disposalProceeds: number;
  acquisitionCost: number;
  improvementCosts: number;
  legalFees: number;
  agentCommission: number;
  /** Whether asset is shares traded on NSE (exempt) */
  isNSEListed: boolean;
  /** Whether disposal is a gift between family members (exempt) */
  isFamilyGift: boolean;
}

export interface CGTResult {
  assetDescription: string;
  disposalProceeds: number;
  acquisitionCost: number;
  allowableExpenses: number;
  chargeableGain: number;
  isExempt: boolean;
  exemptionReason?: string;
  cgtRate: number;
  cgtLiability: number;
  netProceeds: number;
}

/**
 * Calculate Capital Gains Tax on disposal of a capital asset.
 */
export function calculateCGT(input: CGTInput): CGTResult {
  // Check exemptions
  if (input.isNSEListed) {
    return {
      assetDescription: input.assetDescription,
      disposalProceeds: input.disposalProceeds,
      acquisitionCost: input.acquisitionCost,
      allowableExpenses: 0,
      chargeableGain: 0,
      isExempt: true,
      exemptionReason: 'Shares listed on the Nigerian Stock Exchange are exempt from CGT (Finance Act 2021)',
      cgtRate: 0,
      cgtLiability: 0,
      netProceeds: input.disposalProceeds,
    };
  }

  if (input.isFamilyGift) {
    return {
      assetDescription: input.assetDescription,
      disposalProceeds: input.disposalProceeds,
      acquisitionCost: input.acquisitionCost,
      allowableExpenses: 0,
      chargeableGain: 0,
      isExempt: true,
      exemptionReason: 'Gifts between family members are exempt from CGT',
      cgtRate: 0,
      cgtLiability: 0,
      netProceeds: input.disposalProceeds,
    };
  }

  const allowableExpenses =
    input.improvementCosts + input.legalFees + input.agentCommission;

  const chargeableGain = Math.max(
    0,
    input.disposalProceeds - input.acquisitionCost - allowableExpenses
  );

  const cgtLiability = Math.round(chargeableGain * CGT_RATE);
  const netProceeds = input.disposalProceeds - cgtLiability;

  return {
    assetDescription: input.assetDescription,
    disposalProceeds: input.disposalProceeds,
    acquisitionCost: input.acquisitionCost,
    allowableExpenses,
    chargeableGain,
    isExempt: false,
    cgtRate: CGT_RATE,
    cgtLiability,
    netProceeds,
  };
}

// ─── Naira Formatting Utility ────────────────────────────────────────────────

/** Formats a number as Naira currency string */
export function formatNaira(amount: number, decimals: number = 0): string {
  return '₦' + amount.toLocaleString('en-NG', { maximumFractionDigits: decimals });
}

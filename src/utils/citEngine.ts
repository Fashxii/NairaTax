/**
 * citEngine.ts — Nigerian Company Income Tax (CIT) Calculation Engine
 *
 * Implements:
 *  - 3-tier CIT rates based on company turnover classification
 *  - Minimum tax calculation (0.5% of gross turnover)
 *  - Education Tax (EDT) at 2.5% of assessable profit
 *  - Capital allowance deduction support
 *
 * References:
 *  - Companies Income Tax Act (CITA) as amended
 *  - Finance Act 2023 / 2024
 *  - FIRS Guidelines on Company Classification
 */

// ─── Constants ───────────────────────────────────────────────────────────────

/** CIT Rate Tiers by Company Size */
export const CIT_TIERS = [
  {
    label: 'Small Company',
    description: 'Gross turnover ≤ ₦25 million',
    maxTurnover: 25_000_000,
    rate: 0,
    rateLabel: '0%',
  },
  {
    label: 'Medium Company',
    description: '₦25M < turnover ≤ ₦100 million',
    maxTurnover: 100_000_000,
    rate: 0.20,
    rateLabel: '20%',
  },
  {
    label: 'Large Company',
    description: 'Turnover > ₦100 million',
    maxTurnover: Infinity,
    rate: 0.30,
    rateLabel: '30%',
  },
] as const;

/** Minimum tax rate: 0.5% of gross turnover */
export const MINIMUM_TAX_RATE = 0.005;

/** Education Tax rate: 2.5% of assessable profit (for companies with turnover > ₦25M) */
export const EDT_RATE = 0.025;

/** Technology levy rate: 1% of profit before tax (for companies with turnover > ₦25M in telecom, ICT, finance, etc.) */
export const TECH_LEVY_RATE = 0.01;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CITInput {
  grossTurnover: number;
  totalRevenue: number;
  allowableExpenses: number;
  capitalAllowances: number;
  /** Losses brought forward from prior years */
  lossesCarriedForward: number;
  /** Whether the company operates in a tech-levy sector */
  isTechLevySector: boolean;
}

export interface CITResult {
  companyClassification: string;
  classificationDescription: string;
  citRate: number;
  citRateLabel: string;
  grossTurnover: number;
  totalRevenue: number;
  allowableExpenses: number;
  capitalAllowances: number;
  lossesCarriedForward: number;
  assessableProfit: number;
  totalProfitAfterLosses: number;
  citLiability: number;
  minimumTax: number;
  applicableTax: number;
  isMinimumTaxApplied: boolean;
  educationTax: number;
  techLevy: number;
  totalTaxPayable: number;
  effectiveRate: number;
}

// ─── CIT Calculation ─────────────────────────────────────────────────────────

/**
 * Determine company classification from gross turnover.
 */
export function classifyCompany(grossTurnover: number): typeof CIT_TIERS[number] {
  for (const tier of CIT_TIERS) {
    if (grossTurnover <= tier.maxTurnover) {
      return tier;
    }
  }
  return CIT_TIERS[CIT_TIERS.length - 1];
}

/**
 * Full CIT calculation including minimum tax, EDT, and tech levy.
 */
export function calculateCIT(input: CITInput): CITResult {
  const tier = classifyCompany(input.grossTurnover);

  // Assessable Profit = Revenue - Allowable Expenses - Capital Allowances
  const assessableProfit = Math.max(
    0,
    input.totalRevenue - input.allowableExpenses - input.capitalAllowances
  );

  // Total Profit after deducting losses carried forward
  const totalProfitAfterLosses = Math.max(0, assessableProfit - input.lossesCarriedForward);

  // CIT Liability at the applicable rate
  const citLiability = totalProfitAfterLosses * tier.rate;

  // Minimum Tax: 0.5% of gross turnover (small companies exempt)
  const minimumTax = tier.rate === 0 ? 0 : input.grossTurnover * MINIMUM_TAX_RATE;

  // Applicable CIT = max(CIT liability, minimum tax) — except small companies
  const isMinimumTaxApplied = tier.rate > 0 && citLiability < minimumTax;
  const applicableTax = tier.rate === 0 ? 0 : Math.max(citLiability, minimumTax);

  // Education Tax: 2.5% of assessable profit (medium + large companies only)
  const educationTax = tier.rate > 0 ? assessableProfit * EDT_RATE : 0;

  // Technology Levy: 1% of PBT (only for qualifying sectors with turnover > ₦25M)
  const techLevy = input.isTechLevySector && tier.rate > 0
    ? totalProfitAfterLosses * TECH_LEVY_RATE
    : 0;

  // Total Tax Payable
  const totalTaxPayable = applicableTax + educationTax + techLevy;

  // Effective rate as % of gross turnover
  const effectiveRate = input.grossTurnover > 0
    ? (totalTaxPayable / input.grossTurnover) * 100
    : 0;

  return {
    companyClassification: tier.label,
    classificationDescription: tier.description,
    citRate: tier.rate,
    citRateLabel: tier.rateLabel,
    grossTurnover: input.grossTurnover,
    totalRevenue: input.totalRevenue,
    allowableExpenses: input.allowableExpenses,
    capitalAllowances: input.capitalAllowances,
    lossesCarriedForward: input.lossesCarriedForward,
    assessableProfit,
    totalProfitAfterLosses,
    citLiability,
    minimumTax,
    applicableTax,
    isMinimumTaxApplied,
    educationTax,
    techLevy,
    totalTaxPayable,
    effectiveRate,
  };
}

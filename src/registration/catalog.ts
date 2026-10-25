/**
 * catalog.ts — Static option lists for the individual registration wizard.
 */

export interface Bank { code: string; name: string }

/** Major Nigerian commercial, non-interest & digital banks (CBN / NIP codes). */
export const BANKS: Bank[] = [
  { code: '044', name: 'Access Bank' },
  { code: '023', name: 'Citibank Nigeria' },
  { code: '050', name: 'Ecobank Nigeria' },
  { code: '070', name: 'Fidelity Bank' },
  { code: '011', name: 'First Bank of Nigeria' },
  { code: '214', name: 'First City Monument Bank (FCMB)' },
  { code: '00103', name: 'Globus Bank' },
  { code: '058', name: 'Guaranty Trust Bank (GTBank)' },
  { code: '301', name: 'Jaiz Bank' },
  { code: '082', name: 'Keystone Bank' },
  { code: '303', name: 'Lotus Bank' },
  { code: '526', name: 'Parallex Bank' },
  { code: '076', name: 'Polaris Bank' },
  { code: '105', name: 'PremiumTrust Bank' },
  { code: '101', name: 'Providus Bank' },
  { code: '221', name: 'Stanbic IBTC Bank' },
  { code: '068', name: 'Standard Chartered Bank' },
  { code: '232', name: 'Sterling Bank' },
  { code: '100', name: 'SunTrust Bank' },
  { code: '102', name: 'Titan Trust Bank' },
  { code: '032', name: 'Union Bank of Nigeria' },
  { code: '033', name: 'United Bank for Africa (UBA)' },
  { code: '215', name: 'Unity Bank' },
  { code: '035', name: 'Wema Bank' },
  { code: '057', name: 'Zenith Bank' },
  { code: '565', name: 'Carbon' },
  { code: '50211', name: 'Kuda Microfinance Bank' },
  { code: '50515', name: 'Moniepoint MFB' },
  { code: '999992', name: 'OPay' },
  { code: '999991', name: 'PalmPay' },
  { code: '566', name: 'VFD Microfinance Bank' },
];

/** Licensed Pension Fund Administrators (PenCom). */
export const PFAS: string[] = [
  'Access ARM Pensions',
  'CardinalStone Pensions',
  'Crusader Sterling Pensions',
  'FCMB Pensions',
  'Fidelity Pension Managers',
  'Guaranty Trust Pension Managers',
  'Leadway Pensure PFA',
  'NLPC Pension Fund Administrators',
  'Norrenberger Pensions',
  'NPF Pensions',
  'NUPEMCO',
  'OAK Pensions',
  'Pensions Alliance Limited (PAL)',
  'Premium Pension',
  'Radix Pension Managers',
  'Stanbic IBTC Pension Managers',
  'Tangerine APT Pensions',
  'Trustfund Pensions',
  'Veritas Glanvills Pensions',
  'Other',
];

export const INDUSTRIES: string[] = [
  'ICT / Software & Digital Services',
  'Professional Services (Legal, Accounting, Consulting)',
  'Creative, Media & Entertainment',
  'Trading / Retail',
  'Agriculture & Agro-processing',
  'Manufacturing',
  'Construction & Real Estate',
  'Transport & Logistics',
  'Hospitality & Food Services',
  'Health & Wellness',
  'Education & Training',
  'Fashion & Beauty',
  'Other',
];

export const INCOME_CATEGORY_IDS = ['paye', 'direct', 'digital', 'passive', 'unemployed'] as const;
export type IncomeCategory = (typeof INCOME_CATEGORY_IDS)[number];

export const INCOME_CATEGORIES: { id: IncomeCategory; label: string; hint: string }[] = [
  { id: 'paye', label: 'PAYE Earner', hint: 'Formal salary; tax deducted at source by employer' },
  { id: 'direct', label: 'Direct Assessment / Self-Employed', hint: 'Freelancer, sole proprietor, independent consultant' },
  { id: 'digital', label: 'Digital Asset / Tech Earner', hint: 'Foreign-currency contracts or remote earnings' },
  { id: 'passive', label: 'Passive / Investment Earner', hint: 'Rental income, dividends, capital returns' },
  { id: 'unemployed', label: 'Unemployed / Student', hint: 'Below the statutory tax-free threshold' },
];

/** Nigeria Tax Act 2025 rent relief: 20% of annual rent, capped at ₦500,000. */
export const RENT_RELIEF_RATE = 0.2;
export const RENT_RELIEF_CAP = 500_000;
export const estimateRentRelief = (annualRent: number) =>
  Math.min(Math.max(annualRent, 0) * RENT_RELIEF_RATE, RENT_RELIEF_CAP);

/**
 * nrs/taxYearConfig.ts — Statutory figures per tax year.
 *
 * Thresholds change with legislation, so they live here (keyed by year) rather
 * than being hard-coded in the engines. Entries marked `verified: false` MUST be
 * confirmed by the tax adviser before the app presents them as authoritative;
 * the UI shows a warning banner while any figure in use is unverified.
 *
 * To update after adviser sign-off: edit the figures, set `verified: true`,
 * fill `verifiedBy` / `verifiedOn`, and run `npm test`.
 */

import { nairaToKobo } from './money';

export interface TaxYearConfig {
  year: number;
  /** Standard VAT rate in basis points (750 = 7.5%). */
  vatRateBps: number;
  /** Turnover above which a business must register for and charge VAT. */
  vatRegistrationThresholdKobo: number;
  /** Turnover at or below which a company is "small" (0% CIT). */
  smallCompanyTurnoverThresholdKobo: number;
  /** Fixed-asset ceiling for small-company status, if the law sets one. */
  smallCompanyFixedAssetsThresholdKobo?: number;
  /** Day of the following month a monthly VAT return is due. */
  vatReturnDueDay: number;
  /** Day of the following month WHT deducted must be remitted. */
  whtRemittanceDueDay: number;
  /** Receipts at or above this amount should carry documentary proof. */
  proofRequiredAboveKobo: number;
  verified: boolean;
  verifiedBy?: string;
  verifiedOn?: string;
  legalBasis: string;
  notes: string[];
}

export const TAX_YEAR_CONFIGS: TaxYearConfig[] = [
  {
    year: 2025,
    vatRateBps: 750,
    vatRegistrationThresholdKobo: nairaToKobo(25_000_000),
    smallCompanyTurnoverThresholdKobo: nairaToKobo(25_000_000),
    vatReturnDueDay: 21,
    whtRemittanceDueDay: 21,
    proofRequiredAboveKobo: nairaToKobo(10_000),
    verified: false,
    legalBasis: 'CITA (as amended by Finance Acts 2019–2023); VAT Act (as amended)',
    notes: [
      'Matches the thresholds already used by citEngine.ts (small company ≤ ₦25m).',
    ],
  },
  {
    year: 2026,
    vatRateBps: 750,
    // PENDING ADVISER CONFIRMATION — Nigeria Tax Act 2025 reforms.
    vatRegistrationThresholdKobo: nairaToKobo(100_000_000),
    smallCompanyTurnoverThresholdKobo: nairaToKobo(100_000_000),
    smallCompanyFixedAssetsThresholdKobo: nairaToKobo(250_000_000),
    vatReturnDueDay: 21,
    whtRemittanceDueDay: 21,
    proofRequiredAboveKobo: nairaToKobo(10_000),
    verified: false,
    legalBasis: 'Nigeria Tax Act 2025; Nigeria Tax Administration Act 2025 (effective 1 Jan 2026)',
    notes: [
      'Small-company limits (≤ ₦100m turnover, ≤ ₦250m fixed assets) are as widely reported for NTA 2025 — confirm.',
      'VAT registration threshold assumed to align with the small-company limit — confirm.',
      'Due days assume the 21st of the following month — confirm against NTAA 2025.',
    ],
  },
];

/** Config for `year`, falling back to the latest earlier year (or the earliest known). */
export function getTaxYearConfig(year: number): TaxYearConfig {
  const sorted = [...TAX_YEAR_CONFIGS].sort((a, b) => a.year - b.year);
  let match = sorted[0];
  for (const cfg of sorted) {
    if (cfg.year <= year) match = cfg;
  }
  return match;
}

/** Due date (YYYY-MM-DD) for a monthly return/remittance of `period` (YYYY-MM). */
export function dueDateForPeriod(period: string, dueDay: number): string {
  const [y, m] = period.split('-').map(Number);
  const nextYear = m === 12 ? y + 1 : y;
  const nextMonth = m === 12 ? 1 : m + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
}


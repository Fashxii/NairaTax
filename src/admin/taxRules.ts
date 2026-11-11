/**
 * admin/taxRules.ts — Admin-managed overrides for statutory figures.
 *
 * Stored in Firestore `platform_config/tax_rules` (readable by everyone, since
 * every taxpayer's calculations depend on it; writable only with
 * `tax_rules.edit`). When loaded, the overrides are applied in place to the
 * engine tables (TAX_YEAR_CONFIGS and WHT_RATE_SCHEDULE), so every existing
 * consumer — NRS Returns, WHT Tracker, compliance checks — picks them up
 * without code changes. Calling applyTaxRules(null) restores the shipped defaults.
 */

import { TAX_YEAR_CONFIGS, type TaxYearConfig } from '../nrs/taxYearConfig';
import { WHT_RATE_SCHEDULE, type WHTRateEntry } from '../utils/whtEngine';

export type EditableTaxYear = Pick<
  TaxYearConfig,
  | 'vatRateBps'
  | 'vatRegistrationThresholdKobo'
  | 'smallCompanyTurnoverThresholdKobo'
  | 'smallCompanyFixedAssetsThresholdKobo'
  | 'vatReturnDueDay'
  | 'whtRemittanceDueDay'
  | 'proofRequiredAboveKobo'
  | 'verified'
  | 'verifiedBy'
  | 'verifiedOn'
  | 'legalBasis'
  | 'notes'
>;

export interface WhtRateOverride {
  companyRate: number;
  individualRate: number;
}

export interface TaxRulesDoc {
  taxYears: Record<string, Partial<EditableTaxYear>>;
  whtRates: Record<string, WhtRateOverride>;
  updatedAt?: string;
  updatedBy?: string;
}

// Snapshots of the shipped defaults, taken before any override is applied.
const DEFAULT_TAX_YEARS: TaxYearConfig[] = TAX_YEAR_CONFIGS.map((c) => ({ ...c, notes: [...c.notes] }));
const DEFAULT_WHT: WHTRateEntry[] = WHT_RATE_SCHEDULE.map((r) => ({ ...r }));

export function defaultTaxYears(): TaxYearConfig[] {
  return DEFAULT_TAX_YEARS.map((c) => ({ ...c, notes: [...c.notes] }));
}

export function defaultWhtRates(): WHTRateEntry[] {
  return DEFAULT_WHT.map((r) => ({ ...r }));
}

export function emptyTaxRules(): TaxRulesDoc {
  return { taxYears: {}, whtRates: {} };
}

const isNonNegInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v >= 0;
const isRate = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

/** Validate a tax-rules document; invalid fields are dropped rather than applied. */
export function normalizeTaxRules(raw: unknown): TaxRulesDoc {
  const out = emptyTaxRules();
  if (!raw || typeof raw !== 'object') return out;
  const r = raw as Partial<TaxRulesDoc>;

  if (r.taxYears && typeof r.taxYears === 'object') {
    for (const [year, cfg] of Object.entries(r.taxYears)) {
      if (!/^\d{4}$/.test(year) || !cfg || typeof cfg !== 'object') continue;
      const c = cfg as Partial<EditableTaxYear>;
      const clean: Partial<EditableTaxYear> = {};
      if (isNonNegInt(c.vatRateBps) && c.vatRateBps <= 10_000) clean.vatRateBps = c.vatRateBps;
      if (isNonNegInt(c.vatRegistrationThresholdKobo)) clean.vatRegistrationThresholdKobo = c.vatRegistrationThresholdKobo;
      if (isNonNegInt(c.smallCompanyTurnoverThresholdKobo)) clean.smallCompanyTurnoverThresholdKobo = c.smallCompanyTurnoverThresholdKobo;
      if (isNonNegInt(c.smallCompanyFixedAssetsThresholdKobo)) clean.smallCompanyFixedAssetsThresholdKobo = c.smallCompanyFixedAssetsThresholdKobo;
      if (isNonNegInt(c.vatReturnDueDay) && c.vatReturnDueDay >= 1 && c.vatReturnDueDay <= 28) clean.vatReturnDueDay = c.vatReturnDueDay;
      if (isNonNegInt(c.whtRemittanceDueDay) && c.whtRemittanceDueDay >= 1 && c.whtRemittanceDueDay <= 28) clean.whtRemittanceDueDay = c.whtRemittanceDueDay;
      if (isNonNegInt(c.proofRequiredAboveKobo)) clean.proofRequiredAboveKobo = c.proofRequiredAboveKobo;
      if (typeof c.verified === 'boolean') clean.verified = c.verified;
      if (typeof c.verifiedBy === 'string') clean.verifiedBy = c.verifiedBy.slice(0, 120);
      if (typeof c.verifiedOn === 'string') clean.verifiedOn = c.verifiedOn.slice(0, 10);
      if (typeof c.legalBasis === 'string') clean.legalBasis = c.legalBasis.slice(0, 300);
      if (Array.isArray(c.notes)) clean.notes = c.notes.filter((n): n is string => typeof n === 'string').slice(0, 10);
      out.taxYears[year] = clean;
    }
  }
  if (r.whtRates && typeof r.whtRates === 'object') {
    for (const [id, rate] of Object.entries(r.whtRates)) {
      if (!DEFAULT_WHT.some((d) => d.id === id) || !rate || typeof rate !== 'object') continue;
      const w = rate as Partial<WhtRateOverride>;
      if (isRate(w.companyRate) && isRate(w.individualRate)) {
        out.whtRates[id] = { companyRate: w.companyRate, individualRate: w.individualRate };
      }
    }
  }
  return { ...out, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
}

/**
 * Apply overrides to the live engine tables (in place, so existing imports see them).
 * Years not in the defaults are added, inheriting from the nearest earlier year.
 */
export function applyTaxRules(doc: TaxRulesDoc | null): void {
  // Reset to defaults first so removed overrides don't linger.
  TAX_YEAR_CONFIGS.splice(0, TAX_YEAR_CONFIGS.length, ...defaultTaxYears());
  WHT_RATE_SCHEDULE.forEach((entry, i) => Object.assign(entry, DEFAULT_WHT[i]));
  if (!doc) return;

  const years = Object.keys(doc.taxYears).map(Number).sort((a, b) => a - b);
  for (const year of years) {
    const override = doc.taxYears[String(year)];
    let target = TAX_YEAR_CONFIGS.find((c) => c.year === year);
    if (!target) {
      const base = [...TAX_YEAR_CONFIGS].sort((a, b) => a.year - b.year).filter((c) => c.year < year).pop() ?? TAX_YEAR_CONFIGS[0];
      target = { ...base, year, verified: false, verifiedBy: undefined, verifiedOn: undefined, notes: [...base.notes] };
      TAX_YEAR_CONFIGS.push(target);
    }
    Object.assign(target, override);
  }
  TAX_YEAR_CONFIGS.sort((a, b) => a.year - b.year);

  for (const entry of WHT_RATE_SCHEDULE) {
    const o = doc.whtRates[entry.id];
    if (o) Object.assign(entry, o);
  }
}

/** Overrides needed to turn the defaults into `edited` (only differing fields are stored). */
export function diffTaxYear(edited: TaxYearConfig): Partial<EditableTaxYear> {
  const def = DEFAULT_TAX_YEARS.find((c) => c.year === edited.year);
  const keys: (keyof EditableTaxYear)[] = [
    'vatRateBps', 'vatRegistrationThresholdKobo', 'smallCompanyTurnoverThresholdKobo',
    'smallCompanyFixedAssetsThresholdKobo', 'vatReturnDueDay', 'whtRemittanceDueDay',
    'proofRequiredAboveKobo', 'verified', 'verifiedBy', 'verifiedOn', 'legalBasis', 'notes',
  ];
  const out: Partial<EditableTaxYear> = {};
  for (const k of keys) {
    const a = edited[k];
    const b = def?.[k];
    if (JSON.stringify(a) !== JSON.stringify(b) && a !== undefined) {
      (out as Record<string, unknown>)[k] = a;
    }
  }
  return out;
}


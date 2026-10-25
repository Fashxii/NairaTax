/**
 * corporate/catalog.ts — Option lists and statutory rules for the
 * corporate (CIT / VAT) onboarding wizard.
 *
 * ⚠ Statutory thresholds live here so they can be updated in one place.
 *   Confirm each against the Nigeria Tax Act 2025 before go-live.
 */
import { BANKS } from '../catalog';

// ─── Entity types ────────────────────────────────────────────────────
export const ENTITY_TYPE_IDS = ['LTD', 'PLC', 'LLP', 'BN'] as const;
export type EntityType = (typeof ENTITY_TYPE_IDS)[number];

export const ENTITY_TYPES: { id: EntityType; label: string; prefix: 'RC' | 'LP' | 'BN'; hint?: string }[] = [
  { id: 'LTD', label: 'Private Limited Company (LTD)', prefix: 'RC' },
  { id: 'PLC', label: 'Public Limited Company (PLC)', prefix: 'RC' },
  { id: 'LLP', label: 'Limited Liability Partnership (LLP)', prefix: 'LP' },
  {
    id: 'BN', label: 'Registered Business Name / Sole Enterprise', prefix: 'BN',
    hint: 'Sole enterprises are taxed via State PIT, but must register here if crossing the statutory VAT threshold.',
  },
];

export const prefixFor = (t: EntityType | '') => ENTITY_TYPES.find((e) => e.id === t)?.prefix ?? 'RC';

// ─── Signatory designations ──────────────────────────────────────────
export const DESIGNATIONS = ['Director', 'Company Secretary', 'Chief Financial Officer', 'Appointed Tax Agent / Consultant'] as const;
export type Designation = (typeof DESIGNATIONS)[number];

// ─── Sectors & year-ends ─────────────────────────────────────────────
export const SECTORS = [
  'Information Technology & Software',
  'Agriculture & Agro-allied',
  'Financial Services & Fintech',
  'Manufacturing',
  'Oil & Gas',
  'Retail & Wholesale',
  'Professional Services',
] as const;

export const YEAR_ENDS = ['December 31st', 'March 31st', 'June 30th', 'September 30th', 'Custom'] as const;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const LAST_DAY = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const ord = (n: number) => `${n}${n === 1 || n === 21 || n === 31 ? 'st' : n === 2 || n === 22 ? 'nd' : n === 3 || n === 23 ? 'rd' : 'th'}`;
/** Month-end labels for a custom accounting year-end, e.g. "April 30th". */
export const CUSTOM_YEAR_ENDS = MONTHS.map((m, i) => `${m} ${ord(LAST_DAY[i])}`);

// ─── Banks (CBN-licensed commercial & non-interest only) ─────────────
const NON_COMMERCIAL = new Set(['565', '50211', '50515', '999992', '999991', '566']);
export const COMMERCIAL_BANKS = BANKS.filter((b) => !NON_COMMERCIAL.has(b.code));

// ─── Statutory thresholds ────────────────────────────────────────────
/** NTA 2025 small company: turnover ≤ ₦100M AND fixed assets ≤ ₦250M, excluding professional services. */
export const SMALL_CO_TURNOVER_MAX = 100_000_000;
export const SMALL_CO_ASSETS_MAX = 250_000_000;
/** Standard CIT rate for companies that are not small. */
export const STANDARD_CIT_RATE = 0.30;
/**
 * Mandatory VAT registration threshold (annual turnover).
 * TODO(compliance): ₦25M is the Finance Act 2019 figure used in the spec.
 * NTA 2025 may instead align the VAT exemption with the small-company test —
 * confirm and update this single constant.
 */
export const VAT_MANDATORY_THRESHOLD = 25_000_000;
export const VAT_RATE = 0.075;

export type CitStatus = 'SMALL_COMPANY_EXEMPT' | 'STANDARD_CORPORATE' | 'PIT_SOLE_ENTERPRISE';

export interface CitClassification {
  status: CitStatus;
  rate: number | null;
  reason: string;
}

export function classifyCIT(entityType: EntityType | '', turnover: number, assets: number, sector: string): CitClassification {
  if (entityType === 'BN') {
    return { status: 'PIT_SOLE_ENTERPRISE', rate: null, reason: 'Business-name enterprises are not subject to CIT; profits are taxed under State PIT.' };
  }
  if (sector === 'Professional Services') {
    return { status: 'STANDARD_CORPORATE', rate: STANDARD_CIT_RATE, reason: 'Professional-services firms are excluded from small-company relief.' };
  }
  if (turnover <= SMALL_CO_TURNOVER_MAX && assets <= SMALL_CO_ASSETS_MAX) {
    return { status: 'SMALL_COMPANY_EXEMPT', rate: 0, reason: 'Turnover ≤ ₦100M and fixed assets ≤ ₦250M.' };
  }
  return {
    status: 'STANDARD_CORPORATE', rate: STANDARD_CIT_RATE,
    reason: turnover > SMALL_CO_TURNOVER_MAX ? 'Turnover exceeds ₦100M.' : 'Fixed assets exceed ₦250M.',
  };
}

export const isVatMandatory = (turnover: number) => turnover >= VAT_MANDATORY_THRESHOLD;

/** Indicative NRS tax office. Replace with the official Tax Controller directory when available. */
export const nrsTaxOffice = (state: string, lga: string) =>
  state ? `NRS Integrated Tax Office — ${lga ? `${lga}, ` : ''}${state === 'FCT' ? 'FCT Abuja' : state}` : '';

/** Free mailbox domains — not blocked, but we nudge towards a corporate address. */
export const FREE_EMAIL_DOMAINS = ['gmail.com', 'yahoo.com', 'yahoo.co.uk', 'ymail.com', 'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'aol.com', 'proton.me', 'protonmail.com'];
export const isFreeEmail = (email: string) => FREE_EMAIL_DOMAINS.includes(email.split('@')[1]?.toLowerCase() ?? '');

/**
 * statutoryOverrides.ts — Admin-approved, per-profile statutory overrides.
 *
 * Stored on users/{email}.statutoryOverrides and writable only by super_admin
 * (see firestore.rules — owners cannot self-grant). Two families:
 *
 *  1. Individual reliefs — pre-2026 PITA allowances that are no longer general
 *     reliefs under the NTA 2025 but which an admin may approve for a specific
 *     taxpayer based on verified statutory status (e.g. disability).
 *  2. Corporate overrides — force the CIT bracket (0% small vs standard) or the
 *     VAT status (mandatory vs exempt) for a specific company.
 *
 * When an override is ON it is applied to that user's calculator, planner and
 * dashboard/filing figures and shown with an "Admin-approved" marker.
 */
import { useEffect, useState } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DEDUCTION_AMOUNTS } from './taxEngine';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ApprovedReliefKey = 'charity' | 'children' | 'dependantRelative' | 'disabled';

export type CitBracketOverride = 'auto' | 'small' | 'standard';
export type VatStatusOverride = 'auto' | 'mandatory' | 'exempt';

export interface StatutoryOverrides {
  reliefs: Record<ApprovedReliefKey, boolean>;
  corporate: {
    citBracket: CitBracketOverride;
    vatStatus: VatStatusOverride;
  };
  /** Admin's justification, e.g. "Disability certificate verified 2026-03-01". */
  note?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export const DEFAULT_OVERRIDES: StatutoryOverrides = {
  reliefs: { charity: false, children: false, dependantRelative: false, disabled: false },
  corporate: { citBracket: 'auto', vatStatus: 'auto' },
};

export const APPROVED_RELIEFS: {
  key: ApprovedReliefKey;
  label: string;
  statutoryBasis: string;
  amount: number;
}[] = [
  { key: 'disabled', label: 'Disabled Person Relief', statutoryBasis: 'Verified disability status', amount: DEDUCTION_AMOUNTS.disabled },
  { key: 'children', label: 'Children Allowance', statutoryBasis: 'Dependent children (max 4)', amount: DEDUCTION_AMOUNTS.children },
  { key: 'dependantRelative', label: 'Dependant Relative Relief', statutoryBasis: 'Supports elderly/incapacitated relative', amount: DEDUCTION_AMOUNTS.dependantRelative },
  { key: 'charity', label: 'Approved Charitable Donation', statutoryBasis: 'Donation to an approved institution', amount: DEDUCTION_AMOUNTS.charity },
];

export const CIT_BRACKET_LABELS: Record<CitBracketOverride, string> = {
  auto: 'Automatic (from turnover)',
  small: '0% — Small Company',
  standard: '30% — Standard Corporate',
};

export const VAT_STATUS_LABELS: Record<VatStatusOverride, string> = {
  auto: 'Automatic (from turnover)',
  mandatory: 'Active VAT Agent',
  exempt: 'Small Business Exempt',
};

// ─── Pure helpers ────────────────────────────────────────────────────────────

/** Merges a partial Firestore value onto safe defaults (tolerates missing keys). */
export function normalizeOverrides(raw: unknown): StatutoryOverrides {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<StatutoryOverrides>;
  const reliefs = { ...DEFAULT_OVERRIDES.reliefs };
  for (const k of Object.keys(reliefs) as ApprovedReliefKey[]) {
    reliefs[k] = r.reliefs?.[k] === true;
  }
  const cit = r.corporate?.citBracket;
  const vat = r.corporate?.vatStatus;
  return {
    reliefs,
    corporate: {
      citBracket: cit === 'small' || cit === 'standard' ? cit : 'auto',
      vatStatus: vat === 'mandatory' || vat === 'exempt' ? vat : 'auto',
    },
    note: typeof r.note === 'string' ? r.note : undefined,
    updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : undefined,
    updatedBy: typeof r.updatedBy === 'string' ? r.updatedBy : undefined,
  };
}

/** Admin-approved reliefs that are switched on for this profile. */
export function activeApprovedReliefs(o: StatutoryOverrides) {
  return APPROVED_RELIEFS.filter((r) => o.reliefs[r.key]);
}

/** Total annual ₦ of admin-approved reliefs. */
export function approvedReliefTotal(o: StatutoryOverrides): number {
  return activeApprovedReliefs(o).reduce((sum, r) => sum + r.amount, 0);
}

/** Resolves VAT status; 'auto' falls back to the supplied default. */
export function resolveVatActive(o: StatutoryOverrides, autoActive: boolean): boolean {
  if (o.corporate.vatStatus === 'mandatory') return true;
  if (o.corporate.vatStatus === 'exempt') return false;
  return autoActive;
}

export function hasAnyOverride(o: StatutoryOverrides): boolean {
  return (
    activeApprovedReliefs(o).length > 0 ||
    o.corporate.citBracket !== 'auto' ||
    o.corporate.vatStatus !== 'auto'
  );
}

// ─── Firestore I/O ───────────────────────────────────────────────────────────

const cache = new Map<string, StatutoryOverrides>();
const listeners = new Set<() => void>();

export async function loadStatutoryOverrides(email: string): Promise<StatutoryOverrides> {
  const key = email.toLowerCase().trim();
  if (!key || !db) return DEFAULT_OVERRIDES;
  try {
    const snap = await getDoc(doc(db, 'users', key));
    const value = normalizeOverrides(snap.exists() ? snap.data().statutoryOverrides : undefined);
    cache.set(key, value);
    return value;
  } catch (err) {
    console.debug('Statutory overrides unavailable:', err);
    return cache.get(key) ?? DEFAULT_OVERRIDES;
  }
}

/** Super-admin only (enforced by Firestore rules). */
export async function saveStatutoryOverrides(
  email: string,
  overrides: StatutoryOverrides,
  actorEmail: string
): Promise<StatutoryOverrides> {
  const key = email.toLowerCase().trim();
  const value: StatutoryOverrides = {
    ...normalizeOverrides(overrides),
    note: overrides.note?.trim() || '',
    updatedAt: new Date().toISOString(),
    updatedBy: actorEmail,
  };
  if (db) {
    await setDoc(doc(db, 'users', key), { statutoryOverrides: value }, { merge: true });
  }
  cache.set(key, value);
  listeners.forEach((fn) => fn());
  return value;
}

/** Loads (and caches) the overrides for the signed-in profile. */
export function useStatutoryOverrides(email: string | undefined | null): StatutoryOverrides {
  const key = (email || '').toLowerCase().trim();
  const [value, setValue] = useState<StatutoryOverrides>(() => cache.get(key) ?? DEFAULT_OVERRIDES);

  useEffect(() => {
    let alive = true;
    if (!key) {
      setValue(DEFAULT_OVERRIDES);
      return;
    }
    if (cache.has(key)) setValue(cache.get(key)!);
    loadStatutoryOverrides(key).then((v) => alive && setValue(v));
    const onChange = () => alive && setValue(cache.get(key) ?? DEFAULT_OVERRIDES);
    listeners.add(onChange);
    return () => {
      alive = false;
      listeners.delete(onChange);
    };
  }, [key]);

  return value;
}

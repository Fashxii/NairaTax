/**
 * services.ts — Input masks, formatting, and local (offline) format checks.
 *
 * No external identity / bank lookups are performed in v1.0: NIN, bank
 * account name, etc. are self-declared by the user and only format-checked here.
 */
import { validateNIN } from '../utils/validators';

// ─── Masks & formatting ──────────────────────────────────────────────
export const digitsOnly = (v: string, max: number) => v.replace(/\D/g, '').slice(0, max);

/** Accepts 0803…, 234803…, +234 803… → returns the 10 digits after +234. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('234')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  return d.slice(0, 10);
}

export const formatPhone = (d: string) =>
  [d.slice(0, 3), d.slice(3, 6), d.slice(6, 10)].filter(Boolean).join(' ');

export const formatNaira = (n: number) =>
  n > 0 ? `₦${Math.round(n).toLocaleString('en-NG')}` : '';

export const parseNaira = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  return d ? Number(d) : 0;
};

// ─── Local NIN format check (no NIMC lookup) ─────────────────────────
/** 11 digits and not all the same digit. Purely local — does not prove the NIN exists. */
export function checkNinFormat(nin: string): { ok: true } | { ok: false; error: string } {
  const res = validateNIN(nin);
  if (!res.valid) return { ok: false, error: res.error || 'NIN must be exactly 11 digits.' };
  if (/^(\d)\1{10}$/.test(nin.replace(/\s/g, ''))) return { ok: false, error: 'That does not look like a valid NIN. Check the number and try again.' };
  return { ok: true };
}

/** Self-declared legal name in the `LASTNAME Firstname` convention. */
export const formatLegalName = (firstName: string, lastName: string) =>
  `${lastName.trim().toUpperCase()} ${firstName.trim()}`.trim();

/** Masked NIN for Firestore: `***` + last 4 digits (matches security rules). */
export const maskNinForStorage = (nin: string) => `***${nin.replace(/\D/g, '').slice(-4)}`;

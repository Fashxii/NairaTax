/**
 * nrs/tin.ts — Taxpayer Identification Number format checks.
 *
 * IMPORTANT: this only checks the *shape* of a TIN. It does not prove the TIN
 * exists or belongs to the counterparty. Live verification needs an NRS / JTB
 * lookup service (see docs/NRS_REV360_IMPLEMENTATION.md, backlog).
 *
 * Accepted formats are configurable because the NRS format had not been
 * confirmed at the time of writing:
 *  - FIRS legacy:  12345678-0001   (8 digits, hyphen, 4 digits)
 *  - JTB:          1234567890      (10 digits)
 *  - 13-digit:     1234567890123   (format named in the original spec — unconfirmed)
 */

export interface TinFormat {
  id: 'FIRS_LEGACY' | 'JTB' | 'NRS_13';
  label: string;
  pattern: RegExp;
}

export const TIN_FORMATS: TinFormat[] = [
  { id: 'FIRS_LEGACY', label: 'FIRS TIN (12345678-0001)', pattern: /^\d{8}-\d{4}$/ },
  { id: 'JTB', label: 'JTB TIN (10 digits)', pattern: /^\d{10}$/ },
  { id: 'NRS_13', label: '13-digit Tax ID', pattern: /^\d{13}$/ },
];

export interface TinCheck {
  valid: boolean;
  normalized: string;
  format?: TinFormat['id'];
  error?: string;
}

/** Strip spaces/dots; a bare 12-digit string is treated as FIRS legacy (adds the hyphen). */
export function normalizeTin(raw: string): string {
  const cleaned = raw.trim().replace(/[\s.]/g, '').replace(/[–—]/g, '-');
  if (/^\d{12}$/.test(cleaned)) return `${cleaned.slice(0, 8)}-${cleaned.slice(8)}`;
  return cleaned;
}

export function validateTin(raw: string | undefined | null): TinCheck {
  if (!raw || !raw.trim()) return { valid: false, normalized: '', error: 'TIN is missing' };
  const normalized = normalizeTin(raw);
  const digits = normalized.replace(/-/g, '');
  if (/^(\d)\1+$/.test(digits)) {
    return { valid: false, normalized, error: 'TIN cannot be a repeated digit' };
  }
  const format = TIN_FORMATS.find((f) => f.pattern.test(normalized));
  if (!format) {
    return {
      valid: false,
      normalized,
      error: `Unrecognised TIN format. Expected one of: ${TIN_FORMATS.map((f) => f.label).join(', ')}`,
    };
  }
  return { valid: true, normalized, format: format.id };
}


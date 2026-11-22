/**
 * corporate/services.ts — RC/BN masks and local CAC number format checks.
 * No CAC register lookup is performed in v1.0; company details are self-declared.
 */
import type { EntityType } from './catalog';
import { prefixFor } from './catalog';

/** Mask: keeps the prefix for the entity type and up to 8 digits → "RC-1849201". */
export function maskCacNumber(raw: string, entityType: EntityType | ''): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return digits ? `${prefixFor(entityType)}-${digits}` : '';
}

/** Local format check of a CAC number for the selected entity type (no register lookup). */
export function checkCacFormat(cacNumber: string, entityType: EntityType | ''): { ok: true } | { ok: false; error: string } {
  const m = /^(RC|BN|LP)-(\d{4,8})$/.exec(cacNumber);
  if (!m || !entityType) return { ok: false, error: 'Enter a valid CAC number first.' };
  if (m[1] !== prefixFor(entityType)) return { ok: false, error: `A ${entityType} should have a ${prefixFor(entityType)}- number.` };
  if (/^(\d)\1+$/.test(m[2])) return { ok: false, error: 'That does not look like a valid CAC number. Check it and try again.' };
  return { ok: true };
}

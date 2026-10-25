/**
 * corporate/services.ts — Simulated CAC lookups and RC/BN masks.
 * Deterministic so QA can reproduce results; replace with live CAC APIs before launch.
 */
import type { EntityType } from './catalog';
import { prefixFor } from './catalog';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Mask: keeps the prefix for the entity type and up to 8 digits → "RC-1849201". */
export function maskCacNumber(raw: string, entityType: EntityType | ''): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  return digits ? `${prefixFor(entityType)}-${digits}` : '';
}

const WORDS_A = ['Acme', 'Zenon', 'Kora', 'Bluewave', 'Savanna', 'Ikenga', 'Delta Crest', 'Oduduwa', 'Niger Bridge', 'Harmattan'];
const WORDS_B = ['Technologies', 'Ventures', 'Logistics', 'Agro Allied', 'Industries', 'Capital', 'Solutions', 'Foods', 'Energy', 'Consulting'];
const SUFFIX: Record<EntityType, string> = { LTD: 'Nigeria Ltd', PLC: 'Nigeria Plc', LLP: 'Partners LLP', BN: 'Enterprises' };

export async function mockVerifyCAC(cacNumber: string, entityType: EntityType | '') {
  await sleep(1100);
  const m = /^(RC|BN|LP)-(\d{4,8})$/.exec(cacNumber);
  if (!m || !entityType) return { ok: false as const, error: 'Enter a valid CAC number first.' };
  if (m[1] !== prefixFor(entityType)) return { ok: false as const, error: `A ${entityType} should have a ${prefixFor(entityType)}- number.` };
  if (/^(\d)\1+$/.test(m[2])) return { ok: false as const, error: 'No entity found on the CAC register for this number.' };
  const n = m[2].split('').map(Number);
  const sum = n.reduce((a, b) => a + b, 0);
  return { ok: true as const, companyName: `${WORDS_A[sum % 10]} ${WORDS_B[(n[n.length - 1] + n[0]) % 10]} ${SUFFIX[entityType]}` };
}

/** Simulated match of the signatory NIN against CAC director / secretary records. */
export async function mockMatchSignatory(nin: string, designation: string) {
  await sleep(1100);
  if (!/^\d{11}$/.test(nin)) return { ok: false as const, error: 'NIN must be exactly 11 digits.' };
  if (/^(\d)\1{10}$/.test(nin)) return { ok: false as const, error: 'No identity record found for this NIN.' };
  if (designation === 'Appointed Tax Agent / Consultant')
    return { ok: true as const, note: 'Identity confirmed. Tax agents are not on CAC records — a signed letter of appointment will be requested at first filing.' };
  return { ok: true as const, note: `Identity confirmed and matched to CAC ${designation === 'Company Secretary' ? 'secretary' : 'officer'} records.` };
}

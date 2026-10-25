/**
 * services.ts — Input masks, formatting, and simulated external services
 * (NIMC NIN lookup, NIBSS name enquiry, SMS/WhatsApp OTP).
 *
 * The mocks are deterministic so QA can reproduce results. Replace them with
 * real Cloud Function calls before production use.
 */

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

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ─── Mock NIMC NIN verification ──────────────────────────────────────
export interface NinLookupResult {
  ok: boolean;
  legalName?: string;
  dateOfBirth?: string; // YYYY-MM-DD
  error?: string;
}

export async function mockVerifyNIN(nin: string, firstName: string, lastName: string): Promise<NinLookupResult> {
  await sleep(1200);
  if (!/^\d{11}$/.test(nin)) return { ok: false, error: 'NIN must be exactly 11 digits.' };
  if (/^(\d)\1{10}$/.test(nin)) return { ok: false, error: 'No identity record found for this NIN.' };
  const n = nin.split('').map(Number);
  const year = 1965 + ((n[0] * 10 + n[1]) % 40);
  const month = (n[2] * 10 + n[3]) % 12 + 1;
  const day = (n[4] * 10 + n[5]) % 28 + 1;
  const pad = (x: number) => String(x).padStart(2, '0');
  return {
    ok: true,
    legalName: `${lastName.trim().toUpperCase()} ${firstName.trim()}`.trim(),
    dateOfBirth: `${year}-${pad(month)}-${pad(day)}`,
  };
}

// ─── Mock NIBSS name enquiry ─────────────────────────────────────────
export async function mockResolveAccount(bankCode: string, accountNumber: string, fallbackName: string) {
  await sleep(900);
  if (!bankCode || !/^\d{10}$/.test(accountNumber)) return { ok: false as const, error: 'Enter a valid 10-digit NUBAN.' };
  if (/^(\d)\1{9}$/.test(accountNumber)) return { ok: false as const, error: 'Account not found at the selected bank.' };
  return { ok: true as const, accountName: fallbackName.toUpperCase() };
}

// ─── Simulated SMS / WhatsApp OTP ────────────────────────────────────
export function generatePhoneOtp(): string {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return String(100000 + (buf[0] % 900000));
}

/**
 * nrs/money.ts — Integer kobo arithmetic.
 *
 * All ledger maths happens on integer kobo to avoid floating-point drift.
 * Rates are expressed in basis points (1 bps = 0.01%, 750 bps = 7.5%).
 */

export const KOBO_PER_NAIRA = 100;
export const BPS_DENOMINATOR = 10_000;

/** Convert a naira amount (number or string like "₦1,250.50") to integer kobo. */
export function nairaToKobo(naira: number | string): number {
  const n = typeof naira === 'string' ? parseNairaString(naira) : naira;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * KOBO_PER_NAIRA);
}

/** Parse a bank-statement amount string. Handles ₦, commas, (brackets) and trailing CR/DR. */
export function parseNairaString(raw: string): number {
  let s = raw.trim();
  if (!s) return NaN;
  let negative = false;
  if (/^\(.*\)$/.test(s)) {
    negative = true;
    s = s.slice(1, -1);
  }
  if (/\bDR$/i.test(s)) negative = true;
  s = s.replace(/\b(CR|DR)$/i, '').replace(/[₦,\s]|NGN/gi, '');
  if (s.startsWith('-')) {
    negative = !negative;
    s = s.slice(1);
  }
  if (!/^\d*\.?\d+$/.test(s)) return NaN;
  const value = parseFloat(s);
  return negative ? -value : value;
}

export function koboToNaira(kobo: number): number {
  return kobo / KOBO_PER_NAIRA;
}

/** "₦1,234.56" */
export function formatKobo(kobo: number, decimals: 0 | 2 = 2): string {
  const sign = kobo < 0 ? '-' : '';
  const naira = Math.abs(kobo) / KOBO_PER_NAIRA;
  return `${sign}₦${naira.toLocaleString('en-NG', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

/** Plain "1234.56" for CSV exports (no currency symbol or separators). */
export function koboToDecimalString(kobo: number): string {
  const sign = kobo < 0 ? '-' : '';
  const abs = Math.abs(Math.round(kobo));
  const whole = Math.floor(abs / KOBO_PER_NAIRA);
  const frac = String(abs % KOBO_PER_NAIRA).padStart(2, '0');
  return `${sign}${whole}.${frac}`;
}

/** Portion of `amountKobo` at `rateBps`. */
export function applyRate(amountKobo: number, rateBps: number): number {
  return Math.round((amountKobo * rateBps) / BPS_DENOMINATOR);
}

/** VAT contained in a VAT-inclusive gross amount: gross × r / (1 + r). */
export function vatFromInclusive(grossKobo: number, rateBps: number): number {
  if (rateBps <= 0) return 0;
  return Math.round((grossKobo * rateBps) / (BPS_DENOMINATOR + rateBps));
}

/** Convert a decimal rate (0.075) to basis points (750). */
export function rateToBps(rate: number): number {
  return Math.round(rate * BPS_DENOMINATOR);
}

export function sumKobo<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((acc, item) => acc + pick(item), 0);
}


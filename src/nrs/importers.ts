/**
 * nrs/importers.ts — Convert raw sources into LedgerTransactionInput.
 *
 * Sources:
 *  - Bank statement CSV (column auto-detection for common Nigerian bank exports)
 *  - Smart Vault transactions already in the app (SyncTransaction)
 *  - Mono statement items (for when the server-side Mono sync is connected)
 */

import type { SyncTransaction } from '../types';
import type { MonoTransactionItem } from '../../types/bank';
import { nairaToKobo, parseNairaString } from './money';
import type { LedgerTransactionInput } from './types';

// ─── CSV parsing ─────────────────────────────────────────────────────────────

/** RFC 4180-style CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else field += ch;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c.length > 0));
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};

function iso(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCMonth() !== m - 1) return null;
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * Parse dates used on Nigerian statements. Numeric dates are read DAY-FIRST
 * (DD/MM/YYYY), which is the local convention.
 */
export function parseStatementDate(raw: string): string | null {
  const s = raw.trim().replace(/\s+\d{1,2}:\d{2}(:\d{2})?(\s*[AP]M)?$/i, '');
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (m) return iso(+m[3], +m[2], +m[1]);
  m = s.match(/^(\d{1,2})[\s/-]+([A-Za-z]{3,9})[\s/,-]+(\d{2,4})$/);
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()] ?? MONTHS[m[2].slice(0, 3).toLowerCase()];
    if (mon) return iso(+m[3], mon, +m[1]);
  }
  m = s.match(/^([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})$/);
  if (m) {
    const mon = MONTHS[m[1].toLowerCase()] ?? MONTHS[m[1].slice(0, 3).toLowerCase()];
    if (mon) return iso(+m[3], mon, +m[2]);
  }
  return null;
}

type ColumnRole = 'date' | 'narration' | 'debit' | 'credit' | 'amount' | 'type' | 'counterparty' | 'tin' | 'reference' | 'invoice';

const HEADER_PATTERNS: [ColumnRole, RegExp][] = [
  ['date', /^(trans(action)?\.?\s*date|txn date|date|posting date|value date|tran date)$/i],
  ['narration', /^(narration|description|details|remarks?|particulars|transaction details|memo)$/i],
  ['debit', /^(debit|debits|withdrawals?|money out|dr|debit amount|paid out)$/i],
  ['credit', /^(credit|credits|deposits?|lodgements?|money in|cr|credit amount|paid in)$/i],
  ['amount', /^(amount|amount \(ngn\)|amount\(₦\)|value|transaction amount)$/i],
  ['type', /^(type|dr\/cr|cr\/dr|direction|transaction type)$/i],
  ['counterparty', /^(counterparty|beneficiary|payee|payer|merchant|vendor|customer|name)$/i],
  ['tin', /^(tin|tax id|counterparty tin|payee tin|vendor tin)$/i],
  ['reference', /^(reference|ref|ref no|reference no|transaction ref|session id|txn ref)$/i],
  ['invoice', /^(invoice|invoice no|invoice ref|invoice number)$/i],
];

export interface CsvImportResult {
  transactions: LedgerTransactionInput[];
  errors: { line: number; message: string }[];
  detectedColumns: Partial<Record<ColumnRole, number>>;
}

/** Find the header row (banks often prepend account info) and map its columns. */
function detectColumns(rows: string[][]): { headerIndex: number; cols: Partial<Record<ColumnRole, number>> } | null {
  const limit = Math.min(rows.length, 15);
  for (let r = 0; r < limit; r++) {
    const cols: Partial<Record<ColumnRole, number>> = {};
    rows[r].forEach((cell, idx) => {
      const label = cell.replace(/\s+/g, ' ').trim();
      for (const [role, pattern] of HEADER_PATTERNS) {
        if (cols[role] === undefined && pattern.test(label)) {
          cols[role] = idx;
          break;
        }
      }
    });
    const hasMoney = cols.amount !== undefined || cols.debit !== undefined || cols.credit !== undefined;
    if (cols.date !== undefined && cols.narration !== undefined && hasMoney) {
      return { headerIndex: r, cols };
    }
  }
  return null;
}

/** Simple, stable hash for building a sourceRef when the bank provides none. */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

export function importBankCsv(text: string, fileName = 'statement.csv'): CsvImportResult {
  const rows = parseCsv(text);
  const errors: CsvImportResult['errors'] = [];
  const detected = detectColumns(rows);
  if (!detected) {
    return {
      transactions: [],
      errors: [{
        line: 1,
        message: 'Could not find a header row with Date, Description/Narration and Amount (or Debit/Credit) columns.',
      }],
      detectedColumns: {},
    };
  }
  const { headerIndex, cols } = detected;
  const out: LedgerTransactionInput[] = [];
  const cell = (row: string[], role: ColumnRole) => (cols[role] !== undefined ? row[cols[role]!] ?? '' : '');

  for (let r = headerIndex + 1; r < rows.length; r++) {
    const row = rows[r];
    const line = r + 1;
    const date = parseStatementDate(cell(row, 'date'));
    if (!date) {
      // Footer rows ("Closing balance", totals) have no date — skip quietly if empty.
      if (cell(row, 'date')) errors.push({ line, message: `Unrecognised date "${cell(row, 'date')}"` });
      continue;
    }
    let signed = NaN;
    const debit = parseNairaString(cell(row, 'debit'));
    const credit = parseNairaString(cell(row, 'credit'));
    if (Number.isFinite(debit) && debit !== 0) signed = -Math.abs(debit);
    else if (Number.isFinite(credit) && credit !== 0) signed = Math.abs(credit);
    else {
      const amount = parseNairaString(cell(row, 'amount'));
      if (Number.isFinite(amount)) {
        const type = cell(row, 'type').toLowerCase();
        if (/^(dr|debit|d|out)/.test(type)) signed = -Math.abs(amount);
        else if (/^(cr|credit|c|in)/.test(type)) signed = Math.abs(amount);
        else signed = amount;
      }
    }
    if (!Number.isFinite(signed) || signed === 0) {
      errors.push({ line, message: 'No debit/credit amount found' });
      continue;
    }
    const narration = cell(row, 'narration') || 'Bank transaction';
    const reference = cell(row, 'reference');
    out.push({
      source: 'CSV',
      sourceRef: reference || `${fileName}#${hashString(`${date}|${signed}|${narration}`)}`,
      date,
      amountKobo: Math.abs(nairaToKobo(signed)),
      direction: signed < 0 ? 'OUTFLOW' : 'INFLOW',
      narration,
      counterpartyName: cell(row, 'counterparty') || undefined,
      counterpartyTin: cell(row, 'tin') || undefined,
      invoiceRef: cell(row, 'invoice') || undefined,
    });
  }
  return { transactions: out, errors, detectedColumns: cols };
}

// ─── Smart Vault (existing in-app expenses) ──────────────────────────────────

export function importSmartVault(txs: SyncTransaction[]): { transactions: LedgerTransactionInput[]; skipped: number } {
  const out: LedgerTransactionInput[] = [];
  let skipped = 0;
  for (const t of txs) {
    const date = parseStatementDate(t.date) ?? (() => {
      const d = new Date(t.date);
      return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
    })();
    if (!date || !(t.amount > 0)) {
      skipped++;
      continue;
    }
    out.push({
      source: 'SMART_VAULT',
      sourceRef: t.id,
      date,
      amountKobo: nairaToKobo(t.amount),
      direction: 'OUTFLOW',
      narration: `${t.merchant} — ${t.category}`,
      counterpartyName: t.merchant,
    });
  }
  return { transactions: out, skipped };
}

// ─── Mono ────────────────────────────────────────────────────────────────────

/** Mono statement item → ledger input. Mono amounts are in naira per types/bank.ts. */
export function importMonoItem(item: MonoTransactionItem): LedgerTransactionInput {
  return {
    source: 'MONO',
    sourceRef: item._id,
    date: item.date.slice(0, 10),
    amountKobo: Math.abs(nairaToKobo(item.amount)),
    direction: item.type === 'credit' ? 'INFLOW' : 'OUTFLOW',
    narration: item.narration,
  };
}

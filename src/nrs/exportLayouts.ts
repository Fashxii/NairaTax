/**
 * nrs/exportLayouts.ts — Column layouts for schedule exports.
 *
 * We do NOT yet have the official NRS Rev360 bulk-upload templates. Until we do,
 * exports use the `NAIRATAX_DRAFT_V1` layouts below (clear, accountant-friendly
 * columns). When the official templates arrive:
 *   1. Add a new layout object per template (exact header text + column order).
 *   2. Set `matchesOfficialTemplate: true` and record the template version.
 *   3. Point DEFAULT_LAYOUTS at the new layouts.
 * No calculation code needs to change.
 */

import { koboToDecimalString } from './money';
import type { VatScheduleRow, WhtScheduleRow } from './schedules';

export interface ExportColumn<R> {
  header: string;
  value: (row: R) => string | number;
}

export interface ExportLayout<R> {
  id: string;
  label: string;
  version: string;
  matchesOfficialTemplate: boolean;
  columns: ExportColumn<R>[];
}

const money = (kobo: number) => koboToDecimalString(kobo);
const pct = (bps: number) => (bps / 100).toFixed(2);

export const VAT_SCHEDULE_A_DRAFT: ExportLayout<VatScheduleRow> = {
  id: 'NAIRATAX_DRAFT_V1_VAT_A',
  label: 'VAT Schedule A — Output VAT on sales (draft layout)',
  version: '1.0.0',
  matchesOfficialTemplate: false,
  columns: [
    { header: 'S/N', value: () => '' },
    { header: 'Transaction Date', value: (r) => r.date },
    { header: 'Customer Name', value: (r) => r.counterpartyName },
    { header: 'Customer TIN', value: (r) => r.counterpartyTin },
    { header: 'Invoice Number', value: (r) => r.invoiceRef },
    { header: 'Description', value: (r) => r.description },
    { header: 'Amount (Excl. VAT)', value: (r) => money(r.netKobo) },
    { header: 'VAT Amount', value: (r) => money(r.vatKobo) },
    { header: 'Total (Incl. VAT)', value: (r) => money(r.grossKobo) },
  ],
};

export const VAT_SCHEDULE_C_DRAFT: ExportLayout<VatScheduleRow> = {
  id: 'NAIRATAX_DRAFT_V1_VAT_C',
  label: 'VAT Schedule C — Input VAT on purchases (draft layout)',
  version: '1.0.0',
  matchesOfficialTemplate: false,
  columns: [
    { header: 'S/N', value: () => '' },
    { header: 'Transaction Date', value: (r) => r.date },
    { header: 'Supplier Name', value: (r) => r.counterpartyName },
    { header: 'Supplier TIN', value: (r) => r.counterpartyTin },
    { header: 'Invoice Number', value: (r) => r.invoiceRef },
    { header: 'Description', value: (r) => r.description },
    { header: 'Amount (Excl. VAT)', value: (r) => money(r.netKobo) },
    { header: 'Input VAT', value: (r) => money(r.vatKobo) },
    { header: 'Total (Incl. VAT)', value: (r) => money(r.grossKobo) },
    { header: 'Claimable', value: (r) => (r.claimable ? 'YES' : 'NO - missing supplier TIN') },
  ],
};

export const WHT_SCHEDULE_DRAFT: ExportLayout<WhtScheduleRow> = {
  id: 'NAIRATAX_DRAFT_V1_WHT',
  label: 'WHT deduction schedule (draft layout)',
  version: '1.0.0',
  matchesOfficialTemplate: false,
  columns: [
    { header: 'S/N', value: () => '' },
    { header: 'Payment Date', value: (r) => r.date },
    { header: 'Beneficiary Name', value: (r) => r.payeeName },
    { header: 'Beneficiary TIN', value: (r) => r.payeeTin },
    { header: 'Beneficiary Type', value: (r) => (r.payeeType === 'company' ? 'Corporate' : 'Individual') },
    { header: 'Nature of Transaction', value: (r) => r.paymentType },
    { header: 'Contract Amount (Excl. VAT)', value: (r) => money(r.baseKobo) },
    { header: 'WHT Rate (%)', value: (r) => pct(r.rateBps) },
    { header: 'WHT Amount', value: (r) => money(r.whtKobo) },
    { header: 'Receipt / Credit Note Ref', value: (r) => r.creditNoteRef },
  ],
};

export const DEFAULT_LAYOUTS = {
  vatA: VAT_SCHEDULE_A_DRAFT,
  vatC: VAT_SCHEDULE_C_DRAFT,
  wht: WHT_SCHEDULE_DRAFT,
};

function csvEscape(value: string | number): string {
  let s = String(value ?? '');
  // Neutralise spreadsheet formula injection from narrations (=, +, -, @ prefixes).
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Render rows to CSV text using a layout. S/N columns are auto-numbered. */
export function toCsv<R>(layout: ExportLayout<R>, rows: R[]): string {
  const header = layout.columns.map((c) => csvEscape(c.header)).join(',');
  const body = rows.map((row, i) =>
    layout.columns
      .map((c) => csvEscape(c.header === 'S/N' ? i + 1 : c.value(row)))
      .join(','),
  );
  return [header, ...body].join('\r\n');
}

/** Trigger a browser download (UTF-8 BOM so Excel shows ₦ and names correctly). */
export function downloadCsv(fileName: string, csv: string): void {
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}


/**
 * nrs/pdf.ts — Printable review pack for a tax period (VAT + WHT).
 *
 * This is a working paper for the taxpayer/adviser to review before filing.
 * It is clearly labelled as a draft and is NOT an NRS-issued document.
 * (jsPDF's built-in fonts have no ₦ glyph, so amounts use "NGN".)
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { koboToNaira } from './money';
import type { VatReturn, WhtSchedule } from './schedules';

const ngn = (kobo: number) =>
  `NGN ${koboToNaira(kobo).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

type DocWithTable = jsPDF & { lastAutoTable?: { finalY: number } };

export interface ReviewPackInput {
  taxpayerName: string;
  taxId?: string;
  vat: VatReturn;
  wht: WhtSchedule;
  status: string;
  layoutNote: string;
}

export function generateReviewPackPDF(input: ReviewPackInput): void {
  const doc = new jsPDF() as DocWithTable;
  const { vat, wht } = input;

  doc.setFillColor(1, 50, 32);
  doc.rect(0, 0, 210, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text('DIYtax9ja', 14, 15);
  doc.setFontSize(11);
  doc.text(`NRS Return Review Pack — ${vat.period}`, 196, 15, { align: 'right' });
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('DRAFT WORKING PAPER — NOT AN NRS DOCUMENT', 196, 22, { align: 'right' });

  doc.setTextColor(31, 41, 55);
  doc.setFontSize(10);
  doc.text(`Taxpayer: ${input.taxpayerName}`, 14, 38);
  doc.text(`TIN: ${input.taxId || 'not recorded'}`, 14, 44);
  doc.text(`Period status: ${input.status}`, 120, 38);
  doc.text(`Generated: ${new Date().toISOString().slice(0, 10)}`, 120, 44);

  autoTable(doc, {
    startY: 52,
    head: [['VAT position', 'Amount']],
    body: [
      ['Standard-rated sales (excl. VAT)', ngn(vat.standardSalesNetKobo)],
      ['Zero-rated sales', ngn(vat.zeroRatedSalesKobo)],
      ['Exempt sales', ngn(vat.exemptSalesKobo)],
      ['Output VAT (Schedule A)', ngn(vat.outputVatKobo)],
      ['Input VAT claimable (Schedule C)', ngn(vat.inputVatClaimableKobo)],
      ['Input VAT excluded — missing supplier TIN', ngn(vat.inputVatUnsupportedKobo)],
      [vat.netVatKobo >= 0 ? 'Net VAT payable' : 'VAT credit carried forward', ngn(Math.abs(vat.netVatKobo))],
      ['Due date', vat.dueDate],
    ],
    theme: 'grid',
    headStyles: { fillColor: [1, 50, 32] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'right' } },
  });

  autoTable(doc, {
    startY: (doc.lastAutoTable?.finalY ?? 100) + 8,
    head: [['WHT by nature of transaction', 'Count', 'WHT']],
    body: [
      ...wht.byPaymentType.map((r) => [r.paymentType, String(r.count), ngn(r.whtKobo)]),
      ['Total WHT to remit', String(wht.rows.length), ngn(wht.totalWhtKobo)],
      ['Remittance due', '', wht.dueDate],
    ],
    theme: 'grid',
    headStyles: { fillColor: [1, 50, 32] },
    styles: { fontSize: 9 },
    columnStyles: { 1: { halign: 'center' }, 2: { halign: 'right' } },
  });

  const sections: [string, string[][]][] = [
    ['Schedule A — Output VAT', vat.scheduleA.map((r) => [r.date, r.counterpartyName || r.description.slice(0, 30), r.counterpartyTin, r.invoiceRef, ngn(r.netKobo), ngn(r.vatKobo)])],
    ['Schedule C — Input VAT', vat.scheduleC.map((r) => [r.date, r.counterpartyName || r.description.slice(0, 30), r.counterpartyTin || 'MISSING', r.invoiceRef, ngn(r.netKobo), ngn(r.vatKobo)])],
  ];
  for (const [title, body] of sections) {
    if (body.length === 0) continue;
    autoTable(doc, {
      startY: (doc.lastAutoTable?.finalY ?? 100) + 8,
      head: [[{ content: title, colSpan: 6 }], ['Date', 'Counterparty', 'TIN', 'Invoice', 'Net', 'VAT']],
      body,
      theme: 'striped',
      headStyles: { fillColor: [1, 50, 32] },
      styles: { fontSize: 8 },
      columnStyles: { 4: { halign: 'right' }, 5: { halign: 'right' } },
    });
  }

  const pageHeight = doc.internal.pageSize.height;
  doc.setFontSize(7);
  doc.setTextColor(107, 114, 128);
  doc.text(input.layoutNote, 14, pageHeight - 10, { maxWidth: 182 });

  doc.save(`NRS_Review_Pack_${vat.period}.pdf`);
}


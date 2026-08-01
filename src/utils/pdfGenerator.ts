/**
 * pdfGenerator.ts — Branded PDF & CSV Export Utility for DIYtax9ja
 *
 * Provides functions for generating and downloading:
 *  - Official Tax Filing Receipts
 *  - Employee Monthly Payslips
 *  - E-Invoices with VAT Compliance Data
 *  - SME Payroll Summary CSV
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { TaxFiling, UserSession, Employee, PayslipResult, Invoice } from '../types';
import { formatNaira } from './taxEngine';

// Colors based on DIYtax9ja theme
const PRIMARY_GREEN = '#013220';
const ACCENT_GREEN = '#4ADE80';
const DARK_TEXT = '#1F2937';
const LIGHT_BG = '#F3F4F6';

/** Helper: Add header branding to PDF document */
function addPdfHeader(doc: jsPDF, title: string, subtitle: string) {
  // Primary green top bar
  doc.setFillColor(1, 50, 32);
  doc.rect(0, 0, 210, 28, 'F');

  // App Brand Name
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('DIYtax9ja', 14, 16);

  // App Tagline
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(74, 222, 128); // Accent Green
  doc.text('AUTOMATED NIGERIAN TAX COMPLIANCE', 14, 22);

  // Document Title & Subtitle
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 196, 15, { align: 'right' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text(subtitle, 196, 21, { align: 'right' });

  // Reset text color for body
  doc.setTextColor(DARK_TEXT);
}

/** Helper: Add footer to PDF document */
function addPdfFooter(doc: jsPDF, pageNum = 1) {
  const pageHeight = doc.internal.pageSize.height;

  doc.setDrawColor(229, 231, 235);
  doc.line(14, pageHeight - 18, 196, pageHeight - 18);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text(
    'DIYtax9ja Compliance Engine · Generated under Personal Income Tax Act (PITA) & Finance Act',
    14,
    pageHeight - 12
  );
  doc.text(`Page ${pageNum}`, 196, pageHeight - 12, { align: 'right' });
}

// ─── 1. Tax Filing Receipt PDF ───────────────────────────────────────────────

export function generateTaxReceipt(filing: TaxFiling, session: UserSession): void {
  const doc = new jsPDF();

  addPdfHeader(doc, 'TAX PAYMENT RECEIPT', `Ref: ${filing.receiptNumber}`);

  // Receipt Metadata Box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 34, 182, 38, 3, 3, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, 34, 182, 38, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(1, 50, 32);
  doc.text('TAXPAYER INFORMATION', 20, 42);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_TEXT);

  const taxpayerName = session.fullName || 'Registered Taxpayer';
  const taxId = session.taxId || 'STAX-98234-NG';
  const nin = session.nin ? `***${session.nin.slice(-4)}` : 'Linked';

  doc.text(`Taxpayer Name: ${taxpayerName}`, 20, 50);
  doc.text(`State Tax ID: ${taxId}`, 20, 56);
  doc.text(`NIN Status: Verified (${nin})`, 20, 62);

  doc.text(`Filing Period: ${filing.period}`, 110, 50);
  doc.text(`Filing Type: ${filing.type}`, 110, 56);
  doc.text(`Date Filed: ${filing.dateFiled}`, 110, 62);

  // Table Details
  autoTable(doc, {
    startY: 78,
    head: [['Item Description', 'Tax Authority', 'Status', 'Amount Paid']],
    body: [
      [
        `${filing.type} Return (${filing.period})`,
        'State Internal Revenue Service / FIRS',
        filing.status,
        formatNaira(filing.amount),
      ],
    ],
    headStyles: {
      fillColor: [1, 50, 32],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [31, 41, 55],
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    margin: { left: 14, right: 14 },
  });

  // Total Summary Box
  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 100;

  doc.setFillColor(236, 253, 245);
  doc.roundedRect(120, finalY, 76, 24, 2, 2, 'F');
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(120, finalY, 76, 24, 2, 2, 'S');

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(6, 78, 59);
  doc.text('TOTAL REMITTED', 126, finalY + 8);

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text(formatNaira(filing.amount), 126, finalY + 18);

  // Verification Seal
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(14, finalY, 95, 24, 2, 2, 'F');
  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('E-FILING VERIFICATION STAMP', 20, finalY + 7);
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(31, 41, 55);
  doc.text(`HASH: ${filing.receiptNumber}-SEC-VERIFIED`, 20, finalY + 16);

  addPdfFooter(doc);
  doc.save(`DIYtax9ja_Receipt_${filing.receiptNumber}.pdf`);
}

// ─── 2. Employee Payslip PDF ─────────────────────────────────────────────────

export function generatePayslip(employee: Employee, payslip: PayslipResult): void {
  const doc = new jsPDF();

  const monthYear = new Date().toLocaleDateString('en-NG', { month: 'long', year: 'numeric' });
  addPdfHeader(doc, 'EMPLOYEE PAYSLIP', monthYear.toUpperCase());

  // Employee Information Card
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 34, 182, 32, 3, 3, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, 34, 182, 32, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(1, 50, 32);
  doc.text('EMPLOYEE DETAILS', 20, 42);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_TEXT);
  doc.text(`Employee Name: ${employee.name}`, 20, 50);
  doc.text(`Role / Designation: ${employee.role}`, 20, 56);

  doc.text(`Employee ID: ${employee.id}`, 110, 50);
  doc.text(`Pay Period: ${monthYear}`, 110, 56);

  // Earnings & Deductions Tables side-by-side or stacked
  autoTable(doc, {
    startY: 72,
    head: [['Earnings & Reliefs', 'Monthly Amount (₦)']],
    body: [
      ['Gross Salary', formatNaira(payslip.gross)],
      ['Consolidated Relief Allowance (CRA)', formatNaira(payslip.cra)],
      ['Taxable Income', formatNaira(payslip.taxableIncome)],
    ],
    headStyles: {
      fillColor: [1, 50, 32],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    margin: { left: 14, right: 108 },
  });

  const firstTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 110;

  autoTable(doc, {
    startY: 72,
    head: [['Deduction Item', 'Statutory / Rate', 'Amount (₦)']],
    body: [
      ['PAYE Income Tax', 'PITA Bands', formatNaira(payslip.paye)],
      ['Pension (PenCom)', employee.optInPension ? '8%' : 'Opted-Out', formatNaira(payslip.pension)],
      ['NHF (Housing)', employee.optInNHF ? '2.5%' : 'Opted-Out', formatNaira(payslip.nhf)],
      ['NHIS (Health)', employee.optInNHIS ? 'Flat Est.' : 'Opted-Out', formatNaira(payslip.nhis)],
    ],
    headStyles: {
      fillColor: [185, 28, 28], // Red accent for deductions
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    margin: { left: 108, right: 14 },
  });

  const secondTableY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 120;
  const summaryY = Math.max(firstTableY, secondTableY) + 12;

  // Net Pay Summary Banner
  doc.setFillColor(236, 253, 245);
  doc.roundedRect(14, summaryY, 182, 26, 3, 3, 'F');
  doc.setDrawColor(52, 211, 153);
  doc.roundedRect(14, summaryY, 182, 26, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(6, 78, 59);
  doc.text('NET TAKE-HOME PAY', 20, summaryY + 11);

  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(formatNaira(payslip.netPay), 20, summaryY + 21);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(107, 114, 128);
  doc.text('Direct credit into employee verified bank account', 190, summaryY + 16, { align: 'right' });

  addPdfFooter(doc);
  doc.save(`Payslip_${employee.name.replace(/\s+/g, '_')}_${monthYear.replace(/\s+/g, '_')}.pdf`);
}

// ─── 3. E-Invoice PDF ────────────────────────────────────────────────────────

export function generateInvoicePDF(invoice: Invoice): void {
  const doc = new jsPDF();

  addPdfHeader(doc, 'TAX INVOICE', `#${invoice.invoiceNumber}`);

  // Invoice Overview Box
  doc.setFillColor(249, 250, 251);
  doc.roundedRect(14, 34, 182, 34, 3, 3, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(14, 34, 182, 34, 3, 3, 'S');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(1, 50, 32);
  doc.text('BILLED TO', 20, 42);

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(DARK_TEXT);
  doc.text(invoice.clientName, 20, 49);
  doc.setFont('helvetica', 'normal');
  doc.text(invoice.clientEmail, 20, 55);

  doc.text(`Issue Date: ${invoice.issueDate}`, 110, 42);
  doc.text(`Due Date: ${invoice.dueDate}`, 110, 48);
  doc.text(`Status: ${invoice.status.toUpperCase()}`, 110, 54);
  if (invoice.vatRemitted && invoice.vatRemittanceRef) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(6, 78, 59);
    doc.text(`FIRS VAT Ref: ${invoice.vatRemittanceRef}`, 110, 60);
  }

  // Line Items Table
  const tableData = invoice.lineItems.map((item) => [
    item.description,
    item.quantity.toString(),
    formatNaira(item.unitPrice),
    formatNaira(item.quantity * item.unitPrice),
  ]);

  autoTable(doc, {
    startY: 74,
    head: [['Item Description', 'Qty', 'Unit Price (₦)', 'Total (₦)']],
    body: tableData,
    headStyles: {
      fillColor: [1, 50, 32],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: { fontSize: 8.5, textColor: [31, 41, 55] },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY + 10 : 120;

  // Totals Box
  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(DARK_TEXT);

  doc.text('Subtotal:', 125, finalY);
  doc.text(formatNaira(invoice.subtotal), 196, finalY, { align: 'right' });

  doc.text('VAT (7.5%):', 125, finalY + 6);
  doc.text(formatNaira(invoice.vatAmount), 196, finalY + 6, { align: 'right' });

  doc.setDrawColor(229, 231, 235);
  doc.line(125, finalY + 9, 196, finalY + 9);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(1, 50, 32);
  doc.text('Total Amount Due:', 125, finalY + 16);
  doc.text(formatNaira(invoice.total), 196, finalY + 16, { align: 'right' });

  addPdfFooter(doc);
  doc.save(`Invoice_${invoice.invoiceNumber}.pdf`);
}

// ─── 4. Export Payroll CSV ───────────────────────────────────────────────────

export function exportPayrollCSV(employees: Employee[]): void {
  const headers = ['Employee ID', 'Name', 'Role', 'Gross Monthly (NGN)', 'Pension Opt-In', 'NHF Opt-In', 'NHIS Opt-In'];
  
  const rows = employees.map((emp) => [
    `"${emp.id}"`,
    `"${emp.name.replace(/"/g, '""')}"`,
    `"${emp.role.replace(/"/g, '""')}"`,
    emp.grossMonthlySalary,
    emp.optInPension ? 'YES' : 'NO',
    emp.optInNHF ? 'YES' : 'NO',
    emp.optInNHIS ? 'YES' : 'NO',
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `DIYtax9ja_Payroll_Export_${new Date().toISOString().split('T')[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

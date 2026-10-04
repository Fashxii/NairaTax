/**
 * emailTemplates.ts — DIYtax9ja Email Template Library
 *
 * Full registry of 12 Nigerian tax-compliant email templates with:
 * - Inline-styled responsive HTML (no external CSS)
 * - Forest Green (#013220) + Emerald (#4ADE80) branding
 * - NDPR/NDPA 2023 + FIRS compliance footer
 * - Merge tag interpolation engine
 * - XSS-safe variable substitution
 */

import type { EmailTemplate, EmailTemplateKey } from '../types/email';

// ─── Branding Constants ───────────────────────────────────────────────

const BRAND_NAME = 'DIYtax9ja';
const BRAND_TAGLINE = 'Nigeria Tax Filing & Compliance Platform';
const PRIMARY_COLOR = '#013220';
const ACCENT_COLOR = '#4ADE80';
const ACCENT_BG = '#f0fdf4';
const BODY_BG = '#f4f4f4';
const FOOTER_BG = '#f8f8f8';
const TEXT_PRIMARY = '#1a1c1c';
const TEXT_SECONDARY = '#555555';
const TEXT_MUTED = '#888888';
const TEXT_FOOTER = '#aaaaaa';
const YEAR = new Date().getFullYear();

// ─── Base Layout Wrappers ─────────────────────────────────────────────

function baseLayout(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${BRAND_NAME}</title>
</head>
<body style="margin:0;padding:0;background:${BODY_BG};font-family:'Segoe UI',Arial,sans-serif;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BODY_BG};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${PRIMARY_COLOR};padding:28px 32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;letter-spacing:-0.5px;font-weight:800;">${BRAND_NAME}</h1>
              <p style="color:${ACCENT_COLOR};margin:4px 0 0;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">${BRAND_TAGLINE}</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 32px 24px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:${FOOTER_BG};padding:20px 32px;border-top:1px solid #eee;">
              <p style="color:${TEXT_FOOTER};font-size:10px;margin:0;text-align:center;line-height:1.6;">
                © ${YEAR} ${BRAND_NAME}. All rights reserved.<br/>
                Compliant with the Nigeria Data Protection Act (NDPA 2023) and<br/>
                Federal Inland Revenue Service (FIRS) Electronic Filing Regulations.<br/>
                <span style="color:#ccc;">This is an automated message — please do not reply directly.</span>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function sectionTitle(title: string, subtitle?: string): string {
  return `<h2 style="color:${PRIMARY_COLOR};font-size:18px;margin:0 0 8px;font-weight:700;">${title}</h2>
${subtitle ? `<p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.6;margin:0 0 24px;">${subtitle}</p>` : ''}`;
}

function codeBox(code: string): string {
  return `<div style="background:${ACCENT_BG};border:2px solid ${ACCENT_COLOR};border-radius:12px;padding:20px;text-align:center;margin:0 0 24px;">
  <p style="color:${PRIMARY_COLOR};font-size:36px;font-weight:900;letter-spacing:10px;margin:0;font-family:'Courier New',monospace;">${code}</p>
</div>`;
}

function infoRow(label: string, value: string): string {
  return `<tr>
  <td style="padding:8px 12px;font-size:12px;color:${TEXT_MUTED};font-weight:600;border-bottom:1px solid #f0f0f0;white-space:nowrap;">${label}</td>
  <td style="padding:8px 12px;font-size:13px;color:${TEXT_PRIMARY};font-weight:600;border-bottom:1px solid #f0f0f0;">${value}</td>
</tr>`;
}

function infoTable(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:0 0 24px;">
  ${rows}
</table>`;
}

function ctaButton(text: string, url: string): string {
  return `<div style="text-align:center;margin:24px 0;">
  <a href="${url}" style="display:inline-block;background:${PRIMARY_COLOR};color:#ffffff;padding:14px 36px;border-radius:10px;text-decoration:none;font-size:13px;font-weight:700;letter-spacing:0.3px;">${text}</a>
</div>`;
}

function mutedNote(text: string): string {
  return `<p style="color:${TEXT_MUTED};font-size:11px;line-height:1.6;margin:16px 0 0;">${text}</p>`;
}

function attachmentBadge(label: string): string {
  return `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:10px 14px;margin:16px 0 0;display:inline-block;">
  <span style="color:#4338ca;font-size:11px;font-weight:700;">📎 ${label}</span>
</div>`;
}

// ─── Template Definitions ─────────────────────────────────────────────

const TEMPLATES: EmailTemplate[] = [
  // ① Auth: Verification OTP
  {
    key: 'auth_verification_otp',
    name: 'Verification OTP Code',
    module: 'Auth',
    triggerEvent: 'User login/signup attempt',
    subject: '{{code}} — Your {{brandName}} Verification Code',
    preheader: 'Use this code to verify your identity on DIYtax9ja',
    bodyHtml: baseLayout(`
      ${sectionTitle('Your Verification Code', 'We received a login request for <strong>{{fullName}}</strong>. Use the code below to verify your identity. It expires in <strong>{{expiryMinutes}} minutes</strong>.')}
      ${codeBox('{{code}}')}
      ${mutedNote('If you did not request this code, please ignore this email. Your account remains secure.<br/>This code is valid for one-time use only.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Adebayo Ogunlade', required: true },
      { key: 'code', label: 'OTP Code', sampleValue: '482915', required: true },
      { key: 'expiryMinutes', label: 'Expiry (minutes)', sampleValue: '5', required: true },
      { key: 'brandName', label: 'Brand Name', sampleValue: 'DIYtax9ja', required: false },
    ],
    hasAttachment: false,
  },

  // ② Auth: Welcome Registration
  {
    key: 'auth_welcome_registration',
    name: 'Welcome — New Registration',
    module: 'Auth',
    triggerEvent: 'First successful taxpayer registration',
    subject: 'Welcome to {{brandName}}, {{fullName}}! 🇳🇬',
    preheader: 'Your Nigerian tax compliance journey starts here',
    bodyHtml: baseLayout(`
      ${sectionTitle('Welcome to DIYtax9ja! 🎉', 'Hello <strong>{{fullName}}</strong>, your account has been successfully created.')}
      ${infoTable(`
        ${infoRow('Account Type', '{{accountType}}')}
        ${infoRow('NIN Status', '{{ninStatus}}')}
        ${infoRow('Registered', '{{registrationDate}}')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        You now have access to our full suite of Nigerian tax tools — including PIT/CIT calculators,
        e-invoicing, payroll management, TCC applications, and automated FIRS e-filing.
      </p>
      ${ctaButton('Go to Your Dashboard', '{{loginUrl}}')}
      ${mutedNote('If you did not create this account, please contact our support team immediately.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Adebayo Ogunlade', required: true },
      { key: 'accountType', label: 'Account Type', sampleValue: 'Individual Taxpayer', required: true },
      { key: 'ninStatus', label: 'NIN Status', sampleValue: 'Linked & Verified', required: false },
      { key: 'loginUrl', label: 'Login URL', sampleValue: 'https://diytax9ja.ng/login', required: true },
      { key: 'registrationDate', label: 'Registration Date', sampleValue: '14 Sep 2026', required: false },
      { key: 'brandName', label: 'Brand Name', sampleValue: 'DIYtax9ja', required: false },
    ],
    hasAttachment: false,
  },

  // ③ Auth: Staff Invitation
  {
    key: 'auth_staff_invitation',
    name: 'Staff Invitation',
    module: 'Auth',
    triggerEvent: 'Super Admin creates admin/reviewer account',
    subject: 'You\'ve Been Invited to Join {{brandName}} as {{role}}',
    preheader: 'You have a new staff account on DIYtax9ja',
    bodyHtml: baseLayout(`
      ${sectionTitle('Staff Account Invitation', 'Hello <strong>{{fullName}}</strong>, you have been invited to join the DIYtax9ja admin team.')}
      ${infoTable(`
        ${infoRow('Your Role', '{{role}}')}
        ${infoRow('Temporary Password', '{{tempPassword}}')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Please log in with your email address and the temporary password above. You will be prompted to change your password on first login.
      </p>
      ${ctaButton('Log In to Admin Portal', '{{loginUrl}}')}
      ${mutedNote('This invitation was sent by a Super Administrator. If you believe this was sent in error, contact admin@diytax9ja.ng.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Fatima Bello', required: true },
      { key: 'role', label: 'Assigned Role', sampleValue: 'Content Manager', required: true },
      { key: 'tempPassword', label: 'Temporary Password', sampleValue: 'AdminPass2026!', required: true },
      { key: 'loginUrl', label: 'Login URL', sampleValue: 'https://diytax9ja.ng/admin', required: true },
      { key: 'brandName', label: 'Brand Name', sampleValue: 'DIYtax9ja', required: false },
    ],
    hasAttachment: false,
  },

  // ④ Auth: Password Reset
  {
    key: 'auth_password_reset',
    name: 'Password Reset Request',
    module: 'Auth',
    triggerEvent: 'Staff requests account recovery',
    subject: 'Password Reset Request — {{brandName}}',
    preheader: 'Reset your DIYtax9ja account password',
    bodyHtml: baseLayout(`
      ${sectionTitle('Password Reset Request', 'Hello <strong>{{fullName}}</strong>, we received a request to reset your account password.')}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Click the button below to create a new password. This link will expire in <strong>{{expiryHours}} hours</strong>.
      </p>
      ${ctaButton('Reset My Password', '{{resetUrl}}')}
      ${mutedNote('If you did not request this password reset, you can safely ignore this email. No changes have been made to your account.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Emeka Nwosu', required: true },
      { key: 'resetUrl', label: 'Reset URL', sampleValue: 'https://diytax9ja.ng/reset?token=abc123', required: true },
      { key: 'expiryHours', label: 'Expiry (hours)', sampleValue: '24', required: true },
      { key: 'brandName', label: 'Brand Name', sampleValue: 'DIYtax9ja', required: false },
    ],
    hasAttachment: false,
  },

  // ⑤ TCC: Approved & Issued
  {
    key: 'tcc_approved_issued',
    name: 'TCC Certificate Issued',
    module: 'TCC',
    triggerEvent: 'Reviewer/Admin approves TCC application',
    subject: 'Tax Clearance Certificate Issued — {{tccNumber}}',
    preheader: 'Your TCC application has been approved',
    bodyHtml: baseLayout(`
      ${sectionTitle('Tax Clearance Certificate Issued ✅', 'Congratulations <strong>{{fullName}}</strong>! Your Tax Clearance Certificate application has been approved and issued.')}
      ${infoTable(`
        ${infoRow('TCC Number', '{{tccNumber}}')}
        ${infoRow('Tax Year', '{{taxYear}}')}
        ${infoRow('Valid Until', '{{validUntil}}')}
        ${infoRow('Issuing Authority', 'Federal Inland Revenue Service (FIRS)')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Your official TCC document is attached to this email as a PDF. You may present this certificate to any contracting entity, government agency, or financial institution as proof of tax compliance.
      </p>
      ${attachmentBadge('TCC_Certificate_{{tccNumber}}.pdf')}
      ${mutedNote('This certificate was electronically generated and verified by the FIRS e-filing system through DIYtax9ja.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Adebayo Ogunlade', required: true },
      { key: 'tccNumber', label: 'TCC Number', sampleValue: 'TCC-2026-NG-00482', required: true },
      { key: 'taxYear', label: 'Tax Year', sampleValue: '2025/2026', required: true },
      { key: 'validUntil', label: 'Valid Until', sampleValue: '31 Dec 2027', required: true },
    ],
    hasAttachment: true,
    attachmentType: 'tcc_pdf',
  },

  // ⑥ TCC: Application Queried
  {
    key: 'tcc_application_queried',
    name: 'TCC Application Query',
    module: 'TCC',
    triggerEvent: 'TCC flagged for arrears or clarification',
    subject: 'Action Required: TCC Application Query — {{tccNumber}}',
    preheader: 'Your TCC application requires additional information',
    bodyHtml: baseLayout(`
      ${sectionTitle('TCC Application Requires Attention ⚠️', 'Hello <strong>{{fullName}}</strong>, your Tax Clearance Certificate application has been flagged for additional review.')}
      ${infoTable(`
        ${infoRow('Reference', '{{tccNumber}}')}
        ${infoRow('Query Reason', '{{queryReason}}')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Please log in to your dashboard and provide the requested documents or clarification to proceed with your application.
      </p>
      ${ctaButton('Respond to Query', '{{actionUrl}}')}
      ${mutedNote('Failure to respond within 14 business days may result in your application being archived.')}
    `),
    mergeTags: [
      { key: 'fullName', label: 'Full Name', sampleValue: 'Ngozi Eze', required: true },
      { key: 'tccNumber', label: 'TCC Reference', sampleValue: 'TCC-2026-NG-00512', required: true },
      { key: 'queryReason', label: 'Query Reason', sampleValue: 'Outstanding WHT remittance for Q3 2025', required: true },
      { key: 'actionUrl', label: 'Action URL', sampleValue: 'https://diytax9ja.ng/tcc/TCC-2026-NG-00512', required: true },
    ],
    hasAttachment: false,
  },

  // ⑦ Invoice: Client Dispatch
  {
    key: 'invoice_client_dispatch',
    name: 'Invoice Dispatch to Client',
    module: 'E-Invoicing',
    triggerEvent: 'Business user dispatches e-invoice to client',
    subject: 'Invoice {{invoiceNumber}} from {{businessName}}',
    preheader: 'You have received an invoice from {{businessName}}',
    bodyHtml: baseLayout(`
      ${sectionTitle('Invoice from {{businessName}}', 'Dear <strong>{{clientName}}</strong>, please find below the details of your invoice.')}
      ${infoTable(`
        ${infoRow('Invoice Number', '{{invoiceNumber}}')}
        ${infoRow('Issue Date', '{{issueDate}}')}
        ${infoRow('Due Date', '{{dueDate}}')}
        ${infoRow('Subtotal', '{{subtotal}}')}
        ${infoRow('VAT (7.5%)', '{{vatAmount}}')}
        ${infoRow('<strong>Total Due</strong>', '<strong>{{totalAmount}}</strong>')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        The full invoice document is attached as a PDF. Payment is due by <strong>{{dueDate}}</strong>.
      </p>
      ${attachmentBadge('Invoice_{{invoiceNumber}}.pdf')}
      ${mutedNote('This invoice was generated through DIYtax9ja\'s FIRS-compliant e-invoicing system. For any queries, please contact {{businessName}} directly.')}
    `),
    mergeTags: [
      { key: 'businessName', label: 'Business Name', sampleValue: 'Ogunlade Consulting Ltd', required: true },
      { key: 'clientName', label: 'Client Name', sampleValue: 'Dangote Industries Plc', required: true },
      { key: 'invoiceNumber', label: 'Invoice Number', sampleValue: 'INV-2026-0042', required: true },
      { key: 'issueDate', label: 'Issue Date', sampleValue: '14 Sep 2026', required: false },
      { key: 'dueDate', label: 'Due Date', sampleValue: '14 Oct 2026', required: true },
      { key: 'subtotal', label: 'Subtotal', sampleValue: '₦2,500,000.00', required: false },
      { key: 'vatAmount', label: 'VAT Amount', sampleValue: '₦187,500.00', required: false },
      { key: 'totalAmount', label: 'Total Amount', sampleValue: '₦2,687,500.00', required: true },
    ],
    hasAttachment: true,
    attachmentType: 'invoice_pdf',
  },

  // ⑧ Invoice: Payment Receipt
  {
    key: 'invoice_payment_receipt',
    name: 'Payment Receipt Confirmation',
    module: 'E-Invoicing',
    triggerEvent: 'Client pays invoice / marked paid',
    subject: 'Payment Received — Invoice {{invoiceNumber}}',
    preheader: 'Thank you for your payment',
    bodyHtml: baseLayout(`
      ${sectionTitle('Payment Confirmed ✅', 'Dear <strong>{{clientName}}</strong>, we confirm receipt of your payment.')}
      ${infoTable(`
        ${infoRow('Invoice Number', '{{invoiceNumber}}')}
        ${infoRow('Amount Paid', '{{amountPaid}}')}
        ${infoRow('Payment Date', '{{paymentDate}}')}
        ${infoRow('Receipt Reference', '{{receiptRef}}')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;">
        Thank you for your prompt payment. This receipt serves as confirmation that your invoice has been settled in full.
      </p>
      ${mutedNote('This is an automated payment confirmation. Please retain this email for your records.')}
    `),
    mergeTags: [
      { key: 'clientName', label: 'Client Name', sampleValue: 'Dangote Industries Plc', required: true },
      { key: 'invoiceNumber', label: 'Invoice Number', sampleValue: 'INV-2026-0042', required: true },
      { key: 'amountPaid', label: 'Amount Paid', sampleValue: '₦2,687,500.00', required: true },
      { key: 'paymentDate', label: 'Payment Date', sampleValue: '28 Sep 2026', required: true },
      { key: 'receiptRef', label: 'Receipt Reference', sampleValue: 'RCP-2026-0042-A', required: true },
    ],
    hasAttachment: false,
  },

  // ⑨ Payroll: Employee Payslip
  {
    key: 'payroll_employee_payslip',
    name: 'Monthly Payslip',
    module: 'Payroll',
    triggerEvent: 'Monthly payroll generation & release',
    subject: 'Your Payslip — {{payPeriod}}',
    preheader: 'Your monthly salary breakdown is ready',
    bodyHtml: baseLayout(`
      ${sectionTitle('Monthly Payslip 💰', 'Hello <strong>{{employeeName}}</strong>, your payslip for <strong>{{payPeriod}}</strong> is ready.')}
      ${infoTable(`
        ${infoRow('Pay Period', '{{payPeriod}}')}
        ${infoRow('Gross Salary', '{{grossSalary}}')}
        ${infoRow('PAYE Tax', '{{payeTax}}')}
        ${infoRow('Pension (8%)', '{{pension}}')}
        ${infoRow('NHF', '{{nhf}}')}
        ${infoRow('<strong>Net Pay</strong>', '<strong style="color:${PRIMARY_COLOR};font-size:15px;">{{netPay}}</strong>')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Your detailed payslip is attached as a PDF. All deductions are computed in compliance with Nigerian tax law and PAYE regulations.
      </p>
      ${attachmentBadge('Payslip_{{payPeriod}}.pdf')}
      ${mutedNote('This payslip is confidential and intended solely for the named employee. If you have any queries, contact your HR department.')}
    `),
    mergeTags: [
      { key: 'employeeName', label: 'Employee Name', sampleValue: 'Chinedu Okafor', required: true },
      { key: 'payPeriod', label: 'Pay Period', sampleValue: 'September 2026', required: true },
      { key: 'grossSalary', label: 'Gross Salary', sampleValue: '₦650,000.00', required: true },
      { key: 'payeTax', label: 'PAYE Tax', sampleValue: '₦78,420.00', required: true },
      { key: 'pension', label: 'Pension', sampleValue: '₦52,000.00', required: true },
      { key: 'nhf', label: 'NHF', sampleValue: '₦16,250.00', required: false },
      { key: 'netPay', label: 'Net Pay', sampleValue: '₦503,330.00', required: true },
    ],
    hasAttachment: true,
    attachmentType: 'payslip_pdf',
  },

  // ⑩ Filing: Tax Filing Acknowledgement
  {
    key: 'tax_filing_acknowledgement',
    name: 'Tax Filing Receipt',
    module: 'Filing',
    triggerEvent: 'User files annual PIT/CIT return',
    subject: 'Filing Acknowledgement — {{filingRef}}',
    preheader: 'Your tax return has been submitted successfully',
    bodyHtml: baseLayout(`
      ${sectionTitle('Tax Filing Acknowledgement 📄', 'Hello <strong>{{taxpayerName}}</strong>, your tax return has been successfully submitted to FIRS.')}
      ${infoTable(`
        ${infoRow('Filing Reference', '{{filingRef}}')}
        ${infoRow('Tax Type', '{{taxType}}')}
        ${infoRow('Assessment Period', '{{period}}')}
        ${infoRow('Computed Liability', '{{liabilityAmount}}')}
        ${infoRow('Status', 'Submitted & Processing')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;margin:0 0 8px;">
        Your official filing receipt is attached. Please retain this document as proof of submission for audit and compliance purposes.
      </p>
      ${attachmentBadge('Filing_Receipt_{{filingRef}}.pdf')}
      ${mutedNote('Processing typically takes 5–10 business days. You will be notified of any assessment updates.')}
    `),
    mergeTags: [
      { key: 'taxpayerName', label: 'Taxpayer Name', sampleValue: 'Adebayo Ogunlade', required: true },
      { key: 'filingRef', label: 'Filing Reference', sampleValue: 'FIRS-PIT-2026-04821', required: true },
      { key: 'taxType', label: 'Tax Type', sampleValue: 'Personal Income Tax (PIT)', required: true },
      { key: 'period', label: 'Assessment Period', sampleValue: 'Jan 2025 – Dec 2025', required: true },
      { key: 'liabilityAmount', label: 'Liability Amount', sampleValue: '₦342,180.00', required: true },
    ],
    hasAttachment: true,
    attachmentType: 'filing_receipt_pdf',
  },

  // ⑪ Compliance: Deadline Reminder
  {
    key: 'compliance_deadline_reminder',
    name: 'Statutory Deadline Reminder',
    module: 'Planner',
    triggerEvent: 'Scheduled notification 14/7/1 days before due dates',
    subject: '⏰ Upcoming Deadline: {{obligationName}} — Due {{dueDate}}',
    preheader: 'Don\'t miss your tax filing deadline',
    bodyHtml: baseLayout(`
      ${sectionTitle('Upcoming Tax Deadline ⏰', 'Hello <strong>{{taxpayerName}}</strong>, you have an upcoming statutory filing obligation.')}
      ${infoTable(`
        ${infoRow('Obligation', '{{obligationName}}')}
        ${infoRow('Filing Type', '{{filingType}}')}
        ${infoRow('Due Date', '<strong style="color:#dc2626;">{{dueDate}}</strong>')}
      `)}
      <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 18px;margin:0 0 20px;">
        <p style="color:#991b1b;font-size:12px;font-weight:700;margin:0;">⚠️ Penalty Warning</p>
        <p style="color:#b91c1c;font-size:12px;margin:6px 0 0;line-height:1.5;">{{penaltyWarning}}</p>
      </div>
      ${ctaButton('File Now on DIYtax9ja', 'https://diytax9ja.ng/dashboard')}
      ${mutedNote('This reminder is generated based on the Nigerian FIRS statutory filing calendar.')}
    `),
    mergeTags: [
      { key: 'taxpayerName', label: 'Taxpayer Name', sampleValue: 'Ogunlade Consulting Ltd', required: true },
      { key: 'obligationName', label: 'Obligation Name', sampleValue: 'Monthly PAYE Remittance', required: true },
      { key: 'dueDate', label: 'Due Date', sampleValue: '10 Oct 2026', required: true },
      { key: 'filingType', label: 'Filing Type', sampleValue: 'PAYE (Pay-As-You-Earn)', required: true },
      { key: 'penaltyWarning', label: 'Penalty Warning', sampleValue: 'Late filing attracts a penalty of ₦50,000 plus 10% of the tax due, compounding monthly under the Personal Income Tax Act.', required: true },
    ],
    hasAttachment: false,
  },

  // ⑫ WHT: Credit Note Issued
  {
    key: 'wht_credit_note_issued',
    name: 'WHT Credit Note Issued',
    module: 'WHT',
    triggerEvent: 'WHT deducted at source for vendor',
    subject: 'WHT Credit Note Issued — {{creditNoteRef}}',
    preheader: 'Withholding Tax credit note for your records',
    bodyHtml: baseLayout(`
      ${sectionTitle('Withholding Tax Credit Note', 'Dear <strong>{{vendorName}}</strong>, a WHT credit note has been issued for your records.')}
      ${infoTable(`
        ${infoRow('Credit Note Ref', '{{creditNoteRef}}')}
        ${infoRow('Deducting Party', '{{deductorName}}')}
        ${infoRow('WHT Rate', '{{whtRate}}')}
        ${infoRow('WHT Amount', '{{whtAmount}}')}
        ${infoRow('Applicable Period', '{{applicablePeriod}}')}
      `)}
      <p style="color:${TEXT_SECONDARY};font-size:13px;line-height:1.7;">
        This credit note confirms withholding tax deducted at source. You may use this as a credit against your annual tax liability when filing your returns with FIRS.
      </p>
      ${mutedNote('Credit notes are automatically logged in your DIYtax9ja WHT Tracker for easy reconciliation.')}
    `),
    mergeTags: [
      { key: 'vendorName', label: 'Vendor Name', sampleValue: 'Ogunlade Consulting Ltd', required: true },
      { key: 'deductorName', label: 'Deducting Party', sampleValue: 'Total Energies Nigeria Plc', required: true },
      { key: 'creditNoteRef', label: 'Credit Note Ref', sampleValue: 'WHT-CN-2026-0091', required: true },
      { key: 'whtRate', label: 'WHT Rate', sampleValue: '10%', required: true },
      { key: 'whtAmount', label: 'WHT Amount', sampleValue: '₦250,000.00', required: true },
      { key: 'applicablePeriod', label: 'Applicable Period', sampleValue: 'Q3 2026 (Jul – Sep)', required: true },
    ],
    hasAttachment: false,
  },
];

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Get all available email templates.
 */
export function getAllTemplates(): EmailTemplate[] {
  return TEMPLATES;
}

/**
 * Get a single template by its key.
 */
export function getTemplate(key: EmailTemplateKey): EmailTemplate | undefined {
  return TEMPLATES.find(t => t.key === key);
}

/**
 * Get templates filtered by module.
 */
export function getTemplatesByModule(module: EmailTemplate['module']): EmailTemplate[] {
  return TEMPLATES.filter(t => t.module === module);
}

/**
 * Interpolate merge tags into a template string.
 * Performs XSS-safe HTML escaping on all merge values.
 *
 * @param template The HTML template string with {{tag}} placeholders
 * @param data     Key-value map of merge tag values
 * @returns        The interpolated HTML string
 */
export function interpolateMergeTags(template: string, data: Record<string, string>): string {
  let result = template;

  // Replace all {{key}} occurrences with escaped values
  for (const [key, value] of Object.entries(data)) {
    const escaped = escapeHtml(value);
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
    result = result.replace(regex, escaped);
  }

  // Remove any remaining unreplaced tags (optional fields)
  result = result.replace(/\{\{[a-zA-Z_]+\}\}/g, '');

  return result;
}

/**
 * Render a complete email by combining template lookup + merge tag interpolation.
 */
export function renderEmail(
  templateKey: EmailTemplateKey,
  mergeData: Record<string, string>
): { subject: string; html: string } | null {
  const template = getTemplate(templateKey);
  if (!template) return null;

  return {
    subject: interpolateMergeTags(template.subject, mergeData),
    html: interpolateMergeTags(template.bodyHtml, mergeData),
  };
}

/**
 * Get sample merge data for a template (for live preview in template editor).
 */
export function getSampleMergeData(templateKey: EmailTemplateKey): Record<string, string> {
  const template = getTemplate(templateKey);
  if (!template) return {};

  const data: Record<string, string> = {};
  for (const tag of template.mergeTags) {
    data[tag.key] = tag.sampleValue;
  }
  return data;
}

// ─── Utilities ────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

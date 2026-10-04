/**
 * email.ts — Email System Type Definitions for NairaTax
 *
 * Comprehensive TypeScript definitions for the SMTP configuration,
 * email template engine, dispatch payloads, and audit logging.
 */

// ─── SMTP Provider Configuration ──────────────────────────────────────

export type SMTPProvider = 'sendgrid' | 'ses' | 'mailgun' | 'brevo' | 'postmark' | 'gmail' | 'custom';

export interface SMTPSettings {
  provider: SMTPProvider;
  host: string;
  port: number;
  secure: boolean; // true for 465 (SSL), false for 587 (STARTTLS)
  auth: {
    user: string;
    pass: string; // Encrypted / masked in UI
  };
  senderName: string;   // e.g. "DIYtax9ja Tax Portal"
  senderEmail: string;  // e.g. "noreply@diytax9ja.ng"
  replyTo?: string;
  enableTracking?: boolean;
  active: boolean;
  lastTestedAt?: string;
  lastTestResult?: 'success' | 'failure';
}

export interface SMTPPreset {
  provider: SMTPProvider;
  label: string;
  host: string;
  port: number;
  secure: boolean;
  description: string;
  icon: string; // emoji
  authHint: string;
}

// ─── Email Template Engine ────────────────────────────────────────────

export type EmailTemplateKey =
  | 'auth_verification_otp'
  | 'auth_welcome_registration'
  | 'auth_staff_invitation'
  | 'auth_password_reset'
  | 'tcc_approved_issued'
  | 'tcc_application_queried'
  | 'invoice_client_dispatch'
  | 'invoice_payment_receipt'
  | 'payroll_employee_payslip'
  | 'tax_filing_acknowledgement'
  | 'compliance_deadline_reminder'
  | 'wht_credit_note_issued';

export type EmailModule = 'Auth' | 'TCC' | 'E-Invoicing' | 'Payroll' | 'Filing' | 'WHT' | 'Planner';

export interface MergeTag {
  key: string;       // e.g. "fullName"
  label: string;     // e.g. "Full Name"
  sampleValue: string;
  required: boolean;
}

export interface EmailTemplate {
  key: EmailTemplateKey;
  name: string;
  module: EmailModule;
  triggerEvent: string;
  subject: string;       // May contain merge tags: "{{code}} — Your Verification Code"
  preheader?: string;    // Preview text in email clients
  bodyHtml: string;      // HTML template with {{mergeTags}}
  mergeTags: MergeTag[];
  hasAttachment: boolean;
  attachmentType?: 'invoice_pdf' | 'payslip_pdf' | 'tcc_pdf' | 'filing_receipt_pdf';
  isCustomized?: boolean;
  lastModifiedAt?: string;
}

// ─── Email Dispatch ───────────────────────────────────────────────────

export interface EmailAttachment {
  filename: string;
  content: string;  // Base64 encoded content
  contentType: string;
  encoding: 'base64';
}

export interface EmailDispatchPayload {
  templateKey: EmailTemplateKey;
  recipientEmail: string;
  recipientName?: string;
  subject?: string;       // Override template subject
  mergeData: Record<string, string>;
  attachments?: EmailAttachment[];
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
}

export interface EmailDispatchResult {
  success: boolean;
  messageId?: string;
  error?: string;
  dispatchedAt: string;
  mode: 'live' | 'sandbox';
}

// ─── Email Audit Log ──────────────────────────────────────────────────

export type EmailDeliveryStatus = 'Queued' | 'Sent' | 'Delivered' | 'Failed' | 'Bounced';

export interface EmailLogEntry {
  id: string;
  templateKey: EmailTemplateKey;
  templateName: string;
  recipientEmail: string;
  recipientName?: string;
  subject: string;
  status: EmailDeliveryStatus;
  messageId?: string;
  error?: string;
  sentAt: string;
  deliveredAt?: string;
  mode: 'live' | 'sandbox';
}

// ─── SMTP Test ────────────────────────────────────────────────────────

export interface SMTPTestResult {
  success: boolean;
  steps: SMTPTestStep[];
  latencyMs?: number;
  error?: string;
}

export interface SMTPTestStep {
  name: string;
  status: 'pass' | 'fail' | 'pending' | 'skipped';
  message: string;
  durationMs?: number;
}

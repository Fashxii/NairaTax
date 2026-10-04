/**
 * emailService.ts — DIYtax9ja Email Dispatch Service SDK
 *
 * Client-side email dispatch that:
 * 1. Sends via server endpoint (Cloud Functions) when available
 * 2. Falls back to in-app Dev Sandbox for local development
 * 3. Maintains a local audit log of all dispatched emails
 * 4. Manages SMTP settings persistence
 */

import { getStored, setStored } from './store';
import { renderEmail, getTemplate } from './emailTemplates';
import type {
  SMTPSettings,
  SMTPPreset,
  SMTPProvider,
  EmailDispatchPayload,
  EmailDispatchResult,
  EmailLogEntry,
  EmailDeliveryStatus,
  EmailTemplateKey,
  SMTPTestResult,
  SMTPTestStep,
} from '../types/email';

// ─── SMTP Provider Presets ────────────────────────────────────────────

export const SMTP_PRESETS: SMTPPreset[] = [
  {
    provider: 'sendgrid',
    label: 'SendGrid',
    host: 'smtp.sendgrid.net',
    port: 587,
    secure: false,
    description: 'Twilio SendGrid — Enterprise email delivery',
    icon: '📧',
    authHint: 'Username: "apikey" / Password: your API key',
  },
  {
    provider: 'ses',
    label: 'Amazon SES',
    host: 'email-smtp.us-east-1.amazonaws.com',
    port: 587,
    secure: false,
    description: 'AWS Simple Email Service',
    icon: '☁️',
    authHint: 'Use SMTP credentials from AWS IAM console',
  },
  {
    provider: 'mailgun',
    label: 'Mailgun',
    host: 'smtp.mailgun.org',
    port: 587,
    secure: false,
    description: 'Mailgun — Developer-friendly email API',
    icon: '🔫',
    authHint: 'Domain username + API key from Mailgun dashboard',
  },
  {
    provider: 'brevo',
    label: 'Brevo (Sendinblue)',
    host: 'smtp-relay.brevo.com',
    port: 587,
    secure: false,
    description: 'Brevo — Marketing & transactional email',
    icon: '💙',
    authHint: 'Login email + SMTP password from Brevo settings',
  },
  {
    provider: 'postmark',
    label: 'Postmark',
    host: 'smtp.postmarkapp.com',
    port: 587,
    secure: false,
    description: 'Postmark — Reliable transactional email',
    icon: '📬',
    authHint: 'Server API token as both username and password',
  },
  {
    provider: 'gmail',
    label: 'Gmail / Google Workspace',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    description: 'Google Gmail or Workspace SMTP',
    icon: '📩',
    authHint: 'Gmail address + App Password (enable 2FA first)',
  },
  {
    provider: 'custom',
    label: 'Custom SMTP Server',
    host: '',
    port: 587,
    secure: false,
    description: 'Configure any SMTP server manually',
    icon: '⚙️',
    authHint: 'Enter your SMTP host, port, and credentials',
  },
];

// ─── Storage Keys ─────────────────────────────────────────────────────

const SMTP_SETTINGS_KEY = 'smtp_settings';
const EMAIL_LOG_KEY = 'email_audit_log';
const SANDBOX_EMAILS_KEY = 'email_sandbox';

// ─── SMTP Settings Management ─────────────────────────────────────────

export function getSMTPSettings(): SMTPSettings | null {
  return getStored<SMTPSettings | null>(SMTP_SETTINGS_KEY, null);
}

export function saveSMTPSettings(settings: SMTPSettings): void {
  setStored(SMTP_SETTINGS_KEY, settings);
}

export function getPresetForProvider(provider: SMTPProvider): SMTPPreset | undefined {
  return SMTP_PRESETS.find(p => p.provider === provider);
}

export function isSMTPConfigured(): boolean {
  const settings = getSMTPSettings();
  return !!(settings && settings.active && settings.host && settings.auth.user);
}

// ─── Email Dispatch ───────────────────────────────────────────────────

/**
 * Send an email via the server API or fall back to the dev sandbox.
 */
export async function sendEmail(payload: EmailDispatchPayload): Promise<EmailDispatchResult> {
  const template = getTemplate(payload.templateKey);
  if (!template) {
    return {
      success: false,
      error: `Template not found: ${payload.templateKey}`,
      dispatchedAt: new Date().toISOString(),
      mode: 'sandbox',
    };
  }

  // Render the template with merge data
  const rendered = renderEmail(payload.templateKey, payload.mergeData);
  if (!rendered) {
    return {
      success: false,
      error: 'Failed to render email template.',
      dispatchedAt: new Date().toISOString(),
      mode: 'sandbox',
    };
  }

  const subject = payload.subject || rendered.subject;

  try {
    // Attempt server dispatch
    const res = await fetch('/api/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        renderedSubject: subject,
        renderedHtml: rendered.html,
      }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Server email dispatch failed.');
    }

    const data = await res.json();

    const result: EmailDispatchResult = {
      success: true,
      messageId: data.messageId,
      dispatchedAt: new Date().toISOString(),
      mode: 'live',
    };

    // Log to audit trail
    logEmailDispatch(payload, subject, 'Sent', result);

    return result;
  } catch (err: any) {
    // In production, report the real failure instead of faking delivery.
    if (!import.meta.env.DEV) {
      console.error('[Email] Dispatch failed:', err.message);
      const failedResult: EmailDispatchResult = {
        success: false,
        error: err.message || 'Email dispatch failed.',
        dispatchedAt: new Date().toISOString(),
        mode: 'live',
      };
      logEmailDispatch(payload, subject, 'Failed', failedResult);
      return failedResult;
    }

    // ── Dev Sandbox Fallback (npm run dev only) ───────────────────
    console.warn('[Email] Server unavailable — routing to Dev Sandbox:', err.message);

    const sandboxResult: EmailDispatchResult = {
      success: true,
      messageId: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      dispatchedAt: new Date().toISOString(),
      mode: 'sandbox',
    };

    // Store in sandbox for preview
    const sandboxEntry = {
      id: sandboxResult.messageId!,
      to: payload.recipientEmail,
      toName: payload.recipientName || '',
      subject,
      html: rendered.html,
      templateKey: payload.templateKey,
      templateName: template.name,
      sentAt: sandboxResult.dispatchedAt,
      attachments: payload.attachments?.map(a => a.filename) || [],
    };

    const sandbox = getStored<typeof sandboxEntry[]>(SANDBOX_EMAILS_KEY, []);
    sandbox.unshift(sandboxEntry);
    // Keep last 100 sandbox emails
    setStored(SANDBOX_EMAILS_KEY, sandbox.slice(0, 100));

    // Log to audit trail
    logEmailDispatch(payload, subject, 'Sent', sandboxResult);

    // Console output for dev visibility
    console.log(`\n══════════════════════════════════════════`);
    console.log(`  📧 DIYtax9ja Email (Dev Sandbox)`);
    console.log(`  To      : ${payload.recipientEmail}`);
    console.log(`  Subject : ${subject}`);
    console.log(`  Template: ${template.name}`);
    console.log(`  ID      : ${sandboxResult.messageId}`);
    console.log(`══════════════════════════════════════════\n`);

    return sandboxResult;
  }
}

// ─── SMTP Test ────────────────────────────────────────────────────────

/**
 * Test SMTP connection via the server API, or simulate locally.
 */
export async function testSMTPConnection(
  settings: SMTPSettings,
  testEmail: string
): Promise<SMTPTestResult> {
  try {
    const res = await fetch('/api/email/test-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settings, testEmail }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'SMTP test failed on server.');
    }

    return await res.json();
  } catch (err: any) {
    // In production, never simulate a passing test.
    if (!import.meta.env.DEV) {
      console.error('[Email] SMTP test failed:', err.message);
      return {
        success: false,
        steps: [
          { name: 'Server Request', status: 'fail', message: err.message || 'SMTP test service unavailable.', durationMs: 0 },
        ],
        latencyMs: 0,
      };
    }

    // Simulate SMTP test steps for local dev (npm run dev only)
    console.warn('[Email] SMTP test running in simulation mode:', err.message);

    const steps: SMTPTestStep[] = [
      { name: 'DNS Resolution', status: 'pass', message: `Resolved ${settings.host}`, durationMs: 45 },
      { name: 'TCP Connection', status: 'pass', message: `Connected to ${settings.host}:${settings.port}`, durationMs: 120 },
      { name: 'TLS Handshake', status: settings.secure ? 'pass' : 'pass', message: settings.secure ? 'SSL/TLS established' : 'STARTTLS upgrade successful', durationMs: 85 },
      { name: 'Authentication', status: settings.auth.user ? 'pass' : 'fail', message: settings.auth.user ? `Authenticated as ${settings.auth.user}` : 'No credentials provided', durationMs: 60 },
      { name: 'Test Email Delivery', status: 'pass', message: `Test email queued for ${testEmail}`, durationMs: 200 },
    ];

    return {
      success: steps.every(s => s.status === 'pass'),
      steps,
      latencyMs: steps.reduce((sum, s) => sum + (s.durationMs || 0), 0),
    };
  }
}

// ─── Audit Log ────────────────────────────────────────────────────────

function logEmailDispatch(
  payload: EmailDispatchPayload,
  subject: string,
  status: EmailDeliveryStatus,
  result: EmailDispatchResult
): void {
  const template = getTemplate(payload.templateKey);
  const entry: EmailLogEntry = {
    id: result.messageId || `log-${Date.now()}`,
    templateKey: payload.templateKey,
    templateName: template?.name || payload.templateKey,
    recipientEmail: payload.recipientEmail,
    recipientName: payload.recipientName,
    subject,
    status,
    messageId: result.messageId,
    error: result.error,
    sentAt: result.dispatchedAt,
    mode: result.mode,
  };

  const logs = getStored<EmailLogEntry[]>(EMAIL_LOG_KEY, []);
  logs.unshift(entry);
  // Keep last 500 log entries
  setStored(EMAIL_LOG_KEY, logs.slice(0, 500));
}

/**
 * Get all email audit log entries.
 */
export function getEmailAuditLogs(): EmailLogEntry[] {
  return getStored<EmailLogEntry[]>(EMAIL_LOG_KEY, []);
}

/**
 * Get sandbox emails for dev preview.
 */
export function getSandboxEmails(): Array<{
  id: string;
  to: string;
  toName: string;
  subject: string;
  html: string;
  templateKey: EmailTemplateKey;
  templateName: string;
  sentAt: string;
  attachments: string[];
}> {
  return getStored(SANDBOX_EMAILS_KEY, []);
}

/**
 * Clear all sandbox emails.
 */
export function clearSandbox(): void {
  setStored(SANDBOX_EMAILS_KEY, []);
}

/**
 * Get email log stats for dashboard KPIs.
 */
export function getEmailStats(): {
  totalSent: number;
  totalFailed: number;
  todaySent: number;
  sandboxCount: number;
} {
  const logs = getEmailAuditLogs();
  const today = new Date().toISOString().split('T')[0];

  return {
    totalSent: logs.filter(l => l.status === 'Sent' || l.status === 'Delivered').length,
    totalFailed: logs.filter(l => l.status === 'Failed' || l.status === 'Bounced').length,
    todaySent: logs.filter(l => l.sentAt.startsWith(today) && (l.status === 'Sent' || l.status === 'Delivered')).length,
    sandboxCount: getSandboxEmails().length,
  };
}

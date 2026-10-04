/**
 * emailTemplates.test.ts — Unit Tests for Email Template Library
 *
 * Verifies:
 * - All 12 templates compile without missing required variables
 * - Merge tag interpolation works correctly
 * - XSS escaping is applied
 * - Fallback behavior for optional merge tags
 * - Template registry access functions
 */

import { describe, test, expect } from 'vitest';
import {
  getAllTemplates,
  getTemplate,
  getTemplatesByModule,
  interpolateMergeTags,
  renderEmail,
  getSampleMergeData,
} from './emailTemplates';
import type { EmailTemplateKey } from '../types/email';

// ─── Template Registry Tests ──────────────────────────────────────────

describe('Email Template Registry', () => {
  test('should contain exactly 12 templates', () => {
    const templates = getAllTemplates();
    expect(templates).toHaveLength(12);
  });

  test('all templates should have unique keys', () => {
    const templates = getAllTemplates();
    const keys = templates.map(t => t.key);
    const uniqueKeys = new Set(keys);
    expect(uniqueKeys.size).toBe(keys.length);
  });

  test('all templates should have required fields', () => {
    const templates = getAllTemplates();
    for (const t of templates) {
      expect(t.key).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.module).toBeTruthy();
      expect(t.triggerEvent).toBeTruthy();
      expect(t.subject).toBeTruthy();
      expect(t.bodyHtml).toBeTruthy();
      expect(t.mergeTags.length).toBeGreaterThan(0);
      expect(typeof t.hasAttachment).toBe('boolean');
    }
  });

  test('all template keys should match expected list', () => {
    const expectedKeys: EmailTemplateKey[] = [
      'auth_verification_otp',
      'auth_welcome_registration',
      'auth_staff_invitation',
      'auth_password_reset',
      'tcc_approved_issued',
      'tcc_application_queried',
      'invoice_client_dispatch',
      'invoice_payment_receipt',
      'payroll_employee_payslip',
      'tax_filing_acknowledgement',
      'compliance_deadline_reminder',
      'wht_credit_note_issued',
    ];

    const templates = getAllTemplates();
    const actualKeys = templates.map(t => t.key);

    for (const key of expectedKeys) {
      expect(actualKeys).toContain(key);
    }
  });

  test('templates with attachments should specify attachment type', () => {
    const templates = getAllTemplates();
    const withAttachments = templates.filter(t => t.hasAttachment);
    expect(withAttachments.length).toBeGreaterThan(0);

    for (const t of withAttachments) {
      expect(t.attachmentType).toBeTruthy();
      expect(['invoice_pdf', 'payslip_pdf', 'tcc_pdf', 'filing_receipt_pdf']).toContain(t.attachmentType);
    }
  });
});

// ─── Template Lookup Tests ────────────────────────────────────────────

describe('Template Lookup', () => {
  test('getTemplate should return template for valid key', () => {
    const template = getTemplate('auth_verification_otp');
    expect(template).toBeDefined();
    expect(template!.key).toBe('auth_verification_otp');
    expect(template!.name).toBe('Verification OTP Code');
  });

  test('getTemplate should return undefined for invalid key', () => {
    const template = getTemplate('nonexistent_key' as EmailTemplateKey);
    expect(template).toBeUndefined();
  });

  test('getTemplatesByModule should filter correctly', () => {
    const authTemplates = getTemplatesByModule('Auth');
    expect(authTemplates.length).toBe(4);
    for (const t of authTemplates) {
      expect(t.module).toBe('Auth');
    }
  });

  test('getTemplatesByModule should return TCC templates', () => {
    const tccTemplates = getTemplatesByModule('TCC');
    expect(tccTemplates.length).toBe(2);
  });

  test('getTemplatesByModule should return E-Invoicing templates', () => {
    const invoiceTemplates = getTemplatesByModule('E-Invoicing');
    expect(invoiceTemplates.length).toBe(2);
  });
});

// ─── Merge Tag Interpolation Tests ────────────────────────────────────

describe('Merge Tag Interpolation', () => {
  test('should replace all merge tags with values', () => {
    const template = 'Hello {{fullName}}, your code is {{code}}.';
    const result = interpolateMergeTags(template, {
      fullName: 'Adebayo Ogunlade',
      code: '123456',
    });
    expect(result).toBe('Hello Adebayo Ogunlade, your code is 123456.');
  });

  test('should handle multiple occurrences of the same tag', () => {
    const template = '{{name}} is great. We love {{name}}.';
    const result = interpolateMergeTags(template, { name: 'NairaTax' });
    expect(result).toBe('NairaTax is great. We love NairaTax.');
  });

  test('should remove unreplaced optional tags', () => {
    const template = 'Hello {{fullName}}. NIN: {{ninStatus}}.';
    const result = interpolateMergeTags(template, { fullName: 'Test User' });
    expect(result).toBe('Hello Test User. NIN: .');
  });

  test('should escape HTML in merge values (XSS protection)', () => {
    const template = 'Name: {{fullName}}';
    const result = interpolateMergeTags(template, {
      fullName: '<script>alert("xss")</script>',
    });
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
  });

  test('should escape ampersands in merge values', () => {
    const template = 'Company: {{name}}';
    const result = interpolateMergeTags(template, { name: 'A & B Corp' });
    expect(result).toContain('A &amp; B Corp');
  });

  test('should escape quotes in merge values', () => {
    const template = 'Note: {{note}}';
    const result = interpolateMergeTags(template, { note: 'He said "hello"' });
    expect(result).toContain('&quot;hello&quot;');
  });
});

// ─── Full Template Rendering Tests ────────────────────────────────────

describe('Full Template Rendering', () => {
  test('renderEmail should return subject and html for valid template', () => {
    const result = renderEmail('auth_verification_otp', {
      fullName: 'Adebayo Ogunlade',
      code: '482915',
      expiryMinutes: '5',
      brandName: 'DIYtax9ja',
    });

    expect(result).not.toBeNull();
    expect(result!.subject).toContain('482915');
    expect(result!.subject).toContain('DIYtax9ja');
    expect(result!.html).toContain('482915');
    expect(result!.html).toContain('Adebayo Ogunlade');
    expect(result!.html).toContain('5 minutes');
  });

  test('renderEmail should return null for invalid template key', () => {
    const result = renderEmail('invalid_key' as EmailTemplateKey, {});
    expect(result).toBeNull();
  });

  test('all templates should render successfully with sample data', () => {
    const templates = getAllTemplates();

    for (const template of templates) {
      const sampleData = getSampleMergeData(template.key);
      const result = renderEmail(template.key, sampleData);

      expect(result).not.toBeNull();
      expect(result!.subject.length).toBeGreaterThan(0);
      expect(result!.html).toContain('<!DOCTYPE html>');
      expect(result!.html).toContain('DIYtax9ja');
      expect(result!.html).toContain('NDPA 2023'); // NDPR compliance footer
    }
  });

  test('TCC template should contain certificate details', () => {
    const result = renderEmail('tcc_approved_issued', {
      fullName: 'Test User',
      tccNumber: 'TCC-2026-NG-00482',
      taxYear: '2025/2026',
      validUntil: '31 Dec 2027',
    });

    expect(result!.html).toContain('TCC-2026-NG-00482');
    expect(result!.html).toContain('2025/2026');
    expect(result!.html).toContain('31 Dec 2027');
  });

  test('Invoice template should contain financial details', () => {
    const result = renderEmail('invoice_client_dispatch', {
      businessName: 'Ogunlade Consulting',
      clientName: 'Dangote Industries',
      invoiceNumber: 'INV-2026-0042',
      dueDate: '14 Oct 2026',
      totalAmount: '₦2,687,500.00',
      vatAmount: '₦187,500.00',
      subtotal: '₦2,500,000.00',
    });

    expect(result!.html).toContain('INV-2026-0042');
    expect(result!.html).toContain('Dangote Industries');
  });

  test('Payroll template should contain salary breakdown', () => {
    const result = renderEmail('payroll_employee_payslip', {
      employeeName: 'Chinedu Okafor',
      payPeriod: 'September 2026',
      grossSalary: '₦650,000.00',
      payeTax: '₦78,420.00',
      pension: '₦52,000.00',
      netPay: '₦503,330.00',
    });

    expect(result!.html).toContain('Chinedu Okafor');
    expect(result!.html).toContain('September 2026');
  });

  test('Deadline reminder should contain penalty warning', () => {
    const result = renderEmail('compliance_deadline_reminder', {
      taxpayerName: 'Ogunlade Consulting',
      obligationName: 'Monthly PAYE Remittance',
      dueDate: '10 Oct 2026',
      filingType: 'PAYE',
      penaltyWarning: 'Late filing attracts a penalty of ₦50,000',
    });

    expect(result!.html).toContain('PAYE');
    expect(result!.html).toContain('₦50,000');
  });
});

// ─── Sample Data Tests ────────────────────────────────────────────────

describe('Sample Merge Data', () => {
  test('getSampleMergeData should return data for all merge tags', () => {
    const templates = getAllTemplates();

    for (const template of templates) {
      const data = getSampleMergeData(template.key);
      for (const tag of template.mergeTags) {
        expect(data[tag.key]).toBe(tag.sampleValue);
      }
    }
  });

  test('getSampleMergeData should return empty object for invalid key', () => {
    const data = getSampleMergeData('invalid_key' as EmailTemplateKey);
    expect(Object.keys(data)).toHaveLength(0);
  });
});

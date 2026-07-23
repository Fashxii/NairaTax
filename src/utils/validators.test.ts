/**
 * validators.test.ts — Unit tests for input validation utilities
 */

import { describe, it, expect } from 'vitest';
import { validateNIN, validateEmail, validatePhone, validateContact, sanitize, validateAmount } from './validators';

describe('validateNIN', () => {
  it('accepts valid 11-digit NIN', () => {
    expect(validateNIN('12345678901').valid).toBe(true);
  });

  it('rejects NIN with fewer than 11 digits', () => {
    const result = validateNIN('1234567890');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('11 digits');
  });

  it('rejects NIN with more than 11 digits', () => {
    expect(validateNIN('123456789012').valid).toBe(false);
  });

  it('rejects NIN with non-digit characters', () => {
    const result = validateNIN('1234567890a');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('digits');
  });

  it('rejects empty NIN', () => {
    expect(validateNIN('').valid).toBe(false);
  });

  it('strips spaces from NIN', () => {
    expect(validateNIN('123 4567 8901').valid).toBe(true);
  });
});

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com').valid).toBe(true);
  });

  it('accepts email with subdomain', () => {
    expect(validateEmail('user@mail.example.co.ng').valid).toBe(true);
  });

  it('rejects email without @', () => {
    expect(validateEmail('userexample.com').valid).toBe(false);
  });

  it('rejects email without domain', () => {
    expect(validateEmail('user@').valid).toBe(false);
  });

  it('rejects empty email', () => {
    expect(validateEmail('').valid).toBe(false);
  });
});

describe('validatePhone', () => {
  it('accepts valid MTN number', () => {
    expect(validatePhone('08012345678').valid).toBe(true);
  });

  it('accepts valid Airtel number', () => {
    expect(validatePhone('09012345678').valid).toBe(true);
  });

  it('accepts number with +234 prefix', () => {
    expect(validatePhone('+2348012345678').valid).toBe(true);
  });

  it('accepts number with spaces and dashes', () => {
    expect(validatePhone('080-1234-5678').valid).toBe(true);
  });

  it('rejects invalid prefix', () => {
    expect(validatePhone('02012345678').valid).toBe(false);
  });

  it('rejects too short', () => {
    expect(validatePhone('08012345').valid).toBe(false);
  });

  it('rejects empty', () => {
    expect(validatePhone('').valid).toBe(false);
  });
});

describe('validateContact', () => {
  it('detects email and validates', () => {
    expect(validateContact('user@example.com').valid).toBe(true);
  });

  it('detects phone and validates', () => {
    expect(validateContact('08012345678').valid).toBe(true);
  });

  it('rejects empty contact', () => {
    expect(validateContact('').valid).toBe(false);
  });

  it('rejects invalid email', () => {
    expect(validateContact('user@').valid).toBe(false);
  });
});

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<script>alert("xss")</script>Hello')).toBe('Hello');
  });

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello');
  });

  it('handles clean text', () => {
    expect(sanitize('hello world')).toBe('hello world');
  });
});

describe('validateAmount', () => {
  it('accepts valid number', () => {
    const result = validateAmount('500000');
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(500000);
  });

  it('accepts formatted number with commas and naira sign', () => {
    const result = validateAmount('₦1,500,000');
    expect(result.valid).toBe(true);
    expect(result.amount).toBe(1500000);
  });

  it('rejects negative amount', () => {
    expect(validateAmount('-500').valid).toBe(false);
  });

  it('rejects empty', () => {
    expect(validateAmount('').valid).toBe(false);
  });
});

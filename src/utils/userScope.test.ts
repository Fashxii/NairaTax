/**
 * userScope.test.ts — identity helpers never fall back to fake names,
 * and storage keys are isolated per user.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getDisplayName, getGreetingName, getInitials, scopedKey, isDemoSession, DEMO_EMAIL } from './userScope';
import { registerUser } from './authStore';
import { setStored } from './store';

describe('userScope', () => {
  beforeEach(() => {
    setStored('registered_users', []);
  });

  it('uses the session name first', () => {
    expect(getDisplayName({ fullName: 'Ngozi Okafor', contactMethod: 'n@example.com' })).toBe('Ngozi Okafor');
  });

  it('falls back to the registered name, then the email', () => {
    registerUser('reg@example.com', 'Tunde Bakare', 'individual');
    expect(getDisplayName({ fullName: '', contactMethod: 'reg@example.com' })).toBe('Tunde Bakare');
    expect(getDisplayName({ fullName: '', contactMethod: 'amaka@example.com' })).toBe('Amaka');
  });

  it('greets individuals by first name and businesses by full name', () => {
    expect(getGreetingName({ fullName: 'Ngozi Okafor', contactMethod: 'x', accountType: 'individual' })).toBe('Ngozi');
    expect(getGreetingName({ fullName: 'Apex Ventures Ltd', contactMethod: 'x', accountType: 'business' })).toBe('Apex Ventures Ltd');
  });

  it('builds initials', () => {
    expect(getInitials('Ngozi Okafor')).toBe('NO');
    expect(getInitials('Amaka')).toBe('A');
    expect(getInitials('  ')).toBe('?');
  });

  it('scopes keys per user and detects the demo account', () => {
    expect(scopedKey({ contactMethod: 'A@Example.com' }, 'filings')).toBe('filings:a@example.com');
    expect(scopedKey({ contactMethod: 'b@example.com' }, 'filings')).not.toBe(scopedKey({ contactMethod: 'a@example.com' }, 'filings'));
    expect(isDemoSession({ contactMethod: DEMO_EMAIL })).toBe(true);
    expect(isDemoSession({ contactMethod: 'real@example.com' })).toBe(false);
  });
});

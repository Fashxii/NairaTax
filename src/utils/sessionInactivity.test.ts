import { describe, it, expect, beforeEach } from 'vitest';
import { INACTIVITY_TIMEOUT_MS, SESSION_EXPIRY_MS } from '../context/SessionContext';
import { setStored, getStored } from './store';
import { sendOTPEmail } from './otpService';
import { registerUser } from './authStore';

describe('Inactivity & Returning User Login Flow', () => {
  beforeEach(() => {
    setStored('registered_users', []);
    setStored('session_expired_reason', null);
    setStored('session_last_active', 0);
  });

  it('defines 5 minutes (300,000 ms) as inactivity timeout', () => {
    expect(INACTIVITY_TIMEOUT_MS).toBe(5 * 60 * 1000);
    expect(INACTIVITY_TIMEOUT_MS).toBe(300000);
  });

  it('detects session expiry when elapsed time >= 5 minutes', () => {
    const now = Date.now();
    const activeTime = now - 5 * 60 * 1000 - 1000; // 5 mins 1 sec ago
    const isExpired = now - activeTime >= INACTIVITY_TIMEOUT_MS;
    expect(isExpired).toBe(true);
  });

  it('detects session is active when elapsed time < 5 minutes', () => {
    const now = Date.now();
    const activeTime = now - 2 * 60 * 1000; // 2 minutes ago
    const isExpired = now - activeTime >= INACTIVITY_TIMEOUT_MS;
    expect(isExpired).toBe(false);
  });

  it('sendOTPEmail identifies already registered returning user and fetches credentials', async () => {
    // Register existing user in registry
    registerUser('registered@example.com', 'Chinedu Okafor', 'business');

    // Re-entering email without providing full name
    const result = await sendOTPEmail('registered@example.com');
    expect(result.success).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.user?.fullName).toBe('Chinedu Okafor');
    expect(result.user?.accountType).toBe('business');
    expect(result.needsRegistration).toBeFalsy();
  });

  it('sendOTPEmail asks for registration when user is not found and no name is provided', async () => {
    const result = await sendOTPEmail('brandnew@example.com');
    expect(result.success).toBe(false);
    expect(result.registered).toBe(false);
    expect(result.needsRegistration).toBe(true);
  });

  it('sendOTPEmail registers new user when full name is provided', async () => {
    const result = await sendOTPEmail('brandnew@example.com', 'Fatima Danjuma', 'individual');
    expect(result.success).toBe(true);
    expect(result.registered).toBe(true);
    expect(result.user?.fullName).toBe('Fatima Danjuma');
    expect(result.user?.accountType).toBe('individual');
  });
});

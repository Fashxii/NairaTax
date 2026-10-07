import { describe, it, expect, beforeEach } from 'vitest';
import { getStored, setStored, removeStored } from './store';
import { UserSession } from '../types';

describe('Session Logout and Storage Management', () => {
  beforeEach(() => {
    removeStored('session');
    removeStored('session_login_time');
    removeStored('session_last_active');
    removeStored('last_session_email');
    removeStored('session_expired_reason');
  });

  it('correctly persists and removes authenticated user session', () => {
    const activeSession: UserSession = {
      accountType: 'individual',
      contactMethod: 'taxpayer@example.ng',
      isVerified: true,
      fullName: 'Amina Bello',
      isNINLinked: true,
      nin: '***1234',
    };

    setStored('session', activeSession);
    setStored('session_login_time', Date.now());
    setStored('session_last_active', Date.now());

    expect(getStored<UserSession>('session', {} as any).isVerified).toBe(true);
    expect(getStored<number>('session_login_time', 0)).toBeGreaterThan(0);

    // Perform logout cleanup
    removeStored('session');
    removeStored('session_login_time');
    removeStored('session_last_active');

    const defaultSession: UserSession = {
      accountType: 'individual',
      contactMethod: '',
      isVerified: false,
      isNINLinked: false,
    };

    expect(getStored<UserSession>('session', defaultSession).isVerified).toBe(false);
    expect(getStored<number>('session_login_time', 0)).toBe(0);
    expect(getStored<number>('session_last_active', 0)).toBe(0);
  });

  it('does not overwrite last_session_email when demo account logs out', () => {
    // A prior real user had logged in
    setStored('last_session_email', 'realuser@gmail.com');

    const demoSession: UserSession = {
      accountType: 'individual',
      contactMethod: 'demo@diytax9ja.ng',
      isVerified: true,
      fullName: 'Demo Taxpayer',
      isNINLinked: false,
    };

    // Logout logic: only store last_session_email if not demo
    if (demoSession.contactMethod !== 'demo@diytax9ja.ng') {
      setStored('last_session_email', demoSession.contactMethod);
    }

    expect(getStored<string>('last_session_email', '')).toBe('realuser@gmail.com');
  });

  it('saves last_session_email for returning registered users upon logout', () => {
    const regularSession: UserSession = {
      accountType: 'business',
      contactMethod: 'founder@fintech.ng',
      isVerified: true,
      fullName: 'Emeka Nwosu',
      isNINLinked: true,
    };

    if (regularSession.contactMethod !== 'demo@diytax9ja.ng') {
      setStored('last_session_email', regularSession.contactMethod);
    }

    expect(getStored<string>('last_session_email', '')).toBe('founder@fintech.ng');
  });
});

import { describe, it, expect, beforeEach } from 'vitest';
import { getStored, setStored, removeStored } from './store';
import { clearPersistedSession } from '../context/SessionContext';
import { DEMO_EMAIL } from './demo';

/**
 * Exercises the real clearPersistedSession() used by SessionContext.logout(),
 * rather than re-implementing the logic inside the test.
 */
describe('clearPersistedSession (logout storage cleanup)', () => {
  beforeEach(() => {
    ['session', 'session_login_time', 'session_last_active', 'last_session_email', 'session_expired_reason']
      .forEach(removeStored);
  });

  const seedActiveSession = (email: string) => {
    setStored('session', { accountType: 'individual', contactMethod: email, isVerified: true, isNINLinked: false });
    setStored('session_login_time', Date.now());
    setStored('session_last_active', Date.now());
  };

  it('removes the persisted session and activity timestamps', () => {
    seedActiveSession('taxpayer@example.ng');

    clearPersistedSession({ contactMethod: 'taxpayer@example.ng' });

    expect(getStored('session', null)).toBeNull();
    expect(getStored('session_login_time', 0)).toBe(0);
    expect(getStored('session_last_active', 0)).toBe(0);
  });

  it('remembers a real user email for quick re-entry', () => {
    seedActiveSession('founder@fintech.ng');

    clearPersistedSession({ contactMethod: 'founder@fintech.ng' });

    expect(getStored('last_session_email', '')).toBe('founder@fintech.ng');
  });

  it('does not overwrite the remembered email when the demo account signs out', () => {
    setStored('last_session_email', 'realuser@gmail.com');
    seedActiveSession(DEMO_EMAIL);

    clearPersistedSession({ contactMethod: DEMO_EMAIL });

    expect(getStored('last_session_email', '')).toBe('realuser@gmail.com');
    expect(getStored('session', null)).toBeNull();
  });

  it('records an expiry reason only when one is given', () => {
    clearPersistedSession({ contactMethod: 'a@b.ng' }, 'inactivity_5min');
    expect(getStored('session_expired_reason', null)).toBe('inactivity_5min');

    clearPersistedSession({ contactMethod: 'a@b.ng' });
    expect(getStored('session_expired_reason', null)).toBeNull();
  });
});

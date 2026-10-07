/**
 * SessionContext.tsx — Persisted Session State
 *
 * Provides user session that survives page refreshes with 24-hour auto-expiry.
 * Wraps AppShell to provide session state + login/logout to all routes.
 */

import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { UserSession } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { removeStored, getStored, setStored } from '../utils/store';
import { auth, fbSignOut } from '../lib/firebase';
import { recordAuditLog } from '../utils/auditLogger';
import { isDemoSession } from '../utils/demo';

export const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours absolute maximum
export const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;   // 5 minutes of inactivity

const DEFAULT_SESSION: UserSession = {
  accountType: 'individual',
  contactMethod: '',
  isVerified: false,
  isNINLinked: false,
};

/**
 * Wipes all persisted auth state for the given session.
 * Remembers the email for quick re-entry, except for the guest demo account.
 */
export function clearPersistedSession(session: Pick<UserSession, 'contactMethod'>, reason?: string): void {
  if (session.contactMethod && !isDemoSession(session)) {
    setStored('last_session_email', session.contactMethod);
  }
  if (reason) {
    setStored('session_expired_reason', reason);
  } else {
    removeStored('session_expired_reason');
  }
  removeStored('session');
  removeStored('session_login_time');
  removeStored('session_last_active');
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('adminRole');
  }
}

interface SessionContextValue {
  session: UserSession;
  setSession: (value: UserSession | ((prev: UserSession) => UserSession)) => void;
  isAuthenticated: boolean;
  logout: (reason?: string) => void;
  sessionExpiredReason: string | null;
  clearExpiredReason: () => void;
  resetInactivityTimer: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = usePersistedState<UserSession>('session', DEFAULT_SESSION);
  const [sessionExpiredReason, setSessionExpiredReason] = useState<string | null>(() =>
    getStored<string | null>('session_expired_reason', null)
  );

  const clearExpiredReason = useCallback(() => {
    setSessionExpiredReason(null);
    removeStored('session_expired_reason');
  }, []);

  const resetInactivityTimer = useCallback(() => {
    setStored('session_last_active', Date.now());
  }, []);

  const logout = useCallback((reason?: string) => {
    if (session.contactMethod) {
      recordAuditLog({
        actorName: session.fullName || session.contactMethod,
        actorEmail: session.contactMethod,
        action: reason === 'inactivity_5min' ? 'SESSION_EXPIRED_INACTIVITY_5MIN' : 'USER_LOGOUT',
        module: 'Security & API',
        severity: reason === 'inactivity_5min' ? 'WARN' : 'INFO',
        afterState: reason ? { reason } : undefined,
      });
    }

    clearPersistedSession(session, reason);
    setSessionExpiredReason(reason ?? null);
    setSession(DEFAULT_SESSION);
    fbSignOut(auth).catch(() => {});
  }, [session, setSession]);

  // Check absolute session expiry and inactivity on mount
  useEffect(() => {
    if (session.isVerified) {
      const loginTime = getStored<number>('session_login_time', 0);
      const lastActive = getStored<number>('session_last_active', 0);
      const now = Date.now();

      if (loginTime > 0 && now - loginTime > SESSION_EXPIRY_MS) {
        logout('session_expired');
      } else if (lastActive > 0 && now - lastActive >= INACTIVITY_TIMEOUT_MS) {
        logout('inactivity_5min');
      }
    }
  }, [session.isVerified, logout]);

  // Track login time & reset activity timestamp when session becomes verified
  useEffect(() => {
    if (session.isVerified) {
      const existing = getStored<number>('session_login_time', 0);
      if (existing === 0) {
        setStored('session_login_time', Date.now());
        recordAuditLog({
          actorName: session.fullName || session.contactMethod,
          actorEmail: session.contactMethod,
          action: 'USER_SESSION_AUTHENTICATED',
          module: 'Security & API',
          severity: 'INFO',
          afterState: { accountType: session.accountType, email: session.contactMethod, ninLinked: session.isNINLinked },
        });
      }
      setStored('session_last_active', Date.now());
      clearExpiredReason();
    }
  }, [session.isVerified, session.fullName, session.contactMethod, session.accountType, session.isNINLinked, clearExpiredReason]);

  // ─── 5-Minute Inactivity Auto-Expiry Tracker ────────────────────────
  useEffect(() => {
    if (!session.isVerified) return;

    let lastThrottledTime = 0;
    const onUserActivity = () => {
      const now = Date.now();
      // Throttle localStorage writes to at most once every 2 seconds
      if (now - lastThrottledTime > 2000) {
        lastThrottledTime = now;
        setStored('session_last_active', now);
      }
    };

    const events = ['mousedown', 'mousemove', 'keydown', 'touchstart', 'scroll'];
    events.forEach((ev) => window.addEventListener(ev, onUserActivity, { passive: true }));

    // Check inactivity immediately on window visibility change or focus
    const checkImmediateInactivity = () => {
      if (document.visibilityState === 'visible') {
        const lastActive = getStored<number>('session_last_active', Date.now());
        if (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
          logout('inactivity_5min');
        } else {
          onUserActivity();
        }
      }
    };
    document.addEventListener('visibilitychange', checkImmediateInactivity);
    window.addEventListener('focus', checkImmediateInactivity);

    // Periodic heartbeat check every 5 seconds
    const interval = setInterval(() => {
      const lastActive = getStored<number>('session_last_active', Date.now());
      if (Date.now() - lastActive >= INACTIVITY_TIMEOUT_MS) {
        logout('inactivity_5min');
      }
    }, 5000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, onUserActivity));
      document.removeEventListener('visibilitychange', checkImmediateInactivity);
      window.removeEventListener('focus', checkImmediateInactivity);
      clearInterval(interval);
    };
  }, [session.isVerified, logout]);

  const isAuthenticated = session.isVerified;

  return (
    <SessionContext.Provider
      value={{
        session,
        setSession,
        isAuthenticated,
        logout,
        sessionExpiredReason,
        clearExpiredReason,
        resetInactivityTimer,
      }}
    >
      {children}
    </SessionContext.Provider>
  );
}

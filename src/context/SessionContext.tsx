/**
 * SessionContext.tsx — Persisted Session State
 *
 * Provides user session that survives page refreshes with 24-hour auto-expiry.
 * Wraps AppShell to provide session state + login/logout to all routes.
 */

import { createContext, useContext, useCallback, useEffect } from 'react';
import { UserSession } from '../types';
import { usePersistedState } from '../hooks/usePersistedState';
import { removeStored, clearAll, getStored, setStored } from '../utils/store';

const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

const DEFAULT_SESSION: UserSession = {
  accountType: 'individual',
  contactMethod: '',
  isVerified: false,
  isNINLinked: false,
};

interface SessionContextValue {
  session: UserSession;
  setSession: (value: UserSession | ((prev: UserSession) => UserSession)) => void;
  isAuthenticated: boolean;
  logout: () => void;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession() {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used within SessionProvider');
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = usePersistedState<UserSession>('session', DEFAULT_SESSION);

  // Check session expiry on mount
  useEffect(() => {
    const loginTime = getStored<number>('session_login_time', 0);
    if (loginTime > 0 && Date.now() - loginTime > SESSION_EXPIRY_MS) {
      // Session expired — clear everything
      setSession(DEFAULT_SESSION);
      removeStored('session_login_time');
    }
  }, []);

  // Track login time when session becomes verified
  useEffect(() => {
    if (session.isVerified) {
      const existing = getStored<number>('session_login_time', 0);
      if (existing === 0) {
        setStored('session_login_time', Date.now());
      }
    }
  }, [session.isVerified]);

  const isAuthenticated = session.isVerified;

  const logout = useCallback(() => {
    setSession(DEFAULT_SESSION);
    clearAll();
  }, [setSession]);

  return (
    <SessionContext.Provider value={{ session, setSession, isAuthenticated, logout }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * AppShell.tsx — Root Layout Component
 *
 * Wraps all routes in the shared layout (background, theme, AnimatePresence).
 * Provides session state, theme, and navigation helpers to child routes
 * via React Router's Outlet context.
 *
 * Session state is managed by SessionContext (persisted to localStorage).
 * All hardcoded demo names have been removed — user identity comes from
 * the authStore registration during the real login flow.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AccountType } from './types';
import { useSession } from './context/SessionContext';
import { isDemoSession, DEMO_EMAIL } from './utils/userScope';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

import SkipToContent from './components/SkipToContent';

/** Context shape exposed to all child routes via useAppContext() */
export interface AppContext {
  session: ReturnType<typeof useSession>['session'];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;

  handleGuestDemo: (accountType: AccountType) => void;
  handleGatewayNext: (accountType: AccountType, contactMethod: string) => void;
  handleVerifySuccess: (
    fullName: string,
    accountType?: AccountType,
    isNINLinked?: boolean,
    nin?: string
  ) => void;
  handleLinkSuccess: (nin: string) => void;
  handleLinkSkip: () => void;
  handleLinkNINFromDashboard: () => void;
  handleLogout: () => void;
}

/** Hook for child routes to access shared app context */
export function useAppContext() {
  return useOutletContext<AppContext>();
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, isAuthenticated, logout } = useSession();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('theme');
    return (saved === 'dark' || saved === 'light') ? saved : 'light';
  });

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const isLoggingOutRef = useRef(false);

  // Auto-redirect: if authenticated and on gateway, go to dashboard (unless user just logged out)
  useEffect(() => {
    if (!isAuthenticated) {
      // Session is cleared — logout has fully applied, so re-arm the redirect.
      isLoggingOutRef.current = false;
      return;
    }
    if (location.pathname === '/' && !isLoggingOutRef.current) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, location.pathname, navigate]);

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleGatewayNext = (accountType: AccountType, contactMethod: string) => {
    setSession((prev) => ({
      ...prev,
      accountType,
      contactMethod
    }));
    navigate('/verify');
  };

  /** Called after successful OTP verification with the user's real name and status */
  const handleVerifySuccess = (
    fullName: string,
    accountType?: AccountType,
    isNINLinked?: boolean,
    nin?: string
  ) => {
    setSession((prev) => ({
      ...prev,
      isVerified: true,
      fullName,
      ...(accountType ? { accountType } : {}),
      ...(isNINLinked !== undefined ? { isNINLinked } : {}),
      ...(nin ? { nin } : {}),
    }));

    if (isNINLinked) {
      navigate('/dashboard');
    } else {
      navigate('/compliance');
    }
  };

  const handleLinkSuccess = (nin: string) => {
    const maskedNin = '***' + nin.slice(-4);
    setSession((prev) => ({
      ...prev,
      isNINLinked: true,
      nin: maskedNin,
    }));

    if (session.contactMethod && !isDemoSession(session)) {
      const cleanEmail = session.contactMethod.toLowerCase().trim();
      setDoc(doc(db, 'users', cleanEmail), { isNINLinked: true, nin: maskedNin }, { merge: true }).catch(() => {});
    }

    navigate('/dashboard');
  };

  const handleLinkSkip = () => {
    setSession((prev) => ({
      ...prev,
      isNINLinked: false,
      // fullName is already set from the verification step — no hardcoding
    }));
    navigate('/dashboard');
  };

  const handleLinkNINFromDashboard = () => {
    navigate('/compliance');
  };

  const handleLogout = useCallback(() => {
    isLoggingOutRef.current = true;
    logout();
    navigate('/', { replace: true });
  }, [logout, navigate]);

  const handleGuestDemo = (accountType: AccountType) => {
    setSession((prev) => ({
      ...prev,
      accountType,
      contactMethod: DEMO_EMAIL,
      isVerified: true,
      fullName: 'Demo Taxpayer',
    }));
    navigate('/dashboard');
  };

  const ctx: AppContext = {
    session,
    theme,
    onToggleTheme: handleToggleTheme,
    handleGuestDemo,
    handleGatewayNext,
    handleVerifySuccess,
    handleLinkSuccess,
    handleLinkSkip,
    handleLinkNINFromDashboard,
    handleLogout,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent-green selection:text-primary-container">
      <SkipToContent />
      <main id="main-content" className="flex-grow flex flex-col">
        <AnimatePresence mode="wait">
          <Outlet context={ctx} />
        </AnimatePresence>
      </main>
    </div>
  );
}

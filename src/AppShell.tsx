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
import { Wrench, UserX } from 'lucide-react';
import { AccountType } from './types';
import { useSession } from './context/SessionContext';
import { isDemoSession, DEMO_EMAIL } from './utils/userScope';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { usePlatformSettings, useTaxRulesSync } from './admin/platformStore';

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
  /** Completes a registration wizard (individual or business) and signs the user in. */
  setSessionFromRegistration: (p: { email: string; fullName: string; maskedNin: string; accountType?: AccountType }) => void;
}

/** Hook for child routes to access shared app context */
export function useAppContext() {
  return useOutletContext<AppContext>();
}

export default function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, setSession, isAuthenticated, logout } = useSession();
  // Live platform configuration (feature flags, maintenance) and admin-managed tax rules.
  const platform = usePlatformSettings();
  useTaxRulesSync();

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
    if (!platform.flags.demoAccess) return; // disabled by an administrator
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
    setSessionFromRegistration: ({ email, fullName, maskedNin, accountType = 'individual' }) => {
      setSession((prev) => ({
        ...prev,
        accountType,
        contactMethod: email,
        isVerified: true,
        fullName,
        isNINLinked: true,
        nin: maskedNin,
      }));
    },
  };

  const isAdminRoute = location.pathname.startsWith('/admin');
  const isStaff = session.systemRole === 'admin';
  const blockedByMaintenance = platform.maintenance.enabled && !isAdminRoute && !isStaff;
  const blockedRegistration = !platform.flags.selfRegistration && location.pathname.startsWith('/register');

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent-green selection:text-primary-container">
      <SkipToContent />
      <main id="main-content" className="flex-grow flex flex-col">
        {blockedByMaintenance ? (
          <PlatformNotice
            icon={<Wrench className="w-8 h-8" />}
            title="Scheduled maintenance"
            message={platform.maintenance.message}
            actionLabel={isAuthenticated ? 'Sign out' : 'Staff sign-in'}
            onAction={() => (isAuthenticated ? handleLogout() : navigate('/admin'))}
          />
        ) : blockedRegistration ? (
          <PlatformNotice
            icon={<UserX className="w-8 h-8" />}
            title="New registrations are paused"
            message="We are not accepting new sign-ups at the moment. Existing users can still sign in."
            actionLabel="Back to sign in"
            onAction={() => navigate('/')}
          />
        ) : (
          <AnimatePresence mode="wait">
            <Outlet context={ctx} />
          </AnimatePresence>
        )}
      </main>
    </div>
  );
}

function PlatformNotice({ icon, title, message, actionLabel, onAction }: {
  icon: React.ReactNode; title: string; message: string; actionLabel: string; onAction: () => void;
}) {
  return (
    <div className="flex-grow flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-outline-variant rounded-2xl p-8 text-center shadow-sm space-y-4">
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center">{icon}</div>
        <h1 className="text-2xl font-black text-primary-container">{title}</h1>
        <p className="text-sm text-on-surface-variant whitespace-pre-line">{message}</p>
        <button onClick={onAction} className="h-11 px-5 bg-[#013220] text-white text-xs font-bold rounded-xl cursor-pointer">
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

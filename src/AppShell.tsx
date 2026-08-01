/**
 * AppShell.tsx — Root Layout Component
 *
 * Wraps all routes in the shared layout (background, theme, AnimatePresence).
 * Provides session state, theme, and navigation helpers to child routes
 * via React Router's Outlet context.
 *
 * Session state is now managed by SessionContext (persisted to localStorage).
 */

import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useOutletContext, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { AccountType } from './types';
import { useSession } from './context/SessionContext';

/** Context shape exposed to all child routes via useAppContext() */
export interface AppContext {
  session: ReturnType<typeof useSession>['session'];
  theme: 'light' | 'dark';
  onToggleTheme: () => void;

  // Navigation handlers
  handleGatewayNext: (accountType: AccountType, contactMethod: string) => void;
  handleVerifySuccess: () => void;
  handleLinkSuccess: (nin: string) => void;
  handleLinkSkip: () => void;
  handleLinkNINFromDashboard: () => void;
  handleGuestDemo: (accountType?: AccountType) => void;
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

  // Auto-redirect: if authenticated and on gateway, go to dashboard
  useEffect(() => {
    if (isAuthenticated && location.pathname === '/') {
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

  const handleVerifySuccess = () => {
    setSession((prev) => ({
      ...prev,
      isVerified: true
    }));
    navigate('/compliance');
  };

  const handleLinkSuccess = (nin: string) => {
    const fullName = session.accountType === 'individual' 
      ? 'Chinedu Abiodun Okafor' 
      : 'Apex Ventures & Logistics Ltd';

    setSession((prev) => ({
      ...prev,
      isNINLinked: true,
      nin,
      fullName
    }));
    navigate('/dashboard');
  };

  const handleLinkSkip = () => {
    const fullName = session.accountType === 'individual' 
      ? 'Chinedu Abiodun Okafor' 
      : 'Apex Ventures & Logistics Ltd';

    setSession((prev) => ({
      ...prev,
      isNINLinked: false,
      fullName
    }));
    navigate('/dashboard');
  };

  const handleLinkNINFromDashboard = () => {
    navigate('/compliance');
  };

  const handleGuestDemo = (accountType: AccountType = 'individual') => {
    setSession({
      accountType,
      contactMethod: 'guest-demo',
      isVerified: true,
      isNINLinked: true,
      fullName: accountType === 'individual' ? 'Chinedu Abiodun Okafor (Demo)' : 'Apex Ventures & Logistics (Demo)'
    });
    navigate('/dashboard');
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const ctx: AppContext = {
    session,
    theme,
    onToggleTheme: handleToggleTheme,
    handleGatewayNext,
    handleVerifySuccess,
    handleLinkSuccess,
    handleLinkSkip,
    handleLinkNINFromDashboard,
    handleGuestDemo,
    handleLogout,
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent-green selection:text-primary-container">
      <AnimatePresence mode="wait">
        <Outlet context={ctx} />
      </AnimatePresence>
    </div>
  );
}

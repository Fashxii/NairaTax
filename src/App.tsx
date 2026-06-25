/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AnimatePresence } from 'motion/react';
import { UserSession, AccountType } from './types';
import Gateway from './components/Gateway';
import Verification from './components/Verification';
import ComplianceLink from './components/ComplianceLink';
import Dashboard from './components/Dashboard';

type ScreenState = 'GATEWAY' | 'VERIFICATION' | 'COMPLIANCE_LINK' | 'DASHBOARD';

export default function App() {
  const [screen, setScreen] = useState<ScreenState>('GATEWAY');
  const [session, setSession] = useState<UserSession>({
    accountType: 'individual',
    contactMethod: '',
    isVerified: false,
    isNINLinked: false
  });

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

  const handleToggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  };

  const handleGatewayNext = (accountType: AccountType, contactMethod: string) => {
    setSession((prev) => ({
      ...prev,
      accountType,
      contactMethod
    }));
    setScreen('VERIFICATION');
  };

  const handleVerifySuccess = () => {
    setSession((prev) => ({
      ...prev,
      isVerified: true
    }));
    setScreen('COMPLIANCE_LINK');
  };

  const handleLinkSuccess = (nin: string) => {
    // Generate a beautiful, realistic taxpayer name based on account type
    const fullName = session.accountType === 'individual' 
      ? 'Chinedu Abiodun Okafor' 
      : 'Apex Ventures & Logistics Ltd';

    setSession((prev) => ({
      ...prev,
      isNINLinked: true,
      nin,
      fullName
    }));
    setScreen('DASHBOARD');
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
    setScreen('DASHBOARD');
  };

  const handleLinkNINFromDashboard = () => {
    setScreen('COMPLIANCE_LINK');
  };

  const handleGuestDemo = (accountType: AccountType = 'individual') => {
    setSession({
      accountType,
      contactMethod: 'guest-demo',
      isVerified: true,
      isNINLinked: true,
      fullName: accountType === 'individual' ? 'Chinedu Abiodun Okafor (Demo)' : 'Apex Ventures & Logistics (Demo)'
    });
    setScreen('DASHBOARD');
  };

  const handleLogout = () => {
    setSession({
      accountType: 'individual',
      contactMethod: '',
      isVerified: false,
      isNINLinked: false
    });
    setScreen('GATEWAY');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-accent-green selection:text-primary-container">
      <AnimatePresence mode="wait">
        {screen === 'GATEWAY' && (
          <Gateway 
            onNext={handleGatewayNext} 
            onGuestDemo={handleGuestDemo} 
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
        {screen === 'VERIFICATION' && (
          <Verification 
            contactMethod={session.contactMethod} 
            onBack={() => setScreen('GATEWAY')} 
            onVerify={handleVerifySuccess} 
          />
        )}
        {screen === 'COMPLIANCE_LINK' && (
          <ComplianceLink 
            onLink={handleLinkSuccess} 
            onSkip={handleLinkSkip} 
          />
        )}
        {screen === 'DASHBOARD' && (
          <Dashboard 
            session={session} 
            onLogout={handleLogout} 
            onLinkNIN={handleLinkNINFromDashboard}
            theme={theme}
            onToggleTheme={handleToggleTheme}
          />
        )}
      </AnimatePresence>
    </div>
  );
}


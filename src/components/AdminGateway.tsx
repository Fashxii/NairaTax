import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ArrowLeft, Sun, Moon, Lock, AlertCircle, MailCheck } from 'lucide-react';
import { useAppContext } from '../AppShell';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import { sendOTPEmail, verifyOTP } from '../utils/otpService';
import { findUserByEmail } from '../utils/authStore';
import type { AdminRole } from '../types';

const STAFF_ROLES: AdminRole[] = ['super_admin', 'content_manager', 'reviewer'];

/**
 * Admin & Staff login — email one-time code.
 *
 * No passwords or roles live in the browser bundle. The verifyOTP Cloud
 * Function proves email ownership and returns the account's role, which is
 * resolved server-side (bootstrap super admins + users/{email}.role).
 */
import { getStored } from '../utils/store';
import { Clock } from 'lucide-react';

export default function AdminGateway() {
  const { theme, onToggleTheme } = useAppContext();
  const { sessionExpiredReason, clearExpiredReason, setSession } = useSession();
  const navigate = useNavigate();
  const onBackToUser = () => navigate('/');

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState(() => getStored<string>('last_session_email', ''));
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const cleanEmail = email.trim().toLowerCase();

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(cleanEmail)) {
      setError('Please enter a valid staff email address.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await sendOTPEmail(cleanEmail);
      if (res.error) {
        setError(res.error);
        return;
      }
      clearExpiredReason();
      setStep('code');
    } catch (err: any) {
      setError(err?.message || 'Could not send a sign-in code. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!/^\d{6}$/.test(code.trim())) {
      setError('Enter the 6-digit code from your email.');
      return;
    }
    setIsLoading(true);
    try {
      const result = await verifyOTP(cleanEmail, code.trim());
      if (!result.valid) {
        setError(result.error || 'Verification failed.');
        return;
      }

      const role = result.user?.role as AdminRole | undefined;
      if (!role || !STAFF_ROLES.includes(role)) {
        setError('This account does not have staff access.');
        return;
      }

      const fullName =
        result.user?.fullName || findUserByEmail(cleanEmail)?.fullName || cleanEmail.split('@')[0];

      setSession((prev) => ({
        ...prev,
        systemRole: 'admin',
        adminRole: role,
        isVerified: true,
        fullName,
        contactMethod: cleanEmail,
      }));
      sessionStorage.setItem('adminRole', role);

      navigate(role === 'super_admin' ? '/admin/super' : '/admin/dashboard');
    } catch {
      setError('Authentication failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full h-12 px-4 py-2 bg-background border border-outline rounded-xl text-on-surface text-sm focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold';

  return (
    <div className="min-h-screen bg-surface-container flex flex-col text-on-surface">
      {/* Header */}
      <header className="w-full px-6 py-4 flex items-center justify-between border-b border-outline-variant/40 bg-white shadow-sm">
        <button
          onClick={onBackToUser}
          className="flex items-center space-x-2 text-xs font-bold text-on-surface-variant hover:text-primary-container transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Public Portal</span>
        </button>
        <div className="flex items-center space-x-2 text-error">
          <ShieldAlert className="w-5 h-5" />
          <span className="font-extrabold tracking-tight">Admin &amp; Staff Portal</span>
        </div>
        <button
          onClick={onToggleTheme}
          aria-label="Toggle theme"
          className="p-2 rounded-lg hover:bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all cursor-pointer"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
        </button>
      </header>

      {/* Main Login Area */}
      <main className="flex-grow flex items-center justify-center p-6">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="w-full max-w-md bg-white p-8 rounded-2xl border border-outline-variant shadow-lg space-y-6 text-left"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto mb-4">
              {step === 'email' ? <Lock className="w-8 h-8" /> : <MailCheck className="w-8 h-8" />}
            </div>
            <h2 className="text-2xl font-black text-primary-container tracking-tight">System Access</h2>
            <p className="text-sm text-on-surface-variant">
              {step === 'email'
                ? 'Authorized staff only. We will email you a one-time sign-in code.'
                : <>Enter the 6-digit code sent to <span className="font-bold text-on-surface">{cleanEmail}</span>.</>}
            </p>
          </div>

          {sessionExpiredReason === 'inactivity_5min' && (
            <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-start gap-2.5 text-left">
              <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-amber-800">Staff Session Expired</p>
                <p className="text-[11px] text-on-surface-variant mt-0.5 leading-snug">
                  Your session was closed after 5 minutes of inactivity for administrative security. Re-enter your email to receive a code.
                </p>
              </div>
            </div>
          )}

          {step === 'email' ? (
            <form onSubmit={handleSendCode} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-email" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Staff Email</label>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@company.com"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="admin-send-code"
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-error text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-75 cursor-pointer"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Send Sign-in Code</span>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="admin-code" className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Verification Code</label>
                <input
                  id="admin-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  className={`${inputClass} tracking-[0.5em] text-center font-mono text-lg`}
                  placeholder="••••••"
                  autoFocus
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                id="admin-verify-code"
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-error text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-75 cursor-pointer"
              >
                {isLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span>Verify &amp; Sign In</span>}
              </button>

              <button
                type="button"
                onClick={() => { setStep('email'); setCode(''); setError(''); }}
                className="w-full text-xs font-bold text-on-surface-variant hover:text-primary-container cursor-pointer"
              >
                Use a different email
              </button>
            </form>
          )}
        </motion.div>
      </main>
    </div>
  );
}

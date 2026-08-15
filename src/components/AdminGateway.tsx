import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ArrowLeft, Sun, Moon, Lock, AlertCircle } from 'lucide-react';
import { useAppContext } from '../AppShell';
import { useSession } from '../context/SessionContext';
import { useNavigate } from 'react-router-dom';
import { findUserByEmail, verifyPassword, recordLogin } from '../utils/authStore';

export default function AdminGateway() {
  const { theme, onToggleTheme } = useAppContext();
  const { setSession } = useSession();
  const navigate = useNavigate();
  const onBackToUser = () => navigate('/');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter both staff email and password.');
      return;
    }

    setIsLoading(true);

    try {
      // Find admin user in authStore
      const user = findUserByEmail(email.trim());

      if (!user || user.role === 'taxpayer') {
        setIsLoading(false);
        setError('Invalid admin staff credentials or unauthorized account.');
        return;
      }

      if (!user.isActive) {
        setIsLoading(false);
        setError('This administrative account has been suspended.');
        return;
      }

      // Check password if set (otherwise allow initial admin setup)
      if (user.passwordHash) {
        const isMatch = await verifyPassword(password, user.passwordHash);
        if (!isMatch) {
          setIsLoading(false);
          setError('Invalid staff password. Please try again.');
          return;
        }
      }

      // Record login time
      recordLogin(user.id);

      // Set session context with proper admin roles
      setSession((prev) => ({
        ...prev,
        systemRole: 'admin',
        adminRole: user.role as any,
        isVerified: true,
        fullName: user.fullName,
        contactMethod: user.email,
      }));

      // Store in sessionStorage for components that read adminRole
      sessionStorage.setItem('adminRole', user.role);

      setIsLoading(false);

      // Role-based routing to correct blade
      if (user.role === 'super_admin') {
        navigate('/admin/super');
      } else {
        navigate('/admin/dashboard');
      }
    } catch (err: any) {
      setIsLoading(false);
      setError('Authentication failed. Please check system credentials.');
    }
  };

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
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-primary-container tracking-tight">System Access</h2>
            <p className="text-sm text-on-surface-variant">Authorized staff personnel only.</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Staff Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-12 px-4 py-2 bg-background border border-outline rounded-xl text-on-surface text-sm focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold"
                placeholder="admin@diytax9ja.ng"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-12 px-4 py-2 bg-background border border-outline rounded-xl text-on-surface text-sm focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-bold">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-error text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-75 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Authenticate Staff Login</span>
              )}
            </button>
          </form>
        </motion.div>
      </main>
    </div>
  );
}

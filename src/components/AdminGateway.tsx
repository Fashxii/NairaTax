import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, ArrowLeft, Sun, Moon, Lock, Edit, CheckCircle } from 'lucide-react';
import { AdminRole } from '../types';

interface AdminGatewayProps {
  onAdminLogin: (role: AdminRole) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
  onBackToUser: () => void;
}

export default function AdminGateway({ onAdminLogin, theme, onToggleTheme, onBackToUser }: AdminGatewayProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate login and default to super_admin for standard login form
    setTimeout(() => {
      setIsLoading(false);
      onAdminLogin('super_admin');
    }, 1000);
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
          <span className="font-extrabold tracking-tight">Admin & Staff Portal</span>
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
          className="w-full max-w-md bg-white p-8 rounded-2xl border border-outline-variant shadow-lg space-y-6"
        >
          <div className="text-center space-y-2">
            <div className="w-16 h-16 bg-error/10 text-error rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-black text-primary-container tracking-tight">System Access</h2>
            <p className="text-sm text-on-surface-variant">Authorized personnel only.</p>
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

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 bg-error text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-75 cursor-pointer"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <span>Authenticate</span>
              )}
            </button>
          </form>

          {/* Quick Demo Logins for Reviewers */}
          <div className="pt-6 border-t border-outline-variant space-y-3">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Demo Role Access</p>
            <div className="grid grid-cols-1 gap-2">
              <button 
                onClick={() => onAdminLogin('super_admin')}
                className="w-full py-2.5 px-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold flex items-center justify-between text-primary-container transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-error" />
                  <span>Super Admin</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">Full Access</span>
              </button>
              <button 
                onClick={() => onAdminLogin('content_manager')}
                className="w-full py-2.5 px-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold flex items-center justify-between text-primary-container transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Edit className="w-4 h-4 text-accent-green" />
                  <span>Content Manager</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">CMS Only</span>
              </button>
              <button 
                onClick={() => onAdminLogin('reviewer')}
                className="w-full py-2.5 px-4 bg-surface-container hover:bg-surface-container-high border border-outline-variant rounded-lg text-xs font-bold flex items-center justify-between text-primary-container transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <CheckCircle className="w-4 h-4 text-blue-500" />
                  <span>TCC Reviewer</span>
                </div>
                <span className="text-[9px] uppercase tracking-wider text-on-surface-variant">Approvals Only</span>
              </button>
            </div>
          </div>

        </motion.div>
      </main>
    </div>
  );
}

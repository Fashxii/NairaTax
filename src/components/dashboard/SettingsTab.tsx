import React from 'react';
import { motion } from 'motion/react';
import { Settings, ShieldCheck, CheckCircle2, Sun, Moon } from 'lucide-react';
import { UserSession } from '../../types';

interface SettingsTabProps {
  session: UserSession;
  accountMode: 'personal' | 'business';
  currentTaxpayerFullName: string;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function SettingsTab({ session, accountMode, currentTaxpayerFullName, theme, onToggleTheme }: SettingsTabProps) {
  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          User Taxpayer Profile
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Configure your regulatory settings and review linked governmental identity registries.
        </p>
      </div>

      <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs max-w-2xl space-y-6">
        
        <div className="flex items-center space-x-4 border-b border-outline-variant pb-6">
          <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-2xl uppercase">
            {currentTaxpayerFullName[0]}
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-primary-container">{currentTaxpayerFullName}</h3>
            <p className="text-xs text-on-surface-variant font-mono uppercase tracking-wider mt-0.5">Registry: {accountMode} Taxpayer Account</p>
          </div>
        </div>

        {/* Parameter Settings */}
        <div className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
            <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
              <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Contact Method</p>
              <p className="text-xs text-on-surface font-semibold mt-1 font-mono">{session.contactMethod}</p>
            </div>

            <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
              <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Regulatory ID State</p>
              <p className={`text-xs font-bold mt-1 ${session.isNINLinked ? 'text-[#013220]' : 'text-amber-600'}`}>
                {session.isNINLinked ? 'Linked (NIN Active)' : 'Unverified Identity (NIN Unlinked)'}
              </p>
            </div>
          </div>

          {session.isNINLinked && session.nin && (
            <div className="p-4 bg-[#013220]/5 rounded-xl border border-primary-container/10 flex justify-between items-center text-left">
              <div>
                <p className="text-[10px] font-bold text-[#013220] uppercase tracking-wider">Linked National Identity Number</p>
                <p className="text-lg font-mono font-black tracking-widest text-primary-container mt-1">{session.nin}</p>
              </div>
              <div className="w-8 h-8 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-accent-green">
                <ShieldCheck className="w-5 h-5 text-[#013220]" />
              </div>
            </div>
          )}

          <div className="space-y-3 pt-4 text-left">
            <h4 className="font-bold text-xs text-primary-container uppercase tracking-wider">Regulatory Compliance Certifications</h4>
            
            <div className="space-y-2">
              <div className="p-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
                  <div>
                    <p className="font-bold text-primary-container text-xs">NDPR Privacy Consent Activated</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">Your secure credentials are cryptographically protected under Nigerian Data Regulations.</p>
                  </div>
                </div>
              </div>

              <div className="p-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
                  <div>
                    <p className="font-bold text-primary-container text-xs">Tax Unification Policy Compliant</p>
                    <p className="text-[10px] text-on-surface-variant leading-relaxed">Joint Tax Board guidelines applied. NIN verified directly with national NIMC registry databases.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Display Preferences */}
          <div className="space-y-3 pt-6 border-t border-outline-variant/40 text-left">
            <h4 className="font-bold text-xs text-primary-container uppercase tracking-wider">Aesthetic &amp; Display Preferences</h4>
            
            <div className="p-4 bg-surface-container-low border border-outline-variant/40 rounded-xl flex items-center justify-between">
              <div>
                <p className="font-bold text-primary-container text-xs">High-Contrast Dark Mode</p>
                <p className="text-[10px] text-on-surface-variant leading-relaxed">Switch between a crisp forest light layout and an eye-safe, high-contrast twilight visual theme.</p>
              </div>
              
              {/* Custom Toggle Switch for Dark Mode */}
              <div 
                onClick={onToggleTheme}
                className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                style={{ backgroundColor: theme === 'dark' ? '#4ADE80' : '#e2e2e2' }}
              >
                <motion.div 
                  layout
                  className="w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center"
                  animate={{ x: theme === 'dark' ? 20 : 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
                >
                  {theme === 'dark' ? (
                    <Moon className="w-3 h-3 text-emerald-950" />
                  ) : (
                    <Sun className="w-3 h-3 text-amber-500" />
                  )}
                </motion.div>
              </div>
            </div>
          </div>

        </div>

      </div>
    </motion.section>
  );
}

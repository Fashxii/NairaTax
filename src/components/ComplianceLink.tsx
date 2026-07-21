import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Fingerprint, Info, ArrowRight, Shield, Scale, Lock } from 'lucide-react';

interface ComplianceLinkProps {
  onLink: (nin: string) => void;
  onSkip: () => void;
}

export default function ComplianceLink({ onLink, onSkip }: ComplianceLinkProps) {
  const [nin, setNin] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (value.length <= 11) {
      setNin(value);
      setError('');
    }
  };

  const handleLink = (e: React.FormEvent) => {
    e.preventDefault();
    if (nin.length !== 11) {
      setError('National Identification Number (NIN) must be exactly 11 digits.');
      return;
    }

    setIsLoading(true);
    setError('');

    // Simulate link validation
    setTimeout(() => {
      setIsLoading(false);
      onLink(nin);
    }, 1500);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.4 }}
      className="w-full max-w-xl mx-auto flex flex-col justify-start items-center px-4 py-8"
    >
      {/* Top Bar Indicators */}
      <header className="w-full flex justify-between items-center pb-6 mb-6">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
            <rect width="200" height="200" rx="44" fill="#013220"/>
            <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white"/>
            <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round"/>
          </svg>
          <span className="font-bold text-primary-container">DIYtax9ja</span>
        </div>
        <span className="text-[10px] font-bold tracking-widest text-on-surface-variant uppercase bg-surface-container px-3 py-1.5 rounded-full border border-outline-variant/30">
          STEP 2 OF 2
        </span>
      </header>

      {/* Primary Card */}
      <div className="w-full bg-white rounded-2xl border border-outline-variant p-6 md:p-8 shadow-sm border-l-4 border-l-primary-container relative overflow-hidden mb-8">
        <div className="absolute -top-12 -left-12 w-24 h-24 bg-accent-green opacity-10 rounded-full blur-2xl"></div>

        {/* Icon & Title */}
        <div className="space-y-4 mb-6">
          <div className="w-12 h-12 rounded-xl bg-primary-container flex items-center justify-center text-white shadow-xs">
            <Shield className="w-6 h-6 text-accent-green" />
          </div>
          <h1 className="text-2xl font-extrabold text-primary-container tracking-tight">
            Compliance Link
          </h1>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Under the New Tax Implementation, your National Identification Number (NIN) is now your official Tax Identification Number (TIN).
          </p>
        </div>

        {/* Input Form */}
        <form onSubmit={handleLink} className="space-y-6">
          <div className="space-y-2">
            <label className="block text-xs font-bold text-on-surface uppercase tracking-wider" htmlFor="nin-input">
              Enter your 11-digit NIN
            </label>
            <div className="relative">
              <input
                id="nin-input"
                type="text"
                maxLength={11}
                value={nin}
                onChange={handleInputChange}
                className="w-full h-14 bg-background text-lg font-mono font-bold border border-outline rounded-xl px-4 tracking-[0.5em] text-center focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all placeholder:opacity-20"
                placeholder="00000000000"
                inputMode="numeric"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant/70">
                <Fingerprint className="w-5 h-5" />
              </div>
            </div>

            {error && (
              <p className="text-xs text-error font-medium mt-1">{error}</p>
            )}

            <div className="flex items-start space-x-2 p-3 bg-surface-container-low rounded-lg border border-outline-variant/30">
              <Info className="w-4.5 h-4.5 text-primary-container flex-shrink-0 mt-0.5" />
              <p className="text-[11px] text-on-surface-variant leading-relaxed">
                Your NIN is the 11-digit number on your NIN slip or ID card issued by NIMC.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 pt-2">
            <button
              type="submit"
              disabled={isLoading || nin.length !== 11}
              className="w-full h-14 bg-primary-container text-white font-semibold rounded-xl flex items-center justify-center space-x-2 hover:bg-primary-container/95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed shadow-sm"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Link &amp; Continue to Dashboard</span>
                  <ArrowRight className="w-5 h-5 text-accent-green" />
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onSkip}
              className="w-full h-12 border border-outline text-on-surface hover:bg-surface-container font-semibold rounded-xl text-xs uppercase tracking-widest active:scale-[0.98] transition-all"
            >
              Skip for now (Limited Access)
            </button>
          </div>
        </form>
      </div>

      {/* Trust Indicators */}
      <div className="flex justify-around items-center w-full max-w-sm px-4 mb-8 text-on-surface-variant/50">
        <div className="flex flex-col items-center space-y-1">
          <Shield className="w-7 h-7 text-primary-container/50" />
          <span className="text-[10px] font-bold tracking-widest">SECURE</span>
        </div>
        <div className="flex flex-col items-center space-y-1">
          <Scale className="w-7 h-7 text-primary-container/50" />
          <span className="text-[10px] font-bold tracking-widest">COMPLIANT</span>
        </div>
        <div className="flex flex-col items-center space-y-1">
          <Lock className="w-7 h-7 text-primary-container/50" />
          <span className="text-[10px] font-bold tracking-widest">ENCRYPTED</span>
        </div>
      </div>

      {/* Contextual Information Image Box */}
      <div className="w-full rounded-xl overflow-hidden border border-outline-variant relative shadow-xs">
        <div className="h-44 md:h-52 relative">
          <img
            alt="Modern Lagos professional workspace"
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA3mxH1kKtUXT9dZkWwPW43nzCGJ9iid5g0eWkl-Ob1Dg9EfT-imxrKK8T2muCcuRrVrS0opIrTiF1d41SbBr3X_FZ6oIHM0BWGgHW3ND2zqltnT3zlt9Q2LO9YwTnGRITRESunQpZlS3ghp1-R32XHuD0qYVvnEPPgARl4rifIXgC9H17Daxp3Z2zdab_yw7UjCQo3nB3syLc5RQQSxGW3tSGXMDkwLJZi0ny7--35yboVdExViUkwIdGQODisufU0dT_GBiRbuU4"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/30 to-transparent flex items-end p-5">
            <p className="text-white text-xs leading-relaxed max-w-md drop-shadow-sm font-medium">
              Nigeria is transitioning to a unified tax identification system to simplify your financial life. Linking your NIN ensures all your tax records are synced in real-time.
            </p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

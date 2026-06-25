import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'motion/react';
import { ArrowLeft, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface VerificationProps {
  contactMethod: string;
  onBack: () => void;
  onVerify: () => void;
}

export default function Verification({ contactMethod, onBack, onVerify }: VerificationProps) {
  const [code, setCode] = useState<string[]>(Array(6).fill(''));
  const [timeLeft, setTimeLeft] = useState(45);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [showNotification, setShowNotification] = useState(true);
  
  // Custom random security code for simulation
  const [simulatedCode] = useState(() => Math.floor(100000 + Math.random() * 900000).toString());

  const inputRefs = useRef<HTMLInputElement[]>([]);

  // Automatically hide notification toast after some time or keep it visible
  useEffect(() => {
    const timer = setTimeout(() => {
      // Auto close after 12s, or let them dismiss
    }, 12000);
    return () => clearTimeout(timer);
  }, []);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [timeLeft]);

  const handleChange = (index: number, value: string) => {
    // Only allow single digit numbers
    const cleanValue = value.replace(/[^0-9]/g, '');
    if (!cleanValue) {
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      return;
    }

    const digit = cleanValue[cleanValue.length - 1];
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // Auto-focus next input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      if (!code[index] && index > 0) {
        // Clear previous input and focus it
        const newCode = [...code];
        newCode[index - 1] = '';
        setCode(newCode);
        inputRefs.current[index - 1]?.focus();
      } else {
        const newCode = [...code];
        newCode[index] = '';
        setCode(newCode);
      }
    }
  };

  const handleResend = (e: React.MouseEvent) => {
    e.preventDefault();
    setTimeLeft(45);
    setError('');
    setShowNotification(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const enteredCode = code.join('');
    if (enteredCode.length < 6) {
      setError('Please enter the full 6-digit verification code.');
      return;
    }

    setIsVerifying(true);
    setError('');

    // Simulate verification
    setTimeout(() => {
      setIsVerifying(false);
      // Accept either the simulated secret code or standard mock validation
      onVerify();
    }, 1200);
  };

  // Mask email or phone number for safety
  const formatContact = (contact: string) => {
    if (contact.includes('@')) {
      const [local, domain] = contact.split('@');
      const maskedLocal = local.length > 3 ? local.slice(0, 3) + '•••' : local + '•••';
      return `${maskedLocal}@${domain}`;
    } else {
      const clean = contact.replace(/[^0-9+]/g, '');
      if (clean.length > 6) {
        return `${clean.slice(0, 4)} ••• ••• ${clean.slice(-4)}`;
      }
      return contact;
    }
  };

  const isBtnEnabled = code.every((digit) => digit !== '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -15 }}
      transition={{ duration: 0.4 }}
      className="flex-grow flex flex-col justify-start items-center px-4 py-8 max-w-5xl mx-auto w-full"
    >
      {/* Interactive SMS/Email Access Code Toast */}
      {showNotification && (
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          className="fixed top-20 z-50 bg-[#013220] text-white border border-[#002113] rounded-xl px-4 py-3 shadow-lg flex items-center justify-between space-x-4 max-w-sm"
        >
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-accent-green font-bold">
              N
            </div>
            <div>
              <p className="text-xs font-semibold text-[#4ADE80] uppercase tracking-wider">Access Verification Code</p>
              <p className="text-sm font-bold tracking-widest">{simulatedCode} is your NairaTax OTP.</p>
            </div>
          </div>
          <button 
            onClick={() => setShowNotification(false)}
            className="text-xs font-bold text-neutral-300 hover:text-white hover:underline transition-all"
          >
            Dismiss
          </button>
        </motion.div>
      )}

      {/* Top Navigation Header bar */}
      <header className="w-full max-w-xl mx-auto flex justify-between items-center pb-8 border-b border-outline-variant/30 mb-8">
        <button 
          onClick={onBack}
          className="p-2.5 hover:bg-surface-container rounded-full transition-colors active:scale-95 duration-150 flex items-center justify-center border border-outline-variant/40"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5 text-primary-container" />
        </button>
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
            <rect width="200" height="200" rx="44" fill="#013220"/>
            <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white"/>
            <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round"/>
          </svg>
          <span className="font-bold text-primary-container text-lg">NairaTax</span>
        </div>
        <div className="w-10"></div> {/* Spacer for symmetry */}
      </header>

      {/* Main Content Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full max-w-4xl">
        
        {/* Core OTP Verification Form Column */}
        <div className="lg:col-span-7 flex flex-col space-y-6">
          <section className="text-center lg:text-left space-y-2">
            <h1 className="text-3xl font-extrabold text-primary-container tracking-tight">
              Verify Your Identity
            </h1>
            <p className="text-sm text-on-surface-variant">
              We sent a 6-digit secure access code to <span className="font-bold text-on-surface">{formatContact(contactMethod)}</span>
            </p>
          </section>

          {/* OTP Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex justify-between items-center gap-2" id="otp-container">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el as HTMLInputElement)}
                  type="text"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="otp-input w-12 h-14 md:w-14 md:h-16 text-center text-xl font-bold font-mono bg-white border border-outline rounded-xl focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
                  autoFocus={index === 0}
                  pattern="[0-9]*"
                  inputMode="numeric"
                />
              ))}
            </div>

            {error && (
              <p className="text-xs text-error font-medium text-center lg:text-left">{error}</p>
            )}

            {/* Timer & Actions */}
            <div className="flex flex-col items-center lg:items-start gap-4">
              <div className="text-xs uppercase tracking-wider font-semibold text-on-surface-variant">
                {timeLeft > 0 ? (
                  <span>Resend code in 0:{timeLeft < 10 ? `0${timeLeft}` : timeLeft}</span>
                ) : (
                  <button 
                    onClick={handleResend}
                    className="text-primary-container hover:text-primary-container/80 font-bold hover:underline cursor-pointer flex items-center space-x-1"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Resend code now</span>
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={!isBtnEnabled || isVerifying}
                className="w-full py-3.5 px-6 bg-primary-container text-white font-semibold rounded-lg hover:bg-primary-container/95 active:scale-[0.98] transition-transform disabled:opacity-50 disabled:active:scale-100 disabled:cursor-not-allowed flex items-center justify-center shadow-sm"
              >
                {isVerifying ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Verify & Continue</span>
                )}
              </button>
            </div>
          </form>

          {/* Security Notice Box */}
          <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl flex items-start space-x-3 shadow-xs">
            <Lock className="w-5 h-5 text-primary-container mt-0.5 flex-shrink-0" />
            <div className="flex flex-col">
              <p className="text-xs font-bold text-on-surface">Identity Protection Secured</p>
              <p className="text-[11px] text-on-surface-variant/90 leading-relaxed">
                Secured via NDPR (Nigerian Data Protection Regulation) financial compliance protocols. Your verification data is strictly encrypted in transit.
              </p>
            </div>
          </div>
        </div>

        {/* Large Screen Bento Visual Column */}
        <aside className="hidden lg:block lg:col-span-5 bg-surface-container-low border border-outline-variant rounded-2xl p-6 space-y-4">
          <div className="w-full h-44 rounded-xl overflow-hidden relative border border-outline-variant">
            <img 
              className="w-full h-full object-cover" 
              alt="Multi-factor Authentication"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuC3OWu7joJYiyQ-TQRgDhPlky0oiYtcKme0jeNXKtrnj38LkJ-u4--_tMcDTyIfMPCUVcA5xV6UpGD9SKrnjUR_aXvdfqTeHE0XqrDo1uTZ9bELJ3Fv8Lfb9LIFnkUYYVtkJQiM6bPjQZphbQ-PCUqzMj3g8Q9ChhddOG85tmWdbQ7VgY7g1J8vjImausI6d9ogOlW2KsbYftlY7Ad6lVbW-C4Y-o3X4qIg8qgpzZ3dSFzS9yApbYCmPSnkVPoPJHoMryJ8Voxe1_U"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-[#013220]/10 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/95 shadow-md flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary-container" />
              </div>
            </div>
          </div>
          <h3 className="text-base font-bold text-primary-container">Multi-Factor Security</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            NairaTax uses bank-grade 256-bit encryption for all identity verifications, ensuring your tax records remain private and accessible only to verified citizens.
          </p>
        </aside>

      </div>

      {/* Footer Identity */}
      <footer className="mt-auto pt-12 text-center text-xs text-on-surface-variant/50 w-full border-t border-outline-variant/20">
        © 2026 NairaTax. Nigerian Data Protection Regulation (NDPR) Compliant.
      </footer>
    </motion.div>
  );
}

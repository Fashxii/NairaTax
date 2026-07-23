import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  ArrowRight, ShieldCheck, Landmark, Check, Sparkles, 
  Calendar, Camera, MessageSquare, HelpCircle, ChevronDown, 
  Zap, ArrowUpRight, CheckCircle, ShieldAlert, Award, FileText,
  Sun, Moon
} from 'lucide-react';
import { AccountType } from '../types';
import { useContent } from '../context/ContentContext';
import { estimateSavings } from '../utils/taxEngine';

interface GatewayProps {
  onNext: (accountType: AccountType, contactMethod: string) => void;
  onGuestDemo?: (accountType: AccountType) => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function Gateway({ onNext, onGuestDemo, theme, onToggleTheme }: GatewayProps) {
  const { content } = useContent();
  const [accountType, setAccountType] = useState<AccountType>('individual');
  const [contactMethod, setContactMethod] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  // Savings Calculator Slider State
  const [monthlyIncome, setMonthlyIncome] = useState<number>(850000); // 850k default

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactMethod.trim()) {
      setError('Please enter your WhatsApp number or Email address.');
      return;
    }
    setError('');
    setIsLoading(true);

    // Simulate network delay
    setTimeout(() => {
      setIsLoading(false);
      onNext(accountType, contactMethod);
    }, 1000);
  };

  // Tax calculations based on slider values — uses shared engine
  const estimates = estimateSavings(monthlyIncome);

  const faqs = [
    {
      q: "What is the Personal Income Tax (PIT) deadline in Nigeria?",
      a: "For individuals and self-employed professionals, the annual filing deadline is March 31st for the preceding tax year. Late filing attracts a flat penalty, plus 10% interest per annum on the outstanding tax liability."
    },
    {
      q: "How do I download my Tax Clearance Certificate (TCC)?",
      a: "An official Tax Clearance Certificate (TCC) is issued by the FIRS or your State IRS (e.g. LIRS) once you successfully file and reconcile your tax records for the preceding 3 years. DIYtax9ja fully automates the reconciliation, letting you apply for and download your official TCC instantly upon successful filing."
    },
    {
      q: "How does Company Income Tax (CIT) apply to small businesses?",
      a: "Under the Nigerian Finance Act, micro and small enterprises with an annual turnover of less than ₦25 million are 100% exempt from paying Company Income Tax (CIT). However, they are still statutorily required to file tax returns annually. Medium businesses (₦25m - ₦100m) pay a reduced CIT rate of 20%."
    },
    {
      q: "Are voluntary pension and life assurance premium payments tax-exempt?",
      a: "Yes! Under Section 33 of the Personal Income Tax Act (PITA), contributions to the National Pension Scheme (compulsory & voluntary), National Health Insurance Scheme (NHIS), National Housing Fund (NHF), and premiums paid on life assurance policies are 100% tax-deductible. DIYtax9ja automatically applies these reliefs to reduce your net taxable income."
    }
  ];

  const handleSmoothScroll = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col text-on-surface">
      {/* 1. Header Navigation Bar */}
      <header className="sticky top-0 w-full z-50 bg-white/95 backdrop-blur-md border-b border-outline-variant px-6 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-12 max-w-7xl mx-auto w-full">
          {/* Logo */}
          <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            {content.gateway.logoUrl ? (
              <img src={content.gateway.logoUrl} alt="Logo" className="h-10 object-contain" />
            ) : (
              <div className="w-10 h-10">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <rect width="200" height="200" rx="44" fill="#013220"/>
                  <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white"/>
                  <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round"/>
                </svg>
              </div>
            )}
            <span className="font-extrabold text-2xl text-primary-container tracking-tight">DIYtax9ja</span>
          </div>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center space-x-8 text-sm font-semibold text-on-surface-variant">
            <button onClick={() => handleSmoothScroll('features')} className="hover:text-primary-container transition-colors cursor-pointer">Features</button>
            <button onClick={() => handleSmoothScroll('savings-calc')} className="hover:text-primary-container transition-colors cursor-pointer">Tax Calculator</button>
            <button onClick={() => handleSmoothScroll('faqs')} className="hover:text-primary-container transition-colors cursor-pointer">FAQs</button>
          </nav>

          {/* CTA Buttons in Header */}
          <div className="ml-auto flex items-center space-x-3">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg hover:bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all cursor-pointer flex items-center justify-center h-9 w-9"
              aria-label="Toggle theme"
              id="theme-toggle-gateway"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
            <button 
              onClick={() => onGuestDemo?.('individual')}
              className="hidden sm:flex items-center space-x-1 text-xs font-bold text-[#013220] hover:bg-surface-container/50 px-3.5 py-2 rounded-lg border border-outline-variant transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-accent-green mr-1" />
              <span>Explore Interactive Demo</span>
            </button>
            <button 
              onClick={() => handleSmoothScroll('auth-portal')}
              className="bg-[#013220] text-white text-xs font-bold px-4 py-2 rounded-lg hover:opacity-90 active:scale-95 transition-all cursor-pointer"
            >
              {content.gateway.navCtaText}
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Landing Page Sections */}
      <main className="flex-grow w-full max-w-7xl mx-auto px-6 py-8 md:py-12 space-y-16">
        
        {/* HERO SECTION with Split Layout */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center" id="hero">
          
          {/* Hero text & value prop */}
          <div className="lg:col-span-7 space-y-6 text-left">
            {/* Status Badge */}
            <div className="inline-flex items-center space-x-2 bg-primary-container/10 border border-primary-container/20 px-3.5 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary-container">
                FY 2026 Nigerian Tax Filing is Active
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-primary-container leading-tight">
              {content.gateway.heroTitleLine1} <br />
              <span className="text-[#013220] underline decoration-accent-green decoration-4 underline-offset-8">{content.gateway.heroTitleLine2.split(',')[0]}</span>, {content.gateway.heroTitleLine2.split(',').slice(1).join(',')}
            </h1>

            <p className="text-base text-on-surface-variant leading-relaxed max-w-2xl">
              {content.gateway.heroDescription}
            </p>

            {content.gateway.heroImage && (
              <div className="w-full max-w-md rounded-2xl overflow-hidden shadow-lg my-4 border border-outline-variant/40">
                <img src={content.gateway.heroImage} alt="Hero representation" className="w-full h-auto object-cover" />
              </div>
            )}

            {/* Quick trust proofs */}
            <div className="grid grid-cols-3 gap-4 py-4 border-y border-outline-variant/40">
              <div>
                <p className="text-xl md:text-2xl font-black text-primary-container font-mono">₦14.2B+</p>
                <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider mt-0.5">Tax Tracked</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-primary-container font-mono">99.8%</p>
                <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider mt-0.5">Audit Clearance</p>
              </div>
              <div>
                <p className="text-xl md:text-2xl font-black text-primary-container font-mono">25k+</p>
                <p className="text-[10px] font-bold text-on-surface-variant/80 uppercase tracking-wider mt-0.5">Active Taxpayers</p>
              </div>
            </div>

            {/* CTA Option Grid */}
            <div className="flex flex-col sm:flex-row gap-4 pt-2">
              <button 
                onClick={() => onGuestDemo?.('individual')}
                className="flex-1 sm:flex-none h-13 px-6 bg-white border-2 border-[#013220] text-[#013220] font-bold rounded-xl hover:bg-surface-container/30 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-5 h-5 text-accent-green" />
                <span>{content.gateway.heroCta1Text}</span>
              </button>
              <button 
                onClick={() => handleSmoothScroll('savings-calc')}
                className="flex-1 sm:flex-none h-13 px-6 bg-surface-container text-primary-container border border-outline-variant font-bold rounded-xl hover:bg-surface-container-high active:scale-[0.98] transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <span>{content.gateway.heroCta2Text}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Secure filing registration/login Card (Right Column) */}
          <div className="lg:col-span-5" id="auth-portal">
            <motion.div 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full bg-white p-8 rounded-2xl border border-outline-variant shadow-sm space-y-6 text-left"
            >
              <div>
                <h3 className="text-xl font-bold tracking-tight text-primary-container">{content.gateway.portalTitle}</h3>
                <p className="text-xs text-on-surface-variant mt-1">{content.gateway.portalSubtitle}</p>
              </div>

              {/* Segmented control for Individual vs Business */}
              <div className="bg-surface-container p-1 rounded-xl flex w-full border border-outline-variant/30">
                <button
                  type="button"
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                    accountType === 'individual'
                      ? 'bg-white text-[#013220] font-black shadow-xs'
                      : 'text-on-surface-variant hover:text-primary-container'
                  }`}
                  onClick={() => setAccountType('individual')}
                >
                  Individual PIT
                </button>
                <button
                  type="button"
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 cursor-pointer ${
                    accountType === 'business'
                      ? 'bg-white text-[#013220] font-black shadow-xs'
                      : 'text-on-surface-variant hover:text-primary-container'
                  }`}
                  onClick={() => setAccountType('business')}
                >
                  Business CIT / VAT
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block" htmlFor="contact-method-landing">
                    WhatsApp Phone Number or Email
                  </label>
                  <input
                    id="contact-method-landing"
                    type="text"
                    value={contactMethod}
                    onChange={(e) => {
                      setContactMethod(e.target.value);
                      if (error) setError('');
                    }}
                    className="w-full h-12 px-4 py-2 bg-background border border-outline rounded-xl text-on-surface text-sm placeholder:text-on-surface-variant/40 focus:outline-none focus:border-[#013220] focus:ring-1 focus:ring-[#013220] transition-all font-semibold"
                    placeholder={accountType === 'individual' ? 'e.g., +234 803 123 4567' : 'e.g., filings@company.ng'}
                  />
                  {error && (
                    <p className="text-xs text-error font-medium mt-1">{error}</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-12 bg-primary-container text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-xs disabled:opacity-75 disabled:scale-100 cursor-pointer"
                >
                  {isLoading ? (
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>{content.gateway.portalCtaText}</span>
                      <ArrowRight className="w-4 h-4 text-accent-green" />
                    </>
                  )}
                </button>
              </form>

              <div className="pt-4 border-t border-outline-variant text-center space-y-2">
                <p className="text-[10px] text-on-surface-variant/70 leading-relaxed">
                  NDPR Data Security Standards. Your private records are 100% encrypted and protected under Nigerian regulatory acts.
                </p>
                <button 
                  onClick={() => onGuestDemo?.(accountType)}
                  className="text-xs font-bold text-[#013220] hover:underline flex items-center justify-center mx-auto space-x-1 cursor-pointer mt-1"
                >
                  <span>{content.gateway.demoBypassText}</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-accent-green" />
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* INTERACTIVE MONTHLY SAVINGS CALCULATOR SLIDER */}
        <section className="bg-white border border-outline-variant rounded-2xl p-6 md:p-8 shadow-xs text-left space-y-6" id="savings-calc">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <div className="inline-flex items-center space-x-1 bg-accent-green/10 text-[#013220] text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3 text-accent-green" />
                <span>Statutory Relief Estimator</span>
              </div>
              <h2 className="text-2xl font-black text-primary-container mt-2">See What You Can Save</h2>
              <p className="text-xs text-on-surface-variant mt-1">
                Slide your expected monthly income in Naira to see how legal deductions can dramatically lower your effective PIT liability.
              </p>
            </div>
            
            <div className="bg-[#013220] text-white p-4 rounded-xl text-center md:text-right flex-shrink-0 border border-emerald-950/20 shadow-xs">
              <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-widest block">Estimated Monthly Savings</span>
              <span className="text-2xl font-black font-mono text-[#4ADE80] mt-1 block">
                ₦{estimates.monthlySavings.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
              <span className="text-[10px] text-neutral-300 font-semibold block mt-0.5">
                (₦{estimates.annualSavings.toLocaleString(undefined, { maximumFractionDigits: 0 })} annually)
              </span>
            </div>
          </div>

          <div className="space-y-6">
            {/* Income Slider input */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Expected Monthly Income</span>
                <span className="text-lg font-black font-mono text-primary-container">
                  ₦{monthlyIncome.toLocaleString()}
                </span>
              </div>
              <input
                type="range"
                min="100000"
                max="2500000"
                step="50000"
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-[#013220]"
              />
              <div className="flex justify-between text-[10px] text-on-surface-variant/60 font-semibold font-mono">
                <span>₦100,000</span>
                <span>₦1,250,000</span>
                <span>₦2,500,000+</span>
              </div>
            </div>

            {/* Side by side comparison of basic vs optimized */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-surface-container-low rounded-xl border border-outline-variant/30 text-left">
                <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Standard PIT Return</span>
                <p className="text-lg font-bold font-mono text-on-surface mt-1">
                  ₦{estimates.standardMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-on-surface-variant font-normal">/ mo</span>
                </p>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Estimated tax using generic rates without legal reliefs or consolidated allowances applied.
                </p>
              </div>

              <div className="p-4 bg-[#013220]/5 rounded-xl border border-[#013220]/20 text-left relative overflow-hidden">
                <div className="absolute top-2 right-2 bg-accent-green text-[#013220] text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded">
                  Optimized
                </div>
                <span className="text-[10px] font-bold text-primary-container uppercase tracking-wider">With DIYtax9ja Reliefs</span>
                <p className="text-lg font-black font-mono text-primary-container mt-1">
                  ₦{estimates.optimizedMonthly.toLocaleString(undefined, { maximumFractionDigits: 0 })} <span className="text-xs text-on-surface-variant font-normal">/ mo</span>
                </p>
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-relaxed">
                  Estimated tax utilizing Consolidated Relief Allowance (CRA), compulsory pensions, and voluntary housing contributions.
                </p>
              </div>
            </div>

            {/* Quick Slider CTAs */}
            <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2">
              <button 
                onClick={() => handleSmoothScroll('auth-portal')}
                className="h-11 px-5 bg-primary-container text-white text-xs font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                Apply These Reliefs & File
              </button>
              <button 
                onClick={() => onGuestDemo?.('individual')}
                className="h-11 px-5 bg-[#013220]/10 text-[#013220] text-xs font-bold rounded-lg hover:bg-surface-container-high active:scale-[0.98] transition-all flex items-center justify-center space-x-1 cursor-pointer"
              >
                <span>Launch Interactive Demo Planner</span>
                <Sparkles className="w-3.5 h-3.5 text-accent-green ml-1" />
              </button>
            </div>
          </div>
        </section>

        {/* CORE FEATURES BENTO GRID */}
        <section className="space-y-6" id="features">
          <div className="text-center md:text-left">
            <h2 className="text-3xl font-black text-primary-container tracking-tight">The Modern Standard for Nigerian Taxes</h2>
            <p className="text-sm text-on-surface-variant mt-1">Everything you need to file and plan, crafted for effortless compliance.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6">
            
            {/* 1. Smart Vault Scanner (Span 7) */}
            <div className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 flex flex-col justify-between text-left space-y-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container/5 rounded-bl-full flex items-center justify-center text-primary-container">
                <Camera className="w-12 h-12 stroke-[1.5]" />
              </div>
              
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <Camera className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-primary-container pt-1">{content.gateway.feature1Title}</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed max-w-md">
                  {content.gateway.feature1Desc}
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-bold text-[#013220] pt-4 border-t border-outline-variant/40">
                <CheckCircle className="w-4 h-4 text-accent-green" />
                <span>AI-Assisted Naira recognition</span>
              </div>
            </div>

            {/* 2. Interactive Tax Planner (Span 5) */}
            <div className="lg:col-span-5 bg-[#013220] text-white border border-[#013220] rounded-2xl p-6 flex flex-col justify-between text-left space-y-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-accent-green">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-white pt-1">{content.gateway.feature2Title}</h3>
                <p className="text-xs text-neutral-300 leading-relaxed">
                  {content.gateway.feature2Desc}
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-bold text-[#4ADE80] pt-4 border-t border-white/10">
                <Sparkles className="w-4 h-4" />
                <span>7 Statutory FIRS relief models integrated</span>
              </div>
            </div>

            {/* 3. Direct NRS Payments (Span 5) */}
            <div className="lg:col-span-5 bg-white border border-outline-variant rounded-2xl p-6 flex flex-col justify-between text-left space-y-6">
              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <Landmark className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-primary-container pt-1">NRS Payment Authorization</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed">
                  Authorize direct tax payments directly via Nigerian Revenue Service standards. Receive instant receipts logged into your file return database upon submission.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-bold text-[#013220] pt-4 border-t border-outline-variant/40">
                <CheckCircle className="w-4 h-4 text-accent-green" />
                <span>Direct bank-reconciled remittance</span>
              </div>
            </div>

            {/* 4. AI Tax Consultant (Span 7) */}
            <div className="lg:col-span-7 bg-white border border-outline-variant rounded-2xl p-6 flex flex-col justify-between text-left space-y-6 relative overflow-hidden">
              <div className="absolute right-0 top-0 w-32 h-32 bg-primary-container/5 rounded-bl-full flex items-center justify-center text-primary-container">
                <MessageSquare className="w-12 h-12 stroke-[1.5]" />
              </div>

              <div className="space-y-2">
                <div className="w-10 h-10 rounded-xl bg-primary-container/10 flex items-center justify-center text-primary-container">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-black text-primary-container pt-1">AI Tax Consultant</h3>
                <p className="text-xs text-on-surface-variant leading-relaxed max-w-lg">
                  Instantly query tax compliance laws. Get authoritative advice on Company Income Tax (CIT) brackets, Consolidated Relief Allowance calculations, late-filing penalties, and WHT credits.
                </p>
              </div>

              <div className="flex items-center space-x-2 text-xs font-bold text-[#013220] pt-4 border-t border-outline-variant/40">
                <CheckCircle className="w-4 h-4 text-accent-green" />
                <span>Nigerian PITA / Finance Acts knowledge base</span>
              </div>
            </div>

          </div>
        </section>

        {/* SECURITY & TRUST BANNER */}
        <section className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 md:p-8 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          <div className="md:col-span-8 text-left space-y-2">
            <div className="flex items-center space-x-2 text-primary-container">
              <ShieldCheck className="w-6 h-6 text-[#013220]" />
              <span className="font-extrabold text-base tracking-tight uppercase">Bank-Grade Compliance Security</span>
            </div>
            <p className="text-xs text-on-surface-variant leading-relaxed max-w-2xl">
              DIYtax9ja is built following bank-level 256-bit secure transport layers. All private NIN validations are performed in compliance with the Nigerian Data Protection Regulation (NDPR) act and certified under local statutory tax standards.
            </p>
          </div>
          <div className="md:col-span-4 flex justify-start md:justify-end space-x-4">
            <div className="flex flex-col items-center p-3 bg-white border border-outline-variant rounded-xl shadow-2xs">
              <Award className="w-8 h-8 text-accent-green mb-1" />
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">NDPR Certified</span>
            </div>
            <div className="flex flex-col items-center p-3 bg-white border border-outline-variant rounded-xl shadow-2xs">
              <FileText className="w-8 h-8 text-primary-container mb-1" />
              <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">FIRS Compliant</span>
            </div>
          </div>
        </section>

        {/* INTERACTIVE FAQ ACCORDION SECTION */}
        <section className="space-y-6 text-left" id="faqs">
          <div>
            <h2 className="text-3xl font-black text-primary-container tracking-tight">Filing & Statutory FAQs</h2>
            <p className="text-sm text-on-surface-variant mt-1">Get instant clarification on Nigerian Personal and Corporate tax rules.</p>
          </div>

          <div className="space-y-3 max-w-3xl">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-white border border-outline-variant rounded-xl overflow-hidden transition-all duration-200"
                >
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full p-4 md:p-5 flex justify-between items-center text-left font-bold text-sm text-primary-container hover:bg-surface-container-low transition-colors cursor-pointer"
                  >
                    <span>{faq.q}</span>
                    <ChevronDown className={`w-4 h-4 text-on-surface-variant transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <motion.div
                    initial={false}
                    animate={{ height: isOpen ? 'auto' : 0 }}
                    className="overflow-hidden"
                  >
                    <div className="p-4 md:p-5 pt-0 border-t border-outline-variant/30 text-xs text-on-surface-variant leading-relaxed bg-surface/30">
                      {faq.a}
                    </div>
                  </motion.div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* 3. SaaS Footer */}
      <footer className="mt-auto bg-white border-t border-outline-variant/60 py-12 text-left">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Brand Col */}
          <div className="space-y-3 md:col-span-2">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8">
                <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                  <rect width="200" height="200" rx="44" fill="#013220"/>
                  <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white"/>
                  <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="font-extrabold text-lg text-primary-container tracking-tight">DIYtax9ja</span>
            </div>
            <p className="text-xs text-on-surface-variant max-w-sm leading-relaxed">
              Automated, secure, and intuitive e-filing for Nigerian self-employed professionals, businesses, and taxpayers. Saving thousands of hours of manual compilation.
            </p>
            <p className="text-[10px] text-on-surface-variant/50">
              © 2026 DIYtax9ja. All rights reserved.
            </p>
          </div>

          {/* Links Col 1 */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-primary-container uppercase tracking-wider">Product Features</h4>
            <ul className="space-y-2 text-xs text-on-surface-variant font-semibold">
              <li><button onClick={() => handleSmoothScroll('features')} className="hover:text-primary-container hover:underline">Vault Scanner</button></li>
              <li><button onClick={() => handleSmoothScroll('savings-calc')} className="hover:text-primary-container hover:underline">PIT Relief Planner</button></li>
              <li><button onClick={() => onGuestDemo?.('individual')} className="hover:text-primary-container hover:underline">AI Statutory Consultant</button></li>
              <li><button onClick={() => handleSmoothScroll('auth-portal')} className="hover:text-primary-container hover:underline">NRS Integrations</button></li>
            </ul>
          </div>

          {/* Compliance Col */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-primary-container uppercase tracking-wider">Regulatory Compliance</h4>
            <p className="text-[11px] text-on-surface-variant leading-relaxed">
              Designed in absolute compliance with the National Information Technology Development Agency (NITDA) of Nigeria, the FIRS tax reconciliation protocols, and NDPR security mandates.
            </p>
          </div>

        </div>
      </footer>
    </div>
  );
}

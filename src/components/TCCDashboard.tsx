import { useState } from 'react';
import { motion } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Clock, XCircle,
  ArrowRight, Download
} from 'lucide-react';
import { TaxFiling } from '../types';

interface TCCDashboardProps {
  filings: TaxFiling[];
}

interface TCCCheckItem {
  id: string;
  label: string;
  year: string;
  category: 'PIT' | 'VAT' | 'CIT' | 'WHT';
  status: 'passed' | 'failed' | 'pending';
  detail: string;
}

const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

export default function TCCDashboard({ filings }: TCCDashboardProps) {
  const [tccRequested, setTccRequested] = useState(false);
  const [tccStep, setTccStep] = useState<'idle' | 'processing' | 'issued'>('idle');
  const [tccRef, setTccRef] = useState('');

  // Build the 3-year compliance check items from filings + simulated data
  const years = ['2024', '2025', '2026'];

  const checkItems: TCCCheckItem[] = [
    // 2024
    { id: 'pit-2024', label: 'Personal Income Tax Filed', year: '2024', category: 'PIT', status: 'passed', detail: 'Filed on Mar 28, 2025 — Receipt NRTX-2024-671230' },
    { id: 'vat-2024', label: 'VAT Returns (All Months)', year: '2024', category: 'VAT', status: 'passed', detail: '12/12 monthly returns filed on time' },
    { id: 'wht-2024', label: 'Withholding Tax Remitted', year: '2024', category: 'WHT', status: 'passed', detail: 'All WHT deductions remitted quarterly' },
    // 2025
    { id: 'pit-2025', label: 'Personal Income Tax Filed', year: '2025', category: 'PIT', status: 'passed', detail: 'Filed on Mar 15, 2026 — Receipt NRTX-2025-842910' },
    { id: 'vat-2025', label: 'VAT Returns (All Months)', year: '2025', category: 'VAT', status: 'passed', detail: '12/12 monthly returns filed on time' },
    { id: 'wht-2025', label: 'Withholding Tax Remitted', year: '2025', category: 'WHT', status: 'passed', detail: 'All WHT deductions remitted quarterly' },
    // 2026 (current — some may still be pending)
    { id: 'pit-2026', label: 'Personal Income Tax Filed', year: '2026', category: 'PIT', status: filings.some(f => f.period.includes('2026') && f.type.includes('Personal') && f.status === 'Paid') ? 'passed' : 'pending', detail: filings.some(f => f.period.includes('2026') && f.type.includes('Personal') && f.status === 'Paid') ? 'Filed — current year return accepted' : 'Not yet filed for FY 2026' },
    { id: 'vat-2026', label: 'VAT Returns (Year-to-Date)', year: '2026', category: 'VAT', status: 'passed', detail: '6/6 monthly returns filed (Jan–Jun 2026)' },
    { id: 'wht-2026', label: 'Withholding Tax Remitted', year: '2026', category: 'WHT', status: 'passed', detail: 'Q1 & Q2 2026 remitted on time' },
  ];

  const passedCount = checkItems.filter(c => c.status === 'passed').length;
  const totalCount = checkItems.length;
  const complianceScore = Math.round((passedCount / totalCount) * 100);
  const isFullyCompliant = complianceScore === 100;

  const outstandingItems = checkItems.filter(c => c.status !== 'passed');

  const handleRequestTCC = () => {
    setTccStep('processing');
    setTimeout(() => {
      const ref = 'TCC-FIRS-' + new Date().getFullYear() + '-' + Math.floor(100000 + Math.random() * 900000);
      setTccRef(ref);
      setTccStep('issued');
      setTccRequested(true);
    }, 3000);
  };

  // SVG ring calculations
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (complianceScore / 100) * circumference;

  const statusIcon = (status: string) => {
    if (status === 'passed') return <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />;
    if (status === 'failed') return <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />;
    return <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />;
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left pb-12">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">Tax Clearance Certificate (TCC)</h2>
        <p className="text-sm text-on-surface-variant mt-1">Track your 3-year compliance status and request your TCC when ready.</p>
      </div>

      {/* Top Section: Score Ring + Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* Compliance Score Ring */}
        <div className="md:col-span-1 bg-white border border-outline-variant rounded-2xl p-6 flex flex-col items-center justify-center shadow-xs">
          <div className="relative w-44 h-44">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 160 160">
              <circle cx="80" cy="80" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="10" />
              <motion.circle
                cx="80" cy="80" r={radius}
                fill="none"
                stroke={isFullyCompliant ? '#059669' : complianceScore >= 70 ? '#d97706' : '#dc2626'}
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: dashOffset }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-black text-primary-container">{complianceScore}%</span>
              <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mt-0.5">Compliant</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-on-surface-variant mt-3 text-center">
            {isFullyCompliant ? '🎉 You are fully compliant!' : `${totalCount - passedCount} item(s) need attention`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Years Covered</p>
            <p className="text-2xl font-black text-primary-container mt-1">2024 – 2026</p>
            <p className="text-[10px] text-on-surface-variant mt-1">3 fiscal years reviewed</p>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Checks Passed</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{passedCount} / {totalCount}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">PIT, VAT, WHT across 3 years</p>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Tax Paid (3yr)</p>
            <p className="text-2xl font-black text-primary-container mt-1">{formatNaira(filings.reduce((s, f) => s + f.amount, 0))}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">From filing history</p>
          </div>
          <div className={`border rounded-xl p-5 shadow-xs ${isFullyCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isFullyCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>TCC Status</p>
            <p className={`text-lg font-black mt-1 ${isFullyCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
              {tccRequested ? 'Issued ✅' : isFullyCompliant ? 'Ready to Request' : 'Not Yet Eligible'}
            </p>
            <p className={`text-[10px] mt-1 ${isFullyCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>
              {tccRequested ? `Ref: ${tccRef}` : isFullyCompliant ? 'All requirements met' : 'Resolve outstanding items'}
            </p>
          </div>
        </div>
      </div>

      {/* 3-Year Filing Checklist */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        <div className="px-6 py-4 border-b border-outline-variant/40">
          <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">3-Year Compliance Checklist</h3>
        </div>

        {years.map(year => {
          const yearItems = checkItems.filter(c => c.year === year);
          const yearPassed = yearItems.every(c => c.status === 'passed');
          return (
            <div key={year} className="border-b border-outline-variant/30 last:border-b-0">
              <div className="px-6 py-3 bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  {yearPassed
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    : <AlertTriangle className="w-4 h-4 text-amber-500" />
                  }
                  <span className="text-xs font-bold text-on-surface">Fiscal Year {year}</span>
                </div>
                <span className={`text-[9px] font-bold uppercase px-2.5 py-0.5 rounded-full ${yearPassed ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                  {yearPassed ? 'Compliant' : 'Action Required'}
                </span>
              </div>
              <div className="divide-y divide-outline-variant/20">
                {yearItems.map(item => (
                  <div key={item.id} className="px-6 py-3 flex items-center justify-between">
                    <div className="flex items-center space-x-3 min-w-0">
                      {statusIcon(item.status)}
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-on-surface">{item.label}</p>
                        <p className="text-[10px] text-on-surface-variant truncate">{item.detail}</p>
                      </div>
                    </div>
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full flex-shrink-0 ml-3 ${
                      item.status === 'passed' ? 'bg-emerald-50 text-emerald-700' :
                      item.status === 'failed' ? 'bg-red-50 text-red-700' :
                      'bg-amber-50 text-amber-700'
                    }`}>
                      {item.category}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Outstanding Items */}
      {outstandingItems.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 space-y-3">
          <h3 className="text-sm font-bold text-amber-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Outstanding Items to Resolve
          </h3>
          <div className="space-y-2">
            {outstandingItems.map(item => (
              <div key={item.id} className="flex items-center justify-between bg-white border border-amber-200 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-on-surface">{item.label} — {item.year}</p>
                  <p className="text-[10px] text-amber-700">{item.detail}</p>
                </div>
                <button className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer flex-shrink-0">
                  Resolve <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Request TCC Button */}
      {tccStep === 'idle' && (
        <button
          onClick={isFullyCompliant ? handleRequestTCC : undefined}
          disabled={!isFullyCompliant}
          className={`w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm ${
            isFullyCompliant
              ? 'bg-[#013220] text-white hover:opacity-95 active:scale-[0.99] cursor-pointer'
              : 'bg-gray-200 text-gray-400 cursor-not-allowed'
          }`}
        >
          <ShieldCheck className="w-5 h-5" />
          <span>{isFullyCompliant ? 'Request Tax Clearance Certificate from FIRS' : 'Complete All Requirements to Request TCC'}</span>
        </button>
      )}

      {tccStep === 'processing' && (
        <div className="w-full h-14 rounded-xl bg-[#013220]/10 border border-[#013220]/20 flex items-center justify-center space-x-3">
          <div className="w-5 h-5 border-2 border-[#013220]/20 border-t-[#013220] rounded-full animate-spin"></div>
          <span className="text-sm font-bold text-[#013220]">Submitting TCC Request to FIRS...</span>
        </div>
      )}

      {tccStep === 'issued' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-50 border-2 border-emerald-300 rounded-2xl p-6 text-center space-y-4"
        >
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-xl font-black text-emerald-800">Tax Clearance Certificate Issued!</h3>
          <div className="bg-white border border-emerald-200 rounded-xl p-4 inline-block">
            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Certificate Reference</p>
            <p className="text-xl font-mono font-black text-emerald-800 mt-1">{tccRef}</p>
          </div>
          <p className="text-xs text-emerald-700">Valid for visas, government contracts, bank credit approvals, and land transactions.</p>
          <button className="h-11 px-6 bg-emerald-600 text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.99] transition-all flex items-center space-x-2 mx-auto cursor-pointer">
            <Download className="w-4 h-4" />
            <span>Download TCC Certificate (PDF)</span>
          </button>
        </motion.div>
      )}
    </div>
  );
}

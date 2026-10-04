import { motion } from 'motion/react';
import {
  ShieldCheck, CheckCircle2, AlertTriangle, Clock, XCircle,
  ArrowRight, ExternalLink
} from 'lucide-react';
import { TaxFiling } from '../types';

interface TCCDashboardProps {
  filings: TaxFiling[];
  accountMode?: 'personal' | 'business';
  onStartFiling?: () => void;
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

/** Year a filing relates to: from its period (e.g. "FY 2025", "March 2026"), else its filing date. */
const filingYear = (f: TaxFiling) =>
  (f.period.match(/\b(20\d{2})\b/) || f.dateFiled.match(/^(20\d{2})/) || [])[1] || '';

const TAXPROMAX_URL = 'https://taxpromax.firs.gov.ng';

export default function TCCDashboard({ filings, accountMode = 'personal', onStartFiling }: TCCDashboardProps) {
  // A TCC covers the three years preceding the application year
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 3, currentYear - 2, currentYear - 1].map(String);

  const incomeCategory: 'PIT' | 'CIT' = accountMode === 'business' ? 'CIT' : 'PIT';
  const incomeLabel = accountMode === 'business' ? 'Company Income Tax Filed' : 'Personal Income Tax Filed';
  const isIncomeTax = (f: TaxFiling) =>
    accountMode === 'business' ? /company income tax|\bCIT\b/i.test(f.type) : /personal income tax|\bPIT\b|estimated income tax/i.test(f.type);
  const isVat = (f: TaxFiling) => /VAT|value added/i.test(f.type);

  const buildCheck = (
    year: string, category: TCCCheckItem['category'], label: string, match: (f: TaxFiling) => boolean
  ): TCCCheckItem => {
    const yearFilings = filings.filter(f => filingYear(f) === year && match(f));
    const paid = yearFilings.find(f => f.status === 'Paid');
    const open = yearFilings.find(f => f.status !== 'Paid');
    if (paid) {
      return { id: `${category}-${year}`, label, year, category, status: 'passed', detail: `Paid ${paid.dateFiled} — Ref ${paid.receiptNumber}` };
    }
    if (open) {
      return { id: `${category}-${year}`, label, year, category, status: 'pending', detail: `${open.status} — Ref ${open.receiptNumber}. Complete payment to clear this item.` };
    }
    return { id: `${category}-${year}`, label, year, category, status: 'failed', detail: `No return recorded for ${year}` };
  };

  const checkItems: TCCCheckItem[] = years.flatMap(year => [
    buildCheck(year, incomeCategory, incomeLabel, isIncomeTax),
    ...(accountMode === 'business' ? [buildCheck(year, 'VAT', 'VAT Returns', isVat)] : []),
  ]);

  const passedCount = checkItems.filter(c => c.status === 'passed').length;
  const totalCount = checkItems.length;
  const complianceScore = Math.round((passedCount / totalCount) * 100);
  const isFullyCompliant = complianceScore === 100;

  const outstandingItems = checkItems.filter(c => c.status !== 'passed');
  const totalPaidInWindow = filings
    .filter(f => years.includes(filingYear(f)) && f.status === 'Paid')
    .reduce((s, f) => s + f.amount, 0);

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
            {isFullyCompliant ? 'Records complete for all 3 years' : `${totalCount - passedCount} item(s) need attention`}
          </p>
        </div>

        {/* Summary Cards */}
        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Years Covered</p>
            <p className="text-2xl font-black text-primary-container mt-1">{years[0]} – {years[2]}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">3 preceding fiscal years</p>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Checks Passed</p>
            <p className="text-2xl font-black text-emerald-700 mt-1">{passedCount} / {totalCount}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">{accountMode === 'business' ? 'CIT & VAT' : 'PIT'} across 3 years</p>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Tax Paid (3yr)</p>
            <p className="text-2xl font-black text-primary-container mt-1">{formatNaira(totalPaidInWindow)}</p>
            <p className="text-[10px] text-on-surface-variant mt-1">From your filing history</p>
          </div>
          <div className={`border rounded-xl p-5 shadow-xs ${isFullyCompliant ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${isFullyCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>TCC Readiness</p>
            <p className={`text-lg font-black mt-1 ${isFullyCompliant ? 'text-emerald-700' : 'text-amber-700'}`}>
              {isFullyCompliant ? 'Ready to Apply' : 'Not Yet Eligible'}
            </p>
            <p className={`text-[10px] mt-1 ${isFullyCompliant ? 'text-emerald-600' : 'text-amber-600'}`}>
              {isFullyCompliant ? 'Your records cover all 3 years' : 'Resolve outstanding items'}
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
                <button
                  onClick={onStartFiling}
                  className="text-[10px] font-bold text-amber-700 hover:text-amber-900 flex items-center gap-1 cursor-pointer flex-shrink-0"
                >
                  Resolve <ArrowRight className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Apply for TCC on the official portal (DIYtax9ja cannot issue certificates) */}
      <a
        href={isFullyCompliant ? TAXPROMAX_URL : undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-disabled={!isFullyCompliant}
        className={`w-full h-14 rounded-xl text-sm font-bold flex items-center justify-center space-x-2 transition-all shadow-sm ${
          isFullyCompliant
            ? 'bg-[#013220] text-white hover:opacity-95 active:scale-[0.99] cursor-pointer'
            : 'bg-gray-200 text-gray-400 cursor-not-allowed pointer-events-none'
        }`}
      >
        <ShieldCheck className="w-5 h-5" />
        <span>{isFullyCompliant ? 'Apply for TCC on TaxPro Max (NRS)' : 'Complete All Requirements to Apply for TCC'}</span>
        {isFullyCompliant && <ExternalLink className="w-4 h-4" />}
      </a>
      <p className="text-[10px] text-on-surface-variant text-center">
        Readiness is based on returns recorded in DIYtax9ja. Certificates are issued only by NRS / State IRS.
      </p>
    </div>
  );
}

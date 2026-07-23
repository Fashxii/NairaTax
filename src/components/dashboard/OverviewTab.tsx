import React from 'react';
import { motion } from 'motion/react';
import { 
  Info, FileText, Landmark, ChevronRight 
} from 'lucide-react';
import { UserSession } from '../../types';
import { useContent } from '../../context/ContentContext';
import BankSyncPanel from '../BankSyncPanel';
import TaxSavingsInsights from '../TaxSavingsInsights';

export interface SyncTransaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amount: number;
  isDeductible: boolean;
}

interface DonutData {
  total: number;
  pitLabel: string;
  pitValue: number;
  vatLabel: string;
  vatValue: number;
  deductionsLabel: string;
  deductionsValue: number;
  pitStroke: string;
  vatStroke: string;
  vatOffset: number;
  dedStroke: string;
  dedOffset: number;
}

interface OverviewTabProps {
  session: UserSession;
  accountMode: 'personal' | 'business';
  currentTaxpayerName: string;
  transactions: SyncTransaction[];
  donutData: DonutData;
  personalRentReliefUsed: number;
  personalRentReliefCap: number;
  personalRentReliefPercent: number;
  businessExpenseUsed: number;
  businessExpenseCap: number;
  businessExpensePercent: number;
  onStartFiling: () => void;
}

export default function OverviewTab({
  session,
  accountMode,
  currentTaxpayerName,
  transactions,
  donutData,
  personalRentReliefUsed,
  personalRentReliefCap,
  personalRentReliefPercent,
  businessExpenseUsed,
  businessExpenseCap,
  businessExpensePercent,
  onStartFiling,
}: OverviewTabProps) {
  const { content } = useContent();

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      {/* Greeting Area */}
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          {content.dashboard.welcomeGreeting}, {currentTaxpayerName}
        </h2>
        <div className="flex items-center gap-1.5 mt-1">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
          <span className="text-[10px] text-on-surface-variant font-medium">Synced just now</span>
        </div>
        
        <div className="inline-flex items-center mt-3 px-3.5 py-1 rounded-full bg-[#013220]/10 border border-[#013220]/25">
          <div className="w-1.5 h-1.5 rounded-full bg-[#013220] mr-2"></div>
          <span className="text-[10px] font-bold text-primary-container uppercase tracking-widest">
            {session.isNINLinked ? 'Status: Fully Compliant (FY2026)' : 'Status: Identity Unlinked'}
          </span>
        </div>
      </div>

      {/* Financial Summary & Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gamified Tax Savings (Phase 4) */}
        <div className="col-span-1 lg:col-span-2">
          <TaxSavingsInsights 
            savingsAmount={125000} 
            filingStreak={3} 
            percentileRank={15} 
          />
        </div>

        {/* Bank Sync Panel (Phase 4) */}
        <div className="col-span-1 lg:col-span-2">
          <BankSyncPanel onTransactionsSynced={(count, amount) => {
            console.log(`Synced ${count} transactions totaling ${amount}`);
          }} />
        </div>
      </div>

      {/* Primary Bento row: Donut Chart & Deductions cap tracker */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Donut chart matching layout precisely */}
        <div className="lg:col-span-7 bg-white border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4">Current Estimated Tax Liability</h3>
            
            <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
              {/* Interactive Donut SVG */}
              <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle className="stroke-surface-container-highest fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40"></circle>
                  <circle className="stroke-[#013220] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.pitStroke }}></circle>
                  <circle className="stroke-[#6f9c84] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.vatStroke, strokeDashoffset: donutData.vatOffset }}></circle>
                  <circle className="stroke-[#bdedd2] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.dedStroke, strokeDashoffset: donutData.dedOffset }}></circle>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Total</span>
                  <span className="text-lg font-black text-primary font-mono">₦{donutData.total.toLocaleString()}</span>
                </div>
              </div>

              {/* Chart Legend */}
              <div className="grid grid-cols-1 gap-2.5 w-full">
                <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#013220] bg-surface-container-low rounded-r-lg">
                  <span className="text-[11px] text-on-surface-variant font-medium">{donutData.pitLabel}</span>
                  <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.pitValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#6f9c84] bg-surface-container-low rounded-r-lg">
                  <span className="text-[11px] text-on-surface-variant font-medium">{donutData.vatLabel}</span>
                  <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.vatValue.toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#bdedd2] bg-surface-container-low rounded-r-lg">
                  <span className="text-[11px] text-on-surface-variant font-medium">{donutData.deductionsLabel}</span>
                  <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.deductionsValue.toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right side trackers */}
        <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
          {/* Pro Tip Banner */}
          <div className="bg-[#bdedd2]/35 border border-[#6f9c84]/40 rounded-xl p-4 flex gap-3 items-start">
            <Info className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[#013220] leading-relaxed">
                <span className="font-extrabold">Pro Tip:</span> {accountMode === 'personal' 
                  ? "Your annual rent is deductible up to 20% of your total income. Keep your receipts in the Smart Vault!" 
                  : "Corporate research and development expenses are 100% tax-deductible under Section 26 of CIT Act. Scan your vendor invoices!"}
              </p>
            </div>
          </div>

          {/* Deductions Tracker */}
          <div className="bg-white border border-outline-variant rounded-xl p-5 relative border-l-4 border-l-primary-container flex flex-col justify-between">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="font-bold text-xs text-primary uppercase tracking-wider">
                  {accountMode === 'personal' ? 'Deductions Tracker' : 'Allowable Expense Tracker'}
                </h3>
                <p className="text-[10px] text-on-surface-variant mt-0.5">
                  {accountMode === 'personal' ? 'Rent Relief Cap Tool' : 'Travel Expense Allowance Cap'}
                </p>
              </div>
              <FileText className="w-4.5 h-4.5 text-primary" />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-[11px] text-on-surface font-semibold">
                <span className="font-mono font-bold">₦{(accountMode === 'personal' ? personalRentReliefUsed : businessExpenseUsed).toLocaleString()} used</span>
                <span className="text-on-surface-variant font-mono">₦{(accountMode === 'personal' ? personalRentReliefCap : businessExpenseCap).toLocaleString()} Cap</span>
              </div>

              <div className="w-full h-3.5 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant/35">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${accountMode === 'personal' ? personalRentReliefPercent : businessExpensePercent}%` }}
                  transition={{ duration: 0.8 }}
                  className="h-full bg-primary-container"
                />
              </div>

              <p className="text-[10px] text-on-surface-variant leading-normal mt-2">
                You've utilized {accountMode === 'personal' ? personalRentReliefPercent : businessExpensePercent}% of your allowed {accountMode === 'personal' ? '20% rent relief' : 'business corporate'} deduction allowance for the current fiscal cycle.
              </p>
            </div>
          </div>
        </div>

      </div>

      {/* Ledger sync transactions ledger & quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Ledger logs */}
        <div className="lg:col-span-8 bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-xs text-on-surface uppercase tracking-wider">Sync Transaction Activity</h3>
            <button 
              onClick={() => alert('Viewing complete live financial ledger...')}
              className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center space-x-1"
            >
              <span>View All Transactions</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-2">
            {transactions.map((tx) => (
              <div 
                key={tx.id}
                className="flex items-center gap-3 bg-surface-container-low/40 border border-outline-variant/50 p-3 rounded-xl hover:bg-surface-container-low transition-all"
              >
                <div className="w-9 h-9 bg-white border border-outline-variant/60 rounded-lg flex items-center justify-center flex-shrink-0">
                  {tx.merchant.toLowerCase().includes('lirs') || tx.merchant.toLowerCase().includes('revenue') ? (
                    <Landmark className="w-4 h-4 text-primary" />
                  ) : (
                    <FileText className="w-4 h-4 text-primary" />
                  )}
                </div>

                <div className="flex-grow min-w-0 text-left">
                  <div className="flex justify-between items-start">
                    <h4 className="text-xs font-bold text-on-surface truncate pr-2">{tx.merchant}</h4>
                    <span className="text-[10px] text-on-surface font-bold font-mono flex-shrink-0">₦{tx.amount.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[9px] text-on-surface-variant font-medium">{tx.date}</span>
                    
                    <div className="flex items-center gap-1">
                      <span className="px-1.5 py-0.5 bg-surface-container-high text-[8px] font-bold rounded uppercase tracking-wider text-on-surface-variant">{tx.category}</span>
                      {tx.isDeductible ? (
                        <span className="text-[8px] font-bold text-on-primary-container px-1.5 py-0.5 rounded bg-primary-fixed/40 uppercase">Deductible</span>
                      ) : (
                        <span className="text-[8px] font-bold text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 uppercase">Personal</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Actions Column */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-6">
          {/* File returns button */}
          <div className="bg-[#013220] text-white p-5 rounded-xl border border-outline-variant flex flex-col justify-between h-full space-y-4">
            <div>
              <span className="text-[9px] font-bold text-accent-green uppercase tracking-widest block">Statutory Filing Portal</span>
              <h3 className="font-extrabold text-sm text-white uppercase mt-1">Ready to File?</h3>
              <p className="text-[11px] text-neutral-300 leading-relaxed mt-2">
                Lock in your deductible allowable expenses and submit your annual self-assessment clearance return directly to the FIRS.
              </p>
            </div>

            <button
              onClick={onStartFiling}
              className="w-full py-3 bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-[#013220] rounded-lg font-black text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
            >
              <FileText className="w-4.5 h-4.5" />
              <span>Start Annual Filing</span>
            </button>
          </div>
        </div>

      </div>
    </motion.section>
  );
}

import { motion } from 'motion/react';
import { Trophy, TrendingUp, Flame, Star, Target, Sparkles } from 'lucide-react';

interface TaxSavingsInsightsProps {
  savingsAmount: number;
  filingStreak: number;
  deductionsCount: number;
  hasIncome?: boolean;
}

export default function TaxSavingsInsights({ savingsAmount, filingStreak, deductionsCount, hasIncome = true }: TaxSavingsInsightsProps) {
  const formatNaira = (amount: number) => '₦' + amount.toLocaleString('en-NG');

  return (
    <div className="bg-surface-container-low border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-amber-100/40 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none"></div>
      
      <div className="flex items-center space-x-2 mb-4 relative z-10">
        <Trophy className="w-5 h-5 text-amber-500" />
        <h3 className="text-sm font-black text-on-surface uppercase tracking-wider">Your Tax Achievements</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 relative z-10">
        {/* Savings Badge */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Total Saved</span>
          </div>
          <p className="text-xl font-black text-primary-container">{formatNaira(savingsAmount)}</p>
          <p className="text-[10px] text-emerald-600 font-bold mt-1">
            {hasIncome ? 'Estimated, from your recorded deductions' : 'Add your income at filing to estimate'}
          </p>
        </motion.div>

        {/* Streak Badge */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm"
        >
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
              <Flame className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Filing Streak</span>
          </div>
          <div className="flex items-baseline space-x-1">
            <p className="text-xl font-black text-primary-container">{filingStreak}</p>
            <p className="text-xs font-bold text-on-surface-variant">{filingStreak === 1 ? 'Year' : 'Years'}</p>
          </div>
          <p className="text-[10px] text-orange-600 font-bold mt-1">
            {filingStreak > 0 ? 'Consecutive years with an income tax return' : 'File your first return to start a streak'}
          </p>
        </motion.div>

        {/* Community Rank */}
        <motion.div 
          whileHover={{ y: -2 }}
          className="bg-white border border-outline-variant rounded-xl p-4 shadow-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 p-2 opacity-10">
            <Target className="w-12 h-12" />
          </div>
          <div className="flex items-center space-x-2 mb-2">
            <div className="w-6 h-6 bg-purple-100 rounded-full flex items-center justify-center">
              <Star className="w-3.5 h-3.5 text-purple-600" />
            </div>
            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Deductions Logged</span>
          </div>
          <p className="text-xl font-black text-primary-container">{deductionsCount}</p>
          <p className="text-[10px] text-purple-600 font-bold mt-1">Deductible receipts in your ledger</p>
        </motion.div>
      </div>

      <div className="mt-4 pt-4 border-t border-outline-variant/40 flex items-start space-x-3 text-sm">
        <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-on-surface-variant font-semibold">
          <strong className="text-on-surface">Insight:</strong>{' '}
          {deductionsCount === 0
            ? 'Record rent, utilities and business expenses with the camera button to reduce your estimated tax.'
            : 'Keep original receipts for at least 6 years — NRS can request them during an audit.'}
        </p>
      </div>
    </div>
  );
}

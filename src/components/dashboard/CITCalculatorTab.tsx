import React, { useState, memo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Building, AlertTriangle,
  Info, Sparkles, CheckCircle2
} from 'lucide-react';
import {
  calculateCIT, CITInput, CITResult, CIT_TIERS
} from '../../utils/citEngine';
import {
  ASSET_CLASSES, calculateAssetAllowance, AllowanceResult
} from '../../utils/capitalAllowances';
import { formatNaira } from '../../utils/taxEngine';

const CITCalculatorTab = memo(function CITCalculatorTab() {
  // Form inputs
  const [grossTurnover, setGrossTurnover] = useState('75000000');
  const [totalRevenue, setTotalRevenue] = useState('75000000');
  const [allowableExpenses, setAllowableExpenses] = useState('45000000');
  const [capitalAllowancesInput, setCapitalAllowancesInput] = useState('3500000');
  const [lossesForward, setLossesForward] = useState('0');
  const [isTechSector, setIsTechSector] = useState(false);

  // Capital Allowances Calculator
  const [showAllowanceCalc, setShowAllowanceCalc] = useState(false);
  const [assetClassId, setAssetClassId] = useState('plant-machinery');
  const [assetCost, setAssetCost] = useState('');
  const [allowancePreview, setAllowancePreview] = useState<AllowanceResult | null>(null);

  // Result
  const [result, setResult] = useState<CITResult | null>(null);

  const handleCalculate = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input: CITInput = {
      grossTurnover: parseFloat(grossTurnover) || 0,
      totalRevenue: parseFloat(totalRevenue) || 0,
      allowableExpenses: parseFloat(allowableExpenses) || 0,
      capitalAllowances: parseFloat(capitalAllowancesInput) || 0,
      lossesCarriedForward: parseFloat(lossesForward) || 0,
      isTechLevySector: isTechSector,
    };
    setResult(calculateCIT(input));
  };

  // Auto-calculate on first render
  useEffect(() => {
    handleCalculate();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePreviewAllowance = () => {
    const cost = parseFloat(assetCost);
    if (isNaN(cost) || cost <= 0) return;
    const preview = calculateAssetAllowance(cost, assetClassId);
    setAllowancePreview(preview);
  };

  const handleApplyAllowance = () => {
    if (!allowancePreview) return;
    const current = parseFloat(capitalAllowancesInput) || 0;
    setCapitalAllowancesInput(String(current + allowancePreview.firstYearTotal));
    setAllowancePreview(null);
    setAssetCost('');
    setShowAllowanceCalc(false);
  };

  const currentTier = CIT_TIERS.find(t =>
    (parseFloat(grossTurnover) || 0) <= t.maxTurnover
  ) || CIT_TIERS[CIT_TIERS.length - 1];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          Company Income Tax (CIT) Calculator
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Compute corporate tax liability under the Companies Income Tax Act (CITA) with capital allowances, minimum tax, and Education Tax (EDT).
        </p>
      </div>

      {/* Classification Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {CIT_TIERS.map(tier => (
          <div
            key={tier.label}
            className={`p-4 rounded-xl border transition-all ${
              currentTier.label === tier.label
                ? 'bg-primary-container/10 border-primary-container shadow-sm'
                : 'bg-white border-outline-variant'
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                currentTier.label === tier.label ? 'text-primary-container' : 'text-on-surface-variant'
              }`}>
                {tier.label}
              </span>
              <span className={`text-lg font-black ${
                currentTier.label === tier.label ? 'text-primary-container' : 'text-on-surface'
              }`}>
                {tier.rateLabel}
              </span>
            </div>
            <p className="text-[10px] text-on-surface-variant">{tier.description}</p>
            {currentTier.label === tier.label && (
              <div className="mt-2 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span className="text-[10px] font-bold text-emerald-600">Your Classification</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Input Form */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-5">
            <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Company Financial Data</h3>

            <form onSubmit={handleCalculate} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                  Gross Turnover (₦)
                </label>
                <input
                  type="number"
                  value={grossTurnover}
                  onChange={e => setGrossTurnover(e.target.value)}
                  className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                  placeholder="e.g. 75000000"
                />
                <p className="text-[9px] text-on-surface-variant">Used for company classification and minimum tax calculation</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                  Total Revenue (₦)
                </label>
                <input
                  type="number"
                  value={totalRevenue}
                  onChange={e => setTotalRevenue(e.target.value)}
                  className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                  placeholder="e.g. 75000000"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                  Allowable Expenses (₦)
                </label>
                <input
                  type="number"
                  value={allowableExpenses}
                  onChange={e => setAllowableExpenses(e.target.value)}
                  className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                  placeholder="e.g. 45000000"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Capital Allowances (₦)
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowAllowanceCalc(!showAllowanceCalc)}
                    className="text-[9px] font-bold text-primary-container hover:underline cursor-pointer flex items-center gap-1"
                  >
                    <Sparkles className="w-3 h-3" />
                    {showAllowanceCalc ? 'Hide' : 'Calculate'} Allowance
                  </button>
                </div>
                <input
                  type="number"
                  value={capitalAllowancesInput}
                  onChange={e => setCapitalAllowancesInput(e.target.value)}
                  className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                  placeholder="e.g. 3500000"
                />
              </div>

              {/* Capital Allowance Calculator Inline */}
              {showAllowanceCalc && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="bg-surface-container-low border border-outline-variant rounded-lg p-4 space-y-3"
                >
                  <p className="text-[10px] font-bold text-primary-container uppercase tracking-wider">Quick Asset Allowance Calculator</p>
                  <div className="space-y-2">
                    <select
                      value={assetClassId}
                      onChange={e => setAssetClassId(e.target.value)}
                      className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container cursor-pointer"
                    >
                      {ASSET_CLASSES.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} (IA: {(c.initialAllowanceRate * 100)}% / AA: {(c.annualAllowanceRate * 100)}%)
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={assetCost}
                      onChange={e => setAssetCost(e.target.value)}
                      placeholder="Acquisition cost (₦)"
                      className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                    />
                    <button
                      type="button"
                      onClick={handlePreviewAllowance}
                      className="w-full h-9 bg-primary-container/10 text-primary-container text-[10px] font-bold uppercase tracking-wider rounded-lg hover:bg-primary-container/20 transition-colors cursor-pointer"
                    >
                      Preview Allowance
                    </button>
                  </div>

                  {allowancePreview && (
                    <div className="bg-white rounded-lg p-3 border border-outline-variant space-y-2">
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div>
                          <span className="text-on-surface-variant font-bold">Initial Allowance</span>
                          <p className="font-mono font-bold text-primary-container">{formatNaira(allowancePreview.initialAllowance)}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Annual Allowance</span>
                          <p className="font-mono font-bold text-primary-container">{formatNaira(allowancePreview.annualAllowance)}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Year 1 Total</span>
                          <p className="font-mono font-bold text-emerald-600">{formatNaira(allowancePreview.firstYearTotal)}</p>
                        </div>
                        <div>
                          <span className="text-on-surface-variant font-bold">Written Down Value</span>
                          <p className="font-mono font-bold text-on-surface">{formatNaira(allowancePreview.taxWrittenDownValue)}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleApplyAllowance}
                        className="w-full h-8 bg-[#013220] text-white text-[10px] font-bold rounded-lg hover:opacity-95 transition-all cursor-pointer"
                      >
                        + Add {formatNaira(allowancePreview.firstYearTotal)} to Capital Allowances
                      </button>
                    </div>
                  )}
                </motion.div>
              )}

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                  Losses Carried Forward (₦)
                </label>
                <input
                  type="number"
                  value={lossesForward}
                  onChange={e => setLossesForward(e.target.value)}
                  className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                  placeholder="0"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
                <div>
                  <span className="text-[10px] font-bold text-on-surface">Technology Levy Sector</span>
                  <p className="text-[9px] text-on-surface-variant">ICT, Telecom, Finance, Insurance, etc.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsTechSector(!isTechSector)}
                  className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                    isTechSector ? 'bg-primary-container justify-end' : 'bg-outline-variant justify-start'
                  }`}
                >
                  <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                </button>
              </div>

              <button
                type="submit"
                className="w-full h-12 bg-[#013220] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
              >
                <Building className="w-4 h-4" />
                Calculate CIT
              </button>
            </form>
          </div>
        </div>

        {/* Results Panel */}
        <div className="lg:col-span-7 space-y-4">
          {result && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* Summary Card */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">CIT Computation Summary</h3>
                  <span className={`px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider ${
                    result.citRate === 0
                      ? 'bg-emerald-50 text-emerald-700'
                      : result.citRate === 0.20
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>
                    {result.companyClassification} — {result.citRateLabel}
                  </span>
                </div>

                <div className="space-y-2">
                  {[
                    { label: 'Gross Turnover', value: formatNaira(result.grossTurnover), color: '' },
                    { label: 'Total Revenue', value: formatNaira(result.totalRevenue), color: '' },
                    { label: 'Less: Allowable Expenses', value: `(${formatNaira(result.allowableExpenses)})`, color: 'text-red-500' },
                    { label: 'Less: Capital Allowances', value: `(${formatNaira(result.capitalAllowances)})`, color: 'text-red-500' },
                    { label: 'Assessable Profit', value: formatNaira(result.assessableProfit), color: 'text-primary-container font-bold' },
                    { label: 'Less: Losses B/F', value: `(${formatNaira(result.lossesCarriedForward)})`, color: 'text-red-500' },
                    { label: 'Total Profit', value: formatNaira(result.totalProfitAfterLosses), color: 'text-primary-container font-bold' },
                  ].map(row => (
                    <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-outline-variant/30 last:border-0">
                      <span className="text-xs text-on-surface-variant">{row.label}</span>
                      <span className={`text-xs font-mono font-semibold ${row.color || 'text-on-surface'}`}>{row.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax Breakdown */}
              <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs">
                <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider mb-4">Tax Liability Breakdown</h3>

                <div className="space-y-2">
                  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                    <div>
                      <span className="text-xs text-on-surface">CIT at {result.citRateLabel}</span>
                      {result.isMinimumTaxApplied && (
                        <span className="ml-2 text-[9px] bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded font-bold">
                          Minimum Tax Applied
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-mono font-bold text-on-surface">{formatNaira(result.applicableTax)}</span>
                  </div>

                  {result.isMinimumTaxApplied && (
                    <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-amber-800 leading-relaxed">
                        <strong>Minimum Tax Rule:</strong> Your computed CIT ({formatNaira(result.citLiability)}) is less than the minimum tax of 0.5% of gross turnover ({formatNaira(result.minimumTax)}). The higher amount applies.
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                    <span className="text-xs text-on-surface">Education Tax (EDT) at 2.5%</span>
                    <span className="text-xs font-mono font-semibold text-on-surface">{formatNaira(result.educationTax)}</span>
                  </div>

                  {result.techLevy > 0 && (
                    <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                      <span className="text-xs text-on-surface">Technology Levy at 1%</span>
                      <span className="text-xs font-mono font-semibold text-on-surface">{formatNaira(result.techLevy)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between py-3 bg-primary-container/5 rounded-lg px-3 -mx-1 mt-2">
                    <span className="text-sm font-bold text-primary-container">Total Tax Payable</span>
                    <span className="text-lg font-black font-mono text-primary-container">{formatNaira(result.totalTaxPayable)}</span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-[10px]">
                    <span className="text-on-surface-variant font-bold">Effective Tax Rate</span>
                    <span className="font-mono font-bold text-primary-container">{result.effectiveRate.toFixed(2)}%</span>
                  </div>
                </div>
              </div>

              {/* Legal Reference */}
              <div className="flex items-start gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-xl">
                <Info className="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
                <p className="text-[10px] text-on-surface-variant leading-relaxed">
                  <strong className="text-on-surface">Reference:</strong> Computed under the Companies Income Tax Act (CITA) as amended by the Finance Acts. Small companies (turnover ≤ ₦25M) are exempt from CIT. Education Tax applies to all companies with assessable profit. Minimum tax (0.5% of gross turnover) applies where CIT computed is lower.
                </p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.section>
  );
});

export default CITCalculatorTab;

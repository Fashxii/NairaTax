import React, { useState, memo } from 'react';
import { motion } from 'motion/react';
import {
  Stamp, TrendingDown, Info, CheckCircle2
} from 'lucide-react';
import {
  STAMP_DUTY_CATEGORIES, calculateStampDuty, StampDutyResult,
  calculateCGT, CGTInput, CGTResult
} from '../../utils/taxEngine';
import { formatNaira } from '../../utils/taxEngine';

type ActiveCalc = 'stamp-duty' | 'cgt';

const StampDutyCGTTab = memo(function StampDutyCGTTab() {
  const [activeCalc, setActiveCalc] = useState<ActiveCalc>('stamp-duty');

  // Stamp Duty state
  const [sdCategoryId, setSdCategoryId] = useState('lease');
  const [sdInstrumentValue, setSdInstrumentValue] = useState('5000000');
  const [sdResult, setSdResult] = useState<StampDutyResult | null>(null);

  // CGT state
  const [cgtAssetDesc, setCgtAssetDesc] = useState('Commercial Property — Victoria Island, Lagos');
  const [cgtDisposalProceeds, setCgtDisposalProceeds] = useState('85000000');
  const [cgtAcquisitionCost, setCgtAcquisitionCost] = useState('50000000');
  const [cgtImprovementCosts, setCgtImprovementCosts] = useState('8000000');
  const [cgtLegalFees, setCgtLegalFees] = useState('2500000');
  const [cgtAgentCommission, setCgtAgentCommission] = useState('1700000');
  const [cgtIsNSE, setCgtIsNSE] = useState(false);
  const [cgtIsFamilyGift, setCgtIsFamilyGift] = useState(false);
  const [cgtResult, setCgtResult] = useState<CGTResult | null>(null);

  const handleCalcStampDuty = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const value = parseFloat(sdInstrumentValue) || 0;
    setSdResult(calculateStampDuty(sdCategoryId, value));
  };

  const handleCalcCGT = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const input: CGTInput = {
      assetDescription: cgtAssetDesc,
      disposalProceeds: parseFloat(cgtDisposalProceeds) || 0,
      acquisitionCost: parseFloat(cgtAcquisitionCost) || 0,
      improvementCosts: parseFloat(cgtImprovementCosts) || 0,
      legalFees: parseFloat(cgtLegalFees) || 0,
      agentCommission: parseFloat(cgtAgentCommission) || 0,
      isNSEListed: cgtIsNSE,
      isFamilyGift: cgtIsFamilyGift,
    };
    setCgtResult(calculateCGT(input));
  };

  // Auto-calculate on mount
  React.useEffect(() => {
    handleCalcStampDuty();
    handleCalcCGT();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          Stamp Duty & Capital Gains Tax
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Calculate stamp duties on instruments and capital gains tax on asset disposals under Nigerian law.
        </p>
      </div>

      {/* Tab Toggle */}
      <div className="flex gap-2">
        {[
          { id: 'stamp-duty' as ActiveCalc, label: 'Stamp Duty', icon: Stamp },
          { id: 'cgt' as ActiveCalc, label: 'Capital Gains Tax', icon: TrendingDown },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveCalc(tab.id)}
            className={`flex-1 h-12 rounded-xl text-xs font-bold uppercase tracking-wider cursor-pointer transition-all flex items-center justify-center gap-2 ${
              activeCalc === tab.id
                ? 'bg-primary-container text-white shadow-sm'
                : 'bg-white text-on-surface-variant border border-outline-variant hover:bg-surface-container-low'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ──── STAMP DUTY CALCULATOR ──── */}
      {activeCalc === 'stamp-duty' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-5">
              <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Stamp Duty Calculator</h3>

              <form onSubmit={handleCalcStampDuty} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Instrument Type
                  </label>
                  <select
                    value={sdCategoryId}
                    onChange={e => setSdCategoryId(e.target.value)}
                    className="w-full h-11 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container cursor-pointer"
                  >
                    {STAMP_DUTY_CATEGORIES.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  {(() => {
                    const cat = STAMP_DUTY_CATEGORIES.find(c => c.id === sdCategoryId);
                    return cat ? (
                      <p className="text-[9px] text-on-surface-variant mt-1">{cat.description}</p>
                    ) : null;
                  })()}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Instrument Value (₦)
                  </label>
                  <input
                    type="number"
                    value={sdInstrumentValue}
                    onChange={e => setSdInstrumentValue(e.target.value)}
                    className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. 5000000"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-[#013220] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <Stamp className="w-4 h-4" />
                  Calculate Stamp Duty
                </button>
              </form>
            </div>

            {/* Rate Reference Card */}
            <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
              <h4 className="font-bold text-[10px] text-primary-container uppercase tracking-wider mb-3">Rate Reference</h4>
              <div className="space-y-2">
                {STAMP_DUTY_CATEGORIES.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between py-1.5 border-b border-outline-variant/20 last:border-0">
                    <span className="text-[10px] text-on-surface-variant">{cat.label}</span>
                    <span className="text-[10px] font-mono font-bold text-primary-container">
                      {cat.rateType === 'flat'
                        ? `₦${(cat.flatAmount || 0).toLocaleString()} flat`
                        : `${((cat.adValoremRate || 0) * 100).toFixed(3)}%`
                      }
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-7">
            {sdResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-4"
              >
                <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Computation Result</h3>

                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                    <span className="text-xs text-on-surface-variant">Instrument</span>
                    <span className="text-xs font-bold text-on-surface">{sdResult.category}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                    <span className="text-xs text-on-surface-variant">Value</span>
                    <span className="text-xs font-mono font-semibold text-on-surface">{formatNaira(sdResult.instrumentValue)}</span>
                  </div>
                  <div className="flex items-center justify-between py-2 border-b border-outline-variant/30">
                    <span className="text-xs text-on-surface-variant">Rate Applied</span>
                    <span className="text-xs font-bold text-primary-container">{sdResult.rateApplied}</span>
                  </div>

                  <div className="flex items-center justify-between py-4 bg-primary-container/5 rounded-lg px-4 -mx-1">
                    <span className="text-sm font-bold text-primary-container">Stamp Duty Payable</span>
                    <span className="text-xl font-black font-mono text-primary-container">{formatNaira(sdResult.dutyAmount)}</span>
                  </div>

                  {!sdResult.isAboveThreshold && (
                    <div className="flex items-start gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <p className="text-[10px] text-emerald-800 leading-relaxed">
                        This transaction is below the threshold and does not attract stamp duty.
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}

      {/* ──── CAPITAL GAINS TAX CALCULATOR ──── */}
      {activeCalc === 'cgt' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-6"
        >
          {/* Input Form */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-5">
              <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Capital Gains Tax Calculator</h3>

              <form onSubmit={handleCalcCGT} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Asset Description
                  </label>
                  <input
                    type="text"
                    value={cgtAssetDesc}
                    onChange={e => setCgtAssetDesc(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. Commercial property in Lagos"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Disposal Proceeds / Sale Price (₦)
                  </label>
                  <input
                    type="number"
                    value={cgtDisposalProceeds}
                    onChange={e => setCgtDisposalProceeds(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. 85000000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Original Acquisition Cost (₦)
                  </label>
                  <input
                    type="number"
                    value={cgtAcquisitionCost}
                    onChange={e => setCgtAcquisitionCost(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. 50000000"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                    Improvement Costs (₦)
                  </label>
                  <input
                    type="number"
                    value={cgtImprovementCosts}
                    onChange={e => setCgtImprovementCosts(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. 8000000"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                      Legal Fees (₦)
                    </label>
                    <input
                      type="number"
                      value={cgtLegalFees}
                      onChange={e => setCgtLegalFees(e.target.value)}
                      className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                      Agent Commission (₦)
                    </label>
                    <input
                      type="number"
                      value={cgtAgentCommission}
                      onChange={e => setCgtAgentCommission(e.target.value)}
                      className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container"
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Exemptions */}
                <div className="space-y-2 pt-2">
                  <p className="text-[10px] font-bold text-on-surface uppercase tracking-wider">Exemptions</p>
                  <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
                    <div>
                      <span className="text-[10px] font-bold text-on-surface">NSE Listed Shares</span>
                      <p className="text-[9px] text-on-surface-variant">Shares traded on Nigerian Stock Exchange</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCgtIsNSE(!cgtIsNSE)}
                      className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                        cgtIsNSE ? 'bg-primary-container justify-end' : 'bg-outline-variant justify-start'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-surface-container-low rounded-lg border border-outline-variant">
                    <div>
                      <span className="text-[10px] font-bold text-on-surface">Gift to Family Member</span>
                      <p className="text-[9px] text-on-surface-variant">Disposal is a gift between family</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCgtIsFamilyGift(!cgtIsFamilyGift)}
                      className={`w-10 h-6 rounded-full transition-colors cursor-pointer flex items-center ${
                        cgtIsFamilyGift ? 'bg-primary-container justify-end' : 'bg-outline-variant justify-start'
                      }`}
                    >
                      <div className="w-5 h-5 rounded-full bg-white shadow-sm mx-0.5" />
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full h-12 bg-[#013220] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <TrendingDown className="w-4 h-4" />
                  Calculate CGT
                </button>
              </form>
            </div>
          </div>

          {/* Results */}
          <div className="lg:col-span-7">
            {cgtResult && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Exemption Alert */}
                {cgtResult.isExempt && (
                  <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-emerald-800">CGT Exempt — No Tax Payable</p>
                      <p className="text-xs text-emerald-700 mt-1">{cgtResult.exemptionReason}</p>
                    </div>
                  </div>
                )}

                {/* Computation Table */}
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-4">
                  <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">CGT Computation</h3>

                  <div className="space-y-2">
                    {[
                      { label: 'Asset', value: cgtResult.assetDescription, isText: true },
                      { label: 'Disposal Proceeds', value: formatNaira(cgtResult.disposalProceeds) },
                      { label: 'Less: Acquisition Cost', value: `(${formatNaira(cgtResult.acquisitionCost)})`, color: 'text-red-500' },
                      { label: 'Less: Allowable Expenses', value: `(${formatNaira(cgtResult.allowableExpenses)})`, color: 'text-red-500' },
                      { label: 'Chargeable Gain', value: formatNaira(cgtResult.chargeableGain), color: 'text-primary-container font-bold' },
                    ].map(row => (
                      <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-outline-variant/30 last:border-0">
                        <span className="text-xs text-on-surface-variant">{row.label}</span>
                        <span className={`text-xs ${(row as any).isText ? 'font-semibold text-on-surface' : `font-mono font-semibold ${'color' in row ? row.color : 'text-on-surface'}`}`}>
                          {row.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between py-4 bg-primary-container/5 rounded-lg px-4 -mx-1 mt-2">
                    <div>
                      <span className="text-sm font-bold text-primary-container">CGT Payable</span>
                      <span className="text-[10px] text-on-surface-variant ml-2">@ {cgtResult.isExempt ? '0' : '10'}%</span>
                    </div>
                    <span className={`text-xl font-black font-mono ${
                      cgtResult.isExempt ? 'text-emerald-600' : 'text-primary-container'
                    }`}>
                      {formatNaira(cgtResult.cgtLiability)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between py-2 text-[10px]">
                    <span className="text-on-surface-variant font-bold">Net Proceeds After Tax</span>
                    <span className="font-mono font-bold text-emerald-600">{formatNaira(cgtResult.netProceeds)}</span>
                  </div>
                </div>

                {/* Legal Reference */}
                <div className="flex items-start gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-xl">
                  <Info className="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
                  <p className="text-[10px] text-on-surface-variant leading-relaxed">
                    <strong className="text-on-surface">Reference:</strong> Capital Gains Tax in Nigeria is levied at a flat rate of 10% on chargeable gains from disposal of capital assets. Exempt disposals include NSE-listed shares (Finance Act 2021), gifts between family members, and government-acquired properties. CGT returns must be filed within the year the gain is realized.
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </motion.section>
  );
});

export default StampDutyCGTTab;

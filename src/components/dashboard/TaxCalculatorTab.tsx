import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Calculator, ArrowUpRight, Info } from 'lucide-react';
import { TaxCalculationResult } from '../../types';
import { calculatePIT, PITDeductionConfig, DEDUCTION_AMOUNTS } from '../../utils/taxEngine';

export default function TaxCalculatorTab() {
  const [annualSalaryInput, setAnnualSalaryInput] = useState('6000000');
  const [pensionRate, setPensionRate] = useState(8);
  const [calcVpc, setCalcVpc] = useState(false);
  const [calcLifeAssurance, setCalcLifeAssurance] = useState(false);
  const [calcNHF, setCalcNHF] = useState(false);
  const [calcNHIS, setCalcNHIS] = useState(false);
  const [calcCharity, setCalcCharity] = useState(false);
  const [calcChildren, setCalcChildren] = useState(false);
  const [calcDependantRelative, setCalcDependantRelative] = useState(false);
  const [calcDisabled, setCalcDisabled] = useState(false);
  const [calcMortgageInterest, setCalcMortgageInterest] = useState(false);
  const [calcBondExempt, setCalcBondExempt] = useState(false);
  const [calcResult, setCalcResult] = useState<TaxCalculationResult | null>(null);

  const handleCalculateTax = (e: React.FormEvent) => {
    e.preventDefault();
    const grossAnnual = parseFloat(annualSalaryInput);
    if (isNaN(grossAnnual) || grossAnnual <= 0) return;

    const deductions: PITDeductionConfig = {
      pensionRate,
      vpc: calcVpc,
      lifeAssurance: calcLifeAssurance,
      nhf: calcNHF,
      nhis: calcNHIS,
      charity: calcCharity,
      children: calcChildren,
      dependantRelative: calcDependantRelative,
      disabled: calcDisabled,
      mortgageInterest: calcMortgageInterest,
      bondExempt: calcBondExempt,
    };

    setCalcResult(calculatePIT(grossAnnual, deductions));
  };

  // Auto-calculate on first render if no result yet
  React.useEffect(() => {
    if (!calcResult) {
      const mockEvent = { preventDefault: () => {} } as React.FormEvent;
      handleCalculateTax(mockEvent);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reliefToggles = [
    { label: `Voluntary Pension (₦${DEDUCTION_AMOUNTS.vpc.toLocaleString()} exempt)`, value: calcVpc, setter: setCalcVpc, amount: DEDUCTION_AMOUNTS.vpc, name: 'Voluntary Pension Relief (Exempt)' },
    { label: `Life Assurance (₦${DEDUCTION_AMOUNTS.lifeAssurance.toLocaleString()} exempt)`, value: calcLifeAssurance, setter: setCalcLifeAssurance, amount: DEDUCTION_AMOUNTS.lifeAssurance, name: 'Life Assurance Relief (Exempt)' },
    { label: `National Housing Fund (₦${DEDUCTION_AMOUNTS.nhf.toLocaleString()} exempt)`, value: calcNHF, setter: setCalcNHF, amount: DEDUCTION_AMOUNTS.nhf, name: 'National Housing Fund Relief (Exempt)' },
    { label: `NHIS Health Premiums (₦${DEDUCTION_AMOUNTS.nhis.toLocaleString()} exempt)`, value: calcNHIS, setter: setCalcNHIS, amount: DEDUCTION_AMOUNTS.nhis, name: 'NHIS Medical Relief (Exempt)' },
    { label: `Charitable Donation (₦${DEDUCTION_AMOUNTS.charity.toLocaleString()} exempt)`, value: calcCharity, setter: setCalcCharity, amount: DEDUCTION_AMOUNTS.charity, name: 'Charitable Donation Relief (Exempt)' },
    { label: `Children Allowance (₦${DEDUCTION_AMOUNTS.children.toLocaleString()} exempt)`, value: calcChildren, setter: setCalcChildren, amount: DEDUCTION_AMOUNTS.children, name: 'Children Allowance (Exempt)' },
    { label: `Dependant Relative Relief (₦${DEDUCTION_AMOUNTS.dependantRelative.toLocaleString()} exempt)`, value: calcDependantRelative, setter: setCalcDependantRelative, amount: DEDUCTION_AMOUNTS.dependantRelative, name: 'Dependant Relative Relief (Exempt)' },
    { label: `Disabled Person Relief (₦${DEDUCTION_AMOUNTS.disabled.toLocaleString()} exempt)`, value: calcDisabled, setter: setCalcDisabled, amount: DEDUCTION_AMOUNTS.disabled, name: 'Disabled Person Special Relief (Exempt)' },
    { label: `Mortgage Interest Relief (₦${DEDUCTION_AMOUNTS.mortgageInterest.toLocaleString()} exempt)`, value: calcMortgageInterest, setter: setCalcMortgageInterest, amount: DEDUCTION_AMOUNTS.mortgageInterest, name: 'Mortgage Interest Relief (Exempt)' },
    { label: `Government Bonds & T-Bills (₦${DEDUCTION_AMOUNTS.bondExempt.toLocaleString()} exempt)`, value: calcBondExempt, setter: setCalcBondExempt, amount: DEDUCTION_AMOUNTS.bondExempt, name: 'Bonds & Treasury Bills Exemption' },
  ];

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">
          Statutory Personal Income Tax Calculator
        </h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Compute Personal Income Tax (PIT) under the Nigerian Personal Income Tax Act (PITA) incorporating Consolidated Relief Allowance (CRA).
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Input Form Column */}
        <div className="lg:col-span-5 bg-white border border-outline-variant rounded-xl p-6 shadow-xs h-fit space-y-6">
          <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Salary Details</h3>
          
          <form onSubmit={handleCalculateTax} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                Gross Annual Income (₦)
              </label>
              <input
                type="number"
                value={annualSalaryInput}
                onChange={(e) => setAnnualSalaryInput(e.target.value)}
                className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                placeholder="e.g. 6000000 for 6 Million NGN"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                Statutory Pension Contribution Rate (%)
              </label>
              <select
                value={pensionRate}
                onChange={(e) => setPensionRate(parseInt(e.target.value))}
                className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
              >
                <option value={8}>8% (Standard Employee Contribution)</option>
                <option value={0}>0% (No Pension Deductions)</option>
                <option value={5}>5% (Custom Rate)</option>
                <option value={10}>10% (Enhanced Rate)</option>
              </select>
            </div>

            {/* Additional Reliefs Section */}
            <div className="space-y-2 border-t border-outline-variant/30 pt-4 pb-2">
              <label className="text-[10px] font-bold text-[#013220] uppercase tracking-wider block">
                FIRS Approved Reliefs &amp; Suggestions
              </label>
              <p className="text-[9px] text-on-surface-variant leading-normal">
                Select additional approved statutory deductions to lower your taxable net income:
              </p>
              
              <div className="space-y-2 pt-1 text-left">
                {reliefToggles.map((toggle) => (
                  <label key={toggle.name} className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={toggle.value}
                      onChange={(e) => toggle.setter(e.target.checked)}
                      className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                    />
                    <span>{toggle.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full h-12 bg-primary-container hover:bg-primary-container/95 text-white font-bold rounded-lg active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
            >
              <span>Calculate Statutory Taxes</span>
              <ArrowUpRight className="w-4 h-4 text-accent-green" />
            </button>
          </form>

          {/* Statutory parameters info */}
          <div className="p-3 bg-surface-container rounded-lg space-y-2 text-[10px] text-on-surface-variant leading-relaxed">
            <p className="font-bold text-primary-container flex items-center space-x-1">
              <Info className="w-3.5 h-3.5" />
              <span>Statutory Nigerian Tax Reliefs:</span>
            </p>
            <p>• Consolidated Relief Allowance (CRA): ₦200,000 or 1% of Gross + 20% of Gross.</p>
            <p>• Employee Pension: 8% of statutory base deducted tax-exempt.</p>
          </div>
        </div>

        {/* Tax Output Columns */}
        <div className="lg:col-span-7 space-y-6">
          {calcResult ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-6"
            >
              <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Tax Calculation Breakdown</h3>
              
              {/* Primary Net Monthly Display */}
              <div className="grid grid-cols-2 gap-4 border-b border-outline-variant pb-6">
                <div className="p-4 bg-[#013220]/5 rounded-xl border border-primary-container/10 text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Estimated Monthly Net Pay</p>
                  <p className="text-lg font-black text-primary-container font-mono mt-1">
                    ₦{calcResult.monthlyNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/30 text-left">
                  <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Effective Tax Rate</p>
                  <p className="text-lg font-black text-[#013220] font-mono mt-1">
                    {calcResult.effectiveTaxRate.toFixed(2)}%
                  </p>
                </div>
              </div>

              {/* Calculation Steps table */}
              <div className="space-y-3 text-left">
                <h4 className="font-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Statutory Deductions</h4>
                <div className="divide-y divide-outline-variant/20 text-xs">
                  <div className="flex justify-between py-2">
                    <span className="text-on-surface-variant">Gross Monthly Income</span>
                    <span className="font-mono font-bold text-on-surface">₦{calcResult.grossMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                   <div className="flex justify-between py-2 text-amber-700">
                    <span className="font-medium">Consolidated Relief Allowance (Tax-Exempt)</span>
                    <span className="font-mono font-bold">-₦{(calcResult.craRelief / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-2 text-amber-700">
                    <span className="font-medium">Pension Contribution Deduction (Tax-Exempt)</span>
                    <span className="font-mono font-bold">-₦{(calcResult.pensionDeduction / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  {reliefToggles.filter(t => t.value).map((toggle) => (
                    <div key={toggle.name} className="flex justify-between py-2 text-emerald-700 font-medium">
                      <span>{toggle.name}</span>
                      <span className="font-mono font-bold">-₦{(toggle.amount / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2 font-bold text-primary-container">
                    <span>Chargeable Monthly Taxable Income</span>
                    <span className="font-mono">₦{(calcResult.taxableIncome / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between py-3 font-extrabold text-error border-t border-t-outline-variant/40">
                    <span>Monthly Tax Liability</span>
                    <span className="font-mono">₦{calcResult.monthlyTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>
              </div>

              {/* Progressive Bands Breakdown */}
              <div className="space-y-3 text-left">
                <h4 className="font-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Progressive Annual Tax Bands applied</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-outline-variant/30 text-on-surface-variant/70 font-semibold">
                        <th className="py-2">Income Band</th>
                        <th className="py-2 text-right">Tax Rate</th>
                        <th className="py-2 text-right">Taxable in Band</th>
                        <th className="py-2 text-right">Annual Tax in Band</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10 text-on-surface-variant">
                      {calcResult.bandBreakdown.map((b, i) => (
                        <tr key={i} className="hover:bg-background/40 transition-colors">
                          <td className="py-2 font-medium text-on-surface">{b.band}</td>
                          <td className="py-2 text-right font-bold font-mono">{b.rate}%</td>
                          <td className="py-2 text-right font-mono text-on-surface">₦{b.taxableInBand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 text-right font-bold font-mono text-[#013220]">₦{b.taxInBand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </motion.div>
          ) : (
            <div className="bg-white border border-outline-variant rounded-xl p-8 shadow-xs flex flex-col items-center text-center justify-center h-64 text-on-surface-variant">
              <Calculator className="w-8 h-8 mb-2 text-primary-container" />
              <p className="font-bold text-sm">Awaiting Income Parameters</p>
              <p className="text-xs max-w-xs mt-1">Enter your gross annual income on the left and tap calculate to analyze statutory reliefs and progressives.</p>
            </div>
          )}
        </div>

      </div>
    </motion.section>
  );
}

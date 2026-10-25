import { useState, memo } from 'react';
import { motion } from 'motion/react';
import { TrendingUp, ArrowUpRight, Sparkles } from 'lucide-react';
import { DEDUCTION_AMOUNTS, applyProgressiveBands, calculateRentRelief, RENT_RELIEF_CAP } from '../../utils/taxEngine';
import { useAppContext } from '../../AppShell';
import { useStatutoryOverrides, activeApprovedReliefs, approvedReliefTotal } from '../../utils/statutoryOverrides';

const TaxPlannerTab = memo(function TaxPlannerTab() {
  const { session } = useAppContext();
  const overrides = useStatutoryOverrides(session?.contactMethod);
  const approvedReliefs = activeApprovedReliefs(overrides);
  const [plannerIncome, setPlannerIncome] = useState<string>('4500000');
  const [plannerExpenses, setPlannerExpenses] = useState<string>('1200000');
  const [plannerOtherDeductions, setPlannerOtherDeductions] = useState<string>('300000');
  const [scenarioBusinessPurchase, setScenarioBusinessPurchase] = useState(false);
  const [scenarioQ3Bonus, setScenarioQ3Bonus] = useState(true);
  const [scenarioVpc, setScenarioVpc] = useState(false);
  const [scenarioLifeAssurance, setScenarioLifeAssurance] = useState(false);
  const [scenarioNHF, setScenarioNHF] = useState(false);
  const [scenarioNHIS, setScenarioNHIS] = useState(false);
  const [scenarioRentRelief, setScenarioRentRelief] = useState(false);
  const [scenarioMortgageInterest, setScenarioMortgageInterest] = useState(false);
  const [scenarioBondExempt, setScenarioBondExempt] = useState(false);

  // Planner assumes rent of ~20% of income when the rent-relief scenario is on.
  const plannerRentRelief = calculateRentRelief((Number(plannerIncome) || 0) * 0.2);

  // Reliefs recognised under the Nigeria Tax Act 2025 (from 1 Jan 2026).
  // Pre-2026 PITA allowances (children, dependant relative, disability,
  // charity) were removed as they no longer reduce PIT.
  const scenarios = [
    { label: 'Major Business Purchase', description: 'Est. â‚¦500,000 allowable business expense (Reduces taxable income)', value: scenarioBusinessPurchase, setter: setScenarioBusinessPurchase },
    { label: 'Anticipated Q3 Bonus', description: 'Est. â‚¦1,000,000 income (Adds to expected taxable base)', value: scenarioQ3Bonus, setter: setScenarioQ3Bonus },
    { label: 'Voluntary Pension Contribution', description: `Est. â‚¦${DEDUCTION_AMOUNTS.vpc.toLocaleString()} contribution to your RSA (Deductible pension contribution)`, value: scenarioVpc, setter: setScenarioVpc },
    { label: 'Life Assurance / Annuity Premium', description: `Est. â‚¦${DEDUCTION_AMOUNTS.lifeAssurance.toLocaleString()} premium for you or your spouse (NTA 2025 deduction)`, value: scenarioLifeAssurance, setter: setScenarioLifeAssurance },
    { label: 'National Housing Fund (NHF)', description: `Est. â‚¦${DEDUCTION_AMOUNTS.nhf.toLocaleString()} annual deduction (Statutory contribution relief)`, value: scenarioNHF, setter: setScenarioNHF },
    { label: 'National Health Insurance (NHIS)', description: `Est. â‚¦${DEDUCTION_AMOUNTS.nhis.toLocaleString()} health insurance premium deduction`, value: scenarioNHIS, setter: setScenarioNHIS },
    { label: 'Rent Relief', description: `Est. â‚¦${plannerRentRelief.toLocaleString()} (20% of rent â‰ˆ 20% of income, capped at â‚¦${RENT_RELIEF_CAP.toLocaleString()})`, value: scenarioRentRelief, setter: setScenarioRentRelief },
    { label: 'Mortgage Interest Relief', description: `Est. â‚¦${DEDUCTION_AMOUNTS.mortgageInterest.toLocaleString()} deduction (Owner-occupied residential property loan interest)`, value: scenarioMortgageInterest, setter: setScenarioMortgageInterest },
    { label: 'Government Bonds & T-Bills Exemption', description: `Est. â‚¦${DEDUCTION_AMOUNTS.bondExempt.toLocaleString()} interest income excluded (Exempt investment income)`, value: scenarioBondExempt, setter: setScenarioBondExempt },
  ];

  // Compute projected liability
  const inc = Number(plannerIncome) || 0;
  const exp = Number(plannerExpenses) || 0;
  const oth = Number(plannerOtherDeductions) || 0;
  const bonusVal = scenarioQ3Bonus ? 1000000 : 0;
  let baseNet = Math.max(0, inc + bonusVal - exp - oth);

  if (scenarioBusinessPurchase) baseNet = Math.max(0, baseNet - 500000);
  if (scenarioVpc) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.vpc);
  if (scenarioLifeAssurance) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.lifeAssurance);
  if (scenarioNHF) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.nhf);
  if (scenarioNHIS) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.nhis);
  if (scenarioRentRelief) baseNet = Math.max(0, baseNet - plannerRentRelief);
  if (scenarioMortgageInterest) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.mortgageInterest);
  if (scenarioBondExempt) baseNet = Math.max(0, baseNet - DEDUCTION_AMOUNTS.bondExempt);
  // Admin-approved statutory reliefs for this profile (always applied)
  baseNet = Math.max(0, baseNet - approvedReliefTotal(overrides));

  // NTA 2025 progressive bands from the shared engine
  const computedTax = applyProgressiveBands(baseNet).annualTax;

  const activeList: string[] = [];
  if (scenarioBusinessPurchase) activeList.push("Business Purchase");
  if (scenarioVpc) activeList.push("Pension Contribution");
  if (scenarioLifeAssurance) activeList.push("Life Assurance");
  if (scenarioNHF) activeList.push("NHF");
  if (scenarioNHIS) activeList.push("NHIS");
  if (scenarioRentRelief) activeList.push("Rent Relief");
  if (scenarioMortgageInterest) activeList.push("Mortgage Interest Relief");
  if (scenarioBondExempt) activeList.push("Government Bonds Exemption");
  approvedReliefs.forEach((r) => activeList.push(`${r.label} (admin-approved)`));

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      <div>
        <h2 className="text-2xl font-black text-primary-container tracking-tight">Tax Planner</h2>
        <p className="text-sm text-on-surface-variant mt-1">
          Project your future tax liabilities and explore what-if scenarios in real-time.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Forms and Scenarios */}
        <div className="lg:col-span-8 space-y-6">
          
          {/* Expected Financials Form */}
          <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs relative overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#013220]"></div>
            <h3 className="font-bold text-sm text-primary uppercase tracking-wider mb-4">Q3 Expected Financials</h3>
            
            <div className="space-y-4">
              {[
                { label: 'Expected Total Income (NGN)', value: plannerIncome, setter: setPlannerIncome },
                { label: 'Deductible Expenses (NGN)', value: plannerExpenses, setter: setPlannerExpenses },
                { label: 'Other Allowable Deductions (NGN)', value: plannerOtherDeductions, setter: setPlannerOtherDeductions },
              ].map((field) => (
                <div key={field.label} className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">{field.label}</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">â‚¦</span>
                    <input
                      type="number"
                      value={field.value}
                      onChange={(e) => field.setter(e.target.value)}
                      className="w-full h-11 pl-8 pr-4 bg-background border border-outline rounded-lg text-sm font-semibold font-mono text-right text-on-surface focus:outline-none focus:border-primary-container"
                      placeholder="0"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* What-If Scenarios */}
          <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-4">
            <div>
              <h3 className="font-bold text-sm text-primary uppercase tracking-wider">What-If Scenarios</h3>
              <p className="text-[11px] text-on-surface-variant mt-1">
                Toggle dynamic events to see their immediate impact on your estimated tax liability.
              </p>
            </div>

            <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
              {scenarios.map((scenario) => (
                <div key={scenario.label} className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                  <div className="text-left">
                    <p className="text-xs font-bold text-on-surface">{scenario.label}</p>
                    <p className="text-[10px] text-on-surface-variant mt-0.5">{scenario.description}</p>
                  </div>
                  
                  <div 
                    onClick={() => scenario.setter(!scenario.value)}
                    className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                    style={{ backgroundColor: scenario.value ? '#013220' : '#e2e2e2' }}
                  >
                    <motion.div 
                      layout
                      className="w-5 h-5 bg-white rounded-full shadow-md"
                      animate={{ x: scenario.value ? 20 : 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Calculations Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#013220] text-white rounded-xl p-6 border border-[#013220] flex flex-col justify-between min-h-[250px] relative overflow-hidden text-left shadow-xs">
            <div className="absolute right-0 top-0 opacity-10">
              <TrendingUp className="w-32 h-32 stroke-[1.5]" />
            </div>
            
            <div className="relative z-10">
              <span className="text-[9px] font-bold text-[#4ADE80] uppercase tracking-widest block">Estimated Liability</span>
              <p className="text-[11px] text-neutral-300 mt-1">Projected for Q3 2026</p>
              
              <p className="text-3xl font-black font-mono text-white mt-4">
                â‚¦{computedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>

            <div className="mt-8 pt-4 border-t border-white/20 relative z-10 flex justify-between items-end">
              <div>
                <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-wider block">Current Year Total</span>
                <span className="font-mono font-bold text-sm text-white mt-1 block">â‚¦1,200,000.00</span>
              </div>
              <div className="flex items-center text-accent-green bg-accent-green/10 px-2 py-1 rounded-lg border border-accent-green/20">
                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                <span className="text-[10px] font-bold">+12%</span>
              </div>
            </div>
          </div>

          {/* Dynamic Tip card */}
          <div className="bg-surface-container border border-outline-variant rounded-xl p-5 flex gap-3 items-start text-left">
            <Sparkles className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {activeList.length > 0 ? (
                <span>
                  <strong>Active Relief Applied:</strong> You have activated <strong>{activeList.join(", ")}</strong>. Your projected Q3 liability has been dynamically recalculated to reflect these FIRS exemptions.
                </span>
              ) : (
                <span>
                  Pro Tip: Try toggling <strong>"Voluntary Pension Contribution"</strong> or <strong>"Life Assurance Premium"</strong> to see how approved NRS reliefs can reduce your Q3 PIT liabilities!
                </span>
              )}
            </p>
          </div>
        </div>
      </div>
    </motion.section>
  );
});

export default TaxPlannerTab;

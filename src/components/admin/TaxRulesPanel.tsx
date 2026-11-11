/**
 * TaxRulesPanel.tsx — Admin management of statutory figures.
 *
 * Editable (live, applied to every taxpayer's calculations):
 *  - NRS tax-year configuration (VAT rate, thresholds, due days, proof threshold, adviser sign-off)
 *  - WHT rate schedule
 * Shown read-only (still defined in code): PIT bands and CIT tiers.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Scale, Save, Plus, RotateCcw, Lock, BadgeCheck, AlertTriangle } from 'lucide-react';
import { useToast } from '../Toast';
import { usePermissions } from '../../admin/usePermissions';
import { useTaxRulesState, saveTaxRules, describeWriteError } from '../../admin/platformStore';
import { defaultTaxYears, defaultWhtRates, diffTaxYear, type TaxRulesDoc } from '../../admin/taxRules';
import { TAX_YEAR_CONFIGS, type TaxYearConfig } from '../../nrs/taxYearConfig';
import { WHT_RATE_SCHEDULE, type WHTRateEntry } from '../../utils/whtEngine';
import { TAX_BANDS } from '../../utils/taxEngine';
import { CIT_TIERS } from '../../utils/citEngine';
import { koboToNaira, nairaToKobo } from '../../nrs/money';
import { recordAuditLog } from '../../utils/auditLogger';

const FIGURE_KEYS: (keyof TaxYearConfig)[] = [
  'vatRateBps', 'vatRegistrationThresholdKobo', 'smallCompanyTurnoverThresholdKobo',
  'smallCompanyFixedAssetsThresholdKobo', 'vatReturnDueDay', 'whtRemittanceDueDay', 'proofRequiredAboveKobo',
];

const cloneYears = (ys: TaxYearConfig[]) => ys.map((c) => ({ ...c, notes: [...c.notes] }));
const cloneWht = (ws: WHTRateEntry[]) => ws.map((w) => ({ ...w }));

export default function TaxRulesPanel() {
  const { showToast } = useToast();
  const { can, actorEmail, actorName } = usePermissions();
  const live = useTaxRulesState();
  const canEdit = can('tax_rules.edit');
  const canVerify = can('tax_rules.verify');

  // TAX_YEAR_CONFIGS / WHT_RATE_SCHEDULE already have the published overrides applied.
  const [years, setYears] = useState<TaxYearConfig[]>(() => cloneYears(TAX_YEAR_CONFIGS));
  const [wht, setWht] = useState<WHTRateEntry[]>(() => cloneWht(WHT_RATE_SCHEDULE));
  const [selectedYear, setSelectedYear] = useState<number>(() => Math.max(...TAX_YEAR_CONFIGS.map((c) => c.year)));
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(years) !== JSON.stringify(TAX_YEAR_CONFIGS) || JSON.stringify(wht) !== JSON.stringify(WHT_RATE_SCHEDULE);

  useEffect(() => {
    if (!dirty) {
      setYears(cloneYears(TAX_YEAR_CONFIGS));
      setWht(cloneWht(WHT_RATE_SCHEDULE));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.value]);

  const cfg = years.find((c) => c.year === selectedYear) ?? years[years.length - 1];
  const defaultsForYear = useMemo(() => defaultTaxYears().find((c) => c.year === cfg.year), [cfg.year]);

  const updateCfg = (patch: Partial<TaxYearConfig>) => {
    setYears((ys) => ys.map((c) => {
      if (c.year !== cfg.year) return c;
      const next = { ...c, ...patch };
      // Changing any statutory figure invalidates a previous adviser sign-off.
      const figuresChanged = FIGURE_KEYS.some((k) => k in patch && patch[k] !== c[k]);
      if (figuresChanged && c.verified) {
        next.verified = false;
        next.verifiedBy = undefined;
        next.verifiedOn = undefined;
      }
      return next;
    }));
  };

  const addYear = () => {
    const nextYear = Math.max(...years.map((c) => c.year)) + 1;
    const base = years.find((c) => c.year === nextYear - 1)!;
    setYears((ys) => [...ys, { ...base, year: nextYear, verified: false, verifiedBy: undefined, verifiedOn: undefined, notes: [`Copied from ${base.year} — review all figures.`] }]);
    setSelectedYear(nextYear);
  };

  const resetYear = () => {
    if (defaultsForYear) setYears((ys) => ys.map((c) => (c.year === cfg.year ? { ...defaultsForYear, notes: [...defaultsForYear.notes] } : c)));
    else setYears((ys) => ys.filter((c) => c.year !== cfg.year));
  };

  const buildDoc = (): TaxRulesDoc => {
    const doc: TaxRulesDoc = { taxYears: {}, whtRates: {} };
    for (const y of years) {
      const diff = diffTaxYear(y);
      const isNewYear = !defaultTaxYears().some((d) => d.year === y.year);
      if (isNewYear) {
        // A year not in the shipped defaults must be stored in full.
        const { year: _y, ...rest } = y;
        doc.taxYears[String(y.year)] = rest;
      } else if (Object.keys(diff).length) {
        doc.taxYears[String(y.year)] = diff;
      }
    }
    const defaults = defaultWhtRates();
    for (const w of wht) {
      const d = defaults.find((x) => x.id === w.id);
      if (d && (d.companyRate !== w.companyRate || d.individualRate !== w.individualRate)) {
        doc.whtRates[w.id] = { companyRate: w.companyRate, individualRate: w.individualRate };
      }
    }
    return doc;
  };

  const handleSave = async () => {
    // Users without the verify permission cannot change sign-off state.
    if (!canVerify) {
      const tampered = years.some((y) => {
        const before = TAX_YEAR_CONFIGS.find((c) => c.year === y.year);
        return y.verified && (!before || !before.verified || before.verifiedBy !== y.verifiedBy);
      });
      if (tampered) return showToast('error', 'Sign-off not allowed', 'Only roles with “Sign off tax rules” can mark a year verified.');
    }
    setSaving(true);
    try {
      const doc = buildDoc();
      await saveTaxRules(doc, actorEmail);
      recordAuditLog({
        actorName, actorEmail, action: 'PUBLISH_TAX_RULES', module: 'Tax Rules', severity: 'CRITICAL',
        afterState: { taxYears: doc.taxYears, whtRates: doc.whtRates },
      });
      showToast('success', 'Tax rules published', 'All taxpayer calculations now use the updated figures.');
    } catch (err) {
      showToast('error', 'Not published', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const money = (field: keyof TaxYearConfig, label: string, hint?: string) => (
    <label className="block text-xs">
      <span className="font-bold block mb-1">{label}</span>
      <div className="flex items-center">
        <span className="h-10 px-3 flex items-center bg-surface-container border border-r-0 border-outline-variant rounded-l-lg text-on-surface-variant">₦</span>
        <input type="number" min={0} disabled={!canEdit}
          value={cfg[field] === undefined ? '' : koboToNaira(cfg[field] as number)}
          onChange={(e) => updateCfg({ [field]: e.target.value === '' ? undefined : nairaToKobo(Number(e.target.value)) } as Partial<TaxYearConfig>)}
          className="w-full h-10 px-3 rounded-r-lg border border-outline-variant font-mono" />
      </div>
      {hint && <span className="text-[10px] text-on-surface-variant">{hint}</span>}
    </label>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      <div className="bg-white p-6 border border-outline-variant rounded-2xl shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight flex items-center gap-2"><Scale className="w-5 h-5" /> Tax Rules</h3>
          <p className="text-xs text-on-surface-variant mt-1">Statutory figures used by NRS Returns, compliance checks and the WHT tracker for every taxpayer.</p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {live.exists ? `Last published ${live.value.updatedAt?.slice(0, 16).replace('T', ' ')} by ${live.value.updatedBy}` : 'Using figures shipped with the app (no overrides published).'}
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            {dirty && <button onClick={() => { setYears(cloneYears(TAX_YEAR_CONFIGS)); setWht(cloneWht(WHT_RATE_SCHEDULE)); }} className="px-3.5 py-2 border border-outline-variant rounded-xl text-xs font-bold cursor-pointer">Discard</button>}
            <button onClick={handleSave} disabled={!dirty || saving} className="px-4 py-2 bg-primary-container text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Save className="w-3.5 h-3.5 text-accent-green" /> {saving ? 'Publishing…' : 'Publish tax rules'}
            </button>
          </div>
        )}
      </div>
      {!canEdit && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: editing requires “Edit tax rules”.</p>}

      {/* Tax year config */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 bg-surface-container-low p-1 rounded-xl">
            {years.map((c) => (
              <button key={c.year} onClick={() => setSelectedYear(c.year)} className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer flex items-center gap-1 ${c.year === cfg.year ? 'bg-white shadow-xs text-primary-container' : 'text-on-surface-variant'}`}>
                {c.year} {c.verified ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
              </button>
            ))}
            {canEdit && <button onClick={addYear} className="px-2 py-1.5 rounded-lg text-xs font-bold text-primary-container cursor-pointer flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Year</button>}
          </div>
          {canEdit && <button onClick={resetYear} className="text-[11px] font-bold text-primary-container hover:underline cursor-pointer flex items-center gap-1"><RotateCcw className="w-3 h-3" /> {defaultsForYear ? `Reset ${cfg.year} to shipped figures` : `Remove ${cfg.year}`}</button>}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <label className="block text-xs">
            <span className="font-bold block mb-1">VAT rate (%)</span>
            <input type="number" step="0.01" min={0} max={100} disabled={!canEdit} value={cfg.vatRateBps / 100}
              onChange={(e) => updateCfg({ vatRateBps: Math.round(Number(e.target.value) * 100) })}
              className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" />
          </label>
          {money('vatRegistrationThresholdKobo', 'VAT registration threshold', 'Turnover above which VAT registration is required')}
          {money('smallCompanyTurnoverThresholdKobo', 'Small-company turnover limit', '0% CIT at or below this turnover')}
          {money('smallCompanyFixedAssetsThresholdKobo', 'Small-company fixed-asset limit', 'Leave blank if not applicable')}
          <label className="block text-xs">
            <span className="font-bold block mb-1">VAT return due day</span>
            <input type="number" min={1} max={28} disabled={!canEdit} value={cfg.vatReturnDueDay} onChange={(e) => updateCfg({ vatReturnDueDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })} className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" />
            <span className="text-[10px] text-on-surface-variant">Day of the following month</span>
          </label>
          <label className="block text-xs">
            <span className="font-bold block mb-1">WHT remittance due day</span>
            <input type="number" min={1} max={28} disabled={!canEdit} value={cfg.whtRemittanceDueDay} onChange={(e) => updateCfg({ whtRemittanceDueDay: Math.min(28, Math.max(1, parseInt(e.target.value) || 1)) })} className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" />
          </label>
          {money('proofRequiredAboveKobo', 'Receipt required above', 'Compliance check flags missing proof above this')}
          <label className="block text-xs xl:col-span-1 md:col-span-2">
            <span className="font-bold block mb-1">Legal basis</span>
            <input disabled={!canEdit} value={cfg.legalBasis} onChange={(e) => updateCfg({ legalBasis: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-outline-variant" />
          </label>
        </div>

        <label className="block text-xs">
          <span className="font-bold block mb-1">Notes (one per line)</span>
          <textarea rows={3} disabled={!canEdit} value={cfg.notes.join('\n')} onChange={(e) => updateCfg({ notes: e.target.value.split('\n').filter((l) => l.trim()) })} className="w-full px-3 py-2 rounded-lg border border-outline-variant" />
        </label>

        {/* Adviser sign-off */}
        <div className={`p-4 rounded-xl border ${cfg.verified ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
          <div className="flex flex-wrap items-center gap-4 text-xs">
            <label className={`flex items-center gap-2 font-bold ${canVerify && canEdit ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
              <input type="checkbox" disabled={!canVerify || !canEdit} checked={cfg.verified}
                onChange={(e) => updateCfg({ verified: e.target.checked, verifiedOn: e.target.checked ? new Date().toISOString().slice(0, 10) : undefined, verifiedBy: e.target.checked ? (cfg.verifiedBy || actorName) : undefined })}
                className="w-4 h-4 accent-[#013220]" />
              {cfg.verified ? <span className="text-emerald-800">Verified by tax adviser</span> : <span className="text-amber-800">Awaiting adviser sign-off</span>}
            </label>
            {cfg.verified && (
              <>
                <input disabled={!canVerify || !canEdit} value={cfg.verifiedBy ?? ''} onChange={(e) => setYears((ys) => ys.map((c) => (c.year === cfg.year ? { ...c, verifiedBy: e.target.value } : c)))} placeholder="Adviser name / firm" className="h-9 px-3 rounded-lg border border-outline-variant bg-white" />
                <span className="text-on-surface-variant">on {cfg.verifiedOn}</span>
              </>
            )}
          </div>
          <p className="text-[10px] text-on-surface-variant mt-2">
            {canVerify ? 'Editing any figure clears the sign-off. Taxpayers see a warning banner while a year is unverified.' : 'Only roles with “Sign off tax rules” can verify a year.'}
          </p>
        </div>
      </div>

      {/* WHT */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs">
        <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container mb-3">Withholding tax rates</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-on-surface-variant bg-surface-container-low">
              <tr><th className="text-left p-2.5">Payment type</th><th className="p-2.5 w-36">Company payee %</th><th className="p-2.5 w-36">Individual payee %</th><th className="p-2.5 w-24"></th></tr>
            </thead>
            <tbody>
              {wht.map((w) => {
                const d = defaultWhtRates().find((x) => x.id === w.id)!;
                const changed = d.companyRate !== w.companyRate || d.individualRate !== w.individualRate;
                const rateInput = (key: 'companyRate' | 'individualRate') => (
                  <input type="number" step="0.5" min={0} max={100} disabled={!canEdit} value={+(w[key] * 100).toFixed(4)}
                    onChange={(e) => setWht((ws) => ws.map((x) => (x.id === w.id ? { ...x, [key]: Math.min(1, Math.max(0, Number(e.target.value) / 100)) } : x)))}
                    className="w-full h-9 px-2 rounded-lg border border-outline-variant font-mono text-center" />
                );
                return (
                  <tr key={w.id} className="border-t border-outline-variant/40">
                    <td className="p-2.5"><p className="font-bold">{w.paymentType}</p><p className="text-[10px] text-on-surface-variant">{w.description}</p></td>
                    <td className="p-2.5">{rateInput('companyRate')}</td>
                    <td className="p-2.5">{rateInput('individualRate')}</td>
                    <td className="p-2.5 text-center">
                      {changed && canEdit && <button onClick={() => setWht((ws) => ws.map((x) => (x.id === w.id ? { ...d } : x)))} className="text-[10px] font-bold text-primary-container hover:underline cursor-pointer">Reset</button>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Code-managed reference */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container mb-1">PIT bands (NTA 2025)</h4>
          <p className="text-[10px] text-on-surface-variant mb-3">Read-only — defined in code (src/utils/taxEngine.ts).</p>
          <table className="w-full text-xs">
            <tbody>{TAX_BANDS.map((b) => <tr key={b.band} className="border-t border-outline-variant/40"><td className="p-2">{b.band}</td><td className="p-2 text-right font-mono font-bold">{(b.rate * 100).toFixed(0)}%</td></tr>)}</tbody>
          </table>
        </div>
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs">
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container mb-1">CIT calculator tiers</h4>
          <p className="text-[10px] text-on-surface-variant mb-3">Read-only — defined in code (src/utils/citEngine.ts). Note: still uses pre-2026 tiers; NRS Returns uses the small-company limit above.</p>
          <table className="w-full text-xs">
            <tbody>{CIT_TIERS.map((t) => <tr key={t.label} className="border-t border-outline-variant/40"><td className="p-2">{t.label}<span className="block text-[10px] text-on-surface-variant">{t.description}</span></td><td className="p-2 text-right font-mono font-bold">{t.rateLabel}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}


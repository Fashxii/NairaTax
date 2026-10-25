import { useFormContext, useWatch } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck, Building, Scale } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { CUSTOM_YEAR_ENDS, SECTORS, YEAR_ENDS, classifyCIT } from '../../../registration/corporate/catalog';
import { Field, Select } from '../ui';
import MoneyInput from '../MoneyInput';

export function CitBadge({ entityType, turnover, assets, sector }: { entityType: CorporateValues['entity']['entityType']; turnover: number; assets: number; sector: string }) {
  const c = classifyCIT(entityType, turnover, assets, sector);
  const style = c.status === 'SMALL_COMPANY_EXEMPT'
    ? { box: 'bg-emerald-50 border-emerald-300 text-emerald-950', chip: 'bg-emerald-600 text-white', icon: BadgeCheck,
        title: 'Classified as Small Company', sub: '0% CIT rate under NTA small-business relief' }
    : c.status === 'PIT_SOLE_ENTERPRISE'
    ? { box: 'bg-amber-50 border-amber-300 text-amber-950', chip: 'bg-amber-600 text-white', icon: Scale,
        title: 'Not subject to CIT', sub: 'Profits are assessed under State Personal Income Tax' }
    : { box: 'bg-sky-50 border-sky-300 text-sky-950', chip: 'bg-sky-700 text-white', icon: Building,
        title: 'Standard Corporate Assessment Applied', sub: `${Math.round((c.rate ?? 0) * 100)}% CIT on assessable profits` };
  const Icon = style.icon;
  return (
    <AnimatePresence mode="wait">
      <motion.div key={c.status} id="corp-cit-badge" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
        className={`flex items-start gap-3 p-4 rounded-xl border ${style.box}`}>
        <span className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${style.chip}`}><Icon className="w-5 h-5" /></span>
        <div>
          <p className="text-sm font-black">{style.title}</p>
          <p className="text-xs font-semibold opacity-80">{style.sub}</p>
          <p className="text-[11px] opacity-70 mt-1">{c.reason}</p>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function CorpStep3Classification() {
  const { register, control, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.tax;
  const [turnover, assets, sector, yearEnd, entityType] = useWatch({
    control, name: ['tax.annualTurnover', 'tax.fixedAssets', 'tax.sector', 'tax.yearEnd', 'entity.entityType'],
  });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Annual Gross Turnover (NGN)" htmlFor="corp-turnover" error={e?.annualTurnover?.message} hint="Estimated or actual, for the current year.">
          <MoneyInput name="tax.annualTurnover" id="corp-turnover" invalid={!!e?.annualTurnover} />
        </Field>
        <Field label="Total Fixed Assets (NGN)" htmlFor="corp-assets" error={e?.fixedAssets?.message} hint="Net book value of property, plant & equipment.">
          <MoneyInput name="tax.fixedAssets" id="corp-assets" invalid={!!e?.fixedAssets} />
        </Field>
      </div>

      <Field label="Primary Industry / Sector" htmlFor="corp-sector" error={e?.sector?.message}>
        <Select id="corp-sector" invalid={!!e?.sector} {...register('tax.sector')}>
          <option value="">Select sector…</option>
          {SECTORS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </Field>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Financial Year-End" htmlFor="corp-year-end" error={e?.yearEnd?.message}>
          <Select id="corp-year-end" invalid={!!e?.yearEnd} {...register('tax.yearEnd')}>
            <option value="">Select year-end…</option>
            {YEAR_ENDS.map((y) => <option key={y} value={y}>{y}</option>)}
          </Select>
        </Field>
        {yearEnd === 'Custom' && (
          <Field label="Custom Year-End" htmlFor="corp-custom-ye" error={e?.customYearEnd?.message}>
            <Select id="corp-custom-ye" invalid={!!e?.customYearEnd} {...register('tax.customYearEnd')}>
              <option value="">Select month-end…</option>
              {CUSTOM_YEAR_ENDS.map((y) => <option key={y} value={y}>{y}</option>)}
            </Select>
          </Field>
        )}
      </div>

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-2">Live CIT Classification</p>
        {turnover > 0 || sector ? (
          <CitBadge entityType={entityType} turnover={turnover || 0} assets={assets || 0} sector={sector} />
        ) : (
          <p className="text-xs text-on-surface-variant border border-dashed border-outline-variant rounded-xl p-4">Enter turnover and sector to see your classification.</p>
        )}
      </div>
    </div>
  );
}

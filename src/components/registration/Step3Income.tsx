import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import type { ReactNode } from 'react';
import type { RegistrationValues } from '../../registration/schema';
import { INCOME_CATEGORIES, INDUSTRIES, type IncomeCategory } from '../../registration/catalog';
import { Chip, Field, Segmented, Select, TextInput, Toggle } from './ui';
import MoneyInput from './MoneyInput';

function Reveal({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="pt-1 pb-1 space-y-4 pl-4 border-l-2 border-accent-green/60">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Step3Income() {
  const { register, control, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.income;
  const categories = useWatch({ control, name: 'income.categories' }) ?? [];
  const has = (c: IncomeCategory) => categories.includes(c);

  return (
    <div className="space-y-5">
      <Controller control={control} name="income.categories" render={({ field }) => {
        const toggle = (id: IncomeCategory) => {
          const cur = field.value as IncomeCategory[];
          if (cur.includes(id)) return field.onChange(cur.filter((c) => c !== id));
          // "Unemployed / Student" is mutually exclusive with earning profiles.
          if (id === 'unemployed') return field.onChange(['unemployed']);
          field.onChange([...cur.filter((c) => c !== 'unemployed'), id]);
        };
        return (
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              How do you earn income? <span className="normal-case font-medium">(select all that apply)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {INCOME_CATEGORIES.map((c) => (
                <Chip key={c.id} id={`reg-cat-${c.id}`} selected={has(c.id)} onClick={() => toggle(c.id)} label={c.label} hint={c.hint} />
              ))}
            </div>
            {e?.categories && <p role="alert" className="text-xs text-error font-medium">{e.categories.message ?? e.categories.root?.message}</p>}
          </fieldset>
        );
      }} />

      <Reveal show={has('paye')}>
        <Field label="Employer Name" htmlFor="reg-employer" error={e?.employerName?.message}>
          <TextInput id="reg-employer" autoComplete="organization" placeholder="e.g. Apex Ventures Ltd" invalid={!!e?.employerName} {...register('income.employerName')} />
        </Field>
        <Controller control={control} name="income.hasH1Card" render={({ field }) => (
          <Toggle id="reg-h1" checked={field.value} onChange={field.onChange}
            label="I have my Form H1 / Annual Tax Deduction Card"
            description="You'll be able to upload it in the Filing Vault after registration." />
        )} />
      </Reveal>

      <Reveal show={has('direct')}>
        <Field label="Estimated Annual Gross Turnover (NGN)" htmlFor="reg-turnover" error={e?.estimatedAnnualGross?.message}>
          <MoneyInput name="income.estimatedAnnualGross" id="reg-turnover" placeholder="₦0" invalid={!!e?.estimatedAnnualGross} />
        </Field>
        <Field label="Primary Trade / Industry" htmlFor="reg-industry" error={e?.industry?.message}>
          <Select id="reg-industry" invalid={!!e?.industry} {...register('income.industry')}>
            <option value="">Select industry…</option>
            {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </Select>
        </Field>
      </Reveal>

      <Reveal show={has('passive')}>
        <Field label="Do you hold Withholding Tax (WHT) credit notes to offset liability?" error={e?.hasWhtCreditNotes?.message}>
          <Controller control={control} name="income.hasWhtCreditNotes" render={({ field }) => (
            <Segmented name="reg-wht" value={field.value} onChange={field.onChange}
              options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]} />
          )} />
        </Field>
      </Reveal>

      {has('unemployed') && (
        <p className="text-xs text-on-surface-variant bg-surface-container-low border border-outline-variant rounded-xl p-3.5">
          Income up to ₦800,000 a year is taxed at 0% under the Nigeria Tax Act 2025. We'll still help you keep a clean filing record.
        </p>
      )}
    </div>
  );
}

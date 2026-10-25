import { Controller, useFormContext, useWatch, type FieldPath } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { Info } from 'lucide-react';
import type { ReactNode } from 'react';
import type { RegistrationValues } from '../../registration/schema';
import { PFAS, estimateRentRelief } from '../../registration/catalog';
import { formatNaira } from '../../registration/services';
import { Field, Segmented, Select, TextInput, Toggle } from './ui';
import MoneyInput from './MoneyInput';

function Sub({ show, children }: { show: boolean; children: ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
          <div className="pt-3 pb-1 space-y-4 pl-4 ml-1 border-l-2 border-accent-green/60">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default function Step4Reliefs() {
  const { register, control, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.reliefs;
  const [pension, life, housing, rent] = useWatch({
    control, name: ['reliefs.pensionEnabled', 'reliefs.lifeAssuranceEnabled', 'reliefs.housingStatus', 'reliefs.annualRentPaid'],
  });

  const toggle = (name: FieldPath<RegistrationValues>, id: string, label: string, description: string) => (
    <Controller control={control} name={name} render={({ field }) => (
      <Toggle id={id} checked={!!field.value} onChange={field.onChange} label={label} description={description} />
    )} />
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-surface-container-low border border-outline-variant text-xs text-on-surface-variant">
        <Info className="w-4 h-4 text-primary-container shrink-0 mt-0.5" />
        <p>These are the deductions allowed under the <span className="font-bold text-on-surface">Nigeria Tax Act 2025</span>. Tell us which apply — we'll compute the amounts when you file.</p>
      </div>

      <div>
        {toggle('reliefs.pensionEnabled', 'reg-pension', 'Pension Contribution (RSA)', 'Contributory Pension Scheme — fully deductible.')}
        <Sub show={pension}>
          <Field label="Pension Fund Administrator" htmlFor="reg-pfa" error={e?.pfaName?.message}>
            <Select id="reg-pfa" invalid={!!e?.pfaName} {...register('reliefs.pfaName')}>
              <option value="">Select PFA…</option>
              {PFAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </Select>
          </Field>
          <Field label="RSA PIN" htmlFor="reg-rsa" error={e?.rsaPin?.message} hint="Starts with PEN, followed by 12 digits.">
            <Controller control={control} name="reliefs.rsaPin" render={({ field }) => (
              <TextInput id="reg-rsa" placeholder="PEN100000000000" autoComplete="off" className="font-mono uppercase tracking-wider"
                invalid={!!e?.rsaPin} value={field.value} ref={field.ref} onBlur={field.onBlur}
                onChange={(ev) => {
                  const raw = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
                  const digits = raw.replace(/^P?E?N?/, '').replace(/\D/g, '').slice(0, 12);
                  field.onChange(digits ? `PEN${digits}` : '');
                }} />
            )} />
          </Field>
        </Sub>
      </div>

      {toggle('reliefs.nhfEnabled', 'reg-nhf', 'National Housing Fund (NHF)', '2.5% of basic salary — statutory contribution.')}
      {toggle('reliefs.nhiaEnabled', 'reg-nhia', 'National Health Insurance (NHIA)', 'Health insurance contributions under the NHIA Act 2022.')}

      <div>
        {toggle('reliefs.lifeAssuranceEnabled', 'reg-life', 'Life Assurance Premium', 'Premiums paid on a policy covering you or your spouse.')}
        <Sub show={life}>
          <Field label="Annual Premium Paid (NGN)" htmlFor="reg-life-premium" error={e?.lifeAssurancePremium?.message}>
            <MoneyInput name="reliefs.lifeAssurancePremium" id="reg-life-premium" invalid={!!e?.lifeAssurancePremium} />
          </Field>
        </Sub>
      </div>

      <div className="pt-2 space-y-3">
        <Field label="Housing Status" error={e?.housingStatus?.message}>
          <Controller control={control} name="reliefs.housingStatus" render={({ field }) => (
            <Segmented name="reg-housing" value={field.value} onChange={field.onChange} options={[
              { value: 'tenant', label: 'Tenant' },
              { value: 'owner', label: 'Owner-Occupier' },
              { value: 'other', label: 'Family / Employer' },
            ]} />
          )} />
        </Field>
        <Sub show={housing === 'tenant'}>
          <Field label="Annual Rent Paid (NGN)" htmlFor="reg-rent" error={e?.annualRentPaid?.message}
            hint={rent > 0 ? <>Estimated rent relief: <span className="font-bold text-primary-container">{formatNaira(estimateRentRelief(rent))}</span> (20% of rent, max ₦500,000). Keep your tenancy receipts.</> : 'Rent relief is 20% of annual rent, capped at ₦500,000.'}>
            <MoneyInput name="reliefs.annualRentPaid" id="reg-rent" invalid={!!e?.annualRentPaid} />
          </Field>
        </Sub>
        <Sub show={housing === 'owner'}>
          <Field label="Mortgage Interest on Primary Residence (NGN / yr)" htmlFor="reg-mortgage" error={e?.mortgageInterest?.message} hint="Leave blank if you have no mortgage." optional>
            <MoneyInput name="reliefs.mortgageInterest" id="reg-mortgage" invalid={!!e?.mortgageInterest} />
          </Field>
        </Sub>
      </div>
    </div>
  );
}

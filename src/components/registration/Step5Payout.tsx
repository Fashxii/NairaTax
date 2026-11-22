import { Controller, useFormContext } from 'react-hook-form';
import { Landmark, Briefcase, ShieldCheck, Pencil } from 'lucide-react';
import type { RegistrationValues } from '../../registration/schema';
import { BANKS, INCOME_CATEGORIES, estimateRentRelief } from '../../registration/catalog';
import { SIRS } from '../../registration/states';
import { digitsOnly, formatNaira } from '../../registration/services';
import { Field, Select, TextInput } from './ui';

export default function Step5Payout({ onEditStep }: { onEditStep: (i: number) => void }) {
  const { register, control, getValues, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.bank;

  const v = getValues();
  const authority = SIRS[v.identity.state];
  const cats = INCOME_CATEGORIES.filter((c) => v.income.categories.includes(c.id)).map((c) => c.label);
  const deductions = [
    v.reliefs.pensionEnabled && `Pension (${v.reliefs.pfaName || 'PFA'})`,
    v.reliefs.nhfEnabled && 'NHF',
    v.reliefs.nhiaEnabled && 'NHIA',
    v.reliefs.lifeAssuranceEnabled && `Life assurance (${formatNaira(v.reliefs.lifeAssurancePremium)})`,
    v.reliefs.housingStatus === 'tenant' && v.reliefs.annualRentPaid > 0 && `Rent relief ≈ ${formatNaira(estimateRentRelief(v.reliefs.annualRentPaid))}`,
    v.reliefs.housingStatus === 'owner' && v.reliefs.mortgageInterest > 0 && `Mortgage interest (${formatNaira(v.reliefs.mortgageInterest)})`,
  ].filter(Boolean) as string[];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Field label="Bank" htmlFor="reg-bank" error={e?.bankCode?.message}>
          <Select id="reg-bank" invalid={!!e?.bankCode} {...register('bank.bankCode')}>
            <option value="">Select your bank…</option>
            {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Account Number (NUBAN)" htmlFor="reg-nuban" error={e?.accountNumber?.message}>
          <Controller control={control} name="bank.accountNumber" render={({ field }) => (
            <TextInput id="reg-nuban" inputMode="numeric" autoComplete="off" placeholder="0123456789"
              className="font-mono tracking-[0.2em]" invalid={!!e?.accountNumber}
              value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => field.onChange(digitsOnly(ev.target.value, 10))} />
          )} />
        </Field>

        <Field label="Account name (exactly as shown by your bank)" htmlFor="reg-account-name" error={e?.accountName?.message}
          hint="Used for tax refunds and payouts only. We don't check this with your bank — please double-check it.">
          <TextInput id="reg-account-name" autoComplete="off" placeholder="e.g. OGUNLADE ADEBAYO"
            invalid={!!e?.accountName} {...register('bank.accountName')} />
        </Field>
      </div>

      {/* Review card */}
      <section aria-labelledby="review-heading" className="rounded-2xl border border-outline-variant overflow-hidden">
        <h3 id="review-heading" className="px-5 py-3 bg-surface-container-low text-xs font-black uppercase tracking-widest text-primary-container">
          Review your tax profile
        </h3>
        <dl className="divide-y divide-outline-variant/60">
          {[
            { icon: Landmark, label: 'Assigned Jurisdiction', value: authority ? `${authority.name} (${authority.code})` : '—', sub: [v.identity.lga, v.identity.state].filter(Boolean).join(', '), step: 1 },
            { icon: Briefcase, label: 'Tax Classification', value: v.income.categories.includes('paye') && v.income.categories.length === 1 ? 'PAYE' : v.income.categories.some((c) => c !== 'paye' && c !== 'unemployed') ? 'Direct Assessment' : v.income.categories.includes('unemployed') ? 'Below threshold' : '—', sub: cats.join(' · '), step: 2 },
            { icon: ShieldCheck, label: 'Eligible Deductions Selected', value: deductions.length ? `${deductions.length} selected` : 'None selected', sub: deductions.join(' · '), step: 3 },
          ].map((row) => (
            <div key={row.label} className="flex items-start gap-3 px-5 py-4">
              <row.icon className="w-4.5 h-4.5 text-accent-green mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{row.label}</dt>
                <dd className="text-sm font-bold text-on-surface">{row.value}</dd>
                {row.sub && <dd className="text-[11px] text-on-surface-variant mt-0.5 break-words">{row.sub}</dd>}
              </div>
              <button type="button" id={`review-edit-${row.step + 1}`} onClick={() => onEditStep(row.step)}
                className="text-[11px] font-bold text-primary-container hover:underline flex items-center gap-1 cursor-pointer">
                <Pencil className="w-3 h-3" /> Edit
              </button>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}

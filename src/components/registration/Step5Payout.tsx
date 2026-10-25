import { useEffect, useRef, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { BadgeCheck, Loader2, XCircle, Landmark, Briefcase, ShieldCheck, Pencil } from 'lucide-react';
import type { RegistrationValues } from '../../registration/schema';
import { BANKS, INCOME_CATEGORIES, estimateRentRelief } from '../../registration/catalog';
import { SIRS } from '../../registration/states';
import { digitsOnly, formatNaira, mockResolveAccount } from '../../registration/services';
import { Field, Select, TextInput } from './ui';

export default function Step5Payout({ onEditStep }: { onEditStep: (i: number) => void }) {
  const { register, control, setValue, getValues, clearErrors, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.bank;
  const [bankCode, accountNumber, accountName] = useWatch({ control, name: ['bank.bankCode', 'bank.accountNumber', 'bank.accountName'] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(accountName ? 'ok' : 'idle');
  const [lookupError, setLookupError] = useState('');
  const reqId = useRef(0);

  // Simulated NIBSS name enquiry whenever bank + 10-digit NUBAN are present.
  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      if (getValues('bank.accountName')) setValue('bank.accountName', '');
      setStatus('idle');
      return;
    }
    if (getValues('bank.accountName')) return; // already resolved for these values
    const id = ++reqId.current;
    setStatus('loading'); setLookupError('');
    const { identity, auth } = getValues();
    mockResolveAccount(bankCode, accountNumber, identity.legalName || `${auth.lastName} ${auth.firstName}`).then((res) => {
      if (id !== reqId.current) return;
      if (res.ok) { setValue('bank.accountName', res.accountName, { shouldDirty: true }); clearErrors('bank.accountName'); setStatus('ok'); }
      else { setStatus('error'); setLookupError(res.error); }
    });
  }, [bankCode, accountNumber, getValues, setValue, clearErrors]);

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
          <Select id="reg-bank" invalid={!!e?.bankCode} {...register('bank.bankCode', { onChange: () => setValue('bank.accountName', '') })}>
            <option value="">Select your bank…</option>
            {BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Account Number (NUBAN)" htmlFor="reg-nuban" error={e?.accountNumber?.message}>
          <Controller control={control} name="bank.accountNumber" render={({ field }) => (
            <TextInput id="reg-nuban" inputMode="numeric" autoComplete="off" placeholder="0123456789"
              className="font-mono tracking-[0.2em]" invalid={!!e?.accountNumber}
              value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => { setValue('bank.accountName', ''); field.onChange(digitsOnly(ev.target.value, 10)); }} />
          )} />
        </Field>

        <div id="reg-account-name" aria-live="polite"
          className={`flex items-center gap-2.5 h-12 px-4 rounded-xl border text-sm font-bold transition-all ${
            status === 'ok' ? 'border-accent-green bg-accent-green/10 text-primary-container'
              : status === 'error' || e?.accountName ? 'border-error/50 bg-error/5 text-error'
              : 'border-dashed border-outline-variant text-on-surface-variant/70 font-medium'
          }`}>
          {status === 'loading' && <><Loader2 className="w-4 h-4 animate-spin" /> Resolving account name via NIBSS…</>}
          {status === 'ok' && <><BadgeCheck className="w-4 h-4 text-accent-green" /> {accountName}</>}
          {status === 'error' && <><XCircle className="w-4 h-4" /> {lookupError}</>}
          {status === 'idle' && (e?.accountName ? e.accountName.message : 'Account name will appear here')}
        </div>
        <p className="text-[10px] text-on-surface-variant/70 -mt-2">Simulated NIBSS name enquiry. Used for tax refunds and payouts only.</p>
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

import { useEffect, useRef, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { BadgeCheck, Loader2, XCircle, Building2, Landmark, Scale, Receipt, Pencil } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { COMMERCIAL_BANKS, classifyCIT, isVatMandatory, nrsTaxOffice } from '../../../registration/corporate/catalog';
import { digitsOnly, mockResolveAccount } from '../../../registration/services';
import { Field, Select, TextInput } from '../ui';

export default function CorpStep5Settlement({ onEditStep }: { onEditStep: (i: number) => void }) {
  const { register, control, setValue, getValues, clearErrors, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.bank;
  const [bankCode, accountNumber, accountName] = useWatch({ control, name: ['bank.bankCode', 'bank.accountNumber', 'bank.accountName'] });
  const [status, setStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>(accountName ? 'ok' : 'idle');
  const [lookupError, setLookupError] = useState('');
  const reqId = useRef(0);

  // Simulated NIBSS name enquiry — resolves to the CAC-registered company name.
  useEffect(() => {
    if (!bankCode || accountNumber.length !== 10) {
      if (getValues('bank.accountName')) setValue('bank.accountName', '');
      setStatus('idle');
      return;
    }
    if (getValues('bank.accountName')) return;
    const id = ++reqId.current;
    setStatus('loading'); setLookupError('');
    mockResolveAccount(bankCode, accountNumber, getValues('entity.companyName')).then((res) => {
      if (id !== reqId.current) return;
      if (res.ok) { setValue('bank.accountName', res.accountName, { shouldDirty: true }); clearErrors('bank.accountName'); setStatus('ok'); }
      else { setStatus('error'); setLookupError(res.error); }
    });
  }, [bankCode, accountNumber, getValues, setValue, clearErrors]);

  const v = getValues();
  const cit = classifyCIT(v.entity.entityType, v.tax.annualTurnover, v.tax.fixedAssets, v.tax.sector);
  const vatActive = isVatMandatory(v.tax.annualTurnover) || v.vat.voluntaryVat;
  const nameMatches = status === 'ok' && accountName === v.entity.companyName.toUpperCase();

  const rows = [
    { icon: Building2, label: 'Entity', value: v.entity.companyName || '—', sub: `${v.entity.rcNumber} · ${v.entity.entityType}`, step: 0 },
    { icon: Landmark, label: 'Designated NRS Tax Office', value: nrsTaxOffice(v.entity.state, v.entity.lga) || '—', sub: 'Indicative — confirmed by NRS on TIN issuance', step: 0 },
    {
      icon: Scale, label: 'CIT Bracket',
      value: cit.status === 'SMALL_COMPANY_EXEMPT' ? '0% — Small Company' : cit.status === 'PIT_SOLE_ENTERPRISE' ? 'N/A — State PIT' : `${Math.round((cit.rate ?? 0) * 100)}% — Standard Corporate`,
      sub: cit.reason, step: 2,
    },
    {
      icon: Receipt, label: 'VAT Status',
      value: vatActive ? 'Active VAT Agent' : 'Small Business Exempt',
      sub: vatActive ? `${isVatMandatory(v.tax.annualTurnover) ? 'Mandatory' : 'Voluntary'} · monthly returns by the 21st` : 'Below the mandatory threshold', step: 3,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <Field label="Corporate Bank" htmlFor="corp-bank" error={e?.bankCode?.message} hint="CBN-licensed commercial & non-interest banks.">
          <Select id="corp-bank" invalid={!!e?.bankCode} {...register('bank.bankCode', { onChange: () => setValue('bank.accountName', '') })}>
            <option value="">Select bank…</option>
            {COMMERCIAL_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Corporate Account Number (NUBAN)" htmlFor="corp-nuban" error={e?.accountNumber?.message}>
          <Controller control={control} name="bank.accountNumber" render={({ field }) => (
            <TextInput id="corp-nuban" inputMode="numeric" autoComplete="off" placeholder="0123456789"
              className="font-mono tracking-[0.2em]" invalid={!!e?.accountNumber}
              value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => { setValue('bank.accountName', ''); field.onChange(digitsOnly(ev.target.value, 10)); }} />
          )} />
        </Field>
        <div id="corp-account-name" aria-live="polite"
          className={`flex items-center gap-2.5 h-12 px-4 rounded-xl border text-sm font-bold transition-all ${
            status === 'ok' ? 'border-accent-green bg-accent-green/10 text-primary-container'
              : status === 'error' || e?.accountName ? 'border-error/50 bg-error/5 text-error'
              : 'border-dashed border-outline-variant text-on-surface-variant/70 font-medium'
          }`}>
          {status === 'loading' && <><Loader2 className="w-4 h-4 animate-spin" /> Resolving account name via NIBSS…</>}
          {status === 'ok' && <><BadgeCheck className="w-4 h-4 text-accent-green" /> {accountName}
            {nameMatches && <span className="ml-auto text-[10px] font-black uppercase tracking-wider text-emerald-700">Matches CAC name</span>}</>}
          {status === 'error' && <><XCircle className="w-4 h-4" /> {lookupError}</>}
          {status === 'idle' && (e?.accountName ? e.accountName.message : 'Account name will appear here')}
        </div>
        <p className="text-[10px] text-on-surface-variant/70 -mt-2">Simulated NIBSS name enquiry. Used for refunds and tax remittances.</p>
      </div>

      <section aria-labelledby="corp-review-heading" className="rounded-2xl border border-outline-variant overflow-hidden">
        <h3 id="corp-review-heading" className="px-5 py-3 bg-surface-container-low text-xs font-black uppercase tracking-widest text-primary-container">
          Review corporate tax profile
        </h3>
        <dl className="divide-y divide-outline-variant/60">
          {rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 px-5 py-4">
              <row.icon className="w-4.5 h-4.5 text-accent-green mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{row.label}</dt>
                <dd className="text-sm font-bold text-on-surface break-words">{row.value}</dd>
                {row.sub && <dd className="text-[11px] text-on-surface-variant mt-0.5 break-words">{row.sub}</dd>}
              </div>
              <button type="button" id={`corp-review-edit-${row.label.split(' ')[0].toLowerCase()}`} onClick={() => onEditStep(row.step)}
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

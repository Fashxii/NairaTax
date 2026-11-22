import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { AlertTriangle, Building2, Landmark, Scale, ReceiptText as Receipt, Pencil } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { COMMERCIAL_BANKS, classifyCIT, isVatMandatory, nrsTaxOffice } from '../../../registration/corporate/catalog';
import { digitsOnly } from '../../../registration/services';
import { Field, Select, TextInput } from '../ui';

const normName = (s: string) => s.trim().replace(/\s+/g, ' ').toUpperCase();

export default function CorpStep5Settlement({ onEditStep }: { onEditStep: (i: number) => void }) {
  const { register, control, getValues, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.bank;
  const accountName = useWatch({ control, name: 'bank.accountName' });

  const v = getValues();
  const cit = classifyCIT(v.entity.entityType, v.tax.annualTurnover, v.tax.fixedAssets, v.tax.sector);
  const vatActive = isVatMandatory(v.tax.annualTurnover) || v.vat.voluntaryVat;
  const nameDiffers = normName(accountName ?? '').length >= 2 && !!v.entity.companyName.trim()
    && normName(accountName) !== normName(v.entity.companyName);

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
          <Select id="corp-bank" invalid={!!e?.bankCode} {...register('bank.bankCode')}>
            <option value="">Select bank…</option>
            {COMMERCIAL_BANKS.map((b) => <option key={b.code} value={b.code}>{b.name}</option>)}
          </Select>
        </Field>
        <Field label="Corporate Account Number (NUBAN)" htmlFor="corp-nuban" error={e?.accountNumber?.message}>
          <Controller control={control} name="bank.accountNumber" render={({ field }) => (
            <TextInput id="corp-nuban" inputMode="numeric" autoComplete="off" placeholder="0123456789"
              className="font-mono tracking-[0.2em]" invalid={!!e?.accountNumber}
              value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => field.onChange(digitsOnly(ev.target.value, 10))} />
          )} />
        </Field>
        <Field label="Account name (exactly as shown by your bank)" htmlFor="corp-account-name" error={e?.accountName?.message}
          hint={nameDiffers
            ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> This differs from the registered business name you entered. Double-check it.</span>
            : "Used for refunds and tax remittances. We don't check this with your bank — please double-check it."}>
          <TextInput id="corp-account-name" autoComplete="off" placeholder="e.g. ACME TECHNOLOGIES NIGERIA LTD"
            invalid={!!e?.accountName} {...register('bank.accountName')} />
        </Field>
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

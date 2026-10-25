import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { BadgeCheck, Fingerprint, Loader2, ShieldCheck, AlertTriangle } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { DESIGNATIONS, isFreeEmail } from '../../../registration/corporate/catalog';
import { mockMatchSignatory } from '../../../registration/corporate/services';
import { digitsOnly, formatPhone, normalizePhone } from '../../../registration/services';
import { Field, Select, TextInput } from '../ui';

export default function CorpStep2Signatory() {
  const { register, control, setValue, getValues, clearErrors, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.signatory;
  const [nin, ninVerified, email, companyName] = useWatch({
    control, name: ['signatory.nin', 'signatory.ninVerified', 'signatory.email', 'entity.companyName'],
  });
  const [checking, setChecking] = useState(false);
  const [ninError, setNinError] = useState('');
  const [ninNote, setNinNote] = useState('');

  const verify = async () => {
    const designation = getValues('signatory.designation');
    if (!designation) { setNinError('Select the designation first.'); return; }
    setChecking(true); setNinError('');
    const res = await mockMatchSignatory(getValues('signatory.nin'), designation);
    setChecking(false);
    if (!res.ok) { setNinError(res.error); return; }
    setNinNote(res.note);
    setValue('signatory.ninVerified', true, { shouldDirty: true });
    clearErrors(['signatory.nin', 'signatory.ninVerified']);
  };

  const unverify = () => {
    if (getValues('signatory.ninVerified')) setValue('signatory.ninVerified', false);
    setNinNote(''); setNinError('');
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="Signatory Designation" htmlFor="corp-designation" error={e?.designation?.message}>
          <Select id="corp-designation" invalid={!!e?.designation} {...register('signatory.designation', { onChange: unverify })}>
            <option value="">Select designation…</option>
            {DESIGNATIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </Select>
        </Field>
        <Field label="Full Legal Name" htmlFor="corp-officer-name" error={e?.fullName?.message}>
          <TextInput id="corp-officer-name" autoComplete="name" placeholder="e.g. Adebayo Okonjo" invalid={!!e?.fullName} {...register('signatory.fullName')} />
        </Field>
      </div>

      <Field label="Signatory NIN" htmlFor="corp-nin" error={ninError || e?.nin?.message || e?.ninVerified?.message}
        hint={ninVerified ? undefined : 'Matched against CAC director / secretary records (simulated).'}>
        <div className="flex gap-2">
          <Controller control={control} name="signatory.nin" render={({ field }) => (
            <div className="relative flex-1">
              <TextInput id="corp-nin" inputMode="numeric" autoComplete="off" placeholder="00000000000"
                className="font-mono tracking-[0.25em] pr-10" invalid={!!(ninError || e?.nin)}
                value={field.value} ref={field.ref} onBlur={field.onBlur}
                onChange={(ev) => { field.onChange(digitsOnly(ev.target.value, 11)); unverify(); }} />
              <Fingerprint className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            </div>
          )} />
          <button type="button" id="corp-verify-nin" onClick={verify}
            disabled={checking || ninVerified || (nin ?? '').length !== 11}
            className="h-12 px-4 rounded-xl text-xs font-bold bg-primary-container text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : ninVerified ? <BadgeCheck className="w-4 h-4 text-accent-green" /> : null}
            {checking ? 'Matching…' : ninVerified ? 'Matched' : 'Verify NIN'}
          </button>
        </div>
      </Field>
      {ninVerified && (
        <p id="corp-nin-note" className="flex items-start gap-2 text-xs text-on-surface bg-accent-green/10 border border-accent-green/40 rounded-xl p-3.5 -mt-2">
          <BadgeCheck className="w-4 h-4 text-accent-green shrink-0 mt-0.5" /> {ninNote || 'Identity confirmed.'}
        </p>
      )}

      <Field label="Official Email Address" htmlFor="corp-email" error={e?.email?.message}
        hint={email && isFreeEmail(email)
          ? <span className="inline-flex items-center gap-1 text-amber-700"><AlertTriangle className="w-3.5 h-3.5" /> A corporate-domain address is recommended for official NRS correspondence.</span>
          : "Login and official tax correspondence go here. We'll send a one-time code."}>
        <TextInput id="corp-email" type="email" inputMode="email" autoComplete="email" placeholder="tax@yourcompany.ng" invalid={!!e?.email} {...register('signatory.email')} />
      </Field>

      <Field label="Official Phone Number" htmlFor="corp-phone" error={e?.phone?.message} hint="Used for two-factor verification via SMS / WhatsApp.">
        <Controller control={control} name="signatory.phone" render={({ field }) => (
          <div className="flex">
            <span className="h-12 px-3.5 flex items-center gap-1.5 bg-surface-container border border-r-0 border-outline rounded-l-xl text-sm font-bold text-on-surface">
              <span aria-hidden>🇳🇬</span>+234
            </span>
            <TextInput id="corp-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="801 234 5678"
              className="rounded-l-none font-mono tracking-wide" invalid={!!e?.phone}
              value={formatPhone(field.value)} onBlur={field.onBlur} ref={field.ref}
              onChange={(ev) => field.onChange(normalizePhone(ev.target.value))} />
          </div>
        )} />
      </Field>

      <div className="space-y-1.5">
        <label htmlFor="corp-ndpa" className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${e?.ndpaConsent ? 'border-error' : 'border-outline-variant hover:border-outline'}`}>
          <input id="corp-ndpa" type="checkbox" className="mt-0.5 w-4.5 h-4.5 accent-[#013220] cursor-pointer" {...register('signatory.ndpaConsent')} />
          <span className="text-xs text-on-surface-variant leading-relaxed">
            <span className="font-bold text-on-surface flex items-center gap-1.5 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-green" /> Corporate authorisation & NDPA consent
            </span>
            I confirm I am authorised to act for <span className="font-bold text-on-surface">{companyName || 'the registered entity'}</span> and
            authorise DIYtax9ja to prepare and file its tax returns. I consent to processing of the entity’s and my personal data under the
            Nigeria Data Protection Act 2023.
          </span>
        </label>
        {e?.ndpaConsent && <p role="alert" className="text-xs text-error font-medium">{e.ndpaConsent.message}</p>}
      </div>
    </div>
  );
}

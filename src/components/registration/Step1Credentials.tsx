import { Controller, useFormContext } from 'react-hook-form';
import { ShieldCheck } from 'lucide-react';
import type { RegistrationValues } from '../../registration/schema';
import { formatPhone, normalizePhone } from '../../registration/services';
import { Field, TextInput } from './ui';

export default function Step1Credentials() {
  const { register, control, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.auth;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="First Name" htmlFor="reg-first-name" error={e?.firstName?.message}>
          <TextInput id="reg-first-name" autoComplete="given-name" placeholder="e.g. Adebayo" invalid={!!e?.firstName} {...register('auth.firstName')} />
        </Field>
        <Field label="Last Name" htmlFor="reg-last-name" error={e?.lastName?.message}>
          <TextInput id="reg-last-name" autoComplete="family-name" placeholder="e.g. Ogunlade" invalid={!!e?.lastName} {...register('auth.lastName')} />
        </Field>
      </div>

      <Field label="Email Address" htmlFor="reg-email" error={e?.email?.message} hint="We'll send a one-time code here to secure your account.">
        <TextInput id="reg-email" type="email" autoComplete="email" inputMode="email" placeholder="you@domain.ng" invalid={!!e?.email} {...register('auth.email')} />
      </Field>

      <Field label="Mobile Number" htmlFor="reg-phone" error={e?.phone?.message} hint="Used for SMS / WhatsApp filing reminders.">
        <Controller
          control={control} name="auth.phone"
          render={({ field }) => (
            <div className="flex">
              <span className="h-12 px-3.5 flex items-center gap-1.5 bg-surface-container border border-r-0 border-outline rounded-l-xl text-sm font-bold text-on-surface">
                <span aria-hidden>🇳🇬</span>+234
              </span>
              <TextInput
                id="reg-phone" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="803 123 4567"
                className="rounded-l-none font-mono tracking-wide" invalid={!!e?.phone}
                value={formatPhone(field.value)} onBlur={field.onBlur} ref={field.ref}
                onChange={(ev) => field.onChange(normalizePhone(ev.target.value))}
              />
            </div>
          )}
        />
      </Field>

      <div className="space-y-1.5">
        <label htmlFor="reg-ndpa" className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${e?.ndpaConsent ? 'border-error' : 'border-outline-variant hover:border-outline'}`}>
          <input id="reg-ndpa" type="checkbox" className="mt-0.5 w-4.5 h-4.5 accent-[#013220] cursor-pointer" {...register('auth.ndpaConsent')} />
          <span className="text-xs text-on-surface-variant leading-relaxed">
            <span className="font-bold text-on-surface flex items-center gap-1.5 mb-0.5">
              <ShieldCheck className="w-3.5 h-3.5 text-accent-green" /> Data processing consent (NDPA 2023)
            </span>
            I consent to DIYtax9ja processing my personal, identity and financial data to compute and file my taxes,
            in line with the Nigeria Data Protection Act 2023. I can withdraw consent at any time from Settings.
          </span>
        </label>
        {e?.ndpaConsent && <p role="alert" className="text-xs text-error font-medium">{e.ndpaConsent.message}</p>}
      </div>
    </div>
  );
}

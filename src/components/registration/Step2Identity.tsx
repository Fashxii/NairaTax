import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck, Fingerprint, Landmark, Loader2 } from 'lucide-react';
import type { RegistrationValues } from '../../registration/schema';
import { LGAS, SIRS, STATES } from '../../registration/states';
import { digitsOnly, mockVerifyNIN } from '../../registration/services';
import { Field, Select, TextInput, Toggle } from './ui';

export default function Step2Identity() {
  const { register, control, setValue, getValues, clearErrors, formState: { errors } } = useFormContext<RegistrationValues>();
  const e = errors.identity;
  const [state, ninVerified, legalName, dob, hasTin, nin] = useWatch({
    control, name: ['identity.state', 'identity.ninVerified', 'identity.legalName', 'identity.dateOfBirth', 'identity.hasTin', 'identity.nin'],
  });
  const [checking, setChecking] = useState(false);
  const [ninError, setNinError] = useState('');
  const authority = state ? SIRS[state] : undefined;

  const verifyNin = async () => {
    const { identity, auth } = getValues();
    setChecking(true); setNinError('');
    const res = await mockVerifyNIN(identity.nin, auth.firstName, auth.lastName);
    setChecking(false);
    if (!res.ok) { setNinError(res.error!); return; }
    setValue('identity.legalName', res.legalName!, { shouldDirty: true });
    setValue('identity.dateOfBirth', res.dateOfBirth!, { shouldDirty: true });
    setValue('identity.ninVerified', true, { shouldDirty: true });
    clearErrors(['identity.nin', 'identity.ninVerified']);
  };

  return (
    <div className="space-y-5">
      {/* NIN */}
      <Field label="National Identification Number (NIN)" htmlFor="reg-nin"
        error={ninError || e?.nin?.message || e?.ninVerified?.message}
        hint="The 11-digit number on your NIN slip or NIMC ID card.">
        <div className="flex gap-2">
          <Controller control={control} name="identity.nin" render={({ field }) => (
            <div className="relative flex-1">
              <TextInput id="reg-nin" inputMode="numeric" autoComplete="off" placeholder="00000000000"
                className="font-mono tracking-[0.25em] pr-10" invalid={!!(ninError || e?.nin)}
                value={field.value} ref={field.ref} onBlur={field.onBlur}
                onChange={(ev) => {
                  field.onChange(digitsOnly(ev.target.value, 11));
                  if (getValues('identity.ninVerified')) {
                    setValue('identity.ninVerified', false);
                    setValue('identity.legalName', '');
                    setValue('identity.dateOfBirth', '');
                  }
                  setNinError('');
                }} />
              <Fingerprint className="w-4.5 h-4.5 absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/60" />
            </div>
          )} />
          <button type="button" id="reg-verify-nin" onClick={verifyNin}
            disabled={checking || ninVerified || (nin ?? '').length !== 11}
            className="h-12 px-4 rounded-xl text-xs font-bold bg-primary-container text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : ninVerified ? <BadgeCheck className="w-4 h-4 text-accent-green" /> : null}
            {checking ? 'Checking…' : ninVerified ? 'Verified' : 'Verify NIN'}
          </button>
        </div>
      </Field>

      <AnimatePresence>
        {ninVerified && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="grid grid-cols-2 gap-3 p-4 rounded-xl bg-accent-green/10 border border-accent-green/40">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Legal name (NIMC)</p>
                <p id="reg-legal-name" className="text-sm font-bold text-on-surface mt-0.5">{legalName}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Date of birth</p>
                <p id="reg-dob" className="text-sm font-bold text-on-surface mt-0.5 font-mono">{dob}</p>
              </div>
              <p className="col-span-2 text-[10px] text-on-surface-variant/80">Simulated NIMC lookup — replace with live verification before launch.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TIN */}
      <Controller control={control} name="identity.hasTin" render={({ field }) => (
        <Toggle id="reg-has-tin" checked={field.value} onChange={(v) => { field.onChange(v); if (!v) setValue('identity.tin', ''); }}
          label="I already have a Tax ID (JTB / NRS TIN)"
          description={field.value ? 'Enter it below.' : "No TIN yet? No problem — we'll generate one during filing."} />
      )} />
      {hasTin && (
        <Field label="Taxpayer Identification Number" htmlFor="reg-tin" error={e?.tin?.message}>
          <Controller control={control} name="identity.tin" render={({ field }) => (
            <TextInput id="reg-tin" inputMode="numeric" placeholder="10–12 digits" className="font-mono tracking-widest"
              invalid={!!e?.tin} value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => field.onChange(digitsOnly(ev.target.value, 12))} />
          )} />
        </Field>
      )}

      {/* Jurisdiction */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="State of Residence (as of 1 January)" htmlFor="reg-state" error={e?.state?.message}>
          <Select id="reg-state" invalid={!!e?.state} {...register('identity.state', {
            onChange: () => setValue('identity.lga', ''),
          })}>
            <option value="">Select state…</option>
            {STATES.map((s) => <option key={s} value={s}>{s === 'FCT' ? 'FCT — Abuja' : s}</option>)}
          </Select>
        </Field>
        <Field label="Local Government Area" htmlFor="reg-lga" error={e?.lga?.message}>
          <Select id="reg-lga" disabled={!state} invalid={!!e?.lga} {...register('identity.lga')}>
            <option value="">{state ? 'Select LGA…' : 'Select a state first'}</option>
            {(LGAS[state] ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
          </Select>
        </Field>
      </div>

      <AnimatePresence mode="wait">
        {authority && (
          <motion.div key={state} id="reg-sirs-banner" initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 rounded-xl bg-primary-container text-white">
            <span className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <Landmark className="w-5 h-5 text-accent-green" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-accent-green">Jurisdiction</p>
              <p className="text-sm font-bold">{authority.name} ({authority.code})</p>
              <p className="text-[11px] text-white/70">Your PIT is assessed and collected by this authority.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Address */}
      <Field label="Street Address" htmlFor="reg-street" error={e?.street?.message}>
        <TextInput id="reg-street" autoComplete="address-line1" placeholder="e.g. 12 Allen Avenue" invalid={!!e?.street} {...register('identity.street')} />
      </Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Field label="City / Town" htmlFor="reg-city" error={e?.city?.message}>
          <TextInput id="reg-city" autoComplete="address-level2" placeholder="e.g. Ikeja" invalid={!!e?.city} {...register('identity.city')} />
        </Field>
        <Field label="Nearest Landmark" htmlFor="reg-landmark" error={e?.landmark?.message} optional>
          <TextInput id="reg-landmark" placeholder="e.g. Opposite Computer Village" invalid={!!e?.landmark} {...register('identity.landmark')} />
        </Field>
      </div>
    </div>
  );
}

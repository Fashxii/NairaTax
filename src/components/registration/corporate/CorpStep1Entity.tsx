import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { motion, AnimatePresence } from 'motion/react';
import { BadgeCheck, Building2, Info, Loader2, Lock } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { ENTITY_TYPES, prefixFor } from '../../../registration/corporate/catalog';
import { maskCacNumber, mockVerifyCAC } from '../../../registration/corporate/services';
import { digitsOnly } from '../../../registration/services';
import { LGAS, STATES } from '../../../registration/states';
import { Field, Select, TextInput, Toggle } from '../ui';

export default function CorpStep1Entity() {
  const { register, control, setValue, getValues, clearErrors, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.entity;
  const [entityType, rcNumber, cacVerified, companyName, hasTin, state] = useWatch({
    control, name: ['entity.entityType', 'entity.rcNumber', 'entity.cacVerified', 'entity.companyName', 'entity.hasTin', 'entity.state'],
  });
  const [checking, setChecking] = useState(false);
  const [cacError, setCacError] = useState('');
  const prefix = prefixFor(entityType);

  const resetCac = () => {
    if (getValues('entity.cacVerified')) {
      setValue('entity.cacVerified', false);
      setValue('entity.companyName', '');
    }
    setCacError('');
  };

  const verifyCac = async () => {
    setChecking(true); setCacError('');
    const res = await mockVerifyCAC(getValues('entity.rcNumber'), getValues('entity.entityType'));
    setChecking(false);
    if (!res.ok) { setCacError(res.error); return; }
    setValue('entity.companyName', res.companyName, { shouldDirty: true });
    setValue('entity.cacVerified', true, { shouldDirty: true });
    clearErrors(['entity.rcNumber', 'entity.cacVerified']);
  };

  const selected = ENTITY_TYPES.find((t) => t.id === entityType);

  return (
    <div className="space-y-5">
      {/* Entity type */}
      <Controller control={control} name="entity.entityType" render={({ field }) => (
        <fieldset>
          <legend className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">Entity Type</legend>
          <div role="radiogroup" className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {ENTITY_TYPES.map((t) => {
              const on = field.value === t.id;
              return (
                <button key={t.id} type="button" role="radio" aria-checked={on} id={`corp-entity-${t.id}`}
                  onClick={() => {
                    if (field.value === t.id) return;
                    field.onChange(t.id);
                    // Re-mask the CAC number for the new prefix and require re-verification.
                    setValue('entity.rcNumber', maskCacNumber(getValues('entity.rcNumber'), t.id));
                    resetCac();
                  }}
                  className={`flex items-center gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
                    on ? 'border-primary-container bg-primary-container/5 shadow-xs' : 'border-outline-variant bg-white hover:border-outline'
                  }`}>
                  <span className={`shrink-0 w-4.5 h-4.5 rounded-full border-2 flex items-center justify-center ${on ? 'border-primary-container' : 'border-outline'}`}>
                    {on && <span className="w-2 h-2 rounded-full bg-accent-green" />}
                  </span>
                  <span className="text-sm font-bold text-on-surface">{t.label}</span>
                </button>
              );
            })}
          </div>
          {e?.entityType && <p role="alert" className="text-xs text-error font-medium mt-1.5">{e.entityType.message}</p>}
        </fieldset>
      )} />

      <AnimatePresence>
        {selected?.hint && (
          <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="flex items-start gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-300 rounded-xl p-3.5 overflow-hidden">
            <Info className="w-4 h-4 shrink-0 mt-0.5" /> {selected.hint}
          </motion.p>
        )}
      </AnimatePresence>

      {/* CAC */}
      <Field label={`CAC ${prefix === 'BN' ? 'BN' : prefix === 'LP' ? 'LP' : 'RC'} Number`} htmlFor="corp-rc"
        error={cacError || e?.rcNumber?.message || e?.cacVerified?.message}
        hint={entityType ? `Format: ${prefix}-1234567` : 'Select the entity type first.'}>
        <div className="flex gap-2">
          <Controller control={control} name="entity.rcNumber" render={({ field }) => (
            <TextInput id="corp-rc" autoComplete="off" placeholder={`${prefix}-1234567`} disabled={!entityType}
              className="font-mono tracking-wider uppercase" invalid={!!(cacError || e?.rcNumber)}
              value={field.value} ref={field.ref} onBlur={field.onBlur}
              onChange={(ev) => { field.onChange(maskCacNumber(ev.target.value, entityType)); resetCac(); }} />
          )} />
          <button type="button" id="corp-verify-cac" onClick={verifyCac}
            disabled={checking || cacVerified || !entityType || !/^(RC|BN|LP)-\d{4,8}$/.test(rcNumber)}
            className="h-12 px-4 rounded-xl text-xs font-bold bg-primary-container text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer shrink-0">
            {checking ? <Loader2 className="w-4 h-4 animate-spin" /> : cacVerified ? <BadgeCheck className="w-4 h-4 text-accent-green" /> : null}
            {checking ? 'Checking CAC…' : cacVerified ? 'Verified' : 'Verify CAC'}
          </button>
        </div>
      </Field>

      <Field label="Registered Business Name" htmlFor="corp-name"
        hint={cacVerified ? 'Locked to the CAC record (simulated lookup).' : 'Auto-filled from the CAC register after verification.'}>
        <div className="relative">
          <TextInput id="corp-name" readOnly value={companyName} placeholder="—"
            className={`pr-10 ${cacVerified ? 'border-accent-green bg-accent-green/5' : ''}`} />
          {cacVerified ? <Lock className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-accent-green" />
            : <Building2 className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-on-surface-variant/50" />}
        </div>
      </Field>

      {/* TIN */}
      <Controller control={control} name="entity.hasTin" render={({ field }) => (
        <Toggle id="corp-has-tin" checked={field.value} onChange={(v) => { field.onChange(v); if (!v) setValue('entity.tin', ''); }}
          label="We already have a Corporate TIN (JTB / NRS)"
          description={field.value ? 'Enter it below (hyphen optional).' : "Don't have a Corporate TIN yet? We'll auto-assign one during onboarding."} />
      )} />
      {hasTin && (
        <Field label="Corporate TIN" htmlFor="corp-tin" error={e?.tin?.message}>
          <Controller control={control} name="entity.tin" render={({ field }) => (
            <TextInput id="corp-tin" inputMode="numeric" placeholder="24910294-0001" className="font-mono tracking-widest"
              invalid={!!e?.tin} ref={field.ref} onBlur={field.onBlur}
              value={field.value.length > 8 ? `${field.value.slice(0, 8)}-${field.value.slice(8)}` : field.value}
              onChange={(ev) => field.onChange(digitsOnly(ev.target.value, 12))} />
          )} />
        </Field>
      )}

      <Field label="Date of Incorporation" htmlFor="corp-inc-date" error={e?.incorporationDate?.message}>
        <TextInput id="corp-inc-date" type="date" max={new Date().toISOString().slice(0, 10)} min="1900-01-01"
          invalid={!!e?.incorporationDate} {...register('entity.incorporationDate')} />
      </Field>

      {/* Principal place of business */}
      <fieldset className="space-y-4 pt-1">
        <legend className="text-xs font-black uppercase tracking-widest text-primary-container mb-3">Principal Place of Business</legend>
        <Field label="Street Address" htmlFor="corp-street" error={e?.street?.message}>
          <TextInput id="corp-street" autoComplete="address-line1" placeholder="e.g. 5 Admiralty Way, Lekki Phase 1" invalid={!!e?.street} {...register('entity.street')} />
        </Field>
        <Field label="City / Town" htmlFor="corp-city" error={e?.city?.message}>
          <TextInput id="corp-city" autoComplete="address-level2" placeholder="e.g. Lekki" invalid={!!e?.city} {...register('entity.city')} />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="State" htmlFor="corp-state" error={e?.state?.message}>
            <Select id="corp-state" invalid={!!e?.state} {...register('entity.state', { onChange: () => setValue('entity.lga', '') })}>
              <option value="">Select state…</option>
              {STATES.map((s) => <option key={s} value={s}>{s === 'FCT' ? 'FCT — Abuja' : s}</option>)}
            </Select>
          </Field>
          <Field label="LGA" htmlFor="corp-lga" error={e?.lga?.message}>
            <Select id="corp-lga" disabled={!state} invalid={!!e?.lga} {...register('entity.lga')}>
              <option value="">{state ? 'Select LGA…' : 'Select a state first'}</option>
              {(LGAS[state] ?? []).map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
        </div>
      </fieldset>
    </div>
  );
}

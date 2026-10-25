import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { CalendarClock, Lock, Receipt, ShieldCheck } from 'lucide-react';
import type { CorporateValues } from '../../../registration/corporate/schema';
import { VAT_MANDATORY_THRESHOLD, isVatMandatory } from '../../../registration/corporate/catalog';
import { formatNaira } from '../../../registration/services';
import { Chip, Field, TextInput, Toggle } from '../ui';

const SUPPLIES = [
  { id: 'exempt', label: 'Exempt Goods & Services', hint: 'Basic food items, medical & pharmaceutical, educational materials' },
  { id: 'standard', label: 'Standard Taxable Supplies', hint: 'Charged VAT at 7.5%' },
] as const;

export default function CorpStep4Vat() {
  const { register, control, formState: { errors } } = useFormContext<CorporateValues>();
  const e = errors.vat;
  const [turnover, voluntary] = useWatch({ control, name: ['tax.annualTurnover', 'vat.voluntaryVat'] });
  const mandatory = isVatMandatory(turnover || 0);

  return (
    <div className="space-y-5">
      {/* Threshold indicator */}
      {mandatory ? (
        <div id="corp-vat-indicator" className="flex items-start gap-3 p-4 rounded-xl bg-primary-container text-white">
          <span className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0"><ShieldCheck className="w-5 h-5 text-accent-green" /></span>
          <div>
            <p className="text-sm font-black flex items-center gap-2">Mandatory VAT Registration Required <Lock className="w-3.5 h-3.5 text-accent-green" /></p>
            <p className="text-xs text-white/75">Turnover of {formatNaira(turnover)} meets the {formatNaira(VAT_MANDATORY_THRESHOLD)} statutory threshold. You'll be registered as an active VAT agent.</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div id="corp-vat-indicator" className="flex items-start gap-3 p-4 rounded-xl bg-surface-container-low border border-outline-variant">
            <Receipt className="w-5 h-5 text-primary-container shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-on-surface">Exempt from Mandatory VAT (Turnover &lt; {formatNaira(VAT_MANDATORY_THRESHOLD)})</p>
              <p className="text-xs text-on-surface-variant">You can still register voluntarily.</p>
            </div>
          </div>
          <Controller control={control} name="vat.voluntaryVat" render={({ field }) => (
            <Toggle id="corp-voluntary-vat" checked={field.value} onChange={field.onChange}
              label="Voluntarily register for VAT" description="Recommended for B2B invoicing — lets your customers claim input VAT." />
          )} />
        </div>
      )}

      {/* Supplies */}
      <Controller control={control} name="vat.supplies" render={({ field }) => {
        const toggle = (id: 'exempt' | 'standard') =>
          field.onChange(field.value.includes(id) ? field.value.filter((s) => s !== id) : [...field.value, id]);
        return (
          <fieldset className="space-y-2">
            <legend className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-2">
              Nature of Goods & Services <span className="normal-case font-medium">(select all that apply)</span>
            </legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUPPLIES.map((s) => (
                <Chip key={s.id} id={`corp-supply-${s.id}`} selected={field.value.includes(s.id)} onClick={() => toggle(s.id)} label={s.label} hint={s.hint} />
              ))}
            </div>
            {e?.supplies && <p role="alert" className="text-xs text-error font-medium">{e.supplies.message ?? e.supplies.root?.message}</p>}
          </fieldset>
        );
      }} />

      {(mandatory || voluntary) && (
        <>
          <Field label="Existing VAT Registration Number" htmlFor="corp-vat-number" error={e?.vatNumber?.message} optional
            hint="Only if NRS has already issued one.">
            <TextInput id="corp-vat-number" autoComplete="off" placeholder="Leave blank if not yet issued" className="font-mono uppercase" invalid={!!e?.vatNumber} {...register('vat.vatNumber')} />
          </Field>
          <Field label="Filing Frequency">
            <div id="corp-vat-frequency" className="flex items-center gap-2.5 h-12 px-4 rounded-xl border border-outline-variant bg-surface-container-low text-sm font-bold text-on-surface">
              <CalendarClock className="w-4 h-4 text-accent-green" /> Monthly — due by the 21st of the following month
              <Lock className="w-3.5 h-3.5 ml-auto text-on-surface-variant/60" aria-label="Locked" />
            </div>
          </Field>
        </>
      )}
    </div>
  );
}

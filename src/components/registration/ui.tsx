/**
 * ui.tsx — Small presentational primitives shared by the registration steps.
 * Styled with the app's existing Tailwind theme tokens (light + dark).
 */
import { forwardRef, useRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Check } from 'lucide-react';

export const inputCls =
  'w-full h-12 px-4 bg-background border border-outline rounded-xl text-on-surface text-sm font-semibold placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all disabled:opacity-60 aria-[invalid=true]:border-error';

export function Field({ label, htmlFor, error, hint, children, optional }: {
  label: string; htmlFor?: string; error?: string; hint?: ReactNode; children: ReactNode; optional?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">
        {label} {optional && <span className="normal-case font-medium text-on-surface-variant/60">(optional)</span>}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-error font-medium">{error}</p>
      ) : hint ? (
        <p className="text-[11px] text-on-surface-variant/80">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ invalid, className = '', ...props }, ref) => (
    <input ref={ref} aria-invalid={invalid || undefined} className={`${inputCls} ${className}`} {...props} />
  ),
);
TextInput.displayName = 'TextInput';

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }>(
  ({ invalid, className = '', children, ...props }, ref) => (
    <select ref={ref} aria-invalid={invalid || undefined} className={`${inputCls} cursor-pointer ${className}`} {...props}>
      {children}
    </select>
  ),
);
Select.displayName = 'Select';

export function Toggle({ id, checked, onChange, label, description }: {
  id: string; checked: boolean; onChange: (v: boolean) => void; label: string; description?: string;
}) {
  return (
    <button
      type="button" id={id} role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
      className={`w-full flex items-center justify-between gap-4 p-4 rounded-xl border text-left transition-all cursor-pointer ${
        checked ? 'border-primary-container bg-primary-container/5' : 'border-outline-variant hover:border-outline bg-white'
      }`}
    >
      <span>
        <span className="block text-sm font-bold text-on-surface">{label}</span>
        {description && <span className="block text-[11px] text-on-surface-variant mt-0.5">{description}</span>}
      </span>
      <span className={`relative shrink-0 w-11 h-6 rounded-full transition-colors ${checked ? 'bg-accent-green' : 'bg-outline-variant'}`}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </span>
    </button>
  );
}

export function Chip({ id, selected, onClick, label, hint }: {
  id: string; selected: boolean; onClick: () => void; label: string; hint?: string;
}) {
  return (
    <button
      type="button" id={id} aria-pressed={selected} onClick={onClick}
      className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all cursor-pointer active:scale-[0.98] ${
        selected ? 'border-primary-container bg-primary-container/5 shadow-xs' : 'border-outline-variant bg-white hover:border-outline'
      }`}
    >
      <span className={`mt-0.5 shrink-0 w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
        selected ? 'bg-primary-container border-primary-container' : 'border-outline'
      }`}>
        {selected && <Check className="w-3.5 h-3.5 text-accent-green" />}
      </span>
      <span>
        <span className="block text-sm font-bold text-on-surface">{label}</span>
        {hint && <span className="block text-[11px] text-on-surface-variant mt-0.5 leading-snug">{hint}</span>}
      </span>
    </button>
  );
}

export function Segmented<T extends string>({ name, value, onChange, options }: {
  name: string; value: T; onChange: (v: T) => void; options: { value: T; label: string }[];
}) {
  return (
    <div role="radiogroup" className="bg-surface-container p-1 rounded-xl flex w-full border border-outline-variant/30 gap-1">
      {options.map((o) => (
        <button
          key={o.value} type="button" role="radio" id={`${name}-${o.value}`} aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`flex-1 py-2.5 px-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
            value === o.value ? 'bg-white text-primary-container font-black shadow-xs' : 'text-on-surface-variant hover:text-primary-container'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** 6-box OTP input with paste + backspace navigation. */
export function OtpInput({ value, onChange, idPrefix, disabled }: {
  value: string; onChange: (v: string) => void; idPrefix: string; disabled?: boolean;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const chars = value.padEnd(6, ' ').slice(0, 6).split('');

  const setAt = (i: number, ch: string) => {
    const next = chars.map((c, j) => (j === i ? ch : c)).join('').replace(/\s+$/, '');
    onChange(next.replace(/\s/g, ''));
  };

  return (
    <div className="flex justify-between gap-2" onPaste={(e) => {
      const d = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (d) { e.preventDefault(); onChange(d); refs.current[Math.min(d.length, 5)]?.focus(); }
    }}>
      {chars.map((c, i) => (
        <input
          key={i} id={`${idPrefix}-${i}`} ref={(el) => { refs.current[i] = el; }}
          value={c.trim()} disabled={disabled} inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1} aria-label={`Digit ${i + 1}`} autoFocus={i === 0}
          onChange={(e) => {
            const d = e.target.value.replace(/\D/g, '').slice(-1);
            if (!d) return;
            setAt(i, d);
            refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              if (c.trim()) setAt(i, ' ');
              else if (i > 0) { setAt(i - 1, ' '); refs.current[i - 1]?.focus(); }
            }
          }}
          className="w-11 h-13 sm:w-13 sm:h-14 text-center text-xl font-bold font-mono bg-white border border-outline rounded-xl focus:outline-none focus:border-primary-container focus:ring-1 focus:ring-primary-container transition-all"
        />
      ))}
    </div>
  );
}

export function Stepper({ steps, current, maxReached, onSelect }: {
  steps: string[]; current: number; maxReached: number; onSelect: (i: number) => void;
}) {
  return (
    <nav aria-label="Registration progress" className="w-full">
      <p className="sm:hidden text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">
        Step {current + 1} of {steps.length} · <span className="text-primary-container">{steps[current]}</span>
      </p>
      <div className="sm:hidden h-1.5 rounded-full bg-surface-container overflow-hidden">
        <div className="h-full bg-accent-green transition-all duration-500" style={{ width: `${((current + 1) / steps.length) * 100}%` }} />
      </div>
      <ol className="hidden sm:flex items-center">
        {steps.map((label, i) => {
          const done = i < maxReached && i !== current;
          const reachable = i <= maxReached;
          return (
            <li key={label} className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}>
              <button
                type="button" id={`stepper-${i + 1}`} disabled={!reachable} onClick={() => onSelect(i)}
                aria-current={i === current ? 'step' : undefined}
                className="flex items-center gap-2 group disabled:cursor-not-allowed cursor-pointer"
              >
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                  i === current ? 'bg-primary-container border-primary-container text-white scale-110 shadow'
                    : done ? 'bg-accent-green border-accent-green text-emerald-950'
                    : 'border-outline-variant text-on-surface-variant'
                }`}>
                  {done ? <Check className="w-4 h-4" /> : i + 1}
                </span>
                <span className={`text-xs font-bold hidden md:inline ${i === current ? 'text-primary-container' : 'text-on-surface-variant group-enabled:group-hover:text-primary-container'}`}>
                  {label}
                </span>
              </button>
              {i < steps.length - 1 && (
                <span className="flex-1 h-0.5 mx-3 rounded-full bg-outline-variant overflow-hidden">
                  <span className="block h-full bg-accent-green transition-all duration-500" style={{ width: i < maxReached ? '100%' : '0%' }} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

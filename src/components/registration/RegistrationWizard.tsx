/**
 * RegistrationWizard.tsx — 5-step individual (PIT) onboarding wizard.
 *
 * Route: /register
 *  - One react-hook-form instance; the resolver validates only the active step.
 *  - Progress (values, step, verification state) is auto-saved to sessionStorage.
 *  - Step 1 is gated by a real email OTP + a simulated phone OTP.
 *  - Submit writes a masked profile to users/{email}.profile and signs the user in.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'motion/react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Lock, Save, CheckCircle2 } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useAppContext } from '../../AppShell';
import { upsertUser } from '../../utils/authStore';
import {
  DEFAULT_VALUES, STEP_KEYS, STEP_SCHEMAS, buildPayload, individualRegistrationSchema, maskPayload,
  type RegistrationValues,
} from '../../registration/schema';
import { Stepper } from './ui';
import Step1Credentials from './Step1Credentials';
import VerifyPanel from './VerifyPanel';
import Step2Identity from './Step2Identity';
import Step3Income from './Step3Income';
import Step4Reliefs from './Step4Reliefs';
import Step5Payout from './Step5Payout';

export const REGISTRATION_STORAGE_KEY = 'diytax9ja_individual_registration_v1';

const STEPS = [
  { title: 'Account', heading: 'Create your account', sub: 'Your login details and data-processing consent.' },
  { title: 'Identity', heading: 'Identity & jurisdiction', sub: 'Your NIN and where you lived on 1 January determine which tax authority assesses you.' },
  { title: 'Income', heading: 'How do you earn?', sub: 'This decides whether you file under PAYE or Direct Assessment.' },
  { title: 'Reliefs', heading: 'Statutory reliefs', sub: 'Pre-screen the deductions that legally reduce your taxable income.' },
  { title: 'Payout', heading: 'Payout & confirmation', sub: 'Where refunds go, and a final check of your tax profile.' },
];

interface Persisted {
  values: RegistrationValues;
  step: number;
  maxStep: number;
  verifiedEmail: string;
  verifiedPhone: string;
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = sessionStorage.getItem(REGISTRATION_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<Persisted>;
    // Merge section-by-section so new fields get defaults after schema changes.
    const values = Object.fromEntries(
      STEP_KEYS.map((k) => [k, { ...DEFAULT_VALUES[k], ...(p.values?.[k] ?? {}) }]),
    ) as RegistrationValues;
    return { ...p, values };
  } catch {
    return {};
  }
}

export default function RegistrationWizard() {
  const { session, setSessionFromRegistration } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const initial = useMemo(loadPersisted, []);

  const [step, setStep] = useState(initial.step ?? 0);
  const [maxStep, setMaxStep] = useState(initial.maxStep ?? 0);
  const [direction, setDirection] = useState(1);
  const [verifiedEmail, setVerifiedEmail] = useState(initial.verifiedEmail ?? '');
  const [verifiedPhone, setVerifiedPhone] = useState(initial.verifiedPhone ?? '');
  const [verifying, setVerifying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const stepRef = useRef(step);
  stepRef.current = step;

  // Resolver delegates to the active step's schema.
  const resolver = useCallback<Resolver<RegistrationValues>>(
    (values, ctx, opts) => zodResolver(STEP_SCHEMAS[stepRef.current] as never)(values, ctx, opts as never) as never,
    [],
  );

  const prefillEmail = (location.state as { email?: string } | null)?.email;
  const form = useForm<RegistrationValues>({
    resolver,
    mode: 'onTouched',
    defaultValues: initial.values ?? {
      ...DEFAULT_VALUES,
      auth: { ...DEFAULT_VALUES.auth, email: prefillEmail ?? '' },
    },
  });
  const { handleSubmit, watch, getValues, setFocus } = form;

  // ─── Auto-save (debounced) ─────────────────────────────────────────
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const persist = () => {
      const data: Persisted = { values: getValues(), step: stepRef.current, maxStep, verifiedEmail, verifiedPhone };
      sessionStorage.setItem(REGISTRATION_STORAGE_KEY, JSON.stringify(data));
      setSavedAt(Date.now());
    };
    persist();
    const sub = watch(() => { clearTimeout(t); t = setTimeout(persist, 400); });
    return () => { clearTimeout(t); sub.unsubscribe(); };
  }, [watch, getValues, step, maxStep, verifiedEmail, verifiedPhone]);

  const goTo = (i: number) => {
    if (i > maxStep || i === step) return;
    setDirection(i > step ? 1 : -1);
    setStep(i);
    setVerifying(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const advance = () => {
    const next = step + 1;
    setDirection(1);
    setStep(next);
    setMaxStep((m) => Math.max(m, next));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const focusFirstError = () => {
    const errs = form.formState.errors[STEP_KEYS[stepRef.current]] as Record<string, unknown> | undefined;
    const first = errs && Object.keys(errs)[0];
    if (first) { try { setFocus(`${STEP_KEYS[stepRef.current]}.${first}` as never); } catch { /* non-focusable */ } }
  };

  const finalSubmit = async (values: RegistrationValues) => {
    const full = individualRegistrationSchema.safeParse(values);
    if (!full.success) {
      const firstBad = STEP_KEYS.findIndex((k) => full.error.issues.some((i) => i.path[0] === k));
      setSubmitError('Some earlier details need attention.');
      if (firstBad >= 0) goTo(firstBad);
      return;
    }
    setSubmitting(true); setSubmitError('');
    const payload = buildPayload(full.data);
    const masked = maskPayload(payload);
    const fullName = `${payload.auth.firstName} ${payload.auth.lastName}`;
    try {
      await setDoc(doc(db, 'users', payload.auth.email), {
        profile: { ...masked, completedAt: new Date().toISOString(), version: 1 },
        isNINLinked: true,
        nin: masked.identity.nin,
      }, { merge: true });
    } catch (err: any) {
      if (!import.meta.env.DEV) {
        setSubmitting(false);
        setSubmitError(`We couldn't save your profile (${err?.code || err?.message || 'network error'}). Please try again.`);
        return;
      }
      console.warn('[Registration] Firestore write skipped in dev:', err?.message);
    }
    upsertUser(payload.auth.email, fullName, 'individual', 'taxpayer');
    sessionStorage.removeItem(REGISTRATION_STORAGE_KEY);
    setSessionFromRegistration({ email: payload.auth.email, fullName, maskedNin: masked.identity.nin });
    navigate('/dashboard', { replace: true });
  };

  const onPrimary = handleSubmit(
    async (values) => {
      if (step === 0) {
        const email = values.auth.email.trim().toLowerCase();
        if (verifiedEmail === email && verifiedPhone === values.auth.phone) return advance();
        setVerifying(true);
        return;
      }
      if (step < STEPS.length - 1) return advance();
      // The step resolver strips other sections from `values`, so validate the full form state.
      await finalSubmit(getValues());
    },
    () => setTimeout(focusFirstError, 0),
  );

  if (session.isVerified) return <Navigate to="/dashboard" replace />;

  const values = getValues();
  const [wEmail = '', wPhone = ''] = watch(['auth.email', 'auth.phone']);
  const normEmail = wEmail.trim().toLowerCase();
  const isStep1Verified = verifiedEmail === normEmail && verifiedPhone === wPhone;
  const current = STEPS[step];
  const StepBody = [Step1Credentials, Step2Identity, Step3Income, Step4Reliefs][step];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="flex-grow w-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-outline-variant">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button type="button" id="reg-exit" onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer" aria-label="Back to home">
            <svg viewBox="0 0 200 200" className="w-8 h-8" aria-hidden>
              <rect width="200" height="200" rx="44" fill="#013220" />
              <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white" />
              <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <span className="font-extrabold text-lg text-primary-container tracking-tight">DIYtax9ja</span>
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" aria-live="polite">
            {savedAt ? <><Save className="w-3.5 h-3.5 text-accent-green" /> Progress saved</> : null}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <Stepper steps={STEPS.map((s) => s.title)} current={step} maxReached={maxStep} onSelect={goTo} />

        <FormProvider {...form}>
          <form noValidate onSubmit={onPrimary}
            className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 sm:p-8">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div key={`${step}-${verifying}`} custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}>
                  {step === 0 && verifying ? (
                    <VerifyPanel
                      email={normEmail}
                      phone={wPhone}
                      fullName={`${values.auth.firstName.trim()} ${values.auth.lastName.trim()}`}
                      emailAlreadyVerified={verifiedEmail === normEmail}
                      onEmailVerified={() => setVerifiedEmail(normEmail)}
                      onPhoneVerified={() => { setVerifiedPhone(wPhone); setVerifying(false); advance(); }}
                      onEdit={() => setVerifying(false)}
                    />
                  ) : (
                    <>
                      <div className="mb-6">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-accent-green">Step {step + 1} of {STEPS.length}</p>
                        <h1 className="text-2xl font-black text-primary-container tracking-tight mt-1">{current.heading}</h1>
                        <p className="text-sm text-on-surface-variant mt-1">{current.sub}</p>
                      </div>
                      {step === 4 ? <Step5Payout onEditStep={goTo} /> : <StepBody />}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>

              {submitError && <p role="alert" className="mt-5 text-xs text-error font-medium">{submitError}</p>}
            </div>

            {!(step === 0 && verifying) && (
              <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-surface-container-low border-t border-outline-variant">
                {step > 0 ? (
                  <button type="button" id="reg-back" onClick={() => goTo(step - 1)}
                    className="h-12 px-5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <button type="button" id="reg-signin" onClick={() => navigate('/')}
                    className="text-xs font-bold text-primary-container hover:underline cursor-pointer">
                    Already registered? Sign in
                  </button>
                )}
                <button type="submit" id="reg-continue" disabled={submitting}
                  className="h-12 px-6 rounded-xl bg-primary-container text-white text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer">
                  {submitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : step === STEPS.length - 1 ? <><CheckCircle2 className="w-4 h-4 text-accent-green" /> Complete registration</>
                    : step === 0 && !isStep1Verified
                      ? <>Verify & continue <ArrowRight className="w-4 h-4 text-accent-green" /></>
                      : <>Save & continue <ArrowRight className="w-4 h-4 text-accent-green" /></>}
                </button>
              </div>
            )}
          </form>
        </FormProvider>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant/70 text-center">
          <Lock className="w-3.5 h-3.5" /> Encrypted in transit. NIN, TIN and account numbers are stored masked.
        </p>
      </main>
    </motion.div>
  );
}

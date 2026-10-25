/**
 * CorporateWizard.tsx — 5-step corporate (CIT / VAT) onboarding wizard.
 *
 * Route: /register/business
 *  - One react-hook-form instance; the resolver validates only the active step.
 *  - Progress is auto-saved to sessionStorage.
 *  - Step 2 (signatory) is gated by a real email OTP + simulated SMS/WhatsApp OTP.
 *  - Submit writes a masked profile to users/{email}.profile and signs in as 'business'.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FormProvider, useForm, type Resolver } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { motion, AnimatePresence } from 'motion/react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, CheckCircle2, Lock, Save } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAppContext } from '../../../AppShell';
import { upsertUser } from '../../../utils/authStore';
import {
  CORP_DEFAULT_VALUES, CORP_STEP_KEYS, CORP_STEP_SCHEMAS, buildCorporatePayload, corporateTaxRegistrationSchema,
  maskCorporatePayload, type CorporateValues,
} from '../../../registration/corporate/schema';
import { Stepper } from '../ui';
import VerifyPanel from '../VerifyPanel';
import CorpStep1Entity from './CorpStep1Entity';
import CorpStep2Signatory from './CorpStep2Signatory';
import CorpStep3Classification from './CorpStep3Classification';
import CorpStep4Vat from './CorpStep4Vat';
import CorpStep5Settlement from './CorpStep5Settlement';

export const CORPORATE_STORAGE_KEY = 'diytax9ja_corporate_registration_v1';

const STEPS = [
  { title: 'Entity', heading: 'Corporate entity', sub: 'Incorporation details as registered with the CAC.' },
  { title: 'Signatory', heading: 'Authorised signatory', sub: 'The officer who files on behalf of the entity. We verify their identity and contact details.' },
  { title: 'CIT', heading: 'CIT classification', sub: 'Turnover, assets and sector determine your Company Income Tax bracket.' },
  { title: 'VAT', heading: 'VAT profile', sub: 'We check your VAT obligations against the statutory threshold.' },
  { title: 'Settlement', heading: 'Settlement & activation', sub: 'Corporate account for refunds and remittances, and a final review.' },
];

const SIGNATORY_STEP = 1;

interface Persisted {
  values: CorporateValues;
  step: number;
  maxStep: number;
  verifiedEmail: string;
  verifiedPhone: string;
}

function loadPersisted(): Partial<Persisted> {
  try {
    const raw = sessionStorage.getItem(CORPORATE_STORAGE_KEY);
    if (!raw) return {};
    const p = JSON.parse(raw) as Partial<Persisted>;
    const values = Object.fromEntries(
      CORP_STEP_KEYS.map((k) => [k, { ...CORP_DEFAULT_VALUES[k], ...(p.values?.[k] ?? {}) }]),
    ) as CorporateValues;
    return { ...p, values };
  } catch {
    return {};
  }
}

export default function CorporateWizard() {
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

  const resolver = useCallback<Resolver<CorporateValues>>(
    (values, ctx, opts) => zodResolver(CORP_STEP_SCHEMAS[stepRef.current] as never)(values, ctx, opts as never) as never,
    [],
  );

  const prefillEmail = (location.state as { email?: string } | null)?.email;
  const form = useForm<CorporateValues>({
    resolver,
    mode: 'onTouched',
    defaultValues: initial.values ?? {
      ...CORP_DEFAULT_VALUES,
      signatory: { ...CORP_DEFAULT_VALUES.signatory, email: prefillEmail ?? '' },
    },
  });
  const { handleSubmit, watch, getValues, setFocus } = form;

  // ─── Auto-save (debounced) ─────────────────────────────────────────
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const persist = () => {
      const data: Persisted = { values: getValues(), step: stepRef.current, maxStep, verifiedEmail, verifiedPhone };
      sessionStorage.setItem(CORPORATE_STORAGE_KEY, JSON.stringify(data));
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
    const key = CORP_STEP_KEYS[stepRef.current];
    const errs = form.formState.errors[key] as Record<string, unknown> | undefined;
    const first = errs && Object.keys(errs)[0];
    if (first) { try { setFocus(`${key}.${first}` as never); } catch { /* non-focusable */ } }
  };

  const finalSubmit = async (values: CorporateValues) => {
    const full = corporateTaxRegistrationSchema.safeParse(values);
    if (!full.success) {
      const firstBad = CORP_STEP_KEYS.findIndex((k) => full.error.issues.some((i) => i.path[0] === k));
      setSubmitError('Some earlier details need attention.');
      if (firstBad >= 0) goTo(firstBad);
      return;
    }
    setSubmitting(true); setSubmitError('');
    const payload = buildCorporatePayload(full.data);
    const masked = maskCorporatePayload(payload);
    const email = payload.signatory.email;
    try {
      await setDoc(doc(db, 'users', email), {
        profile: { ...masked, kind: 'corporate', completedAt: new Date().toISOString(), version: 1 },
        isNINLinked: true,
        nin: masked.signatory.nin,
      }, { merge: true });
    } catch (err: any) {
      if (!import.meta.env.DEV) {
        setSubmitting(false);
        setSubmitError(`We couldn't save your profile (${err?.code || err?.message || 'network error'}). Please try again.`);
        return;
      }
      console.warn('[CorporateRegistration] Firestore write skipped in dev:', err?.message);
    }
    upsertUser(email, payload.entity.companyName, 'business', 'taxpayer');
    sessionStorage.removeItem(CORPORATE_STORAGE_KEY);
    setSessionFromRegistration({ email, fullName: payload.entity.companyName, maskedNin: masked.signatory.nin, accountType: 'business' });
    navigate('/dashboard', { replace: true });
  };

  const [wEmail = '', wPhone = '', wOfficer = '', wCompany = ''] = watch(['signatory.email', 'signatory.phone', 'signatory.fullName', 'entity.companyName']);
  const normEmail = wEmail.trim().toLowerCase();
  const isSignatoryVerified = verifiedEmail === normEmail && verifiedPhone === wPhone;

  const onPrimary = handleSubmit(
    async () => {
      if (step === SIGNATORY_STEP && !isSignatoryVerified) { setVerifying(true); return; }
      if (step < STEPS.length - 1) return advance();
      // The step resolver strips other sections, so validate the full form state.
      await finalSubmit(getValues());
    },
    () => setTimeout(focusFirstError, 0),
  );

  if (session.isVerified) return <Navigate to="/dashboard" replace />;

  const current = STEPS[step];
  const StepBody = [CorpStep1Entity, CorpStep2Signatory, CorpStep3Classification, CorpStep4Vat][step];
  const showVerify = step === SIGNATORY_STEP && verifying;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex-grow w-full bg-background">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-outline-variant">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <button type="button" id="corp-exit" onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer" aria-label="Back to home">
            <svg viewBox="0 0 200 200" className="w-8 h-8" aria-hidden>
              <rect width="200" height="200" rx="44" fill="#013220" />
              <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white" />
              <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round" />
            </svg>
            <span className="font-extrabold text-lg text-primary-container tracking-tight">DIYtax9ja</span>
            <span className="hidden sm:inline text-[10px] font-black uppercase tracking-widest text-on-surface-variant border border-outline-variant rounded-full px-2 py-0.5 ml-1">Business</span>
          </button>
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-on-surface-variant" aria-live="polite">
            {savedAt ? <><Save className="w-3.5 h-3.5 text-accent-green" /> Progress saved</> : null}
          </span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
        <Stepper steps={STEPS.map((s) => s.title)} current={step} maxReached={maxStep} onSelect={goTo} />

        <FormProvider {...form}>
          <form noValidate onSubmit={onPrimary} className="bg-white border border-outline-variant rounded-2xl shadow-sm overflow-hidden">
            <div className="p-5 sm:p-8">
              <AnimatePresence mode="wait" custom={direction} initial={false}>
                <motion.div key={`${step}-${verifying}`} custom={direction}
                  initial={{ opacity: 0, x: direction * 32 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -32 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}>
                  {showVerify ? (
                    <VerifyPanel
                      email={normEmail}
                      phone={wPhone}
                      fullName={wCompany || wOfficer}
                      accountType="business"
                      unlockLabel="Verify & continue to CIT"
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
                      {step === 4 ? <CorpStep5Settlement onEditStep={goTo} /> : <StepBody />}
                    </>
                  )}
                </motion.div>
              </AnimatePresence>
              {submitError && <p role="alert" className="mt-5 text-xs text-error font-medium">{submitError}</p>}
            </div>

            {!showVerify && (
              <div className="flex items-center justify-between gap-3 px-5 sm:px-8 py-4 bg-surface-container-low border-t border-outline-variant">
                {step > 0 ? (
                  <button type="button" id="corp-back" onClick={() => goTo(step - 1)}
                    className="h-12 px-5 rounded-xl border border-outline-variant text-sm font-bold text-on-surface hover:bg-surface-container transition-all flex items-center gap-2 cursor-pointer">
                    <ArrowLeft className="w-4 h-4" /> Back
                  </button>
                ) : (
                  <button type="button" id="corp-signin" onClick={() => navigate('/')} className="text-xs font-bold text-primary-container hover:underline cursor-pointer">
                    Already registered? Sign in
                  </button>
                )}
                <button type="submit" id="corp-continue" disabled={submitting}
                  className="h-12 px-6 rounded-xl bg-primary-container text-white text-sm font-bold hover:opacity-95 active:scale-[0.98] transition-all flex items-center gap-2 shadow-xs disabled:opacity-60 cursor-pointer">
                  {submitting ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    : step === STEPS.length - 1 ? <><CheckCircle2 className="w-4 h-4 text-accent-green" /> Activate account</>
                    : step === SIGNATORY_STEP && !isSignatoryVerified ? <>Verify & continue <ArrowRight className="w-4 h-4 text-accent-green" /></>
                    : <>Save & continue <ArrowRight className="w-4 h-4 text-accent-green" /></>}
                </button>
              </div>
            )}
          </form>
        </FormProvider>

        <p className="flex items-center justify-center gap-1.5 text-[11px] text-on-surface-variant/70 text-center">
          <Lock className="w-3.5 h-3.5" /> Encrypted in transit. Signatory NIN and account numbers are stored masked.
        </p>
      </main>
    </motion.div>
  );
}

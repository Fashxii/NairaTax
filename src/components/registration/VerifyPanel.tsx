/**
 * VerifyPanel.tsx — Inline Step 1 verification gate.
 *  1. Email OTP  — real, via the existing Cloud Function (sendOTP / verifyOTP).
 *  2. Phone OTP  — simulated SMS / WhatsApp delivery (no SMS provider yet).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, MessageCircle, Smartphone, RefreshCw, Pencil, CheckCircle2 } from 'lucide-react';
import { sendOTPEmail, verifyOTP, listenForDevOTP } from '../../utils/otpService';
import { generatePhoneOtp, formatPhone } from '../../registration/services';
import { OtpInput, Segmented } from './ui';

interface Props {
  email: string;
  phone: string;
  fullName: string;
  emailAlreadyVerified: boolean;
  onEmailVerified: () => void;
  onPhoneVerified: () => void;
  onEdit: () => void;
  /** Account type recorded when the OTP request creates the user. */
  accountType?: 'individual' | 'business';
  /** Label for the final phone-verification button. */
  unlockLabel?: string;
}

const RESEND_SECONDS = 45;

export default function VerifyPanel({ email, phone, fullName, emailAlreadyVerified, onEmailVerified, onPhoneVerified, onEdit, accountType = 'individual', unlockLabel = 'Verify & unlock Step 2' }: Props) {
  const [phase, setPhase] = useState<'email' | 'phone'>(emailAlreadyVerified ? 'phone' : 'email');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [channel, setChannel] = useState<'sms' | 'whatsapp'>('whatsapp');
  const [simCode, setSimCode] = useState<string | null>(null);
  const sentFor = useRef<string | null>(null);

  useEffect(() => listenForDevOTP(setDevCode), []);

  useEffect(() => {
    if (timeLeft <= 0) return;
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft]);

  const sendEmail = async () => {
    setBusy(true); setError(''); setCode('');
    try {
      const res = await sendOTPEmail(email, fullName, accountType);
      if (!res.success) throw new Error(res.message || 'Could not send the verification code.');
      setNotice(res.isNewRegistration === false && res.registered
        ? 'This email already has an account — verifying will sign you in and update your tax profile.'
        : '');
      setTimeLeft(RESEND_SECONDS);
    } catch (err: any) {
      setError(err?.message || 'Could not send the verification code. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendPhone = () => {
    setError(''); setCode('');
    setSimCode(generatePhoneOtp());
    setTimeLeft(RESEND_SECONDS);
  };

  // Auto-dispatch the first code for each phase.
  useEffect(() => {
    const key = `${phase}:${phase === 'email' ? email : phone}`;
    if (sentFor.current === key) return;
    sentFor.current = key;
    if (phase === 'email') void sendEmail(); else sendPhone();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, email, phone]);

  const submit = async () => {
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setError('');
    if (phase === 'email') {
      setBusy(true);
      const res = await verifyOTP(email, code).catch(() => ({ valid: false, error: 'Verification service error. Please try again.' }));
      setBusy(false);
      if (!res.valid) { setError(res.error || 'Invalid code.'); return; }
      onEmailVerified();
      setPhase('phone');
      setTimeLeft(0);
    } else {
      if (code !== simCode) { setError('That code does not match. Check the simulated message below.'); return; }
      onPhoneVerified();
    }
  };

  const isEmail = phase === 'email';

  return (
    <div className="space-y-5">
      {/* Progress pills */}
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${isEmail ? 'bg-primary-container text-white' : 'bg-accent-green/20 text-primary-container'}`}>
          {isEmail ? <Mail className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />} Email
        </span>
        <span className="h-px w-6 bg-outline-variant" />
        <span className={`flex items-center gap-1 px-2.5 py-1 rounded-full ${!isEmail ? 'bg-primary-container text-white' : 'bg-surface-container text-on-surface-variant'}`}>
          <Smartphone className="w-3 h-3" /> Phone
        </span>
      </div>

      <div>
        <h3 className="text-lg font-extrabold text-primary-container">
          {isEmail ? 'Confirm your email' : 'Confirm your mobile number'}
        </h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Enter the 6-digit code sent to{' '}
          <span className="font-bold text-on-surface">{isEmail ? email : `+234 ${formatPhone(phone)}`}</span>
          <button type="button" id="verify-edit-details" onClick={onEdit} className="ml-2 inline-flex items-center gap-1 font-bold text-primary-container hover:underline cursor-pointer">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        </p>
      </div>

      {notice && isEmail && (
        <p className="text-xs font-medium text-emerald-900 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2">{notice}</p>
      )}

      {!isEmail && (
        <Segmented name="otp-channel" value={channel} onChange={(c) => { setChannel(c); sendPhone(); }}
          options={[{ value: 'whatsapp', label: 'WhatsApp' }, { value: 'sms', label: 'SMS' }]} />
      )}

      {/* Simulated delivery / dev helper */}
      <AnimatePresence>
        {!isEmail && simCode && (
          <motion.div key={simCode} initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 p-3.5 rounded-xl border border-dashed border-amber-400 bg-amber-50 text-left">
            <MessageCircle className="w-4 h-4 text-amber-700 mt-0.5 shrink-0" />
            <div className="text-xs text-amber-900">
              <p className="font-bold uppercase tracking-wider text-[10px] text-amber-700">Simulated {channel === 'sms' ? 'SMS' : 'WhatsApp'} delivery</p>
              <p className="mt-0.5">DIYtax9ja: Your verification code is <span className="font-mono font-black tracking-widest">{simCode}</span>. Do not share it.</p>
            </div>
          </motion.div>
        )}
        {isEmail && devCode && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs text-amber-900 bg-amber-50 border border-amber-400 rounded-lg px-3 py-2">
            🔧 Dev mode (no email server): code <span className="font-mono font-black tracking-widest">{devCode}</span>
          </motion.p>
        )}
      </AnimatePresence>

      <OtpInput key={phase} idPrefix={`otp-${phase}`} value={code} onChange={(v) => { setCode(v); if (error) setError(''); }} disabled={busy} />

      {error && <p role="alert" className="text-xs text-error font-medium">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs font-semibold text-on-surface-variant">
          {timeLeft > 0 ? (
            <span>Resend in 0:{String(timeLeft).padStart(2, '0')}</span>
          ) : (
            <button type="button" id="verify-resend" disabled={busy} onClick={() => (isEmail ? sendEmail() : sendPhone())}
              className="inline-flex items-center gap-1 font-bold text-primary-container hover:underline cursor-pointer disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" /> Resend code
            </button>
          )}
        </div>
        <button type="button" id="verify-submit" onClick={submit} disabled={busy || code.length !== 6}
          className="h-12 px-6 bg-primary-container text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
          {busy ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : isEmail ? 'Verify email' : unlockLabel}
        </button>
      </div>
    </div>
  );
}

/**
 * VerifyPanel.tsx — Inline email verification gate.
 * Email OTP is real, via the existing Cloud Function (sendOTP / verifyOTP).
 * The phone number is recorded as unverified contact info (no SMS provider yet).
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Smartphone, RefreshCw, Pencil } from 'lucide-react';
import { sendOTPEmail, verifyOTP, listenForDevOTP } from '../../utils/otpService';
import { formatPhone } from '../../registration/services';
import { OtpInput } from './ui';

interface Props {
  email: string;
  /** 10 digits after +234 — shown for reference only; it is not verified. */
  phone: string;
  fullName: string;
  onVerified: () => void;
  onEdit: () => void;
  /** Account type recorded when the OTP request creates the user. */
  accountType?: 'individual' | 'business';
  /** Label for the verify button. */
  unlockLabel?: string;
}

const RESEND_SECONDS = 45;

export default function VerifyPanel({ email, phone, fullName, onVerified, onEdit, accountType = 'individual', unlockLabel = 'Verify & unlock Step 2' }: Props) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [devCode, setDevCode] = useState<string | null>(null);
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

  // Auto-dispatch the first code for each email address.
  useEffect(() => {
    if (sentFor.current === email) return;
    sentFor.current = email;
    void sendEmail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email]);

  const submit = async () => {
    if (code.length !== 6) { setError('Enter the full 6-digit code.'); return; }
    setError('');
    setBusy(true);
    const res = await verifyOTP(email, code).catch(() => ({ valid: false, error: 'Verification service error. Please try again.' }));
    setBusy(false);
    if (!res.valid) { setError(res.error || 'Invalid code.'); return; }
    onVerified();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider">
        <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-primary-container text-white">
          <Mail className="w-3 h-3" /> Email verification
        </span>
      </div>

      <div>
        <h3 className="text-lg font-extrabold text-primary-container">Confirm your email</h3>
        <p className="text-xs text-on-surface-variant mt-1">
          Enter the 6-digit code sent to{' '}
          <span className="font-bold text-on-surface">{email}</span>
          <button type="button" id="verify-edit-details" onClick={onEdit} className="ml-2 inline-flex items-center gap-1 font-bold text-primary-container hover:underline cursor-pointer">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        </p>
        {phone && (
          <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant mt-1.5">
            <Smartphone className="w-3 h-3" /> Phone <span className="font-bold text-on-surface">+234 {formatPhone(phone)}</span> is saved as a contact number (not verified).
          </p>
        )}
      </div>

      {notice && (
        <p className="text-xs font-medium text-emerald-900 bg-emerald-50/70 border border-emerald-200 rounded-lg px-3 py-2">{notice}</p>
      )}

      {/* Dev helper (no email server configured locally) */}
      <AnimatePresence>
        {devCode && (
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="text-xs text-amber-900 bg-amber-50 border border-amber-400 rounded-lg px-3 py-2">
            🔧 Dev mode (no email server): code <span className="font-mono font-black tracking-widest">{devCode}</span>
          </motion.p>
        )}
      </AnimatePresence>

      <OtpInput idPrefix="otp-email" value={code} onChange={(v) => { setCode(v); if (error) setError(''); }} disabled={busy} />

      {error && <p role="alert" className="text-xs text-error font-medium">{error}</p>}

      <div className="flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-xs font-semibold text-on-surface-variant">
          {timeLeft > 0 ? (
            <span>Resend in 0:{String(timeLeft).padStart(2, '0')}</span>
          ) : (
            <button type="button" id="verify-resend" disabled={busy} onClick={() => void sendEmail()}
              className="inline-flex items-center gap-1 font-bold text-primary-container hover:underline cursor-pointer disabled:opacity-50">
              <RefreshCw className="w-3.5 h-3.5" /> Resend code
            </button>
          )}
        </div>
        <button type="button" id="verify-submit" onClick={submit} disabled={busy || code.length !== 6}
          className="h-12 px-6 bg-primary-container text-white font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center cursor-pointer">
          {busy ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : unlockLabel}
        </button>
      </div>
    </div>
  );
}

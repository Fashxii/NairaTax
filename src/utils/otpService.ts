/**
 * otpService.ts — Firebase Cloud Function–Backed OTP Client SDK
 *
 * In production (Firebase Hosting):
 *   - POST /api/auth/otp/send  → routes to Firebase Cloud Function `sendOTP`
 *   - POST /api/auth/otp/verify → routes to Firebase Cloud Function `verifyOTP`
 *   - OTP is generated server-side, hashed in Firestore, delivered by Nodemailer
 *
 * In local development (npm run dev):
 *   - Falls back to sessionStorage + console display of code
 *   - Use code '123456' or whatever is shown in the browser console
 */

// ─── Broadcast for in-app display of dev OTP ─────────────────────────
// A custom event is dispatched so the Verification page can show the code
// on-screen when no real email provider is connected (local dev only).
const OTP_DEV_EVENT = 'dev-otp-ready';

export function listenForDevOTP(cb: (code: string) => void): () => void {
  const handler = (e: Event) => {
    const code = (e as CustomEvent<string>).detail;
    cb(code);
  };
  window.addEventListener(OTP_DEV_EVENT, handler);
  return () => window.removeEventListener(OTP_DEV_EVENT, handler);
}

// ─── Send OTP ─────────────────────────────────────────────────────────

export async function sendOTPEmail(
  email: string,
  fullName?: string,
  accountType?: string
): Promise<boolean> {
  try {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, fullName, accountType }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || 'Failed to dispatch verification code.');
    }

    return true;
  } catch (err: any) {
    // ── Local Dev Fallback ──────────────────────────────────────────
    // Server is not running (pure Vite dev server). Store OTP locally
    // and display it on-screen so you can test without a real email.
    console.warn('[OTP] Running in local dev mode — no server available:', err.message);

    const key = email.toLowerCase().trim();
    const devCode = Math.floor(100000 + Math.random() * 900000).toString();

    sessionStorage.setItem(`dev_otp_${key}`, JSON.stringify({
      code: devCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    }));

    // Broadcast so Verification page can display the code on screen
    window.dispatchEvent(new CustomEvent<string>(OTP_DEV_EVENT, { detail: devCode }));

    console.log(`\n══════════════════════════════════════════`);
    console.log(`  DIYtax9ja OTP (Local Dev Mode)`);
    console.log(`  Email : ${email}`);
    console.log(`  Code  : ${devCode}`);
    console.log(`  Expires in 5 minutes`);
    console.log(`══════════════════════════════════════════\n`);

    return true;
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────

export async function verifyOTP(
  email: string,
  enteredCode: string
): Promise<{ valid: boolean; error?: string; user?: any }> {
  try {
    const res = await fetch('/api/auth/otp/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code: enteredCode }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      return { valid: false, error: data.error || 'Verification failed.' };
    }

    return { valid: true, user: data.user };
  } catch (err: any) {
    // ── Local Dev Fallback ──────────────────────────────────────────
    console.warn('[OTP] Running in local dev mode — verifying via sessionStorage:', err.message);

    const key = email.toLowerCase().trim();
    const raw = sessionStorage.getItem(`dev_otp_${key}`);

    if (!raw) {
      return { valid: false, error: 'No verification code found. Please request a new one.' };
    }

    const stored = JSON.parse(raw);

    if (Date.now() > stored.expiresAt) {
      sessionStorage.removeItem(`dev_otp_${key}`);
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }

    if (stored.attempts >= 5) {
      sessionStorage.removeItem(`dev_otp_${key}`);
      return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
    }

    if (stored.code !== enteredCode.trim()) {
      stored.attempts += 1;
      sessionStorage.setItem(`dev_otp_${key}`, JSON.stringify(stored));
      const left = 5 - stored.attempts;
      return { valid: false, error: `Invalid code. ${left} attempt${left !== 1 ? 's' : ''} remaining.` };
    }

    sessionStorage.removeItem(`dev_otp_${key}`);
    return { valid: true };
  }
}

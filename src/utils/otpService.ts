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
import { auth, signInWithCustomToken } from '../lib/firebase';
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

import { findUserByEmail, upsertUser } from './authStore';

export interface SendOTPResult {
  success: boolean;
  registered?: boolean;
  needsRegistration?: boolean;
  isNewRegistration?: boolean;
  message?: string;
  error?: string;
  user?: {
    email: string;
    fullName?: string;
    accountType?: string;
    role?: string;
    isNINLinked?: boolean;
    nin?: string;
  };
}

export async function sendOTPEmail(
  email: string,
  fullName?: string,
  accountType?: string
): Promise<SendOTPResult> {
  const cleanEmail = email.toLowerCase().trim();

  try {
    const res = await fetch('/api/auth/otp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, fullName, accountType }),
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(data.error || 'Failed to dispatch verification code.');
    }

    if (data.user?.fullName) {
      upsertUser(
        cleanEmail,
        data.user.fullName,
        (data.user.accountType as any) || 'individual',
        (data.user.role as any) || 'taxpayer'
      );
    }

    return {
      success: data.success !== false,
      registered: data.registered ?? true,
      needsRegistration: data.needsRegistration ?? false,
      isNewRegistration: data.isNewRegistration ?? false,
      message: data.message,
      user: data.user,
    };
  } catch (err: any) {
    // In production, never fake a dispatch — surface the real error.
    if (!import.meta.env.DEV) {
      console.error('[OTP] sendOTP failed:', err.message);
      throw err;
    }

    // ── Local Dev Fallback (npm run dev only) ───────────────────────
    console.warn('[OTP] Running in local dev mode — no server available:', err.message);

    const existingUser = findUserByEmail(cleanEmail);

    if (!existingUser && !fullName) {
      return {
        success: false,
        registered: false,
        needsRegistration: true,
        message: 'No registered account found with this email. Please enter your full name to register.',
      };
    }

const devOtpMemoryStore = new Map<string, string>();

function setDevOtp(key: string, value: string) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(key, value);
  } else {
    devOtpMemoryStore.set(key, value);
  }
}

function getDevOtp(key: string): string | null {
  if (typeof sessionStorage !== 'undefined') {
    return sessionStorage.getItem(key);
  }
  return devOtpMemoryStore.get(key) || null;
}

function removeDevOtp(key: string) {
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem(key);
  } else {
    devOtpMemoryStore.delete(key);
  }
}

    const resolvedUser = existingUser || upsertUser(cleanEmail, fullName || cleanEmail.split('@')[0], (accountType as any) || 'individual');

    const devCode = Math.floor(100000 + Math.random() * 900000).toString();

    setDevOtp(`dev_otp_${cleanEmail}`, JSON.stringify({
      code: devCode,
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    }));

    // Broadcast so Verification page can display the code on screen
    if (typeof window !== 'undefined' && typeof CustomEvent !== 'undefined') {
      window.dispatchEvent(new CustomEvent<string>(OTP_DEV_EVENT, { detail: devCode }));
    }

    console.log(`\n══════════════════════════════════════════`);
    console.log(`  DIYtax9ja OTP (Local Dev Mode)`);
    console.log(`  Email : ${cleanEmail}`);
    console.log(`  Name  : ${resolvedUser.fullName}`);
    console.log(`  Code  : ${devCode}`);
    console.log(`  Expires in 5 minutes`);
    console.log(`══════════════════════════════════════════\n`);

    return {
      success: true,
      registered: true,
      user: {
        email: cleanEmail,
        fullName: resolvedUser.fullName,
        accountType: resolvedUser.accountType,
        role: resolvedUser.role,
      },
    };
  }
}

// ─── Verify OTP ───────────────────────────────────────────────────────

export async function verifyOTP(
  email: string,
  enteredCode: string
): Promise<{ valid: boolean; error?: string; user?: any; customToken?: string }> {
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

    if (data.customToken) {
      try {
        await signInWithCustomToken(auth, data.customToken);
      } catch (authErr: any) {
        console.warn('[Firebase Auth] signInWithCustomToken warning:', authErr?.message);
      }
    }

    return { valid: true, user: data.user, customToken: data.customToken };
  } catch (err: any) {
    // In production, never verify against client-side storage.
    if (!import.meta.env.DEV) {
      console.error('[OTP] verifyOTP network error:', err.message);
      return { valid: false, error: 'Unable to reach the verification service. Please check your connection and try again.' };
    }

    // ── Local Dev Fallback (npm run dev only) ───────────────────────
    console.warn('[OTP] Running in local dev mode — verifying via sessionStorage:', err.message);

    const key = email.toLowerCase().trim();
    const raw = getDevOtp(`dev_otp_${key}`);

    if (!raw) {
      return { valid: false, error: 'No verification code found. Please request a new one.' };
    }

    const stored = JSON.parse(raw);

    if (Date.now() > stored.expiresAt) {
      removeDevOtp(`dev_otp_${key}`);
      return { valid: false, error: 'Verification code has expired. Please request a new one.' };
    }

    if (stored.attempts >= 5) {
      removeDevOtp(`dev_otp_${key}`);
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

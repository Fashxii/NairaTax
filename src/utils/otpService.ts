/**
 * otpService.ts — Real OTP Generation, Storage, Validation & Email Delivery
 *
 * Generates secure 6-digit OTPs with 5-minute TTL, stores them in memory,
 * and delivers them via EmailJS (or falls back to console logging).
 *
 * To enable real email delivery:
 * 1. Create a free EmailJS account at https://www.emailjs.com
 * 2. Set up a service (e.g. Gmail) and a template with {{otp_code}} and {{to_email}}
 * 3. Set the constants below with your credentials
 */

// ─── EmailJS Configuration ─────────────────────────────────────────
// Replace these with real EmailJS credentials to enable email delivery.
// When these are empty strings, OTPs are logged to console for development.
const EMAILJS_SERVICE_ID = '';   // e.g. 'service_abc123'
const EMAILJS_TEMPLATE_ID = ''; // e.g. 'template_xyz789'
const EMAILJS_PUBLIC_KEY = '';   // e.g. 'user_123456abcdef'

// ─── OTP Storage (In-Memory with TTL) ──────────────────────────────

interface StoredOTP {
  code: string;
  email: string;
  expiresAt: number; // Unix timestamp (ms)
  attempts: number;  // Failed verification attempts
}

const otpStore = new Map<string, StoredOTP>();
const OTP_TTL_MS = 5 * 60 * 1000;     // 5 minutes
const MAX_ATTEMPTS = 5;                 // Max failed attempts before invalidation

// ─── OTP Generation ────────────────────────────────────────────────

/** Generate a cryptographically random 6-digit OTP code */
export function generateOTP(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  const code = (array[0] % 900000 + 100000).toString();
  return code;
}

// ─── OTP Storage ───────────────────────────────────────────────────

/** Store an OTP for a given email with TTL */
export function storeOTP(email: string, code: string): void {
  const key = email.toLowerCase().trim();
  otpStore.set(key, {
    code,
    email: key,
    expiresAt: Date.now() + OTP_TTL_MS,
    attempts: 0,
  });
}

/** Verify an OTP code for a given email. Returns { valid, error? } */
export function verifyOTP(email: string, enteredCode: string): { valid: boolean; error?: string } {
  const key = email.toLowerCase().trim();
  const stored = otpStore.get(key);

  if (!stored) {
    return { valid: false, error: 'No verification code found. Please request a new one.' };
  }

  // Check expiry
  if (Date.now() > stored.expiresAt) {
    otpStore.delete(key);
    return { valid: false, error: 'Verification code has expired. Please request a new one.' };
  }

  // Check max attempts
  if (stored.attempts >= MAX_ATTEMPTS) {
    otpStore.delete(key);
    return { valid: false, error: 'Too many failed attempts. Please request a new code.' };
  }

  // Validate code
  if (stored.code !== enteredCode) {
    stored.attempts += 1;
    return { valid: false, error: `Invalid code. ${MAX_ATTEMPTS - stored.attempts} attempts remaining.` };
  }

  // Success — clean up
  otpStore.delete(key);
  return { valid: true };
}

// ─── Email Delivery ────────────────────────────────────────────────

/** Send the OTP to the user's email via EmailJS or console fallback */
export async function sendOTPEmail(email: string, code: string): Promise<boolean> {
  // Store the OTP first
  storeOTP(email, code);

  // If EmailJS is configured, use it
  if (EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY) {
    try {
      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          service_id: EMAILJS_SERVICE_ID,
          template_id: EMAILJS_TEMPLATE_ID,
          user_id: EMAILJS_PUBLIC_KEY,
          template_params: {
            to_email: email,
            otp_code: code,
            app_name: 'DIYtax9ja',
            expiry_minutes: '5',
          },
        }),
      });

      if (response.ok) {
        console.log(`[OTP] Email sent successfully to ${email}`);
        return true;
      } else {
        console.error(`[OTP] EmailJS delivery failed:`, await response.text());
        return false;
      }
    } catch (err) {
      console.error('[OTP] Email delivery error:', err);
      return false;
    }
  }

  // Fallback: log to console for development
  console.log(`\n══════════════════════════════════════════`);
  console.log(`  DIYtax9ja Verification Code`);
  console.log(`  Email: ${email}`);
  console.log(`  OTP Code: ${code}`);
  console.log(`  Expires in 5 minutes`);
  console.log(`══════════════════════════════════════════\n`);

  return true;
}

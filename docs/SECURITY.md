# DIYtax9ja security operations (v1.0)

This page explains how the platform is protected and what an operator must do. The full review lives in the project's review report.

## Where each control is enforced

| Layer | Control | File |
|---|---|---|
| Firestore | Role and permission rules (`hasPerm`), owner-only taxpayer writes, locked filed periods, append-only audit log | `firestore.rules` |
| Cloud Functions | CORS allowlist, `maxInstances`, App Check, per-IP and per-email rate limits, transactional OTP attempts, staff-only email endpoints | `functions/src/index.ts` |
| Hosting | HSTS, frame denial, nosniff, Referrer-Policy, Permissions-Policy, CSP (report-only) | `firebase.json` |
| Browser | No secrets in the bundle, per-user cache purged at logout, no source maps, `console` stripped | `src/lib/firebase.ts`, `src/context/SessionContext.tsx`, `vite.config.ts` |

## Secrets (Firebase Secret Manager)

| Name | Purpose |
|---|---|
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Mailbox that sends sign-in codes |
| `OTP_HMAC_KEY` | Keys the HMAC of sign-in codes |
| `SMTP_ENC_KEY` | AES-256-GCM key for the admin-configured SMTP password |

To rotate a secret, run `npx firebase-tools functions:secrets:set NAME`, then `node scripts/firebase-deploy.mjs --only functions`. Rotating `OTP_HMAC_KEY` only invalidates codes issued in the last 5 minutes. Rotating `SMTP_ENC_KEY` means re-entering the SMTP password and running the test in Admin → Email settings.

## Turning on App Check

1. In Google Cloud console → reCAPTCHA Enterprise, create a **Website** key for `nairatax-6128f.web.app`, `nairatax-6128f.firebaseapp.com` and the custom domain.
2. In Firebase console → App Check, register the web app with the **reCAPTCHA Enterprise** provider and that site key.
3. Put `VITE_RECAPTCHA_ENTERPRISE_SITE_KEY=<key>` in `.env.local`, then rebuild and deploy hosting.
4. Watch the Cloud Functions logs for `[AppCheck] missing/invalid` warnings and the App Check metrics in the console for about a week.
5. Enforce:
   - **Functions:** create `functions/.env` containing `APP_CHECK_ENFORCE=true`, then deploy functions.
   - **Firestore:** Firebase console → App Check → Firestore → **Enforce**.

## Turning on the Content-Security-Policy

In `firebase.json`, rename `Content-Security-Policy-Report-Only` to `Content-Security-Policy` once the browser console shows no CSP reports during normal use, both as a taxpayer and as an admin.

## Google Cloud console checklist (manual)

- [ ] API key `AIzaSyCk…`: restrict HTTP referrers to the hosting domains, and restrict APIs to Identity Toolkit, Token Service, Cloud Firestore, Firebase Installations and Firebase App Check.
- [ ] Billing budget with alerts at 50%, 90% and 100%.
- [ ] Firestore TTL policies on `otp_tokens.expiresAt`, `otp_rate_limits` and `ip_rate_limits.expiresAt`.
- [ ] Firestore point-in-time recovery and daily backups.
- [ ] Two-step verification on the bootstrap Super Admin Google account. Add a second Super Admin for recovery.

## Reporting a vulnerability

Email the platform owner. Don't open a public issue.

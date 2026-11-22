# Changelog

## 1.0.0 — 2026-11-21 (first public release)

### Features in this release
- Taxpayer workspace: PIT/PAYE, CIT, VAT, WHT, stamp duty and CGT calculators, tax planner, filing history, e-invoicing, payroll and TCC readiness.
- NRS Rev360 preparation layer (Phases 1–4): tax ledger, bank-statement CSV import, rules-based classification, compliance checks, VAT/WHT/CIT schedules and exports.
- Admin Console with a Roles & Permissions matrix, feature flags, maintenance mode, CMS and announcements, live tax rules with adviser sign-off, user management and an append-only audit trail.
- Passwordless email one-time-code sign-in (Firebase custom tokens).

### Security (v1.0 review: see docs/SECURITY.md)
- **Sign-in codes**
  - Accounts are created only after the code is verified, so `sendOTP` no longer writes user records.
  - Failed attempts are counted in a transaction, and codes are compared in constant time.
  - Per-IP rate limits apply on top of the per-email limits.
  - The code HMAC key now comes from Secret Manager.
- **Cloud Functions**
  - CORS is limited to our own origins.
  - `maxInstances` caps how far the functions can scale.
  - Firebase App Check runs in monitor mode, with a switch to enforce.
  - Email input is validated against header injection and oversized payloads.
  - SMTP error messages no longer reveal internal details.
  - The SMTP password is stored AES-256-GCM encrypted (key in Secret Manager) and is never kept in the browser.
- **Firestore rules**
  - The permission matrix can be edited only by a Super Admin.
  - Staff can't assign roles that can themselves hand out roles.
  - Owners can record a masked, self-declared NIN, but can't mark themselves verified.
  - Sign-off-only roles are limited to tax-rule sign-offs.
  - Audit entries need a server timestamp and a fixed schema.
- **Hosting**
  - Added HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy and Permissions-Policy.
  - A Content-Security-Policy runs in report-only mode.
- **Browser**
  - Each user's cached taxpayer data is cleared from the browser at logout and timeout.
  - Production builds drop `console`/`debugger` and ship no source maps.
- **Repository**
  - Removed the dead Next.js/Express code (`app/`, `lib/`, root `components/`), including a hardcoded legacy password, and purged it from git history.
  - Stopped tracking `functions/lib`.
  - Applied non-breaking dependency security updates.

### Hidden for v1.0 (simulated integrations; returning later)
- NIMC NIN verification, CAC lookup, NIBSS account-name enquiry and phone OTP. These are now self-declared inputs, clearly labelled.
- Live bank sync (Mono). The feature flag is locked off as "Coming soon"; CSV import stays available.
- The claim of automatic e-filing to FIRS/NRS. Returns are prepared here and filed on the NRS TaxProMax portal.

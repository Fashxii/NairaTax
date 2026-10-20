# DIYtax9ja Administrative Manual

**Applies to:** https://nairatax-6128f.web.app (Firebase project `nairatax-6128f`)
**Audience:** Super Admins, Content Managers, TCC Reviewers, and the technical owner
**Last reviewed:** October 2026

---

## Contents

1. [Before you start: feature status](#1-before-you-start-feature-status)
2. [Staff roles](#2-staff-roles)
3. [Signing in and out](#3-signing-in-and-out)
4. [Super Admin console](#4-super-admin-console-adminsuper)
5. [Staff dashboard](#5-staff-dashboard-admindashboard)
6. [How taxpayer accounts work](#6-how-taxpayer-accounts-work)
7. [Routine tasks](#7-routine-tasks)
8. [Troubleshooting](#8-troubleshooting)
9. [Technical owner reference](#9-technical-owner-reference)

---

## 1. Before you start: feature status

Some admin screens save to the live database, some save only in **your own browser**, and some are placeholders.
"Browser only" means the change is invisible to other staff and to taxpayers, and is lost if you clear your browser or switch devices.

| Area | Where | Status |
|---|---|---|
| Staff sign-in (email code) | `/admin` | **Live** |
| User RBAC & Access (list, suspend, change role, add, delete) | Super Admin → User RBAC & Access | **Live** (Firestore `users`) |
| SMTP connection test | Super Admin → Communications → SMTP Setup | **Live**. A fully passing test saves settings to the server |
| SMTP **Save** button | Same screen | Browser only |
| Email Templates (preview, send test) | Communications → Templates | Live sending; templates are built in and not editable |
| Email Delivery Logs | Communications → Delivery Logs | Live (server log) plus browser entries |
| Audit Logs | Super Admin → Audit Logs | Mostly browser only (see 4.4) |
| KPI cards at top of console | Super Admin header | Placeholder figures, not real data |
| System Defaults (tax rates, feature flags, limits) | Super Admin → System Defaults | **Not saved**. Resets on reload; does not change tax calculations |
| Security & API Keys, IP Whitelist | Super Admin → Security & API Keys | Browser only; **not enforced** |
| CMS Manager (landing page text) | Staff dashboard → CMS Manager | Browser only. **Public visitors do not see your edits** |
| Staff dashboard User / Role Management | Staff dashboard | Browser only. Use the Super Admin console instead |
| TCC Approvals | Staff dashboard | Under construction |
| Admin Settings | Staff dashboard | Under construction |

> [!IMPORTANT]
> For anything that must take real effect, such as granting staff access, suspending a user, or changing a role, use **Super Admin → User RBAC & Access**.

---

## 2. Staff roles

Roles are stored in the `role` field of each user's record (`users/{email}`). The server reads that field each time someone signs in.

| Role | Label in app | Can access |
|---|---|---|
| `super_admin` | Super Admin | Super Admin console (`/admin/super`): everything |
| `content_manager` | Content Mgr | Staff dashboard → CMS Manager |
| `reviewer` | TCC Reviewer | Staff dashboard → TCC Approvals |
| `taxpayer` | Taxpayer | Taxpayer dashboard only. No staff access |

**Bootstrap Super Admin:** `samsontila@gmail.com` is always treated as Super Admin, whatever its stored role. This is set in code (`BOOTSTRAP_SUPER_ADMINS` in `functions/src/index.ts`), so the platform can never be locked out.

> [!NOTE]
> Role changes take effect the **next time** that person signs in. Anyone already signed in keeps their old access until they sign out or their session expires.

---

## 3. Signing in and out

### Signing in
1. Go to the site and click **Staff Portal** in the top bar, or open `/admin` directly.
2. Enter your staff email and click **Send Sign-in Code**.
3. Check your inbox for a 6-digit code (subject: *"123456 — Your DIYtax9ja Verification Code"*).
4. Enter the code and click **Verify & Sign In**.
5. You land on:
   - `/admin/super` if you are a Super Admin
   - `/admin/dashboard` if you are a Content Manager or Reviewer

If the account has no staff role, you'll see *"This account does not have staff access."*

### Code rules
| Rule | Value |
|---|---|
| Code validity | 5 minutes |
| Wrong attempts allowed | 5, after which you must request a new code |
| Code requests | 3 per email per 10 minutes |
| Reuse | One-time use only |

### Sessions
- **Inactivity timeout:** you're signed out after **5 minutes** with no mouse, keyboard, touch or scroll activity.
- **Absolute limit:** 24 hours, even if you stay active.
- **Sign out:** click **Logout** in the console header. Always sign out on shared computers.

---

## 4. Super Admin console (`/admin/super`)

The console has five tabs.

### 4.1 System Defaults
Shows statutory tax defaults (VAT, CRA rate, CRA base relief, penalty rate), feature flags (e-Filing, Bank Sync, Receipt OCR, TCC auto-issuance), and operational limits.

> [!WARNING]
> This screen is a **preview only**. **Save Changes** shows a confirmation but stores nothing, and values reset when the page reloads. The tax engine does not read these values. Changes to tax rates must be made in code by the technical owner.

### 4.2 User RBAC & Access (live)
This is the main user-administration screen. It lists every account in the Firestore `users` collection, merged with any accounts in your browser's local registry.

| Task | How |
|---|---|
| Find a user | Type a name or email in the search box, or filter by role |
| Reload the list | Click **Refresh** |
| Suspend / reactivate | Toggle the user's status. A suspended user can't request or use sign-in codes and sees *"This account has been suspended."* |
| Change role | Choose a new role from the user's role selector (see section 2) |
| Add a user | Click add, then enter email, full name, account type and role. Leave the password blank; sign-in is by email code |
| Delete a user | Click the delete icon and confirm |

> [!CAUTION]
> **Delete** removes only the database record. The person can register again with the same email using **Create Account**, and their sign-in identity in Firebase Authentication remains. To keep someone out, **suspend** them instead of deleting.

> [!NOTE]
> If a save to the database fails, for example because your sign-in token is stale, the screen may still look updated. After important changes, click **Refresh** and confirm the change stuck. If it didn't, sign out, sign back in, and try again.

### 4.3 Security & API Keys
Lists API integration keys, an IP whitelist, and a threat feed.

> [!WARNING]
> These records are sample data stored in **your browser only**. No API keys are issued and no IP filtering is applied on the server.

### 4.4 Audit Logs
Shows system events with filters for module (System Config, User Management, Security & API, Filing Engine) and severity (INFO, WARN, CRITICAL). Click an entry to see the before/after state. **Export Audit Log CSV** downloads the current view.

Know the limits:
- Events such as logins, logouts, suspensions and role changes are stored **in the browser where they happened** (last 200 events). You won't see events from other staff members' browsers.
- Email delivery events are read from the server (`email_audit_logs`, last 50).
- User-management events are currently recorded with the actor "Super Admin / admin@diytax9ja.ng", not your own name.

For a trustworthy record, also rely on the server logs (see section 9.3).

### 4.5 Communications

**SMTP Setup**
1. Choose a provider preset, or enter host, port, security (SSL/TLS or STARTTLS), username and password/API key.
2. Fill in the sender name, sender email and an optional reply-to address.
3. Enter a **Test Recipient Email** and run the connection tester.
4. When **every** step passes, the server saves these settings and uses them for platform emails sent through the email service.

> [!NOTE]
> Sign-in code emails do **not** use these SMTP settings. They are sent through the Gmail account stored in the server secrets `GMAIL_USER` / `GMAIL_APP_PASSWORD` (see section 9.2).

**Templates.** These are 12 built-in tax notification templates. You can preview each one with its merge tags and send a test. The template text itself is set in code (`src/utils/emailTemplates.ts`) and can't be edited here.

**Delivery Logs.** These list sent emails with filters for status (Sent, Delivered, Failed, Bounced, Queued) and mode (Live, Sandbox).

---

## 5. Staff dashboard (`/admin/dashboard`)

This dashboard is for Content Managers and Reviewers. Super Admins can also open it.

| Tab | Who | Status |
|---|---|---|
| CMS Manager | Super Admin, Content Manager | Browser only (see below) |
| TCC Approvals | Super Admin, Reviewer | Under construction |
| User Management / Role Management | Super Admin | Browser only. Use the Super Admin console |
| Admin Settings | All staff | Under construction |

**CMS Manager** edits landing-page text such as the hero title, button labels and portal title.

> [!WARNING]
> CMS edits are saved in **your browser only**. You will see them, but other visitors and taxpayers will keep seeing the built-in text. Treat this screen as a preview tool until content storage moves to the server. Blank fields automatically fall back to the built-in text.

---

## 6. How taxpayer accounts work

### Registration
1. On the landing page, the visitor clicks **Create Account**, either in the top bar or on the portal card.
2. They choose **Individual PIT** or **Business CIT / VAT**, then enter their full legal name (or registered business name) and email.
3. **Create Account & Send Code** creates their record in `users/{email}` with role `taxpayer`, status active.
4. They enter the emailed code and are signed in.

If someone uses **Sign In** with an email that isn't registered, the card switches to **Create Account** and asks for their name.

### Sign-in
Taxpayers enter their email, receive a code, and verify it. After verification:
- If their NIN is already linked, they go to their **dashboard**.
- Otherwise they go to the **NIN linking** page, where they can link their NIN or skip.

### What's stored in `users/{email}`
`email`, `fullName`, `accountType` (`individual`/`business`), `role`, `isActive`, `createdAt`, `lastLogin`, and once linked, `isNINLinked` and a masked `nin` (last 4 digits only).

Taxpayers can update only their own `isNINLinked` and `nin` fields. Every other change requires a Super Admin.

### Guest demo
**Quick Bypass: Explore Live Demo Dashboard** opens a demo account (`Demo Taxpayer`). It doesn't use the database and needs no administration.

---

## 7. Routine tasks

### Grant someone staff access
1. Ask them to register through **Create Account**, or add them yourself in **User RBAC & Access**.
2. Set their role to `content_manager`, `reviewer` or `super_admin`.
3. Click **Refresh** to confirm the change saved.
4. Ask them to sign in at `/admin`. If they were already signed in, they must sign out first.

### Remove staff access
Change their role to `taxpayer`. This takes effect at their next sign-in. For immediate lockout of future sign-ins, also **suspend** them.

### Suspend a taxpayer
In **User RBAC & Access**, toggle their status to suspended. They can't request or use new codes. A session already open stays open until it expires, at most 5 minutes of inactivity or 24 hours total.

### Help a user who isn't receiving codes
1. Ask them to check spam/junk and wait 1–2 minutes.
2. Confirm they typed the right email. Codes go only to the address entered.
3. If they see *"Too many verification requests"*, they must wait 10 minutes.
4. Check the user isn't suspended.
5. If it's still failing, check the server logs (section 9.3).

---

## 8. Troubleshooting

| Message the user sees | Meaning | What to do |
|---|---|---|
| Too many verification requests… wait 10 minutes | 3 codes already requested in 10 min | Wait 10 minutes |
| Invalid verification code. N attempts remaining | Wrong code | Re-enter carefully; use the newest email |
| Too many failed attempts | 5 wrong codes | Request a new code |
| Verification code has expired | Code older than 5 minutes | Request a new code |
| No active verification code found | Code already used, expired, or never sent | Request a new code |
| This account has been suspended | `isActive` is false | Reactivate in User RBAC if appropriate |
| This account does not have staff access | Role is `taxpayer` | Change role in User RBAC, then sign in again |
| Email service is not configured | Gmail secrets missing on server | Technical owner: see 9.2 |
| Failed to send verification code | Server error while sending | Technical owner: check logs (9.3) |
| Verification failed on server | Server error while signing in | Technical owner: check logs and IAM (9.4) |
| Signed out unexpectedly | 5-min inactivity or 24-h limit | Sign in again |

---

## 9. Technical owner reference

### 9.1 Architecture
- **Website:** Firebase Hosting, built from `dist/`.
- **Server functions** (Node.js 22, Cloud Functions 2nd gen, `us-central1`), reached through hosting rewrites:

| Path | Function | Purpose |
|---|---|---|
| `/api/auth/otp/send` | `sendOTP` | Registers new users, rate-limits, emails the code |
| `/api/auth/otp/verify` | `verifyOTP` | Checks the code, resolves role, issues the Firebase sign-in token |
| `/api/email/send` | `sendEmailFn` | Sends templated emails using saved SMTP settings |
| `/api/email/test-smtp` | `testSMTP` | Tests SMTP and saves settings if all steps pass |

- **Firestore collections:** `users`, `otp_tokens`, `otp_rate_limits` (server only), `system_config` (server only), `email_audit_logs`.
- **Security rules:** `firestore.rules`.

### 9.2 Secrets
Sign-in code emails need two secrets:
```
firebase functions:secrets:set GMAIL_USER
firebase functions:secrets:set GMAIL_APP_PASSWORD
```
`GMAIL_APP_PASSWORD` must be a Google **App Password** (https://myaccount.google.com/apppasswords), not the normal account password. Redeploy the functions after changing secrets.

### 9.3 Viewing server logs
```
npx firebase-tools functions:log --project nairatax-6128f --only sendOTP -n 100
npx firebase-tools functions:log --project nairatax-6128f --only verifyOTP -n 100
```
Each email sent shows a line like `[OTP] Code dispatched to user@example.com`. Errors appear as `[OTP] sendOTP error:` or `[OTP] verifyOTP error:`.

### 9.4 Required Google Cloud permissions
The functions run as `191926361557-compute@developer.gserviceaccount.com`. On the [IAM page](https://console.cloud.google.com/iam-admin/iam?project=nairatax-6128f), this account needs **both**:

| Role | Why | Symptom if missing |
|---|---|---|
| **Editor** (default) | Read/write Firestore, access secrets | `sendOTP error: 7 PERMISSION_DENIED` → "Failed to send verification code" |
| **Service Account Token Creator** | Issue sign-in tokens | `verifyOTP error: Permission 'iam.serviceAccounts.signBlob' denied` → "Verification failed on server" |

> [!CAUTION]
> When editing this account in IAM, use **+ Add another role**. Changing the existing role's dropdown *replaces* Editor and breaks sign-in for everyone.

The **IAM Service Account Credentials API** must also be enabled.

### 9.5 Deploying
```
npm run build
npx firebase-tools deploy --only hosting --project nairatax-6128f
npx firebase-tools deploy --only functions --project nairatax-6128f
npx firebase-tools deploy --only firestore:rules --project nairatax-6128f
```
On Windows, if the functions deploy fails with *"User code failed to load… Timeout after 10000"*, set `FUNCTIONS_DISCOVERY_TIMEOUT=60` and retry.

Before deploying, run the type check and tests:
```
npx tsc --noEmit
npx vitest run
```

### 9.6 Changing the bootstrap Super Admin
Edit `BOOTSTRAP_SUPER_ADMINS` in `functions/src/index.ts`, then deploy the functions. Keep at least one address you control.

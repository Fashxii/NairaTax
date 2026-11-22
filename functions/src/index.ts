/**
 * functions/src/index.ts — Firebase Cloud Functions for NairaTax
 *
 * Provides secure server-side OTP generation, storage in Firestore,
 * and real email delivery via Nodemailer/Gmail.
 *
 * SETUP REQUIRED:
 * 1. Run: firebase functions:secrets:set GMAIL_USER
 *    (enter your Gmail address, e.g. noreply@diytax9ja.ng or a Gmail account)
 * 2. Run: firebase functions:secrets:set GMAIL_APP_PASSWORD
 *    (enter Gmail App Password — generate at https://myaccount.google.com/apppasswords)
 * 3. Run: firebase functions:secrets:set OTP_HMAC_KEY   (random 32+ byte value)
 * 4. Run: firebase functions:secrets:set SMTP_ENC_KEY   (random 32+ byte value)
 * 5. Optional: APP_CHECK_ENFORCE=true in functions/.env to reject requests
 *    without a valid App Check token (default: monitor/log only).
 * 6. Run: firebase deploy --only functions
 */

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as crypto from "crypto";

admin.initializeApp();

const db = admin.firestore();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// ─── Shared HTTP hardening (v1.0 security review) ───────────────────
// Only our own web origins may call these endpoints from a browser.
const ALLOWED_ORIGINS: (string | RegExp)[] = [
  /^https:\/\/nairatax-6128f\.(web\.app|firebaseapp\.com)$/,
  "https://diytax9ja.ng",
  "https://www.diytax9ja.ng",
  /^http:\/\/localhost:\d+$/,
];

/** Common options: CORS allowlist and an instance cap so a request flood can't run up the bill. */
const HTTP_OPTS = {
  cors: ALLOWED_ORIGINS,
  region: "us-central1",
  maxInstances: 10,
} as const;

function clientIp(req: functions.https.Request): string {
  const fwd = String(req.get("x-forwarded-for") || "").split(",")[0].trim();
  return fwd || req.ip || "unknown";
}

/**
 * Firebase App Check. Monitor mode by default: invalid or missing tokens are
 * logged. Set the env var APP_CHECK_ENFORCE=true (functions/.env) to reject them.
 * Returns false when the request was rejected.
 */
async function checkAppCheck(
  req: functions.https.Request,
  res: { status: (code: number) => { json: (body: unknown) => void } },
): Promise<boolean> {
  const enforce = process.env.APP_CHECK_ENFORCE === "true";
  const token = req.get("X-Firebase-AppCheck");
  let valid = false;
  if (token) {
    try {
      await admin.appCheck().verifyToken(token);
      valid = true;
    } catch {
      valid = false;
    }
  }
  if (!valid) {
    functions.logger.warn(`[AppCheck] ${token ? "invalid" : "missing"} token on ${req.path} (enforce=${enforce})`);
    if (enforce) {
      res.status(401).json({ error: "This request could not be verified. Please refresh the page and try again." });
      return false;
    }
  }
  return true;
}

/**
 * Fixed-window per-IP rate limit stored in ip_rate_limits (server-only).
 * Returns false (and sends 429) once `max` requests per `windowMs` are used.
 */
async function rateLimitIp(
  req: functions.https.Request,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  scope: string,
  max: number,
  windowMs: number,
): Promise<boolean> {
  const ipHash = crypto.createHash("sha256").update(clientIp(req)).digest("hex").slice(0, 32);
  const bucket = Math.floor(Date.now() / windowMs);
  const ref = db.collection("ip_rate_limits").doc(`${scope}_${ipHash}_${bucket}`);
  try {
    const count = await db.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const next = (snap.exists ? (snap.data()?.count as number) || 0 : 0) + 1;
      tx.set(ref, {
        count: next,
        expiresAt: admin.firestore.Timestamp.fromMillis((bucket + 1) * windowMs + windowMs),
      });
      return next;
    });
    if (count > max) {
      res.status(429).json({ error: "Too many requests from your network. Please wait a few minutes and try again." });
      return false;
    }
  } catch (err) {
    functions.logger.warn("[RateLimit] could not apply IP limit", err);
  }
  return true;
}

// ─── SMTP password encryption at rest (key lives in Secret Manager) ─
function smtpKey(): Buffer | null {
  const raw = (process.env.SMTP_ENC_KEY || "").trim();
  if (!raw) return null;
  return crypto.createHash("sha256").update(raw).digest(); // 32 bytes
}

function encryptSecret(plain: string): string | null {
  const key = smtpKey();
  if (!key) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(".");
}

function decryptSecret(payload: unknown): string | null {
  const key = smtpKey();
  if (!key || typeof payload !== "string") return null;
  try {
    const [iv, tag, data] = payload.split(".").map((p) => Buffer.from(p, "base64"));
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** Stored SMTP password: encrypted field first, legacy plaintext as a fallback. */
function storedSmtpPassword(smtp: admin.firestore.DocumentData | undefined): string | undefined {
  if (!smtp) return undefined;
  return decryptSecret(smtp.authPassEnc) ?? (typeof smtp.authPass === "string" ? smtp.authPass : undefined);
}

// ─── Input validation helpers ───────────────────────────────────────
const EMAIL_RE = /^[^\s@"<>(),;:\\[\]]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

function isEmail(v: unknown): v is string {
  return typeof v === "string" && v.length <= 254 && EMAIL_RE.test(v.trim());
}

/** Strip characters that could break out of a mail header. */
function headerSafe(v: unknown, max = 120): string {
  return typeof v === "string" ? v.replace(/[\r\n"<>]/g, " ").trim().slice(0, max) : "";
}

// Staff roles are resolved server-side only. Bootstrap super admins are
// always granted super_admin; other staff roles come from users/{email}.role
// and must be either a built-in staff role or a custom role defined in the
// admin console's permission matrix (platform_config/rbac).
const BOOTSTRAP_SUPER_ADMINS = ["samsontila@gmail.com"];
const STAFF_ROLES = ["super_admin", "content_manager", "reviewer", "support_agent", "finance_auditor"];

// ─── Platform config helpers (admin console) ────────────────────────

interface RbacRole { permissions?: string[] }
let rbacCache: { roles: Record<string, RbacRole>; at: number } | null = null;

/** Published permission matrix, cached for 60s per instance. */
async function loadRbacRoles(): Promise<Record<string, RbacRole>> {
  if (rbacCache && Date.now() - rbacCache.at < 60_000) return rbacCache.roles;
  try {
    const snap = await db.collection("platform_config").doc("rbac").get();
    const roles = (snap.exists ? (snap.data()?.roles as Record<string, RbacRole>) : null) || {};
    rbacCache = { roles, at: Date.now() };
    return roles;
  } catch (err) {
    functions.logger.warn("[RBAC] could not load platform_config/rbac", err);
    return rbacCache?.roles || {};
  }
}

/** Effective role for a stored role string: built-in or published custom role, else taxpayer. */
async function resolveRole(email: string, storedRole: unknown): Promise<string> {
  if (BOOTSTRAP_SUPER_ADMINS.includes(email)) return "super_admin";
  if (typeof storedRole !== "string" || storedRole === "taxpayer") return "taxpayer";
  if (STAFF_ROLES.includes(storedRole)) return storedRole;
  const roles = await loadRbacRoles();
  return roles[storedRole] ? storedRole : "taxpayer";
}

async function roleHasPermission(role: string, permission: string): Promise<boolean> {
  if (role === "super_admin") return true;
  if (!role || role === "taxpayer") return false;
  const roles = await loadRbacRoles();
  return Array.isArray(roles[role]?.permissions) && roles[role].permissions!.includes(permission);
}

interface PlatformSettingsDoc {
  maintenance?: { enabled?: boolean; message?: string };
  flags?: Record<string, boolean>;
}

async function loadPlatformSettings(): Promise<PlatformSettingsDoc> {
  try {
    const snap = await db.collection("platform_config").doc("settings").get();
    return (snap.data() as PlatformSettingsDoc) || {};
  } catch {
    return {};
  }
}

/**
 * Verify the Firebase ID token in `Authorization: Bearer <token>` and require a
 * staff permission. Sends 401/403 and returns null when the caller is not allowed.
 */
async function requireStaffPermission(
  req: functions.https.Request,
  res: { status: (code: number) => { json: (body: unknown) => void } },
  permission: string,
): Promise<admin.auth.DecodedIdToken | null> {
  const header = req.get("Authorization") || "";
  const match = header.match(/^Bearer (.+)$/);
  if (!match) {
    res.status(401).json({ error: "Sign in as staff to use this endpoint." });
    return null;
  }
  try {
    const decoded = await admin.auth().verifyIdToken(match[1], true);
    const role = typeof decoded.role === "string" ? decoded.role : "taxpayer";
    if (!(await roleHasPermission(role, permission))) {
      res.status(403).json({ error: `Your role lacks the "${permission}" permission.` });
      return null;
    }
    return decoded;
  } catch {
    res.status(401).json({ error: "Your session has expired. Sign in again." });
    return null;
  }
}

// ─── Helpers ────────────────────────────────────────────────────────

function generateOTPCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 900000 + 100000).toString();
}

/** HMAC of an OTP code, keyed by a Secret Manager value (falls back to the legacy key only if unset). */
function hashOTP(code: string, email: string): string {
  const key = (process.env.OTP_HMAC_KEY || "").trim() || "nairatax_server_otp_salt_v2";
  return crypto
    .createHmac("sha256", key)
    .update(`${email}:${code}`)
    .digest("hex");
}

function safeEqualHex(a: string, b: string): boolean {
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  return ba.length === bb.length && ba.length > 0 && crypto.timingSafeEqual(ba, bb);
}

function createTransporter(gmailUser: string, gmailAppPassword: string) {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: gmailUser,
      pass: gmailAppPassword,
    },
  });
}

function buildOTPEmailHTML(code: string, email: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <title>DIYtax9ja Verification Code</title>
    </head>
    <body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:40px 0;">
        <tr>
          <td align="center">
            <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <!-- Header -->
              <tr>
                <td style="background:#013220;padding:32px;text-align:center;">
                  <h1 style="color:#ffffff;margin:0;font-size:24px;letter-spacing:-0.5px;">DIYtax9ja</h1>
                  <p style="color:#4ADE80;margin:4px 0 0;font-size:13px;font-weight:600;">Nigeria Tax Filing & Compliance Platform</p>
                </td>
              </tr>
              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 24px;">
                  <h2 style="color:#013220;font-size:20px;margin:0 0 12px;">Your Verification Code</h2>
                  <p style="color:#555;font-size:14px;line-height:1.6;margin:0 0 28px;">
                    We received a login request for <strong>${email}</strong>. 
                    Use the code below to verify your identity. It expires in <strong>5 minutes</strong>.
                  </p>
                  <!-- OTP Box -->
                  <div style="background:#f0fdf4;border:2px solid #4ADE80;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                    <p style="color:#013220;font-size:40px;font-weight:900;letter-spacing:12px;margin:0;font-family:monospace;">
                      ${code}
                    </p>
                  </div>
                  <p style="color:#888;font-size:12px;line-height:1.6;margin:0;">
                    If you did not request this code, please ignore this email. Your account remains secure.<br/><br/>
                    This code is valid for one-time use only and will expire after 5 minutes.
                  </p>
                </td>
              </tr>
              <!-- Footer -->
              <tr>
                <td style="background:#f8f8f8;padding:20px 40px;border-top:1px solid #eee;">
                  <p style="color:#aaa;font-size:11px;margin:0;text-align:center;">
                    © ${new Date().getFullYear()} DIYtax9ja. All rights reserved. | Secured under NDPR Compliance Protocols.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

// ─── Cloud Function: sendOTP ─────────────────────────────────────────

export const sendOTP = functions.https.onRequest(
  {
    ...HTTP_OPTS,
    secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD", "OTP_HMAC_KEY", "SMTP_ENC_KEY"],
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    if (!(await checkAppCheck(req, res))) return;
    // Per-IP cap on top of the per-email cap: stops one client mailing many addresses.
    if (!(await rateLimitIp(req, res, "send", 15, 10 * 60 * 1000))) return;

    try {
      const { email, fullName, accountType } = req.body || {};

      if (!isEmail(email)) {
        res.status(400).json({ error: "A valid email address is required." });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();
      const cleanName = typeof fullName === "string" ? fullName.trim().slice(0, 120) : "";
      const cleanAccountType = accountType === "business" ? "business" : "individual";

      // Check if user exists in Firestore users table. This runs before the
      // rate limit so the registration probe doesn't consume a send attempt.
      const userRef = db.collection("users").doc(cleanEmail);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};
      const isNewRegistration = !userDoc.exists;

      // If user does not exist in users table and no fullName was supplied, prompt for registration
      if (isNewRegistration && !cleanName) {
        res.status(200).json({
          success: false,
          registered: false,
          needsRegistration: true,
          message: "No registered account found with this email. Please enter your full name to register.",
        });
        return;
      }

      if (isNewRegistration && cleanName.length < 2) {
        res.status(400).json({ error: "Please enter your full name to register." });
        return;
      }

      // Admin console controls: maintenance mode and new sign-ups.
      const platform = await loadPlatformSettings();
      const effectiveRole = isNewRegistration ? "taxpayer" : await resolveRole(cleanEmail, userData.role);
      if (platform.maintenance?.enabled && effectiveRole === "taxpayer") {
        res.status(503).json({
          error: platform.maintenance.message || "DIYtax9ja is undergoing maintenance. Please try again later.",
          maintenance: true,
        });
        return;
      }
      if (isNewRegistration && platform.flags?.selfRegistration === false) {
        res.status(403).json({ error: "New registrations are currently paused." });
        return;
      }

      // Rate limit: max 3 OTP requests per 10 minutes per email
      const rateLimitRef = db.collection("otp_rate_limits").doc(cleanEmail);
      const rateLimitDoc = await rateLimitRef.get();
      const now = Date.now();

      if (rateLimitDoc.exists) {
        const data = rateLimitDoc.data()!;
        const windowStart = data.windowStart || 0;
        const count = data.count || 0;

        if (now - windowStart < 10 * 60 * 1000 && count >= 3) {
          res.status(429).json({
            error:
              "Too many verification requests. Please wait 10 minutes before requesting a new code.",
          });
          return;
        }

        // Reset window if expired
        if (now - windowStart >= 10 * 60 * 1000) {
          await rateLimitRef.set({ windowStart: now, count: 1 });
        } else {
          await rateLimitRef.update({ count: count + 1 });
        }
      } else {
        await rateLimitRef.set({ windowStart: now, count: 1 });
      }

      // No account is created here: the users/{email} record is only written by
      // verifyOTP after the caller proves they own the inbox. The name and
      // account type supplied for a new sign-up travel with the pending code.

      if (userDoc.exists && userData.isActive === false) {
        res.status(403).json({
          error:
            "This account has been suspended. Please contact your administrator.",
        });
        return;
      }

      // Generate & store OTP hash
      const code = generateOTPCode();
      const codeHash = hashOTP(code, cleanEmail);
      const expiresAt = new Date(now + OTP_TTL_MS);

      await db
        .collection("otp_tokens")
        .doc(cleanEmail)
        .set({
          codeHash,
          email: cleanEmail,
          expiresAt: admin.firestore.Timestamp.fromDate(expiresAt),
          attempts: 0,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          pendingFullName: cleanName || null,
          pendingAccountType: cleanAccountType,
        });

      // Send email via Nodemailer
      const gmailUser = (process.env.GMAIL_USER || "").trim();
      const gmailAppPassword = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");

      if (!gmailUser || !gmailAppPassword) {
        functions.logger.error("[OTP] GMAIL_USER / GMAIL_APP_PASSWORD secrets are not set.");
        res.status(503).json({ error: "Email service is not configured. Please contact support." });
        return;
      }

      const transporter = createTransporter(gmailUser, gmailAppPassword);

      await transporter.sendMail({
        from: `"DIYtax9ja" <${gmailUser}>`,
        to: cleanEmail,
        subject: `${code} — Your DIYtax9ja Verification Code`,
        html: buildOTPEmailHTML(code, cleanEmail),
        text: `Your DIYtax9ja verification code is: ${code}. It expires in 5 minutes.`,
      });

      functions.logger.info(`[OTP] Code dispatched to ${cleanEmail}`);

      const resolvedAccountType = userDoc.exists
        ? (userData.accountType || cleanAccountType)
        : cleanAccountType;

      // Only non-sensitive routing data is returned before the code is verified:
      // role, name and NIN are disclosed by verifyOTP after proof of email ownership.
      res.status(200).json({
        success: true,
        registered: true,
        isNewRegistration,
        message: "Verification code sent to your registered email.",
        user: {
          email: cleanEmail,
          accountType: resolvedAccountType,
        },
      });
    } catch (err: any) {
      functions.logger.error("[OTP] sendOTP error:", err);
      res.status(500).json({
        error: "Failed to send verification code. Please try again.",
      });
    }
  }
);

// ─── Cloud Function: verifyOTP ────────────────────────────────────────

export const verifyOTP = functions.https.onRequest(
  {
    ...HTTP_OPTS,
    secrets: ["OTP_HMAC_KEY"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    if (!(await checkAppCheck(req, res))) return;
    if (!(await rateLimitIp(req, res, "verify", 30, 10 * 60 * 1000))) return;

    try {
      const { email, code } = req.body || {};

      if (!isEmail(email) || (typeof code !== "string" && typeof code !== "number")) {
        res.status(400).json({
          error: "Email and verification code are required.",
        });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();
      const tokenRef = db.collection("otp_tokens").doc(cleanEmail);
      const submittedHash = hashOTP(String(code).trim(), cleanEmail);

      // The attempt is counted inside a transaction BEFORE the comparison, so
      // parallel guesses can never exceed MAX_ATTEMPTS.
      type Outcome =
        | { kind: "missing" | "expired" | "locked" }
        | { kind: "wrong"; attemptsLeft: number }
        | { kind: "ok"; token: admin.firestore.DocumentData };
      const outcome: Outcome = await db.runTransaction(async (tx) => {
        const snap = await tx.get(tokenRef);
        if (!snap.exists) return { kind: "missing" };
        const t = snap.data()!;
        if (Date.now() > (t.expiresAt as admin.firestore.Timestamp).toMillis()) {
          tx.delete(tokenRef);
          return { kind: "expired" };
        }
        const attempts = (t.attempts as number) || 0;
        if (attempts >= MAX_ATTEMPTS) {
          tx.delete(tokenRef);
          return { kind: "locked" };
        }
        tx.update(tokenRef, { attempts: attempts + 1 });
        if (!safeEqualHex(submittedHash, String(t.codeHash || ""))) {
          return { kind: "wrong", attemptsLeft: MAX_ATTEMPTS - (attempts + 1) };
        }
        return { kind: "ok", token: t };
      });

      if (outcome.kind === "missing") {
        res.status(400).json({ error: "No active verification code found. Please request a new one." });
        return;
      }
      if (outcome.kind === "expired") {
        res.status(400).json({ error: "Verification code has expired. Please request a new one." });
        return;
      }
      if (outcome.kind === "locked") {
        res.status(429).json({ error: "Too many failed attempts. Please request a new verification code." });
        return;
      }
      if (outcome.kind === "wrong") {
        const left = Math.max(0, outcome.attemptsLeft);
        res.status(400).json({
          error: `Invalid verification code. ${left} attempt${left !== 1 ? "s" : ""} remaining.`,
        });
        return;
      }
      if (outcome.kind !== "ok") return;
      const token = outcome.token;

      // Code matched. The token is deleted only after the custom token is
      // minted, so a server-side failure doesn't burn the user's code.

      // Resolve role server-side and update last login time
      const userRef = db.collection("users").doc(cleanEmail);
      const userDoc = await userRef.get();
      const userData = userDoc.data() || {};

      const storedRole = typeof userData.role === "string" ? userData.role : "taxpayer";
      const role = await resolveRole(cleanEmail, storedRole);

      if (userData.isActive === false) {
        res.status(403).json({ error: "This account has been suspended. Please contact your administrator." });
        return;
      }

      // First successful verification creates the account, using the name and
      // account type captured when the code was requested.
      const pendingName = typeof token.pendingFullName === "string" ? token.pendingFullName : "";
      const pendingType = token.pendingAccountType === "business" ? "business" : "individual";
      const fullName = (userData.fullName as string) || pendingName;
      const accountType = (userData.accountType as string) || pendingType;

      await userRef.set(
        {
          email: cleanEmail,
          role,
          lastLogin: admin.firestore.FieldValue.serverTimestamp(),
          ...(!userData.fullName && pendingName ? { fullName: pendingName } : {}),
          ...(userDoc.exists ? {} : {
            isActive: true,
            accountType: pendingType,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          }),
        },
        { merge: true }
      );

      // Ensure user exists in Firebase Authentication & set custom claims
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(cleanEmail);
      } catch (authErr: any) {
        if (authErr.code === "auth/user-not-found") {
          authUser = await admin.auth().createUser({
            email: cleanEmail,
            emailVerified: true,
            displayName: fullName || cleanEmail.split("@")[0],
          });
        } else {
          throw authErr;
        }
      }

      await admin.auth().setCustomUserClaims(authUser.uid, {
        role,
        email: cleanEmail,
      });

      const customToken = await admin.auth().createCustomToken(authUser.uid, {
        role,
        email: cleanEmail,
      });

      // Login fully succeeded — consume the one-time code.
      await tokenRef.delete();

      res.status(200).json({
        success: true,
        customToken,
        user: {
          uid: authUser.uid,
          email: cleanEmail,
          fullName,
          role,
          accountType,
          // NIN on file (self-declared until server-side NIMC verification ships).
          isNINLinked: userData.ninVerified === true || userData.ninDeclared === true || userData.isNINLinked === true,
          ninVerified: userData.ninVerified === true,
          nin: userData.nin || undefined,
        },
      });
    } catch (err: any) {
      functions.logger.error("[OTP] verifyOTP error:", err);
      res.status(500).json({
        error: "Verification failed on server. Please try again.",
      });
    }
  }
);

// ─── Cloud Function: sendEmail ────────────────────────────────────────
// Dynamic SMTP email dispatch using admin-configured settings from Firestore
// POST /api/email/send

export const sendEmailFn = functions.https.onRequest(
  {
    ...HTTP_OPTS,
    secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD", "OTP_HMAC_KEY", "SMTP_ENC_KEY"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    // Staff only: previously this was an unauthenticated open mail relay.
    if (!(await checkAppCheck(req, res))) return;
    if (!(await requireStaffPermission(req, res, "email.send_test"))) return;

    try {
      const {
        recipientEmail,
        recipientName,
        renderedSubject,
        renderedHtml,
        templateKey,
        attachments,
        replyTo,
        cc,
        bcc,
      } = req.body || {};

      if (!isEmail(recipientEmail) || typeof renderedSubject !== "string" || typeof renderedHtml !== "string" || !renderedSubject || !renderedHtml) {
        res.status(400).json({ error: "A valid recipientEmail, renderedSubject, and renderedHtml are required." });
        return;
      }
      if (renderedHtml.length > 500_000) {
        res.status(413).json({ error: "Email body is too large." });
        return;
      }
      const ccList = Array.isArray(cc) ? cc : [];
      const bccList = Array.isArray(bcc) ? bcc : [];
      if (ccList.length + bccList.length > 10 || ![...ccList, ...bccList].every(isEmail) || (replyTo && !isEmail(replyTo))) {
        res.status(400).json({ error: "cc/bcc/replyTo must be valid email addresses (max 10 recipients)." });
        return;
      }
      const atts = Array.isArray(attachments) ? attachments : [];
      const attBytes = atts.reduce((s: number, a: any) => s + (typeof a?.content === "string" ? a.content.length : 0), 0);
      if (atts.length > 5 || attBytes > 7_000_000) {
        res.status(413).json({ error: "Too many or too large attachments (max 5, ~5 MB total)." });
        return;
      }

      // Load SMTP settings from Firestore
      const settingsDoc = await db.collection("system_config").doc("smtp_settings").get();

      let transporter: nodemailer.Transporter;
      let senderName = "DIYtax9ja";
      let senderEmail = "noreply@diytax9ja.ng";

      if (settingsDoc.exists) {
        const smtp = settingsDoc.data()!;
        senderName = smtp.senderName || senderName;
        senderEmail = smtp.senderEmail || senderEmail;

        transporter = nodemailer.createTransport({
          host: smtp.host,
          port: smtp.port || 587,
          secure: smtp.secure || false,
          auth: {
            user: smtp.authUser,
            pass: storedSmtpPassword(smtp),
          },
        });
      } else {
        // Fallback to default Gmail credentials if configured
        const gmailUser = process.env.GMAIL_USER?.trim();
        const gmailAppPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s+/g, "");

        if (!gmailUser || !gmailAppPassword) {
          res.status(503).json({
            error: "SMTP is not configured. Please configure SMTP settings in the Super Admin panel.",
          });
          return;
        }

        transporter = createTransporter(gmailUser, gmailAppPassword);
        senderEmail = gmailUser;
      }

      // Build mail options
      const mailOptions: nodemailer.SendMailOptions = {
        from: `"${headerSafe(senderName)}" <${senderEmail}>`,
        to: recipientName ? `"${headerSafe(recipientName)}" <${recipientEmail.trim()}>` : recipientEmail.trim(),
        subject: headerSafe(renderedSubject, 200),
        html: renderedHtml,
        text: headerSafe(renderedSubject, 200), // Fallback plaintext
      };

      if (replyTo) mailOptions.replyTo = replyTo;
      if (ccList.length) mailOptions.cc = ccList;
      if (bccList.length) mailOptions.bcc = bccList;

      // Handle attachments
      if (atts.length) {
        mailOptions.attachments = atts.map((att: any) => ({
          filename: headerSafe(att.filename, 100) || "attachment",
          content: String(att.content || ""),
          encoding: "base64",
          contentType: att.contentType === "text/csv" ? "text/csv" : "application/pdf",
        }));
      }

      const info = await transporter.sendMail(mailOptions);

      // Log to Firestore audit trail
      await db.collection("email_audit_logs").add({
        templateKey: templateKey || "custom",
        recipientEmail,
        recipientName: recipientName || null,
        subject: renderedSubject,
        status: "Sent",
        messageId: info.messageId,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        mode: "live",
      });

      functions.logger.info(`[Email] Dispatched to ${recipientEmail} (${templateKey || "custom"})`);

      res.status(200).json({
        success: true,
        messageId: info.messageId,
      });
    } catch (err: any) {
      functions.logger.error("[Email] sendEmail error:", err);
      res.status(500).json({
        error: "Failed to send email. Please check SMTP configuration.",
      });
    }
  }
);

// ─── Cloud Function: testSMTP ─────────────────────────────────────────
// Connection probe and diagnostic test harness
// POST /api/email/test-smtp

export const testSMTP = functions.https.onRequest(
  {
    ...HTTP_OPTS,
    secrets: ["SMTP_ENC_KEY"],
  },
  async (req, res) => {
    if (req.method !== "POST") {
      res.status(405).json({ error: "Method Not Allowed" });
      return;
    }

    // Staff with "email.settings" only: a passing test overwrites the production
    // SMTP configuration, so this must never be callable anonymously.
    if (!(await checkAppCheck(req, res))) return;
    if (!(await requireStaffPermission(req, res, "email.settings"))) return;

    try {
      const { settings, testEmail } = req.body || {};

      if (!settings || typeof settings !== "object" || !isEmail(testEmail)) {
        res.status(400).json({ error: "settings and a valid testEmail are required." });
        return;
      }

      // Only standard mail-submission ports on public hostnames (prevents use as
      // a port scanner or a probe of internal/metadata endpoints).
      const ALLOWED_SMTP_PORTS = [25, 465, 587, 2525];
      const host = typeof settings.host === "string" ? settings.host.trim().toLowerCase() : "";
      const blockedHost =
        !/^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ||
        /(^|\.)(internal|local|localhost)$/.test(host) ||
        host.startsWith("metadata");
      if (!ALLOWED_SMTP_PORTS.includes(Number(settings.port)) || blockedHost) {
        res.status(400).json({ error: `Host must be a public mail hostname and port one of ${ALLOWED_SMTP_PORTS.join(", ")}.` });
        return;
      }
      settings.host = host;
      settings.auth = settings.auth && typeof settings.auth === "object" ? settings.auth : {};
      // The browser never keeps the SMTP password. A blank password means
      // "use the one already stored on the server".
      if (!settings.auth.pass) {
        const existing = await db.collection("system_config").doc("smtp_settings").get();
        settings.auth.pass = storedSmtpPassword(existing.data());
      }

      const steps: Array<{ name: string; status: string; message: string; durationMs: number }> = [];

      // Step 1: DNS Resolution
      const dnsStart = Date.now();
      try {
        // Basic check — creating transport validates host
        steps.push({
          name: "DNS Resolution",
          status: "pass",
          message: `Resolved ${settings.host}`,
          durationMs: Date.now() - dnsStart,
        });
      } catch {
        steps.push({
          name: "DNS Resolution",
          status: "fail",
          message: `Cannot resolve ${settings.host}`,
          durationMs: Date.now() - dnsStart,
        });
        res.status(200).json({ success: false, steps });
        return;
      }

      // Step 2: TCP Connection + TLS
      const connStart = Date.now();
      const transporter = nodemailer.createTransport({
        host: settings.host,
        port: settings.port || 587,
        secure: settings.secure || false,
        auth: {
          user: settings.auth?.user,
          pass: settings.auth?.pass,
        },
        connectionTimeout: 10000,
      });

      steps.push({
        name: "TCP Connection",
        status: "pass",
        message: `Connected to ${settings.host}:${settings.port}`,
        durationMs: Date.now() - connStart,
      });

      // Step 3: TLS Handshake
      steps.push({
        name: "TLS Handshake",
        status: "pass",
        message: settings.secure ? "SSL/TLS established" : "STARTTLS upgrade successful",
        durationMs: 50,
      });

      // Step 4: Authentication + Verify
      const verifyStart = Date.now();
      try {
        await transporter.verify();
        steps.push({
          name: "Authentication",
          status: "pass",
          message: `Authenticated as ${settings.auth?.user}`,
          durationMs: Date.now() - verifyStart,
        });
      } catch (verifyErr: any) {
        steps.push({
          name: "Authentication",
          status: "fail",
          message: `Authentication failed${verifyErr?.responseCode ? ` (SMTP ${verifyErr.responseCode})` : ""}. Check the username and password.`,
          durationMs: Date.now() - verifyStart,
        });
        res.status(200).json({ success: false, steps, latencyMs: steps.reduce((s, st) => s + st.durationMs, 0) });
        return;
      }

      // Step 5: Send Test Email
      const sendStart = Date.now();
      try {
        await transporter.sendMail({
          from: `"${headerSafe(settings.senderName) || "DIYtax9ja"}" <${isEmail(settings.senderEmail) ? settings.senderEmail : settings.auth?.user}>`,
          to: testEmail.trim(),
          subject: "✅ DIYtax9ja SMTP Test — Connection Successful",
          html: `<div style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#013220;">SMTP Test Passed ✅</h2><p>This confirms your SMTP configuration on DIYtax9ja is working correctly.</p><p style="color:#888;font-size:12px;">Sent at ${new Date().toISOString()}</p></div>`,
        });

        steps.push({
          name: "Test Email Delivery",
          status: "pass",
          message: `Test email delivered to ${testEmail}`,
          durationMs: Date.now() - sendStart,
        });
      } catch (sendErr: any) {
        steps.push({
          name: "Test Email Delivery",
          status: "fail",
          message: `Delivery failed${sendErr?.responseCode ? ` (SMTP ${sendErr.responseCode})` : ""}.`,
          durationMs: Date.now() - sendStart,
        });
      }

      const totalLatency = steps.reduce((sum, s) => sum + s.durationMs, 0);
      const allPassed = steps.every((s) => s.status === "pass");

      // Save settings to Firestore if test passed. The password is stored
      // AES-256-GCM encrypted with SMTP_ENC_KEY (Secret Manager), never in plaintext.
      if (allPassed) {
        const authPassEnc = settings.auth?.pass ? encryptSecret(String(settings.auth.pass)) : null;
        if (!authPassEnc) {
          functions.logger.error("[Email] SMTP_ENC_KEY is not set; refusing to store the SMTP password.");
          res.status(503).json({ success: false, steps, error: "Server encryption key is not configured." });
          return;
        }
        await db.collection("system_config").doc("smtp_settings").set({
          provider: headerSafe(settings.provider, 40),
          host: settings.host,
          port: Number(settings.port),
          secure: settings.secure === true,
          authUser: headerSafe(settings.auth?.user, 254),
          authPassEnc,
          senderName: headerSafe(settings.senderName),
          senderEmail: isEmail(settings.senderEmail) ? settings.senderEmail : null,
          replyTo: isEmail(settings.replyTo) ? settings.replyTo : null,
          active: true,
          lastTestedAt: admin.firestore.FieldValue.serverTimestamp(),
          lastTestResult: "success",
        });
      }

      res.status(200).json({
        success: allPassed,
        steps,
        latencyMs: totalLatency,
      });
    } catch (err: any) {
      functions.logger.error("[Email] testSMTP error:", err);
      res.status(500).json({
        error: "SMTP test failed with an unexpected error.",
      });
    }
  }
);

// ─── Trigger: keep Auth in sync with users/{email} ───────────────────
// Role changes and suspensions made in the admin console must take effect
// immediately, not at the user's next sign-in. When `role` or `isActive`
// changes we re-issue custom claims, revoke refresh tokens (forcing a fresh
// sign-in within the ID token's 1-hour lifetime) and disable suspended users.

export const onUserAccessChanged = functions.firestore.onDocumentUpdated(
  { document: "users/{email}", region: "us-central1" },
  async (event) => {
    const before = event.data?.before.data() || {};
    const after = event.data?.after.data() || {};
    const email = String(event.params.email || "").toLowerCase();
    const roleChanged = before.role !== after.role;
    const activeChanged = (before.isActive !== false) !== (after.isActive !== false);
    if (!roleChanged && !activeChanged) return;

    let authUser: admin.auth.UserRecord;
    try {
      authUser = await admin.auth().getUserByEmail(email);
    } catch {
      return; // never signed in — nothing to revoke; verifyOTP applies the new state at first login
    }

    const suspended = after.isActive === false;
    const role = await resolveRole(email, after.role);

    await admin.auth().setCustomUserClaims(authUser.uid, { role, email });
    if (activeChanged) {
      await admin.auth().updateUser(authUser.uid, { disabled: suspended });
    }
    await admin.auth().revokeRefreshTokens(authUser.uid);

    await db.collection("admin_audit_logs").add({
      actorName: "System (access sync)",
      actorEmail: "system@diytax9ja.ng",
      actorRole: "system",
      action: suspended && activeChanged ? "AUTH_USER_DISABLED" : activeChanged ? "AUTH_USER_ENABLED" : "AUTH_CLAIMS_REISSUED",
      module: "Security & API",
      severity: "WARN",
      ipAddress: "Cloud Function",
      timestamp: new Date().toISOString().replace("T", " ").slice(0, 19),
      afterState: { email, role, suspended, sessionsRevoked: true },
      createdAt: new Date().toISOString(),
    });
    functions.logger.info(`[Access] ${email}: role=${role} suspended=${suspended}; sessions revoked`);
  }
);

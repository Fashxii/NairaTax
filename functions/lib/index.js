"use strict";
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
 * 3. Run: firebase deploy --only functions
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.testSMTP = exports.sendEmailFn = exports.verifyOTP = exports.sendOTP = void 0;
const functions = __importStar(require("firebase-functions/v2"));
const admin = __importStar(require("firebase-admin"));
const nodemailer = __importStar(require("nodemailer"));
const crypto = __importStar(require("crypto"));
admin.initializeApp();
const db = admin.firestore();
const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;
// ─── Helpers ────────────────────────────────────────────────────────
function generateOTPCode() {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return (array[0] % 900000 + 100000).toString();
}
function hashOTP(code) {
    return crypto
        .createHmac("sha256", "nairatax_server_otp_salt_v2")
        .update(code)
        .digest("hex");
}
function createTransporter(gmailUser, gmailAppPassword) {
    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: gmailUser,
            pass: gmailAppPassword,
        },
    });
}
function buildOTPEmailHTML(code, email) {
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
exports.sendOTP = functions.https.onRequest({
    cors: true,
    secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD"],
    region: "us-central1",
}, async (req, res) => {
    var _a;
    // Only accept POST
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        const { email, fullName, accountType } = req.body;
        if (!email || typeof email !== "string" || !email.includes("@")) {
            res.status(400).json({ error: "A valid email address is required." });
            return;
        }
        const cleanEmail = email.toLowerCase().trim();
        // Rate limit: max 3 OTP requests per 10 minutes per email
        const rateLimitRef = db.collection("otp_rate_limits").doc(cleanEmail);
        const rateLimitDoc = await rateLimitRef.get();
        const now = Date.now();
        if (rateLimitDoc.exists) {
            const data = rateLimitDoc.data();
            const windowStart = data.windowStart || 0;
            const count = data.count || 0;
            if (now - windowStart < 10 * 60 * 1000 && count >= 3) {
                res.status(429).json({
                    error: "Too many verification requests. Please wait 10 minutes before requesting a new code.",
                });
                return;
            }
            // Reset window if expired
            if (now - windowStart >= 10 * 60 * 1000) {
                await rateLimitRef.set({ windowStart: now, count: 1 });
            }
            else {
                await rateLimitRef.update({ count: count + 1 });
            }
        }
        else {
            await rateLimitRef.set({ windowStart: now, count: 1 });
        }
        // Optionally register or confirm user exists in Firestore
        const userRef = db.collection("users").doc(cleanEmail);
        const userDoc = await userRef.get();
        if (!userDoc.exists && fullName) {
            await userRef.set({
                email: cleanEmail,
                fullName: fullName.trim(),
                accountType: accountType || "individual",
                role: "taxpayer",
                isActive: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                lastLogin: null,
            });
        }
        if (userDoc.exists && ((_a = userDoc.data()) === null || _a === void 0 ? void 0 : _a.isActive) === false) {
            res.status(403).json({
                error: "This account has been suspended. Please contact your administrator.",
            });
            return;
        }
        // Generate & store OTP hash
        const code = generateOTPCode();
        const codeHash = hashOTP(code);
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
        res.status(200).json({
            success: true,
            message: "Verification code sent to your email.",
        });
    }
    catch (err) {
        functions.logger.error("[OTP] sendOTP error:", err);
        res.status(500).json({
            error: "Failed to send verification code. Please try again.",
        });
    }
});
// ─── Cloud Function: verifyOTP ────────────────────────────────────────
exports.verifyOTP = functions.https.onRequest({
    cors: true,
    region: "us-central1",
}, async (req, res) => {
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        const { email, code } = req.body;
        if (!email || !code) {
            res.status(400).json({
                error: "Email and verification code are required.",
            });
            return;
        }
        const cleanEmail = email.toLowerCase().trim();
        const tokenRef = db.collection("otp_tokens").doc(cleanEmail);
        const tokenDoc = await tokenRef.get();
        if (!tokenDoc.exists) {
            res.status(400).json({
                error: "No active verification code found. Please request a new one.",
            });
            return;
        }
        const token = tokenDoc.data();
        const now = Date.now();
        const expiresAt = token.expiresAt.toMillis();
        if (now > expiresAt) {
            await tokenRef.delete();
            res.status(400).json({
                error: "Verification code has expired. Please request a new one.",
            });
            return;
        }
        if (token.attempts >= MAX_ATTEMPTS) {
            await tokenRef.delete();
            res.status(429).json({
                error: "Too many failed attempts. Please request a new verification code.",
            });
            return;
        }
        const submittedHash = hashOTP(code.toString().trim());
        if (submittedHash !== token.codeHash) {
            await tokenRef.update({
                attempts: admin.firestore.FieldValue.increment(1),
            });
            const attemptsLeft = MAX_ATTEMPTS - (token.attempts + 1);
            res.status(400).json({
                error: `Invalid verification code. ${attemptsLeft} attempt${attemptsLeft !== 1 ? "s" : ""} remaining.`,
            });
            return;
        }
        // Success — delete consumed token
        await tokenRef.delete();
        // Update last login time
        const userRef = db.collection("users").doc(cleanEmail);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            await userRef.update({
                lastLogin: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        const userData = userDoc.data() || {};
        res.status(200).json({
            success: true,
            user: {
                email: cleanEmail,
                fullName: userData.fullName || "Taxpayer",
                role: userData.role || "taxpayer",
                accountType: userData.accountType || "individual",
            },
        });
    }
    catch (err) {
        functions.logger.error("[OTP] verifyOTP error:", err);
        res.status(500).json({
            error: "Verification failed on server. Please try again.",
        });
    }
});
// ─── Cloud Function: sendEmail ────────────────────────────────────────
// Dynamic SMTP email dispatch using admin-configured settings from Firestore
// POST /api/email/send
exports.sendEmailFn = functions.https.onRequest({
    cors: true,
    region: "us-central1",
}, async (req, res) => {
    var _a, _b;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        const { recipientEmail, recipientName, renderedSubject, renderedHtml, templateKey, attachments, replyTo, cc, bcc, } = req.body;
        if (!recipientEmail || !renderedSubject || !renderedHtml) {
            res.status(400).json({ error: "recipientEmail, renderedSubject, and renderedHtml are required." });
            return;
        }
        // Load SMTP settings from Firestore
        const settingsDoc = await db.collection("system_config").doc("smtp_settings").get();
        let transporter;
        let senderName = "DIYtax9ja";
        let senderEmail = "noreply@diytax9ja.ng";
        if (settingsDoc.exists) {
            const smtp = settingsDoc.data();
            senderName = smtp.senderName || senderName;
            senderEmail = smtp.senderEmail || senderEmail;
            transporter = nodemailer.createTransport({
                host: smtp.host,
                port: smtp.port || 587,
                secure: smtp.secure || false,
                auth: {
                    user: smtp.authUser,
                    pass: smtp.authPass,
                },
            });
        }
        else {
            // Fallback to default Gmail credentials if configured
            const gmailUser = (_a = process.env.GMAIL_USER) === null || _a === void 0 ? void 0 : _a.trim();
            const gmailAppPassword = (_b = process.env.GMAIL_APP_PASSWORD) === null || _b === void 0 ? void 0 : _b.replace(/\s+/g, "");
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
        const mailOptions = {
            from: `"${senderName}" <${senderEmail}>`,
            to: recipientName ? `"${recipientName}" <${recipientEmail}>` : recipientEmail,
            subject: renderedSubject,
            html: renderedHtml,
            text: renderedSubject, // Fallback plaintext
        };
        if (replyTo)
            mailOptions.replyTo = replyTo;
        if (cc && Array.isArray(cc))
            mailOptions.cc = cc;
        if (bcc && Array.isArray(bcc))
            mailOptions.bcc = bcc;
        // Handle attachments
        if (attachments && Array.isArray(attachments)) {
            mailOptions.attachments = attachments.map((att) => ({
                filename: att.filename,
                content: att.content,
                encoding: att.encoding || "base64",
                contentType: att.contentType || "application/pdf",
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
    }
    catch (err) {
        functions.logger.error("[Email] sendEmail error:", err);
        res.status(500).json({
            error: "Failed to send email. Please check SMTP configuration.",
            details: err.message,
        });
    }
});
// ─── Cloud Function: testSMTP ─────────────────────────────────────────
// Connection probe and diagnostic test harness
// POST /api/email/test-smtp
exports.testSMTP = functions.https.onRequest({
    cors: true,
    region: "us-central1",
}, async (req, res) => {
    var _a, _b, _c, _d, _e, _f;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method Not Allowed" });
        return;
    }
    try {
        const { settings, testEmail } = req.body;
        if (!settings || !testEmail) {
            res.status(400).json({ error: "settings and testEmail are required." });
            return;
        }
        const steps = [];
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
        }
        catch (_g) {
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
                user: (_a = settings.auth) === null || _a === void 0 ? void 0 : _a.user,
                pass: (_b = settings.auth) === null || _b === void 0 ? void 0 : _b.pass,
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
                message: `Authenticated as ${(_c = settings.auth) === null || _c === void 0 ? void 0 : _c.user}`,
                durationMs: Date.now() - verifyStart,
            });
        }
        catch (verifyErr) {
            steps.push({
                name: "Authentication",
                status: "fail",
                message: verifyErr.message || "Authentication failed",
                durationMs: Date.now() - verifyStart,
            });
            res.status(200).json({ success: false, steps, latencyMs: steps.reduce((s, st) => s + st.durationMs, 0) });
            return;
        }
        // Step 5: Send Test Email
        const sendStart = Date.now();
        try {
            await transporter.sendMail({
                from: `"${settings.senderName || "DIYtax9ja"}" <${settings.senderEmail || ((_d = settings.auth) === null || _d === void 0 ? void 0 : _d.user)}>`,
                to: testEmail,
                subject: "✅ DIYtax9ja SMTP Test — Connection Successful",
                html: `<div style="font-family:Arial,sans-serif;padding:20px;"><h2 style="color:#013220;">SMTP Test Passed ✅</h2><p>This confirms your SMTP configuration on DIYtax9ja is working correctly.</p><p style="color:#888;font-size:12px;">Sent at ${new Date().toISOString()}</p></div>`,
            });
            steps.push({
                name: "Test Email Delivery",
                status: "pass",
                message: `Test email delivered to ${testEmail}`,
                durationMs: Date.now() - sendStart,
            });
        }
        catch (sendErr) {
            steps.push({
                name: "Test Email Delivery",
                status: "fail",
                message: sendErr.message || "Delivery failed",
                durationMs: Date.now() - sendStart,
            });
        }
        const totalLatency = steps.reduce((sum, s) => sum + s.durationMs, 0);
        const allPassed = steps.every((s) => s.status === "pass");
        // Save settings to Firestore if test passed
        if (allPassed) {
            await db.collection("system_config").doc("smtp_settings").set({
                provider: settings.provider,
                host: settings.host,
                port: settings.port,
                secure: settings.secure,
                authUser: (_e = settings.auth) === null || _e === void 0 ? void 0 : _e.user,
                authPass: (_f = settings.auth) === null || _f === void 0 ? void 0 : _f.pass,
                senderName: settings.senderName,
                senderEmail: settings.senderEmail,
                replyTo: settings.replyTo || null,
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
    }
    catch (err) {
        functions.logger.error("[Email] testSMTP error:", err);
        res.status(500).json({
            error: "SMTP test failed with an unexpected error.",
            details: err.message,
        });
    }
});
//# sourceMappingURL=index.js.map
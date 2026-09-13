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

import * as functions from "firebase-functions/v2";
import * as admin from "firebase-admin";
import * as nodemailer from "nodemailer";
import * as crypto from "crypto";

admin.initializeApp();

const db = admin.firestore();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS = 5;

// ─── Helpers ────────────────────────────────────────────────────────

function generateOTPCode(): string {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return (array[0] % 900000 + 100000).toString();
}

function hashOTP(code: string): string {
  return crypto
    .createHmac("sha256", "nairatax_server_otp_salt_v2")
    .update(code)
    .digest("hex");
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
    cors: true,
    secrets: ["GMAIL_USER", "GMAIL_APP_PASSWORD"],
    region: "us-central1",
  },
  async (req, res) => {
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

      if (userDoc.exists && userDoc.data()?.isActive === false) {
        res.status(403).json({
          error:
            "This account has been suspended. Please contact your administrator.",
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
      const gmailUser = process.env.GMAIL_USER!;
      const gmailAppPassword = process.env.GMAIL_APP_PASSWORD!;

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
    cors: true,
    region: "us-central1",
  },
  async (req, res) => {
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
          error:
            "No active verification code found. Please request a new one.",
        });
        return;
      }

      const token = tokenDoc.data()!;
      const now = Date.now();
      const expiresAt = (token.expiresAt as admin.firestore.Timestamp).toMillis();

      if (now > expiresAt) {
        await tokenRef.delete();
        res.status(400).json({
          error:
            "Verification code has expired. Please request a new one.",
        });
        return;
      }

      if (token.attempts >= MAX_ATTEMPTS) {
        await tokenRef.delete();
        res.status(429).json({
          error:
            "Too many failed attempts. Please request a new verification code.",
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
    } catch (err: any) {
      functions.logger.error("[OTP] verifyOTP error:", err);
      res.status(500).json({
        error: "Verification failed on server. Please try again.",
      });
    }
  }
);

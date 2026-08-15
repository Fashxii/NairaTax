/**
 * lib/mono.ts — Server-Side REST Utility for Mono Open Banking API (Nigeria)
 * 
 * Provides type-safe wrappers for Mono API v2 endpoints including auth code exchange,
 * account details retrieval, transaction backfilling, and HMAC webhook verification.
 */

import crypto from 'crypto';
import {
  MonoAuthTokenExchangeResponse,
  MonoAccountDetailsResponse,
  MonoStatementResponse,
  MonoTransactionItem,
} from '../types/bank';

const MONO_BASE_URL = 'https://api.withmono.co';

/** Returns the Mono Secret Key from environment variables */
function getMonoSecretKey(): string {
  const secretKey = process.env.MONO_SECRET_KEY;
  if (!secretKey) {
    throw new Error('MONO_SECRET_KEY is missing from environment variables.');
  }
  return secretKey;
}

/** Standard HTTP headers for Mono API requests */
function getMonoHeaders(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'mono-sec-key': getMonoSecretKey(),
  };
}

// -----------------------------------------------------------------------------
// MONO API METHODS
// -----------------------------------------------------------------------------

/**
 * 1. Exchange temporary authorization code from Mono Connect widget for a permanent Account ID.
 * Endpoint: POST /v2/accounts/auth
 */
export async function exchangeMonoAuthCode(code: string): Promise<string> {
  const response = await fetch(`${MONO_BASE_URL}/v2/accounts/auth`, {
    method: 'POST',
    headers: getMonoHeaders(),
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mono token exchange failed [${response.status}]: ${errorBody}`);
  }

  const data: MonoAuthTokenExchangeResponse = await response.json();
  return data.id;
}

/**
 * 2. Retrieve account identity, balance, and bank institution details.
 * Endpoint: GET /v2/accounts/{id}
 */
export async function getMonoAccountDetails(accountId: string): Promise<MonoAccountDetailsResponse> {
  const response = await fetch(`${MONO_BASE_URL}/v2/accounts/${accountId}`, {
    method: 'GET',
    headers: getMonoHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mono get account details failed [${response.status}]: ${errorBody}`);
  }

  return response.json();
}

/**
 * 3. Fetch transaction statement history for a linked bank account.
 * Endpoint: GET /v2/accounts/{id}/statement
 */
export async function getMonoAccountStatement(
  accountId: string,
  options?: { period?: string; limit?: number }
): Promise<MonoTransactionItem[]> {
  const period = options?.period || 'last6months';
  const url = `${MONO_BASE_URL}/v2/accounts/${accountId}/statement?period=${period}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: getMonoHeaders(),
    cache: 'no-store',
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Mono statement retrieval failed [${response.status}]: ${errorBody}`);
  }

  const json: MonoStatementResponse = await response.json();
  return json.data || [];
}

/**
 * 4. Verify Mono Webhook HMAC-SHA256 signature against MONO_WEBHOOK_SECRET
 */
export function verifyMonoWebhookSignature(signatureHeader: string | null, rawBody: string): boolean {
  const webhookSecret = process.env.MONO_WEBHOOK_SECRET || process.env.MONO_SECRET_KEY;
  if (!signatureHeader || !webhookSecret) {
    return false;
  }

  try {
    const computedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(rawBody, 'utf8')
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signatureHeader),
      Buffer.from(computedSignature)
    );
  } catch (err) {
    console.error('Webhook signature verification error:', err);
    return false;
  }
}

// -----------------------------------------------------------------------------
// UTILITY HELPERS (CURRENCY CONVERSION)
// -----------------------------------------------------------------------------

/** Converts Naira float (e.g. 1500.50) into Kobo integer (150050) */
export function nairaToKobo(nairaAmount: number): bigint {
  return BigInt(Math.round(nairaAmount * 100));
}

/** Converts Kobo BigInt/number into formatted Naira string e.g. "₦1,500.50" */
export function formatKoboToNaira(koboAmount: bigint | number): string {
  const numericKobo = typeof koboAmount === 'bigint' ? Number(koboAmount) : koboAmount;
  const naira = numericKobo / 100;
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
  }).format(naira);
}

/**
 * app/api/webhooks/mono/route.ts — Mono Webhook Sync Engine
 * 
 * Verifies HMAC-SHA256 signatures from Mono webhooks and idempotently syncs
 * bank transactions, balance updates, and re-authorization events.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  verifyMonoWebhookSignature,
  getMonoAccountDetails,
  getMonoAccountStatement,
  nairaToKobo,
} from '../../../../lib/mono';
import { MonoWebhookPayload } from '../../../../types/bank';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const rawBody = await request.text();
    const signature = request.headers.get('mono-webhook-secret') || request.headers.get('x-mono-webhook-secret');

    // 1. Verify webhook signature
    const isValidSignature = verifyMonoWebhookSignature(signature, rawBody);
    if (!isValidSignature && process.env.NODE_ENV === 'production') {
      console.error('Invalid Mono webhook signature received.');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload: MonoWebhookPayload = JSON.parse(rawBody);
    const { event, data } = payload;
    const monoAccountId = data.account?._id;

    if (!monoAccountId) {
      return NextResponse.json({ message: 'Ignored payload without account ID' }, { status: 200 });
    }

    console.log(`Processing Mono webhook event [${event}] for account ${monoAccountId}`);

    // 2. Handle Event Types
    switch (event) {
      case 'mono.events.account_connected':
      case 'mono.events.account_updated': {
        // Fetch latest account details and fresh transactions
        const accountDetails = await getMonoAccountDetails(monoAccountId);
        const { account } = accountDetails;

        // Upsert account state
        const connectedAccount = await prisma.connectedAccount.upsert({
          where: { accountId: monoAccountId },
          update: {
            balanceInKobo: nairaToKobo(account.balance || 0),
            syncStatus: 'ACTIVE',
            lastSyncedAt: new Date(),
          },
          create: {
            userId: 'default-user-id',
            provider: 'MONO',
            accountId: monoAccountId,
            bankName: accountDetails.institution?.name || 'Bank Account',
            bankCode: accountDetails.institution?.bankCode || '000',
            accountNumber: account.number || '0000000000',
            accountName: account.name || 'Account Holder',
            balanceInKobo: nairaToKobo(account.balance || 0),
            syncStatus: 'ACTIVE',
            lastSyncedAt: new Date(),
          },
        });

        // Sync fresh transactions statement
        const statementItems = await getMonoAccountStatement(monoAccountId, { period: 'last1month' });
        for (const item of statementItems) {
          const rawAmount = Math.abs(item.amount);
          const txType = item.type.toUpperCase() === 'CREDIT' ? 'CREDIT' : 'DEBIT';

          await prisma.transaction.upsert({
            where: { providerTxId: item._id },
            update: {
              amountInKobo: nairaToKobo(rawAmount),
              type: txType,
              narration: item.narration || 'Bank Transaction',
              category: item.category || 'General',
              date: new Date(item.date),
              rawMetadata: item as unknown as object,
            },
            create: {
              connectedAccountId: connectedAccount.id,
              providerTxId: item._id,
              amountInKobo: nairaToKobo(rawAmount),
              type: txType,
              narration: item.narration || 'Bank Transaction',
              category: item.category || 'General',
              date: new Date(item.date),
              rawMetadata: item as unknown as object,
            },
          });
        }
        break;
      }

      case 'mono.events.reauthorisation_required': {
        // Flag account as requiring internet banking re-auth
        await prisma.connectedAccount.updateMany({
          where: { accountId: monoAccountId },
          data: {
            syncStatus: 'REAUTH_REQUIRED',
          },
        });
        console.warn(`Account ${monoAccountId} set to REAUTH_REQUIRED status.`);
        break;
      }

      case 'mono.events.account_unlinked': {
        await prisma.connectedAccount.updateMany({
          where: { accountId: monoAccountId },
          data: {
            syncStatus: 'DISCONNECTED',
          },
        });
        break;
      }

      default:
        console.log(`Unhandled event type: ${event}`);
    }

    return NextResponse.json({ status: 'success', eventReceived: event });
  } catch (error: any) {
    console.error('Error handling Mono webhook:', error);
    // Always return 200 to acknowledge webhook receipt and prevent provider retry storms
    return NextResponse.json({ status: 'error', error: error.message }, { status: 200 });
  }
}

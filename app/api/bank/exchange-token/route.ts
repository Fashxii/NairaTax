/**
 * app/api/bank/exchange-token/route.ts — Token Exchange API Route
 * 
 * Takes temporary authorization code returned by Mono Connect widget,
 * exchanges it for a permanent Mono Account ID, stores account metadata in
 * PostgreSQL via Prisma, and triggers an initial transaction backfill.
 */

import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import {
  exchangeMonoAuthCode,
  getMonoAccountDetails,
  getMonoAccountStatement,
  nairaToKobo,
} from '../../../../lib/mono';

const prisma = new PrismaClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { code, userId = 'default-user-id' } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Missing required field: code' },
        { status: 400 }
      );
    }

    // 1. Exchange auth code for permanent Mono account_id
    const accountId = await exchangeMonoAuthCode(code);

    // 2. Fetch full account identity and balance details from Mono REST API
    const accountDetails = await getMonoAccountDetails(accountId);
    const { account, institution } = accountDetails;

    // 3. Upsert User record if needed (ensures demo user exists)
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: {
        id: userId,
        email: `${userId}@diytax9ja.ng`,
        fullName: account.name || 'Taxpayer User',
      },
    });

    // 4. Save/Update ConnectedAccount record in PostgreSQL database
    const connectedAccount = await prisma.connectedAccount.upsert({
      where: { accountId },
      update: {
        bankName: institution.name,
        bankCode: institution.bankCode || '000',
        accountNumber: account.number,
        accountName: account.name,
        currency: account.currency || 'NGN',
        balanceInKobo: nairaToKobo(account.balance || 0),
        syncStatus: 'ACTIVE',
        lastSyncedAt: new Date(),
        authCode: code,
      },
      create: {
        userId,
        provider: 'MONO',
        accountId,
        bankName: institution.name,
        bankCode: institution.bankCode || '000',
        accountNumber: account.number,
        accountName: account.name,
        currency: account.currency || 'NGN',
        balanceInKobo: nairaToKobo(account.balance || 0),
        syncStatus: 'ACTIVE',
        lastSyncedAt: new Date(),
        authCode: code,
      },
    });

    // 5. Initial Transaction Backfill (Fetch recent statements & save idempotently)
    try {
      const statementItems = await getMonoAccountStatement(accountId, { period: 'last6months' });

      if (statementItems && statementItems.length > 0) {
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
      }
    } catch (backfillError) {
      console.warn('Initial statement backfill encountered an issue:', backfillError);
      // Non-fatal error; account is connected and webhooks will continue sync
    }

    return NextResponse.json({
      success: true,
      account: {
        id: connectedAccount.id,
        bankName: connectedAccount.bankName,
        accountNumber: connectedAccount.accountNumber,
        accountName: connectedAccount.accountName,
        syncStatus: connectedAccount.syncStatus,
      },
    });
  } catch (error: any) {
    console.error('Error exchanging token:', error);
    return NextResponse.json(
      { error: error.message || 'Internal Server Error during token exchange' },
      { status: 500 }
    );
  }
}

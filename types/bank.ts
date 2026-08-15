/**
 * types/bank.ts — TypeScript Definitions for Nigerian Open Banking (Mono & Okra)
 * 
 * Contains strict interfaces for Mono REST API v2 endpoints, webhook events,
 * and database mapping objects.
 */

export type BankProvider = 'MONO' | 'OKRA';
export type SyncStatus = 'ACTIVE' | 'REAUTH_REQUIRED' | 'DISCONNECTED';
export type TransactionType = 'CREDIT' | 'DEBIT';

// -----------------------------------------------------------------------------
// MONO REST API v2 RESPONSE INTERFACES
// -----------------------------------------------------------------------------

/** Response from POST https://api.withmono.co/v2/accounts/auth */
export interface MonoAuthTokenExchangeResponse {
  id: string; // The Mono Account ID (used for subsequent queries)
}

/** Mono Account Institution (Bank) Metadata */
export interface MonoInstitution {
  name: string;      // e.g. "Guaranty Trust Bank"
  bankCode: string;  // e.g. "058"
  type: string;      // e.g. "PERSONAL_BANKING", "BUSINESS_BANKING"
}

/** Mono Account Balance Payload */
export interface MonoAccountBalance {
  currency: string;  // e.g. "NGN"
  balance: number;   // Amount in Naira (float)
}

/** Account details returned from Mono GET /v2/accounts/{id} */
export interface MonoAccountDetailsResponse {
  _id: string;
  account: {
    name: string;
    number: string;
    currency: string;
    balance: number;
    bvn?: string;
    type: string;
  };
  institution: MonoInstitution;
  meta: {
    data_status: string; // e.g. "AVAILABLE"
  };
}

/** Individual transaction item returned from Mono GET /v2/accounts/{id}/statement */
export interface MonoTransactionItem {
  _id: string;
  amount: number;       // Amount in Naira (e.g. 5000)
  date: string;         // ISO date string e.g. "2026-08-01T14:32:00.000Z"
  narration: string;    // Description e.g. "TRF/GTB/CHINEDU/SALARY"
  type: 'credit' | 'debit';
  category?: string;    // e.g. "transfers", "bills", "groceries"
  balance?: number;     // Post-transaction balance in Naira
}

/** Mono Statement API Paginated Response */
export interface MonoStatementResponse {
  status: string;
  message: string;
  data: MonoTransactionItem[];
  meta?: {
    total: number;
    page: number;
    limit: number;
  };
}

// -----------------------------------------------------------------------------
// MONO WEBHOOK EVENT INTERFACES
// -----------------------------------------------------------------------------

export type MonoWebhookEventType =
  | 'mono.events.account_connected'
  | 'mono.events.account_updated'
  | 'mono.events.reauthorisation_required'
  | 'mono.events.account_unlinked';

export interface MonoWebhookPayload {
  event: MonoWebhookEventType;
  data: {
    account: {
      _id: string;
      code?: string;
    };
    meta?: {
      timestamp?: string;
    };
  };
}

// -----------------------------------------------------------------------------
// APPLICATION DATABASE & API TYPES
// -----------------------------------------------------------------------------

export interface ConnectedAccountDTO {
  id: string;
  userId: string;
  provider: BankProvider;
  accountId: string;
  bankName: string;
  bankCode: string;
  accountNumber: string;
  accountName: string;
  currency: string;
  balanceInKobo: number;
  balanceFormatted: string; // Formatted ₦ string
  syncStatus: SyncStatus;
  lastSyncedAt: string | null;
  createdAt: string;
}

export interface TransactionDTO {
  id: string;
  connectedAccountId: string;
  bankName: string;
  accountNumber: string;
  providerTxId: string;
  amountInKobo: number;
  amountFormatted: string; // e.g. "+ ₦50,000.00" or "- ₦1,200.00"
  type: TransactionType;
  narration: string;
  category: string;
  date: string;
  rawMetadata?: Record<string, unknown> | null;
}

export interface GetTransactionsQueryInput {
  connectedAccountId?: string;
  type?: 'ALL' | TransactionType;
  search?: string;
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
}

export interface GetTransactionsResponse {
  transactions: TransactionDTO[];
  accounts: ConnectedAccountDTO[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

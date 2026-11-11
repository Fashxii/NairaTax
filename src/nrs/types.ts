/**
 * nrs/types.ts — Data contracts for the NRS Rev360 preparation layer.
 *
 * Storage decision (Phase 0): Firestore. The ledger is stored as one document
 * per tax period (month) under `users/{email}/tax_ledger/{YYYY-MM}`, so loading
 * a full tax year costs ~12 document reads instead of one read per transaction.
 *
 * Money: every amount is an integer number of KOBO (₦1 = 100 kobo). JSON and
 * Firestore cannot hold BigInt, and Number is exact up to 2^53 kobo
 * (≈ ₦90 trillion), which is far beyond any single taxpayer ledger.
 */

/** Where a transaction came from (used for idempotent re-imports). */
export type LedgerSource = 'MONO' | 'OKRA' | 'CSV' | 'SMART_VAULT' | 'MANUAL';

/** Money flowing into (sales, income) or out of (purchases, expenses) the account. */
export type Direction = 'INFLOW' | 'OUTFLOW';

/**
 * VAT treatment of the underlying supply.
 *  - STANDARD      → VAT charged at the statutory rate (7.5%)
 *  - ZERO_RATED    → VATable at 0% (e.g. exports) — reported, no VAT
 *  - EXEMPT        → exempt supply (e.g. basic food, medical) — reported, no VAT
 *  - OUT_OF_SCOPE  → not a supply at all (salaries, transfers, tax payments, loans)
 */
export type VatTreatment = 'STANDARD' | 'ZERO_RATED' | 'EXEMPT' | 'OUT_OF_SCOPE';

/** CIT classification used to build the allowable / non-allowable expense summary. */
export type CitCategory =
  | 'SALES_REVENUE'
  | 'OTHER_INCOME'
  | 'OPERATING_EXPENSE'
  | 'CAPEX'
  | 'SALARY_PAYE'
  | 'RENT_EXPENSE'
  | 'EXEMPT_SUPPLY'
  | 'NON_ALLOWABLE'
  | 'TAX_PAYMENT'
  | 'TRANSFER'
  | 'UNCLASSIFIED';

/** Who/what decided the classification — required for an audit trail. */
export type ClassificationSource = 'RULE' | 'COUNTERPARTY_MEMORY' | 'USER' | 'DEFAULT';

export type PayeeType = 'company' | 'individual';

export interface DocumentProof {
  url?: string;
  fileName?: string;
  /** SHA-256 of the uploaded file, so a swapped receipt is detectable. */
  sha256?: string;
}

export interface ClassificationInfo {
  source: ClassificationSource;
  /** 0–1. Anything below REVIEW_THRESHOLD goes to the "Needs review" queue. */
  confidence: number;
  ruleId?: string;
  /** ISO timestamp when the user confirmed the classification, else null. */
  reviewedAt: string | null;
}

export interface LedgerTransaction {
  id: string;
  source: LedgerSource;
  /** Provider / file reference used to de-duplicate re-imports. */
  sourceRef: string;
  /** ISO calendar date, YYYY-MM-DD. */
  date: string;
  /** Tax period, YYYY-MM (derived from `date`). */
  taxPeriod: string;

  /** Gross amount as it hit the bank, in kobo, always positive. */
  amountKobo: number;
  direction: Direction;
  narration: string;

  counterpartyName?: string;
  counterpartyTin?: string;
  invoiceRef?: string;

  // ── VAT ──
  vatTreatment: VatTreatment;
  /** Rate in basis points (750 = 7.5%). 0 unless STANDARD. */
  vatRateBps: number;
  /** VAT portion of `amountKobo` (bank amounts are treated as VAT-inclusive). */
  vatKobo: number;
  /** `amountKobo - vatKobo`. */
  netKobo: number;

  // ── CIT ──
  citCategory: CitCategory;

  // ── WHT (deducted by this taxpayer on payments it makes) ──
  /** Id from WHT_RATE_SCHEDULE (e.g. 'rent', 'professional-fees') or null. */
  whtCategoryId: string | null;
  payeeType: PayeeType;
  whtRateBps: number;
  /** WHT on the VAT-exclusive amount. */
  whtKobo: number;
  whtCreditNoteRef?: string;

  documentProof?: DocumentProof;
  classification: ClassificationInfo;

  createdAt: string;
  updatedAt: string;
}

/** Fields a user (or importer) may set directly; computed fields are derived. */
export type LedgerTransactionInput = Pick<
  LedgerTransaction,
  'source' | 'sourceRef' | 'date' | 'amountKobo' | 'direction' | 'narration'
> &
  Partial<
    Pick<
      LedgerTransaction,
      'counterpartyName' | 'counterpartyTin' | 'invoiceRef' | 'documentProof' | 'payeeType'
    >
  >;

/** Editable classification fields on an existing transaction. */
export type LedgerTransactionPatch = Partial<
  Pick<
    LedgerTransaction,
    | 'citCategory'
    | 'vatTreatment'
    | 'whtCategoryId'
    | 'payeeType'
    | 'counterpartyName'
    | 'counterpartyTin'
    | 'invoiceRef'
    | 'whtCreditNoteRef'
    | 'documentProof'
    | 'narration'
  >
>;

/**
 * Filing lifecycle of a period:
 * OPEN → REVIEWED → FILED (locked) → AMENDING (unlocked for correction) → FILED …
 */
export type PeriodStatus = 'OPEN' | 'REVIEWED' | 'FILED' | 'AMENDING';

export interface AuditEntry {
  at: string;
  action:
    | 'IMPORT'
    | 'RECLASSIFY'
    | 'CONFIRM'
    | 'DELETE'
    | 'STATUS_CHANGE'
    | 'EXPORT';
  txId?: string;
  detail: string;
}

export interface PeriodMeta {
  period: string;
  status: PeriodStatus;
  filedAt?: string;
  /** Reference / acknowledgement number from the NRS portal. */
  filingRef?: string;
  amendmentCount: number;
}

/** One Firestore document per tax period. */
export interface PeriodDoc {
  period: string;
  meta: PeriodMeta;
  transactions: LedgerTransaction[];
  /** Most recent entries first, capped at MAX_AUDIT_ENTRIES. */
  audit: AuditEntry[];
}

/** User corrections remembered per counterparty (Phase 2). */
export interface CounterpartyRule {
  citCategory: CitCategory;
  vatTreatment: VatTreatment;
  whtCategoryId: string | null;
  payeeType: PayeeType;
  counterpartyTin?: string;
  updatedAt: string;
}

export type CounterpartyMemory = Record<string, CounterpartyRule>;

/** Taxpayer facts the compliance checks need. */
export interface TaxpayerFacts {
  isVatRegistered: boolean;
  taxId?: string;
  accountType: 'individual' | 'business';
}


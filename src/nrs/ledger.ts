/**
 * nrs/ledger.ts — Pure ledger operations (no I/O).
 *
 * Builds LedgerTransactions from raw input, derives VAT/WHT figures, applies
 * user corrections, enforces period locks, and records the audit trail.
 * Persistence lives in ledgerStore.ts.
 */

import { WHT_RATE_SCHEDULE } from '../utils/whtEngine';
import { classifyTransaction, counterpartyKey } from './classifier';
import { applyRate, rateToBps, vatFromInclusive } from './money';
import { getTaxYearConfig } from './taxYearConfig';
import { normalizeTin } from './tin';
import type {
  AuditEntry,
  CounterpartyMemory,
  LedgerTransaction,
  LedgerTransactionInput,
  LedgerTransactionPatch,
  PeriodDoc,
  PeriodStatus,
} from './types';

export const MAX_AUDIT_ENTRIES = 500;
/** Firestore documents max out at 1 MiB; warn well before that. */
export const PERIOD_SOFT_LIMIT = 1_200;

export function periodOf(isoDate: string): string {
  return isoDate.slice(0, 7);
}

export function isPeriodLocked(status: PeriodStatus): boolean {
  return status === 'FILED';
}

export function emptyPeriod(period: string): PeriodDoc {
  return {
    period,
    meta: { period, status: 'OPEN', amendmentCount: 0 },
    transactions: [],
    audit: [],
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `tx_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

/** WHT rate (bps) for a schedule entry and payee type; 0 if none. */
export function whtRateBpsFor(whtCategoryId: string | null, payeeType: 'company' | 'individual'): number {
  if (!whtCategoryId) return 0;
  const entry = WHT_RATE_SCHEDULE.find((r) => r.id === whtCategoryId);
  if (!entry) return 0;
  return rateToBps(payeeType === 'company' ? entry.companyRate : entry.individualRate);
}

/**
 * Recompute every derived figure from the classification fields.
 *  - Bank amounts are treated as VAT-inclusive.
 *  - VAT only applies to STANDARD supplies.
 *  - WHT only applies to OUTFLOWS (payments this taxpayer makes) and is
 *    computed on the VAT-exclusive amount.
 */
export function recompute(tx: LedgerTransaction): LedgerTransaction {
  const cfg = getTaxYearConfig(Number(tx.date.slice(0, 4)));
  const vatRateBps = tx.vatTreatment === 'STANDARD' ? cfg.vatRateBps : 0;
  const vatKobo = vatFromInclusive(tx.amountKobo, vatRateBps);
  const netKobo = tx.amountKobo - vatKobo;
  const whtRateBps = tx.direction === 'OUTFLOW' ? whtRateBpsFor(tx.whtCategoryId, tx.payeeType) : 0;
  const whtKobo = applyRate(netKobo, whtRateBps);
  return { ...tx, taxPeriod: periodOf(tx.date), vatRateBps, vatKobo, netKobo, whtRateBps, whtKobo };
}

/** Create a classified ledger transaction from importer output. */
export function buildTransaction(
  input: LedgerTransactionInput,
  memory: CounterpartyMemory = {},
): LedgerTransaction {
  const result = classifyTransaction(
    {
      narration: input.narration,
      direction: input.direction,
      counterpartyName: input.counterpartyName,
      payeeType: input.payeeType,
    },
    memory,
  );
  const ts = nowIso();
  const tin = input.counterpartyTin ?? result.counterpartyTin;
  return recompute({
    id: newId(),
    source: input.source,
    sourceRef: input.sourceRef,
    date: input.date,
    taxPeriod: periodOf(input.date),
    amountKobo: Math.abs(Math.round(input.amountKobo)),
    direction: input.direction,
    narration: input.narration.trim(),
    counterpartyName: input.counterpartyName?.trim() || undefined,
    counterpartyTin: tin ? normalizeTin(tin) : undefined,
    invoiceRef: input.invoiceRef?.trim() || undefined,
    documentProof: input.documentProof,
    vatTreatment: result.vatTreatment,
    vatRateBps: 0,
    vatKobo: 0,
    netKobo: 0,
    citCategory: result.citCategory,
    whtCategoryId: result.whtCategoryId,
    payeeType: result.payeeType,
    whtRateBps: 0,
    whtKobo: 0,
    classification: {
      source: result.source,
      confidence: result.confidence,
      ruleId: result.ruleId,
      reviewedAt: null,
    },
    createdAt: ts,
    updatedAt: ts,
  });
}

/** Apply a user edit. Any classification change counts as a user review. */
export function applyPatch(tx: LedgerTransaction, patch: LedgerTransactionPatch): LedgerTransaction {
  const ts = nowIso();
  const next: LedgerTransaction = {
    ...tx,
    ...patch,
    counterpartyTin:
      patch.counterpartyTin !== undefined
        ? patch.counterpartyTin.trim()
          ? normalizeTin(patch.counterpartyTin)
          : undefined
        : tx.counterpartyTin,
    classification: { ...tx.classification, source: 'USER', confidence: 1, reviewedAt: ts },
    updatedAt: ts,
  };
  // VAT on a non-standard supply is never claimable; WHT never applies to inflows.
  if (next.direction === 'INFLOW') next.whtCategoryId = null;
  return recompute(next);
}

/** Confirm the current classification without changing it. */
export function confirmTransaction(tx: LedgerTransaction): LedgerTransaction {
  const ts = nowIso();
  return { ...tx, classification: { ...tx.classification, reviewedAt: ts }, updatedAt: ts };
}

/** Remember a user's classification for the counterparty (feeds future imports). */
export function rememberCounterparty(memory: CounterpartyMemory, tx: LedgerTransaction): CounterpartyMemory {
  const key = counterpartyKey(tx.counterpartyName, tx.narration);
  if (!key) return memory;
  return {
    ...memory,
    [key]: {
      citCategory: tx.citCategory,
      vatTreatment: tx.vatTreatment,
      whtCategoryId: tx.whtCategoryId,
      payeeType: tx.payeeType,
      counterpartyTin: tx.counterpartyTin,
      updatedAt: nowIso(),
    },
  };
}

export function addAudit(doc: PeriodDoc, entry: Omit<AuditEntry, 'at'>): PeriodDoc {
  const audit = [{ ...entry, at: nowIso() }, ...doc.audit].slice(0, MAX_AUDIT_ENTRIES);
  return { ...doc, audit };
}

/** Identity used to drop duplicate imports. */
export function dedupeKey(tx: Pick<LedgerTransaction, 'source' | 'sourceRef'>): string {
  return `${tx.source}:${tx.sourceRef}`;
}

export interface MergeResult {
  periods: Record<string, PeriodDoc>;
  added: number;
  duplicates: number;
  /** Skipped because their period is FILED (locked). */
  locked: number;
  touched: string[];
}

/** Merge new transactions into period documents, skipping duplicates and locked periods. */
export function mergeTransactions(
  periods: Record<string, PeriodDoc>,
  incoming: LedgerTransaction[],
): MergeResult {
  const next: Record<string, PeriodDoc> = { ...periods };
  const seen = new Set<string>();
  for (const doc of Object.values(periods)) {
    for (const tx of doc.transactions) seen.add(dedupeKey(tx));
  }
  let added = 0;
  let duplicates = 0;
  let locked = 0;
  const addedPerPeriod: Record<string, number> = {};

  for (const tx of incoming) {
    const key = dedupeKey(tx);
    if (seen.has(key)) {
      duplicates++;
      continue;
    }
    const doc = next[tx.taxPeriod] ?? emptyPeriod(tx.taxPeriod);
    if (isPeriodLocked(doc.meta.status)) {
      locked++;
      continue;
    }
    seen.add(key);
    next[tx.taxPeriod] = { ...doc, transactions: [...doc.transactions, tx] };
    addedPerPeriod[tx.taxPeriod] = (addedPerPeriod[tx.taxPeriod] ?? 0) + 1;
    added++;
  }

  const touched = Object.keys(addedPerPeriod);
  for (const period of touched) {
    next[period] = addAudit(next[period], {
      action: 'IMPORT',
      detail: `Imported ${addedPerPeriod[period]} transaction(s)`,
    });
    next[period].transactions.sort((a, b) => a.date.localeCompare(b.date));
  }
  return { periods: next, added, duplicates, locked, touched };
}

/** Allowed status transitions. */
const TRANSITIONS: Record<PeriodStatus, PeriodStatus[]> = {
  OPEN: ['REVIEWED'],
  REVIEWED: ['OPEN', 'FILED'],
  FILED: ['AMENDING'],
  AMENDING: ['FILED'],
};

export function canTransition(from: PeriodStatus, to: PeriodStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function transitionPeriod(doc: PeriodDoc, to: PeriodStatus, filingRef?: string): PeriodDoc {
  if (!canTransition(doc.meta.status, to)) {
    throw new Error(`Cannot move period ${doc.period} from ${doc.meta.status} to ${to}`);
  }
  const meta = { ...doc.meta, status: to };
  if (to === 'FILED') {
    meta.filedAt = nowIso();
    if (filingRef) meta.filingRef = filingRef;
  }
  if (to === 'AMENDING') meta.amendmentCount = doc.meta.amendmentCount + 1;
  return addAudit(
    { ...doc, meta },
    {
      action: 'STATUS_CHANGE',
      detail: `${doc.meta.status} → ${to}${filingRef ? ` (ref ${filingRef})` : ''}`,
    },
  );
}


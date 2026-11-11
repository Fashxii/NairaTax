/**
 * nrs/ledgerStore.ts — Persistence for the tax ledger.
 *
 * Layout (Firestore): users/{email}/tax_ledger/{YYYY-MM}  →  PeriodDoc
 *  - One document per month keeps reads cheap (12 reads per year of data).
 *  - localStorage holds a cached copy for instant load and offline use.
 *  - The demo account and unverified sessions stay local-only.
 *  - FILED periods are locked here AND in firestore.rules.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { collection, doc, getDocs, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useSession } from '../context/SessionContext';
import { getStored, setStored } from '../utils/store';
import { isDemoSession, scopedKey, useUserPersistedState } from '../utils/userScope';
import {
  addAudit,
  applyPatch,
  buildTransaction,
  confirmTransaction,
  emptyPeriod,
  isPeriodLocked,
  mergeTransactions,
  PERIOD_SOFT_LIMIT,
  rememberCounterparty,
  transitionPeriod,
  type MergeResult,
} from './ledger';
import type {
  AuditEntry,
  CounterpartyMemory,
  LedgerTransaction,
  LedgerTransactionInput,
  LedgerTransactionPatch,
  PeriodDoc,
  PeriodStatus,
} from './types';

export interface OpResult {
  ok: boolean;
  error?: string;
}

/** Firestore rejects `undefined`; JSON round-trip drops those keys. */
function toFirestore(docData: PeriodDoc): Record<string, unknown> {
  return { ...JSON.parse(JSON.stringify(docData)), updatedAt: serverTimestamp() };
}

function isPeriodDoc(value: unknown): value is PeriodDoc {
  const v = value as PeriodDoc;
  return !!v && typeof v.period === 'string' && Array.isArray(v.transactions) && !!v.meta;
}

export function useTaxLedger() {
  const { session } = useSession();
  const isDemo = isDemoSession(session);
  const email = (session.contactMethod || '').toLowerCase().trim();
  const cloudEnabled = !isDemo && session.isVerified && !!email;
  const localKey = scopedKey(session, 'nrs_ledger');

  const [periods, setPeriodsState] = useState<Record<string, PeriodDoc>>(() => getStored(localKey, {}));
  const [loading, setLoading] = useState<boolean>(cloudEnabled);
  const [syncError, setSyncError] = useState<string | null>(null);
  const periodsRef = useRef(periods);
  periodsRef.current = periods;

  const [memory, setMemory] = useUserPersistedState<CounterpartyMemory>('nrs_counterparty_memory', {});
  const memoryRef = useRef(memory);
  memoryRef.current = memory;

  // Load: local cache first, then Firestore (remote wins per period).
  useEffect(() => {
    const local = getStored<Record<string, PeriodDoc>>(localKey, {});
    setPeriodsState(local);
    if (!cloudEnabled) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    getDocs(collection(db, 'users', email, 'tax_ledger'))
      .then((snap) => {
        if (!alive) return;
        const merged = { ...local };
        snap.forEach((d) => {
          const data = d.data();
          if (isPeriodDoc(data)) {
            merged[d.id] = { period: data.period, meta: data.meta, transactions: data.transactions, audit: data.audit ?? [] };
          }
        });
        setPeriodsState(merged);
        setStored(localKey, merged);
        setSyncError(null);
      })
      .catch((err: Error) => {
        if (alive) setSyncError(`Cloud sync unavailable — working from this device. (${err.message})`);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [localKey, cloudEnabled, email]);

  /** Save changed periods locally and (if enabled) to Firestore. */
  const commit = useCallback(
    (next: Record<string, PeriodDoc>, touched: string[]) => {
      periodsRef.current = next;
      setPeriodsState(next);
      setStored(localKey, next);
      if (!cloudEnabled || touched.length === 0) return;
      Promise.all(
        touched.map((p) => setDoc(doc(db, 'users', email, 'tax_ledger', p), toFirestore(next[p]))),
      )
        .then(() => setSyncError(null))
        .catch((err: Error) => setSyncError(`Saved on this device; cloud save failed (${err.message}).`));
    },
    [cloudEnabled, email, localKey],
  );

  const findTx = (txId: string): { period: string; tx: LedgerTransaction } | null => {
    for (const [period, d] of Object.entries(periodsRef.current)) {
      const tx = d.transactions.find((t) => t.id === txId);
      if (tx) return { period, tx };
    }
    return null;
  };

  const importInputs = useCallback(
    (inputs: LedgerTransactionInput[]): MergeResult & { oversized: string[] } => {
      const built = inputs.map((i) => buildTransaction(i, memoryRef.current));
      const result = mergeTransactions(periodsRef.current, built);
      commit(result.periods, result.touched);
      const oversized = result.touched.filter((p) => result.periods[p].transactions.length > PERIOD_SOFT_LIMIT);
      return { ...result, oversized };
    },
    [commit],
  );

  const mutateTx = useCallback(
    (txId: string, fn: (tx: LedgerTransaction) => LedgerTransaction | null, audit: Omit<AuditEntry, 'at' | 'txId'>): OpResult => {
      const found = findTx(txId);
      if (!found) return { ok: false, error: 'Transaction not found' };
      const current = periodsRef.current[found.period];
      if (isPeriodLocked(current.meta.status)) {
        return { ok: false, error: `${found.period} is filed and locked. Start an amendment to make changes.` };
      }
      const updated = fn(found.tx);
      const transactions = updated
        ? current.transactions.map((t) => (t.id === txId ? updated : t))
        : current.transactions.filter((t) => t.id !== txId);
      const nextDoc = addAudit({ ...current, transactions }, { ...audit, txId });
      commit({ ...periodsRef.current, [found.period]: nextDoc }, [found.period]);
      return { ok: true };
    },
    [commit],
  );

  const updateTransaction = useCallback(
    (txId: string, patch: LedgerTransactionPatch, remember = true): OpResult => {
      const holder: { tx?: LedgerTransaction } = {};
      const res = mutateTx(
        txId,
        (tx) => (holder.tx = applyPatch(tx, patch)),
        { action: 'RECLASSIFY', detail: `Updated: ${Object.keys(patch).join(', ')}` },
      );
      const saved = holder.tx;
      if (res.ok && remember && saved) setMemory((m) => rememberCounterparty(m, saved));
      return res;
    },
    [mutateTx, setMemory],
  );

  const confirmTransactions = useCallback(
    (txIds: string[]): number => {
      let next = { ...periodsRef.current };
      const touched = new Set<string>();
      let count = 0;
      for (const [period, d] of Object.entries(next)) {
        if (isPeriodLocked(d.meta.status)) continue;
        let changed = 0;
        const transactions = d.transactions.map((t) => {
          if (!txIds.includes(t.id) || t.classification.reviewedAt) return t;
          changed++;
          return confirmTransaction(t);
        });
        if (changed > 0) {
          next = { ...next, [period]: addAudit({ ...d, transactions }, { action: 'CONFIRM', detail: `Confirmed ${changed} classification(s)` }) };
          touched.add(period);
          count += changed;
        }
      }
      commit(next, [...touched]);
      return count;
    },
    [commit],
  );

  const deleteTransaction = useCallback(
    (txId: string): OpResult => mutateTx(txId, () => null, { action: 'DELETE', detail: 'Transaction removed' }),
    [mutateTx],
  );

  const setPeriodStatus = useCallback(
    (period: string, to: PeriodStatus, filingRef?: string): OpResult => {
      const current = periodsRef.current[period] ?? emptyPeriod(period);
      try {
        const nextDoc = transitionPeriod(current, to, filingRef);
        commit({ ...periodsRef.current, [period]: nextDoc }, [period]);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: (err as Error).message };
      }
    },
    [commit],
  );

  const logExport = useCallback(
    (period: string, detail: string) => {
      const current = periodsRef.current[period];
      if (!current) return;
      commit({ ...periodsRef.current, [period]: addAudit(current, { action: 'EXPORT', detail }) }, [period]);
    },
    [commit],
  );

  const allTransactions = useMemo(
    () =>
      Object.values(periods)
        .flatMap((d) => d.transactions)
        .sort((a, b) => b.date.localeCompare(a.date)),
    [periods],
  );

  return {
    periods,
    allTransactions,
    loading,
    syncError,
    cloudEnabled,
    memory,
    importInputs,
    updateTransaction,
    confirmTransactions,
    deleteTransaction,
    setPeriodStatus,
    logExport,
  };
}

/**
 * userScope.ts — Identity helpers + per-user data scoping.
 *
 * - Display names always come from the signed-in user's registered name
 *   (session → local registry → email), never from hardcoded sample names.
 * - Persisted data is keyed per user so people sharing a browser never
 *   see each other's records.
 * - Sample data is only shown to the clearly-labelled guest demo account.
 */

import { useSession } from '../context/SessionContext';
import { usePersistedState } from '../hooks/usePersistedState';
import { findUserByEmail } from './authStore';
import type { UserSession } from '../types';
import { DEMO_EMAIL, isDemoSession } from './demo';

export { DEMO_EMAIL, isDemoSession };

/** Full registered name for display, with sensible non-fake fallbacks. */
export function getDisplayName(session: Pick<UserSession, 'fullName' | 'contactMethod'>): string {
  const fromSession = session.fullName?.trim();
  if (fromSession) return fromSession;
  const email = (session.contactMethod || '').trim();
  const fromRegistry = email ? findUserByEmail(email)?.fullName?.trim() : '';
  if (fromRegistry) return fromRegistry;
  const local = email.split('@')[0];
  return local ? local.charAt(0).toUpperCase() + local.slice(1) : 'there';
}

/** First name for greetings (business accounts use the full company name). */
export function getGreetingName(session: Pick<UserSession, 'fullName' | 'contactMethod' | 'accountType'>): string {
  const name = getDisplayName(session);
  if (session.accountType === 'business') return name;
  return name.split(/\s+/)[0] || name;
}

/** Initial(s) for avatars. */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Storage key scoped to the signed-in user. */
export function scopedKey(session: Pick<UserSession, 'contactMethod'>, key: string): string {
  const owner = (session.contactMethod || 'anonymous').toLowerCase().trim();
  return `${key}:${owner}`;
}

import { useEffect, useCallback, useRef } from 'react';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Per-user persisted state.
 * - Backed by localStorage for 0ms initial load.
 * - Synchronizes with Firestore cloud persistence under users/{email}/user_data/{key}
 *   for verified real accounts.
 * - Automatically migrates existing local data to Firestore on first cloud connection.
 * - Kept strictly local for the demo account.
 */
export function useUserPersistedState<T>(
  key: string,
  emptyValue: T,
  demoValue?: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const { session } = useSession();
  const isDemo = isDemoSession(session);
  const initial = isDemo && demoValue !== undefined ? demoValue : emptyValue;
  const storageKey = scopedKey(session, key);
  const [value, setLocalValue] = usePersistedState<T>(storageKey, initial);

  const valueRef = useRef(value);
  valueRef.current = value;

  // Cloud sync for verified non-demo users
  useEffect(() => {
    if (isDemo || !session.isVerified || !session.contactMethod) return;

    let isMounted = true;
    const cleanEmail = session.contactMethod.toLowerCase().trim();
    const docRef = doc(db, 'users', cleanEmail, 'user_data', key);

    // Initial fetch from Firestore
    getDoc(docRef)
      .then((snap) => {
        if (!isMounted) return;
        if (snap.exists()) {
          const remoteData = snap.data()?.data as T;
          if (remoteData !== undefined) {
            setLocalValue(remoteData);
          }
        } else {
          // If Firestore is empty but user has existing local data, migrate to Firestore
          const current = valueRef.current;
          const hasLocalData = Array.isArray(current)
            ? current.length > 0
            : typeof current === 'number'
            ? current > 0
            : current !== null && current !== undefined && current !== emptyValue;

          if (hasLocalData) {
            setDoc(docRef, { data: current, updatedAt: serverTimestamp() }, { merge: true }).catch((err) => {
              console.warn(`[Firestore Migration] ${key}:`, err?.message);
            });
          }
        }
      })
      .catch((err) => {
        // Fallback gracefully to local storage if offline or permissions pending
        console.warn(`[Firestore Sync] ${key}:`, err?.message);
      });

    return () => {
      isMounted = false;
    };
  }, [key, session.contactMethod, session.isVerified, isDemo, setLocalValue, emptyValue]);

  const setValue = useCallback(
    (action: T | ((prev: T) => T)) => {
      setLocalValue((prev) => {
        const next = typeof action === 'function' ? (action as (prev: T) => T)(prev) : action;
        // Asynchronously persist to Firestore for verified users
        if (!isDemo && session.isVerified && session.contactMethod) {
          const cleanEmail = session.contactMethod.toLowerCase().trim();
          const docRef = doc(db, 'users', cleanEmail, 'user_data', key);
          setDoc(docRef, { data: next, updatedAt: serverTimestamp() }, { merge: true }).catch((err) => {
            console.warn(`[Firestore Write] ${key}:`, err?.message);
          });
        }
        return next;
      });
    },
    [isDemo, session.isVerified, session.contactMethod, key, setLocalValue]
  );

  return [value, setValue];
}


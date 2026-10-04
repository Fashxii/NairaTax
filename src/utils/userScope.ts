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

export const DEMO_EMAIL = 'demo@diytax9ja.ng';

export function isDemoSession(session: Pick<UserSession, 'contactMethod'>): boolean {
  return (session.contactMethod || '').toLowerCase() === DEMO_EMAIL;
}

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

/**
 * Per-user persisted state. Real users start with `emptyValue`;
 * the guest demo account starts with `demoValue`.
 */
export function useUserPersistedState<T>(
  key: string,
  emptyValue: T,
  demoValue?: T
): [T, (value: T | ((prev: T) => T)) => void] {
  const { session } = useSession();
  const initial = isDemoSession(session) && demoValue !== undefined ? demoValue : emptyValue;
  return usePersistedState<T>(scopedKey(session, key), initial);
}

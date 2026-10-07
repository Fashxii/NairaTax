/**
 * demo.ts — Guest demo account identity (dependency-free so any module,
 * including SessionContext, can import it without circular imports).
 */
import type { UserSession } from '../types';

export const DEMO_EMAIL = 'demo@diytax9ja.ng';

export function isDemoSession(session: Pick<UserSession, 'contactMethod'>): boolean {
  return (session.contactMethod || '').toLowerCase() === DEMO_EMAIL;
}

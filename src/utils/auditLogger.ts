/**
 * auditLogger.ts — Audit Logging System
 *
 * Every entry is kept in a local ring buffer (for offline use and for the
 * taxpayer's own security events) and, when the signed-in Firebase user holds
 * a staff role, is also appended to Firestore `admin_audit_logs`. That
 * collection is append-only under firestore.rules (no updates or deletes) and
 * readable with the `audit.view` permission, so it is a platform-wide trail
 * rather than a per-browser one.
 */

import { getStored, setStored } from './store';
import { auth, db } from '../lib/firebase';
import { addDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export type AuditModule =
  | 'System Config'
  | 'User Management'
  | 'Security & API'
  | 'Filing Engine'
  | 'Roles & Permissions'
  | 'Tax Rules'
  | 'Content'
  | 'Platform';

export const AUDIT_MODULES: AuditModule[] = [
  'System Config', 'User Management', 'Roles & Permissions', 'Tax Rules',
  'Content', 'Platform', 'Security & API', 'Filing Engine',
];

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  module: AuditModule;
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress: string;
  timestamp: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  /** 'cloud' entries come from Firestore and are visible to all auditors. */
  source?: 'local' | 'cloud';
}

const AUDIT_STORE_KEY = 'diytax_system_audit_logs';

/** Initial foundational bootstrap logs when registry is fresh */
function getInitialBootstrapLogs(): AuditLogEntry[] {
  return [
    {
      id: 'log_boot_001',
      actorName: 'System Kernel',
      actorEmail: 'system@diytax9ja.ng',
      action: 'SYSTEM_BOOTSTRAP_INITIALIZED',
      module: 'System Config',
      severity: 'INFO',
      ipAddress: '127.0.0.1',
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
      afterState: { platform: 'DIYtax9ja Nigeria', env: 'production', v: '2.0.0' },
    },
  ];
}

/** Get all recorded audit logs from local store */
export function getLocalAuditLogs(): AuditLogEntry[] {
  const logs = getStored<AuditLogEntry[]>(AUDIT_STORE_KEY, []);
  if (logs.length === 0) {
    const bootstrap = getInitialBootstrapLogs();
    setStored(AUDIT_STORE_KEY, bootstrap);
    return bootstrap;
  }
  return logs;
}

/** Append to Firestore when the signed-in user is staff (claims checked server-side too). */
async function persistToCloud(entry: AuditLogEntry): Promise<void> {
  const user = auth?.currentUser;
  if (!user || !db) return;
  try {
    const token = await user.getIdTokenResult();
    const role = token.claims.role;
    if (typeof role !== 'string' || role === 'taxpayer') return;
    const email = typeof token.claims.email === 'string' ? token.claims.email : user.email;
    if (!email) return;
    await addDoc(collection(db, 'admin_audit_logs'), JSON.parse(JSON.stringify({
      ...entry,
      // Rules require actorEmail to match the authenticated identity.
      actorEmail: email,
      actorRole: role,
      createdAt: new Date().toISOString(),
      source: undefined,
    })));
  } catch (err) {
    console.debug('Audit log cloud write skipped:', err);
  }
}

/** Record a new audit log entry */
export function recordAuditLog(entry: Omit<AuditLogEntry, 'id' | 'timestamp' | 'ipAddress'> & { ipAddress?: string }): AuditLogEntry {
  const currentLogs = getLocalAuditLogs();
  const newLog: AuditLogEntry = {
    id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString().replace('T', ' ').slice(0, 19),
    ipAddress: entry.ipAddress || 'Client Web Session',
    ...entry,
  };

  const updated = [newLog, ...currentLogs].slice(0, 200); // retain latest 200 events
  setStored(AUDIT_STORE_KEY, updated);
  void persistToCloud(newLog);
  return newLog;
}

function toTimestamp(value: unknown): string {
  const d = typeof value === 'string' || typeof value === 'number' ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toISOString().replace('T', ' ').slice(0, 19)
    : new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Platform-wide admin audit trail + email delivery events, merged with this browser's local log. */
export async function fetchCombinedAuditLogs(): Promise<AuditLogEntry[]> {
  const local = getLocalAuditLogs().map((l) => ({ ...l, source: 'local' as const }));
  if (!db) return local;

  const cloud: AuditLogEntry[] = [];
  try {
    const snap = await getDocs(query(collection(db, 'admin_audit_logs'), orderBy('createdAt', 'desc'), limit(300)));
    snap.forEach((d) => {
      const data = d.data();
      cloud.push({
        id: `cloud_${d.id}`,
        actorName: data.actorName || data.actorEmail || 'Unknown',
        actorEmail: data.actorEmail || '',
        action: data.action || 'UNKNOWN',
        module: data.module || 'System Config',
        severity: data.severity || 'INFO',
        ipAddress: data.actorRole ? `role:${data.actorRole}` : 'Cloud',
        timestamp: toTimestamp(data.createdAt),
        beforeState: data.beforeState,
        afterState: data.afterState,
        source: 'cloud',
      });
    });
  } catch (err) {
    console.debug('admin_audit_logs not readable:', err);
  }

  try {
    // sendEmailFn writes { templateKey, recipientEmail, subject, status, messageId, sentAt, mode }.
    const snap = await getDocs(query(collection(db, 'email_audit_logs'), orderBy('sentAt', 'desc'), limit(100)));
    snap.forEach((d) => {
      const data = d.data();
      cloud.push({
        id: `email_${d.id}`,
        actorName: 'Email Gateway',
        actorEmail: data.recipientEmail || '',
        action: `EMAIL_${String(data.templateKey || 'SEND').toUpperCase()}_${String(data.status || 'SENT').toUpperCase()}`,
        module: 'Security & API',
        severity: data.status && data.status !== 'Sent' ? 'CRITICAL' : 'INFO',
        ipAddress: data.mode || 'Cloud Worker',
        timestamp: toTimestamp(data.sentAt),
        afterState: { subject: data.subject, status: data.status, messageId: data.messageId },
        source: 'cloud',
      });
    });
  } catch (err) {
    console.debug('email_audit_logs not readable:', err);
  }

  // Local entries that were also persisted to the cloud appear twice; prefer cloud copies.
  const cloudKeys = new Set(cloud.map((c) => `${c.action}|${c.actorEmail}|${c.timestamp.slice(0, 16)}`));
  const merged = [
    ...cloud,
    ...local.filter((l) => !cloudKeys.has(`${l.action}|${l.actorEmail}|${l.timestamp.slice(0, 16)}`)),
  ];
  merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  return merged;
}

/**
 * auditLogger.ts — Real Audit Logging System
 *
 * Persists real user activity, tax filings, security events, and administrative
 * actions. Replaces all hardcoded mock audit trails with real telemetry and
 * integrates with Cloud Firestore `/email_audit_logs` where accessible.
 */

import { getStored, setStored } from './store';
import { db } from '../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  module: 'System Config' | 'User Management' | 'Security & API' | 'Filing Engine';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress: string;
  timestamp: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
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
  return newLog;
}

/** Fetch live email audit logs from Firestore and merge with local audit logs */
export async function fetchCombinedAuditLogs(): Promise<AuditLogEntry[]> {
  const local = getLocalAuditLogs();

  if (!db) {
    return local;
  }

  try {
    const q = query(collection(db, 'email_audit_logs'), orderBy('timestamp', 'desc'), limit(50));
    const snapshot = await getDocs(q);

    const cloudLogs: AuditLogEntry[] = snapshot.docs.map((docSnap) => {
      const data = docSnap.data();
      const ts = data.timestamp ? new Date(data.timestamp).toISOString().replace('T', ' ').slice(0, 19) : new Date().toISOString().replace('T', ' ').slice(0, 19);
      return {
        id: `cloud_${docSnap.id}`,
        actorName: data.email || 'Email Gateway',
        actorEmail: data.email || 'smtp@diytax9ja.ng',
        action: `EMAIL_DISPATCH_${(data.type || 'OTP').toUpperCase()}`,
        module: 'Security & API',
        severity: data.success ? 'INFO' : 'CRITICAL',
        ipAddress: data.ip || 'Cloud Worker',
        timestamp: ts,
        beforeState: undefined,
        afterState: {
          type: data.type,
          success: data.success,
          error: data.error || null,
        },
      };
    });

    // Merge and deduplicate by ID, sorted by timestamp descending
    const combined = [...local, ...cloudLogs];
    const seen = new Set<string>();
    const deduplicated = combined.filter((item) => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    deduplicated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    return deduplicated;
  } catch (err) {
    // If permission or offline, gracefully return local logs
    console.debug('Firestore email audit logs query not available; returning local logs:', err);
    return local;
  }
}

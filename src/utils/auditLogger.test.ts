import { describe, it, expect, beforeEach } from 'vitest';
import { getLocalAuditLogs, recordAuditLog, fetchCombinedAuditLogs } from './auditLogger';
import { setStored } from './store';

describe('auditLogger', () => {
  beforeEach(() => {
    setStored('diytax_system_audit_logs', []);
  });

  it('initializes bootstrap log when storage is empty', () => {
    const logs = getLocalAuditLogs();
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0].action).toBe('SYSTEM_BOOTSTRAP_INITIALIZED');
    expect(logs[0].module).toBe('System Config');
  });

  it('records an audit log entry prepended to the list', () => {
    const entry = recordAuditLog({
      actorName: 'Samson Ade',
      actorEmail: 'samson@example.com',
      action: 'USER_LOGIN',
      module: 'Security & API',
      severity: 'INFO',
      afterState: { role: 'super_admin' },
    });

    expect(entry.id).toContain('log_');
    expect(entry.actorName).toBe('Samson Ade');
    expect(entry.actorEmail).toBe('samson@example.com');
    expect(entry.action).toBe('USER_LOGIN');
    expect(entry.timestamp).toBeDefined();

    const storedLogs = getLocalAuditLogs();
    expect(storedLogs[0].id).toBe(entry.id);
  });

  it('fetches combined logs falling back gracefully to local logs in non-auth test env', async () => {
    recordAuditLog({
      actorName: 'Test Reviewer',
      actorEmail: 'reviewer@diytax9ja.ng',
      action: 'REASSIGN_USER_ROLE',
      module: 'User Management',
      severity: 'WARN',
    });

    const combined = await fetchCombinedAuditLogs();
    expect(combined.length).toBeGreaterThanOrEqual(2);
    expect(combined[0].action).toBe('REASSIGN_USER_ROLE');
  });
});

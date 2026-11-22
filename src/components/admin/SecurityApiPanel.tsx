/**
 * SecurityApiPanel.tsx — Security policy & posture.
 *
 * Replaces the former API-key / IP-whitelist screen, which stored fake keys in
 * localStorage and was enforced nowhere. This panel holds controls that are
 * actually applied (session policy) and an honest security posture checklist.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Timer, Save, Lock, CheckCircle2, AlertTriangle, CircleDashed } from 'lucide-react';
import { useToast } from '../Toast';
import { usePermissions } from '../../admin/usePermissions';
import { usePlatformSettingsState, savePlatformSettings, describeWriteError } from '../../admin/platformStore';
import { SESSION_LIMITS, type SessionPolicy } from '../../admin/platformSettings';
import { recordAuditLog } from '../../utils/auditLogger';

type Status = 'done' | 'deploy' | 'open';

/** Findings from the Nov 2026 backend review and the v1.0 security review, with remediation status. */
const POSTURE: { title: string; detail: string; status: Status }[] = [
  { title: 'SMTP settings endpoint requires staff permission', detail: 'testSMTP verifies the caller’s ID token and the “Configure SMTP” permission; public mail hosts and standard ports only.', status: 'done' },
  { title: 'Email send endpoint is no longer an open relay', detail: 'sendEmailFn requires staff with “Send test emails”; recipients, headers and attachments are validated.', status: 'done' },
  { title: 'Sign-in code request no longer leaks profile data', detail: 'sendOTP returns only the account type, and no longer creates accounts before the code is verified.', status: 'done' },
  { title: 'Sign-in code brute force blocked', detail: 'Attempts are counted in a transaction before comparison (constant-time), with per-email and per-IP limits.', status: 'done' },
  { title: 'Role changes & suspensions revoke sessions', detail: 'A Firestore trigger re-issues claims, revokes refresh tokens and disables suspended Auth users.', status: 'done' },
  { title: 'Permission matrix is Super Admin only', detail: 'roles.manage cannot be delegated, and roles that hand out roles cannot be assigned by staff.', status: 'done' },
  { title: 'Self-declared NIN cannot pose as verified', detail: 'Owners may record a masked NIN only; verification flags are reserved for the server.', status: 'done' },
  { title: 'Platform-wide, append-only audit trail', detail: 'Entries carry a server timestamp and a fixed schema (no edits, deletes or back-dating).', status: 'done' },
  { title: 'SMTP password encrypted at rest', detail: 'AES-256-GCM with a key in Secret Manager; never stored in the browser.', status: 'done' },
  { title: 'Security headers on Hosting', detail: 'HSTS, X-Frame-Options DENY, nosniff, Referrer/Permissions-Policy. CSP runs in report-only mode first.', status: 'done' },
  { title: 'Leaked legacy password removed', detail: 'Dead app/api code deleted and purged from git history. The password must be changed wherever it was reused.', status: 'done' },
  { title: 'Enforce Firebase App Check', detail: 'Wired in monitor mode. Create the reCAPTCHA Enterprise key, set VITE_RECAPTCHA_ENTERPRISE_SITE_KEY, then set APP_CHECK_ENFORCE=true.', status: 'open' },
  { title: 'Enforce the Content-Security-Policy', detail: 'Switch from report-only to enforcing after a clean week.', status: 'open' },
  { title: 'MFA for staff accounts', detail: 'Email OTP is the only factor today. Add TOTP/passkeys for admin roles (Phase 3).', status: 'open' },
];

const STATUS_META: Record<Status, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  done: { label: 'Live', cls: 'text-emerald-700 bg-emerald-50 border-emerald-200', Icon: CheckCircle2 },
  deploy: { label: 'Built — deploy pending', cls: 'text-sky-700 bg-sky-50 border-sky-200', Icon: CircleDashed },
  open: { label: 'Open', cls: 'text-amber-700 bg-amber-50 border-amber-200', Icon: AlertTriangle },
};

export default function SecurityApiPanel() {
  const { showToast } = useToast();
  const { can, actorEmail, actorName } = usePermissions();
  const live = usePlatformSettingsState();
  const canEdit = can('system.security_policy');
  const [policy, setPolicy] = useState<SessionPolicy>(live.value.sessionPolicy);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(policy) !== JSON.stringify(live.value.sessionPolicy);

  useEffect(() => {
    if (!dirty) setPolicy(live.value.sessionPolicy);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.value]);

  const save = async () => {
    const { inactivityMinutes, absoluteHours } = policy;
    const lim = SESSION_LIMITS;
    if (inactivityMinutes < lim.inactivityMinutes.min || inactivityMinutes > lim.inactivityMinutes.max || absoluteHours < lim.absoluteHours.min || absoluteHours > lim.absoluteHours.max) {
      showToast('error', 'Out of range', `Inactivity ${lim.inactivityMinutes.min}–${lim.inactivityMinutes.max} min; session ${lim.absoluteHours.min}–${lim.absoluteHours.max} h.`);
      return;
    }
    setSaving(true);
    try {
      await savePlatformSettings({ ...live.value, sessionPolicy: policy }, actorEmail);
      recordAuditLog({
        actorName, actorEmail, action: 'UPDATE_SESSION_POLICY', module: 'Security & API', severity: 'WARN',
        beforeState: { ...live.value.sessionPolicy }, afterState: { ...policy },
      });
      showToast('success', 'Session policy published');
    } catch (err) {
      showToast('error', 'Not saved', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const counts = POSTURE.reduce((acc, p) => ({ ...acc, [p.status]: (acc[p.status] ?? 0) + 1 }), {} as Record<Status, number>);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      <div className="bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <h3 className="text-lg font-black text-primary-container tracking-tight flex items-center gap-2"><ShieldCheck className="w-5 h-5" /> Security</h3>
        <p className="text-xs text-on-surface-variant mt-1">Session policy and the platform’s security posture.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40">
            <Timer className="w-4 h-4 text-primary-container" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Session policy</h4>
          </div>
          {!canEdit && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: requires “Session security policy”.</p>}
          <label className="block text-xs">
            <span className="font-bold block mb-1">Sign out after inactivity (minutes)</span>
            <input type="number" min={SESSION_LIMITS.inactivityMinutes.min} max={SESSION_LIMITS.inactivityMinutes.max} disabled={!canEdit}
              value={policy.inactivityMinutes} onChange={(e) => setPolicy((p) => ({ ...p, inactivityMinutes: parseInt(e.target.value) || 0 }))}
              className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" />
          </label>
          <label className="block text-xs">
            <span className="font-bold block mb-1">Maximum session length (hours)</span>
            <input type="number" min={SESSION_LIMITS.absoluteHours.min} max={SESSION_LIMITS.absoluteHours.max} disabled={!canEdit}
              value={policy.absoluteHours} onChange={(e) => setPolicy((p) => ({ ...p, absoluteHours: parseInt(e.target.value) || 0 }))}
              className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" />
          </label>
          <p className="text-[10px] text-on-surface-variant">Applied to taxpayers and staff in every open browser. Enforced in the app; Firebase ID tokens additionally expire hourly.</p>
          {canEdit && (
            <button onClick={save} disabled={!dirty || saving} className="w-full h-10 bg-primary-container text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Save className="w-3.5 h-3.5 text-accent-green" /> {saving ? 'Publishing…' : 'Publish policy'}
            </button>
          )}
        </div>

        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant/40">
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Security posture</h4>
            <span className="text-[11px] text-on-surface-variant">{counts.deploy ?? 0} awaiting deploy · {counts.open ?? 0} open</span>
          </div>
          <ul className="space-y-2">
            {POSTURE.map((p) => {
              const m = STATUS_META[p.status];
              return (
                <li key={p.title} className="flex items-start gap-3 p-3 rounded-xl border border-outline-variant/60">
                  <m.Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${m.cls.split(' ')[0]}`} />
                  <div className="flex-1 min-w-0 text-xs">
                    <p className="font-bold text-on-surface">{p.title}</p>
                    <p className="text-[11px] text-on-surface-variant">{p.detail}</p>
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border whitespace-nowrap ${m.cls}`}>{m.label}</span>
                </li>
              );
            })}
          </ul>
          <p className="text-[10px] text-on-surface-variant">The former API-key and IP-whitelist screen was removed: keys were stored only in this browser and were not checked anywhere.</p>
        </div>
      </div>
    </motion.div>
  );
}

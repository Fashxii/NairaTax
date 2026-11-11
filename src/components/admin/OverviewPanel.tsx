/**
 * OverviewPanel.tsx — Admin console home: live KPIs and quick actions.
 * Every number comes from Firestore or the live platform configuration.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Users, UserX, ShieldCheck, Sliders, Wrench, Megaphone, KeyRound, Scale, FileText, ArrowRight, BadgeCheck, AlertTriangle, RefreshCw,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { usePermissions } from '../../admin/usePermissions';
import { usePlatformSettingsState } from '../../admin/platformStore';
import { FEATURE_FLAGS, isAnnouncementVisible } from '../../admin/platformSettings';
import { roleLabel, type PermissionId } from '../../admin/permissions';
import { getTaxYearConfig } from '../../nrs/taxYearConfig';
import { fetchCombinedAuditLogs, type AuditLogEntry } from '../../utils/auditLogger';
import type { ConsoleTab } from './SuperAdminDashboard';

interface UserStats {
  total: number;
  taxpayers: number;
  suspended: number;
  business: number;
  byRole: Record<string, number>;
  newLast30: number;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  if (typeof v === 'string' || typeof v === 'number') { const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
  const o = v as { toDate?: () => Date; seconds?: number };
  if (typeof o.toDate === 'function') return o.toDate();
  if (typeof o.seconds === 'number') return new Date(o.seconds * 1000);
  return null;
}

export default function OverviewPanel({ onNavigate }: { onNavigate: (tab: ConsoleTab) => void }) {
  const { can, rbac, rbacPublished, roleLabel: myRole } = usePermissions();
  const settings = usePlatformSettingsState().value;
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [recent, setRecent] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    if (can('users.view')) {
      try {
        const snap = await getDocs(collection(db, 'users'));
        const s: UserStats = { total: 0, taxpayers: 0, suspended: 0, business: 0, byRole: {}, newLast30: 0 };
        const cutoff = Date.now() - 30 * 86400_000;
        snap.forEach((d) => {
          const u = d.data();
          const role = (u.role as string) || 'taxpayer';
          s.total++;
          s.byRole[role] = (s.byRole[role] ?? 0) + 1;
          if (role === 'taxpayer') s.taxpayers++;
          if (u.isActive === false) s.suspended++;
          if (u.accountType === 'business') s.business++;
          const created = toDate(u.createdAt);
          if (created && created.getTime() >= cutoff) s.newLast30++;
        });
        setStats(s);
        setStatsError(null);
      } catch (err) {
        setStatsError((err as Error).message);
      }
    }
    if (can('audit.view')) {
      try {
        setRecent((await fetchCombinedAuditLogs()).filter((l) => l.source === 'cloud').slice(0, 6));
      } catch { /* ignore */ }
    }
    setLoading(false);
  };

  useEffect(() => { void load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const flagsOn = FEATURE_FLAGS.filter((f) => settings.flags[f.id]).length;
  const year = new Date().getFullYear();
  const taxYear = getTaxYearConfig(year);
  const announcementLive = isAnnouncementVisible(settings.announcement, 'individual') || isAnnouncementVisible(settings.announcement, 'business');
  const staffCount = stats ? stats.total - stats.taxpayers : null;

  const kpis = [
    { label: 'Registered users', value: stats ? stats.total.toLocaleString() : '—', sub: stats ? `${stats.newLast30} new in 30 days` : statsError ? 'Unavailable' : can('users.view') ? 'Loading…' : 'No access', Icon: Users, cls: 'bg-primary-container/10 text-primary-container' },
    { label: 'Staff accounts', value: staffCount ?? '—', sub: stats ? `${stats.business} business taxpayers` : '', Icon: ShieldCheck, cls: 'bg-violet-100 text-violet-800' },
    { label: 'Suspended', value: stats ? stats.suspended : '—', sub: 'Blocked from sign-in', Icon: UserX, cls: 'bg-red-100 text-red-800' },
    { label: 'Feature flags', value: `${flagsOn}/${FEATURE_FLAGS.length}`, sub: settings.maintenance.enabled ? 'MAINTENANCE ON' : 'Platform online', Icon: Sliders, cls: settings.maintenance.enabled ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800' },
  ];

  const actions: { tab: ConsoleTab; label: string; desc: string; Icon: typeof Users; perm: PermissionId[] }[] = [
    { tab: 'users', label: 'Manage users', desc: 'Suspend, assign roles, statutory overrides', Icon: Users, perm: ['users.view'] },
    { tab: 'roles', label: 'Roles & permissions', desc: rbacPublished ? 'Edit the permission matrix' : 'Publish the matrix to activate server enforcement', Icon: KeyRound, perm: ['roles.manage'] },
    { tab: 'settings', label: 'Feature flags', desc: 'Turn features on or off; maintenance', Icon: Sliders, perm: ['system.flags', 'system.maintenance'] },
    { tab: 'tax-rules', label: 'Tax rules', desc: taxYear.verified ? `${taxYear.year} verified` : `${taxYear.year} awaiting adviser sign-off`, Icon: Scale, perm: ['tax_rules.edit', 'tax_rules.verify'] },
    { tab: 'content', label: 'Content & announcements', desc: announcementLive ? 'An announcement is live' : 'Edit site copy or broadcast a banner', Icon: Megaphone, perm: ['cms.edit', 'announcements.manage'] },
    { tab: 'audit', label: 'Audit trail', desc: 'Review who changed what', Icon: FileText, perm: ['audit.view'] },
  ];

  const alerts: { tone: 'warn' | 'bad'; text: string; tab?: ConsoleTab }[] = [];
  if (settings.maintenance.enabled) alerts.push({ tone: 'bad', text: 'Maintenance mode is ON — taxpayers cannot use the platform.', tab: 'settings' });
  if (!rbacPublished) alerts.push({ tone: 'warn', text: 'Permission matrix not published — non-super-admin staff fail server checks until it is.', tab: 'roles' });
  if (!taxYear.verified) alerts.push({ tone: 'warn', text: `${taxYear.year} tax thresholds have not been signed off by a tax adviser.`, tab: 'tax-rules' });

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <div key={k.label} className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${k.cls}`}><k.Icon className="w-5 h-5" /></div>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{k.label}</p>
              <p className="text-xl font-black text-primary-container font-mono">{k.value}</p>
              <p className="text-[10px] text-on-surface-variant truncate">{k.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div key={a.text} className={`p-3 rounded-xl border flex items-center gap-3 text-xs ${a.tone === 'bad' ? 'bg-red-50 border-red-200 text-red-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
              {a.tone === 'bad' ? <Wrench className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
              <span className="flex-1">{a.text}</span>
              {a.tab && <button onClick={() => onNavigate(a.tab!)} className="font-bold underline cursor-pointer">Fix</button>}
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-3">
          <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-container">Quick actions</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {actions.filter((a) => a.perm.some((p) => can(p))).map((a) => (
              <button key={a.tab} onClick={() => onNavigate(a.tab)} className="group text-left bg-white border border-outline-variant rounded-xl p-4 shadow-xs hover:border-primary-container transition-colors cursor-pointer flex items-start gap-3">
                <a.Icon className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                <span className="flex-1 min-w-0">
                  <span className="font-bold text-sm text-on-surface block">{a.label}</span>
                  <span className="text-[11px] text-on-surface-variant block">{a.desc}</span>
                </span>
                <ArrowRight className="w-4 h-4 text-on-surface-variant group-hover:text-primary-container" />
              </button>
            ))}
          </div>

          {stats && (
            <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-xs">
              <p className="text-xs font-extrabold uppercase tracking-wider text-primary-container mb-2">Users by role</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(stats.byRole).sort((a, b) => b[1] - a[1]).map(([role, n]) => (
                  <span key={role} className="text-[11px] px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant font-bold">{roleLabel(role, rbac)}: {n}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-primary-container">Recent admin activity</h4>
            <button onClick={() => void load()} className="p-1 rounded hover:bg-surface-container cursor-pointer" aria-label="Refresh"><RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /></button>
          </div>
          <div className="bg-white border border-outline-variant rounded-xl shadow-xs divide-y divide-outline-variant/40">
            {!can('audit.view') ? (
              <p className="p-4 text-xs text-on-surface-variant">Your role ({myRole}) cannot view the audit trail.</p>
            ) : recent.length === 0 ? (
              <p className="p-4 text-xs text-on-surface-variant">No platform-wide entries yet. Staff actions appear here once recorded.</p>
            ) : recent.map((r) => (
              <div key={r.id} className="p-3 text-xs">
                <p className="font-bold text-on-surface font-mono text-[11px]">{r.action}</p>
                <p className="text-[10px] text-on-surface-variant">{r.actorEmail} · {r.timestamp}</p>
              </div>
            ))}
          </div>
          <div className="bg-white border border-outline-variant rounded-xl p-4 shadow-xs text-xs space-y-1.5">
            <p className="font-extrabold uppercase tracking-wider text-primary-container text-[10px]">Platform state</p>
            <p className="flex items-center gap-1.5">{rbacPublished ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />} Permission matrix {rbacPublished ? 'published' : 'not published'}</p>
            <p className="flex items-center gap-1.5">{taxYear.verified ? <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />} {taxYear.year} tax rules {taxYear.verified ? 'verified' : 'unverified'}</p>
            <p className="flex items-center gap-1.5"><Megaphone className="w-3.5 h-3.5 text-on-surface-variant" /> Announcement {announcementLive ? 'live' : 'off'}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );
}


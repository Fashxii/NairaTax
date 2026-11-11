/**
 * admin/platformSettings.ts — Global platform settings (feature flags,
 * maintenance mode, session policy, announcement banner).
 *
 * Stored in Firestore `platform_config/settings` (publicly readable, so the
 * landing page can honour maintenance mode before sign-in). Every field here
 * has a real consumer in the app — no cosmetic toggles.
 */

export type FeatureFlag =
  | 'nrsReturns'
  | 'bankSync'
  | 'eInvoicing'
  | 'payroll'
  | 'tccReadiness'
  | 'whtTracker'
  | 'citCalculator'
  | 'stampDutyCgt'
  | 'taxPlanner'
  | 'advisor'
  | 'receiptScanner'
  | 'demoAccess'
  | 'selfRegistration';

export interface FeatureFlagDef {
  id: FeatureFlag;
  label: string;
  description: string;
  /** Where the flag takes effect, shown to admins. */
  affects: string;
}

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  { id: 'nrsReturns', label: 'NRS Returns workspace', description: 'Bank-statement ledger, VAT/WHT/CIT schedules and exports.', affects: 'Dashboard → NRS Returns tab' },
  { id: 'bankSync', label: 'Bank sync & CSV import', description: 'Auto-sync bank feeds panel on the overview.', affects: 'Dashboard → Overview' },
  { id: 'eInvoicing', label: 'E-Invoicing', description: 'Create VAT invoices and PDFs.', affects: 'Dashboard → E-Invoicing tab' },
  { id: 'payroll', label: 'Payroll & PAYE', description: 'Employee payroll and payslips (business accounts).', affects: 'Dashboard → Payroll tab' },
  { id: 'tccReadiness', label: 'TCC readiness', description: 'Tax Clearance Certificate readiness checker.', affects: 'Dashboard → TCC Readiness tab' },
  { id: 'whtTracker', label: 'WHT tracker', description: 'Withholding-tax deduction tracker.', affects: 'Dashboard → WHT Tracker tab' },
  { id: 'citCalculator', label: 'CIT calculator', description: 'Company income tax calculator.', affects: 'Dashboard → CIT Calculator tab' },
  { id: 'stampDutyCgt', label: 'Stamp duty & CGT', description: 'Stamp duty and capital gains calculators.', affects: 'Dashboard → Stamp Duty & CGT tab' },
  { id: 'taxPlanner', label: 'Tax planner', description: 'What-if relief planner.', affects: 'Dashboard → Tax Planner tab' },
  { id: 'advisor', label: 'Guides & advisor', description: 'Rule-based tax guidance chat.', affects: 'Dashboard → Guides & Advisor tab' },
  { id: 'receiptScanner', label: 'Smart Vault receipt entry', description: 'Floating "add receipt" button.', affects: 'Dashboard → floating button' },
  { id: 'demoAccess', label: 'Guest demo access', description: 'Let visitors explore the demo dashboard without signing up.', affects: 'Landing page → demo buttons' },
  { id: 'selfRegistration', label: 'New sign-ups', description: 'Allow new taxpayers to register.', affects: 'Landing page → Create account, /register' },
];

export type AnnouncementTone = 'info' | 'warning' | 'critical';
export type AnnouncementAudience = 'all' | 'individual' | 'business';

export interface Announcement {
  enabled: boolean;
  message: string;
  tone: AnnouncementTone;
  audience: AnnouncementAudience;
  /** YYYY-MM-DD; the banner hides after this date. Empty = no expiry. */
  expiresOn: string;
}

export interface SessionPolicy {
  inactivityMinutes: number;
  absoluteHours: number;
}

export interface PlatformSettings {
  flags: Record<FeatureFlag, boolean>;
  maintenance: { enabled: boolean; message: string };
  sessionPolicy: SessionPolicy;
  announcement: Announcement;
  updatedAt?: string;
  updatedBy?: string;
}

export const SESSION_LIMITS = {
  inactivityMinutes: { min: 2, max: 120 },
  absoluteHours: { min: 1, max: 72 },
};

export function defaultSettings(): PlatformSettings {
  return {
    flags: Object.fromEntries(FEATURE_FLAGS.map((f) => [f.id, true])) as Record<FeatureFlag, boolean>,
    maintenance: {
      enabled: false,
      message: 'DIYtax9ja is undergoing scheduled maintenance. Please check back shortly.',
    },
    sessionPolicy: { inactivityMinutes: 5, absoluteHours: 24 },
    announcement: { enabled: false, message: '', tone: 'info', audience: 'all', expiresOn: '' },
  };
}

function clamp(n: unknown, min: number, max: number, fallback: number): number {
  const v = typeof n === 'number' && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.min(max, Math.max(min, v));
}

/** Repair a settings document loaded from Firestore. */
export function normalizeSettings(raw: unknown): PlatformSettings {
  const base = defaultSettings();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<PlatformSettings>;

  if (r.flags && typeof r.flags === 'object') {
    for (const f of FEATURE_FLAGS) {
      const v = (r.flags as Record<string, unknown>)[f.id];
      if (typeof v === 'boolean') base.flags[f.id] = v;
    }
  }
  if (r.maintenance && typeof r.maintenance === 'object') {
    base.maintenance.enabled = r.maintenance.enabled === true;
    if (typeof r.maintenance.message === 'string' && r.maintenance.message.trim()) base.maintenance.message = r.maintenance.message;
  }
  if (r.sessionPolicy && typeof r.sessionPolicy === 'object') {
    base.sessionPolicy = {
      inactivityMinutes: clamp(r.sessionPolicy.inactivityMinutes, SESSION_LIMITS.inactivityMinutes.min, SESSION_LIMITS.inactivityMinutes.max, 5),
      absoluteHours: clamp(r.sessionPolicy.absoluteHours, SESSION_LIMITS.absoluteHours.min, SESSION_LIMITS.absoluteHours.max, 24),
    };
  }
  if (r.announcement && typeof r.announcement === 'object') {
    const a = r.announcement;
    base.announcement = {
      enabled: a.enabled === true,
      message: typeof a.message === 'string' ? a.message.slice(0, 500) : '',
      tone: a.tone === 'warning' || a.tone === 'critical' ? a.tone : 'info',
      audience: a.audience === 'individual' || a.audience === 'business' ? a.audience : 'all',
      expiresOn: typeof a.expiresOn === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(a.expiresOn) ? a.expiresOn : '',
    };
  }
  return { ...base, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
}

/** Whether the announcement should show for this account type today. */
export function isAnnouncementVisible(
  a: Announcement,
  accountType: 'individual' | 'business',
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (!a.enabled || !a.message.trim()) return false;
  if (a.expiresOn && today > a.expiresOn) return false;
  return a.audience === 'all' || a.audience === accountType;
}


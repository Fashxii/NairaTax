/**
 * admin/permissions.ts — Permission catalog, built-in roles and resolution.
 *
 * The live matrix is stored in Firestore `platform_config/rbac` and is read by:
 *  - the admin console (to show/hide tabs and actions), and
 *  - firestore.rules `hasPerm()` (to enforce the same permissions server-side), and
 *  - Cloud Functions (email endpoints, role validation at sign-in).
 *
 * `super_admin` always has every permission and cannot be edited — this
 * prevents an accidental lock-out of the platform.
 */

export type PermissionId =
  // Users & access
  | 'users.view'
  | 'users.view_pii'
  | 'users.create'
  | 'users.suspend'
  | 'users.delete'
  | 'roles.assign'
  | 'roles.manage'
  | 'overrides.statutory'
  // Taxpayer oversight
  | 'filings.view'
  | 'nrs.unlock_period'
  // Tax rules
  | 'tax_rules.view'
  | 'tax_rules.edit'
  | 'tax_rules.verify'
  // Content & communications
  | 'cms.edit'
  | 'announcements.manage'
  | 'email.templates.view'
  | 'email.send_test'
  | 'email.settings'
  | 'email.logs.view'
  // Platform
  | 'system.flags'
  | 'system.maintenance'
  | 'system.security_policy'
  // Audit & reporting
  | 'audit.view'
  | 'audit.export'
  | 'reports.view'
  // Planned
  | 'tcc.review';

/**
 * Where a permission is enforced:
 *  - server  → Firestore rules or Cloud Functions reject the action (cannot be bypassed)
 *  - client  → UI gating only (the underlying data is already protected some other way, or not sensitive)
 *  - planned → the feature it governs is not built yet
 */
export type Enforcement = 'server' | 'client' | 'planned';
export type Risk = 'low' | 'medium' | 'high' | 'critical';

export interface PermissionDef {
  id: PermissionId;
  label: string;
  description: string;
  module: PermissionModule;
  enforcement: Enforcement;
  risk: Risk;
}

export type PermissionModule =
  | 'Users & Access'
  | 'Taxpayer Oversight'
  | 'Tax Rules'
  | 'Content & Communications'
  | 'Platform'
  | 'Audit & Reporting'
  | 'TCC (planned)';

export const PERMISSIONS: PermissionDef[] = [
  { id: 'users.view', module: 'Users & Access', label: 'View user directory', description: 'List and search registered taxpayers and staff.', enforcement: 'server', risk: 'medium' },
  { id: 'users.view_pii', module: 'Users & Access', label: 'View personal details', description: 'See registration profile, masked NIN and income details in the user inspector.', enforcement: 'client', risk: 'high' },
  { id: 'users.create', module: 'Users & Access', label: 'Provision taxpayer accounts', description: 'Create taxpayer records. Only Super Admins can create staff.', enforcement: 'server', risk: 'medium' },
  { id: 'users.suspend', module: 'Users & Access', label: 'Suspend / reactivate taxpayers', description: 'Block sign-in for a taxpayer. Also revokes their active sessions.', enforcement: 'server', risk: 'high' },
  { id: 'users.delete', module: 'Users & Access', label: 'Delete taxpayer records', description: 'Remove a taxpayer profile record.', enforcement: 'server', risk: 'critical' },
  { id: 'roles.assign', module: 'Users & Access', label: 'Assign staff roles', description: 'Change a user\'s role (cannot grant Super Admin).', enforcement: 'server', risk: 'critical' },
  { id: 'roles.manage', module: 'Users & Access', label: 'Edit roles & permission matrix', description: 'Create custom roles and change what each role can do.', enforcement: 'server', risk: 'critical' },
  { id: 'overrides.statutory', module: 'Users & Access', label: 'Apply statutory overrides', description: 'Approve reliefs and force CIT bracket / VAT status for a taxpayer.', enforcement: 'server', risk: 'high' },

  { id: 'filings.view', module: 'Taxpayer Oversight', label: 'View filings & NRS ledgers', description: 'Read a taxpayer\'s filings, saved data and NRS ledger periods.', enforcement: 'server', risk: 'high' },
  { id: 'nrs.unlock_period', module: 'Taxpayer Oversight', label: 'Open amendments on filed periods', description: 'Unlock a FILED NRS period so the taxpayer can correct it.', enforcement: 'server', risk: 'high' },

  { id: 'tax_rules.view', module: 'Tax Rules', label: 'View tax rules', description: 'See thresholds, VAT and WHT rates in the admin console.', enforcement: 'client', risk: 'low' },
  { id: 'tax_rules.edit', module: 'Tax Rules', label: 'Edit tax rules', description: 'Change NRS thresholds, due dates and WHT rates used by every taxpayer.', enforcement: 'server', risk: 'critical' },
  { id: 'tax_rules.verify', module: 'Tax Rules', label: 'Sign off tax rules (adviser)', description: 'Mark a tax year as verified by a tax adviser.', enforcement: 'client', risk: 'high' },

  { id: 'cms.edit', module: 'Content & Communications', label: 'Edit & publish site content', description: 'Change landing-page and dashboard copy for all visitors.', enforcement: 'server', risk: 'medium' },
  { id: 'announcements.manage', module: 'Content & Communications', label: 'Broadcast announcements', description: 'Show a banner to all taxpayers on their dashboard.', enforcement: 'server', risk: 'medium' },
  { id: 'email.templates.view', module: 'Content & Communications', label: 'View email templates', description: 'Preview transactional email templates.', enforcement: 'client', risk: 'low' },
  { id: 'email.send_test', module: 'Content & Communications', label: 'Send test emails', description: 'Send a template test email through the platform mailer.', enforcement: 'server', risk: 'medium' },
  { id: 'email.settings', module: 'Content & Communications', label: 'Configure SMTP', description: 'Change the outgoing mail server used for all platform emails.', enforcement: 'server', risk: 'critical' },
  { id: 'email.logs.view', module: 'Content & Communications', label: 'View email delivery logs', description: 'See which emails were sent, to whom, and their status.', enforcement: 'server', risk: 'medium' },

  { id: 'system.flags', module: 'Platform', label: 'Toggle feature flags', description: 'Turn product features on or off for all taxpayers.', enforcement: 'server', risk: 'high' },
  { id: 'system.maintenance', module: 'Platform', label: 'Maintenance mode', description: 'Block taxpayer access (staff remain able to sign in).', enforcement: 'server', risk: 'critical' },
  { id: 'system.security_policy', module: 'Platform', label: 'Session security policy', description: 'Set inactivity and absolute session timeouts.', enforcement: 'server', risk: 'high' },

  { id: 'audit.view', module: 'Audit & Reporting', label: 'View audit trail', description: 'Read the platform-wide admin audit log.', enforcement: 'server', risk: 'medium' },
  { id: 'audit.export', module: 'Audit & Reporting', label: 'Export audit trail', description: 'Download audit entries as CSV.', enforcement: 'client', risk: 'medium' },
  { id: 'reports.view', module: 'Audit & Reporting', label: 'View platform metrics', description: 'See the overview dashboard (user counts, flags, health).', enforcement: 'client', risk: 'low' },

  { id: 'tcc.review', module: 'TCC (planned)', label: 'Review TCC applications', description: 'Approve or reject Tax Clearance Certificate applications (workflow not built yet).', enforcement: 'planned', risk: 'high' },
];

export const PERMISSION_IDS = PERMISSIONS.map((p) => p.id);
export const PERMISSION_MODULES: PermissionModule[] = [
  'Users & Access',
  'Taxpayer Oversight',
  'Tax Rules',
  'Content & Communications',
  'Platform',
  'Audit & Reporting',
  'TCC (planned)',
];

export function isPermissionId(value: unknown): value is PermissionId {
  return typeof value === 'string' && (PERMISSION_IDS as string[]).includes(value);
}

// ─── Roles ───────────────────────────────────────────────────────────────────

export const SUPER_ADMIN = 'super_admin';
export const TAXPAYER = 'taxpayer';

export interface RoleDef {
  id: string;
  label: string;
  description: string;
  permissions: PermissionId[];
  builtIn: boolean;
}

export interface RbacConfig {
  roles: Record<string, RoleDef>;
  updatedAt?: string;
  updatedBy?: string;
}

/** Defaults shipped with the app; used until a Super Admin publishes the matrix. */
export const BUILT_IN_ROLES: RoleDef[] = [
  {
    id: SUPER_ADMIN,
    label: 'Super Admin',
    description: 'Full platform control. Always has every permission.',
    permissions: [...PERMISSION_IDS],
    builtIn: true,
  },
  {
    id: 'content_manager',
    label: 'Content Manager',
    description: 'Owns site copy, announcements and email content.',
    permissions: ['cms.edit', 'announcements.manage', 'email.templates.view', 'email.send_test', 'email.logs.view', 'tax_rules.view', 'reports.view'],
    builtIn: true,
  },
  {
    id: 'reviewer',
    label: 'Compliance Reviewer',
    description: 'Reviews taxpayer filings, NRS ledgers and statutory overrides.',
    permissions: ['users.view', 'users.view_pii', 'filings.view', 'nrs.unlock_period', 'overrides.statutory', 'tax_rules.view', 'reports.view', 'tcc.review'],
    builtIn: true,
  },
  {
    id: 'support_agent',
    label: 'Support Agent',
    description: 'Helps taxpayers with access problems; can suspend and reactivate taxpayers.',
    permissions: ['users.view', 'users.suspend', 'filings.view', 'email.logs.view', 'tax_rules.view', 'reports.view'],
    builtIn: true,
  },
  {
    id: 'finance_auditor',
    label: 'Tax Adviser / Auditor',
    description: 'Signs off tax rules; read-only access to filings and the audit trail.',
    permissions: ['users.view', 'filings.view', 'tax_rules.view', 'tax_rules.edit', 'tax_rules.verify', 'audit.view', 'audit.export', 'reports.view'],
    builtIn: true,
  },
];

export const BUILT_IN_ROLE_IDS = BUILT_IN_ROLES.map((r) => r.id);

export function defaultRbac(): RbacConfig {
  return {
    roles: Object.fromEntries(BUILT_IN_ROLES.map((r) => [r.id, { ...r, permissions: [...r.permissions] }])),
  };
}

/** Validate/repair a matrix loaded from Firestore. Unknown permissions are dropped. */
export function normalizeRbac(raw: unknown): RbacConfig {
  const base = defaultRbac();
  if (!raw || typeof raw !== 'object') return base;
  const src = (raw as { roles?: unknown }).roles;
  if (src && typeof src === 'object') {
    for (const [id, value] of Object.entries(src as Record<string, unknown>)) {
      if (!isValidRoleId(id) || id === TAXPAYER || !value || typeof value !== 'object') continue;
      const v = value as Partial<RoleDef>;
      const builtIn = BUILT_IN_ROLE_IDS.includes(id);
      base.roles[id] = {
        id,
        label: typeof v.label === 'string' && v.label.trim() ? v.label.trim() : base.roles[id]?.label ?? id,
        description: typeof v.description === 'string' ? v.description : base.roles[id]?.description ?? '',
        permissions: Array.isArray(v.permissions) ? v.permissions.filter(isPermissionId) : base.roles[id]?.permissions ?? [],
        builtIn,
      };
    }
  }
  // Super admin is never editable.
  base.roles[SUPER_ADMIN] = { ...BUILT_IN_ROLES[0], permissions: [...PERMISSION_IDS] };
  const r = raw as RbacConfig;
  return { ...base, updatedAt: r.updatedAt, updatedBy: r.updatedBy };
}

/** Role ids: lowercase letters, digits and underscores, 3–32 chars. */
export function isValidRoleId(id: string): boolean {
  return /^[a-z][a-z0-9_]{2,31}$/.test(id);
}

export function slugifyRoleId(label: string): string {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
}

export function permissionsForRole(role: string | undefined | null, rbac: RbacConfig): Set<PermissionId> {
  if (!role || role === TAXPAYER) return new Set();
  if (role === SUPER_ADMIN) return new Set(PERMISSION_IDS);
  return new Set(rbac.roles[role]?.permissions ?? []);
}

export function can(role: string | undefined | null, permission: PermissionId, rbac: RbacConfig): boolean {
  return permissionsForRole(role, rbac).has(permission);
}

export function isStaffRole(role: string | undefined | null, rbac: RbacConfig): boolean {
  return !!role && role !== TAXPAYER && (role === SUPER_ADMIN || role in rbac.roles);
}

export function roleLabel(role: string, rbac: RbacConfig): string {
  if (role === TAXPAYER) return 'Taxpayer';
  return rbac.roles[role]?.label ?? role;
}


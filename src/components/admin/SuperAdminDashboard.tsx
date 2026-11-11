/**
 * SuperAdminDashboard.tsx — Unified Admin Console for all staff roles.
 *
 * Tabs are shown according to the signed-in staff member's permissions (from
 * the live RBAC matrix). Server-side, the same permissions are enforced by
 * firestore.rules and the Cloud Functions, so hiding a tab is a convenience,
 * not the security boundary.
 */

import { useEffect, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  LayoutDashboard, Users, KeyRound, Sliders, Scale, Megaphone, Shield, FileText, Mail,
  LogOut, Sun, Moon, ShieldAlert, Settings, Layers, BarChart3,
} from 'lucide-react';
import { useAppContext } from '../../AppShell';
import { getDisplayName } from '../../utils/userScope';
import { usePermissions } from '../../admin/usePermissions';
import type { PermissionId } from '../../admin/permissions';
import OverviewPanel from './OverviewPanel';
import RolesPermissionsPanel from './RolesPermissionsPanel';
import SystemSettingsPanel from './SystemSettingsPanel';
import TaxRulesPanel from './TaxRulesPanel';
import ContentPanel from './ContentPanel';
import UserManagementPanel from './UserManagementPanel';
import SecurityApiPanel from './SecurityApiPanel';
import AuditLogViewer from './AuditLogViewer';
import EmailSettingsPanel from './EmailSettingsPanel';
import EmailTemplateManager from './EmailTemplateManager';
import EmailAuditLogViewer from './EmailAuditLogViewer';

export type ConsoleTab = 'overview' | 'users' | 'roles' | 'settings' | 'tax-rules' | 'content' | 'security' | 'audit' | 'communications';
/** @deprecated kept for backwards compatibility with older imports */
export type SuperAdminTab = ConsoleTab;
export type EmailSubTab = 'smtp' | 'templates' | 'delivery-logs';

const TABS: { id: ConsoleTab; label: string; Icon: typeof Users; /** visible if the user has ANY of these (empty = all staff) */ perms: PermissionId[] }[] = [
  { id: 'overview', label: 'Overview', Icon: LayoutDashboard, perms: [] },
  { id: 'users', label: 'Users & Access', Icon: Users, perms: ['users.view'] },
  { id: 'roles', label: 'Roles & Permissions', Icon: KeyRound, perms: [] },
  { id: 'settings', label: 'Platform Settings', Icon: Sliders, perms: ['system.flags', 'system.maintenance'] },
  { id: 'tax-rules', label: 'Tax Rules', Icon: Scale, perms: ['tax_rules.view', 'tax_rules.edit', 'tax_rules.verify'] },
  { id: 'content', label: 'Content', Icon: Megaphone, perms: ['cms.edit', 'announcements.manage'] },
  { id: 'security', label: 'Security', Icon: Shield, perms: ['system.security_policy'] },
  { id: 'audit', label: 'Audit Logs', Icon: FileText, perms: ['audit.view'] },
  { id: 'communications', label: 'Communications', Icon: Mail, perms: ['email.settings', 'email.templates.view', 'email.logs.view'] },
];

export default function SuperAdminDashboard() {
  const { session, handleLogout, theme, onToggleTheme } = useAppContext();
  const { canAny, can, roleLabel, role } = usePermissions();
  const [activeTab, setActiveTab] = useState<ConsoleTab>('overview');
  const [emailSubTab, setEmailSubTab] = useState<EmailSubTab>('smtp');

  const visibleTabs = TABS.filter((t) => t.perms.length === 0 || canAny(...t.perms));
  const emailTabs = ([
    { id: 'smtp', label: 'SMTP Setup', Icon: Settings, perm: 'email.settings', cls: 'bg-emerald-50 text-emerald-700' },
    { id: 'templates', label: 'Templates', Icon: Layers, perm: 'email.templates.view', cls: 'bg-violet-50 text-violet-700' },
    { id: 'delivery-logs', label: 'Delivery Logs', Icon: BarChart3, perm: 'email.logs.view', cls: 'bg-blue-50 text-blue-700' },
  ] as const).filter((t) => can(t.perm));

  // If permissions change (matrix republished) and the current tab disappears, fall back.
  useEffect(() => {
    if (!visibleTabs.some((t) => t.id === activeTab)) setActiveTab('overview');
  }, [visibleTabs, activeTab]);
  useEffect(() => {
    if (emailTabs.length && !emailTabs.some((t) => t.id === emailSubTab)) setEmailSubTab(emailTabs[0].id);
  }, [emailTabs, emailSubTab]);

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface flex flex-col font-sans">
      <header className="bg-primary-container text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-accent-green/20 border border-accent-green/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-lg tracking-tight">DIYtax9ja</span>
                <span className={`${role === 'super_admin' ? 'bg-error/80' : 'bg-white/20'} text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider`}>
                  {roleLabel}
                </span>
              </div>
              <p className="text-[10px] text-white/70">Admin Console · System Administration &amp; Governance</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button onClick={onToggleTheme} className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer" aria-label="Toggle theme">
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-200" />}
            </button>
            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/10 text-xs">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="font-semibold text-white/90">{getDisplayName(session)}</span>
            </div>
            <button onClick={handleLogout} className="flex items-center space-x-1.5 bg-error/20 hover:bg-error/30 text-white border border-error/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer">
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        <nav className="bg-white border border-outline-variant rounded-2xl p-2 shadow-xs flex items-center gap-1 overflow-x-auto" role="tablist" aria-label="Admin console sections">
          {visibleTabs.map(({ id, label, Icon }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === id ? 'bg-primary-container text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          {activeTab === 'overview' && <OverviewPanel key="overview" onNavigate={setActiveTab} />}
          {activeTab === 'users' && <UserManagementPanel key="users" />}
          {activeTab === 'roles' && <RolesPermissionsPanel key="roles" />}
          {activeTab === 'settings' && <SystemSettingsPanel key="settings" />}
          {activeTab === 'tax-rules' && <TaxRulesPanel key="tax-rules" />}
          {activeTab === 'content' && <ContentPanel key="content" />}
          {activeTab === 'security' && <SecurityApiPanel key="security" />}
          {activeTab === 'audit' && <AuditLogViewer key="audit" />}
          {activeTab === 'communications' && (
            <div key="communications" className="space-y-5">
              <div className="bg-white border border-outline-variant rounded-2xl p-2 shadow-xs flex items-center gap-2">
                {emailTabs.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setEmailSubTab(t.id)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                      emailSubTab === t.id ? `${t.cls} shadow-xs` : 'text-on-surface-variant hover:bg-surface-container-low'
                    }`}
                  >
                    <t.Icon className="w-3.5 h-3.5" />
                    {t.label}
                  </button>
                ))}
              </div>
              <AnimatePresence mode="wait">
                {emailSubTab === 'smtp' && can('email.settings') && <EmailSettingsPanel key="email-smtp" />}
                {emailSubTab === 'templates' && can('email.templates.view') && <EmailTemplateManager key="email-templates" />}
                {emailSubTab === 'delivery-logs' && can('email.logs.view') && <EmailAuditLogViewer key="email-logs" />}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

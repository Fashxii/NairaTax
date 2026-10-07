import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import {
  Sliders,
  Users,
  Shield,
  FileText,
  LogOut,
  Sun,
  Moon,
  ShieldAlert,
  Key,
  CheckCircle,
  Mail,
  Settings,
  Layers,
  BarChart3,
} from 'lucide-react';
import { useAppContext } from '../../AppShell';
import { getDisplayName } from '../../utils/userScope';
import { useNavigate } from 'react-router-dom';
import SystemSettingsPanel from './SystemSettingsPanel';
import UserManagementPanel from './UserManagementPanel';
import SecurityApiPanel from './SecurityApiPanel';
import AuditLogViewer from './AuditLogViewer';
import EmailSettingsPanel from './EmailSettingsPanel';
import EmailTemplateManager from './EmailTemplateManager';
import EmailAuditLogViewer from './EmailAuditLogViewer';

export type SuperAdminTab = 'settings' | 'users' | 'security' | 'audit' | 'communications';
export type EmailSubTab = 'smtp' | 'templates' | 'delivery-logs';

export default function SuperAdminDashboard() {
  const { session, handleLogout, theme, onToggleTheme } = useAppContext();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('settings');
  const [emailSubTab, setEmailSubTab] = useState<EmailSubTab>('smtp');

  const onLogout = () => {
    handleLogout();
  };

  return (
    <div className="min-h-screen bg-surface-container-low text-on-surface flex flex-col font-sans">
      {/* 1. Header Navigation Bar */}
      <header className="bg-primary-container text-white px-6 py-4 shadow-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-accent-green/20 border border-accent-green/40 flex items-center justify-center">
              <ShieldAlert className="w-5 h-5 text-accent-green" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-black text-lg tracking-tight">DIYtax9ja</span>
                <span className="bg-error/80 text-white text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Super Admin
                </span>
              </div>
              <p className="text-[10px] text-white/70">Enterprise System Administration &amp; Governance</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-200" />}
            </button>

            <div className="hidden sm:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-white/10 text-xs">
              <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
              <span className="font-semibold text-white/90">{getDisplayName(session)}</span>
            </div>

            <button
              onClick={onLogout}
              className="flex items-center space-x-1.5 bg-error/20 hover:bg-error/30 text-white border border-error/40 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Main Executive Content Area */}
      <main className="flex-grow max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* KPI Stats Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-primary-container/10 text-primary-container flex items-center justify-center flex-shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Registered Users</p>
              <p className="text-xl font-black text-primary-container font-mono">25,480</p>
            </div>
          </div>

          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center flex-shrink-0">
              <CheckCircle className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Active Features</p>
              <p className="text-xl font-black text-emerald-800 font-mono">4 / 4 Flags</p>
            </div>
          </div>

          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center flex-shrink-0">
              <Key className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Active API Keys</p>
              <p className="text-xl font-black text-blue-800 font-mono">3 Keys</p>
            </div>
          </div>

          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Security Alerts</p>
              <p className="text-xl font-black text-amber-800 font-mono">0 Active Threats</p>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Header */}
        <div className="bg-white border border-outline-variant rounded-2xl p-2 shadow-xs flex items-center gap-2 overflow-x-auto">
          <button
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'settings'
                ? 'bg-primary-container text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>System Defaults</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'users'
                ? 'bg-primary-container text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>User RBAC &amp; Access</span>
          </button>

          <button
            onClick={() => setActiveTab('security')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'security'
                ? 'bg-primary-container text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Security &amp; API Keys</span>
          </button>

          <button
            onClick={() => setActiveTab('audit')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'audit'
                ? 'bg-primary-container text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => setActiveTab('communications')}
            className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'communications'
                ? 'bg-primary-container text-white shadow-xs'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low'
            }`}
          >
            <Mail className="w-4 h-4" />
            <span>Communications</span>
          </button>
        </div>

        {/* Tab View Container */}
        <AnimatePresence mode="wait">
          {activeTab === 'settings' && <SystemSettingsPanel key="settings" />}
          {activeTab === 'users' && <UserManagementPanel key="users" />}
          {activeTab === 'security' && <SecurityApiPanel key="security" />}
          {activeTab === 'audit' && <AuditLogViewer key="audit" />}
          {activeTab === 'communications' && (
            <div key="communications" className="space-y-5">
              {/* Email Sub-tab Navigation */}
              <div className="bg-white border border-outline-variant rounded-2xl p-2 shadow-xs flex items-center gap-2">
                <button
                  onClick={() => setEmailSubTab('smtp')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    emailSubTab === 'smtp' ? 'bg-emerald-50 text-emerald-700 shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <Settings className="w-3.5 h-3.5" />
                  SMTP Setup
                </button>
                <button
                  onClick={() => setEmailSubTab('templates')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    emailSubTab === 'templates' ? 'bg-violet-50 text-violet-700 shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  Templates
                </button>
                <button
                  onClick={() => setEmailSubTab('delivery-logs')}
                  className={`px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                    emailSubTab === 'delivery-logs' ? 'bg-blue-50 text-blue-700 shadow-xs' : 'text-on-surface-variant hover:bg-surface-container-low'
                  }`}
                >
                  <BarChart3 className="w-3.5 h-3.5" />
                  Delivery Logs
                </button>
              </div>

              <AnimatePresence mode="wait">
                {emailSubTab === 'smtp' && <EmailSettingsPanel key="email-smtp" />}
                {emailSubTab === 'templates' && <EmailTemplateManager key="email-templates" />}
                {emailSubTab === 'delivery-logs' && <EmailAuditLogViewer key="email-logs" />}
              </AnimatePresence>
            </div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}

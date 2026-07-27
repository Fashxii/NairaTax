import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Users, UserCog, Edit, CheckCircle, LogOut, ShieldAlert,
  Settings, Sun, Moon, Bell, Plus, X, Search, MoreVertical,
  Trash2, Shield, Mail, Calendar
} from 'lucide-react';
import { UserSession, AdminDashboardTab, AdminRole, AdminUser } from '../types';
import CMSManager from './CMSManager';

// ── Seed data for demo ──────────────────────────────────────────────
const INITIAL_ADMIN_USERS: AdminUser[] = [
  {
    id: 'au1',
    fullName: 'Adebayo Ogunlade',
    email: 'adebayo@diytax9ja.ng',
    role: 'super_admin',
    status: 'active',
    createdAt: '2025-06-01',
    lastLogin: '2026-07-20'
  },
  {
    id: 'au2',
    fullName: 'Fatima Bello',
    email: 'fatima.b@diytax9ja.ng',
    role: 'content_manager',
    status: 'active',
    createdAt: '2025-09-14',
    lastLogin: '2026-07-19'
  },
  {
    id: 'au3',
    fullName: 'Emeka Nwosu',
    email: 'emeka.n@diytax9ja.ng',
    role: 'reviewer',
    status: 'active',
    createdAt: '2026-01-10',
    lastLogin: '2026-07-18'
  },
  {
    id: 'au4',
    fullName: 'Ngozi Eze',
    email: 'ngozi.e@diytax9ja.ng',
    role: 'reviewer',
    status: 'suspended',
    createdAt: '2026-03-22'
  }
];

// ── Role metadata ───────────────────────────────────────────────────
const ROLE_META: Record<AdminRole, { label: string; color: string; bgColor: string; desc: string }> = {
  super_admin: {
    label: 'Super Admin',
    color: 'text-error',
    bgColor: 'bg-error/10',
    desc: 'Full system access – Users, Roles, CMS, TCC Approvals & Settings'
  },
  content_manager: {
    label: 'Content Manager',
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-50',
    desc: 'Manage public-facing content through the CMS'
  },
  reviewer: {
    label: 'TCC Reviewer',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    desc: 'Review and approve Tax Clearance Certificate applications'
  }
};

// ── Component ───────────────────────────────────────────────────────
interface AdminDashboardProps {
  session: UserSession;
  onLogout: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

export default function AdminDashboard({ session, onLogout, theme, onToggleTheme }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<AdminDashboardTab>('users');
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>(INITIAL_ADMIN_USERS);

  // Create-user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState<AdminRole>('reviewer');

  // Edit-role modal
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [editRole, setEditRole] = useState<AdminRole>('reviewer');

  // Search
  const [searchQuery, setSearchQuery] = useState('');

  // Context menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const role = session.adminRole || 'reviewer';

  // RBAC logic
  const canAccessUsers = role === 'super_admin';
  const canAccessRoles = role === 'super_admin';
  const canAccessCMS = role === 'super_admin' || role === 'content_manager';
  const canAccessTCC = role === 'super_admin' || role === 'reviewer';

  // Auto-switch tab if they land on one they can't access
  React.useEffect(() => {
    if (activeTab === 'users' && !canAccessUsers) {
      if (canAccessCMS) setActiveTab('cms');
      else if (canAccessTCC) setActiveTab('tcc-approvals');
    }
  }, [activeTab, canAccessUsers, canAccessCMS, canAccessTCC]);

  // ── Handlers ────────────────────────────────────────────────────
  const handleCreateUser = () => {
    if (!newName.trim() || !newEmail.trim()) return;
    const user: AdminUser = {
      id: `au-${Date.now()}`,
      fullName: newName.trim(),
      email: newEmail.trim(),
      role: newRole,
      status: 'active',
      createdAt: new Date().toISOString().split('T')[0]
    };
    setAdminUsers(prev => [user, ...prev]);
    setNewName('');
    setNewEmail('');
    setNewRole('reviewer');
    setShowCreateModal(false);
  };

  const handleUpdateRole = () => {
    if (!editingUser) return;
    setAdminUsers(prev => prev.map(u => u.id === editingUser.id ? { ...u, role: editRole } : u));
    setEditingUser(null);
  };

  const handleToggleStatus = (userId: string) => {
    setAdminUsers(prev => prev.map(u => u.id === userId ? { ...u, status: u.status === 'active' ? 'suspended' : 'active' } : u));
    setOpenMenuId(null);
  };

  const handleDeleteUser = (userId: string) => {
    setAdminUsers(prev => prev.filter(u => u.id !== userId));
    setOpenMenuId(null);
  };

  const filteredUsers = adminUsers.filter(u =>
    u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    ROLE_META[u.role].label.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ── Render ──────────────────────────────────────────────────────
  return (
    <div className="flex h-screen bg-background text-on-surface overflow-hidden">
      {/* ── Sidebar ──────────────────────────────────────────────── */}
      <aside className="w-64 bg-white border-r border-outline-variant/60 flex flex-col z-20 flex-shrink-0 shadow-sm relative">
        <div className="p-6 border-b border-outline-variant/40">
          <div className="flex items-center space-x-2 text-error">
            <ShieldAlert className="w-6 h-6" />
            <span className="font-extrabold text-lg tracking-tight">Admin Portal</span>
          </div>
          <div className="mt-4 px-3 py-1.5 bg-error/10 text-error text-[10px] font-bold uppercase tracking-wider rounded-md inline-block">
            {role.replace('_', ' ')}
          </div>
        </div>

        <div className="flex-grow overflow-y-auto p-4 hide-scrollbar">
          <nav className="space-y-1">
            {canAccessUsers && (
              <button
                onClick={() => setActiveTab('users')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'users'
                    ? 'bg-error/10 text-error font-bold border-l-4 border-l-error rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-error'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>User Management</span>
              </button>
            )}

            {canAccessRoles && (
              <button
                onClick={() => setActiveTab('roles')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'roles'
                    ? 'bg-error/10 text-error font-bold border-l-4 border-l-error rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-error'
                }`}
              >
                <UserCog className="w-4.5 h-4.5" />
                <span>Role Management</span>
              </button>
            )}

            {canAccessCMS && (
              <button
                onClick={() => setActiveTab('cms')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'cms'
                    ? 'bg-error/10 text-error font-bold border-l-4 border-l-error rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-error'
                }`}
              >
                <Edit className="w-4.5 h-4.5" />
                <span>CMS Manager</span>
              </button>
            )}

            {canAccessTCC && (
              <button
                onClick={() => setActiveTab('tcc-approvals')}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'tcc-approvals'
                    ? 'bg-error/10 text-error font-bold border-l-4 border-l-error rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-error'
                }`}
              >
                <CheckCircle className="w-4.5 h-4.5" />
                <span>TCC Approvals</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('settings')}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-error/10 text-error font-bold border-l-4 border-l-error rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-error'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              <span>Admin Settings</span>
            </button>
          </nav>
        </div>

        {/* User Session card & Logout */}
        <div className="px-4 pt-6 pb-6 border-t border-outline-variant/50 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-full bg-error text-white flex items-center justify-center font-bold font-mono uppercase">
              {(session.fullName || 'A')[0]}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-bold text-error truncate">{session.fullName || 'Admin'}</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider truncate">
                {ROLE_META[role]?.label || role}
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-error hover:bg-error/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────────── */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto relative pb-32">
        {/* Top Header */}
        <div className="w-full mb-8 flex justify-between items-center bg-white border border-outline-variant/60 rounded-xl px-5 py-3 shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-error animate-pulse"></span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Admin System Active</span>
          </div>
          <div className="flex items-center space-x-4">
            <button className="text-on-surface-variant hover:bg-secondary-container rounded-full p-2 transition-colors active:scale-95 cursor-pointer relative">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-error rounded-full border-2 border-white"></span>
            </button>
            <div className="w-px h-6 bg-outline-variant/60"></div>
            <button
              onClick={onToggleTheme}
              className="p-2 rounded-lg hover:bg-surface-container-low border border-outline-variant text-on-surface-variant transition-all cursor-pointer"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-500" /> : <Moon className="w-4 h-4 text-indigo-600" />}
            </button>
          </div>
        </div>

        {/* Dynamic Content */}
        <div className="w-full max-w-5xl mx-auto space-y-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="w-full"
            >

              {/* ═══════════════════════════════════════════════════════
                   USER MANAGEMENT TAB
                 ═══════════════════════════════════════════════════════ */}
              {activeTab === 'users' && canAccessUsers && (
                <div className="space-y-6 text-left">
                  {/* Header row */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-primary-container tracking-tight">User Management</h2>
                      <p className="text-sm text-on-surface-variant mt-1">Create staff accounts and assign access roles.</p>
                    </div>
                    <button
                      onClick={() => setShowCreateModal(true)}
                      className="h-11 px-5 bg-error text-white text-xs font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all flex items-center space-x-2 shadow-sm cursor-pointer self-start"
                    >
                      <Plus className="w-4 h-4" />
                      <span>Create New User</span>
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search by name, email, or role…"
                      className="w-full h-11 pl-11 pr-4 bg-white border border-outline-variant rounded-xl text-sm text-on-surface focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold"
                    />
                  </div>

                  {/* Users table */}
                  <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead>
                          <tr className="border-b border-outline-variant/60 bg-surface-container-low">
                            <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">User</th>
                            <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Role</th>
                            <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Status</th>
                            <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Created</th>
                            <th className="px-5 py-3 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.length === 0 && (
                            <tr>
                              <td colSpan={5} className="px-5 py-12 text-center text-sm text-on-surface-variant">No users found.</td>
                            </tr>
                          )}
                          {filteredUsers.map((user) => {
                            const meta = ROLE_META[user.role];
                            return (
                              <tr key={user.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50 transition-colors">
                                {/* User info */}
                                <td className="px-5 py-4">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs uppercase ${meta.bgColor} ${meta.color}`}>
                                      {user.fullName[0]}
                                    </div>
                                    <div>
                                      <p className="text-sm font-bold text-on-surface">{user.fullName}</p>
                                      <p className="text-[11px] text-on-surface-variant flex items-center space-x-1">
                                        <Mail className="w-3 h-3" />
                                        <span>{user.email}</span>
                                      </p>
                                    </div>
                                  </div>
                                </td>
                                {/* Role */}
                                <td className="px-5 py-4">
                                  <span className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider ${meta.bgColor} ${meta.color}`}>
                                    <Shield className="w-3 h-3" />
                                    <span>{meta.label}</span>
                                  </span>
                                </td>
                                {/* Status */}
                                <td className="px-5 py-4">
                                  <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                    user.status === 'active' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                                  }`}>
                                    {user.status}
                                  </span>
                                </td>
                                {/* Created */}
                                <td className="px-5 py-4">
                                  <span className="text-xs text-on-surface-variant flex items-center space-x-1">
                                    <Calendar className="w-3 h-3" />
                                    <span>{user.createdAt}</span>
                                  </span>
                                </td>
                                {/* Actions */}
                                <td className="px-5 py-4 text-right relative">
                                  <button
                                    onClick={() => setOpenMenuId(openMenuId === user.id ? null : user.id)}
                                    className="p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer"
                                  >
                                    <MoreVertical className="w-4 h-4 text-on-surface-variant" />
                                  </button>
                                  {openMenuId === user.id && (
                                    <div className="absolute right-5 top-12 w-48 bg-white border border-outline-variant rounded-xl shadow-lg z-30 py-1 text-left">
                                      <button
                                        onClick={() => {
                                          setEditingUser(user);
                                          setEditRole(user.role);
                                          setOpenMenuId(null);
                                        }}
                                        className="w-full px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low flex items-center space-x-2 cursor-pointer"
                                      >
                                        <UserCog className="w-3.5 h-3.5 text-on-surface-variant" />
                                        <span>Change Role</span>
                                      </button>
                                      <button
                                        onClick={() => handleToggleStatus(user.id)}
                                        className="w-full px-4 py-2.5 text-xs font-semibold text-on-surface hover:bg-surface-container-low flex items-center space-x-2 cursor-pointer"
                                      >
                                        <Shield className="w-3.5 h-3.5 text-on-surface-variant" />
                                        <span>{user.status === 'active' ? 'Suspend User' : 'Activate User'}</span>
                                      </button>
                                      <div className="border-t border-outline-variant/40 my-1"></div>
                                      <button
                                        onClick={() => handleDeleteUser(user.id)}
                                        className="w-full px-4 py-2.5 text-xs font-semibold text-error hover:bg-error/5 flex items-center space-x-2 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        <span>Remove User</span>
                                      </button>
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    {/* Footer stats */}
                    <div className="px-5 py-3 border-t border-outline-variant/40 bg-surface-container-low flex items-center justify-between">
                      <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                        {filteredUsers.length} user{filteredUsers.length !== 1 ? 's' : ''} total
                      </span>
                      <span className="text-[10px] text-on-surface-variant">
                        {adminUsers.filter(u => u.status === 'active').length} active · {adminUsers.filter(u => u.status === 'suspended').length} suspended
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════
                   ROLE MANAGEMENT TAB
                 ═══════════════════════════════════════════════════════ */}
              {activeTab === 'roles' && canAccessRoles && (
                <div className="space-y-6 text-left">
                  <div>
                    <h2 className="text-2xl font-black text-primary-container tracking-tight">Role Management</h2>
                    <p className="text-sm text-on-surface-variant mt-1">View defined roles and their permissions across the platform.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {(Object.entries(ROLE_META) as [AdminRole, typeof ROLE_META[AdminRole]][]).map(([roleKey, meta]) => {
                      const count = adminUsers.filter(u => u.role === roleKey).length;
                      return (
                        <div key={roleKey} className={`bg-white border border-outline-variant rounded-2xl p-6 space-y-4 relative overflow-hidden`}>
                          <div className={`absolute top-0 left-0 w-full h-1 ${roleKey === 'super_admin' ? 'bg-error' : roleKey === 'content_manager' ? 'bg-emerald-500' : 'bg-blue-500'}`}></div>
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${meta.bgColor}`}>
                            {roleKey === 'super_admin' && <ShieldAlert className={`w-6 h-6 ${meta.color}`} />}
                            {roleKey === 'content_manager' && <Edit className={`w-6 h-6 ${meta.color}`} />}
                            {roleKey === 'reviewer' && <CheckCircle className={`w-6 h-6 ${meta.color}`} />}
                          </div>
                          <div>
                            <h3 className="text-sm font-bold text-on-surface">{meta.label}</h3>
                            <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">{meta.desc}</p>
                          </div>
                          <div className="pt-3 border-t border-outline-variant/40 flex items-center justify-between">
                            <span className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{count} user{count !== 1 ? 's' : ''} assigned</span>
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${meta.bgColor} ${meta.color}`}>
                              {roleKey.replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════
                   CMS TAB
                 ═══════════════════════════════════════════════════════ */}
              {activeTab === 'cms' && canAccessCMS && (
                <CMSManager />
              )}

              {/* ═══════════════════════════════════════════════════════
                   TCC APPROVALS TAB
                 ═══════════════════════════════════════════════════════ */}
              {activeTab === 'tcc-approvals' && canAccessTCC && (
                <div className="bg-white border border-outline-variant rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-accent-green">
                    <CheckCircle className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface">TCC Approvals Queue</h3>
                  <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                    Review and approve Tax Clearance Certificate applications for verified taxpayers. (Under construction)
                  </p>
                </div>
              )}

              {/* ═══════════════════════════════════════════════════════
                   ADMIN SETTINGS TAB
                 ═══════════════════════════════════════════════════════ */}
              {activeTab === 'settings' && (
                <div className="bg-white border border-outline-variant rounded-2xl p-8 text-center space-y-4">
                  <div className="w-16 h-16 bg-surface-container rounded-full flex items-center justify-center mx-auto text-on-surface-variant">
                    <Settings className="w-8 h-8" />
                  </div>
                  <h3 className="text-xl font-bold text-on-surface">System Settings</h3>
                  <p className="text-sm text-on-surface-variant max-w-md mx-auto">
                    Configure global application variables and system defaults. (Under construction)
                  </p>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* ═══════════════════════════════════════════════════════════════
           CREATE USER MODAL
         ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl border border-outline-variant shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/40">
                <h3 className="text-lg font-bold text-on-surface">Create New User</h3>
                <button onClick={() => setShowCreateModal(false)} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="w-full h-12 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold"
                    placeholder="e.g. Chinedu Okafor"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full h-12 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-error focus:ring-1 focus:ring-error transition-all font-semibold"
                    placeholder="e.g. chinedu@diytax9ja.ng"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Assign Role</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.entries(ROLE_META) as [AdminRole, typeof ROLE_META[AdminRole]][]).map(([roleKey, meta]) => (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setNewRole(roleKey)}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer border ${
                          newRole === roleKey
                            ? `${meta.bgColor} ${meta.color} border-current ring-1 ring-current`
                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {roleKey === 'super_admin' && <ShieldAlert className="w-4 h-4" />}
                          {roleKey === 'content_manager' && <Edit className="w-4 h-4" />}
                          {roleKey === 'reviewer' && <CheckCircle className="w-4 h-4" />}
                          <span>{meta.label}</span>
                        </div>
                        {newRole === roleKey && <CheckCircle className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex items-center space-x-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 h-11 bg-surface-container text-on-surface-variant text-xs font-bold rounded-lg hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateUser}
                  disabled={!newName.trim() || !newEmail.trim()}
                  className="flex-1 h-11 bg-error text-white text-xs font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Create User</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
           CHANGE ROLE MODAL
         ═══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setEditingUser(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md bg-white rounded-2xl border border-outline-variant shadow-xl overflow-hidden"
            >
              <div className="flex items-center justify-between p-6 border-b border-outline-variant/40">
                <div>
                  <h3 className="text-lg font-bold text-on-surface">Change Role</h3>
                  <p className="text-xs text-on-surface-variant mt-0.5">Updating role for <strong>{editingUser.fullName}</strong></p>
                </div>
                <button onClick={() => setEditingUser(null)} className="p-1.5 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">Current Role</label>
                  <div className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-md text-xs font-bold ${ROLE_META[editingUser.role].bgColor} ${ROLE_META[editingUser.role].color}`}>
                    <Shield className="w-3.5 h-3.5" />
                    <span>{ROLE_META[editingUser.role].label}</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider block">New Role</label>
                  <div className="grid grid-cols-1 gap-2">
                    {(Object.entries(ROLE_META) as [AdminRole, typeof ROLE_META[AdminRole]][]).map(([roleKey, meta]) => (
                      <button
                        key={roleKey}
                        type="button"
                        onClick={() => setEditRole(roleKey)}
                        className={`w-full py-3 px-4 rounded-xl text-xs font-bold flex items-center justify-between transition-all cursor-pointer border ${
                          editRole === roleKey
                            ? `${meta.bgColor} ${meta.color} border-current ring-1 ring-current`
                            : 'bg-surface-container-low text-on-surface-variant border-outline-variant hover:bg-surface-container'
                        }`}
                      >
                        <div className="flex items-center space-x-2">
                          {roleKey === 'super_admin' && <ShieldAlert className="w-4 h-4" />}
                          {roleKey === 'content_manager' && <Edit className="w-4 h-4" />}
                          {roleKey === 'reviewer' && <CheckCircle className="w-4 h-4" />}
                          <span>{meta.label}</span>
                        </div>
                        {editRole === roleKey && <CheckCircle className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 pt-0 flex items-center space-x-3">
                <button
                  onClick={() => setEditingUser(null)}
                  className="flex-1 h-11 bg-surface-container text-on-surface-variant text-xs font-bold rounded-lg hover:bg-surface-container-high transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRole}
                  className="flex-1 h-11 bg-error text-white text-xs font-bold rounded-lg hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center space-x-2 shadow-sm cursor-pointer"
                >
                  <UserCog className="w-4 h-4" />
                  <span>Update Role</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, Activity, X, Plus, Trash2, RefreshCw, ShieldCheck, Lock, Unlock, FileText, Landmark, Info } from 'lucide-react';
import { useToast } from '../Toast';
import {
  getAllUsers,
  registerUser,
  updateUser,
  deleteUser,
  RegisteredUser,
  UserRole,
  AccountType,
} from '../../utils/authStore';
import { db } from '../../lib/firebase';
import { collection, getDocs, getDoc, doc, setDoc, deleteDoc, updateDoc } from 'firebase/firestore';
import { recordAuditLog } from '../../utils/auditLogger';
import StatutoryOverridesModal from './StatutoryOverridesModal';
import { usePermissions } from '../../admin/usePermissions';
import { describeWriteError } from '../../admin/platformStore';
import { SUPER_ADMIN, TAXPAYER, roleLabel } from '../../admin/permissions';
import { transitionPeriod } from '../../nrs/ledger';
import type { PeriodDoc } from '../../nrs/types';
import type { TaxFiling } from '../../types';

const ROLE_BADGES: Record<string, { bg: string; text: string }> = {
  super_admin: { bg: 'bg-red-100', text: 'text-red-800' },
  content_manager: { bg: 'bg-emerald-100', text: 'text-emerald-800' },
  reviewer: { bg: 'bg-blue-100', text: 'text-blue-800' },
  support_agent: { bg: 'bg-amber-100', text: 'text-amber-800' },
  finance_auditor: { bg: 'bg-teal-100', text: 'text-teal-800' },
  taxpayer: { bg: 'bg-gray-100', text: 'text-gray-800' },
};
const CUSTOM_BADGE = { bg: 'bg-violet-100', text: 'text-violet-800' };

function toISOStringSafe(val: unknown): string {
  if (!val) return new Date().toISOString();
  if (typeof val === 'string') return val;
  if (typeof val === 'number') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
  }
  if (val instanceof Date) {
    return isNaN(val.getTime()) ? new Date().toISOString() : val.toISOString();
  }
  if (typeof val === 'object' && val !== null) {
    const o = val as { toDate?: () => Date; seconds?: number; _seconds?: number };
    if (typeof o.toDate === 'function') {
      try {
        const d = o.toDate();
        if (d instanceof Date && !isNaN(d.getTime())) return d.toISOString();
      } catch { /* ignore */ }
    }
    if (typeof o.seconds === 'number') return new Date(o.seconds * 1000).toISOString();
    if (typeof o._seconds === 'number') return new Date(o._seconds * 1000).toISOString();
  }
  return new Date().toISOString();
}

function formatDateOnly(val: unknown): string {
  if (!val) return '—';
  const iso = toISOStringSafe(val);
  return iso.includes('T') ? iso.split('T')[0] : iso;
}

function formatDateTime(val: unknown, fallback = 'Never Logged In'): string {
  if (!val) return fallback;
  const d = new Date(toISOStringSafe(val));
  return isNaN(d.getTime()) ? fallback : d.toLocaleString('en-NG');
}

interface CloudProfile {
  profile?: Record<string, unknown>;
  nin?: string;
  isNINLinked?: boolean;
}

interface OversightData {
  loading: boolean;
  error?: string;
  cloud?: CloudProfile;
  filings: TaxFiling[];
  periods: PeriodDoc[];
}

export default function UserManagementPanel() {
  const { showToast } = useToast();
  const { can, rbac, role: myRole, actorEmail, actorName } = usePermissions();
  const isSuper = myRole === SUPER_ADMIN;
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'active' | 'suspended'>('ALL');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);
  const [overrideUser, setOverrideUser] = useState<RegisteredUser | null>(null);
  const [oversight, setOversight] = useState<OversightData | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('individual');
  const [newRole, setNewRole] = useState<UserRole>(TAXPAYER);

  const roleOptions = [TAXPAYER, ...Object.keys(rbac.roles)];
  // Non-super admins may only assign non-super roles; only Super Admins create staff.
  const assignableRoles = roleOptions.filter((r) => isSuper || r !== SUPER_ADMIN);
  const creatableRoles = isSuper ? roleOptions : [TAXPAYER];

  /** Whether the current staff member may act on this target (mirrors firestore.rules). */
  const canActOn = (target: RegisteredUser) => isSuper || target.role === TAXPAYER;
  const canChangeRoleOf = (target: RegisteredUser) => can('roles.assign') && (isSuper || target.role !== SUPER_ADMIN);

  const refreshUsers = async () => {
    setLoading(true);
    const merged: RegisteredUser[] = [];
    try {
      const snap = await getDocs(collection(db, 'users'));
      snap.forEach((docSnap) => {
        const data = docSnap.data();
        const email = (data.email || docSnap.id).toLowerCase();
        merged.push({
          id: `user_cloud_${docSnap.id}`,
          email,
          fullName: data.fullName || email.split('@')[0],
          accountType: data.accountType || 'individual',
          role: data.role || TAXPAYER,
          passwordHash: null,
          isActive: data.isActive !== false,
          createdAt: toISOStringSafe(data.createdAt),
          lastLogin: data.lastLogin ? toISOStringSafe(data.lastLogin) : null,
        });
      });
      setLoadError(null);
    } catch (err) {
      // Fall back to this browser's registry so the panel is still usable offline.
      merged.push(...getAllUsers());
      setLoadError(describeWriteError(err));
    }
    merged.sort((a, b) => a.fullName.localeCompare(b.fullName));
    setUsers(merged);
    setLoading(false);
  };

  useEffect(() => {
    refreshUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredUsers = users.filter((user) => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = user.fullName.toLowerCase().includes(q) || user.email.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'ALL' || (statusFilter === 'active' ? user.isActive : !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  /** Keep this browser's legacy registry in step with the server copy. */
  const syncLocal = (email: string, patch: Partial<RegisteredUser>) => {
    const local = getAllUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
    if (local) updateUser(local.id, patch);
  };

  const toggleUserStatus = async (user: RegisteredUser) => {
    const nextStatus = !user.isActive;
    if (!nextStatus && !confirm(`Suspend ${user.fullName}? They will be signed out and blocked from signing in.`)) return;
    try {
      await setDoc(doc(db, 'users', user.email.toLowerCase()), { isActive: nextStatus, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      showToast('error', 'Status not changed', describeWriteError(err));
      return;
    }
    syncLocal(user.email, { isActive: nextStatus });
    recordAuditLog({
      actorName,
      actorEmail,
      action: nextStatus ? 'ACTIVATE_USER_ACCOUNT' : 'SUSPEND_USER_ACCOUNT',
      module: 'User Management',
      severity: nextStatus ? 'INFO' : 'CRITICAL',
      beforeState: { email: user.email, isActive: user.isActive },
      afterState: { email: user.email, isActive: nextStatus },
    });
    await refreshUsers();
    showToast(nextStatus ? 'success' : 'warning', 'User status updated', `${user.fullName} is now ${nextStatus ? 'ACTIVE' : 'SUSPENDED'}.`);
  };

  const handleRoleChange = async (user: RegisteredUser, role: UserRole) => {
    if (role === user.role) return;
    if (role === SUPER_ADMIN && !confirm(`Grant ${user.fullName} full Super Admin access?`)) return;
    try {
      await setDoc(doc(db, 'users', user.email.toLowerCase()), { role, updatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      showToast('error', 'Role not changed', describeWriteError(err));
      return;
    }
    syncLocal(user.email, { role });
    recordAuditLog({
      actorName,
      actorEmail,
      action: 'REASSIGN_USER_ROLE',
      module: 'User Management',
      severity: role === SUPER_ADMIN || user.role === SUPER_ADMIN ? 'CRITICAL' : 'WARN',
      beforeState: { email: user.email, role: user.role },
      afterState: { email: user.email, role },
    });
    await refreshUsers();
    showToast('success', 'Role updated', `${user.fullName} is now ${roleLabel(role, rbac)}. Takes effect at their next sign-in.`);
  };

  const handleDeleteUser = async (user: RegisteredUser) => {
    if (!confirm(`Delete the profile record for ${user.fullName} (${user.email})? Their saved filings are kept; signing in again recreates a blank profile.`)) return;
    try {
      await deleteDoc(doc(db, 'users', user.email.toLowerCase()));
    } catch (err) {
      showToast('error', 'Not deleted', describeWriteError(err));
      return;
    }
    const local = getAllUsers().find((u) => u.email.toLowerCase() === user.email.toLowerCase());
    if (local) deleteUser(local.id);
    recordAuditLog({
      actorName,
      actorEmail,
      action: 'DELETE_USER_RECORD',
      module: 'User Management',
      severity: 'CRITICAL',
      beforeState: { email: user.email, fullName: user.fullName, role: user.role },
      afterState: { deleted: true },
    });
    await refreshUsers();
    showToast('info', 'User deleted', `Removed ${user.email}.`);
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = newEmail.toLowerCase().trim();
    if (!email || !newFullName.trim()) {
      showToast('error', 'Validation error', 'Please enter email and full name.');
      return;
    }
    if (users.some((u) => u.email === email)) {
      showToast('error', 'Already registered', `${email} already has an account.`);
      return;
    }
    try {
      await setDoc(doc(db, 'users', email), {
        email,
        fullName: newFullName.trim(),
        accountType: newAccountType,
        role: newRole,
        isActive: true,
        createdAt: new Date().toISOString(),
        createdBy: actorEmail,
      }, { merge: true });
    } catch (err) {
      showToast('error', 'User not created', describeWriteError(err));
      return;
    }
    try { registerUser(email, newFullName, newAccountType, newRole, null); } catch { /* local mirror only */ }
    recordAuditLog({
      actorName,
      actorEmail,
      action: newRole === TAXPAYER ? 'PROVISION_USER_ACCOUNT' : 'PROVISION_STAFF_ACCOUNT',
      module: 'User Management',
      severity: newRole === TAXPAYER ? 'INFO' : 'WARN',
      afterState: { email, fullName: newFullName, role: newRole, accountType: newAccountType },
    });
    await refreshUsers();
    setIsAddModalOpen(false);
    setNewEmail('');
    setNewFullName('');
    setNewRole(TAXPAYER);
    showToast('success', 'User created', `${newFullName} can now sign in with an emailed code.`);
  };

  // ── Inspector / oversight ──
  const openInspector = async (user: RegisteredUser) => {
    setSelectedUser(user);
    if (!can('filings.view') && !can('users.view_pii')) {
      setOversight(null);
      return;
    }
    setOversight({ loading: true, filings: [], periods: [] });
    const key = user.email.toLowerCase();
    try {
      const [profileSnap, filingsSnap, ledgerSnap] = await Promise.all([
        can('users.view_pii') ? getDoc(doc(db, 'users', key)) : Promise.resolve(null),
        can('filings.view') ? getDoc(doc(db, 'users', key, 'user_data', 'filings')) : Promise.resolve(null),
        can('filings.view') ? getDocs(collection(db, 'users', key, 'tax_ledger')) : Promise.resolve(null),
      ]);
      const periods: PeriodDoc[] = [];
      ledgerSnap?.forEach((d) => periods.push(d.data() as PeriodDoc));
      periods.sort((a, b) => b.period.localeCompare(a.period));
      setOversight({
        loading: false,
        cloud: profileSnap?.exists() ? (profileSnap.data() as CloudProfile) : undefined,
        filings: (filingsSnap?.exists() ? (filingsSnap.data().data as TaxFiling[]) : []) ?? [],
        periods,
      });
    } catch (err) {
      setOversight({ loading: false, error: describeWriteError(err), filings: [], periods: [] });
    }
  };

  const unlockPeriod = async (user: RegisteredUser, period: PeriodDoc) => {
    if (!confirm(`Open an amendment on ${user.fullName}'s ${period.period} NRS period? The taxpayer will be able to edit it again.`)) return;
    try {
      const next = transitionPeriod(period, 'AMENDING');
      // Only meta + audit change; firestore.rules require the transactions to be untouched.
      await updateDoc(doc(db, 'users', user.email.toLowerCase(), 'tax_ledger', period.period), {
        meta: next.meta,
        audit: [{ ...next.audit[0], detail: `${next.audit[0].detail} — opened by staff ${actorEmail}` }, ...next.audit.slice(1)],
      });
      recordAuditLog({
        actorName, actorEmail, action: 'OPEN_NRS_AMENDMENT', module: 'Filing Engine', severity: 'WARN',
        afterState: { taxpayer: user.email, period: period.period },
      });
      showToast('success', 'Amendment opened', `${period.period} is unlocked for ${user.fullName}.`);
      await openInspector(user);
    } catch (err) {
      showToast('error', 'Could not unlock', describeWriteError(err));
    }
  };

  const badgeFor = (role: string) => ROLE_BADGES[role] ?? CUSTOM_BADGE;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">Users &amp; Access</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage accounts, roles and access. Role changes and suspensions apply at the user’s next sign-in (immediately once session revocation is deployed).
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={refreshUsers}
            disabled={loading}
            className="px-3.5 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface border border-outline-variant/60 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary-container ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>

          {can('users.create') && (
            <button
              onClick={() => setIsAddModalOpen(true)}
              className="px-4 py-2 bg-primary-container hover:bg-primary-container/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-accent-green" />
              <span>{isSuper ? 'Add user / staff' : 'Add taxpayer'}</span>
            </button>
          )}
        </div>
      </div>

      {loadError && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800">
          Could not load the server user list — showing this browser’s local registry instead. {loadError}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 border border-outline-variant/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-grow w-full sm:max-w-md">
          <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search users by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary-container"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
            <option value="ALL">All roles</option>
            {roleOptions.map((r) => <option key={r} value={r}>{roleLabel(r, rbac)}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none">
            <option value="ALL">Any status</option>
            <option value="active">Active</option>
            <option value="suspended">Suspended</option>
          </select>
          <span className="text-[11px] text-on-surface-variant whitespace-nowrap">{filteredUsers.length} of {users.length}</span>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/60 text-on-surface-variant uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3.5 px-4">User</th>
                <th className="py-3.5 px-4">Account Type</th>
                <th className="py-3.5 px-4">Role</th>
                <th className="py-3.5 px-4">Joined / Last Login</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {filteredUsers.map((user) => {
                const badge = badgeFor(user.role);
                const editableRole = canChangeRoleOf(user);
                return (
                  <tr key={user.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <p className="font-bold text-on-surface">{user.fullName}</p>
                      <p className="text-[10px] text-on-surface-variant font-mono">{user.email}</p>
                    </td>
                    <td className="py-3.5 px-4 uppercase text-[10px] font-bold text-on-surface-variant">{user.accountType}</td>
                    <td className="py-3.5 px-4">
                      {editableRole ? (
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user, e.target.value as UserRole)}
                          className={`text-[10px] font-bold px-2.5 py-1 rounded-md border-0 cursor-pointer ${badge.bg} ${badge.text}`}
                        >
                          {(assignableRoles.includes(user.role) ? assignableRoles : [user.role, ...assignableRoles]).map((r) => (
                            <option key={r} value={r}>{roleLabel(r, rbac)}</option>
                          ))}
                        </select>
                      ) : (
                        <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md inline-flex items-center gap-1 ${badge.bg} ${badge.text}`}>
                          {roleLabel(user.role, rbac)}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{formatDateOnly(user.createdAt)}</p>
                      <p className="text-[9px] text-on-surface-variant font-mono">{formatDateTime(user.lastLogin)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                        {user.isActive ? 'active' : 'suspended'}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => openInspector(user)} title="Inspect user" className="p-1.5 hover:bg-surface-container rounded-lg text-primary-container cursor-pointer">
                          <Activity className="w-4 h-4" />
                        </button>
                        {user.role === TAXPAYER && can('overrides.statutory') && (
                          <button id={`statutory-${user.email}`} onClick={() => setOverrideUser(user)} title="Statutory status overrides" className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-700 cursor-pointer">
                            <ShieldCheck className="w-4 h-4" />
                          </button>
                        )}
                        {can('users.suspend') && canActOn(user) && user.email !== actorEmail && (
                          <button
                            onClick={() => toggleUserStatus(user)}
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                              user.isActive ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                            }`}
                          >
                            {user.isActive ? 'Suspend' : 'Activate'}
                          </button>
                        )}
                        {can('users.delete') && canActOn(user) && user.email !== actorEmail && (
                          <button onClick={() => handleDeleteUser(user)} title="Delete user record" className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 cursor-pointer">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr><td colSpan={6} className="p-6 text-center text-on-surface-variant">{loading ? 'Loading…' : 'No users match these filters.'}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isAddModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-outline-variant rounded-2xl max-w-md w-full p-6 shadow-xl relative text-left space-y-4"
            >
              <button onClick={() => setIsAddModalOpen(false)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>
              <div>
                <h4 className="font-extrabold text-lg text-primary-container">{isSuper ? 'Add user or staff' : 'Add taxpayer'}</h4>
                <p className="text-xs text-on-surface-variant">Sign-in is by emailed one-time code — no password is needed.</p>
              </div>
              <form onSubmit={handleAddUserSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-on-surface block mb-1">Full legal name</label>
                  <input type="text" value={newFullName} onChange={(e) => setNewFullName(e.target.value)} placeholder="e.g. Adebayo Ogunlade" className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container" required />
                </div>
                <div>
                  <label className="font-bold text-on-surface block mb-1">Email address</label>
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="e.g. user@domain.ng" className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container" required />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface block mb-1">Account type</label>
                    <select value={newAccountType} onChange={(e) => setNewAccountType(e.target.value as AccountType)} className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none">
                      <option value="individual">Individual PIT</option>
                      <option value="business">Business CIT/VAT</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-on-surface block mb-1">Role</label>
                    <select value={newRole} onChange={(e) => setNewRole(e.target.value as UserRole)} className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none" disabled={creatableRoles.length === 1}>
                      {creatableRoles.map((r) => <option key={r} value={r}>{roleLabel(r, rbac)}</option>)}
                    </select>
                  </div>
                </div>
                {newRole !== TAXPAYER && (
                  <p className="text-[11px] text-on-surface-variant flex items-start gap-1.5"><Info className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" /> Staff sign in at /admin with an emailed code. What they can do is set on the Roles &amp; Permissions tab.</p>
                )}
                <div className="pt-2 flex justify-end gap-2">
                  <button type="button" onClick={() => setIsAddModalOpen(false)} className="px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs cursor-pointer hover:bg-surface-container">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-primary-container text-white rounded-xl font-bold text-xs cursor-pointer hover:opacity-90">Create account</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Inspector Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-outline-variant rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl relative text-left"
            >
              <button onClick={() => { setSelectedUser(null); setOversight(null); }} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer" aria-label="Close">
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/40 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-white font-black flex items-center justify-center">{selectedUser.fullName.charAt(0)}</div>
                <div>
                  <h4 className="font-extrabold text-sm text-primary-container">{selectedUser.fullName}</h4>
                  <p className="text-xs text-on-surface-variant">{selectedUser.email} · {roleLabel(selectedUser.role, rbac)} · {selectedUser.isActive ? 'Active' : 'Suspended'}</p>
                </div>
              </div>

              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Joined</p>
                    <p className="font-mono">{formatDateOnly(selectedUser.createdAt)}</p>
                  </div>
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <p className="text-[10px] font-bold uppercase text-on-surface-variant">Last sign-in</p>
                    <p className="font-mono">{formatDateTime(selectedUser.lastLogin, 'Never')}</p>
                  </div>
                </div>

                {oversight?.loading && <p className="text-on-surface-variant">Loading taxpayer records…</p>}
                {oversight?.error && <p className="text-error">{oversight.error}</p>}

                {can('users.view_pii') && oversight && !oversight.loading && (
                  <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                    <p className="font-bold text-on-surface mb-1">Identity &amp; registration</p>
                    <p className="text-[11px] text-on-surface-variant">NIN: {oversight.cloud?.isNINLinked ? `linked (${oversight.cloud.nin ?? 'masked'}) — self-attested` : 'not linked'}</p>
                    {oversight.cloud?.profile ? (
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[11px]">
                        {Object.entries(oversight.cloud.profile).filter(([, v]) => typeof v !== 'object').slice(0, 16).map(([k, v]) => (
                          <div key={k} className="contents"><dt className="text-on-surface-variant">{k}</dt><dd className="font-mono truncate">{String(v)}</dd></div>
                        ))}
                      </dl>
                    ) : <p className="text-[11px] text-on-surface-variant">No registration profile on file.</p>}
                  </div>
                )}

                {can('filings.view') && oversight && !oversight.loading && (
                  <>
                    <div className="p-3 rounded-xl border border-outline-variant/40">
                      <p className="font-bold text-on-surface mb-2 flex items-center gap-1.5"><FileText className="w-4 h-4" /> Filings ({oversight.filings.length})</p>
                      {oversight.filings.length === 0 ? <p className="text-[11px] text-on-surface-variant">No filings saved to the cloud.</p> : (
                        <table className="w-full text-[11px]">
                          <tbody>
                            {oversight.filings.slice(0, 10).map((f) => (
                              <tr key={f.id} className="border-t border-outline-variant/30">
                                <td className="py-1.5">{f.type}</td><td>{f.period}</td>
                                <td className="font-mono text-right">₦{Math.round(f.amount).toLocaleString()}</td>
                                <td className="text-right"><span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${f.status === 'Paid' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{f.status}</span></td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                      <p className="text-[10px] text-on-surface-variant mt-1">“Paid” status is self-reported by the taxpayer.</p>
                    </div>

                    <div className="p-3 rounded-xl border border-outline-variant/40">
                      <p className="font-bold text-on-surface mb-2 flex items-center gap-1.5"><Landmark className="w-4 h-4" /> NRS ledger periods ({oversight.periods.length})</p>
                      {oversight.periods.length === 0 ? <p className="text-[11px] text-on-surface-variant">No NRS ledger data.</p> : (
                        <table className="w-full text-[11px]">
                          <tbody>
                            {oversight.periods.map((p) => (
                              <tr key={p.period} className="border-t border-outline-variant/30">
                                <td className="py-1.5 font-mono">{p.period}</td>
                                <td>{p.transactions.length} txns</td>
                                <td><span className="px-1.5 py-0.5 rounded text-[9px] font-black uppercase bg-surface-container">{p.meta.status}</span>{p.meta.filingRef ? <span className="ml-1 text-on-surface-variant">ref {p.meta.filingRef}</span> : null}</td>
                                <td className="text-right">
                                  {p.meta.status === 'FILED' && can('nrs.unlock_period') && (
                                    <button onClick={() => unlockPeriod(selectedUser, p)} className="inline-flex items-center gap-1 text-[10px] font-bold text-primary-container hover:underline cursor-pointer"><Unlock className="w-3 h-3" /> Open amendment</button>
                                  )}
                                  {p.meta.status === 'FILED' && !can('nrs.unlock_period') && <Lock className="w-3 h-3 inline text-on-surface-variant" />}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </>
                )}

                {!can('filings.view') && !can('users.view_pii') && (
                  <p className="text-[11px] text-on-surface-variant">Your role cannot view this user’s personal details or filings.</p>
                )}
              </div>

              <div className="mt-6 flex justify-end">
                <button onClick={() => { setSelectedUser(null); setOversight(null); }} className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl cursor-pointer">
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Statutory Overrides Modal */}
      <AnimatePresence>
        {overrideUser && (
          <StatutoryOverridesModal user={overrideUser} actorEmail={actorEmail} onClose={() => setOverrideUser(null)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

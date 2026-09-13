import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, UserCheck, Shield, Activity, X, Plus, Trash2 } from 'lucide-react';
import { useToast } from '../Toast';
import {
  getAllUsers,
  registerUser,
  updateUser,
  deleteUser,
  hashPassword,
  RegisteredUser,
  UserRole,
  AccountType,
} from '../../utils/authStore';

const ROLE_BADGES: Record<string, { label: string; bg: string; text: string }> = {
  super_admin: { label: 'Super Admin', bg: 'bg-red-100', text: 'text-red-800' },
  content_manager: { label: 'Content Mgr', bg: 'bg-emerald-100', text: 'text-emerald-800' },
  reviewer: { label: 'TCC Reviewer', bg: 'bg-blue-100', text: 'text-blue-800' },
  taxpayer: { label: 'Taxpayer', bg: 'bg-gray-100', text: 'text-gray-800' },
};

export default function UserManagementPanel() {
  const { showToast } = useToast();
  const [users, setUsers] = useState<RegisteredUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [selectedUser, setSelectedUser] = useState<RegisteredUser | null>(null);

  // Add User Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newAccountType, setNewAccountType] = useState<AccountType>('individual');
  const [newRole, setNewRole] = useState<UserRole>('taxpayer');
  const [newPassword, setNewPassword] = useState('');

  // Load users from authStore on mount
  const refreshUsers = () => {
    setUsers(getAllUsers());
  };

  useEffect(() => {
    refreshUsers();
  }, []);

  const filteredUsers = users.filter((user) => {
    const matchesSearch =
      user.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      user.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'ALL' || user.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const toggleUserStatus = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;

    const nextStatus = !user.isActive;
    updateUser(id, { isActive: nextStatus });
    refreshUsers();

    showToast(
      nextStatus ? 'success' : 'warning',
      'User Status Updated',
      `${user.fullName} (${user.email}) is now ${nextStatus ? 'ACTIVE' : 'SUSPENDED'}.`
    );
  };

  const handleRoleChange = (id: string, role: UserRole) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;

    updateUser(id, { role });
    refreshUsers();

    showToast('success', 'Role Updated', `${user.fullName} reassigned to ${role.toUpperCase()}`);
  };

  const handleDeleteUser = (id: string) => {
    const user = users.find((u) => u.id === id);
    if (!user) return;

    if (confirm(`Are you sure you want to delete user ${user.fullName} (${user.email})?`)) {
      deleteUser(id);
      refreshUsers();
      showToast('info', 'User Deleted', `Removed account ${user.email} from system registry.`);
    }
  };

  const handleAddUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newFullName.trim()) {
      showToast('error', 'Validation Error', 'Please enter email and full name.');
      return;
    }

    try {
      const passwordHash = newPassword.trim() ? await hashPassword(newPassword.trim()) : null;
      registerUser(newEmail, newFullName, newAccountType, newRole, passwordHash);
      refreshUsers();
      setIsAddModalOpen(false);

      // Clear form
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      setNewRole('taxpayer');

      showToast('success', 'User Created', `Added ${newFullName} (${newEmail}) to system registry.`);
    } catch (err: any) {
      showToast('error', 'User Creation Failed', err.message || 'Could not register user.');
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">User Management &amp; Access Control (RBAC)</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Manage user identity lifecycle, role privileges, active status, and credential provisioning.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-primary-container hover:bg-primary-container/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4 text-accent-green" />
          <span>Add New User / Staff</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border border-outline-variant/60 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-grow w-full sm:max-w-md">
          <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search registered users by name or email..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary-container"
          />
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="content_manager">Content Manager</option>
            <option value="reviewer">TCC Reviewer</option>
            <option value="taxpayer">Taxpayer</option>
          </select>
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
                <th className="py-3.5 px-4">Role (RBAC)</th>
                <th className="py-3.5 px-4">Joined / Last Login</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {filteredUsers.map((user) => {
                const badge = ROLE_BADGES[user.role] || ROLE_BADGES.taxpayer;
                return (
                  <tr key={user.id} className="hover:bg-surface-container-low/40 transition-colors">
                    <td className="py-3.5 px-4">
                      <div>
                        <p className="font-bold text-on-surface">{user.fullName}</p>
                        <p className="text-[10px] text-on-surface-variant font-mono">{user.email}</p>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 uppercase text-[10px] font-bold text-on-surface-variant">
                      {user.accountType}
                    </td>

                    <td className="py-3.5 px-4">
                      <select
                        value={user.role}
                        onChange={(e) => handleRoleChange(user.id, e.target.value as UserRole)}
                        className={`text-[10px] font-bold px-2.5 py-1 rounded-md border-0 cursor-pointer ${badge.bg} ${badge.text}`}
                      >
                        <option value="taxpayer">Taxpayer</option>
                        <option value="reviewer">TCC Reviewer</option>
                        <option value="content_manager">Content Manager</option>
                        <option value="super_admin">Super Admin</option>
                      </select>
                    </td>

                    <td className="py-3.5 px-4">
                      <p className="font-medium text-on-surface">{user.createdAt.split('T')[0]}</p>
                      <p className="text-[9px] text-on-surface-variant font-mono">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString('en-NG') : 'Never Logged In'}
                      </p>
                    </td>

                    <td className="py-3.5 px-4">
                      <span
                        className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                          user.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.isActive ? 'active' : 'suspended'}
                      </span>
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedUser(user)}
                          title="Inspect User Details"
                          className="p-1.5 hover:bg-surface-container rounded-lg text-primary-container cursor-pointer"
                        >
                          <Activity className="w-4 h-4" />
                        </button>

                        <button
                          onClick={() => toggleUserStatus(user.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                            user.isActive
                              ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                              : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                          }`}
                        >
                          {user.isActive ? 'Suspend' : 'Activate'}
                        </button>

                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          title="Delete User"
                          className="p-1.5 hover:bg-red-50 rounded-lg text-red-600 cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
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
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div>
                <h4 className="font-extrabold text-lg text-primary-container">Add New User / Staff Credentials</h4>
                <p className="text-xs text-on-surface-variant">Register a new taxpayer or provision staff admin access.</p>
              </div>

              <form onSubmit={handleAddUserSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="font-bold text-on-surface block mb-1">Full Legal Name</label>
                  <input
                    type="text"
                    value={newFullName}
                    onChange={(e) => setNewFullName(e.target.value)}
                    placeholder="e.g. Adebayo Ogunlade"
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container"
                    required
                  />
                </div>

                <div>
                  <label className="font-bold text-on-surface block mb-1">Email Address</label>
                  <input
                    type="email"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="e.g. user@domain.ng"
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-on-surface block mb-1">Account Type</label>
                    <select
                      value={newAccountType}
                      onChange={(e) => setNewAccountType(e.target.value as AccountType)}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none"
                    >
                      <option value="individual">Individual PIT</option>
                      <option value="business">Business CIT/VAT</option>
                    </select>
                  </div>

                  <div>
                    <label className="font-bold text-on-surface block mb-1">Assigned Role</label>
                    <select
                      value={newRole}
                      onChange={(e) => setNewRole(e.target.value as UserRole)}
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none"
                    >
                      <option value="taxpayer">Taxpayer</option>
                      <option value="reviewer">TCC Reviewer</option>
                      <option value="content_manager">Content Manager</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                {newRole !== 'taxpayer' && (
                  <div>
                    <label className="font-bold text-on-surface block mb-1">Staff Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Required for admin login"
                      className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container"
                      required
                    />
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAddModalOpen(false)}
                    className="px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs cursor-pointer hover:bg-surface-container"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-container text-white rounded-xl font-bold text-xs cursor-pointer hover:opacity-90"
                  >
                    Save &amp; Create User
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Activity Inspector Modal */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-xl relative text-left"
            >
              <button
                onClick={() => setSelectedUser(null)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/40 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary-container text-white font-black flex items-center justify-center">
                  {selectedUser.fullName.charAt(0)}
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-primary-container">{selectedUser.fullName}</h4>
                  <p className="text-xs text-on-surface-variant">{selectedUser.email}</p>
                </div>
              </div>

              <div className="space-y-3 text-xs">
                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <p className="font-bold text-on-surface">Account Metadata</p>
                  <p className="text-[11px] text-on-surface-variant">User ID: <span className="font-mono">{selectedUser.id}</span></p>
                  <p className="text-[11px] text-on-surface-variant">Role: <span className="font-mono">{selectedUser.role.toUpperCase()}</span></p>
                  <p className="text-[11px] text-on-surface-variant">Created: <span className="font-mono">{selectedUser.createdAt}</span></p>
                </div>

                <div className="p-3 bg-surface-container-low rounded-xl border border-outline-variant/40">
                  <p className="font-bold text-on-surface">Recent System Activity</p>
                  <ul className="text-[11px] text-on-surface-variant space-y-1.5 mt-2">
                    <li className="flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5 text-emerald-600" /> Account active and verified
                    </li>
                    <li className="flex items-center gap-1.5">
                      <Shield className="w-3.5 h-3.5 text-blue-600" /> Last logged in: {selectedUser.lastLogin || 'Never'}
                    </li>
                  </ul>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedUser(null)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close Inspector
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

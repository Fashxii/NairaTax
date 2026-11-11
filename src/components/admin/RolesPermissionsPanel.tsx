/**
 * RolesPermissionsPanel.tsx — Roles & permission matrix.
 *
 * Rows = permissions grouped by module, columns = roles. Publishing writes
 * Firestore `platform_config/rbac`, which firestore.rules (`hasPerm`) and the
 * Cloud Functions read — so ticking a box here changes what the server allows.
 */

import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  KeyRound, Plus, RotateCcw, Save, Lock, Pencil, Trash2, X, ShieldCheck, ServerCog, MonitorSmartphone, Hourglass, AlertTriangle, Users,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { useToast } from '../Toast';
import { usePermissions } from '../../admin/usePermissions';
import { saveRbac, describeWriteError } from '../../admin/platformStore';
import {
  PERMISSIONS, PERMISSION_MODULES, SUPER_ADMIN, defaultRbac, isValidRoleId, slugifyRoleId,
  type Enforcement, type PermissionId, type RbacConfig, type RoleDef, type Risk,
} from '../../admin/permissions';
import { recordAuditLog } from '../../utils/auditLogger';

const ENFORCEMENT_META: Record<Enforcement, { label: string; cls: string; Icon: typeof ServerCog; hint: string }> = {
  server: { label: 'Server', cls: 'bg-emerald-50 text-emerald-800 border-emerald-200', Icon: ServerCog, hint: 'Enforced by Firestore rules / Cloud Functions — cannot be bypassed.' },
  client: { label: 'UI', cls: 'bg-sky-50 text-sky-800 border-sky-200', Icon: MonitorSmartphone, hint: 'Controls what the console shows. Underlying data is protected separately or is not sensitive.' },
  planned: { label: 'Planned', cls: 'bg-gray-100 text-gray-600 border-gray-200', Icon: Hourglass, hint: 'The feature this governs is not built yet.' },
};

const RISK_CLS: Record<Risk, string> = {
  low: 'text-gray-500',
  medium: 'text-sky-700',
  high: 'text-amber-700',
  critical: 'text-red-700 font-black',
};

function cloneRbac(r: RbacConfig): RbacConfig {
  return { ...r, roles: Object.fromEntries(Object.entries(r.roles).map(([k, v]) => [k, { ...v, permissions: [...v.permissions] }])) };
}

/** Per-role permission additions/removals between two matrices (for the audit log). */
function diffRbac(before: RbacConfig, after: RbacConfig) {
  const changes: Record<string, { added?: string[]; removed?: string[]; created?: boolean; deleted?: boolean }> = {};
  const ids = new Set([...Object.keys(before.roles), ...Object.keys(after.roles)]);
  for (const id of ids) {
    const b = before.roles[id];
    const a = after.roles[id];
    if (!b) changes[id] = { created: true, added: a.permissions };
    else if (!a) changes[id] = { deleted: true };
    else {
      const added = a.permissions.filter((p) => !b.permissions.includes(p));
      const removed = b.permissions.filter((p) => !a.permissions.includes(p));
      if (added.length || removed.length || a.label !== b.label || a.description !== b.description) changes[id] = { added, removed };
    }
  }
  return changes;
}

export default function RolesPermissionsPanel() {
  const { showToast } = useToast();
  const { can, rbac, rbacPublished, rbacError, actorEmail, actorName } = usePermissions();
  const canManage = can('roles.manage');
  const [draft, setDraft] = useState<RbacConfig>(() => cloneRbac(rbac));
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ mode: 'create' | 'edit'; role: RoleDef; copyFrom: string } | null>(null);
  const [userCounts, setUserCounts] = useState<Record<string, number> | null>(null);
  const [filter, setFilter] = useState('');

  // Keep the draft in sync with the live matrix until the admin starts editing.
  const dirty = JSON.stringify(draft.roles) !== JSON.stringify(rbac.roles);
  useEffect(() => {
    if (!dirty) setDraft(cloneRbac(rbac));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rbac]);

  useEffect(() => {
    if (!can('users.view')) return;
    getDocs(collection(db, 'users'))
      .then((snap) => {
        const counts: Record<string, number> = {};
        snap.forEach((d) => {
          const role = (d.data().role as string) || 'taxpayer';
          counts[role] = (counts[role] ?? 0) + 1;
        });
        setUserCounts(counts);
      })
      .catch(() => setUserCounts(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const roles = useMemo(() => {
    const list = Object.values(draft.roles);
    return [
      ...list.filter((r) => r.id === SUPER_ADMIN),
      ...list.filter((r) => r.id !== SUPER_ADMIN && r.builtIn),
      ...list.filter((r) => !r.builtIn),
    ];
  }, [draft]);

  const visiblePermissions = PERMISSIONS.filter((p) =>
    !filter || `${p.label} ${p.id} ${p.description}`.toLowerCase().includes(filter.toLowerCase()),
  );

  const toggle = (roleId: string, perm: PermissionId) => {
    if (!canManage || roleId === SUPER_ADMIN) return;
    setDraft((d) => {
      const next = cloneRbac(d);
      const set = new Set(next.roles[roleId].permissions);
      if (set.has(perm)) set.delete(perm);
      else set.add(perm);
      next.roles[roleId].permissions = PERMISSIONS.map((p) => p.id).filter((id) => set.has(id));
      return next;
    });
  };

  const toggleModule = (roleId: string, module: string) => {
    if (!canManage || roleId === SUPER_ADMIN) return;
    const ids = PERMISSIONS.filter((p) => p.module === module).map((p) => p.id);
    setDraft((d) => {
      const next = cloneRbac(d);
      const current = new Set(next.roles[roleId].permissions);
      const allOn = ids.every((id) => current.has(id));
      ids.forEach((id) => (allOn ? current.delete(id) : current.add(id)));
      next.roles[roleId].permissions = PERMISSIONS.map((p) => p.id).filter((id) => current.has(id));
      return next;
    });
  };

  const handlePublish = async () => {
    setSaving(true);
    try {
      await saveRbac(draft, actorEmail);
      recordAuditLog({
        actorName,
        actorEmail,
        action: rbacPublished ? 'UPDATE_PERMISSION_MATRIX' : 'PUBLISH_PERMISSION_MATRIX',
        module: 'Roles & Permissions',
        severity: 'CRITICAL',
        afterState: diffRbac(rbac, draft),
      });
      showToast('success', 'Permissions published', 'The server now enforces the updated matrix.');
    } catch (err) {
      showToast('error', 'Not published', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('Reset the matrix to the built-in defaults? Custom roles will be removed from the draft. Nothing changes until you publish.')) return;
    setDraft(defaultRbac());
  };

  const openCreate = () => setEditing({ mode: 'create', role: { id: '', label: '', description: '', permissions: [], builtIn: false }, copyFrom: '' });

  const submitRole = () => {
    if (!editing) return;
    const { mode, role, copyFrom } = editing;
    const label = role.label.trim();
    const id = mode === 'create' ? (role.id.trim() || slugifyRoleId(label)) : role.id;
    if (!label) return showToast('error', 'Name required', 'Give the role a name.');
    if (mode === 'create') {
      if (!isValidRoleId(id)) return showToast('error', 'Invalid role ID', 'Use 3–32 lowercase letters, numbers or underscores, starting with a letter.');
      if (draft.roles[id] || id === 'taxpayer') return showToast('error', 'Role exists', `A role with ID “${id}” already exists.`);
    }
    setDraft((d) => {
      const next = cloneRbac(d);
      const permissions = mode === 'create' && copyFrom ? [...(d.roles[copyFrom]?.permissions ?? [])] : role.permissions;
      next.roles[id] = { ...role, id, label, description: role.description.trim(), permissions, builtIn: mode === 'edit' ? role.builtIn : false };
      return next;
    });
    setEditing(null);
  };

  const deleteRole = (role: RoleDef) => {
    const assigned = userCounts?.[role.id] ?? 0;
    if (assigned > 0) {
      showToast('warning', 'Role in use', `${assigned} user(s) still have the “${role.label}” role. Reassign them first.`);
      return;
    }
    if (!confirm(`Remove the “${role.label}” role from the draft?`)) return;
    setDraft((d) => {
      const next = cloneRbac(d);
      delete next.roles[role.id];
      return next;
    });
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 text-left">
      {/* Header */}
      <div className="bg-white p-6 border border-outline-variant rounded-2xl shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight flex items-center gap-2"><KeyRound className="w-5 h-5" /> Roles &amp; Permissions</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Decide exactly what each staff role can do. Publishing updates the server rules immediately; affected staff pick up changes at their next sign-in.
          </p>
          <p className="text-[11px] mt-2">
            {rbacPublished
              ? <span className="text-emerald-700 font-bold">● Live — last published {rbac.updatedAt?.slice(0, 16).replace('T', ' ')} by {rbac.updatedBy}</span>
              : <span className="text-amber-700 font-bold">● Not yet published — built-in defaults are shown, and only Super Admins pass server checks until you publish.</span>}
            {rbacError && <span className="block text-error">Could not load the live matrix: {rbacError}</span>}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <button onClick={openCreate} className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><Plus className="w-3.5 h-3.5" /> New role</button>
            <button onClick={handleReset} className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"><RotateCcw className="w-3.5 h-3.5" /> Defaults</button>
            {dirty && <button onClick={() => setDraft(cloneRbac(rbac))} className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold cursor-pointer">Discard</button>}
            <button onClick={handlePublish} disabled={saving || (!dirty && rbacPublished)} className="px-4 py-2 bg-primary-container text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
              <Save className="w-3.5 h-3.5 text-accent-green" /> {saving ? 'Publishing…' : rbacPublished ? 'Publish changes' : 'Publish matrix'}
            </button>
          </div>
        )}
      </div>

      {!canManage && (
        <div className="p-3 rounded-xl border border-outline-variant bg-surface-container-low text-xs text-on-surface-variant flex items-center gap-2">
          <Lock className="w-4 h-4" /> Read-only view. Editing requires the “Edit roles &amp; permission matrix” permission.
        </div>
      )}
      {dirty && (
        <div className="p-3 rounded-xl border border-amber-200 bg-amber-50 text-xs text-amber-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" /> You have unpublished changes.
        </div>
      )}

      {/* Role cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {roles.map((r) => (
          <div key={r.id} className="bg-white border border-outline-variant rounded-xl p-4 shadow-xs">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-black text-sm text-primary-container flex items-center gap-1.5">
                  {r.id === SUPER_ADMIN && <ShieldCheck className="w-4 h-4 text-red-600" />}{r.label}
                  {!r.builtIn && <span className="text-[9px] font-black uppercase bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded">Custom</span>}
                </p>
                <p className="text-[10px] font-mono text-on-surface-variant">{r.id}</p>
              </div>
              {canManage && r.id !== SUPER_ADMIN && (
                <div className="flex gap-1">
                  <button onClick={() => setEditing({ mode: 'edit', role: { ...r }, copyFrom: '' })} title="Edit role" className="p-1.5 rounded-lg hover:bg-surface-container cursor-pointer"><Pencil className="w-3.5 h-3.5" /></button>
                  {!r.builtIn && <button onClick={() => deleteRole(r)} title="Delete role" className="p-1.5 rounded-lg hover:bg-red-50 text-red-600 cursor-pointer"><Trash2 className="w-3.5 h-3.5" /></button>}
                </div>
              )}
            </div>
            <p className="text-xs text-on-surface-variant mt-2 min-h-[2.5em]">{r.description}</p>
            <div className="flex items-center gap-3 mt-2 text-[11px] font-bold text-on-surface-variant">
              <span>{r.permissions.length}/{PERMISSIONS.length} permissions</span>
              {userCounts && <span className="flex items-center gap-1"><Users className="w-3 h-3" /> {userCounts[r.id] ?? 0} user(s)</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Legend + filter */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex flex-wrap gap-3 text-[11px] text-on-surface-variant">
          {(Object.keys(ENFORCEMENT_META) as Enforcement[]).map((e) => {
            const m = ENFORCEMENT_META[e];
            return <span key={e} className="flex items-center gap-1.5" title={m.hint}><span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${m.cls}`}><m.Icon className="w-3 h-3" />{m.label}</span>{m.hint}</span>;
          })}
        </div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter permissions…" className="h-9 px-3 rounded-lg border border-outline-variant bg-white text-xs w-full md:w-64" />
      </div>

      {/* Matrix */}
      <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-surface-container-low text-on-surface-variant">
              <th className="sticky left-0 bg-surface-container-low text-left p-3 min-w-[280px] text-[10px] uppercase tracking-wider font-extrabold">Permission</th>
              {roles.map((r) => (
                <th key={r.id} className="p-3 text-center min-w-[96px] text-[10px] uppercase tracking-wider font-extrabold whitespace-nowrap">{r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_MODULES.map((module) => {
              const perms = visiblePermissions.filter((p) => p.module === module);
              if (perms.length === 0) return null;
              return (
                <ModuleRows key={module} module={module} perms={perms} roles={roles} canManage={canManage} onToggle={toggle} onToggleModule={toggleModule} />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Role editor */}
      <AnimatePresence>
        {editing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" role="dialog" aria-modal="true">
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 relative">
              <button onClick={() => setEditing(null)} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer" aria-label="Close"><X className="w-4 h-4" /></button>
              <h4 className="font-extrabold text-lg text-primary-container">{editing.mode === 'create' ? 'New staff role' : `Edit ${editing.role.label}`}</h4>
              <label className="block text-xs">
                <span className="font-bold block mb-1">Role name</span>
                <input autoFocus value={editing.role.label} onChange={(e) => setEditing({ ...editing, role: { ...editing.role, label: e.target.value } })} className="w-full h-10 px-3 rounded-lg border border-outline-variant" placeholder="e.g. Regional Supervisor" />
              </label>
              {editing.mode === 'create' && (
                <label className="block text-xs">
                  <span className="font-bold block mb-1">Role ID <span className="font-normal text-on-surface-variant">(permanent; stored on user records)</span></span>
                  <input value={editing.role.id} onChange={(e) => setEditing({ ...editing, role: { ...editing.role, id: e.target.value.toLowerCase() } })} className="w-full h-10 px-3 rounded-lg border border-outline-variant font-mono" placeholder={slugifyRoleId(editing.role.label) || 'regional_supervisor'} />
                </label>
              )}
              <label className="block text-xs">
                <span className="font-bold block mb-1">Description</span>
                <textarea value={editing.role.description} onChange={(e) => setEditing({ ...editing, role: { ...editing.role, description: e.target.value } })} rows={2} className="w-full px-3 py-2 rounded-lg border border-outline-variant" />
              </label>
              {editing.mode === 'create' && (
                <label className="block text-xs">
                  <span className="font-bold block mb-1">Start with permissions from</span>
                  <select value={editing.copyFrom} onChange={(e) => setEditing({ ...editing, copyFrom: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-outline-variant">
                    <option value="">No permissions</option>
                    {roles.filter((r) => r.id !== SUPER_ADMIN).map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
                  </select>
                </label>
              )}
              {editing.mode === 'create' && (
                <p className="text-[11px] text-on-surface-variant">Custom roles can sign in to the staff portal once the updated Cloud Functions are deployed.</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 border border-outline-variant rounded-xl text-xs font-bold cursor-pointer">Cancel</button>
                <button onClick={submitRole} className="px-4 py-2 bg-primary-container text-white rounded-xl text-xs font-bold cursor-pointer">{editing.mode === 'create' ? 'Add to draft' : 'Update draft'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ModuleRows({ module, perms, roles, canManage, onToggle, onToggleModule }: {
  module: string;
  perms: typeof PERMISSIONS;
  roles: RoleDef[];
  canManage: boolean;
  onToggle: (roleId: string, perm: PermissionId) => void;
  onToggleModule: (roleId: string, module: string) => void;
}) {
  return (
    <>
      <tr className="bg-primary-container/5 border-t border-outline-variant">
        <td className="sticky left-0 bg-[#f3f6f4] p-2.5 pl-3 text-[10px] font-black uppercase tracking-wider text-primary-container">{module}</td>
        {roles.map((r) => {
          const all = perms.every((p) => r.permissions.includes(p.id));
          const locked = !canManage || r.id === SUPER_ADMIN;
          return (
            <td key={r.id} className="p-2 text-center">
              {!locked && (
                <button onClick={() => onToggleModule(r.id, module)} className="text-[9px] font-bold text-primary-container hover:underline cursor-pointer">
                  {all ? 'none' : 'all'}
                </button>
              )}
            </td>
          );
        })}
      </tr>
      {perms.map((p) => {
        const m = ENFORCEMENT_META[p.enforcement];
        return (
          <tr key={p.id} className="border-t border-outline-variant/40 hover:bg-surface-container-lowest">
            <td className="sticky left-0 bg-white p-3 align-top">
              <div className="flex items-start gap-2">
                <div className="min-w-0">
                  <p className="font-bold text-on-surface">{p.label}</p>
                  <p className="text-[10px] text-on-surface-variant leading-snug">{p.description}</p>
                  <p className="mt-1 flex items-center gap-2">
                    <span className="font-mono text-[9px] text-on-surface-variant">{p.id}</span>
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[9px] font-black uppercase ${m.cls}`} title={m.hint}><m.Icon className="w-3 h-3" />{m.label}</span>
                    <span className={`text-[9px] uppercase ${RISK_CLS[p.risk]}`}>{p.risk} risk</span>
                  </p>
                </div>
              </div>
            </td>
            {roles.map((r) => {
              const on = r.permissions.includes(p.id);
              const locked = !canManage || r.id === SUPER_ADMIN;
              return (
                <td key={r.id} className="p-3 text-center align-middle">
                  <input
                    type="checkbox"
                    checked={on}
                    disabled={locked}
                    onChange={() => onToggle(r.id, p.id)}
                    aria-label={`${r.label}: ${p.label}`}
                    className="w-4 h-4 accent-[#013220] cursor-pointer disabled:cursor-not-allowed"
                  />
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}


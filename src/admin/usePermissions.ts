import { useSession } from '../context/SessionContext';
import { permissionsForRole, roleLabel, type PermissionId } from './permissions';
import { useRbacState } from './platformStore';

/** Current staff member's role and permission checks, driven by the live RBAC matrix. */
export function usePermissions() {
  const { session } = useSession();
  const rbacState = useRbacState();
  const role = session.systemRole === 'admin' ? session.adminRole ?? null : null;
  const perms = permissionsForRole(role, rbacState.value);
  return {
    role,
    roleLabel: role ? roleLabel(role, rbacState.value) : 'Taxpayer',
    rbac: rbacState.value,
    rbacLoaded: rbacState.loaded,
    rbacPublished: rbacState.exists,
    rbacError: rbacState.error,
    actorEmail: session.contactMethod,
    actorName: session.fullName || session.contactMethod,
    can: (p: PermissionId) => perms.has(p),
    canAny: (...ps: PermissionId[]) => ps.some((p) => perms.has(p)),
  };
}


/**
 * RouteGuard.tsx — Route Protection Components
 *
 * Provides wrapper components that enforce authentication and role-based
 * access control on protected routes. Redirects unauthorized users.
 */

import { Navigate } from 'react-router-dom';
import { useSession } from '../context/SessionContext';

interface GuardProps {
  children: React.ReactNode;
}

/**
 * AuthGuard — Requires the user to be verified (logged in).
 * Redirects to the gateway (/) if not authenticated.
 */
export function AuthGuard({ children }: GuardProps) {
  const { session } = useSession();

  if (!session.isVerified) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

/**
 * AdminGuard — Requires the user to have an admin system role.
 * Redirects to the admin login (/admin) if not an admin.
 */
export function AdminGuard({ children }: GuardProps) {
  const { session } = useSession();

  if (session.systemRole !== 'admin') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

/**
 * SuperAdminGuard — Requires the user to be a super_admin.
 * Redirects to the admin login (/admin) if not a super admin.
 */
export function SuperAdminGuard({ children }: GuardProps) {
  const { session } = useSession();

  if (session.systemRole !== 'admin' || session.adminRole !== 'super_admin') {
    return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
}

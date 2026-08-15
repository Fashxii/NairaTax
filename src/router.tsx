/**
 * router.tsx — Application Route Definitions
 *
 * Maps screen states to URL paths with role-based route protection.
 * Protected routes are wrapped with AuthGuard, AdminGuard, or SuperAdminGuard
 * to enforce authentication and authorization before rendering.
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import Gateway from './components/Gateway';
import Verification from './components/Verification';
import ComplianceLink from './components/ComplianceLink';
import Dashboard from './components/Dashboard';
import AdminGateway from './components/AdminGateway';
import AdminDashboard from './components/AdminDashboard';
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';
import { AuthGuard, AdminGuard, SuperAdminGuard } from './components/RouteGuard';

/**
 * Route definitions:
 *
 *  /                → Gateway (landing / login / register)
 *  /verify          → OTP Verification (email code)
 *  /compliance      → NIN Linking
 *  /dashboard       → Main Dashboard (protected — requires verified user)
 *  /admin           → Admin Staff Login
 *  /admin/dashboard → Admin Dashboard Panel (protected — requires admin role)
 *  /admin/super     → Super Admin Master Panel (protected — requires super_admin)
 *  *                → Redirect to /
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Gateway /> },
      { path: 'verify', element: <Verification /> },
      { path: 'compliance', element: <ComplianceLink /> },
      { path: 'dashboard', element: <AuthGuard><Dashboard /></AuthGuard> },
      { path: 'admin', element: <AdminGateway /> },
      { path: 'admin/dashboard', element: <AdminGuard><AdminDashboard /></AdminGuard> },
      { path: 'admin/super', element: <SuperAdminGuard><SuperAdminDashboard /></SuperAdminGuard> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

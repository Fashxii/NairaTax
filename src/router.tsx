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
import RegistrationWizard from './components/registration/RegistrationWizard';
import CorporateWizard from './components/registration/corporate/CorporateWizard';
import ComplianceLink from './components/ComplianceLink';
import Dashboard from './components/Dashboard';
import AdminGateway from './components/AdminGateway';
import SuperAdminDashboard from './components/admin/SuperAdminDashboard';
import { AuthGuard, AdminGuard } from './components/RouteGuard';

/**
 * Route definitions:
 *
 *  /                → Gateway (landing / login / register)
 *  /verify          → OTP Verification (email code)
 *  /register        → Individual (PIT) 5-step onboarding wizard
 *  /register/business → Corporate (CIT / VAT) 5-step onboarding wizard
 *  /compliance      → NIN Linking
 *  /dashboard       → Main Dashboard (protected — requires verified user)
 *  /admin           → Admin Staff Login
 *  /admin/dashboard → Admin Console (any staff role; tabs gated by permissions)
 *  /admin/super     → Same Admin Console (legacy URL kept for bookmarks)
 *  *                → Redirect to /
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Gateway /> },
      { path: 'verify', element: <Verification /> },
      { path: 'register', element: <RegistrationWizard /> },
      { path: 'register/business', element: <CorporateWizard /> },
      { path: 'compliance', element: <ComplianceLink /> },
      { path: 'dashboard', element: <AuthGuard><Dashboard /></AuthGuard> },
      { path: 'admin', element: <AdminGateway /> },
      { path: 'admin/dashboard', element: <AdminGuard><SuperAdminDashboard /></AdminGuard> },
      { path: 'admin/super', element: <AdminGuard><SuperAdminDashboard /></AdminGuard> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

/**
 * router.tsx — Application Route Definitions
 *
 * Maps the 4 screen states (Gateway → Verification → ComplianceLink → Dashboard)
 * to URL paths. Dashboard sub-tabs remain state-driven within Dashboard.tsx
 * for now (Phase 2 can add nested routes if needed).
 */

import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from './AppShell';
import Gateway from './components/Gateway';
import Verification from './components/Verification';
import ComplianceLink from './components/ComplianceLink';
import Dashboard from './components/Dashboard';

/**
 * Route definitions:
 *
 *  /             → Gateway (landing / login)
 *  /verify       → OTP Verification
 *  /compliance   → NIN Linking
 *  /dashboard    → Main Dashboard (tabs handled internally)
 *  *             → Redirect to /
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <Gateway /> },
      { path: 'verify', element: <Verification /> },
      { path: 'compliance', element: <ComplianceLink /> },
      { path: 'dashboard', element: <Dashboard /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
]);

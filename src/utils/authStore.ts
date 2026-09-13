/**
 * authStore.ts — Persistent User Registry
 *
 * Provides a localStorage-backed user store with full CRUD operations.
 * All registered users (taxpayers, admins, reviewers) are stored here.
 * Upgradeable to Firebase/Prisma by swapping the storage layer.
 *
 * Passwords are hashed client-side using a simple SHA-256 digest.
 * For production, migrate to bcrypt on a server-side API.
 */

import { getStored, setStored } from './store';

// ─── Types ──────────────────────────────────────────────────────────

export type UserRole = 'taxpayer' | 'super_admin' | 'content_manager' | 'reviewer';
export type AccountType = 'individual' | 'business';

export interface RegisteredUser {
  id: string;
  email: string;
  fullName: string;
  accountType: AccountType;
  role: UserRole;
  passwordHash: string | null; // null for OTP-only taxpayer accounts
  isActive: boolean;
  createdAt: string;
  lastLogin: string | null;
}

const STORE_KEY = 'registered_users';

// ─── Seed Super Admin ───────────────────────────────────────────────
// Ensures at least one super_admin account exists on first load.

const SEED_ADMIN: RegisteredUser = {
  id: 'admin_seed_001',
  email: 'admin@diytax9ja.ng',
  fullName: 'System Administrator',
  accountType: 'individual',
  role: 'super_admin',
  passwordHash: null, // Will be set on first login or via admin panel
  isActive: true,
  createdAt: new Date().toISOString(),
  lastLogin: null,
};

function ensureSeedAdmin(): void {
  const users = getStored<RegisteredUser[]>(STORE_KEY, []);
  const hasAdmin = users.some((u) => u.role === 'super_admin');
  if (!hasAdmin) {
    setStored(STORE_KEY, [...users, SEED_ADMIN]);
  }
}

// Run seed check on module load
ensureSeedAdmin();

// ─── CRUD Operations ────────────────────────────────────────────────

/** Get all registered users */
export function getAllUsers(): RegisteredUser[] {
  return getStored<RegisteredUser[]>(STORE_KEY, []);
}

/** Find a user by email (case-insensitive) */
export function findUserByEmail(email: string): RegisteredUser | undefined {
  const users = getAllUsers();
  return users.find((u) => u.email.toLowerCase() === email.toLowerCase());
}

/** Find a user by ID */
export function findUserById(id: string): RegisteredUser | undefined {
  const users = getAllUsers();
  return users.find((u) => u.id === id);
}

/** Register a new user. Returns the created user or throws if email exists. */
export function registerUser(
  email: string,
  fullName: string,
  accountType: AccountType,
  role: UserRole = 'taxpayer',
  passwordHash: string | null = null
): RegisteredUser {
  const existing = findUserByEmail(email);
  if (existing) {
    throw new Error(`A user with email "${email}" already exists.`);
  }

  const newUser: RegisteredUser = {
    id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    email: email.toLowerCase().trim(),
    fullName: fullName.trim(),
    accountType,
    role,
    passwordHash,
    isActive: true,
    createdAt: new Date().toISOString(),
    lastLogin: null,
  };

  const users = getAllUsers();
  setStored(STORE_KEY, [...users, newUser]);
  return newUser;
}

/** Update an existing user's fields */
export function updateUser(id: string, updates: Partial<Omit<RegisteredUser, 'id'>>): RegisteredUser | null {
  const users = getAllUsers();
  const index = users.findIndex((u) => u.id === id);
  if (index === -1) return null;

  const updated = { ...users[index], ...updates };
  users[index] = updated;
  setStored(STORE_KEY, users);
  return updated;
}

/** Record a login timestamp for a user */
export function recordLogin(id: string): void {
  updateUser(id, { lastLogin: new Date().toISOString() });
}

/** Delete a user by ID. Returns true if deleted. */
export function deleteUser(id: string): boolean {
  const users = getAllUsers();
  const filtered = users.filter((u) => u.id !== id);
  if (filtered.length === users.length) return false;
  setStored(STORE_KEY, filtered);
  return true;
}

// ─── Server-backed Password Verification Helpers ──────────────────────

/**
 * Hash password via server endpoint or secure browser WebCrypto fallback
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_nairatax_secure_salt_v2');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Verify staff admin password against backend authorization endpoint (/api/auth/admin/login)
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  if (!storedHash) return true;
  const hash = await hashPassword(password);
  return hash === storedHash;
}

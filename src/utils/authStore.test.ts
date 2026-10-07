/**
 * authStore.test.ts — Unit tests for authStore
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findUserByEmail,
  verifyPassword,
  hashPassword,
  registerUser,
  upsertUser,
  getAllUsers,
  purgeLegacySeedAdmins,
} from './authStore';
import { setStored } from './store';

describe('authStore', () => {
  beforeEach(() => {
    setStored('registered_users', []);
  });

  it('does not seed any admin accounts or credentials', () => {
    expect(findUserByEmail('admin@diytax9ja.ng')).toBeUndefined();
    expect(getAllUsers().some((u) => u.role !== 'taxpayer')).toBe(false);
  });

  it('purges legacy seeded admins left in storage', () => {
    setStored('registered_users', [
      { id: 'admin_seed_001', email: 'admin@diytax9ja.ng', fullName: 'x', accountType: 'individual', role: 'super_admin', passwordHash: null, isActive: true, createdAt: '', lastLogin: null },
      { id: 'u1', email: 'keep@example.com', fullName: 'Keep Me', accountType: 'individual', role: 'taxpayer', passwordHash: null, isActive: true, createdAt: '', lastLogin: null },
    ]);
    purgeLegacySeedAdmins();
    expect(getAllUsers().map((u) => u.id)).toEqual(['u1']);
  });

  it('registers and finds users case-insensitively', () => {
    registerUser('Jane.Doe@Example.com', 'Jane Doe', 'individual');
    expect(findUserByEmail('JANE.DOE@EXAMPLE.COM')?.fullName).toBe('Jane Doe');
  });

  it('verifies matching passwords and rejects others', async () => {
    const hash = await hashPassword('Correct-Horse-1');
    expect(await verifyPassword('Correct-Horse-1', hash)).toBe(true);
    expect(await verifyPassword('wrong', hash)).toBe(false);
  });

  it('never accepts a password when no hash is stored', async () => {
    expect(await verifyPassword('anything', '')).toBe(false);
  });

  it('upserts new user and updates existing user credentials without throwing duplicate error', () => {
    const created = upsertUser('returning@example.com', 'Samson Ade', 'individual');
    expect(created.email).toBe('returning@example.com');
    expect(created.fullName).toBe('Samson Ade');

    // Second upsert should update existing user without failing
    const updated = upsertUser('returning@example.com', 'Samson Adebayo', 'business');
    expect(updated.id).toBe(created.id);
    expect(updated.fullName).toBe('Samson Adebayo');
    expect(updated.accountType).toBe('business');
    expect(getAllUsers().filter((u) => u.email === 'returning@example.com').length).toBe(1);
  });
});

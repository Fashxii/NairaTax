/**
 * authStore.test.ts — Unit tests for authStore and Super Admin authentication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  findUserByEmail,
  verifyPassword,
  hashPassword,
  ensureSeedAdmin,
  SAMSON_SUPER_ADMIN,
} from './authStore';

describe('authStore — Super Admin Account Verification', () => {
  beforeEach(() => {
    ensureSeedAdmin();
  });

  it('contains the seeded super admin for samsontila@gmail.com', () => {
    const user = findUserByEmail('samsontila@gmail.com');
    expect(user).toBeDefined();
    expect(user?.email).toBe('samsontila@gmail.com');
    expect(user?.role).toBe('super_admin');
    expect(user?.isActive).toBe(true);
    expect(user?.passwordHash).toBe(SAMSON_SUPER_ADMIN.passwordHash);
  });

  it('finds samsontila@gmail.com case-insensitively', () => {
    const userUpper = findUserByEmail('SAMSONTILA@GMAIL.COM');
    const userMixed = findUserByEmail('SamsonTila@Gmail.com');
    expect(userUpper).toBeDefined();
    expect(userMixed).toBeDefined();
    expect(userUpper?.id).toBe(userMixed?.id);
  });

  it('verifies the password Indiaolover22 successfully', async () => {
    const user = findUserByEmail('samsontila@gmail.com');
    expect(user).toBeDefined();
    if (!user || !user.passwordHash) throw new Error('User or hash not found');

    const isValid = await verifyPassword('Indiaolover22', user.passwordHash);
    expect(isValid).toBe(true);
  });

  it('rejects incorrect passwords', async () => {
    const user = findUserByEmail('samsontila@gmail.com');
    expect(user).toBeDefined();
    if (!user || !user.passwordHash) throw new Error('User or hash not found');

    const isWrong = await verifyPassword('WrongPassword123', user.passwordHash);
    expect(isWrong).toBe(false);

    const isWrongCase = await verifyPassword('indiaolover22', user.passwordHash);
    expect(isWrongCase).toBe(false);
  });

  it('computes expected hash digest with salt', async () => {
    const hash = await hashPassword('Indiaolover22');
    expect(hash).toBe('d8461608057bbc8338cc9ca2551acb2d828d680679662e5cd6ce8d2012f91cc4');
  });
});

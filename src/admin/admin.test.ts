/**
 * admin.test.ts — RBAC matrix, platform settings and tax-rule overrides.
 */

import { describe, it, expect, afterEach } from 'vitest';
import {
  PERMISSIONS, PERMISSION_IDS, BUILT_IN_ROLES, defaultRbac, normalizeRbac, permissionsForRole,
  can, isStaffRole, isValidRoleId, slugifyRoleId, roleLabel,
} from './permissions';
import { defaultSettings, normalizeSettings, isAnnouncementVisible, FEATURE_FLAGS } from './platformSettings';
import { applyTaxRules, normalizeTaxRules, diffTaxYear, defaultTaxYears } from './taxRules';
import { getTaxYearConfig, TAX_YEAR_CONFIGS } from '../nrs/taxYearConfig';
import { WHT_RATE_SCHEDULE, getWHTRate } from '../utils/whtEngine';
import { buildTransaction } from '../nrs/ledger';
import { nairaToKobo } from '../nrs/money';

describe('permission catalog', () => {
  it('has unique ids and every permission belongs to a module', () => {
    expect(new Set(PERMISSION_IDS).size).toBe(PERMISSION_IDS.length);
    for (const p of PERMISSIONS) expect(p.module).toBeTruthy();
  });
  it('built-in roles only reference known permissions', () => {
    for (const r of BUILT_IN_ROLES) for (const p of r.permissions) expect(PERMISSION_IDS).toContain(p);
  });
});

describe('RBAC resolution', () => {
  const rbac = defaultRbac();
  it('super_admin always has every permission', () => {
    expect(permissionsForRole('super_admin', rbac).size).toBe(PERMISSION_IDS.length);
    const tampered = normalizeRbac({ roles: { super_admin: { label: 'x', permissions: [] } } });
    expect(can('super_admin', 'roles.manage', tampered)).toBe(true);
  });
  it('taxpayers and unknown roles have nothing', () => {
    expect(permissionsForRole('taxpayer', rbac).size).toBe(0);
    expect(permissionsForRole('ghost', rbac).size).toBe(0);
    expect(permissionsForRole(undefined, rbac).size).toBe(0);
    expect(isStaffRole('taxpayer', rbac)).toBe(false);
    expect(isStaffRole('ghost', rbac)).toBe(false);
  });
  it('applies the default matrix', () => {
    expect(can('content_manager', 'cms.edit', rbac)).toBe(true);
    expect(can('content_manager', 'users.view', rbac)).toBe(false);
    expect(can('reviewer', 'nrs.unlock_period', rbac)).toBe(true);
    expect(can('finance_auditor', 'tax_rules.verify', rbac)).toBe(true);
    expect(can('support_agent', 'users.suspend', rbac)).toBe(true);
    expect(can('support_agent', 'roles.manage', rbac)).toBe(false);
  });
  it('normalizes stored matrices: custom roles kept, junk dropped', () => {
    const r = normalizeRbac({
      roles: {
        regional_lead: { label: 'Regional Lead', description: 'd', permissions: ['users.view', 'not.a.perm'] },
        'Bad Id': { label: 'x', permissions: ['users.view'] },
        taxpayer: { label: 'x', permissions: ['users.view'] },
        reviewer: { label: 'Reviewer+', permissions: ['audit.view'] },
      },
      updatedBy: 'a@b.c',
    });
    expect(r.roles.regional_lead).toMatchObject({ builtIn: false, permissions: ['users.view'] });
    expect(r.roles['Bad Id']).toBeUndefined();
    expect(r.roles.taxpayer).toBeUndefined();
    expect(r.roles.reviewer).toMatchObject({ builtIn: true, label: 'Reviewer+', permissions: ['audit.view'] });
    expect(r.updatedBy).toBe('a@b.c');
    expect(isStaffRole('regional_lead', r)).toBe(true);
    expect(roleLabel('regional_lead', r)).toBe('Regional Lead');
    expect(roleLabel('taxpayer', r)).toBe('Taxpayer');
  });
  it('validates and slugifies role ids', () => {
    expect(isValidRoleId('regional_lead')).toBe(true);
    expect(isValidRoleId('1abc')).toBe(false);
    expect(isValidRoleId('ab')).toBe(false);
    expect(slugifyRoleId('  Regional Lead (Lagos) ')).toBe('regional_lead_lagos');
  });
});

describe('platform settings', () => {
  it('defaults enable every feature and keep maintenance off', () => {
    const s = defaultSettings();
    expect(FEATURE_FLAGS.every((f) => s.flags[f.id])).toBe(true);
    expect(s.maintenance.enabled).toBe(false);
    expect(s.sessionPolicy).toEqual({ inactivityMinutes: 5, absoluteHours: 24 });
  });
  it('normalizes and clamps stored values', () => {
    const s = normalizeSettings({
      flags: { payroll: false, bogus: false, nrsReturns: 'yes' },
      maintenance: { enabled: true, message: '' },
      sessionPolicy: { inactivityMinutes: 0, absoluteHours: 500 },
      announcement: { enabled: true, message: 'Hi', tone: 'loud', audience: 'aliens', expiresOn: 'soon' },
    });
    expect(s.flags.payroll).toBe(false);
    expect(s.flags.nrsReturns).toBe(true);
    expect(s.maintenance.enabled).toBe(true);
    expect(s.maintenance.message.length).toBeGreaterThan(0);
    expect(s.sessionPolicy).toEqual({ inactivityMinutes: 2, absoluteHours: 72 });
    expect(s.announcement).toMatchObject({ tone: 'info', audience: 'all', expiresOn: '' });
    expect(normalizeSettings(null)).toEqual(defaultSettings());
  });
  it('shows announcements by audience and expiry', () => {
    const a = { enabled: true, message: 'Deadline', tone: 'info' as const, audience: 'business' as const, expiresOn: '2026-11-30' };
    expect(isAnnouncementVisible(a, 'business', '2026-11-11')).toBe(true);
    expect(isAnnouncementVisible(a, 'individual', '2026-11-11')).toBe(false);
    expect(isAnnouncementVisible(a, 'business', '2026-12-01')).toBe(false);
    expect(isAnnouncementVisible({ ...a, enabled: false }, 'business', '2026-11-11')).toBe(false);
    expect(isAnnouncementVisible({ ...a, message: '  ' }, 'business', '2026-11-11')).toBe(false);
  });
});

describe('tax rule overrides', () => {
  afterEach(() => applyTaxRules(null));

  it('drops invalid fields and unknown WHT ids', () => {
    const doc = normalizeTaxRules({
      taxYears: { '2026': { vatRateBps: 800, vatReturnDueDay: 40, verified: true }, abc: { vatRateBps: 1 } },
      whtRates: { rent: { companyRate: 0.12, individualRate: 0.1 }, nope: { companyRate: 0.1, individualRate: 0.1 }, supply: { companyRate: 2, individualRate: 0.1 } },
    });
    expect(doc.taxYears['2026']).toEqual({ vatRateBps: 800, verified: true });
    expect(doc.taxYears.abc).toBeUndefined();
    expect(Object.keys(doc.whtRates)).toEqual(['rent']);
  });

  it('applies overrides live to the engines and resets cleanly', () => {
    applyTaxRules(normalizeTaxRules({
      taxYears: { '2026': { vatRateBps: 1000, smallCompanyTurnoverThresholdKobo: nairaToKobo(50_000_000), verified: true, verifiedBy: 'Adviser' } },
      whtRates: { rent: { companyRate: 0.12, individualRate: 0.12 } },
    }));
    expect(getTaxYearConfig(2026)).toMatchObject({ vatRateBps: 1000, verified: true, verifiedBy: 'Adviser' });
    expect(getWHTRate('rent', 'company')).toBe(0.12);
    // Engines pick it up: 10% VAT on ₦110,000 gross = ₦10,000
    const tx = buildTransaction({ source: 'MANUAL', sourceRef: 'x', date: '2026-10-01', amountKobo: nairaToKobo(110_000), direction: 'OUTFLOW', narration: 'MTN data bundle' });
    expect(tx.vatKobo).toBe(nairaToKobo(10_000));

    applyTaxRules(null);
    expect(getTaxYearConfig(2026).vatRateBps).toBe(750);
    expect(getWHTRate('rent', 'company')).toBe(0.1);
  });

  it('adds new tax years inheriting from the previous year', () => {
    applyTaxRules(normalizeTaxRules({ taxYears: { '2027': { vatRateBps: 1000 } } }));
    const y = getTaxYearConfig(2027);
    expect(y.year).toBe(2027);
    expect(y.vatRateBps).toBe(1000);
    expect(y.verified).toBe(false);
    expect(y.smallCompanyTurnoverThresholdKobo).toBe(getTaxYearConfig(2026).smallCompanyTurnoverThresholdKobo);
    applyTaxRules(null);
    expect(TAX_YEAR_CONFIGS.some((c) => c.year === 2027)).toBe(false);
    expect(WHT_RATE_SCHEDULE.length).toBeGreaterThan(0);
  });

  it('stores only fields that differ from the shipped defaults', () => {
    const base = defaultTaxYears().find((c) => c.year === 2026)!;
    expect(diffTaxYear(base)).toEqual({});
    expect(diffTaxYear({ ...base, vatReturnDueDay: 14, verified: true })).toEqual({ vatReturnDueDay: 14, verified: true });
  });
});


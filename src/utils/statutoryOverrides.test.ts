import { describe, it, expect } from 'vitest';
import {
  normalizeOverrides,
  approvedReliefTotal,
  activeApprovedReliefs,
  resolveVatActive,
  hasAnyOverride,
  DEFAULT_OVERRIDES,
} from './statutoryOverrides';
import { calculateCIT, resolveCompanyTier, CIT_TIERS } from './citEngine';
import { calculatePIT, DEDUCTION_AMOUNTS, PITDeductionConfig } from './taxEngine';

describe('normalizeOverrides', () => {
  it('returns safe defaults for missing / malformed data', () => {
    expect(normalizeOverrides(undefined)).toEqual({ ...DEFAULT_OVERRIDES, note: undefined, updatedAt: undefined, updatedBy: undefined });
    const n = normalizeOverrides({ reliefs: { disabled: 'yes' }, corporate: { citBracket: 'huge', vatStatus: 1 } });
    expect(n.reliefs.disabled).toBe(false);
    expect(n.corporate).toEqual({ citBracket: 'auto', vatStatus: 'auto' });
  });

  it('keeps valid values', () => {
    const n = normalizeOverrides({ reliefs: { disabled: true }, corporate: { citBracket: 'small', vatStatus: 'exempt' }, note: 'ok' });
    expect(n.reliefs.disabled).toBe(true);
    expect(n.corporate).toEqual({ citBracket: 'small', vatStatus: 'exempt' });
    expect(hasAnyOverride(n)).toBe(true);
  });
});

describe('approved reliefs', () => {
  it('totals only the switched-on reliefs', () => {
    const o = normalizeOverrides({ reliefs: { disabled: true, children: true } });
    expect(activeApprovedReliefs(o).map((r) => r.key).sort()).toEqual(['children', 'disabled']);
    expect(approvedReliefTotal(o)).toBe(DEDUCTION_AMOUNTS.disabled + DEDUCTION_AMOUNTS.children);
    expect(approvedReliefTotal(DEFAULT_OVERRIDES)).toBe(0);
  });

  it('reduces PIT taxable income when applied via the engine flags', () => {
    const base: PITDeductionConfig = {
      pensionRate: 8, vpc: false, lifeAssurance: false, nhf: false, nhis: false, charity: false,
      children: false, dependantRelative: false, disabled: false, mortgageInterest: false, bondExempt: false,
    };
    const without = calculatePIT(6_000_000, base);
    const withDisabled = calculatePIT(6_000_000, { ...base, disabled: true });
    expect(without.taxableIncome - withDisabled.taxableIncome).toBe(DEDUCTION_AMOUNTS.disabled);
  });
});

describe('resolveVatActive', () => {
  it('honours mandatory / exempt and falls back for auto', () => {
    expect(resolveVatActive(normalizeOverrides({ corporate: { vatStatus: 'exempt' } }), true)).toBe(false);
    expect(resolveVatActive(normalizeOverrides({ corporate: { vatStatus: 'mandatory' } }), false)).toBe(true);
    expect(resolveVatActive(DEFAULT_OVERRIDES, true)).toBe(true);
    expect(resolveVatActive(DEFAULT_OVERRIDES, false)).toBe(false);
  });
});

describe('CIT bracket override', () => {
  const input = {
    grossTurnover: 200_000_000, totalRevenue: 200_000_000, allowableExpenses: 150_000_000,
    capitalAllowances: 0, lossesCarriedForward: 0, isTechLevySector: false,
  };

  it('auto uses turnover classification', () => {
    expect(resolveCompanyTier(200_000_000)).toBe(CIT_TIERS[2]);
    expect(calculateCIT(input).isBracketOverridden).toBe(false);
  });

  it("'small' forces the 0% tier and zero CIT", () => {
    const r = calculateCIT({ ...input, bracketOverride: 'small' });
    expect(r.citRate).toBe(0);
    expect(r.totalTaxPayable).toBe(0);
    expect(r.isBracketOverridden).toBe(true);
  });

  it("'standard' forces the 30% tier for a small-turnover company", () => {
    const r = calculateCIT({ ...input, grossTurnover: 10_000_000, totalRevenue: 10_000_000, allowableExpenses: 4_000_000, bracketOverride: 'standard' });
    expect(r.citRate).toBe(0.3);
    expect(r.citLiability).toBe(1_800_000);
  });
});

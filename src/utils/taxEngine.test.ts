/**
 * taxEngine.test.ts — Unit tests for the shared Nigerian tax calculation engine
 */

import { describe, it, expect } from 'vitest';
import {
  calculateCRA,
  applyProgressiveBands,
  calculatePIT,
  calculatePayslip,
  estimateSavings,
  TAX_BANDS,
  VAT_RATE,
  PENSION_RATE,
  PITDeductionConfig,
} from './taxEngine';

const DEFAULT_DEDUCTIONS: PITDeductionConfig = {
  pensionRate: 8,
  vpc: false,
  lifeAssurance: false,
  nhf: false,
  nhis: false,
  charity: false,
  children: false,
  dependantRelative: false,
  disabled: false,
  mortgageInterest: false,
  bondExempt: false,
};

describe('calculateCRA', () => {
  it('uses ₦200,000 for low incomes where 1% < 200,000', () => {
    // 1% of 3,000,000 = 30,000 < 200,000 → use 200,000
    // CRA = 200,000 + 20% of 3,000,000 = 200,000 + 600,000 = 800,000
    expect(calculateCRA(3_000_000)).toBe(800_000);
  });

  it('uses 1% for high incomes where 1% > 200,000', () => {
    // 1% of 25,000,000 = 250,000 > 200,000 → use 250,000
    // CRA = 250,000 + 20% of 25,000,000 = 250,000 + 5,000,000 = 5,250,000
    expect(calculateCRA(25_000_000)).toBe(5_250_000);
  });

  it('boundary: exactly 20,000,000 where 1% = 200,000', () => {
    // 1% of 20,000,000 = 200,000 = 200,000 → MAX = 200,000
    // CRA = 200,000 + 4,000,000 = 4,200,000
    expect(calculateCRA(20_000_000)).toBe(4_200_000);
  });

  it('returns CRA_FLAT_BASE + 0 for zero income', () => {
    // max(200000, 0) + 0 = 200,000
    expect(calculateCRA(0)).toBe(200_000);
  });
});

describe('applyProgressiveBands', () => {
  it('returns object with annualTax and bandBreakdown', () => {
    const result = applyProgressiveBands(200_000);
    expect(result).toHaveProperty('annualTax');
    expect(result).toHaveProperty('bandBreakdown');
  });

  it('taxes only the first band for small taxable income', () => {
    // 200,000 at 7% = 14,000
    const result = applyProgressiveBands(200_000);
    expect(result.annualTax).toBeCloseTo(14_000, 0);
  });

  it('taxes across multiple bands correctly', () => {
    // 300,000 at 7% = 21,000 + 300,000 at 11% = 33,000 = 54,000
    const result = applyProgressiveBands(600_000);
    expect(result.annualTax).toBeCloseTo(54_000, 0);
    expect(result.bandBreakdown).toHaveLength(2);
  });

  it('taxes across all 6 bands for high income', () => {
    const result = applyProgressiveBands(4_000_000);
    expect(result.annualTax).toBeCloseTo(752_000, 0);
    expect(result.bandBreakdown).toHaveLength(6);
  });

  it('returns 0 for zero taxable income', () => {
    const result = applyProgressiveBands(0);
    expect(result.annualTax).toBe(0);
    expect(result.bandBreakdown).toHaveLength(0);
  });
});

describe('calculatePIT', () => {
  it('returns a valid TaxCalculationResult', () => {
    const result = calculatePIT(6_000_000, DEFAULT_DEDUCTIONS);
    expect(result.grossAnnual).toBe(6_000_000);
    expect(result.grossMonthly).toBe(500_000);
    expect(result.craRelief).toBe(calculateCRA(6_000_000));
    expect(result.taxableIncome).toBeGreaterThanOrEqual(0);
    expect(result.annualTax).toBeGreaterThanOrEqual(0);
    expect(result.effectiveTaxRate).toBeGreaterThanOrEqual(0);
    expect(result.effectiveTaxRate).toBeLessThan(25);
  });

  it('pension deduction reduces annual tax', () => {
    const withPension = calculatePIT(6_000_000, { ...DEFAULT_DEDUCTIONS, pensionRate: 8 });
    const noPension = calculatePIT(6_000_000, { ...DEFAULT_DEDUCTIONS, pensionRate: 0 });
    expect(withPension.annualTax).toBeLessThan(noPension.annualTax);
  });

  it('band breakdown sums to total annual tax', () => {
    const result = calculatePIT(6_000_000, DEFAULT_DEDUCTIONS);
    const bandSum = result.bandBreakdown.reduce((s, b) => s + b.taxInBand, 0);
    expect(bandSum).toBeCloseTo(result.annualTax, 0);
  });

  it('optional deductions reduce taxable income', () => {
    const base = calculatePIT(10_000_000, DEFAULT_DEDUCTIONS);
    const withExtras = calculatePIT(10_000_000, {
      ...DEFAULT_DEDUCTIONS,
      vpc: true,
      lifeAssurance: true,
      nhf: true,
    });
    expect(withExtras.annualTax).toBeLessThan(base.annualTax);
  });
});

describe('calculatePayslip', () => {
  it('calculates correct net pay for a typical employee', () => {
    const result = calculatePayslip({
      id: 'test-1',
      name: 'Test Employee',
      role: 'Developer',
      grossMonthlySalary: 500_000,
      optInPension: true,
      optInNHF: false,
      optInNHIS: false,
    });
    
    expect(result.employeeId).toBe('test-1');
    expect(result.gross).toBe(500_000);
    expect(result.pension).toBeCloseTo(500_000 * PENSION_RATE, 0);
    expect(result.nhf).toBe(0);
    expect(result.nhis).toBe(0);
    expect(result.paye).toBeGreaterThanOrEqual(0);
    expect(result.netPay).toBeCloseTo(result.gross - result.pension - result.nhf - result.nhis - result.paye, 2);
  });

  it('includes NHF when opted in (monthly = annual / 12)', () => {
    const result = calculatePayslip({
      id: 'test-2',
      name: 'Test',
      role: 'Analyst',
      grossMonthlySalary: 400_000,
      optInPension: true,
      optInNHF: true,
      optInNHIS: false,
    });
    
    // NHF is 2.5% of annual gross / 12
    const expectedMonthlyNHF = (400_000 * 12 * 0.025) / 12;
    expect(result.nhf).toBeCloseTo(expectedMonthlyNHF, 0);
  });

  it('includes NHIS flat annual deduction divided by 12', () => {
    const result = calculatePayslip({
      id: 'test-3',
      name: 'Test',
      role: 'Manager',
      grossMonthlySalary: 800_000,
      optInPension: false,
      optInNHF: false,
      optInNHIS: true,
    });
    
    expect(result.nhis).toBeCloseTo(60000 / 12, 0);
  });
});

describe('estimateSavings', () => {
  it('returns structured savings estimate', () => {
    const result = estimateSavings(850_000);
    expect(result.standardMonthly).toBeGreaterThan(0);
    expect(result.optimizedMonthly).toBeGreaterThan(0);
    expect(result.monthlySavings).toBeGreaterThan(0);
    expect(result.annualSavings).toBeGreaterThan(0);
    // Savings = standard - optimized
    expect(result.annualSavings).toBeCloseTo(
      (result.standardMonthly - result.optimizedMonthly) * 12, 0
    );
  });
});

describe('constants', () => {
  it('TAX_BANDS has 6 entries', () => {
    expect(TAX_BANDS).toHaveLength(6);
  });

  it('VAT_RATE is 7.5%', () => {
    expect(VAT_RATE).toBe(0.075);
  });

  it('PENSION_RATE is 8%', () => {
    expect(PENSION_RATE).toBe(0.08);
  });
});

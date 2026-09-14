/**
 * phase2Engines.test.ts — Unit tests for Phase 2 Tax Calculation Engines:
 * CIT Engine, WHT Engine, Capital Allowances Engine, Stamp Duty, and CGT
 */

import { describe, it, expect } from 'vitest';
import {
  classifyCompany,
  calculateCIT,
} from './citEngine';
import {
  WHT_RATE_SCHEDULE,
  getWHTRate,
  calculateWHT,
  generateCreditNoteRef,
  computeWHTSummary,
  WHTTransaction,
} from './whtEngine';
import {
  ASSET_CLASSES,
  calculateAssetAllowance,
  calculatePortfolioAllowances,
} from './capitalAllowances';
import {
  calculateStampDuty,
  STAMP_DUTY_CATEGORIES,
  calculateCGT,
} from './taxEngine';

// ─── CIT Engine Tests ────────────────────────────────────────────────────────

describe('CIT Engine — Company Classification & Rates', () => {
  it('classifies companies with turnover <= 25M as Small Company (0% rate)', () => {
    const tierZero = classifyCompany(0);
    expect(tierZero.label).toBe('Small Company');
    expect(tierZero.rate).toBe(0);

    const tierSmall = classifyCompany(25_000_000);
    expect(tierSmall.label).toBe('Small Company');
    expect(tierSmall.rate).toBe(0);
  });

  it('classifies companies with 25M < turnover <= 100M as Medium Company (20% rate)', () => {
    const tierMedium = classifyCompany(25_000_001);
    expect(tierMedium.label).toBe('Medium Company');
    expect(tierMedium.rate).toBe(0.20);

    const tierMediumMax = classifyCompany(100_000_000);
    expect(tierMediumMax.label).toBe('Medium Company');
    expect(tierMediumMax.rate).toBe(0.20);
  });

  it('classifies companies with turnover > 100M as Large Company (30% rate)', () => {
    const tierLarge = classifyCompany(100_000_001);
    expect(tierLarge.label).toBe('Large Company');
    expect(tierLarge.rate).toBe(0.30);
  });

  it('calculates CIT for small company with 0 tax liability and minimum tax exemption', () => {
    const result = calculateCIT({
      grossTurnover: 20_000_000,
      totalRevenue: 20_000_000,
      allowableExpenses: 12_000_000,
      capitalAllowances: 2_000_000,
      lossesCarriedForward: 0,
      isTechLevySector: false,
    });

    expect(result.companyClassification).toBe('Small Company');
    expect(result.citRate).toBe(0);
    expect(result.citLiability).toBe(0);
    expect(result.minimumTax).toBe(0);
    expect(result.applicableTax).toBe(0);
    expect(result.educationTax).toBe(0);
    expect(result.totalTaxPayable).toBe(0);
  });

  it('calculates standard CIT for medium company with EDT', () => {
    // Turnover: 60M, Revenue: 60M, Expenses: 35M, Capital Allowances: 5M
    // Assessable Profit = 60M - 35M - 5M = 20M
    // CIT Liability = 20M * 20% = 4M
    // Minimum Tax = 60M * 0.5% = 300,000
    // EDT = 20M * 2.5% = 500,000
    // Total Tax Payable = 4M + 500k = 4.5M
    const result = calculateCIT({
      grossTurnover: 60_000_000,
      totalRevenue: 60_000_000,
      allowableExpenses: 35_000_000,
      capitalAllowances: 5_000_000,
      lossesCarriedForward: 0,
      isTechLevySector: false,
    });

    expect(result.assessableProfit).toBe(20_000_000);
    expect(result.citLiability).toBe(4_000_000);
    expect(result.minimumTax).toBe(300_000);
    expect(result.isMinimumTaxApplied).toBe(false);
    expect(result.educationTax).toBe(500_000);
    expect(result.techLevy).toBe(0);
    expect(result.totalTaxPayable).toBe(4_500_000);
  });

  it('triggers minimum tax when profit is low or zero for medium/large companies', () => {
    // Large company with turnover 150M but breakeven (assessable profit = 0)
    // Minimum tax = 150M * 0.5% = 750,000
    const result = calculateCIT({
      grossTurnover: 150_000_000,
      totalRevenue: 150_000_000,
      allowableExpenses: 150_000_000,
      capitalAllowances: 0,
      lossesCarriedForward: 0,
      isTechLevySector: false,
    });

    expect(result.companyClassification).toBe('Large Company');
    expect(result.citLiability).toBe(0);
    expect(result.minimumTax).toBe(750_000);
    expect(result.isMinimumTaxApplied).toBe(true);
    expect(result.applicableTax).toBe(750_000);
    expect(result.totalTaxPayable).toBe(750_000);
  });

  it('applies tech levy (1% of PBT) for qualifying sectors', () => {
    const result = calculateCIT({
      grossTurnover: 80_000_000,
      totalRevenue: 80_000_000,
      allowableExpenses: 40_000_000,
      capitalAllowances: 10_000_000,
      lossesCarriedForward: 0,
      isTechLevySector: true,
    });

    // Assessable profit: 30M
    // Tech levy: 30M * 1% = 300,000
    expect(result.techLevy).toBe(300_000);
    expect(result.totalTaxPayable).toBe(result.applicableTax + result.educationTax + 300_000);
  });

  it('correctly deducts losses carried forward', () => {
    const result = calculateCIT({
      grossTurnover: 50_000_000,
      totalRevenue: 50_000_000,
      allowableExpenses: 30_000_000,
      capitalAllowances: 5_000_000,
      lossesCarriedForward: 10_000_000,
      isTechLevySector: false,
    });

    // Assessable profit = 15M, after loss = 5M
    expect(result.assessableProfit).toBe(15_000_000);
    expect(result.totalProfitAfterLosses).toBe(5_000_000);
    expect(result.citLiability).toBe(5_000_000 * 0.20);
  });
});

// ─── WHT Engine Tests ────────────────────────────────────────────────────────

describe('WHT Engine', () => {
  it('contains standard statutory payment types', () => {
    expect(WHT_RATE_SCHEDULE.length).toBeGreaterThanOrEqual(10);
    const dividendEntry = WHT_RATE_SCHEDULE.find(e => e.id === 'dividends');
    expect(dividendEntry).toBeDefined();
    expect(dividendEntry?.companyRate).toBe(0.10);
    expect(dividendEntry?.individualRate).toBe(0.10);
  });

  it('differentiates corporate vs individual rates for professional fees', () => {
    const companyRate = getWHTRate('professional-fees', 'company');
    const individualRate = getWHTRate('professional-fees', 'individual');
    expect(companyRate).toBe(0.10);
    expect(individualRate).toBe(0.05);
  });

  it('calculates WHT deduction accurately', () => {
    // ₦1,000,000 professional fee paid to individual (5% WHT)
    const result = calculateWHT(1_000_000, 'professional-fees', 'individual');
    expect(result.whtRate).toBe(0.05);
    expect(result.whtAmount).toBe(50_000);
    expect(result.netPayment).toBe(950_000);
  });

  it('generates valid credit note reference pattern', () => {
    const ref = generateCreditNoteRef();
    const currentYear = new Date().getFullYear().toString();
    expect(ref).toMatch(new RegExp(`^WHT-CR-${currentYear}-\\d{6}$`));
  });

  it('computes WHT summary aggregates correctly', () => {
    const transactions: WHTTransaction[] = [
      {
        id: 'tx-1',
        date: '2026-01-15',
        payeeType: 'company',
        payeeName: 'Alpha Ltd',
        paymentType: 'Rent',
        grossAmount: 5_000_000,
        whtRate: 0.10,
        whtAmount: 500_000,
        netPayment: 4_500_000,
        status: 'remitted',
      },
      {
        id: 'tx-2',
        date: '2026-02-10',
        payeeType: 'individual',
        payeeName: 'John Consultant',
        paymentType: 'Professional / Consultancy Fees',
        grossAmount: 2_000_000,
        whtRate: 0.05,
        whtAmount: 100_000,
        netPayment: 1_900_000,
        status: 'pending',
      },
    ];

    const summary = computeWHTSummary(transactions);
    expect(summary.totalGrossPayments).toBe(7_000_000);
    expect(summary.totalWHTDeducted).toBe(600_000);
    expect(summary.totalNetPayments).toBe(6_400_000);
    expect(summary.pendingRemittance).toBe(100_000);
    expect(summary.remittedTotal).toBe(500_000);
    expect(summary.byPaymentType).toHaveLength(2);
  });
});

// ─── Capital Allowances Engine Tests ─────────────────────────────────────────

describe('Capital Allowances Engine', () => {
  it('provides at least 10 asset classes with statutory rates', () => {
    expect(ASSET_CLASSES.length).toBeGreaterThanOrEqual(10);
    const plant = ASSET_CLASSES.find(c => c.id === 'plant-machinery');
    expect(plant).toBeDefined();
    expect(plant?.initialAllowanceRate).toBe(0.50);
    expect(plant?.annualAllowanceRate).toBe(0.25);
  });

  it('calculates first year initial and annual allowances on new asset', () => {
    // ₦10,000,000 Plant & Machinery (50% IA, 25% AA)
    // IA = 10M * 50% = 5M
    // Balance after IA = 5M
    // AA = 5M * 25% = 1.25M
    // Total First Year Allowance = 6.25M
    // Written down value = 10M - 6.25M = 3.75M
    const allowance = calculateAssetAllowance(10_000_000, 'plant-machinery');

    expect(allowance).not.toBeNull();
    expect(allowance?.initialAllowance).toBe(5_000_000);
    expect(allowance?.annualAllowance).toBe(1_250_000);
    expect(allowance?.firstYearTotal).toBe(6_250_000);
    expect(allowance?.taxWrittenDownValue).toBe(3_750_000);
  });

  it('calculates total allowances across multiple assets via calculatePortfolioAllowances', () => {
    const assets = [
      {
        id: 'ast-1',
        assetClassId: 'plant-machinery',
        description: 'Generator',
        acquisitionCost: 4_000_000,
        yearAcquired: 2026,
      },
      {
        id: 'ast-2',
        assetClassId: 'motor-vehicles',
        description: 'Delivery Van',
        acquisitionCost: 6_000_000,
        yearAcquired: 2026,
      },
    ];

    const totals = calculatePortfolioAllowances(assets);
    expect(totals.totalAcquisitionCost).toBe(10_000_000);
    expect(totals.totalFirstYearAllowance).toBeGreaterThan(0);
    expect(totals.totalTaxWrittenDownValue).toBe(totals.totalAcquisitionCost - totals.totalFirstYearAllowance);
    expect(totals.entries).toHaveLength(2);
  });
});

// ─── Stamp Duty & CGT Tests ──────────────────────────────────────────────────

describe('Stamp Duty Engine', () => {
  it('covers statutory instrument categories', () => {
    expect(STAMP_DUTY_CATEGORIES.length).toBeGreaterThanOrEqual(8);
  });

  it('applies flat ₦50 on electronic transfers / bank deposits of ₦10,000 or above', () => {
    const result = calculateStampDuty('bank-deposit', 50_000);
    expect(result.dutyAmount).toBe(50);
    expect(result.isAboveThreshold).toBe(true);
  });

  it('exempts bank deposits below ₦10,000 threshold', () => {
    const result = calculateStampDuty('bank-deposit', 5_000);
    expect(result.dutyAmount).toBe(0);
    expect(result.isAboveThreshold).toBe(false);
  });

  it('applies ad valorem rates for commercial contracts (0.75%)', () => {
    // Category: contract-agreement (0.75%)
    const result = calculateStampDuty('contract-agreement', 20_000_000);
    expect(result.dutyAmount).toBe(150_000); // 20M * 0.75% = 150,000
    expect(result.isAboveThreshold).toBe(true);
  });

  it('applies ad valorem rates for share transfers (0.375%)', () => {
    // Category: share-transfer (0.375%)
    const result = calculateStampDuty('share-transfer', 10_000_000);
    expect(result.dutyAmount).toBe(37_500); // 10M * 0.375% = 37,500
    expect(result.isAboveThreshold).toBe(true);
  });
});

describe('Capital Gains Tax (CGT) Engine', () => {
  it('calculates standard 10% CGT on net gain', () => {
    // Disposal proceeds: 50M
    // Acquisition cost: 30M
    // Allowable expenses: 2M (improvements) + 1M (legal) + 1M (commission) = 4M
    // Chargeable gain = 50M - 30M - 4M = 16M
    // CGT @ 10% = 1.6M
    // Net proceeds = 50M - 1.6M = 48.4M
    const result = calculateCGT({
      assetDescription: 'Commercial Plot in Lekki',
      disposalProceeds: 50_000_000,
      acquisitionCost: 30_000_000,
      improvementCosts: 2_000_000,
      legalFees: 1_000_000,
      agentCommission: 1_000_000,
      isNSEListed: false,
      isFamilyGift: false,
    });

    expect(result.isExempt).toBe(false);
    expect(result.allowableExpenses).toBe(4_000_000);
    expect(result.chargeableGain).toBe(16_000_000);
    expect(result.cgtLiability).toBe(1_600_000);
    expect(result.netProceeds).toBe(48_400_000);
  });

  it('exempts shares listed on Nigerian Stock Exchange (Finance Act 2021)', () => {
    const result = calculateCGT({
      assetDescription: 'MTN Nigeria Shares on NGX',
      disposalProceeds: 20_000_000,
      acquisitionCost: 12_000_000,
      improvementCosts: 0,
      legalFees: 50_000,
      agentCommission: 100_000,
      isNSEListed: true,
      isFamilyGift: false,
    });

    expect(result.isExempt).toBe(true);
    expect(result.chargeableGain).toBe(0);
    expect(result.cgtLiability).toBe(0);
    expect(result.netProceeds).toBe(20_000_000);
  });

  it('exempts family gifts from CGT', () => {
    const result = calculateCGT({
      assetDescription: 'Inherited Family House in Ibadan',
      disposalProceeds: 15_000_000,
      acquisitionCost: 8_000_000,
      improvementCosts: 500_000,
      legalFees: 100_000,
      agentCommission: 0,
      isNSEListed: false,
      isFamilyGift: true,
    });

    expect(result.isExempt).toBe(true);
    expect(result.cgtLiability).toBe(0);
  });

  it('handles capital loss gracefully with 0 chargeable gain', () => {
    const result = calculateCGT({
      assetDescription: 'Depreciated Machinery',
      disposalProceeds: 5_000_000,
      acquisitionCost: 8_000_000,
      improvementCosts: 0,
      legalFees: 0,
      agentCommission: 0,
      isNSEListed: false,
      isFamilyGift: false,
    });

    expect(result.chargeableGain).toBe(0);
    expect(result.cgtLiability).toBe(0);
    expect(result.netProceeds).toBe(5_000_000);
  });
});

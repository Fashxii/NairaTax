import { describe, it, expect } from 'vitest';
import {
  corpStep1Schema, corpStep2Schema, corpStep3Schema, corpStep4Schema,
  corporateTaxRegistrationSchema, buildCorporatePayload, maskCorporatePayload, CORP_DEFAULT_VALUES, type CorporateValues,
} from './schema';
import { classifyCIT, isVatMandatory, COMMERCIAL_BANKS, VAT_MANDATORY_THRESHOLD } from './catalog';
import { maskCacNumber, mockVerifyCAC } from './services';

const valid: CorporateValues = {
  entity: { entityType: 'LTD', rcNumber: 'RC-1849201', cacVerified: true, companyName: 'Acme Technologies Nigeria Ltd', hasTin: true, tin: '249102940001', incorporationDate: '2023-04-15', street: '5 Admiralty Way', city: 'Ikeja', state: 'Lagos', lga: 'Ikeja' },
  signatory: { designation: 'Director', fullName: 'Adebayo Okonjo', nin: '12345678901', ninVerified: true, email: 'Tax@AcmeTech.ng', phone: '8012345678', ndpaConsent: true },
  tax: { annualTurnover: 45_000_000, fixedAssets: 15_000_000, sector: 'Information Technology & Software', yearEnd: 'December 31st', customYearEnd: '' },
  vat: { voluntaryVat: false, supplies: ['standard'], vatNumber: '' },
  bank: { bankCode: '058', accountNumber: '0123456789', accountName: 'ACME TECHNOLOGIES NIGERIA LTD' },
};

const paths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('CIT classification', () => {
  it('small company: turnover ≤ ₦100M and assets ≤ ₦250M → 0%', () => {
    expect(classifyCIT('LTD', 100_000_000, 250_000_000, 'Manufacturing')).toMatchObject({ status: 'SMALL_COMPANY_EXEMPT', rate: 0 });
  });
  it('standard when turnover or assets exceed thresholds', () => {
    expect(classifyCIT('LTD', 100_000_001, 0, 'Manufacturing').status).toBe('STANDARD_CORPORATE');
    expect(classifyCIT('PLC', 50_000_000, 250_000_001, 'Manufacturing').status).toBe('STANDARD_CORPORATE');
  });
  it('professional services never qualify as small', () => {
    expect(classifyCIT('LTD', 10_000_000, 0, 'Professional Services')).toMatchObject({ status: 'STANDARD_CORPORATE', rate: 0.3 });
  });
  it('business names fall under PIT', () => {
    expect(classifyCIT('BN', 10_000_000, 0, 'Retail & Wholesale')).toMatchObject({ status: 'PIT_SOLE_ENTERPRISE', rate: null });
  });
});

describe('VAT threshold', () => {
  it('is mandatory at or above the configured threshold', () => {
    expect(isVatMandatory(VAT_MANDATORY_THRESHOLD)).toBe(true);
    expect(isVatMandatory(VAT_MANDATORY_THRESHOLD - 1)).toBe(false);
  });
});

describe('corporate schemas', () => {
  it('accepts a complete registration', () => {
    expect(corporateTaxRegistrationSchema.safeParse(valid).success).toBe(true);
  });
  it('step1: entity type, prefix-matched CAC number, verification, TIN, future date', () => {
    expect(paths(corpStep1Schema.safeParse({ ...valid.entity, entityType: '' }))).toContain('entityType');
    expect(paths(corpStep1Schema.safeParse({ ...valid.entity, entityType: 'BN' }))).toContain('rcNumber');
    expect(paths(corpStep1Schema.safeParse({ ...valid.entity, cacVerified: false }))).toContain('cacVerified');
    expect(paths(corpStep1Schema.safeParse({ ...valid.entity, tin: '123' }))).toContain('tin');
    expect(paths(corpStep1Schema.safeParse({ ...valid.entity, incorporationDate: '2999-01-01' }))).toContain('incorporationDate');
  });
  it('step2: designation, NIN verification and consent', () => {
    const r = corpStep2Schema.safeParse({ ...valid.signatory, designation: '', ninVerified: false, ndpaConsent: false });
    expect(paths(r)).toEqual(expect.arrayContaining(['designation', 'ninVerified', 'ndpaConsent']));
  });
  it('step3: turnover, sector and custom year-end', () => {
    const r = corpStep3Schema.safeParse({ ...CORP_DEFAULT_VALUES.tax, yearEnd: 'Custom' });
    expect(paths(r)).toEqual(expect.arrayContaining(['annualTurnover', 'sector', 'customYearEnd']));
  });
  it('step4: requires at least one supply type', () => {
    expect(paths(corpStep4Schema.safeParse(CORP_DEFAULT_VALUES.vat))).toContain('supplies');
  });
});

describe('corporate payload', () => {
  it('matches the API contract', () => {
    const p = buildCorporatePayload(valid);
    expect(p.entity).toMatchObject({ entityType: 'LTD', rcNumber: 'RC-1849201', corporateTin: '24910294-0001', incorporationDate: '2023-04-15', registeredAddress: { city: 'Ikeja', lga: 'Ikeja', state: 'Lagos' } });
    expect(p.signatory).toMatchObject({ designation: 'Director', email: 'tax@acmetech.ng', phone: '+2348012345678', ndpaConsent: true });
    expect(p.taxProfile).toMatchObject({ annualTurnover: 45_000_000, accountingYearEnd: 'December 31st', citStatus: 'SMALL_COMPANY_EXEMPT', citRate: 0 });
    expect(p.vatProfile).toMatchObject({ isVatRegistered: true, vatNumber: null, voluntaryRegistration: false, suppliesExemptItems: false });
    expect(p.banking).toEqual(valid.bank);
  });
  it('flags voluntary VAT only below the threshold', () => {
    const below = { ...valid, tax: { ...valid.tax, annualTurnover: 10_000_000 }, vat: { ...valid.vat, voluntaryVat: true } };
    expect(buildCorporatePayload(below).vatProfile).toMatchObject({ isVatRegistered: true, voluntaryRegistration: true });
    const none = { ...below, vat: { ...below.vat, voluntaryVat: false } };
    expect(buildCorporatePayload(none).vatProfile.isVatRegistered).toBe(false);
  });
  it('masks NIN and NUBAN for storage', () => {
    const m = maskCorporatePayload(buildCorporatePayload(valid));
    expect(m.signatory.nin).toBe('*******8901');
    expect(m.banking.accountNumber).toBe('******6789');
  });
});

describe('helpers', () => {
  it('masks CAC numbers with the entity prefix', () => {
    expect(maskCacNumber('rc1849201', 'LTD')).toBe('RC-1849201');
    expect(maskCacNumber('BN-12345', 'BN')).toBe('BN-12345');
    expect(maskCacNumber('9988', 'LLP')).toBe('LP-9988');
    expect(maskCacNumber('', 'LTD')).toBe('');
  });
  it('excludes MFB / fintech wallets from corporate banks', () => {
    expect(COMMERCIAL_BANKS.some((b) => b.name === 'OPay')).toBe(false);
    expect(COMMERCIAL_BANKS.some((b) => b.code === '058')).toBe(true);
  });
  it('mock CAC lookup is deterministic and enforces prefix', async () => {
    const a = await mockVerifyCAC('RC-1849201', 'LTD');
    expect(a).toEqual(await mockVerifyCAC('RC-1849201', 'LTD'));
    expect(a.ok && a.companyName.endsWith('Nigeria Ltd')).toBe(true);
    expect((await mockVerifyCAC('RC-1849201', 'BN')).ok).toBe(false);
  });
});

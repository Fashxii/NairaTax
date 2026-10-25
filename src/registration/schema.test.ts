import { describe, it, expect } from 'vitest';
import {
  step1Schema, step2Schema, step3Schema, step4Schema, step5Schema,
  individualRegistrationSchema, buildPayload, maskPayload, DEFAULT_VALUES, RegistrationValues,
} from './schema';
import { LGAS, STATES, SIRS } from './states';
import { normalizePhone, formatNaira, parseNaira, mockVerifyNIN } from './services';
import { estimateRentRelief } from './catalog';

const valid: RegistrationValues = {
  auth: { firstName: 'Adebayo', lastName: 'Ogunlade', email: 'Ade@Example.ng', phone: '8031234567', ndpaConsent: true },
  identity: { nin: '12345678901', ninVerified: true, legalName: 'OGUNLADE Adebayo', dateOfBirth: '1990-01-01', hasTin: false, tin: '', state: 'Lagos', lga: 'Ikeja', street: '12 Allen Avenue', city: 'Ikeja', landmark: '' },
  income: { categories: ['paye'], employerName: 'Apex Ltd', hasH1Card: true, estimatedAnnualGross: 0, industry: '', hasWhtCreditNotes: '' },
  reliefs: { pensionEnabled: true, pfaName: 'Premium Pension', rsaPin: 'PEN123456789012', nhfEnabled: true, nhiaEnabled: false, lifeAssuranceEnabled: false, lifeAssurancePremium: 0, housingStatus: 'tenant', annualRentPaid: 1_800_000, mortgageInterest: 0 },
  bank: { bankCode: '058', accountNumber: '0123456789', accountName: 'OGUNLADE ADEBAYO' },
};

const issuePaths = (r: { success: boolean; error?: { issues: { path: PropertyKey[] }[] } }) =>
  r.success ? [] : r.error!.issues.map((i) => i.path.join('.'));

describe('reference data', () => {
  it('has 36 states + FCT and 774 LGAs, each with a SIRS', () => {
    expect(STATES).toHaveLength(37);
    expect(Object.values(LGAS).flat()).toHaveLength(774);
    STATES.forEach((s) => { expect(LGAS[s]?.length).toBeGreaterThan(0); expect(SIRS[s]).toBeDefined(); });
    expect(SIRS.Lagos.code).toBe('LIRS');
    expect(SIRS.FCT.code).toBe('FCT-IRS');
    expect(SIRS.Ogun.code).toBe('OGIRS');
  });
});

describe('step schemas', () => {
  it('accepts a complete valid registration', () => {
    expect(individualRegistrationSchema.safeParse(valid).success).toBe(true);
  });

  it('step1: requires NDPA consent and a valid phone', () => {
    const r = step1Schema.safeParse({ ...valid.auth, ndpaConsent: false, phone: '1234567890' });
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['ndpaConsent', 'phone']));
  });

  it('step2: requires NIN verification, valid TIN when toggled, and an LGA within the state', () => {
    const r = step2Schema.safeParse({ ...valid.identity, ninVerified: false, hasTin: true, tin: '123', lga: 'Kano Municipal' });
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['ninVerified', 'tin', 'lga']));
  });

  it('step3: enforces conditional disclosures', () => {
    const r = step3Schema.safeParse({ ...DEFAULT_VALUES.income, categories: ['paye', 'direct', 'passive'] });
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['employerName', 'estimatedAnnualGross', 'industry', 'hasWhtCreditNotes']));
    const u = step3Schema.safeParse({ ...DEFAULT_VALUES.income, categories: ['unemployed', 'paye'], employerName: 'X Co' });
    expect(issuePaths(u)).toContain('categories');
  });

  it('step4: validates RSA PIN, premium, housing and rent', () => {
    const r = step4Schema.safeParse({ ...DEFAULT_VALUES.reliefs, pensionEnabled: true, rsaPin: 'PEN12', lifeAssuranceEnabled: true, housingStatus: 'tenant' });
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['pfaName', 'rsaPin', 'lifeAssurancePremium', 'annualRentPaid']));
    expect(issuePaths(step4Schema.safeParse(DEFAULT_VALUES.reliefs))).toContain('housingStatus');
  });

  it('step5: requires a 10-digit NUBAN and a resolved account name', () => {
    const r = step5Schema.safeParse({ bankCode: '058', accountNumber: '12345', accountName: '' });
    expect(issuePaths(r)).toEqual(expect.arrayContaining(['accountNumber', 'accountName']));
  });
});

describe('payload', () => {
  it('matches the API contract', () => {
    const p = buildPayload(valid);
    expect(p.auth).toMatchObject({ email: 'ade@example.ng', phone: '+2348031234567', ndpaConsent: true });
    expect(p.auth).not.toHaveProperty('password');
    expect(p.identity).toMatchObject({ nin: '12345678901', tin: null, stateOfResidence: 'Lagos', lga: 'Ikeja', sirsCode: 'LIRS', address: '12 Allen Avenue, Ikeja' });
    expect(p.incomeProfile).toMatchObject({ categories: ['paye'], isPaye: true, employerName: 'Apex Ltd', estimatedAnnualGross: 0 });
    expect(p.reliefs).toMatchObject({ pensionEnabled: true, pfaName: 'Premium Pension', nhfEnabled: true, annualRentPaid: 1_800_000 });
    expect(p.settlementBank).toEqual({ bankCode: '058', accountNumber: '0123456789', accountName: 'OGUNLADE ADEBAYO' });
  });

  it('masks sensitive identifiers for storage', () => {
    const m = maskPayload(buildPayload(valid));
    expect(m.identity.nin).toBe('*******8901');
    expect(m.settlementBank.accountNumber).toBe('******6789');
    expect(m.reliefs.rsaPin).toBe('***********9012');
  });
});

describe('helpers', () => {
  it('normalizes phone inputs to 10 digits after +234', () => {
    expect(normalizePhone('08031234567')).toBe('8031234567');
    expect(normalizePhone('+234 803 123 4567')).toBe('8031234567');
    expect(normalizePhone('2348031234567')).toBe('8031234567');
  });

  it('formats and parses Naira', () => {
    expect(formatNaira(1200000)).toBe('₦1,200,000');
    expect(parseNaira('₦1,200,000')).toBe(1200000);
    expect(formatNaira(0)).toBe('');
  });

  it('computes NTA 2025 rent relief (20%, capped at ₦500k)', () => {
    expect(estimateRentRelief(1_000_000)).toBe(200_000);
    expect(estimateRentRelief(5_000_000)).toBe(500_000);
  });

  it('mock NIN lookup is deterministic and rejects repeated digits', async () => {
    const a = await mockVerifyNIN('12345678901', 'Ada', 'Obi');
    const b = await mockVerifyNIN('12345678901', 'Ada', 'Obi');
    expect(a).toEqual(b);
    expect(a.legalName).toBe('OBI Ada');
    expect((await mockVerifyNIN('11111111111', 'Ada', 'Obi')).ok).toBe(false);
  });
});

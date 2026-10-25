/**
 * schema.ts — Zod schemas for the 5-step individual registration wizard,
 * plus helpers that map form values to the API payload contract.
 */
import { z } from 'zod';
import { INCOME_CATEGORY_IDS } from './catalog';
import { LGAS, SIRS } from './states';

const nameField = (label: string) =>
  z.string().trim()
    .min(2, `Enter your ${label}`)
    .max(50, `${label[0].toUpperCase()}${label.slice(1)} is too long`)
    .regex(/^[\p{L}' .-]+$/u, 'Use letters only');

const money = z.number({ error: 'Enter an amount' }).min(0, 'Amount cannot be negative');

// ─── Step 1: Core credentials ─────────────────────────────────────────
export const step1Schema = z.object({
  firstName: nameField('first name'),
  lastName: nameField('last name'),
  email: z.string().trim().email('Enter a valid email address'),
  /** 10 digits after +234, e.g. 8031234567 */
  phone: z.string().regex(/^[789][01]\d{8}$/, 'Enter a valid Nigerian mobile number (e.g. 803 123 4567)'),
  ndpaConsent: z.boolean().refine((v) => v === true, 'Consent is required to process your data under the NDPA'),
});

// ─── Step 2: Identity & jurisdiction ──────────────────────────────────
export const step2Schema = z.object({
  nin: z.string().regex(/^\d{11}$/, 'NIN must be exactly 11 digits'),
  ninVerified: z.boolean(),
  legalName: z.string(),
  dateOfBirth: z.string(),
  hasTin: z.boolean(),
  tin: z.string(),
  state: z.string().min(1, 'Select your state of residence'),
  lga: z.string().min(1, 'Select your Local Government Area'),
  street: z.string().trim().min(3, 'Enter your street address'),
  city: z.string().trim().min(2, 'Enter your city / town'),
  landmark: z.string().trim().max(100, 'Keep the landmark under 100 characters'),
}).superRefine((v, ctx) => {
  if (!v.ninVerified) ctx.addIssue({ code: 'custom', path: ['ninVerified'], message: 'Verify your NIN to continue' });
  if (v.hasTin && !/^\d{10,12}$/.test(v.tin)) ctx.addIssue({ code: 'custom', path: ['tin'], message: 'TIN must be 10–12 digits' });
  if (v.state && v.lga && !LGAS[v.state]?.includes(v.lga)) ctx.addIssue({ code: 'custom', path: ['lga'], message: 'Select an LGA in your state' });
});

// ─── Step 3: Income classification ────────────────────────────────────
export const step3Schema = z.object({
  categories: z.array(z.enum(INCOME_CATEGORY_IDS)).min(1, 'Select at least one income profile'),
  employerName: z.string().trim(),
  hasH1Card: z.boolean(),
  estimatedAnnualGross: money,
  industry: z.string(),
  hasWhtCreditNotes: z.enum(['yes', 'no', '']),
}).superRefine((v, ctx) => {
  const has = (c: string) => v.categories.includes(c as never);
  if (has('unemployed') && v.categories.length > 1)
    ctx.addIssue({ code: 'custom', path: ['categories'], message: '"Unemployed / Student" cannot be combined with other profiles' });
  if (has('paye') && v.employerName.length < 2)
    ctx.addIssue({ code: 'custom', path: ['employerName'], message: 'Enter your employer’s name' });
  if (has('direct')) {
    if (!(v.estimatedAnnualGross > 0)) ctx.addIssue({ code: 'custom', path: ['estimatedAnnualGross'], message: 'Enter your estimated annual turnover' });
    if (!v.industry) ctx.addIssue({ code: 'custom', path: ['industry'], message: 'Select your primary trade / industry' });
  }
  if (has('passive') && !v.hasWhtCreditNotes)
    ctx.addIssue({ code: 'custom', path: ['hasWhtCreditNotes'], message: 'Tell us whether you hold WHT credit notes' });
});

// ─── Step 4: Statutory reliefs ────────────────────────────────────────
export const step4Schema = z.object({
  pensionEnabled: z.boolean(),
  pfaName: z.string(),
  rsaPin: z.string(),
  nhfEnabled: z.boolean(),
  nhiaEnabled: z.boolean(),
  lifeAssuranceEnabled: z.boolean(),
  lifeAssurancePremium: money,
  housingStatus: z.enum(['tenant', 'owner', 'other', '']),
  annualRentPaid: money,
  mortgageInterest: money,
}).superRefine((v, ctx) => {
  if (v.pensionEnabled) {
    if (!v.pfaName) ctx.addIssue({ code: 'custom', path: ['pfaName'], message: 'Select your PFA' });
    if (!/^PEN\d{12}$/i.test(v.rsaPin)) ctx.addIssue({ code: 'custom', path: ['rsaPin'], message: 'RSA PIN format: PEN followed by 12 digits' });
  }
  if (v.lifeAssuranceEnabled && !(v.lifeAssurancePremium > 0))
    ctx.addIssue({ code: 'custom', path: ['lifeAssurancePremium'], message: 'Enter the annual premium paid' });
  if (!v.housingStatus) ctx.addIssue({ code: 'custom', path: ['housingStatus'], message: 'Select your housing status' });
  if (v.housingStatus === 'tenant' && !(v.annualRentPaid > 0))
    ctx.addIssue({ code: 'custom', path: ['annualRentPaid'], message: 'Enter the annual rent you paid' });
});

// ─── Step 5: Payout setup ─────────────────────────────────────────────
export const step5Schema = z.object({
  bankCode: z.string().min(1, 'Select your bank'),
  accountNumber: z.string().regex(/^\d{10}$/, 'NUBAN must be exactly 10 digits'),
  accountName: z.string().trim().min(2, 'Account name has not been resolved yet'),
});

// ─── Unified schema ───────────────────────────────────────────────────
export const individualRegistrationSchema = z.object({
  auth: step1Schema,
  identity: step2Schema,
  income: step3Schema,
  reliefs: step4Schema,
  bank: step5Schema,
});

export type RegistrationValues = z.infer<typeof individualRegistrationSchema>;
export type StepKey = keyof RegistrationValues;

export const STEP_KEYS: StepKey[] = ['auth', 'identity', 'income', 'reliefs', 'bank'];

/** Per-step wrapper schemas (validate only the active section of the form). */
export const STEP_SCHEMAS = [
  z.object({ auth: step1Schema }),
  z.object({ identity: step2Schema }),
  z.object({ income: step3Schema }),
  z.object({ reliefs: step4Schema }),
  z.object({ bank: step5Schema }),
] as const;

export const DEFAULT_VALUES: RegistrationValues = {
  auth: { firstName: '', lastName: '', email: '', phone: '', ndpaConsent: false },
  identity: { nin: '', ninVerified: false, legalName: '', dateOfBirth: '', hasTin: false, tin: '', state: '', lga: '', street: '', city: '', landmark: '' },
  income: { categories: [], employerName: '', hasH1Card: false, estimatedAnnualGross: 0, industry: '', hasWhtCreditNotes: '' },
  reliefs: { pensionEnabled: false, pfaName: '', rsaPin: '', nhfEnabled: false, nhiaEnabled: false, lifeAssuranceEnabled: false, lifeAssurancePremium: 0, housingStatus: '', annualRentPaid: 0, mortgageInterest: 0 },
  bank: { bankCode: '', accountNumber: '', accountName: '' },
};

// ─── Payload contract ─────────────────────────────────────────────────
export function buildPayload(v: RegistrationValues) {
  const id = v.identity;
  const inc = v.income;
  const r = v.reliefs;
  return {
    auth: {
      email: v.auth.email.trim().toLowerCase(),
      phone: `+234${v.auth.phone}`,
      // Passwordless: email OTP is the credential, so no password is emitted.
      ndpaConsent: v.auth.ndpaConsent,
      firstName: v.auth.firstName.trim(),
      lastName: v.auth.lastName.trim(),
    },
    identity: {
      nin: id.nin,
      tin: id.hasTin ? id.tin : null,
      stateOfResidence: id.state,
      lga: id.lga,
      address: [id.street.trim(), id.city.trim(), id.landmark.trim() && `near ${id.landmark.trim()}`].filter(Boolean).join(', '),
      sirsCode: SIRS[id.state]?.code ?? '',
      legalName: id.legalName,
      dateOfBirth: id.dateOfBirth,
      ninVerified: id.ninVerified,
    },
    incomeProfile: {
      categories: inc.categories,
      isPaye: inc.categories.includes('paye'),
      employerName: inc.categories.includes('paye') ? inc.employerName.trim() : '',
      estimatedAnnualGross: inc.categories.includes('direct') ? inc.estimatedAnnualGross : 0,
      industry: inc.categories.includes('direct') ? inc.industry : '',
      hasH1Card: inc.categories.includes('paye') && inc.hasH1Card,
      hasWhtCreditNotes: inc.categories.includes('passive') ? inc.hasWhtCreditNotes === 'yes' : null,
    },
    reliefs: {
      pensionEnabled: r.pensionEnabled,
      pfaName: r.pensionEnabled ? r.pfaName : '',
      rsaPin: r.pensionEnabled ? r.rsaPin.toUpperCase() : '',
      nhfEnabled: r.nhfEnabled,
      nhiaEnabled: r.nhiaEnabled,
      lifeAssurancePremium: r.lifeAssuranceEnabled ? r.lifeAssurancePremium : 0,
      housingStatus: r.housingStatus,
      annualRentPaid: r.housingStatus === 'tenant' ? r.annualRentPaid : 0,
      mortgageInterest: r.housingStatus === 'owner' ? r.mortgageInterest : 0,
    },
    settlementBank: {
      bankCode: v.bank.bankCode,
      accountNumber: v.bank.accountNumber,
      accountName: v.bank.accountName,
    },
  };
}

export type RegistrationPayload = ReturnType<typeof buildPayload>;

const maskTail = (value: string | null, keep = 4) =>
  value ? `${'*'.repeat(Math.max(value.length - keep, 0))}${value.slice(-keep)}` : value;

/** Masked copy for persistence (NIN / TIN / NUBAN / RSA PIN). */
export function maskPayload(p: RegistrationPayload): RegistrationPayload {
  return {
    ...p,
    identity: { ...p.identity, nin: maskTail(p.identity.nin)!, tin: maskTail(p.identity.tin) },
    reliefs: { ...p.reliefs, rsaPin: p.reliefs.rsaPin ? maskTail(p.reliefs.rsaPin)! : '' },
    settlementBank: { ...p.settlementBank, accountNumber: maskTail(p.settlementBank.accountNumber)! },
  };
}

/**
 * corporate/schema.ts — Zod schemas for the 5-step corporate (CIT / VAT)
 * onboarding wizard, plus the payload contract builder.
 */
import { z } from 'zod';
import { LGAS, SIRS } from '../states';
import {
  DESIGNATIONS, ENTITY_TYPE_IDS, SECTORS, YEAR_ENDS, CUSTOM_YEAR_ENDS,
  classifyCIT, isVatMandatory, nrsTaxOffice, prefixFor,
} from './catalog';

const money = z.number({ error: 'Enter an amount' }).min(0, 'Amount cannot be negative');
const todayISO = () => new Date().toISOString().slice(0, 10);

// ─── Step 1: Entity & incorporation ──────────────────────────────────
export const corpStep1Schema = z.object({
  entityType: z.enum([...ENTITY_TYPE_IDS, '']),
  rcNumber: z.string(),
  cacVerified: z.boolean(),
  companyName: z.string(),
  hasTin: z.boolean(),
  tin: z.string(),
  incorporationDate: z.string(),
  street: z.string().trim().min(3, 'Enter the street address'),
  city: z.string().trim().min(2, 'Enter the city / town'),
  state: z.string().min(1, 'Select the state'),
  lga: z.string().min(1, 'Select the LGA'),
}).superRefine((v, ctx) => {
  const add = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message });
  if (!v.entityType) add('entityType', 'Select the entity type');
  const prefix = prefixFor(v.entityType);
  if (!new RegExp(`^${prefix}-\\d{4,8}$`).test(v.rcNumber)) add('rcNumber', `Enter a valid CAC number (${prefix}- followed by 4–8 digits)`);
  else if (!v.cacVerified) add('cacVerified', 'Verify the CAC number to continue');
  if (v.hasTin && !/^\d{10,12}$/.test(v.tin)) add('tin', 'Corporate TIN must be 10–12 digits');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v.incorporationDate)) add('incorporationDate', 'Select the date of incorporation');
  else if (v.incorporationDate > todayISO()) add('incorporationDate', 'Date cannot be in the future');
  else if (v.incorporationDate < '1900-01-01') add('incorporationDate', 'Enter a valid date');
  if (v.state && v.lga && !LGAS[v.state]?.includes(v.lga)) add('lga', 'Select an LGA in this state');
});

// ─── Step 2: Signatory & KYC ─────────────────────────────────────────
export const corpStep2Schema = z.object({
  designation: z.enum([...DESIGNATIONS, '']),
  fullName: z.string().trim().min(3, 'Enter the officer’s full legal name').max(100).regex(/^[\p{L}' .-]+$/u, 'Use letters only'),
  nin: z.string().regex(/^\d{11}$/, 'NIN must be exactly 11 digits'),
  ninVerified: z.boolean(),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().regex(/^[789][01]\d{8}$/, 'Enter a valid Nigerian mobile number (e.g. 803 123 4567)'),
  ndpaConsent: z.boolean().refine((v) => v === true, 'Authorisation is required to file on behalf of the entity'),
}).superRefine((v, ctx) => {
  if (!v.designation) ctx.addIssue({ code: 'custom', path: ['designation'], message: 'Select the signatory’s designation' });
  if (!v.ninVerified) ctx.addIssue({ code: 'custom', path: ['ninVerified'], message: 'Verify the signatory’s NIN to continue' });
});

// ─── Step 3: CIT classification ──────────────────────────────────────
export const corpStep3Schema = z.object({
  annualTurnover: money,
  fixedAssets: money,
  sector: z.enum([...SECTORS, '']),
  yearEnd: z.enum([...YEAR_ENDS, '']),
  customYearEnd: z.string(),
}).superRefine((v, ctx) => {
  if (!(v.annualTurnover > 0)) ctx.addIssue({ code: 'custom', path: ['annualTurnover'], message: 'Enter the annual gross turnover' });
  if (!v.sector) ctx.addIssue({ code: 'custom', path: ['sector'], message: 'Select the primary sector' });
  if (!v.yearEnd) ctx.addIssue({ code: 'custom', path: ['yearEnd'], message: 'Select the financial year-end' });
  if (v.yearEnd === 'Custom' && !CUSTOM_YEAR_ENDS.includes(v.customYearEnd))
    ctx.addIssue({ code: 'custom', path: ['customYearEnd'], message: 'Select the custom year-end month' });
});

// ─── Step 4: VAT profile ─────────────────────────────────────────────
export const corpStep4Schema = z.object({
  voluntaryVat: z.boolean(),
  supplies: z.array(z.enum(['exempt', 'standard'])).min(1, 'Select the nature of your supplies'),
  vatNumber: z.string().trim().max(20, 'VAT number is too long'),
});

// ─── Step 5: Settlement ──────────────────────────────────────────────
export const corpStep5Schema = z.object({
  bankCode: z.string().min(1, 'Select the corporate bank'),
  accountNumber: z.string().regex(/^\d{10}$/, 'NUBAN must be exactly 10 digits'),
  accountName: z.string().trim().min(2, 'Account name has not been resolved yet'),
});

export const corporateTaxRegistrationSchema = z.object({
  entity: corpStep1Schema,
  signatory: corpStep2Schema,
  tax: corpStep3Schema,
  vat: corpStep4Schema,
  bank: corpStep5Schema,
});

export type CorporateValues = z.infer<typeof corporateTaxRegistrationSchema>;
export type CorpStepKey = keyof CorporateValues;
export const CORP_STEP_KEYS: CorpStepKey[] = ['entity', 'signatory', 'tax', 'vat', 'bank'];
export const CORP_STEP_SCHEMAS = [
  z.object({ entity: corpStep1Schema }),
  z.object({ signatory: corpStep2Schema }),
  z.object({ tax: corpStep3Schema }),
  z.object({ vat: corpStep4Schema }),
  z.object({ bank: corpStep5Schema }),
] as const;

export const CORP_DEFAULT_VALUES: CorporateValues = {
  entity: { entityType: '', rcNumber: '', cacVerified: false, companyName: '', hasTin: false, tin: '', incorporationDate: '', street: '', city: '', state: '', lga: '' },
  signatory: { designation: '', fullName: '', nin: '', ninVerified: false, email: '', phone: '', ndpaConsent: false },
  tax: { annualTurnover: 0, fixedAssets: 0, sector: '', yearEnd: '', customYearEnd: '' },
  vat: { voluntaryVat: false, supplies: [], vatNumber: '' },
  bank: { bankCode: '', accountNumber: '', accountName: '' },
};

/** 12-digit JTB TINs are conventionally shown as 8-4 (e.g. 24910294-0001). */
export const formatCorporateTin = (d: string) => (d.length === 12 ? `${d.slice(0, 8)}-${d.slice(8)}` : d);

// ─── Payload contract ────────────────────────────────────────────────
export function buildCorporatePayload(v: CorporateValues) {
  const e = v.entity;
  const t = v.tax;
  const cit = classifyCIT(e.entityType, t.annualTurnover, t.fixedAssets, t.sector);
  const mandatoryVat = isVatMandatory(t.annualTurnover);
  return {
    entity: {
      entityType: e.entityType,
      rcNumber: e.rcNumber,
      companyName: e.companyName,
      corporateTin: e.hasTin ? formatCorporateTin(e.tin) : null,
      incorporationDate: e.incorporationDate,
      registeredAddress: { street: e.street.trim(), city: e.city.trim(), lga: e.lga, state: e.state },
      stateIrsCode: SIRS[e.state]?.code ?? '',
      nrsTaxOffice: nrsTaxOffice(e.state, e.lga),
    },
    signatory: {
      fullName: v.signatory.fullName.trim(),
      designation: v.signatory.designation,
      nin: v.signatory.nin,
      email: v.signatory.email.trim().toLowerCase(),
      phone: `+234${v.signatory.phone}`,
      ndpaConsent: v.signatory.ndpaConsent,
      ninVerified: v.signatory.ninVerified,
    },
    taxProfile: {
      annualTurnover: t.annualTurnover,
      fixedAssets: t.fixedAssets,
      sector: t.sector,
      accountingYearEnd: t.yearEnd === 'Custom' ? t.customYearEnd : t.yearEnd,
      citStatus: cit.status,
      citRate: cit.rate,
    },
    vatProfile: {
      isVatRegistered: mandatoryVat || v.vat.voluntaryVat,
      vatNumber: v.vat.vatNumber.trim() || null,
      voluntaryRegistration: !mandatoryVat && v.vat.voluntaryVat,
      suppliesExemptItems: v.vat.supplies.includes('exempt'),
      suppliesStandardRated: v.vat.supplies.includes('standard'),
      filingFrequency: 'MONTHLY_21ST' as const,
    },
    banking: {
      bankCode: v.bank.bankCode,
      accountNumber: v.bank.accountNumber,
      accountName: v.bank.accountName,
    },
  };
}

export type CorporatePayload = ReturnType<typeof buildCorporatePayload>;

const maskTail = (value: string, keep = 4) => `${'*'.repeat(Math.max(value.length - keep, 0))}${value.slice(-keep)}`;

/** Masked copy for persistence (signatory NIN / NUBAN). */
export function maskCorporatePayload(p: CorporatePayload): CorporatePayload {
  return {
    ...p,
    signatory: { ...p.signatory, nin: maskTail(p.signatory.nin) },
    banking: { ...p.banking, accountNumber: maskTail(p.banking.accountNumber) },
  };
}

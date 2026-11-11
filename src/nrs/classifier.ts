/**
 * nrs/classifier.ts — Rules-based transaction classification (Phase 2).
 *
 * Decision: NO AI. Narrations never leave the app. Classification uses
 *   1. counterparty memory — the user's own past corrections (highest priority)
 *   2. narration pattern rules below
 *   3. a low-confidence default that always lands in the "Needs review" queue
 *
 * Rules give a starting point only; the user confirms every low-confidence
 * result. VAT/WHT treatments here reflect common practice and should be
 * reviewed by the tax adviser along with taxYearConfig.ts.
 */

import type {
  CitCategory,
  ClassificationSource,
  CounterpartyMemory,
  Direction,
  PayeeType,
  VatTreatment,
} from './types';

/** Results below this confidence are flagged for user review. */
export const REVIEW_THRESHOLD = 0.7;

export interface ClassificationResult {
  citCategory: CitCategory;
  vatTreatment: VatTreatment;
  whtCategoryId: string | null;
  payeeType: PayeeType;
  confidence: number;
  source: ClassificationSource;
  ruleId?: string;
  counterpartyTin?: string;
}

export interface ClassificationRule {
  id: string;
  description: string;
  direction: Direction | 'ANY';
  pattern: RegExp;
  citCategory: CitCategory;
  vatTreatment: VatTreatment;
  whtCategoryId?: string | null;
  confidence: number;
}

/**
 * Ordered: the first matching rule wins, so specific rules come before broad ones.
 */
export const CLASSIFICATION_RULES: ClassificationRule[] = [
  // ── Either direction ──
  {
    id: 'transfer-own-account',
    description: 'Transfers between own accounts / savings wallets',
    direction: 'ANY',
    pattern: /\b(own account|self transfer|transfer to self|to savings|from savings|piggyvest|cowrywise|wallet top ?up|sweep)\b/i,
    citCategory: 'TRANSFER',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.8,
  },
  {
    id: 'reversal',
    description: 'Reversals and refunds',
    direction: 'ANY',
    pattern: /\b(reversal|rvsl|refund|chargeback)\b/i,
    citCategory: 'TRANSFER',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.6,
  },
  {
    id: 'loan',
    description: 'Loan disbursements and repayments (principal is not income/expense)',
    direction: 'ANY',
    pattern: /\b(loan disburs\w*|loan repay\w*|facility drawdown)\b/i,
    citCategory: 'TRANSFER',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.75,
  },

  // ── Inflows ──
  {
    id: 'interest-income',
    description: 'Bank interest received',
    direction: 'INFLOW',
    pattern: /\b(interest|int\.? paid|int credit)\b/i,
    citCategory: 'OTHER_INCOME',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.8,
  },
  {
    id: 'merchant-settlement',
    description: 'Card / POS / payment-gateway settlements',
    direction: 'INFLOW',
    pattern: /\b(pos settlement|settlement|paystack|flutterwave|monnify|interswitch|remita|opay merchant|moniepoint)\b/i,
    citCategory: 'SALES_REVENUE',
    vatTreatment: 'STANDARD',
    confidence: 0.85,
  },
  {
    id: 'invoice-payment',
    description: 'Customer paying an invoice',
    direction: 'INFLOW',
    pattern: /\b(inv(oice)?[\s#:/-]*\d+|payment for|being payment)\b/i,
    citCategory: 'SALES_REVENUE',
    vatTreatment: 'STANDARD',
    confidence: 0.8,
  },

  // ── Outflows ──
  {
    id: 'tax-remittance',
    description: 'Tax and levy payments (not deductible)',
    direction: 'OUTFLOW',
    // Explicit agency list — a generic /[a-z]+irs/ would also match words like "stairs".
    pattern: /\b(firs|nrs|lirs|ogirs|oyirs|osirs|odirs|ekirs|kwirs|edirs|rsirs|akirs|abirs|enirs|imirs|anirs|ebirs|crirs|bsirs|kdirs|kgirs|nsirs|fct-?irs|internal revenue|tax remit\w*|vat remit\w*|paye remit\w*|wht remit\w*|emtl|electronic money transfer levy|stamp duty)\b/i,
    citCategory: 'TAX_PAYMENT',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.9,
  },
  {
    id: 'salary',
    description: 'Salaries and wages',
    direction: 'OUTFLOW',
    pattern: /\b(salary|salaries|payroll|wages|staff pay)\b/i,
    citCategory: 'SALARY_PAYE',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.9,
  },
  {
    id: 'statutory-contributions',
    description: 'Pension, NHF, NSITF and similar employer contributions',
    direction: 'OUTFLOW',
    pattern: /\b(pension|pfa|rsa|nhf|nsitf|itf levy)\b/i,
    citCategory: 'SALARY_PAYE',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.8,
  },
  {
    id: 'rent',
    description: 'Rent / lease of land and buildings (outside VAT; WHT applies)',
    direction: 'OUTFLOW',
    pattern: /\b(rent|lease|tenancy)\b/i,
    citCategory: 'RENT_EXPENSE',
    vatTreatment: 'OUT_OF_SCOPE',
    whtCategoryId: 'rent',
    confidence: 0.85,
  },
  {
    id: 'bank-charges',
    description: 'Bank fees and charges',
    direction: 'OUTFLOW',
    pattern: /\b(bank charge|sms alert|sms charge|maintenance fee|account maintenance|cot|commission on turnover|card fee|transfer fee|nip charge)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.85,
  },
  {
    id: 'professional-fees',
    description: 'Professional, consultancy, legal and audit fees',
    direction: 'OUTFLOW',
    pattern: /\b(consult\w*|advisory|audit fee|legal fee|law firm|solicitor|professional fee|accountant)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    whtCategoryId: 'professional-fees',
    confidence: 0.8,
  },
  {
    id: 'commission',
    description: 'Commissions paid to agents',
    direction: 'OUTFLOW',
    pattern: /\b(commission|agent fee)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    whtCategoryId: 'commission',
    confidence: 0.75,
  },
  {
    id: 'construction',
    description: 'Construction and building works',
    direction: 'OUTFLOW',
    pattern: /\b(construction|contractor|building works|renovation)\b/i,
    citCategory: 'CAPEX',
    vatTreatment: 'STANDARD',
    whtCategoryId: 'construction',
    confidence: 0.65,
  },
  {
    id: 'fixed-assets',
    description: 'Purchase of equipment and other fixed assets',
    direction: 'OUTFLOW',
    pattern: /\b(laptop|computer|macbook|furniture|vehicle|car purchase|generator|machinery|equipment|printer|inverter|solar panel)\b/i,
    citCategory: 'CAPEX',
    vatTreatment: 'STANDARD',
    confidence: 0.75,
  },
  {
    id: 'utilities-power',
    description: 'Electricity and water',
    direction: 'OUTFLOW',
    pattern: /\b(ikedc|ekedc|aedc|phed|ibedc|eedc|kedco|bedc|jed|electric\w*|prepaid meter|disco|water board|water corp)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    confidence: 0.85,
  },
  {
    id: 'telecoms-internet',
    description: 'Airtime, data and internet',
    direction: 'OUTFLOW',
    pattern: /\b(mtn|airtel|glo|9mobile|airtime|data bundle|internet|mainone|spectranet|starlink|ipnx|smile)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    confidence: 0.8,
  },
  {
    id: 'air-travel',
    description: 'Commercial airline tickets (VAT-exempt)',
    direction: 'OUTFLOW',
    pattern: /\b(air peace|arik|ibom air|united nigeria|valuejet|overland airways|flight|airline|air ticket)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'EXEMPT',
    confidence: 0.7,
  },
  {
    id: 'ride-hailing',
    description: 'Ride-hailing and local transport',
    direction: 'OUTFLOW',
    pattern: /\b(uber|bolt|indrive|rida|taxi)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    confidence: 0.75,
  },
  {
    id: 'fuel',
    description: 'Fuel and diesel (VAT treatment varies — confirm)',
    direction: 'OUTFLOW',
    pattern: /\b(fuel|diesel|petrol|pms|filling station|nnpc|conoil|ardova|totalenergies|mobil|oando)\b/i,
    citCategory: 'OPERATING_EXPENSE',
    vatTreatment: 'STANDARD',
    confidence: 0.6,
  },
  {
    id: 'non-allowable',
    description: 'Fines, penalties, donations and gifts (generally not deductible)',
    direction: 'OUTFLOW',
    pattern: /\b(fine|penalty|donation|gift|entertainment)\b/i,
    citCategory: 'NON_ALLOWABLE',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.7,
  },
  {
    id: 'cash-withdrawal',
    description: 'Cash withdrawals — purpose unknown, receipt needed',
    direction: 'OUTFLOW',
    pattern: /\b(atm|cash withdrawal|pos withdrawal|cwd)\b/i,
    citCategory: 'UNCLASSIFIED',
    vatTreatment: 'OUT_OF_SCOPE',
    confidence: 0.4,
  },
];

const NARRATION_NOISE = /\b(trf|nip|nibss|ft|fip|mob|web|ussd|pos|frm|from|to|ref|tnf|transfer|trans|inward|outward|payment|pymt|via|ltd|limited|plc|nig|nigeria|enterprises?)\b/gi;

/**
 * Stable key identifying a counterparty, used for counterparty memory.
 * Prefers the explicit name; otherwise derives one from the narration.
 */
export function counterpartyKey(counterpartyName: string | undefined, narration: string): string {
  const base = (counterpartyName && counterpartyName.trim()) || narration;
  const key = base
    .toLowerCase()
    .replace(/[/\\|_*#:;,.()[\]-]+/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(NARRATION_NOISE, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 3)
    .join(' ');
  return key;
}

export interface ClassifyInput {
  narration: string;
  direction: Direction;
  counterpartyName?: string;
  payeeType?: PayeeType;
}

/** Classify one transaction. Pure function — no I/O. */
export function classifyTransaction(
  input: ClassifyInput,
  memory: CounterpartyMemory = {},
): ClassificationResult {
  const payeeType: PayeeType = input.payeeType ?? 'company';

  // 1. User's own past corrections
  const key = counterpartyKey(input.counterpartyName, input.narration);
  const remembered = key ? memory[key] : undefined;
  if (remembered) {
    return {
      citCategory: remembered.citCategory,
      vatTreatment: remembered.vatTreatment,
      whtCategoryId: remembered.whtCategoryId,
      payeeType: remembered.payeeType,
      counterpartyTin: remembered.counterpartyTin,
      confidence: 0.95,
      source: 'COUNTERPARTY_MEMORY',
      ruleId: `memory:${key}`,
    };
  }

  // 2. Pattern rules
  const haystack = `${input.narration} ${input.counterpartyName ?? ''}`;
  for (const rule of CLASSIFICATION_RULES) {
    if (rule.direction !== 'ANY' && rule.direction !== input.direction) continue;
    if (!rule.pattern.test(haystack)) continue;
    return {
      citCategory: rule.citCategory,
      vatTreatment: rule.vatTreatment,
      whtCategoryId: rule.whtCategoryId ?? null,
      payeeType,
      confidence: rule.confidence,
      source: 'RULE',
      ruleId: rule.id,
    };
  }

  // 3. Low-confidence defaults → always reviewed
  return input.direction === 'INFLOW'
    ? {
        citCategory: 'SALES_REVENUE',
        vatTreatment: 'STANDARD',
        whtCategoryId: null,
        payeeType,
        confidence: 0.55,
        source: 'DEFAULT',
        ruleId: 'default-inflow',
      }
    : {
        citCategory: 'OPERATING_EXPENSE',
        vatTreatment: 'STANDARD',
        whtCategoryId: null,
        payeeType,
        confidence: 0.5,
        source: 'DEFAULT',
        ruleId: 'default-outflow',
      };
}

export function needsReview(confidence: number, reviewedAt: string | null): boolean {
  return reviewedAt === null && confidence < REVIEW_THRESHOLD;
}

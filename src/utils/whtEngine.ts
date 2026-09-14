/**
 * whtEngine.ts — Nigerian Withholding Tax (WHT) Calculation Engine
 *
 * Implements:
 *  - WHT rate schedules for companies and individuals
 *  - Credit note generation and tracking
 *  - WHT liability calculation by payment type
 *
 * References:
 *  - Withholding Tax Regulations (as amended)
 *  - FIRS WHT Schedule — Income Tax (Rates, etc.) Order
 */

// ─── WHT Rate Schedule ───────────────────────────────────────────────────────

export interface WHTRateEntry {
  id: string;
  paymentType: string;
  description: string;
  companyRate: number;
  individualRate: number;
}

export const WHT_RATE_SCHEDULE: WHTRateEntry[] = [
  {
    id: 'dividends',
    paymentType: 'Dividends',
    description: 'Dividend payments to shareholders',
    companyRate: 0.10,
    individualRate: 0.10,
  },
  {
    id: 'interest',
    paymentType: 'Interest',
    description: 'Interest payments on loans, deposits, and bonds',
    companyRate: 0.10,
    individualRate: 0.10,
  },
  {
    id: 'rent',
    paymentType: 'Rent',
    description: 'Rent payments for property (land and buildings)',
    companyRate: 0.10,
    individualRate: 0.10,
  },
  {
    id: 'royalties',
    paymentType: 'Royalties',
    description: 'Royalty payments for intellectual property',
    companyRate: 0.10,
    individualRate: 0.10,
  },
  {
    id: 'professional-fees',
    paymentType: 'Professional / Consultancy Fees',
    description: 'Payments for professional, management, and consulting services',
    companyRate: 0.10,
    individualRate: 0.05,
  },
  {
    id: 'technical-fees',
    paymentType: 'Technical Service Fees',
    description: 'Technical and management service fees',
    companyRate: 0.10,
    individualRate: 0.05,
  },
  {
    id: 'commission',
    paymentType: 'Commission',
    description: 'Commission payments to agents and intermediaries',
    companyRate: 0.10,
    individualRate: 0.05,
  },
  {
    id: 'construction',
    paymentType: 'Construction / Building',
    description: 'Payments for construction, building, and related services',
    companyRate: 0.025,
    individualRate: 0.025,
  },
  {
    id: 'supply',
    paymentType: 'Supply of Goods',
    description: 'Payments for supply of goods and equipment',
    companyRate: 0.05,
    individualRate: 0.05,
  },
  {
    id: 'director-fees',
    paymentType: 'Directors\' Fees',
    description: 'Fees paid to company directors',
    companyRate: 0.10,
    individualRate: 0.10,
  },
];

// ─── WHT Transaction Types ──────────────────────────────────────────────────

export interface WHTTransaction {
  id: string;
  date: string;
  payeeType: 'company' | 'individual';
  payeeName: string;
  payeeTIN?: string;
  paymentType: string;
  grossAmount: number;
  whtRate: number;
  whtAmount: number;
  netPayment: number;
  creditNoteRef?: string;
  status: 'pending' | 'remitted' | 'credited';
}

export interface WHTSummary {
  totalGrossPayments: number;
  totalWHTDeducted: number;
  totalNetPayments: number;
  byPaymentType: {
    paymentType: string;
    count: number;
    grossTotal: number;
    whtTotal: number;
  }[];
  pendingRemittance: number;
  remittedTotal: number;
}

// ─── WHT Calculation ─────────────────────────────────────────────────────────

/**
 * Get the applicable WHT rate for a given payment type and payee classification.
 */
export function getWHTRate(
  paymentTypeId: string,
  payeeType: 'company' | 'individual'
): number {
  const entry = WHT_RATE_SCHEDULE.find(r => r.id === paymentTypeId);
  if (!entry) return 0;
  return payeeType === 'company' ? entry.companyRate : entry.individualRate;
}

/**
 * Calculate WHT on a single payment.
 */
export function calculateWHT(
  grossAmount: number,
  paymentTypeId: string,
  payeeType: 'company' | 'individual'
): { whtRate: number; whtAmount: number; netPayment: number } {
  const rate = getWHTRate(paymentTypeId, payeeType);
  const whtAmount = Math.round(grossAmount * rate);
  const netPayment = grossAmount - whtAmount;
  return { whtRate: rate, whtAmount, netPayment };
}

/**
 * Generate a WHT credit note reference.
 */
export function generateCreditNoteRef(): string {
  const year = new Date().getFullYear();
  const seq = Math.floor(100000 + Math.random() * 900000);
  return `WHT-CR-${year}-${seq}`;
}

/**
 * Compute a WHT summary from a list of transactions.
 */
export function computeWHTSummary(transactions: WHTTransaction[]): WHTSummary {
  const totalGrossPayments = transactions.reduce((s, t) => s + t.grossAmount, 0);
  const totalWHTDeducted = transactions.reduce((s, t) => s + t.whtAmount, 0);
  const totalNetPayments = transactions.reduce((s, t) => s + t.netPayment, 0);

  // Group by payment type
  const typeMap = new Map<string, { count: number; grossTotal: number; whtTotal: number }>();
  for (const t of transactions) {
    const existing = typeMap.get(t.paymentType) || { count: 0, grossTotal: 0, whtTotal: 0 };
    existing.count++;
    existing.grossTotal += t.grossAmount;
    existing.whtTotal += t.whtAmount;
    typeMap.set(t.paymentType, existing);
  }

  const byPaymentType = Array.from(typeMap.entries()).map(([paymentType, data]) => ({
    paymentType,
    ...data,
  }));

  const pendingRemittance = transactions
    .filter(t => t.status === 'pending')
    .reduce((s, t) => s + t.whtAmount, 0);

  const remittedTotal = transactions
    .filter(t => t.status === 'remitted')
    .reduce((s, t) => s + t.whtAmount, 0);

  return {
    totalGrossPayments,
    totalWHTDeducted,
    totalNetPayments,
    byPaymentType,
    pendingRemittance,
    remittedTotal,
  };
}

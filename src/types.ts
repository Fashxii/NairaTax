export type AccountType = 'individual' | 'business';

export interface UserSession {
  accountType: AccountType;
  contactMethod: string;
  isVerified: boolean;
  isNINLinked: boolean;
  nin?: string;
  fullName?: string;
  taxId?: string;
}

export type DashboardTab = 'overview' | 'calculator' | 'filing-history' | 'education' | 'settings' | 'planner';

export interface TaxFiling {
  id: string;
  period: string;
  type: string;
  amount: number;
  status: 'Paid' | 'Processing' | 'Pending';
  dateFiled: string;
  receiptNumber: string;
}

export interface TaxCalculationResult {
  grossAnnual: number;
  grossMonthly: number;
  craRelief: number;
  pensionDeduction: number;
  taxableIncome: number;
  annualTax: number;
  monthlyTax: number;
  monthlyNet: number;
  effectiveTaxRate: number;
  bandBreakdown: {
    band: string;
    rate: number;
    taxableInBand: number;
    taxInBand: number;
  }[];
}

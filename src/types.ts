export type AccountType = 'individual' | 'business';
export type SystemRole = 'user' | 'admin';
export type AdminRole = 'super_admin' | 'content_manager' | 'reviewer';

export interface UserSession {
  accountType: AccountType;
  systemRole?: SystemRole;
  adminRole?: AdminRole;
  contactMethod: string;
  isVerified: boolean;
  isNINLinked: boolean;
  nin?: string;
  fullName?: string;
  taxId?: string;
}

export type DashboardTab = 'overview' | 'calculator' | 'filing-history' | 'education' | 'settings' | 'planner' | 'invoicing' | 'tcc' | 'payroll';
export type AdminDashboardTab = 'users' | 'roles' | 'cms' | 'tcc-approvals' | 'settings';

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

// --- Phase 1: E-Invoicing Types ---

export type InvoiceStatus = 'Draft' | 'Sent' | 'Paid' | 'Overdue';

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  clientName: string;
  clientEmail: string;
  issueDate: string;
  dueDate: string;
  lineItems: InvoiceLineItem[];
  subtotal: number;
  vatAmount: number;
  total: number;
  status: InvoiceStatus;
  vatRemitted: boolean;
  vatRemittanceRef?: string;
}

// --- Phase 3: SME Payroll Types ---

export interface Employee {
  id: string;
  name: string;
  role: string;
  grossMonthlySalary: number;
  optInPension: boolean;
  optInNHF: boolean;
  optInNHIS: boolean;
}

export interface PayslipResult {
  employeeId: string;
  gross: number;
  pension: number;
  nhf: number;
  nhis: number;
  cra: number;
  taxableIncome: number;
  paye: number;
  netPay: number;
}

// --- Admin User Management Types ---

export type AdminUserStatus = 'active' | 'suspended' | 'pending';

export interface AdminUser {
  id: string;
  fullName: string;
  email: string;
  role: AdminRole;
  status: AdminUserStatus;
  createdAt: string;
  lastLogin?: string;
}

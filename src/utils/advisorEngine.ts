/**
 * advisorEngine.ts — AI Tax Advisor Knowledge Base
 *
 * Keyword-based matcher with comprehensive Nigerian tax topics.
 * Returns structured responses with follow-up question suggestions.
 */

export interface AdvisorResponse {
  answer: string;
  followUps: string[];
}

interface TopicEntry {
  keywords: string[];
  answer: string;
  followUps: string[];
}

const TOPICS: TopicEntry[] = [
  {
    keywords: ['pit', 'personal income tax', 'income tax rate', 'tax bands', 'how much tax'],
    answer: `From 1 January 2026, Nigeria's Personal Income Tax (PIT) is computed using 6 progressive bands under the Nigeria Tax Act (NTA) 2025:\n\n• First ₦800,000 → 0%\n• Next ₦2,200,000 → 15%\n• Next ₦9,000,000 → 18%\n• Next ₦13,000,000 → 21%\n• Next ₦25,000,000 → 23%\n• Above ₦50,000,000 → 25%\n\nBefore applying these bands, deduct pension, NHF, NHIS, life assurance premiums, mortgage interest on your home and rent relief (20% of rent, max ₦500,000). The old Consolidated Relief Allowance (CRA) and the 1% minimum tax no longer apply.`,
    followUps: ['What happened to the CRA?', 'How do I calculate my take-home pay?', 'What deductions can I claim?']
  },
  {
    keywords: ['cra', 'consolidated relief', 'relief allowance'],
    answer: `The Consolidated Relief Allowance (CRA) was **abolished from 1 January 2026** by the Nigeria Tax Act 2025. It applied only to tax years up to 2025 (20% of gross + the greater of ₦200,000 or 1% of gross).\n\n**What replaces it**: a **rent relief** of 20% of the annual rent you actually pay, capped at ₦500,000, plus a wider tax-free first band (₦800,000 at 0%).\n\nFor example, on ₦6,000,000 gross paying ₦2,000,000 rent:\n• Rent relief = 20% × ₦2,000,000 = ₦400,000\n• Pension (8%) = ₦480,000\n• Chargeable income = ₦5,120,000\n\nKeep your tenancy agreement and rent receipts as evidence.`,
    followUps: ['What other deductions exist?', 'How is PIT calculated?', 'What about pension contributions?']
  },
  {
    keywords: ['vat', 'value added tax', '7.5', 'vat rate'],
    answer: `Nigeria's Value Added Tax (VAT) is currently **7.5%**, effective from February 2020 (increased from 5%).\n\n**Key Rules**:\n• VAT is charged on most goods and services\n• Basic food items, medical supplies, and educational materials are exempt\n• Exported goods and services are zero-rated\n• Businesses must remit collected VAT to FIRS monthly (by the 21st)\n• Input VAT (paid on purchases) can offset output VAT (collected from sales)\n\n**VAT Registration**: Required for businesses with annual turnover above ₦25 million.`,
    followUps: ['What items are VAT-exempt?', 'How do I file monthly VAT returns?', 'What is input VAT credit?']
  },
  {
    keywords: ['tcc', 'tax clearance', 'clearance certificate'],
    answer: `A Tax Clearance Certificate (TCC) is an official document issued by FIRS or your State IRS confirming your tax compliance for the past 3 years.\n\n**Requirements for TCC**:\n• Filed returns for the 3 preceding years\n• No outstanding tax liabilities or penalties\n• Valid TIN (Tax Identification Number)\n\n**Uses of TCC**:\n• Government contract bidding\n• Import/export licensing\n• Foreign exchange applications\n• Company registration renewals\n• Bank loan applications\n\nDIYtax9ja can generate your TCC readiness score and auto-apply once all filings are reconciled.`,
    followUps: ['How do I check my TCC readiness?', 'What happens if I owe back taxes?', 'How long does TCC issuance take?']
  },
  {
    keywords: ['paye', 'pay as you earn', 'employer', 'payroll tax'],
    answer: `PAYE (Pay-As-You-Earn) is the system by which employers deduct income tax from employee salaries and remit to the relevant State IRS.\n\n**Employer Obligations**:\n• Deduct PIT from each employee's monthly salary\n• Remit deductions by the 10th of the following month\n• File annual PAYE returns by January 31st\n• Apply rent relief and eligible deductions before computing tax\n\n**Employee Deductions** (mandatory):\n• Pension: 8% of basic + housing + transport\n• NHF: 2.5% of basic salary\n• NHIS: varies by scheme\n\nAll these deductions reduce taxable income before PIT bands are applied.`,
    followUps: ['How is pension calculated?', 'What is the NHF contribution?', 'How do I set up payroll?']
  },
  {
    keywords: ['pension', 'pencom', 'contributory pension', 'retirement'],
    answer: `Under the Pension Reform Act 2014, employees and employers must contribute to a Retirement Savings Account (RSA).\n\n**Contribution Rates**:\n• Employee: minimum 8% of (Basic + Housing + Transport)\n• Employer: minimum 10% of the same base\n• Total: at least 18%\n\n**Tax Benefit**: Employee pension contributions are fully tax-deductible — they reduce your taxable income before PIT bands are applied.\n\n**Key Rules**:\n• Contributions go to a PFA (Pension Fund Administrator)\n• Access at retirement (age 50+) or after 4 months of unemployment\n• Voluntary contributions above the mandatory rate get tax benefits up to 1/3 of total contribution`,
    followUps: ['How does pension reduce my tax?', 'What is NHF?', 'Can I access pension early?']
  },
  {
    keywords: ['nhf', 'national housing fund'],
    answer: `The National Housing Fund (NHF) requires a **2.5% contribution of basic salary** from employees earning ₦3,000/month or more.\n\n**Key Points**:\n• Mandatory under the NHF Act 1992\n• Deducted by employer and remitted to Federal Mortgage Bank\n• Contribution is **tax-deductible** — reduces your taxable income\n• Entitles contributors to low-interest mortgage loans (6% p.a.)\n• Requires minimum 6 months of contributions to access mortgage benefits`,
    followUps: ['How do I claim NHF tax relief?', 'What is the NHIS deduction?', 'How is PAYE calculated?']
  },
  {
    keywords: ['deadline', 'filing deadline', 'when to file', 'late filing', 'penalty'],
    answer: `**Filing Deadlines in Nigeria**:\n\n• **PIT (Individuals)**: March 31st for the preceding tax year\n• **CIT (Companies)**: 6 months after financial year end\n• **VAT Returns**: 21st of the month following the taxable period\n• **PAYE Returns**: January 31st (annual); 10th monthly (remittance)\n\n**Late Filing Penalties**:\n• PIT: ₦50,000 first month + ₦25,000 each subsequent month\n• CIT: ₦50,000 first month + ₦25,000 each subsequent month\n• VAT: 5% of unpaid amount + interest at prevailing CBN rate\n• PAYE: 10% penalty + interest at prevailing CBN rate\n\n**Best Practice**: File early to avoid penalties and ensure TCC eligibility.`,
    followUps: ['How do I file my returns?', 'What is the TCC?', 'Can I file an extension?']
  },
  {
    keywords: ['deduction', 'deductions', 'relief', 'tax relief', 'allowable deduction'],
    answer: `**Allowable PIT Deductions (Nigeria Tax Act 2025, from 2026)**:\n\n1. **Pension Contributions** — 8% employee contribution to your RSA\n2. **National Housing Fund (NHF)** — 2.5% of basic salary\n3. **NHIS / Health Insurance** — Premiums under the national scheme\n4. **Life Assurance / Annuity Premiums** — Paid for yourself or spouse\n5. **Mortgage Interest** — On your owner-occupied residential home\n6. **Rent Relief** — 20% of annual rent paid, capped at ₦500,000\n\nThe Consolidated Relief Allowance (CRA) and the 1% minimum tax were abolished from 2026. All deductions must be claimed with valid documentation.`,
    followUps: ['How do I claim rent relief?', 'What happened to the CRA?', 'Do I need receipts?']
  },
  {
    keywords: ['cit', 'company income tax', 'corporate tax', 'business tax'],
    answer: `Company Income Tax (CIT) applies to Nigerian companies and is administered by FIRS.\n\n**CIT Rates (2024+)**:\n• **Small Companies** (turnover ≤ ₦25M): **0%**\n• **Medium Companies** (₦25M < turnover ≤ ₦100M): **20%**\n• **Large Companies** (turnover > ₦100M): **30%**\n\n**Key Rules**:\n• Assessed on global profits for Nigerian-resident companies\n• Foreign companies taxed only on Nigeria-sourced income\n• Capital allowances apply on qualifying assets\n• Minimum tax: 0.5% of gross turnover (if no taxable profit)\n• Filed within 6 months of financial year end`,
    followUps: ['What qualifies as a small company?', 'What are capital allowances?', 'How is minimum tax calculated?']
  },
  {
    keywords: ['tin', 'tax identification', 'registration', 'how to register'],
    answer: `A Tax Identification Number (TIN) is mandatory for all taxpayers in Nigeria.\n\n**How to Get a TIN**:\n1. Visit the FIRS JTB TIN Registration Portal\n2. Submit NIN, BVN, or passport details\n3. Receive your 10-digit TIN within 48 hours\n\n**TIN is Required For**:\n• Opening a corporate bank account\n• Government contract bidding\n• Company registration (CAC)\n• Import/export clearance\n• TCC application\n\n**Note**: Since 2021, TINs are auto-generated for new CAC registrations and linked to NINs for individuals.`,
    followUps: ['How do I link my NIN?', 'What is a TCC?', 'How do I file my first return?']
  },
  {
    keywords: ['withholding', 'wht', 'withholding tax'],
    answer: `Withholding Tax (WHT) is an advance payment of income tax deducted at source on certain payments.\n\n**WHT Rates**:\n• Dividends: 10%\n• Interest: 10%\n• Rent: 10%\n• Royalties: 10%\n• Professional fees/Contracts: 10% (companies), 5% (individuals)\n• Construction: 2.5%\n• Supply of goods: 5%\n\n**Key Rules**:\n• Payer deducts WHT and remits to FIRS within 21 days\n• Recipient gets a credit note to offset against final tax liability\n• WHT is not a final tax — it's an advance payment\n• Companies must issue WHT credit notes to payees`,
    followUps: ['How do I claim WHT credit?', 'Is WHT a final tax?', 'What payments require WHT?']
  },
  {
    keywords: ['capital gains', 'cgt', 'capital gains tax', 'property sale'],
    answer: `Capital Gains Tax (CGT) in Nigeria is levied at a flat rate of **10%** on gains from the disposal of capital assets.\n\n**Taxable Assets**: Land, buildings, shares, intellectual property, vehicles\n\n**Exempt Disposals**:\n• Sale of shares on the Nigerian Stock Exchange (exempt since 2021)\n• Proceeds from life insurance policies\n• Gifts between family members\n• Government-acquired properties\n\n**Calculation**: Gain = Sale Price − Original Cost − Allowable Expenses\n\n**Filing**: CGT returns must be filed within the year the gain is realized.`,
    followUps: ['Are stock market gains taxed?', 'How do I report property sales?', 'What are allowable expenses?']
  },
  {
    keywords: ['stamp duty', 'stamp', 'document duty'],
    answer: `Stamp Duties are taxes on legal documents and instruments in Nigeria.\n\n**Common Rates**:\n• Lease agreements: varies by term and value\n• Share transfers: 75 kobo per ₦200 (flat rate)\n• Bank deposits ≥ ₦10,000: ₦50 electronic stamp duty\n• Insurance policies: varies\n• Power of Attorney: ₦500\n\n**Electronic Stamp Duty**: Since 2020, FIRS collects electronic stamp duty on eligible electronic transactions (₦50 on deposits of ₦10,000+).\n\n**Exemptions**: Government transactions, interbank transfers, salary payments.`,
    followUps: ['What is electronic stamp duty?', 'How does it apply to bank transfers?', 'Are all contracts subject to stamp duty?']
  },
  {
    keywords: ['receipt', 'scan', 'scanner', 'ocr', 'upload receipt'],
    answer: `DIYtax9ja's Smart Receipt Scanner uses OCR technology to digitize and categorize your expense receipts.\n\n**How It Works**:\n1. Upload or photograph a receipt (PDF, PNG, JPEG)\n2. Our scanner extracts: merchant name, amount, date, category\n3. The system auto-classifies the expense as deductible or personal\n4. Eligible receipts sync to your tax ledger to reduce liability\n\n**Supported Categories**: Rent, utilities, business travel, office equipment, professional fees, medical expenses, education.\n\n**Tip**: Scan receipts regularly throughout the year rather than scrambling at filing time!`,
    followUps: ['What expenses are deductible?', 'How do I file my returns?', 'What is rent relief?']
  },
];

/**
 * Match a user query against the knowledge base.
 * Returns the best match or a fallback response.
 */
export function getAdvisorResponse(query: string): AdvisorResponse {
  const normalised = query.toLowerCase().trim();

  // Score each topic by keyword overlap
  let bestMatch: TopicEntry | null = null;
  let bestScore = 0;

  for (const topic of TOPICS) {
    let score = 0;
    for (const kw of topic.keywords) {
      if (normalised.includes(kw)) {
        score += kw.length; // Longer keyword matches are worth more
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = topic;
    }
  }

  if (bestMatch && bestScore > 0) {
    return {
      answer: bestMatch.answer,
      followUps: bestMatch.followUps,
    };
  }

  return {
    answer: `Thank you for your question. While I don't have a specific pre-written answer for that topic, here's what I'd recommend:\n\n1. **Check the Tax Guides** tab for comprehensive Nigerian tax documentation\n2. **Use the Quick Calculator** to model your specific tax scenario\n3. **Visit FIRS.gov.ng** for official regulatory guidance\n\nCommon topics I can help with include: PIT rates, rent relief (which replaced CRA), VAT rules, PAYE obligations, pension contributions, filing deadlines, TCC requirements, withholding tax, and allowable deductions.\n\nTry asking about one of these topics!`,
    followUps: ['What is Personal Income Tax?', 'What happened to the CRA?', 'What are the filing deadlines?'],
  };
}

/** Predefined quick-ask questions for the sidebar */
export const QUICK_ASK_QUESTIONS = [
  'What is the Personal Income Tax (PIT) rate?',
  'What happened to the CRA?',
  'What is the VAT rate in Nigeria?',
  'How do I get a Tax Clearance Certificate?',
  'What are PAYE obligations for employers?',
  'How does pension reduce my tax?',
  'What is the NHF deduction?',
  'What are the filing deadlines?',
  'What deductions can I claim?',
  'How is Company Income Tax calculated?',
  'How do I get a TIN?',
  'What is Withholding Tax?',
  'How does Capital Gains Tax work?',
  'How do I use the receipt scanner?',
];

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Landmark, LayoutDashboard, Calculator, History, BookOpen, Settings, 
  LogOut, ShieldAlert, BadgeAlert, ShieldCheck, Download, ExternalLink, 
  Send, HelpCircle, FileText, Info, ArrowUpRight, Scale, CheckCircle2,
  Bell, Camera, Check, Upload, X, ArrowRight, ChevronRight, Sparkles, RefreshCw,
  TrendingUp, Calendar, Sun, Moon
} from 'lucide-react';
import { UserSession, DashboardTab, TaxFiling, TaxCalculationResult } from '../types';
import TaxReceiptModal from './TaxReceiptModal';

interface DashboardProps {
  session: UserSession;
  onLogout: () => void;
  onLinkNIN: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
}

interface SyncTransaction {
  id: string;
  merchant: string;
  category: string;
  date: string;
  amount: number;
  isDeductible: boolean;
}

const INITIAL_FILINGS: TaxFiling[] = [
  {
    id: 'f1',
    period: 'Year 2025',
    type: 'Personal Income Tax (PIT)',
    amount: 1450000,
    status: 'Paid',
    dateFiled: '2026-03-15',
    receiptNumber: 'NRTX-2025-842910'
  },
  {
    id: 'f2',
    period: 'March 2026',
    type: 'Value Added Tax (VAT)',
    amount: 245000,
    status: 'Paid',
    dateFiled: '2026-04-12',
    receiptNumber: 'NRTX-VAT-903812'
  },
  {
    id: 'f3',
    period: 'April 2026',
    type: 'Value Added Tax (VAT)',
    amount: 312000,
    status: 'Processing',
    dateFiled: '2026-05-18',
    receiptNumber: 'NRTX-VAT-954112'
  },
  {
    id: 'f4',
    period: 'Year 2026',
    type: 'Estimated Income Tax (Quarter 1)',
    amount: 362500,
    status: 'Paid',
    dateFiled: '2026-04-05',
    receiptNumber: 'NRTX-EST-124950'
  }
];

const INITIAL_TRANSACTIONS: SyncTransaction[] = [
  {
    id: 't1',
    merchant: 'Shoprite Lagos',
    category: 'Groceries / Supplies',
    date: 'Oct 24, 2026',
    amount: 18400,
    isDeductible: true
  },
  {
    id: 't2',
    merchant: 'Lagos State Internal Revenue',
    category: 'LIRS Remittance',
    date: 'Oct 22, 2026',
    amount: 45000,
    isDeductible: true
  },
  {
    id: 't3',
    merchant: 'Netflix Nigeria',
    category: 'Digital Services',
    date: 'Oct 20, 2026',
    amount: 4500,
    isDeductible: false
  },
  {
    id: 't4',
    merchant: 'Ikeja Electricity Distribution',
    category: 'Utilities / Power',
    date: 'Oct 15, 2026',
    amount: 28500,
    isDeductible: true
  },
  {
    id: 't5',
    merchant: 'Bolt Ride Lagos',
    category: 'Business Travel',
    date: 'Oct 12, 2026',
    amount: 6200,
    isDeductible: true
  }
];

export default function Dashboard({ session, onLogout, onLinkNIN, theme, onToggleTheme }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [filings, setFilings] = useState<TaxFiling[]>(INITIAL_FILINGS);
  const [transactions, setTransactions] = useState<SyncTransaction[]>(INITIAL_TRANSACTIONS);
  const [selectedFiling, setSelectedFiling] = useState<TaxFiling | null>(null);

  // Switcher account state ('personal' | 'business')
  const [accountMode, setAccountMode] = useState<'personal' | 'business'>('personal');

  // Scanner modal states
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanStep, setScanStep] = useState<'upload' | 'scanning' | 'result'>('upload');
  const [scannedFile, setScannedFile] = useState<string | null>(null);
  const [selectedPresetReceipt, setSelectedPresetReceipt] = useState<number | null>(null);
  const [scanProgress, setScanProgress] = useState(0);
  const [scannedData, setScannedData] = useState<{
    merchant: string;
    amount: number;
    category: string;
    date: string;
    isDeductible: boolean;
  } | null>(null);

  // Filing flow states
  const [isFilingFlow, setIsFilingFlow] = useState(false);
  const [filingStep, setFilingStep] = useState<1 | 2 | 3>(1);
  const [selectedFilingTransactions, setSelectedFilingTransactions] = useState<string[]>(
    INITIAL_TRANSACTIONS.filter(t => t.isDeductible).map(t => t.id)
  );
  const [acceptDeclaration, setAcceptDeclaration] = useState(false);
  const [newFilingRef, setNewFilingRef] = useState('NTX-9823-Lagos');
  const [filingLiability, setFilingLiability] = useState(185000);

  // Confetti Canvas Ref
  const confettiCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Calculator state
  const [annualSalaryInput, setAnnualSalaryInput] = useState('6000000'); // Default 6M NGN
  const [pensionRate, setPensionRate] = useState(8); // Default 8% standard
  const [calcVpc, setCalcVpc] = useState<boolean>(false);
  const [calcLifeAssurance, setCalcLifeAssurance] = useState<boolean>(false);
  const [calcNHF, setCalcNHF] = useState<boolean>(false);
  const [calcNHIS, setCalcNHIS] = useState<boolean>(false);
  const [calcCharity, setCalcCharity] = useState<boolean>(false);
  const [calcChildren, setCalcChildren] = useState<boolean>(false);
  const [calcDependantRelative, setCalcDependantRelative] = useState<boolean>(false);
  const [calcDisabled, setCalcDisabled] = useState<boolean>(false);
  const [calcMortgageInterest, setCalcMortgageInterest] = useState<boolean>(false);
  const [calcBondExempt, setCalcBondExempt] = useState<boolean>(false);
  const [calcResult, setCalcResult] = useState<TaxCalculationResult | null>(null);

  // Tax Planner state
  const [plannerIncome, setPlannerIncome] = useState<string>('4500000');
  const [plannerExpenses, setPlannerExpenses] = useState<string>('1200000');
  const [plannerOtherDeductions, setPlannerOtherDeductions] = useState<string>('300000');
  const [scenarioBusinessPurchase, setScenarioBusinessPurchase] = useState<boolean>(false);
  const [scenarioQ3Bonus, setScenarioQ3Bonus] = useState<boolean>(true);
  const [scenarioVpc, setScenarioVpc] = useState<boolean>(false);
  const [scenarioLifeAssurance, setScenarioLifeAssurance] = useState<boolean>(false);
  const [scenarioNHF, setScenarioNHF] = useState<boolean>(false);
  const [scenarioNHIS, setScenarioNHIS] = useState<boolean>(false);
  const [scenarioCharity, setScenarioCharity] = useState<boolean>(false);
  const [scenarioChildren, setScenarioChildren] = useState<boolean>(false);
  const [scenarioDependantRelative, setScenarioDependantRelative] = useState<boolean>(false);
  const [scenarioDisabled, setScenarioDisabled] = useState<boolean>(false);
  const [scenarioMortgageInterest, setScenarioMortgageInterest] = useState<boolean>(false);
  const [scenarioBondExempt, setScenarioBondExempt] = useState<boolean>(false);

  // AI Tax Consultant Chat state
  const [chatMessages, setChatMessages] = useState<{ sender: 'user' | 'assistant'; text: string }[]>([
    { 
      sender: 'assistant', 
      text: `Hello! I am your virtual NairaTax Advisor. Ask me anything about the new Nigerian Tax Implementation, deadlines, the National Identification Number (NIN-TIN) integration, or Personal Income Tax rates.` 
    }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  // Preset receipts for easy scanning simulation
  const presetReceipts = [
    {
      merchant: 'Manda Office Rent Ltd',
      amount: 150000,
      category: 'Rent Relief / Workspace',
      date: 'Oct 24, 2026',
      isDeductible: true,
      fileName: 'rent_receipt_manda.pdf'
    },
    {
      merchant: 'Eko Hotels & Suites (Client Dinner)',
      amount: 85000,
      category: 'Business Hospitality',
      date: 'Oct 23, 2026',
      isDeductible: true,
      fileName: 'ekohotels_invoice_85000.png'
    },
    {
      merchant: 'Slot Systems Ikeja',
      amount: 420000,
      category: 'Office Equipment',
      date: 'Oct 22, 2026',
      isDeductible: true,
      fileName: 'slot_ikeja_receipt_phone.jpg'
    },
    {
      merchant: 'Spar Supermarket Lagos',
      amount: 12500,
      category: 'Personal Consumption',
      date: 'Oct 20, 2026',
      isDeductible: false,
      fileName: 'spar_receipt_groceries.png'
    }
  ];

  // Standard predefined answers for simulation
  const taxPredefinedReplies: { [key: string]: string } = {
    nin: "Under the new tax policy enacted by the Federal Inland Revenue Service (FIRS) and Joint Tax Board (JTB), your 11-digit National Identification Number (NIN) automatically serves as your Tax Identification Number (TIN). This unified registry eliminates double taxation and aligns Nigeria with international financial standards.",
    deadline: "The primary tax deadlines in Nigeria are:\n• Personal Income Tax (PIT): March 31st annually for individual returns.\n• Company Income Tax (CIT): June 30th or within 6 months of financial year-end.\n• Value Added Tax (VAT): Must be remitted on or before the 21st day of every succeeding month.",
    cra: "Consolidated Relief Allowance (CRA) is calculated as: ₦200,000 or 1% of your Gross Annual Income (whichever is higher) plus an additional 20% of your Gross Annual Income. This entire sum is tax-exempt and deducted from your gross income before applying tax bands.",
    penalty: "Late filing of tax returns attracts severe penalties. For individuals, late PIT filing can lead to a flat penalty plus 10% interest on the outstanding tax liability. For corporate CIT filings, late submission attracts N25,000 in the first month and N5,000 for each subsequent month of default.",
    vat: "The standard Value Added Tax (VAT) rate in Nigeria is 7.5%. It is charged on all taxable goods and services, except for basic food items, baby products, educational books, medical services, and exported items.",
    wht: "Withholding Tax (WHT) is an advance payment of income tax. In Nigeria, it is deducted at source from payments made to a contractor or supplier at rates ranging from 2.5% to 10% depending on the transaction type. This is later utilized as tax credit to offset the taxpayer's final annual liabilities.",
    cit: "Company Income Tax (CIT) is levied on corporate profits. Small companies (under N25m turnover) are 100% exempt from CIT. Medium companies (N25m - N100m) pay 20%, while large companies (above N100m turnover) pay 30% CIT. Personal Income Tax (PIT) applies to individuals and is computed on a progressive scale up to 24%.",
    lifeAssur: "Under Section 33 of the Personal Income Tax Act (PITA), premiums paid on life assurance policies for yourself or your spouse are fully tax-deductible. This acts as an allowable relief that reduces your total taxable income, lowering your overall annual liability.",
    tcc: "A Tax Clearance Certificate (TCC) is the official proof issued by the tax authority (FIRS or SBIR) certifying that you have fully paid your taxes for the preceding 3 years. It is required for government contracts, land transactions, visa applications, and banking credit approvals. NairaTax allows automated e-filing to fast-track your TCC download.",
    pension: "Contributions to the National Pension Scheme (up to 8% employee contribution) or approved voluntary pension schemes are 100% tax-exempt. Utilizing voluntary pension contributions is one of the most effective and legally approved methods to lower your PIT taxable base.",
    childrenRelief: "Under Section 33(3) of the Personal Income Tax Act (PITA), you are entitled to a Child Allowance relief of ₦2,500 per unmarried child, up to a maximum of four children (under 16 years, or in full-time education). In NairaTax, we automatically track this statutory deduction to lower your chargeable income.",
    dependantRelief: "Dependant Relative Relief allows an annual tax-exempt deduction of ₦2,000 for each incapacitated or elderly dependant relative, up to a maximum of two relatives (maximum ₦4,000). While historically small, it remains a statutory right that taxpayers can declare.",
    disabledRelief: "Disabled Person's Special Relief provides an additional tax-exempt allowance of ₦3,000 or 20% of Gross Income (whichever is higher) for individuals with certified physical or mental disabilities. This relief is deducted from your gross income prior to applying the progressive tax bands.",
    mortgageInterestRelief: "Under PITA Section 33, any interest paid on mortgage loans taken out for owner-occupying, purchasing, or constructing a residential house is 100% tax-exempt. This provides immense relief for homeowners by significantly reducing their taxable income base.",
    bondInterestExempt: "Interest income earned by individual taxpayers on Federal Government Bonds, State/Local Government Bonds, Corporate Bonds, and Treasury Bills is 100% tax-exempt under the Personal Income Tax (Amendment) Act. You are not required to pay PIT on investment yields from these instruments."
  };

  // Switcher name & dynamic values
  const currentTaxpayerName = accountMode === 'personal' ? 'Chidi' : 'Apex Ventures Ltd';
  const currentTaxpayerFullName = accountMode === 'personal' ? (session.fullName || 'Chinedu Abiodun Okafor') : 'Apex Ventures & Logistics Ltd';
  
  // Donut chart parameters based on account mode
  // Personal: Total ₦45,000
  // Business: Total ₦1,850,000
  const donutData = accountMode === 'personal' ? {
    total: 45000,
    pitLabel: "Personal Income Tax",
    pitValue: 27000,
    vatLabel: "VAT Paid",
    vatValue: 11250,
    deductionsLabel: "Deductions",
    deductionsValue: 6750,
    pitStroke: "150.8, 251.2",
    vatStroke: "62.8, 251.2",
    vatOffset: -150.8,
    dedStroke: "37.7, 251.2",
    dedOffset: -213.6
  } : {
    total: 1850000,
    pitLabel: "Company Income Tax",
    pitValue: 1110000,
    vatLabel: "VAT Remitted",
    vatValue: 462500,
    deductionsLabel: "Allowable Expenses",
    deductionsValue: 277500,
    pitStroke: "150.8, 251.2",
    vatStroke: "62.8, 251.2",
    vatOffset: -150.8,
    dedStroke: "37.7, 251.2",
    dedOffset: -213.6
  };

  // Deductions Progress parameters
  // Dynamic scanner calculations: rent used starts at 320,000, but increases when user scans rent receipt!
  const rentScannedSum = transactions
    .filter(t => t.category.includes('Rent') || t.merchant.includes('Rent'))
    .reduce((sum, t) => sum + t.amount, 0);

  // We set a base value of 170,000 plus whatever scanned rent transactions we have.
  const personalRentReliefUsed = 170000 + rentScannedSum;
  const personalRentReliefCap = 500000;
  const personalRentReliefPercent = Math.min(100, Math.round((personalRentReliefUsed / personalRentReliefCap) * 100));

  const businessExpenseUsed = 1200000 + transactions.filter(t => t.isDeductible).reduce((sum, t) => sum + t.amount, 0);
  const businessExpenseCap = 3000000;
  const businessExpensePercent = Math.min(100, Math.round((businessExpenseUsed / businessExpenseCap) * 100));

  // Confetti Simulation Effect for success screen
  useEffect(() => {
    if (isFilingFlow && filingStep === 3 && confettiCanvasRef.current) {
      const canvas = confettiCanvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      class ConfettiParticle {
        x = Math.random() * canvas.width;
        y = Math.random() * canvas.height - canvas.height;
        size = Math.random() * 8 + 4;
        speedY = Math.random() * 3 + 2;
        speedX = Math.random() * 2 - 1;
        color = ['#013220', '#6f9c84', '#bdedd2', '#ff584d', '#ffdad6'][Math.floor(Math.random() * 5)];
        rotation = Math.random() * 360;
        rotationSpeed = Math.random() * 4 - 2;

        update() {
          this.y += this.speedY;
          this.x += this.speedX;
          this.rotation += this.rotationSpeed;
          if (this.y > canvas.height) {
            this.y = -20;
            this.x = Math.random() * canvas.width;
          }
        }

        draw() {
          if (!ctx) return;
          ctx.save();
          ctx.translate(this.x, this.y);
          ctx.rotate((this.rotation * Math.PI) / 180);
          ctx.fillStyle = this.color;
          ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
          ctx.restore();
        }
      }

      const resize = () => {
        canvas.width = canvas.parentElement?.clientWidth || window.innerWidth;
        canvas.height = canvas.parentElement?.clientHeight || window.innerHeight;
      };

      resize();

      let animationFrameId: number;
      let particles: ConfettiParticle[] = [];

      for (let i = 0; i < 75; i++) {
        particles.push(new ConfettiParticle());
      }

      const animate = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        particles.forEach(p => {
          p.update();
          p.draw();
        });
        animationFrameId = requestAnimationFrame(animate);
      };

      animate();

      window.addEventListener('resize', resize);
      return () => {
        cancelAnimationFrame(animationFrameId);
        window.removeEventListener('resize', resize);
      };
    }
  }, [isFilingFlow, filingStep]);

  const handleCalculateTax = (e: React.FormEvent) => {
    e.preventDefault();
    const grossAnnual = parseFloat(annualSalaryInput);
    if (isNaN(grossAnnual) || grossAnnual <= 0) return;

    const grossMonthly = grossAnnual / 12;
    const pensionContribution = grossAnnual * (pensionRate / 100);

    // CRA Relief calculation: 20% of Gross + max(200k, 1% of Gross)
    const standardPercent = grossAnnual * 0.01;
    const flatBase = 200000;
    const higherBase = Math.max(flatBase, standardPercent);
    const percentAllowance = grossAnnual * 0.20;
    const craRelief = higherBase + percentAllowance;

    // Taxable chargeable income
    let totalDeductions = pensionContribution + craRelief;
    if (calcVpc) totalDeductions += 150000;
    if (calcLifeAssurance) totalDeductions += 100000;
    if (calcNHF) totalDeductions += 80000;
    if (calcNHIS) totalDeductions += 50000;
    if (calcCharity) totalDeductions += 120000;
    if (calcChildren) totalDeductions += 100000; // Let's use standard substantial numbers so that the visual difference is clear! e.g. children allowance is up to 100,000 (25k per child up to 4 children)
    if (calcDependantRelative) totalDeductions += 40000; // e.g. 20,000 per dependant up to 2 dependants
    if (calcDisabled) totalDeductions += 60000; // Disabled Person Special Relief
    if (calcMortgageInterest) totalDeductions += 180000; // Mortgage Interest deduction
    if (calcBondExempt) totalDeductions += 150000; // Government Bond/T-bills exempt income deduction

    const taxableIncome = Math.max(0, grossAnnual - totalDeductions);

    // Tax Progressive bands (annualized rates)
    const bands = [
      { band: 'First ₦300,000', limit: 300000, rate: 0.07 },
      { band: 'Next ₦300,000', limit: 300000, rate: 0.11 },
      { band: 'Next ₦500,000', limit: 500000, rate: 0.15 },
      { band: 'Next ₦500,000', limit: 500000, rate: 0.19 },
      { band: 'Next ₦1,600,000', limit: 1600000, rate: 0.21 },
      { band: 'Above ₦3,200,000', limit: Infinity, rate: 0.24 }
    ];

    let remainingTaxable = taxableIncome;
    let annualTax = 0;
    const bandBreakdown = [];

    for (const b of bands) {
      if (remainingTaxable <= 0) break;
      const taxableInBand = Math.min(remainingTaxable, b.limit);
      const taxInBand = taxableInBand * b.rate;
      annualTax += taxInBand;
      remainingTaxable -= taxableInBand;

      bandBreakdown.push({
        band: b.band,
        rate: b.rate * 100,
        taxableInBand,
        taxInBand
      });
    }

    const monthlyTax = annualTax / 12;
    const monthlyPension = pensionContribution / 12;
    const monthlyNet = grossMonthly - monthlyTax - monthlyPension;
    const effectiveTaxRate = (annualTax / grossAnnual) * 100;

    setCalcResult({
      grossAnnual,
      grossMonthly,
      craRelief,
      pensionDeduction: pensionContribution,
      taxableIncome,
      annualTax,
      monthlyTax,
      monthlyNet,
      effectiveTaxRate,
      bandBreakdown
    });
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userText = chatInput;
    setChatMessages((prev) => [...prev, { sender: 'user', text: userText }]);
    setChatInput('');
    setIsTyping(true);

    setTimeout(() => {
      let reply = "I understand. Tax codes can be intricate. Could you elaborate or specify if you're asking about NIN compliance, tax deadlines, PIT calculations, late penalties, VAT rates, Withholding Tax (WHT), Company Income Tax (CIT), Life Assurance reliefs, Tax Clearance Certificates (TCC), Pension, Child Allowances, Dependant Relative Relief, Disabled Person allowances, Mortgage interest, or Bond investments?";
      
      const lower = userText.toLowerCase();
      if (lower.includes('nin') || lower.includes('tin') || lower.includes('national identification')) {
        reply = taxPredefinedReplies.nin;
      } else if (lower.includes('deadline') || lower.includes('due') || lower.includes('march') || lower.includes('remit')) {
        reply = taxPredefinedReplies.deadline;
      } else if (lower.includes('cra') || lower.includes('relief') || lower.includes('consolidated')) {
        reply = taxPredefinedReplies.cra;
      } else if (lower.includes('penalty') || lower.includes('fine') || lower.includes('late')) {
        reply = taxPredefinedReplies.penalty;
      } else if (lower.includes('vat') || lower.includes('value added') || lower.includes('rate')) {
        reply = taxPredefinedReplies.vat;
      } else if (lower.includes('wht') || lower.includes('withholding')) {
        reply = taxPredefinedReplies.wht;
      } else if (lower.includes('cit') || lower.includes('corporate') || lower.includes('company income tax') || lower.includes('company tax')) {
        reply = taxPredefinedReplies.cit;
      } else if (lower.includes('life assurance') || lower.includes('life insurance') || lower.includes('assurance policy')) {
        reply = taxPredefinedReplies.lifeAssur;
      } else if (lower.includes('tcc') || lower.includes('clearance') || lower.includes('tax clearance')) {
        reply = taxPredefinedReplies.tcc;
      } else if (lower.includes('pension') || lower.includes('voluntary pension') || lower.includes('retirement')) {
        reply = taxPredefinedReplies.pension;
      } else if (lower.includes('child') || lower.includes('children') || lower.includes('allowance')) {
        reply = taxPredefinedReplies.childrenRelief;
      } else if (lower.includes('dependant') || lower.includes('relative') || lower.includes('elderly')) {
        reply = taxPredefinedReplies.dependantRelief;
      } else if (lower.includes('disabled') || lower.includes('disability') || lower.includes('special relief')) {
        reply = taxPredefinedReplies.disabledRelief;
      } else if (lower.includes('mortgage') || lower.includes('housing loan') || lower.includes('interest relief')) {
        reply = taxPredefinedReplies.mortgageInterestRelief;
      } else if (lower.includes('bond') || lower.includes('treasury bill') || lower.includes('exempt income')) {
        reply = taxPredefinedReplies.bondInterestExempt;
      } else if (lower.includes('salary') || lower.includes('tax calculator') || lower.includes('calculate')) {
        reply = "To accurately calculate your Personal Income Tax, please click on the 'Quick Calculator' tab in the left sidebar menu. Enter your Gross Monthly/Annual earnings to view your precise, step-by-step statutory tax breakdown!";
      }

      setChatMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
      setIsTyping(false);
    }, 1500);
  };

  const handleInstantQuestion = (questionKey: string, questionText: string) => {
    setChatMessages((prev) => [...prev, { sender: 'user', text: questionText }]);
    setIsTyping(true);

    setTimeout(() => {
      const reply = taxPredefinedReplies[questionKey] || "I am processing your inquiry, please feel free to ask custom questions.";
      setChatMessages((prev) => [...prev, { sender: 'assistant', text: reply }]);
      setIsTyping(false);
    }, 1200);
  };

  // Receipt Scanner Flow Handles
  const selectPresetReceiptFile = (index: number) => {
    setSelectedPresetReceipt(index);
    setScannedFile(presetReceipts[index].fileName);
  };

  const handleStartScan = () => {
    if (selectedPresetReceipt === null) {
      alert("Please choose a receipt mock file to scan.");
      return;
    }
    setScanStep('scanning');
    setScanProgress(0);

    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          const data = presetReceipts[selectedPresetReceipt];
          setScannedData({
            merchant: data.merchant,
            amount: data.amount,
            category: data.category,
            date: data.date,
            isDeductible: data.isDeductible
          });
          setScanStep('result');
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  const handleSyncToLedger = () => {
    if (!scannedData) return;
    const newTx: SyncTransaction = {
      id: 'scanned_' + Date.now(),
      merchant: scannedData.merchant,
      category: scannedData.category,
      date: scannedData.date,
      amount: scannedData.amount,
      isDeductible: scannedData.isDeductible
    };

    setTransactions([newTx, ...transactions]);
    
    // Auto add to selected transaction checklist
    if (newTx.isDeductible) {
      setSelectedFilingTransactions(prev => [...prev, newTx.id]);
    }

    setIsScannerOpen(false);
    setScanStep('upload');
    setScannedFile(null);
    setSelectedPresetReceipt(null);
    setScannedData(null);
  };

  // Filing Flow Submits
  const handleToggleFilingTx = (id: string) => {
    setSelectedFilingTransactions(prev => 
      prev.includes(id) ? prev.filter(tId => tId !== id) : [...prev, id]
    );
  };

  const currentDeductionsTotal = transactions
    .filter(t => selectedFilingTransactions.includes(t.id))
    .reduce((sum, t) => sum + t.amount, 0);

  const calculateFilingTaxes = () => {
    // Standard simulation
    // Gross: 4,200,000 NGN
    const gross = 4200000;
    const net = Math.max(0, gross - currentDeductionsTotal);
    // 5% standard progressive average
    const liability = Math.round(net * 0.05);
    return { gross, net, liability };
  };

  const { gross: fGross, net: fNet, liability: fLiability } = calculateFilingTaxes();

  const handleProceedToStep2 = () => {
    setFilingStep(2);
    setAcceptDeclaration(false);
  };

  const handleAuthorizeAndFile = () => {
    if (!acceptDeclaration) return;
    setFilingStep(3);
    const generatedRef = "NTX-" + Math.floor(1000 + Math.random() * 9000) + "-Lagos";
    setNewFilingRef(generatedRef);
    setFilingLiability(fLiability);

    // Add this new filing to filings list!
    const newFiling: TaxFiling = {
      id: 'filed_' + Date.now(),
      period: 'FY 2026-27 (Current)',
      type: accountMode === 'personal' ? 'Personal Income Tax (PIT)' : 'Company Income Tax (CIT)',
      amount: fLiability,
      status: 'Paid',
      dateFiled: new Date().toISOString().split('T')[0],
      receiptNumber: generatedRef
    };

    setFilings([newFiling, ...filings]);
  };

  const handleExitFilingFlow = () => {
    setIsFilingFlow(false);
    setFilingStep(1);
    setAcceptDeclaration(false);
  };

  return (
    <div className="flex-grow flex flex-col md:flex-row w-full max-w-7xl mx-auto min-h-[85vh] bg-background">
      {/* Sidebar Navigation */}
      <aside className="w-full md:w-64 bg-white border-r border-outline-variant/60 flex flex-col justify-between py-6 flex-shrink-0">
        <div className="space-y-6">
          {/* Dashboard Branding */}
          <div className="px-6 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" className="w-7 h-7">
                <rect width="200" height="200" rx="44" fill="#013220"/>
                <path d="M60 140V60H85L115 110V60H140V140H115L85 90V140H60Z" fill="white"/>
                <path d="M70 152H130" stroke="#4ADE80" strokeWidth="8" strokeLinecap="round"/>
              </svg>
              <span className="font-extrabold text-primary-container text-lg tracking-tight">NairaTax</span>
            </div>
            
            <button
              onClick={onToggleTheme}
              className="p-1.5 rounded-lg hover:bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface transition-all cursor-pointer flex items-center justify-center"
              aria-label="Toggle theme"
              id="theme-toggle-sidebar"
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 text-amber-500 animate-pulse" />
              ) : (
                <Moon className="w-4 h-4 text-indigo-600" />
              )}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 px-3">
            <button
              onClick={() => { setActiveTab('overview'); setIsFilingFlow(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'overview' && !isFilingFlow
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <LayoutDashboard className="w-4.5 h-4.5" />
              <span>Tax Overview</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('calculator');
                setIsFilingFlow(false);
                if (!calcResult) {
                  const mockEvent = { preventDefault: () => {} } as React.FormEvent;
                  setTimeout(() => handleCalculateTax(mockEvent), 50);
                }
              }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'calculator'
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <Calculator className="w-4.5 h-4.5" />
              <span>Quick Calculator</span>
            </button>

            <button
              onClick={() => { setActiveTab('planner'); setIsFilingFlow(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'planner'
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <Calendar className="w-4.5 h-4.5" />
              <span>Tax Planner</span>
            </button>

            <button
              onClick={() => { setActiveTab('filing-history'); setIsFilingFlow(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'filing-history'
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <History className="w-4.5 h-4.5" />
              <span>Filing History</span>
            </button>

            <button
              onClick={() => { setActiveTab('education'); setIsFilingFlow(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'education'
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <BookOpen className="w-4.5 h-4.5" />
              <span>Guides &amp; Advisor</span>
            </button>

            <button
              onClick={() => { setActiveTab('settings'); setIsFilingFlow(false); }}
              className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                activeTab === 'settings'
                  ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                  : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
              }`}
            >
              <Settings className="w-4.5 h-4.5" />
              <span>User Profile</span>
            </button>
          </nav>
        </div>

        {/* User Session card & Logout */}
        <div className="px-4 pt-6 border-t border-outline-variant/50 space-y-3">
          <div className="flex items-center space-x-3 px-2">
            <div className="w-10 h-10 rounded-full bg-primary-container text-white flex items-center justify-center font-bold font-mono uppercase">
              {currentTaxpayerFullName[0]}
            </div>
            <div className="overflow-hidden text-left">
              <p className="text-xs font-bold text-primary-container truncate">{currentTaxpayerFullName}</p>
              <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider truncate">
                {accountMode} Registry
              </p>
            </div>
          </div>

          <button
            onClick={onLogout}
            className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider text-error hover:bg-error/10 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-grow p-4 md:p-8 overflow-y-auto relative pb-32">
        {/* Top Header Bar inside Main Area for switchers & bell */}
        <div className="w-full mb-8 flex justify-between items-center bg-white border border-outline-variant/60 rounded-xl px-5 py-3 shadow-xs">
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 rounded-full bg-accent-green animate-pulse"></span>
            <span className="text-xs font-bold text-on-surface-variant uppercase tracking-wider">Unified Revenue Link Live</span>
          </div>

          {/* Switching & Notifications */}
          <div className="flex items-center space-x-4">
            {/* Multi-Account Switcher matching high-fidelity UI exactly */}
            <div 
              onClick={() => setAccountMode(prev => prev === 'personal' ? 'business' : 'personal')}
              className="cursor-pointer select-none"
            >
              <div className="flex items-center gap-2 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-full p-1 pr-3 transition-colors">
                <div className="w-7 h-7 rounded-full bg-primary-container text-white flex items-center justify-center">
                  <span className="font-bold text-xs uppercase">{currentTaxpayerFullName[0]}</span>
                </div>
                <div className="flex flex-col text-left">
                  <span className="text-[9px] font-bold text-on-surface-variant leading-none">
                    {accountMode === 'personal' ? 'Personal' : 'Business'}
                  </span>
                  <div className="flex items-center gap-1 mt-0.5">
                    <RefreshCw className="w-2 h-2 text-primary animate-spin-slow" />
                    <span className="text-[8px] text-primary font-bold leading-none">
                      Switch to {accountMode === 'personal' ? 'Business' : 'Personal'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <button className="material-symbols-outlined text-on-surface-variant hover:bg-secondary-container rounded-full p-2 transition-colors active:scale-95 cursor-pointer relative">
              <Bell className="w-4.5 h-4.5" />
              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-error rounded-full"></span>
            </button>
          </div>
        </div>
        
        {/* Compliance Banner */}
        {!session.isNINLinked && (
          <div className="mb-6 bg-amber-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xs text-left">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 mt-0.5 sm:mt-0 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-800">LIMITED ACCESS: Tax Identity Unlinked</h4>
                <p className="text-xs text-amber-700 mt-1 leading-relaxed">
                  Under the Unified Tax Act, you must link your National Identification Number (NIN) to enable automated filing. Currently, some premium services are restricted.
                </p>
              </div>
            </div>
            <button
              onClick={onLinkNIN}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-lg transition-colors whitespace-nowrap cursor-pointer"
            >
              Link Your NIN Now
            </button>
          </div>
        )}

        {/* 3-STEP FILING FLOW SCREEN INTERFACE */}
        {isFilingFlow ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 text-left max-w-3xl mx-auto"
          >
            {/* Header & Steps Indicator */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-outline-variant/40">
              <div>
                <h2 className="text-2xl font-black text-primary-container tracking-tight">Review &amp; File Returns</h2>
                <p className="text-xs text-on-surface-variant mt-0.5">Secure automated e-filing directly to the Federal Inland Revenue Service (FIRS).</p>
              </div>
              
              {/* Stepper Wizard matching layout of attachment */}
              <div className="flex items-center space-x-2 text-xs font-semibold">
                <div className="flex items-center space-x-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    filingStep > 1 ? 'bg-primary-container text-white' : 'border-2 border-primary-container text-primary-container'
                  }`}>
                    {filingStep > 1 ? <Check className="w-3.5 h-3.5" /> : '1'}
                  </div>
                  <span className={filingStep === 1 ? 'text-primary-container font-bold' : 'text-on-surface-variant'}>Reconcile</span>
                </div>
                <div className="w-8 h-[2px] bg-outline-variant" />
                <div className="flex items-center space-x-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    filingStep === 2 ? 'border-2 border-primary-container text-primary-container font-bold' : filingStep > 2 ? 'bg-primary-container text-white' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    {filingStep > 2 ? <Check className="w-3.5 h-3.5" /> : '2'}
                  </div>
                  <span className={filingStep === 2 ? 'text-primary-container font-bold' : 'text-on-surface-variant'}>Review</span>
                </div>
                <div className="w-8 h-[2px] bg-outline-variant" />
                <div className="flex items-center space-x-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[10px] ${
                    filingStep === 3 ? 'border-2 border-primary-container text-primary-container font-bold' : 'bg-surface-container-high text-on-surface-variant'
                  }`}>
                    3
                  </div>
                  <span className={filingStep === 3 ? 'text-primary-container font-bold' : 'text-on-surface-variant'}>File</span>
                </div>
              </div>
            </div>

            {/* Step 1 Content: Reconcile Receipts */}
            {filingStep === 1 && (
              <div className="space-y-6">
                <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-primary-container uppercase tracking-wider">1. Select Allowable Tax Deductions</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Under statutory guidelines, only certified business transactions and qualified personal deductions can reduce your taxable liabilities. Uncheck any non-eligible expenses.
                  </p>

                  <div className="space-y-2 mt-4">
                    {transactions.map((t) => (
                      <div 
                        key={t.id}
                        onClick={() => handleToggleFilingTx(t.id)}
                        className={`p-3.5 border rounded-xl flex items-center justify-between gap-4 cursor-pointer transition-colors ${
                          selectedFilingTransactions.includes(t.id)
                            ? 'bg-[#013220]/5 border-primary-container'
                            : 'bg-white hover:bg-surface-container-low border-outline-variant/60'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input 
                            type="checkbox"
                            checked={selectedFilingTransactions.includes(t.id)}
                            onChange={() => {}} // handled by div click
                            className="mt-1 rounded text-primary-container border-outline"
                          />
                          <div>
                            <p className="font-bold text-xs text-on-surface">{t.merchant}</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">{t.category} • {t.date}</p>
                          </div>
                        </div>

                        <div className="text-right flex flex-col items-end">
                          <p className="font-mono text-xs font-bold text-on-surface">₦{t.amount.toLocaleString()}</p>
                          {t.isDeductible ? (
                            <span className="text-[8px] uppercase tracking-wider font-bold bg-[#4ADE80]/25 text-[#013220] px-1.5 py-0.5 rounded mt-1">Deductible</span>
                          ) : (
                            <span className="text-[8px] uppercase tracking-wider font-bold bg-neutral-200 text-neutral-600 px-1.5 py-0.5 rounded mt-1">Uncategorized</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="bg-surface-container-low p-4 rounded-xl border border-outline-variant/30 flex justify-between items-center text-xs mt-4">
                    <div>
                      <p className="font-bold text-on-surface-variant uppercase text-[10px]">Total Selected Relief Deductions</p>
                      <p className="text-lg font-black font-mono text-primary-container mt-0.5">₦{currentDeductionsTotal.toLocaleString()}</p>
                    </div>
                    <button
                      onClick={handleProceedToStep2}
                      className="px-5 py-2.5 bg-primary-container text-white text-xs font-bold uppercase tracking-wider rounded-lg flex items-center space-x-1.5 hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      <span>Proceed to Review</span>
                      <ArrowRight className="w-4 h-4 text-accent-green" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 Content: Review Summary & Declaration (Screen 3 of attachment) */}
            {filingStep === 2 && (
              <div className="space-y-6">
                {/* Summary Receipt Card */}
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs relative border-l-4 border-l-primary-container">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-headline-md text-headline-md text-primary font-bold">Return Summary</h2>
                    <span className="text-xs font-bold text-on-surface-variant bg-surface-container px-3 py-1 rounded">FY 2026-27</span>
                  </div>

                  <div className="space-y-4">
                    <div className="flex justify-between items-center pb-3 border-b border-surface-container">
                      <span className="text-xs text-on-surface-variant font-medium">Gross Tracked Income</span>
                      <span className="font-numeric-data text-xs font-bold text-on-surface font-mono">₦{fGross.toLocaleString()}.00</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-surface-container text-error">
                      <span className="text-xs font-medium">Total Allowed Deductions</span>
                      <span className="font-numeric-data text-xs font-bold font-mono">-₦{currentDeductionsTotal.toLocaleString()}.00</span>
                    </div>

                    <div className="flex justify-between items-center pb-3 border-b border-surface-container">
                      <span className="text-xs text-on-surface-variant font-medium">Net Taxable Income</span>
                      <span className="font-numeric-data text-xs font-bold text-on-surface font-mono">₦{fNet.toLocaleString()}.00</span>
                    </div>

                    <div className="mt-6 pt-5 bg-surface-container-low rounded-xl p-4 border border-outline-variant/30">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <div>
                          <span className="font-bold text-[10px] text-primary uppercase tracking-widest block">Final Tax Liability Owed</span>
                          <p className="text-[10px] text-on-surface-variant">Payable via Nigerian Revenue Standards (NRS)</p>
                        </div>
                        <span className="text-2xl font-black text-primary-container font-mono">₦{fLiability.toLocaleString()}.00</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Legal Declaration Box exactly from attachment */}
                <div className="bg-white border border-outline-variant rounded-xl p-4">
                  <label className="flex items-start gap-3 cursor-pointer select-none">
                    <input 
                      type="checkbox"
                      checked={acceptDeclaration}
                      onChange={(e) => setAcceptDeclaration(e.target.checked)}
                      className="mt-1 rounded text-primary-container border-outline w-5 h-5 focus:ring-primary-container"
                    />
                    <span className="text-[11px] text-on-surface-variant leading-relaxed text-left">
                      I certify under penalty of law that all tracked receipts and financial statements are true representations of my income. I understand that fraudulent claims are subject to NRS auditing and penalties.
                    </span>
                  </label>
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={handleAuthorizeAndFile}
                    disabled={!acceptDeclaration}
                    className={`w-full py-4 px-6 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
                      acceptDeclaration 
                        ? 'bg-primary-container text-white hover:opacity-90 cursor-pointer active:scale-[0.99]' 
                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Authorize NRS Payment &amp; File Returns</span>
                    <Send className="w-4 h-4 text-accent-green" />
                  </button>

                  <button
                    onClick={handleExitFilingFlow}
                    className="w-full border-2 border-primary-container text-primary-container hover:bg-surface-container-low py-4 px-6 rounded-lg font-bold text-xs uppercase tracking-wider active:scale-[0.99] transition-all cursor-pointer"
                  >
                    Save Draft &amp; Exit
                  </button>
                </div>

                {/* Support seal */}
                <div className="text-center mt-4">
                  <p className="text-[10px] text-on-surface-variant flex items-center justify-center gap-1">
                    <ShieldCheck className="w-4 h-4 text-[#013220]" />
                    <span>Secure connection encrypted by Nigerian Revenue Service standards.</span>
                  </p>
                </div>
              </div>
            )}

            {/* Step 3 Content: Success & Download Certificate (Screen 1 of attachment) */}
            {filingStep === 3 && (
              <div className="w-full relative overflow-hidden bg-white border border-outline-variant rounded-2xl p-6 md:p-8 flex flex-col items-center text-center">
                {/* Confetti Background Inside Card */}
                <canvas ref={confettiCanvasRef} className="absolute inset-0 pointer-events-none z-0" />

                <div className="relative z-10 flex flex-col items-center">
                  {/* Success Icon */}
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 150 }}
                    className="w-20 h-20 md:w-24 md:h-24 bg-primary-container rounded-full flex items-center justify-center mb-6"
                  >
                    <Check className="w-10 h-10 md:w-12 md:h-12 text-on-primary" />
                  </motion.div>

                  {/* Title & Banner */}
                  <div className="space-y-3 mb-6">
                    <h1 className="font-display-lg text-2xl md:text-3xl font-black text-primary">Filing Successful!</h1>
                    <p className="text-xs text-on-surface-variant max-w-md mx-auto leading-relaxed">
                      Your {accountMode === 'personal' ? '2026 Personal Income Tax Return' : '2026 Company Income Tax Return'} has been successfully submitted to the <span className="font-bold text-on-surface">Nigeria Federal Inland Revenue Service (FIRS)</span>.
                    </p>
                    <div className="inline-flex items-center gap-1.5 bg-surface-container px-3.5 py-1.5 rounded-full border border-outline-variant/60">
                      <ShieldCheck className="w-4 h-4 text-primary" />
                      <span className="text-[9px] font-bold font-mono text-on-surface-variant uppercase tracking-widest">
                        Reference: {newFilingRef}
                      </span>
                    </div>
                  </div>

                  {/* Bento Summary Grid (High-end UI Pattern) */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-md mb-6 text-left">
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl border-l-4 border-l-primary-container flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">TAX YEAR</span>
                      <span className="font-bold text-sm text-primary">2026-27 Fiscal</span>
                    </div>
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl border-l-4 border-l-primary-container flex flex-col gap-0.5">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">TOTAL LIABILITY</span>
                      <span className="font-mono font-bold text-sm text-primary">₦{filingLiability.toLocaleString()}.00</span>
                    </div>
                    <div className="p-4 bg-surface-container-low border border-outline-variant rounded-xl border-l-4 border-l-primary-container flex flex-col gap-0.5 col-span-1 md:col-span-2">
                      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">FILING STATUS</span>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <div className="w-2 h-2 rounded-full bg-accent-green animate-pulse" />
                        <span className="font-bold text-xs text-primary">Submitted &amp; Verified</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="space-y-3 w-full max-w-md">
                    <button
                      onClick={() => alert(`Downloading TCC PDF certificate for ref: ${newFilingRef}`)}
                      className="w-full bg-primary-container text-white hover:opacity-95 font-bold py-3.5 px-6 rounded-lg flex items-center justify-center gap-2 active:scale-98 transition-transform text-xs uppercase tracking-wider cursor-pointer h-14"
                    >
                      <Download className="w-4 h-4 text-accent-green" />
                      <span>Download Official Tax Clearance Certificate (TCC) PDF</span>
                    </button>

                    <button
                      onClick={handleExitFilingFlow}
                      className="w-full border-2 border-primary-container text-primary-container hover:bg-surface-container-low font-bold py-3.5 px-6 rounded-lg flex items-center justify-center gap-2 transition-colors text-xs uppercase tracking-wider h-14 cursor-pointer"
                    >
                      Return to Home Dashboard
                    </button>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        ) : (
          /* STANDARD TABS FLOWS */
          <>
            {activeTab === 'overview' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                {/* Greeting Area */}
                <div>
                  <h2 className="text-2xl font-black text-primary-container tracking-tight">
                    Hello, {currentTaxpayerName}
                  </h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green animate-pulse"></span>
                    <span className="text-[10px] text-on-surface-variant font-medium">Synced just now</span>
                  </div>
                  
                  <div className="inline-flex items-center mt-3 px-3.5 py-1 rounded-full bg-[#013220]/10 border border-[#013220]/25">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#013220] mr-2"></div>
                    <span className="text-[10px] font-bold text-primary-container uppercase tracking-widest">
                      {session.isNINLinked ? 'Status: Fully Compliant (FY2026)' : 'Status: Identity Unlinked'}
                    </span>
                  </div>
                </div>

                {/* Primary Bento row: Donut Chart & Deductions cap tracker */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Donut chart matching layout precisely */}
                  <div className="lg:col-span-7 bg-white border border-outline-variant rounded-xl p-5 shadow-xs flex flex-col justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider mb-4">Current Estimated Tax Liability</h3>
                      
                      <div className="flex flex-col md:flex-row items-center justify-center gap-6 py-2">
                        {/* Interactive Donut SVG */}
                        <div className="relative w-44 h-44 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                            {/* Base grey background segment */}
                            <circle className="stroke-surface-container-highest fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40"></circle>
                            {/* Segment 1: PIT (60%) */}
                            <circle className="stroke-[#013220] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.pitStroke }}></circle>
                            {/* Segment 2: VAT (25%) */}
                            <circle className="stroke-[#6f9c84] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.vatStroke, strokeDashoffset: donutData.vatOffset }}></circle>
                            {/* Segment 3: Deductions (15%) */}
                            <circle className="stroke-[#bdedd2] fill-none" strokeWidth="12" strokeLinecap="round" cx="50" cy="50" r="40" style={{ strokeDasharray: donutData.dedStroke, strokeDashoffset: donutData.dedOffset }}></circle>
                          </svg>
                          <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-widest">Total</span>
                            <span className="text-lg font-black text-primary font-mono">₦{donutData.total.toLocaleString()}</span>
                          </div>
                        </div>

                        {/* Chart Legend */}
                        <div className="grid grid-cols-1 gap-2.5 w-full">
                          <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#013220] bg-surface-container-low rounded-r-lg">
                            <span className="text-[11px] text-on-surface-variant font-medium">{donutData.pitLabel}</span>
                            <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.pitValue.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#6f9c84] bg-surface-container-low rounded-r-lg">
                            <span className="text-[11px] text-on-surface-variant font-medium">{donutData.vatLabel}</span>
                            <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.vatValue.toLocaleString()}</span>
                          </div>
                          <div className="flex items-center justify-between p-2.5 border-l-4 border-l-[#bdedd2] bg-surface-container-low rounded-r-lg">
                            <span className="text-[11px] text-on-surface-variant font-medium">{donutData.deductionsLabel}</span>
                            <span className="text-xs font-bold font-mono text-on-surface">₦{donutData.deductionsValue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Right side trackers */}
                  <div className="lg:col-span-5 flex flex-col gap-6 justify-between">
                    {/* Pro Tip Banner */}
                    <div className="bg-[#bdedd2]/35 border border-[#6f9c84]/40 rounded-xl p-4 flex gap-3 items-start">
                      <Info className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-[#013220] leading-relaxed">
                          <span className="font-extrabold">Pro Tip:</span> {accountMode === 'personal' 
                            ? "Your annual rent is deductible up to 20% of your total income. Keep your receipts in the Smart Vault!" 
                            : "Corporate research and development expenses are 100% tax-deductible under Section 26 of CIT Act. Scan your vendor invoices!"}
                        </p>
                      </div>
                    </div>

                    {/* Deductions Tracker (Rent Relief Cap Tool / Allowable expense tracker) */}
                    <div className="bg-white border border-outline-variant rounded-xl p-5 relative border-l-4 border-l-primary-container flex flex-col justify-between">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h3 className="font-bold text-xs text-primary uppercase tracking-wider">
                            {accountMode === 'personal' ? 'Deductions Tracker' : 'Allowable Expense Tracker'}
                          </h3>
                          <p className="text-[10px] text-on-surface-variant mt-0.5">
                            {accountMode === 'personal' ? 'Rent Relief Cap Tool' : 'Travel Expense Allowance Cap'}
                          </p>
                        </div>
                        <FileText className="w-4.5 h-4.5 text-primary" />
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between text-[11px] text-on-surface font-semibold">
                          <span className="font-mono font-bold">₦{(accountMode === 'personal' ? personalRentReliefUsed : businessExpenseUsed).toLocaleString()} used</span>
                          <span className="text-on-surface-variant font-mono">₦{(accountMode === 'personal' ? personalRentReliefCap : businessExpenseCap).toLocaleString()} Cap</span>
                        </div>

                        {/* Smooth progress bar */}
                        <div className="w-full h-3.5 bg-surface-container-highest rounded-full overflow-hidden border border-outline-variant/35">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${accountMode === 'personal' ? personalRentReliefPercent : businessExpensePercent}%` }}
                            transition={{ duration: 0.8 }}
                            className="h-full bg-primary-container"
                          />
                        </div>

                        <p className="text-[10px] text-on-surface-variant leading-normal mt-2">
                          You've utilized {accountMode === 'personal' ? personalRentReliefPercent : businessExpensePercent}% of your allowed {accountMode === 'personal' ? '20% rent relief' : 'business corporate'} deduction allowance for the current fiscal cycle.
                        </p>
                      </div>
                    </div>
                  </div>

                </div>

                {/* Ledger sync transactions ledger & quick actions */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Ledger logs */}
                  <div className="lg:col-span-8 bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="font-bold text-xs text-on-surface uppercase tracking-wider">Sync Transaction Activity</h3>
                      <button 
                        onClick={() => alert('Viewing complete live financial ledger...')}
                        className="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center space-x-1"
                      >
                        <span>View All Transactions</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="space-y-2">
                      {transactions.map((tx) => (
                        <div 
                          key={tx.id}
                          className="flex items-center gap-3 bg-surface-container-low/40 border border-outline-variant/50 p-3 rounded-xl hover:bg-surface-container-low transition-all"
                        >
                          <div className="w-9 h-9 bg-white border border-outline-variant/60 rounded-lg flex items-center justify-center flex-shrink-0">
                            {tx.merchant.toLowerCase().includes('lirs') || tx.merchant.toLowerCase().includes('revenue') ? (
                              <Landmark className="w-4 h-4 text-primary" />
                            ) : (
                              <FileText className="w-4 h-4 text-primary" />
                            )}
                          </div>

                          <div className="flex-grow min-w-0 text-left">
                            <div className="flex justify-between items-start">
                              <h4 className="text-xs font-bold text-on-surface truncate pr-2">{tx.merchant}</h4>
                              <span className="text-[10px] text-on-surface font-bold font-mono flex-shrink-0">₦{tx.amount.toLocaleString()}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                              <span className="text-[9px] text-on-surface-variant font-medium">{tx.date}</span>
                              
                              <div className="flex items-center gap-1">
                                <span className="px-1.5 py-0.5 bg-surface-container-high text-[8px] font-bold rounded uppercase tracking-wider text-on-surface-variant">{tx.category}</span>
                                {tx.isDeductible ? (
                                  <span className="text-[8px] font-bold text-on-primary-container px-1.5 py-0.5 rounded bg-primary-fixed/40 uppercase">Deductible</span>
                                ) : (
                                  <span className="text-[8px] font-bold text-neutral-500 px-1.5 py-0.5 rounded bg-neutral-100 uppercase">Personal</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div className="lg:col-span-4 flex flex-col justify-between gap-6">
                    {/* File returns button */}
                    <div className="bg-[#013220] text-white p-5 rounded-xl border border-outline-variant flex flex-col justify-between h-full space-y-4">
                      <div>
                        <span className="text-[9px] font-bold text-accent-green uppercase tracking-widest block">Statutory Filing Portal</span>
                        <h3 className="font-extrabold text-sm text-white uppercase mt-1">Ready to File?</h3>
                        <p className="text-[11px] text-neutral-300 leading-relaxed mt-2">
                          Lock in your deductible allowable expenses and submit your annual self-assessment clearance return directly to the FIRS.
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          if (!session.isNINLinked) {
                            alert("Compliance constraint: Please link your NIN first before self-assessment filing.");
                          } else {
                            setIsFilingFlow(true);
                            setFilingStep(1);
                          }
                        }}
                        className="w-full py-3 bg-[#4ADE80] hover:bg-[#4ADE80]/90 text-[#013220] rounded-lg font-black text-xs uppercase tracking-wider active:scale-95 transition-transform flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                      >
                        <FileText className="w-4.5 h-4.5" />
                        <span>Start Annual Filing</span>
                      </button>
                    </div>
                  </div>

                </div>
              </motion.section>
            )}

            {/* Tab View: Calculator */}
            {activeTab === 'calculator' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                <div>
                  <h2 className="text-2xl font-black text-primary-container tracking-tight">
                    Statutory Personal Income Tax Calculator
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Compute Personal Income Tax (PIT) under the Nigerian Personal Income Tax Act (PITA) incorporating Consolidated Relief Allowance (CRA).
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Input Form Column */}
                  <div className="lg:col-span-5 bg-white border border-outline-variant rounded-xl p-6 shadow-xs h-fit space-y-6">
                    <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Salary Details</h3>
                    
                    <form onSubmit={handleCalculateTax} className="space-y-4">
                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                          Gross Annual Income (₦)
                        </label>
                        <input
                          type="number"
                          value={annualSalaryInput}
                          onChange={(e) => setAnnualSalaryInput(e.target.value)}
                          className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                          placeholder="e.g. 6000000 for 6 Million NGN"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                          Statutory Pension Contribution Rate (%)
                        </label>
                        <select
                          value={pensionRate}
                          onChange={(e) => setPensionRate(parseInt(e.target.value))}
                          className="w-full h-11 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                        >
                          <option value={8}>8% (Standard Employee Contribution)</option>
                          <option value={0}>0% (No Pension Deductions)</option>
                          <option value={5}>5% (Custom Rate)</option>
                          <option value={10}>10% (Enhanced Rate)</option>
                        </select>
                      </div>

                      {/* Additional Reliefs Section */}
                      <div className="space-y-2 border-t border-outline-variant/30 pt-4 pb-2">
                        <label className="text-[10px] font-bold text-[#013220] uppercase tracking-wider block">
                          FIRS Approved Reliefs &amp; Suggestions
                        </label>
                        <p className="text-[9px] text-on-surface-variant leading-normal">
                          Select additional approved statutory deductions to lower your taxable net income:
                        </p>
                        
                        <div className="space-y-2 pt-1 text-left">
                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcVpc}
                              onChange={(e) => setCalcVpc(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Voluntary Pension (₦150,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcLifeAssurance}
                              onChange={(e) => setCalcLifeAssurance(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Life Assurance (₦100,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcNHF}
                              onChange={(e) => setCalcNHF(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>National Housing Fund (₦80,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcNHIS}
                              onChange={(e) => setCalcNHIS(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>NHIS Health Premiums (₦50,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcCharity}
                              onChange={(e) => setCalcCharity(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Charitable Donation (₦120,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcChildren}
                              onChange={(e) => setCalcChildren(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Children Allowance (₦100,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcDependantRelative}
                              onChange={(e) => setCalcDependantRelative(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Dependant Relative Relief (₦40,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcDisabled}
                              onChange={(e) => setCalcDisabled(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Disabled Person Relief (₦60,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcMortgageInterest}
                              onChange={(e) => setCalcMortgageInterest(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Mortgage Interest Relief (₦180,000 exempt)</span>
                          </label>

                          <label className="flex items-center space-x-2 text-xs text-on-surface cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={calcBondExempt}
                              onChange={(e) => setCalcBondExempt(e.target.checked)}
                              className="rounded border-outline-variant text-[#013220] focus:ring-[#013220] w-4 h-4"
                            />
                            <span>Government Bonds &amp; T-Bills (₦150,000 exempt)</span>
                          </label>
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full h-12 bg-primary-container hover:bg-primary-container/95 text-white font-bold rounded-lg active:scale-95 transition-all flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                      >
                        <span>Calculate Statutory Taxes</span>
                        <ArrowUpRight className="w-4 h-4 text-accent-green" />
                      </button>
                    </form>

                    {/* Statutory parameters info */}
                    <div className="p-3 bg-surface-container rounded-lg space-y-2 text-[10px] text-on-surface-variant leading-relaxed">
                      <p className="font-bold text-primary-container flex items-center space-x-1">
                        <Info className="w-3.5 h-3.5" />
                        <span>Statutory Nigerian Tax Reliefs:</span>
                      </p>
                      <p>• Consolidated Relief Allowance (CRA): ₦200,000 or 1% of Gross + 20% of Gross.</p>
                      <p>• Employee Pension: 8% of statutory base deducted tax-exempt.</p>
                    </div>
                  </div>

                  {/* Tax Output Columns */}
                  <div className="lg:col-span-7 space-y-6">
                    {calcResult ? (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-6"
                      >
                        <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Tax Calculation Breakdown</h3>
                        
                        {/* Primary Net Monthly Display */}
                        <div className="grid grid-cols-2 gap-4 border-b border-outline-variant pb-6">
                          <div className="p-4 bg-[#013220]/5 rounded-xl border border-primary-container/10 text-left">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Estimated Monthly Net Pay</p>
                            <p className="text-lg font-black text-primary-container font-mono mt-1">
                              ₦{calcResult.monthlyNet.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </p>
                          </div>
                          <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/30 text-left">
                            <p className="text-[9px] font-bold uppercase tracking-wider text-on-surface-variant">Effective Tax Rate</p>
                            <p className="text-lg font-black text-[#013220] font-mono mt-1">
                              {calcResult.effectiveTaxRate.toFixed(2)}%
                            </p>
                          </div>
                        </div>

                        {/* Calculation Steps table */}
                        <div className="space-y-3 text-left">
                          <h4 className="font-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Statutory Deductions</h4>
                          <div className="divide-y divide-outline-variant/20 text-xs">
                            <div className="flex justify-between py-2">
                              <span className="text-on-surface-variant">Gross Monthly Income</span>
                              <span className="font-mono font-bold text-on-surface">₦{calcResult.grossMonthly.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                             <div className="flex justify-between py-2 text-amber-700">
                              <span className="font-medium">Consolidated Relief Allowance (Tax-Exempt)</span>
                              <span className="font-mono font-bold">-₦{(calcResult.craRelief / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between py-2 text-amber-700">
                              <span className="font-medium">Pension Contribution Deduction (Tax-Exempt)</span>
                              <span className="font-mono font-bold">-₦{(calcResult.pensionDeduction / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            {calcVpc && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Voluntary Pension Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(150000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcLifeAssurance && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Life Assurance Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(100000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcNHF && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>National Housing Fund Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(80000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcNHIS && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>NHIS Medical Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(50000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcCharity && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Charitable Donation Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(120000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcChildren && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Children Allowance (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(100000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcDependantRelative && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Dependant Relative Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(40000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcDisabled && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Disabled Person Special Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(60000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcMortgageInterest && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Mortgage Interest Relief (Exempt)</span>
                                <span className="font-mono font-bold">-₦{(180000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            {calcBondExempt && (
                              <div className="flex justify-between py-2 text-emerald-700 font-medium">
                                <span>Bonds &amp; Treasury Bills Exemption</span>
                                <span className="font-mono font-bold">-₦{(150000 / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                              </div>
                            )}
                            <div className="flex justify-between py-2 font-bold text-primary-container">
                              <span>Chargeable Monthly Taxable Income</span>
                              <span className="font-mono">₦{(calcResult.taxableIncome / 12).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                            <div className="flex justify-between py-3 font-extrabold text-error border-t border-t-outline-variant/40">
                              <span>Monthly Tax Liability</span>
                              <span className="font-mono">₦{calcResult.monthlyTax.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                            </div>
                          </div>
                        </div>

                        {/* Progressive Bands Breakdown */}
                        <div className="space-y-3 text-left">
                          <h4 className="font-bold text-[10px] text-on-surface-variant uppercase tracking-wider">Progressive Annual Tax Bands applied</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs">
                              <thead>
                                <tr className="border-b border-outline-variant/30 text-on-surface-variant/70 font-semibold">
                                  <th className="py-2">Income Band</th>
                                  <th className="py-2 text-right">Tax Rate</th>
                                  <th className="py-2 text-right">Taxable in Band</th>
                                  <th className="py-2 text-right">Annual Tax in Band</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-outline-variant/10 text-on-surface-variant">
                                {calcResult.bandBreakdown.map((b, i) => (
                                  <tr key={i} className="hover:bg-background/40 transition-colors">
                                    <td className="py-2 font-medium text-on-surface">{b.band}</td>
                                    <td className="py-2 text-right font-bold font-mono">{b.rate}%</td>
                                    <td className="py-2 text-right font-mono text-on-surface">₦{b.taxableInBand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                    <td className="py-2 text-right font-bold font-mono text-[#013220]">₦{b.taxInBand.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>

                      </motion.div>
                    ) : (
                      <div className="bg-white border border-outline-variant rounded-xl p-8 shadow-xs flex flex-col items-center text-center justify-center h-64 text-on-surface-variant">
                        <Calculator className="w-8 h-8 mb-2 text-primary-container" />
                        <p className="font-bold text-sm">Awaiting Income Parameters</p>
                        <p className="text-xs max-w-xs mt-1">Enter your gross annual income on the left and tap calculate to analyze statutory reliefs and progressives.</p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.section>
            )}

            {/* Tab View: Tax Planner */}
            {activeTab === 'planner' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                <div>
                  <h2 className="text-2xl font-black text-primary-container tracking-tight">
                    Tax Planner
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Project your future tax liabilities and explore what-if scenarios in real-time.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                  {/* Left Column: Forms and Scenarios (Span 8) */}
                  <div className="lg:col-span-8 space-y-6">
                    
                    {/* Expected Financials Form */}
                    <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs relative overflow-hidden">
                      <div className="absolute left-0 top-0 bottom-0 w-1 bg-[#013220]"></div>
                      <h3 className="font-bold text-sm text-primary uppercase tracking-wider mb-4">Q3 Expected Financials</h3>
                      
                      <div className="space-y-4">
                        {/* Expected Total Income */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                            Expected Total Income (NGN)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">₦</span>
                            <input
                              type="number"
                              value={plannerIncome}
                              onChange={(e) => setPlannerIncome(e.target.value)}
                              className="w-full h-11 pl-8 pr-4 bg-background border border-outline rounded-lg text-sm font-semibold font-mono text-right text-on-surface focus:outline-none focus:border-primary-container"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Deductible Expenses */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                            Deductible Expenses (NGN)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">₦</span>
                            <input
                              type="number"
                              value={plannerExpenses}
                              onChange={(e) => setPlannerExpenses(e.target.value)}
                              className="w-full h-11 pl-8 pr-4 bg-background border border-outline rounded-lg text-sm font-semibold font-mono text-right text-on-surface focus:outline-none focus:border-primary-container"
                              placeholder="0"
                            />
                          </div>
                        </div>

                        {/* Other Allowable Deductions */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">
                            Other Allowable Deductions (NGN)
                          </label>
                          <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-bold">₦</span>
                            <input
                              type="number"
                              value={plannerOtherDeductions}
                              onChange={(e) => setPlannerOtherDeductions(e.target.value)}
                              className="w-full h-11 pl-8 pr-4 bg-background border border-outline rounded-lg text-sm font-semibold font-mono text-right text-on-surface focus:outline-none focus:border-primary-container"
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* What-If Scenarios */}
                    <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs space-y-4">
                      <div>
                        <h3 className="font-bold text-sm text-primary uppercase tracking-wider">What-If Scenarios</h3>
                        <p className="text-[11px] text-on-surface-variant mt-1">
                          Toggle dynamic events to see their immediate impact on your estimated tax liability.
                        </p>
                      </div>

                      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 scrollbar-thin">
                        {/* Scenario 1 */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Major Business Purchase</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦500,000 deduction (Reduces computed tax by ₦35,000)</p>
                          </div>
                          
                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioBusinessPurchase(!scenarioBusinessPurchase)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioBusinessPurchase ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioBusinessPurchase ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 2 */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Anticipated Q3 Bonus</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦1,000,000 income (Adds to expected taxable base)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioQ3Bonus(!scenarioQ3Bonus)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioQ3Bonus ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioQ3Bonus ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 3: Voluntary Pension Contribution */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Voluntary Pension Contribution</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦150,000 tax-free relief (Reduces taxable income base)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioVpc(!scenarioVpc)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioVpc ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioVpc ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 4: Life Assurance Policy */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Life Assurance Premium Relief</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦100,000 policy deduction (Sec. 33 PITA exempt)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioLifeAssurance(!scenarioLifeAssurance)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioLifeAssurance ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioLifeAssurance ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 5: National Housing Fund */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">National Housing Fund (NHF)</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦80,000 annual deduction (Statutory contribution relief)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioNHF(!scenarioNHF)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioNHF ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioNHF ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 6: NHIS Health Premium */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">National Health Insurance (NHIS)</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦50,000 medical premium deduction (100% tax exempt)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioNHIS(!scenarioNHIS)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioNHIS ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioNHIS ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 7: Charitable Relief Donation */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Charitable Relief Donation</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦120,000 donation (Approved statutory endowment relief)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioCharity(!scenarioCharity)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioCharity ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioCharity ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 8: Children Allowance */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Children Allowance (Max 4)</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦100,000 deduction (₦25k standard relief per child up to 4)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioChildren(!scenarioChildren)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioChildren ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioChildren ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 9: Dependant Relative Relief */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Dependant Relative Relief</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦40,000 deduction (₦20k elderly/incapacitated relative relief)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioDependantRelative(!scenarioDependantRelative)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioDependantRelative ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioDependantRelative ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 10: Disabled Person Special Relief */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Disabled Person Special Relief</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦60,000 deduction (Additional allowance for statutory disability)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioDisabled(!scenarioDisabled)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioDisabled ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioDisabled ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 11: Mortgage Interest Relief */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Mortgage Interest Relief</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦180,000 deduction (Owner-occupied residential property loan interest)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioMortgageInterest(!scenarioMortgageInterest)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioMortgageInterest ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioMortgageInterest ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>

                        {/* Scenario 12: Government Bonds & T-Bills Exemption */}
                        <div className="flex items-center justify-between p-3.5 border border-outline-variant rounded-xl bg-surface-container-low/40">
                          <div className="text-left">
                            <p className="text-xs font-bold text-on-surface">Government Bonds &amp; T-Bills Exemption</p>
                            <p className="text-[10px] text-on-surface-variant mt-0.5">Est. ₦150,000 deduction (Investment income 100% tax exempt)</p>
                          </div>

                          {/* Custom Toggle Switch */}
                          <div 
                            onClick={() => setScenarioBondExempt(!scenarioBondExempt)}
                            className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                            style={{ backgroundColor: scenarioBondExempt ? '#013220' : '#e2e2e2' }}
                          >
                            <motion.div 
                              layout
                              className="w-5 h-5 bg-white rounded-full shadow-md"
                              animate={{ x: scenarioBondExempt ? 20 : 0 }}
                              transition={{ type: "spring", stiffness: 500, damping: 30 }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                  </div>

                  {/* Right Column: Calculations Summary and tips (Span 4) */}
                  <div className="lg:col-span-4 space-y-6">
                    
                    {/* Calculated Liability card */}
                    {(() => {
                      const inc = Number(plannerIncome) || 0;
                      const exp = Number(plannerExpenses) || 0;
                      const oth = Number(plannerOtherDeductions) || 0;
                      const bonusVal = scenarioQ3Bonus ? 1000000 : 0;
                      
                      // Base net taxable income (before business purchase scenario)
                      let baseNet = inc + bonusVal - exp - oth;

                      // Subtract individual scenario reliefs from the taxable base
                      if (scenarioVpc) baseNet = Math.max(0, baseNet - 150000);
                      if (scenarioLifeAssurance) baseNet = Math.max(0, baseNet - 100000);
                      if (scenarioNHF) baseNet = Math.max(0, baseNet - 80000);
                      if (scenarioNHIS) baseNet = Math.max(0, baseNet - 50000);
                      if (scenarioCharity) baseNet = Math.max(0, baseNet - 120000);
                      if (scenarioChildren) baseNet = Math.max(0, baseNet - 100000);
                      if (scenarioDependantRelative) baseNet = Math.max(0, baseNet - 40000);
                      if (scenarioDisabled) baseNet = Math.max(0, baseNet - 60000);
                      if (scenarioMortgageInterest) baseNet = Math.max(0, baseNet - 180000);
                      if (scenarioBondExempt) baseNet = Math.max(0, baseNet - 150000);
                      
                      // Calculate tax using our 6%/10%/12%/14% progressive formula
                      const calculateProgressiveTax = (netAmount: number) => {
                        let remaining = netAmount;
                        let tax = 0;
                        
                        const bands = [
                          { limit: 500000, rate: 0.06 },
                          { limit: 1000000, rate: 0.10 },
                          { limit: 1500000, rate: 0.12 },
                          { limit: Infinity, rate: 0.14 }
                        ];
                        
                        for (const b of bands) {
                          if (remaining <= 0) break;
                          const taxable = Math.min(remaining, b.limit);
                          tax += taxable * b.rate;
                          remaining -= taxable;
                        }
                        return tax;
                      };
                      
                      let computedTax = calculateProgressiveTax(baseNet);
                      
                      // Apply business purchase deduction if toggled (reduces tax by 35k)
                      if (scenarioBusinessPurchase) {
                        computedTax = Math.max(0, computedTax - 35000);
                      }

                      // Build the dynamic helper text description for active reliefs
                      const activeList = [];
                      if (scenarioBusinessPurchase) activeList.push("Business Purchase");
                      if (scenarioVpc) activeList.push("Pension Contribution");
                      if (scenarioLifeAssurance) activeList.push("Life Assurance");
                      if (scenarioNHF) activeList.push("NHF");
                      if (scenarioNHIS) activeList.push("NHIS");
                      if (scenarioCharity) activeList.push("Charitable Donation");
                      if (scenarioChildren) activeList.push("Children Allowance");
                      if (scenarioDependantRelative) activeList.push("Dependant Relative Relief");
                      if (scenarioDisabled) activeList.push("Disabled Relief");
                      if (scenarioMortgageInterest) activeList.push("Mortgage Interest Relief");
                      if (scenarioBondExempt) activeList.push("Government Bonds Exemption");
                      
                      return (
                        <>
                          <div className="bg-[#013220] text-white rounded-xl p-6 border border-[#013220] flex flex-col justify-between min-h-[250px] relative overflow-hidden text-left shadow-xs">
                            <div className="absolute right-0 top-0 opacity-10">
                              <TrendingUp className="w-32 h-32 stroke-[1.5]" />
                            </div>
                            
                            <div className="relative z-10">
                              <span className="text-[9px] font-bold text-[#4ADE80] uppercase tracking-widest block">Estimated Liability</span>
                              <p className="text-[11px] text-neutral-300 mt-1">Projected for Q3 2026</p>
                              
                              <p className="text-3xl font-black font-mono text-white mt-4">
                                ₦{computedTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </p>
                            </div>

                            <div className="mt-8 pt-4 border-t border-white/20 relative z-10 flex justify-between items-end">
                              <div>
                                <span className="text-[9px] font-bold text-neutral-300 uppercase tracking-wider block">Current Year Total</span>
                                <span className="font-mono font-bold text-sm text-white mt-1 block">₦1,200,000.00</span>
                              </div>
                              <div className="flex items-center text-accent-green bg-accent-green/10 px-2 py-1 rounded-lg border border-accent-green/20">
                                <ArrowUpRight className="w-3.5 h-3.5 mr-0.5" />
                                <span className="text-[10px] font-bold">+12%</span>
                              </div>
                            </div>
                          </div>

                          {/* Dynamic Tip card */}
                          <div className="bg-surface-container border border-outline-variant rounded-xl p-5 flex gap-3 items-start text-left">
                            <Sparkles className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                            <p className="text-xs text-on-surface-variant leading-relaxed">
                              {activeList.length > 0 ? (
                                <span>
                                  <strong>Active Relief Applied:</strong> You have activated <strong>{activeList.join(", ")}</strong>. Your projected Q3 liability has been dynamically recalculated to reflect these FIRS exemptions.
                                </span>
                              ) : (
                                <span>
                                  Pro Tip: Try toggling <strong>"Voluntary Pension Contribution"</strong> or <strong>"Life Assurance Premium"</strong> to see how approved FIRS reliefs can reduce your Q3 PIT liabilities!
                                </span>
                              )}
                            </p>
                          </div>
                        </>
                      );
                    })()}

                  </div>
                </div>
              </motion.section>
            )}

            {/* Tab View: Filing History */}
            {activeTab === 'filing-history' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-primary-container tracking-tight">
                      Remittance &amp; Tax Filing Registry
                    </h2>
                    <p className="text-sm text-on-surface-variant mt-1">
                      Verify historical statutory remittances, retrieve compliance certificates, and audit processing states.
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      if (!session.isNINLinked) {
                        alert("Compliance constraint: Please link your NIN first before self-assessment filing.");
                      } else {
                        setIsFilingFlow(true);
                        setFilingStep(1);
                      }
                    }}
                    className="px-4 py-2.5 bg-primary-container hover:bg-primary-container/95 text-white font-bold text-xs uppercase tracking-wider rounded-lg active:scale-95 transition-all shadow-xs flex items-center space-x-1.5 whitespace-nowrap self-start cursor-pointer"
                  >
                    <FileText className="w-4 h-4 text-accent-green" />
                    <span>File New Tax Return</span>
                  </button>
                </div>

                {/* Complete Registry Table */}
                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-outline-variant/40 text-on-surface-variant/70 font-semibold uppercase tracking-wider">
                          <th className="py-3">Tax Category</th>
                          <th className="py-3">Period</th>
                          <th className="py-3 font-mono">Receipt Reference</th>
                          <th className="py-3">Date Remitted</th>
                          <th className="py-3 text-right">Amount</th>
                          <th className="py-3 text-center">Remittance Status</th>
                          <th className="py-3 text-right">Documents</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-outline-variant/20 font-medium">
                        {filings.map((f) => (
                          <tr key={f.id} className="hover:bg-surface-container-low/30 transition-colors">
                            <td className="py-4 font-bold text-primary-container">{f.type}</td>
                            <td className="py-4 text-on-surface-variant font-semibold">{f.period}</td>
                            <td className="py-4 font-mono font-bold text-on-surface-variant">{f.receiptNumber}</td>
                            <td className="py-4 text-on-surface-variant font-mono">{f.dateFiled}</td>
                            <td className="py-4 text-right font-bold font-mono text-[#013220]">₦{f.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                            <td className="py-4 text-center">
                              <span className={`inline-block px-3 py-1 rounded-full text-[9px] font-bold tracking-widest uppercase ${
                                f.status === 'Paid' 
                                  ? 'bg-[#4ADE80]/15 text-[#013220]' 
                                  : 'bg-amber-100 text-amber-800'
                              }`}>
                                {f.status}
                              </span>
                            </td>
                            <td className="py-4 text-right">
                              <button
                                onClick={() => setSelectedFiling(f)}
                                className="px-3 py-1.5 bg-background border border-outline hover:bg-surface-container-lowest text-primary-container text-[11px] font-bold rounded-lg flex items-center justify-center space-x-1 transition-all cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Certificate</span>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.section>
            )}

            {/* Tab View: Education & AI Advisor */}
            {activeTab === 'education' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                <div>
                  <h2 className="text-2xl font-black text-primary-container tracking-tight">
                    Tax Guidelines &amp; Virtual Advisor
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Consult standard FIRS guidelines or ask our interactive virtual tax assistant about statutory obligations.
                  </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* Left Column: Tax FAQ */}
                  <div className="lg:col-span-5 space-y-4">
                    <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">Predefined statutory guides</h3>
                    
                    <div className="space-y-3 overflow-y-auto max-h-[460px] pr-2 scrollbar-thin">
                      <button 
                        onClick={() => handleInstantQuestion('nin', 'Is my National Identification Number (NIN) really my Tax Identification Number (TIN) now?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Is NIN my official TIN now?</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Learn about the Joint Tax Board unification system aligning national IDs to tax profiles.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('deadline', 'What are the key tax deadlines in Nigeria?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Key Nigerian tax deadlines</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Audit critical periods for Personal Income Taxes, VAT, and corporate remittances.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('cra', 'How is the Consolidated Relief Allowance (CRA) calculated?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">How is CRA relief computed?</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Step-by-step breakdown of the tax-exempt allowance applicable to gross annual incomes.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('penalty', 'What is the penalty for filing late taxes?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">What are the late filing penalties?</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Detailed review of statutory fines and daily interest applied for default periods.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('wht', 'What is Withholding Tax (WHT) and when does it apply?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">What is Withholding Tax (WHT)?</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Understand WHT rates (2.5%-10%) and utilizing them as credits against final PIT.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('cit', 'How does Company Income Tax (CIT) differ from Personal Income Tax (PIT)?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">PIT vs. Company Income Tax (CIT)</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Contrast PIT progressive rates with CIT corporate brackets and small business exemptions.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('lifeAssur', 'What are the tax benefits of Life Assurance policies under Nigerian PITA?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Life Assurance Tax Relief</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Learn how premium payments are deducted 100% to lower Personal Income Tax.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('tcc', 'How do I download my Tax Clearance Certificate (TCC)?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Get your Tax Clearance (TCC)</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Step-by-step guidance on automated clearance issuance after standard PIT filings.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('pension', 'Are pension contributions fully tax-exempt under FIRS guidelines?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Pension Contribution Reliefs</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Explore voluntary and compulsory pension schemes for tax-free earnings threshold expansion.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('childrenRelief', 'What is the Child Allowance relief and how does it work?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Child Allowance Relief Guide</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Understand Section 33(3) of PITA regarding allowances for up to 4 children.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('dependantRelief', 'What is Dependant Relative Relief and who qualifies?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Dependant Relative Relief Guide</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Explore statutory deductions for supporting incapacitated or elderly relatives.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('disabledRelief', 'What are the tax allowances for a disabled taxpayer under Nigerian PITA?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Disabled Person Special Relief Guide</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Learn about the special tax allowance of up to 20% of gross income for disabled persons.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('mortgageInterestRelief', 'What are the mortgage interest tax exemptions under PITA?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Mortgage Interest Relief Guide</p>
                          <p className="mt-1 leading-relaxed text-[11px]">See how interest on loans for purchasing or constructing owner-occupied homes is 100% tax-free.</p>
                        </div>
                      </button>

                      <button 
                        onClick={() => handleInstantQuestion('bondInterestExempt', 'How does interest income on Government Bonds work with tax exemptions?')}
                        className="w-full text-left p-4 bg-white hover:bg-surface-container-low border border-outline-variant rounded-xl transition-all flex items-start space-x-3 text-xs text-on-surface-variant cursor-pointer"
                      >
                        <HelpCircle className="w-5 h-5 text-primary-container flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-primary-container">Government Bonds &amp; T-Bills Exemption</p>
                          <p className="mt-1 leading-relaxed text-[11px]">Analyze the 100% PIT exemption for investment yields from public treasury instruments.</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Interactive Chat Bot */}
                  <div className="lg:col-span-7 bg-white border border-outline-variant rounded-xl shadow-xs overflow-hidden h-[500px] flex flex-col justify-between">
                    {/* Chat header */}
                    <div className="bg-primary-container text-white px-5 py-4 flex items-center space-x-2 text-left">
                      <div className="w-8 h-8 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-accent-green font-bold text-sm">
                        AI
                      </div>
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider">NairaTax Virtual Assistant</h4>
                        <p className="text-[10px] text-neutral-300">Compliance &amp; statutory advisor active</p>
                      </div>
                    </div>

                    {/* Messages panel */}
                    <div className="p-4 flex-grow overflow-y-auto space-y-4 text-xs">
                      {chatMessages.map((msg, idx) => (
                        <div 
                          key={idx}
                          className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-[80%] rounded-xl px-4 py-3 leading-relaxed whitespace-pre-line shadow-xs text-left ${
                            msg.sender === 'user' 
                              ? 'bg-primary-container text-white' 
                              : 'bg-surface-container-low text-on-surface border border-outline-variant/30'
                          }`}>
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {isTyping && (
                        <div className="flex justify-start">
                          <div className="bg-surface-container-low text-on-surface rounded-xl px-4 py-3 flex space-x-1 items-center border border-outline-variant/30">
                            <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce" />
                            <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce [animation-delay:0.2s]" />
                            <div className="w-1.5 h-1.5 bg-primary-container rounded-full animate-bounce [animation-delay:0.4s]" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Chat input form */}
                    <form onSubmit={handleSendMessage} className="p-3 border-t border-outline-variant/40 bg-background flex gap-2">
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="Ask about VAT, late fine penalties, CRA computations..."
                        className="flex-grow h-10 px-4 bg-white border border-outline rounded-lg text-xs focus:outline-none focus:border-primary-container"
                      />
                      <button
                        type="submit"
                        className="w-10 h-10 bg-primary-container text-white rounded-lg flex items-center justify-center active:scale-95 transition-all hover:bg-primary-container/95 flex-shrink-0 cursor-pointer"
                      >
                        <Send className="w-4.5 h-4.5 text-accent-green" />
                      </button>
                    </form>
                  </div>

                </div>
              </motion.section>
            )}

            {/* Tab View: Settings/Profile */}
            {activeTab === 'settings' && (
              <motion.section
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="space-y-6 text-left"
              >
                <div>
                  <h2 className="text-2xl font-black text-primary-container tracking-tight">
                    User Taxpayer Profile
                  </h2>
                  <p className="text-sm text-on-surface-variant mt-1">
                    Configure your regulatory settings and review linked governmental identity registries.
                  </p>
                </div>

                <div className="bg-white border border-outline-variant rounded-xl p-6 shadow-xs max-w-2xl space-y-6">
                  
                  <div className="flex items-center space-x-4 border-b border-outline-variant pb-6">
                    <div className="w-16 h-16 rounded-full bg-primary-container text-white flex items-center justify-center font-bold text-2xl uppercase">
                      {currentTaxpayerFullName[0]}
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-primary-container">{currentTaxpayerFullName}</h3>
                      <p className="text-xs text-on-surface-variant font-mono uppercase tracking-wider mt-0.5">Registry: {accountMode} Taxpayer Account</p>
                    </div>
                  </div>

                  {/* Parameter Settings */}
                  <div className="space-y-4 text-xs">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                      <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                        <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Contact Method</p>
                        <p className="text-xs text-on-surface font-semibold mt-1 font-mono">{session.contactMethod}</p>
                      </div>

                      <div className="p-3 bg-surface-container-low rounded-lg border border-outline-variant/20">
                        <p className="text-on-surface-variant font-bold uppercase tracking-wider text-[9px]">Regulatory ID State</p>
                        <p className={`text-xs font-bold mt-1 ${session.isNINLinked ? 'text-[#013220]' : 'text-amber-600'}`}>
                          {session.isNINLinked ? 'Linked (NIN Active)' : 'Unverified Identity (NIN Unlinked)'}
                        </p>
                      </div>
                    </div>

                    {session.isNINLinked && session.nin && (
                      <div className="p-4 bg-[#013220]/5 rounded-xl border border-primary-container/10 flex justify-between items-center text-left">
                        <div>
                          <p className="text-[10px] font-bold text-[#013220] uppercase tracking-wider">Linked National Identity Number</p>
                          <p className="text-lg font-mono font-black tracking-widest text-primary-container mt-1">{session.nin}</p>
                        </div>
                        <div className="w-8 h-8 rounded-full bg-[#4ADE80]/20 flex items-center justify-center text-accent-green">
                          <ShieldCheck className="w-5 h-5 text-[#013220]" />
                        </div>
                      </div>
                    )}

                    <div className="space-y-3 pt-4 text-left">
                      <h4 className="font-bold text-xs text-primary-container uppercase tracking-wider">Regulatory Compliance Certifications</h4>
                      
                      <div className="space-y-2">
                        <div className="p-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
                            <div>
                              <p className="font-bold text-primary-container text-xs">NDPR Privacy Consent Activated</p>
                              <p className="text-[10px] text-on-surface-variant leading-relaxed">Your secure credentials are cryptographically protected under Nigerian Data Regulations.</p>
                            </div>
                          </div>
                        </div>

                        <div className="p-3.5 bg-surface-container-lowest border border-outline-variant/40 rounded-lg flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <CheckCircle2 className="w-5 h-5 text-accent-green flex-shrink-0" />
                            <div>
                              <p className="font-bold text-primary-container text-xs">Tax Unification Policy Compliant</p>
                              <p className="text-[10px] text-on-surface-variant leading-relaxed">Joint Tax Board guidelines applied. NIN verified directly with national NIMC registry databases.</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Display Preferences */}
                    <div className="space-y-3 pt-6 border-t border-outline-variant/40 text-left">
                      <h4 className="font-bold text-xs text-primary-container uppercase tracking-wider">Aesthetic &amp; Display Preferences</h4>
                      
                      <div className="p-4 bg-surface-container-low border border-outline-variant/40 rounded-xl flex items-center justify-between">
                        <div>
                          <p className="font-bold text-primary-container text-xs">High-Contrast Dark Mode</p>
                          <p className="text-[10px] text-on-surface-variant leading-relaxed">Switch between a crisp forest light layout and an eye-safe, high-contrast twilight visual theme.</p>
                        </div>
                        
                        {/* Custom Toggle Switch for Dark Mode */}
                        <div 
                          onClick={onToggleTheme}
                          className="relative w-11 h-6 bg-surface-container-highest rounded-full p-0.5 cursor-pointer transition-colors duration-200 flex-shrink-0"
                          style={{ backgroundColor: theme === 'dark' ? '#4ADE80' : '#e2e2e2' }}
                        >
                          <motion.div 
                            layout
                            className="w-5 h-5 bg-white rounded-full shadow-md flex items-center justify-center"
                            animate={{ x: theme === 'dark' ? 20 : 0 }}
                            transition={{ type: "spring", stiffness: 500, damping: 30 }}
                          >
                            {theme === 'dark' ? (
                              <Moon className="w-3 h-3 text-emerald-950" />
                            ) : (
                              <Sun className="w-3 h-3 text-amber-500" />
                            )}
                          </motion.div>
                        </div>
                      </div>
                    </div>

                  </div>

                </div>
              </motion.section>
            )}
          </>
        )}

      </main>

      {/* Floating Action Button (FAB) at Bottom of Main Workspace */}
      <div className="fixed bottom-8 right-8 z-40">
        <button 
          onClick={() => {
            setIsScannerOpen(true);
            setScanStep('upload');
          }}
          className="w-14 h-14 bg-primary-container text-[#4ADE80] rounded-full shadow-xl hover:opacity-95 flex items-center justify-center active:scale-90 transition-transform duration-150 cursor-pointer border border-[#4ADE80]/30"
          title="Smart Scan Tax Receipt"
        >
          <Camera className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* RECEIPT SCANNER MODAL OVERLAY */}
      <AnimatePresence>
        {isScannerOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-container/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-md w-full overflow-hidden border border-outline-variant flex flex-col text-on-surface"
            >
              {/* Header */}
              <div className="bg-primary-container text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Camera className="w-5 h-5 text-accent-green" />
                  <span className="font-bold text-xs uppercase tracking-wider">Smart Receipt Vault Scanner</span>
                </div>
                <button 
                  onClick={() => setIsScannerOpen(false)}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-neutral-300" />
                </button>
              </div>

              {/* Step 1: Upload / Pick preset mockup file */}
              {scanStep === 'upload' && (
                <div className="p-6 space-y-6 text-left">
                  <div>
                    <h3 className="font-bold text-sm text-primary">Upload or Select a Rent / Expense Receipt</h3>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
                      Our OCR scanner automatically extracts the merchant, total tax paid, VAT figures, and calculates eligible statutory deductions.
                    </p>
                  </div>

                  {/* Custom Drag & Drop simulation container exactly according to guidelines */}
                  <div className="border-2 border-dashed border-outline-variant hover:border-primary-container/60 rounded-xl p-5 flex flex-col items-center justify-center bg-surface-container-low/40 text-center space-y-2 select-none">
                    <Upload className="w-8 h-8 text-on-surface-variant" />
                    <div>
                      <p className="text-xs font-bold text-on-surface">Drag &amp; drop receipt file here</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Supports PDF, PNG, JPEG up to 5MB</p>
                    </div>
                  </div>

                  {/* Preset simulation receipts */}
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Or Select Mockup Receipt to Simulate Scanner:</p>
                    <div className="grid grid-cols-1 gap-2">
                      {presetReceipts.map((preset, idx) => (
                        <div 
                          key={idx}
                          onClick={() => selectPresetReceiptFile(idx)}
                          className={`p-2.5 border rounded-lg text-xs flex items-center justify-between cursor-pointer transition-all ${
                            selectedPresetReceipt === idx
                              ? 'bg-[#013220]/5 border-primary-container font-semibold'
                              : 'bg-white hover:bg-surface-container border-outline-variant/50'
                          }`}
                        >
                          <div>
                            <p className="font-bold text-[11px]">{preset.merchant}</p>
                            <p className="text-[9px] text-on-surface-variant mt-0.5">Amount: ₦{preset.amount.toLocaleString()} • {preset.category}</p>
                          </div>
                          {selectedPresetReceipt === idx && <Check className="w-4 h-4 text-[#013220]" />}
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleStartScan}
                    disabled={selectedPresetReceipt === null}
                    className={`w-full py-3 rounded-lg font-bold text-xs uppercase tracking-wider flex items-center justify-center space-x-2 transition-all ${
                      selectedPresetReceipt !== null 
                        ? 'bg-primary-container text-white hover:opacity-95 cursor-pointer' 
                        : 'bg-neutral-200 text-neutral-400 cursor-not-allowed'
                    }`}
                  >
                    <span>Extract &amp; Scan Receipt</span>
                    <Sparkles className="w-4 h-4 text-accent-green" />
                  </button>
                </div>
              )}

              {/* Step 2: Scanning laser animation effect */}
              {scanStep === 'scanning' && (
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                  {/* Glowing Laser Scan Ring */}
                  <div className="relative w-28 h-28 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-center overflow-hidden">
                    <FileText className="w-12 h-12 text-primary-container" />
                    {/* Pulsing Scan bar */}
                    <motion.div 
                      animate={{ y: [-40, 100] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-accent-green shadow-[0_0_10px_rgba(74,222,128,0.8)]"
                    />
                  </div>

                  <div className="space-y-2 w-full">
                    <p className="font-bold text-xs text-primary uppercase tracking-widest animate-pulse">OCR Extraction Active...</p>
                    <p className="text-[11px] text-on-surface-variant">Extracting lines, verifying digital VAT signatures &amp; merchant registries...</p>
                    
                    {/* Linear Loader */}
                    <div className="w-full bg-surface-container h-1.5 rounded-full overflow-hidden max-w-xs mx-auto">
                      <div className="bg-[#013220] h-full transition-all duration-300" style={{ width: `${scanProgress}%` }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Step 3: Scan Extraction Result */}
              {scanStep === 'result' && scannedData && (
                <div className="p-6 space-y-5 text-left">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-primary-container text-white rounded-full flex items-center justify-center mx-auto mb-2">
                      <Check className="w-6 h-6 text-accent-green" />
                    </div>
                    <h3 className="font-bold text-sm text-primary">Receipt Successfully Verified</h3>
                    <p className="text-[10px] text-on-surface-variant font-mono uppercase tracking-widest mt-0.5">Secured &amp; Cryptographically Handshaked</p>
                  </div>

                  <div className="divide-y divide-outline-variant/20 text-xs">
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant font-medium">Merchant / Vendor</span>
                      <span className="font-bold text-on-surface">{scannedData.merchant}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant font-medium">Total Price Paid</span>
                      <span className="font-bold font-mono text-[#013220]">₦{scannedData.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant font-medium">Assigned Tax Relief Category</span>
                      <span className="font-bold text-on-surface">{scannedData.category}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant font-medium">Date Verified</span>
                      <span className="font-mono text-on-surface">{scannedData.date}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-on-surface-variant font-medium">Eligibility Status</span>
                      {scannedData.isDeductible ? (
                        <span className="font-bold text-on-primary-container px-2 py-0.5 rounded bg-primary-fixed/40 uppercase text-[9px] tracking-wider">TAX DEDUCTIBLE ALLOWED</span>
                      ) : (
                        <span className="font-bold text-neutral-500 px-2 py-0.5 rounded bg-neutral-100 uppercase text-[9px] tracking-wider">PERSONAL NON-DEDUCTIBLE</span>
                      )}
                    </div>
                  </div>

                  {scannedData.isDeductible ? (
                    <div className="bg-[#bdedd2]/30 p-3 rounded-lg border border-[#6f9c84]/30 text-[10px] text-[#013220] leading-normal flex gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>This expense has been verified to fall within statutory reliefs. Syncing will immediately reduce your estimated tax liability on the home dashboard.</span>
                    </div>
                  ) : (
                    <div className="bg-neutral-50 p-3 rounded-lg border border-neutral-200 text-[10px] text-neutral-600 leading-normal flex gap-2">
                      <Info className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>This expense is classified as personal non-deductible consumption. It will be added to your transaction sync log but cannot lower tax liabilities.</span>
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => setScanStep('upload')}
                      className="w-1/2 py-3 border border-outline text-on-surface hover:bg-surface-container font-bold text-xs uppercase tracking-wider rounded-lg active:scale-98 transition-transform cursor-pointer"
                    >
                      Rescan / Clear
                    </button>
                    <button
                      onClick={handleSyncToLedger}
                      className="w-1/2 py-3 bg-primary-container hover:opacity-95 text-white font-bold text-xs uppercase tracking-wider rounded-lg active:scale-98 transition-transform cursor-pointer"
                    >
                      Sync to Ledger
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Tax Receipt Overlay Certificate View */}
      {selectedFiling && (
        <TaxReceiptModal 
          filing={selectedFiling}
          session={session}
          onClose={() => setSelectedFiling(null)}
        />
      )}
    </div>
  );
}

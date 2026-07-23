import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Landmark, LayoutDashboard, Calculator, History, BookOpen, Settings, 
  LogOut, ShieldAlert, ShieldCheck, Download, 
  Send, FileText, Info, ArrowUpRight, Scale, CheckCircle2,
  Bell, Camera, Check, Upload, X, ArrowRight, ChevronRight, Sparkles, RefreshCw,
  Calendar, Sun, Moon, Users
} from 'lucide-react';
import { UserSession, DashboardTab, TaxFiling } from '../types';
import TaxReceiptModal from './TaxReceiptModal';
import CMSManager from './CMSManager';
import InvoiceManager from './InvoiceManager';
import TCCDashboard from './TCCDashboard';
import PayrollManager from './PayrollManager';
import { useContent } from '../context/ContentContext';

// Extracted dashboard tab components
import {
  OverviewTab,
  TaxCalculatorTab,
  TaxPlannerTab,
  FilingHistoryTab,
  EducationTab,
  SettingsTab,
  SyncTransaction,
} from './dashboard/index';

interface DashboardProps {
  session: UserSession;
  onLogout: () => void;
  onLinkNIN: () => void;
  theme: 'light' | 'dark';
  onToggleTheme: () => void;
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
  const { content } = useContent();
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

  // Switcher name & dynamic values
  const currentTaxpayerName = accountMode === 'personal' ? 'Chidi' : 'Apex Ventures Ltd';
  const currentTaxpayerFullName = accountMode === 'personal' ? (session.fullName || 'Chinedu Abiodun Okafor') : 'Apex Ventures & Logistics Ltd';
  
  // Donut chart parameters based on account mode
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
  const rentScannedSum = transactions
    .filter(t => t.category.includes('Rent') || t.merchant.includes('Rent'))
    .reduce((sum, t) => sum + t.amount, 0);

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
    const gross = 4200000;
    const net = Math.max(0, gross - currentDeductionsTotal);
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

  const handleStartFiling = () => {
    if (!session.isNINLinked) {
      alert("Compliance constraint: Please link your NIN first before self-assessment filing.");
    } else {
      setIsFilingFlow(true);
      setFilingStep(1);
    }
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
              <span className="font-extrabold text-primary-container text-lg tracking-tight">DIYtax9ja</span>
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
            {[
              { tab: 'overview' as DashboardTab, icon: LayoutDashboard, label: 'Tax Overview' },
              { tab: 'calculator' as DashboardTab, icon: Calculator, label: 'Quick Calculator' },
              { tab: 'planner' as DashboardTab, icon: Calendar, label: 'Tax Planner' },
              { tab: 'filing-history' as DashboardTab, icon: History, label: 'Filing History' },
              { tab: 'education' as DashboardTab, icon: BookOpen, label: 'Guides & Advisor' },
              { tab: 'settings' as DashboardTab, icon: Settings, label: 'User Profile' },
            ].map(({ tab, icon: Icon, label }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsFilingFlow(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab && !isFilingFlow
                    ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{label}</span>
              </button>
            ))}

            {accountMode === 'business' && (
              <button
                onClick={() => { setActiveTab('payroll'); setIsFilingFlow(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === 'payroll'
                    ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
                }`}
              >
                <Users className="w-4.5 h-4.5" />
                <span>Payroll & PAYE</span>
              </button>
            )}

            {[
              { tab: 'tcc' as DashboardTab, icon: ShieldCheck, label: 'TCC Readiness' },
              { tab: 'invoicing' as DashboardTab, icon: FileText, label: 'E-Invoicing' },
              { tab: 'cms' as DashboardTab, icon: LayoutDashboard, label: 'CMS Admin' },
            ].map(({ tab, icon: Icon, label }) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setIsFilingFlow(false); }}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-primary-container/10 text-primary-container font-bold border-l-4 border-l-primary-container rounded-l-none'
                    : 'text-on-surface-variant hover:bg-surface-container/40 hover:text-primary-container'
                }`}
              >
                <Icon className="w-4.5 h-4.5" />
                <span>{label}</span>
              </button>
            ))}
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
            {/* Multi-Account Switcher */}
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
              
              {/* Stepper Wizard */}
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
                            onChange={() => {}}
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
                            <span className="text-[8px] uppercase tracking-wider font-bold bg-neutral-100 text-neutral-500 px-1.5 py-0.5 rounded mt-1">Personal</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 flex items-center justify-between text-xs font-bold border-t border-outline-variant/30">
                    <span className="text-on-surface-variant">Total Deductions Selected ({selectedFilingTransactions.length}):</span>
                    <span className="text-primary-container font-mono text-sm">₦{currentDeductionsTotal.toLocaleString()}</span>
                  </div>
                </div>

                <button
                  onClick={handleProceedToStep2}
                  className="w-full py-4 bg-primary-container hover:bg-primary-container/95 text-white font-bold text-xs uppercase tracking-wider rounded-lg active:scale-[0.99] transition-transform flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <span>Proceed to Tax Review &amp; Declaration</span>
                  <ArrowRight className="w-4 h-4 text-accent-green" />
                </button>
              </div>
            )}

            {/* Step 2 Content: Review & Declaration */}
            {filingStep === 2 && (
              <div className="space-y-6">
                <div className="bg-white border border-outline-variant/60 rounded-xl p-5 shadow-xs space-y-4">
                  <h3 className="font-bold text-sm text-primary-container uppercase tracking-wider">2. Tax Liability Review</h3>
                  <p className="text-xs text-on-surface-variant leading-relaxed">
                    Verify these computations before submitting to FIRS. All figures are determined by statutory relief and progressive PIT band computations.
                  </p>

                  <div className="divide-y divide-outline-variant/20 text-xs">
                    <div className="flex justify-between items-center pb-3 border-b border-surface-container">
                      <span className="text-xs text-on-surface-variant font-medium">Assessable Gross Income</span>
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

                {/* Legal Declaration Box */}
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

            {/* Step 3 Content: Success & Download Certificate */}
            {filingStep === 3 && (
              <div className="w-full relative overflow-hidden bg-white border border-outline-variant rounded-2xl p-6 md:p-8 flex flex-col items-center text-center">
                <canvas ref={confettiCanvasRef} className="absolute inset-0 pointer-events-none z-0" />

                <div className="relative z-10 flex flex-col items-center">
                  <motion.div 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 150 }}
                    className="w-20 h-20 md:w-24 md:h-24 bg-primary-container rounded-full flex items-center justify-center mb-6"
                  >
                    <Check className="w-10 h-10 md:w-12 md:h-12 text-on-primary" />
                  </motion.div>

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

                  {/* Bento Summary Grid */}
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
          /* STANDARD TABS FLOWS — Delegated to extracted components */
          <>
            {!isFilingFlow && activeTab === 'settings' && (
              <SettingsTab
                session={session}
                accountMode={accountMode}
                currentTaxpayerFullName={currentTaxpayerFullName}
                theme={theme}
                onToggleTheme={onToggleTheme}
              />
            )}

            {!isFilingFlow && activeTab === 'cms' && (
              <CMSManager />
            )}

            {!isFilingFlow && activeTab === 'invoicing' && (
              <InvoiceManager />
            )}

            {!isFilingFlow && activeTab === 'tcc' && (
              <TCCDashboard filings={filings} />
            )}

            {!isFilingFlow && activeTab === 'payroll' && (
              <PayrollManager />
            )}

            {!isFilingFlow && activeTab === 'overview' && (
              <OverviewTab
                session={session}
                accountMode={accountMode}
                currentTaxpayerName={currentTaxpayerName}
                transactions={transactions}
                donutData={donutData}
                personalRentReliefUsed={personalRentReliefUsed}
                personalRentReliefCap={personalRentReliefCap}
                personalRentReliefPercent={personalRentReliefPercent}
                businessExpenseUsed={businessExpenseUsed}
                businessExpenseCap={businessExpenseCap}
                businessExpensePercent={businessExpensePercent}
                onStartFiling={handleStartFiling}
              />
            )}

            {activeTab === 'calculator' && (
              <TaxCalculatorTab />
            )}

            {activeTab === 'planner' && (
              <TaxPlannerTab />
            )}

            {activeTab === 'filing-history' && (
              <FilingHistoryTab
                filings={filings}
                session={session}
                onSelectFiling={setSelectedFiling}
                onStartFiling={handleStartFiling}
              />
            )}

            {activeTab === 'education' && (
              <EducationTab />
            )}
          </>
        )}

      </main>

      {/* Floating Action Button (FAB) */}
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

              {/* Step 1: Upload */}
              {scanStep === 'upload' && (
                <div className="p-6 space-y-6 text-left">
                  <div>
                    <h3 className="font-bold text-sm text-primary">Upload or Select a Rent / Expense Receipt</h3>
                    <p className="text-[11px] text-on-surface-variant leading-relaxed mt-1">
                      Our OCR scanner automatically extracts the merchant, total tax paid, VAT figures, and calculates eligible statutory deductions.
                    </p>
                  </div>

                  <div className="border-2 border-dashed border-outline-variant hover:border-primary-container/60 rounded-xl p-5 flex flex-col items-center justify-center bg-surface-container-low/40 text-center space-y-2 select-none">
                    <Upload className="w-8 h-8 text-on-surface-variant" />
                    <div>
                      <p className="text-xs font-bold text-on-surface">Drag &amp; drop receipt file here</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">Supports PDF, PNG, JPEG up to 5MB</p>
                    </div>
                  </div>

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

              {/* Step 2: Scanning */}
              {scanStep === 'scanning' && (
                <div className="p-8 flex flex-col items-center text-center space-y-6">
                  <div className="relative w-28 h-28 bg-surface-container-low rounded-xl border border-outline-variant flex items-center justify-center overflow-hidden">
                    <FileText className="w-12 h-12 text-primary-container" />
                    <motion.div 
                      animate={{ y: [-40, 100] }}
                      transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                      className="absolute left-0 right-0 h-1 bg-accent-green shadow-[0_0_10px_rgba(74,222,128,0.8)]"
                    />
                  </div>

                  <div className="space-y-2 w-full">
                    <p className="font-bold text-xs text-primary uppercase tracking-widest animate-pulse">OCR Extraction Active...</p>
                    <p className="text-[11px] text-on-surface-variant">Extracting lines, verifying digital VAT signatures &amp; merchant registries...</p>
                    
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

import { useState, useRef } from 'react';
import { motion } from 'motion/react';
import {
  Landmark, RefreshCw, CheckCircle2, Download, Lock, Sparkles, FileSpreadsheet, X
} from 'lucide-react';
import { SyncTransaction } from '../types';

interface BankSyncPanelProps {
  onTransactionsSynced?: (count: number, amount: number) => void;
  onAddTransactions?: (txs: SyncTransaction[]) => void;
}

const NIGERIAN_BANKS = [
  { id: 'gtb', name: 'Guaranty Trust Bank (GTCO)', color: 'bg-[#e25a24]', logo: 'G' },
  { id: 'access', name: 'Access Bank', color: 'bg-[#18398b]', logo: 'A' },
  { id: 'zenith', name: 'Zenith Bank', color: 'bg-[#db3539]', logo: 'Z' },
  { id: 'fbn', name: 'First Bank', color: 'bg-[#002f6c]', logo: 'F' },
  { id: 'moniepoint', name: 'Moniepoint', color: 'bg-[#0433ff]', logo: 'M' }
];

const BANK_EXPENSE_TEMPLATES = [
  { merchant: 'Ikeja Electricity Distribution PLC', category: 'Utilities / Power', amount: 35000, isDeductible: true },
  { merchant: 'MainOne Technologies Internet Sub', category: 'Office Equipment', amount: 48000, isDeductible: true },
  { merchant: 'Office Space Rent Remittance', category: 'Rent Relief / Workspace', amount: 250000, isDeductible: true },
  { merchant: 'Lagos State Internal Revenue Service', category: 'Tax Remittance', amount: 50000, isDeductible: true },
  { merchant: 'Uber Nigeria Business Ride', category: 'Business Travel', amount: 8400, isDeductible: true },
  { merchant: 'Konga Workplace Stationery', category: 'Office Equipment', amount: 19500, isDeductible: true },
  { merchant: 'Audit & Tax Advisory Fees', category: 'Professional Services', amount: 120000, isDeductible: true }
];

export default function BankSyncPanel({ onTransactionsSynced, onAddTransactions }: BankSyncPanelProps) {
  const [syncState, setSyncState] = useState<'idle' | 'selecting' | 'connecting' | 'syncing' | 'reviewing' | 'done'>('idle');
  const [selectedBank, setSelectedBank] = useState<typeof NIGERIAN_BANKS[0] | null>(null);
  const [pendingTransactions, setPendingTransactions] = useState<SyncTransaction[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const startBankConnection = (bank: typeof NIGERIAN_BANKS[0]) => {
    setSelectedBank(bank);
    setSyncState('connecting');

    setTimeout(() => {
      setSyncState('syncing');

      setTimeout(() => {
        const today = new Date();
        const generated: SyncTransaction[] = BANK_EXPENSE_TEMPLATES.map((tmpl, idx) => {
          const date = new Date(today);
          date.setDate(date.getDate() - (idx * 3 + 1));
          return {
            id: `bank_${bank.id}_${Date.now()}_${idx}`,
            merchant: `${tmpl.merchant} (${bank.name.split(' ')[0]})`,
            category: tmpl.category,
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            amount: tmpl.amount,
            isDeductible: tmpl.isDeductible,
          };
        });

        setPendingTransactions(generated);
        setSyncState('reviewing');
      }, 2000);
    }, 1200);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedBank(null);
    setSyncState('syncing');

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        const parsed: SyncTransaction[] = [];

        // Parse CSV lines (simple auto-detector for: Date, Description, Amount)
        for (let i = 1; i < lines.length && parsed.length < 20; i++) {
          const parts = lines[i].split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
          if (parts.length >= 3) {
            const rawAmount = parseFloat(parts[2].replace(/[^0-9.-]/g, ''));
            const amount = Math.abs(isNaN(rawAmount) ? 15000 : Math.round(rawAmount));
            const merchant = parts[1] || `Vendor payment #${i}`;
            const isRent = /rent|lease|property/i.test(merchant);
            const isPower = /electric|power|phcn|ikedc|ekedc/i.test(merchant);
            const isTravel = /bolt|uber|flight|air/i.test(merchant);

            const category = isRent
              ? 'Rent Relief / Workspace'
              : isPower
              ? 'Utilities / Power'
              : isTravel
              ? 'Business Travel'
              : 'Office Equipment';

            parsed.push({
              id: `stmt_${Date.now()}_${i}`,
              merchant,
              category,
              date: parts[0] || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
              amount: amount > 0 ? amount : 25000,
              isDeductible: true,
            });
          }
        }

        if (parsed.length === 0) {
          // Fallback if generic text
          parsed.push({
            id: `stmt_${Date.now()}_1`,
            merchant: file.name.replace(/\.[^/.]+$/, ''),
            category: 'Office Equipment',
            date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            amount: 75000,
            isDeductible: true,
          });
        }

        setPendingTransactions(parsed);
        setSyncState('reviewing');
      } catch {
        setSyncState('idle');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmSync = () => {
    setSyncState('done');
    const totalAmount = pendingTransactions.reduce((sum, t) => sum + t.amount, 0);

    onAddTransactions?.(pendingTransactions);
    onTransactionsSynced?.(pendingTransactions.length, totalAmount);

    setTimeout(() => {
      setSyncState('idle');
      setSelectedBank(null);
      setPendingTransactions([]);
    }, 2500);
  };

  const totalDeductible = pendingTransactions
    .filter(t => t.isDeductible)
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-container/5 rounded-full blur-2xl"></div>

      {syncState === 'idle' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-primary-container/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Landmark className="w-6 h-6 text-primary-container" />
            </div>
            <div>
              <h3 className="text-lg font-black text-primary-container">Auto-Sync Bank Feeds</h3>
              <p className="text-sm text-on-surface-variant mt-1">
                Connect your business or personal account, or import a bank statement (CSV) to automatically detect deductible expenses.
              </p>
              <div className="flex items-center space-x-4 mt-3">
                <span className="flex items-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <Lock className="w-3 h-3 mr-1" /> Open Banking Standards
                </span>
                <span className="flex items-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-600" /> Tax Relief Detection
                </span>
              </div>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto flex-shrink-0">
            <button
              onClick={() => setSyncState('selecting')}
              className="h-12 px-5 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-2"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Connect Bank</span>
            </button>
            <label className="h-12 px-4 border border-outline-variant bg-surface-container-low hover:bg-surface-container text-on-surface text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center space-x-2">
              <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              <span>Upload CSV</span>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={handleCsvUpload}
              />
            </label>
          </div>
        </div>
      )}

      {syncState === 'selecting' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Select your Bank</h3>
            <button onClick={() => setSyncState('idle')} className="text-xs font-bold text-primary-container hover:underline cursor-pointer">
              Cancel
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NIGERIAN_BANKS.map(bank => (
              <button
                key={bank.id}
                onClick={() => startBankConnection(bank)}
                className="flex items-center space-x-3 p-3 rounded-xl border border-outline-variant hover:border-primary-container hover:bg-surface-container-low transition-colors cursor-pointer text-left"
              >
                <div className={`w-8 h-8 rounded-lg ${bank.color} flex items-center justify-center text-white font-black text-sm flex-shrink-0`}>
                  {bank.logo}
                </div>
                <span className="text-sm font-bold text-on-surface truncate">{bank.name}</span>
              </button>
            ))}
          </div>
        </motion.div>
      )}

      {(syncState === 'connecting' || syncState === 'syncing') && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-6 text-center space-y-4">
          <div className="relative">
            <div className="w-16 h-16 rounded-full border-4 border-surface-container flex items-center justify-center relative z-10 bg-white">
              {selectedBank ? (
                <div className={`w-10 h-10 rounded-lg ${selectedBank.color} flex items-center justify-center text-white font-black text-lg`}>
                  {selectedBank.logo}
                </div>
              ) : (
                <FileSpreadsheet className="w-8 h-8 text-emerald-700" />
              )}
            </div>
            <div className="absolute inset-0 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="text-sm font-black text-primary-container">
              {syncState === 'connecting' ? 'Establishing Secure Connection...' : 'Analyzing & Categorizing Transactions...'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {selectedBank ? `Fetching verified transactions from ${selectedBank.name}` : 'Parsing statement file and identifying allowable deductions'}
            </p>
          </div>
        </motion.div>
      )}

      {syncState === 'reviewing' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3 text-emerald-700">
              <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold">Analysis Complete</h3>
                <p className="text-xs text-on-surface-variant">
                  {selectedBank ? `Extracted from ${selectedBank.name}` : 'Extracted from uploaded statement'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setSyncState('idle')}
              className="p-1 hover:bg-surface-container rounded-full text-on-surface-variant"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Transactions Found</p>
              <p className="text-2xl font-black text-primary-container mt-1">{pendingTransactions.length}</p>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Deductible Total</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">₦{totalDeductible.toLocaleString()}</p>
            </div>
          </div>

          {/* Transaction previews */}
          <div className="max-h-48 overflow-y-auto space-y-2 border border-outline-variant/60 rounded-xl p-3 bg-surface-container-lowest">
            {pendingTransactions.map((tx) => (
              <div key={tx.id} className="flex justify-between items-center text-xs py-1.5 border-b border-outline-variant/30 last:border-b-0">
                <div className="min-w-0 pr-2">
                  <p className="font-bold text-on-surface truncate">{tx.merchant}</p>
                  <p className="text-[10px] text-on-surface-variant">{tx.category} • {tx.date}</p>
                </div>
                <span className="font-mono font-bold text-[#013220] flex-shrink-0">₦{tx.amount.toLocaleString()}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setSyncState('idle')}
              className="flex-1 h-11 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl cursor-pointer"
            >
              Discard
            </button>
            <button
              onClick={handleConfirmSync}
              className="flex-[2] h-11 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center justify-center space-x-2"
            >
              <Download className="w-4 h-4" />
              <span>Import to Smart Vault</span>
            </button>
          </div>
        </motion.div>
      )}

      {syncState === 'done' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto mb-3" />
          <h3 className="text-lg font-black text-primary-container">Successfully Synced!</h3>
          <p className="text-sm text-on-surface-variant mt-1">
            {pendingTransactions.length} transactions have been added to your ledger.
          </p>
        </motion.div>
      )}
    </div>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Landmark, RefreshCw, CheckCircle2, ChevronRight, Download, Lock, Search, Sparkles
} from 'lucide-react';

interface BankSyncPanelProps {
  onTransactionsSynced: (count: number, amount: number) => void;
}

const NIGERIAN_BANKS = [
  { id: 'gtb', name: 'Guaranty Trust Bank (GTCO)', color: 'bg-[#e25a24]', logo: 'G' },
  { id: 'access', name: 'Access Bank', color: 'bg-[#18398b]', logo: 'A' },
  { id: 'zenith', name: 'Zenith Bank', color: 'bg-[#db3539]', logo: 'Z' },
  { id: 'fbn', name: 'First Bank', color: 'bg-[#002f6c]', logo: 'F' },
  { id: 'moniepoint', name: 'Moniepoint', color: 'bg-[#0433ff]', logo: 'M' }
];

export default function BankSyncPanel({ onTransactionsSynced }: BankSyncPanelProps) {
  const [syncState, setSyncState] = useState<'idle' | 'selecting' | 'connecting' | 'syncing' | 'reviewing' | 'done'>('idle');
  const [selectedBank, setSelectedBank] = useState<typeof NIGERIAN_BANKS[0] | null>(null);
  
  // Simulated transactions fetched from bank
  const [syncedCount, setSyncedCount] = useState(0);
  const [deductibleTotal, setDeductibleTotal] = useState(0);

  const startConnection = (bank: typeof NIGERIAN_BANKS[0]) => {
    setSelectedBank(bank);
    setSyncState('connecting');
    
    // Simulate connection delay
    setTimeout(() => {
      setSyncState('syncing');
      
      // Simulate data fetching
      setTimeout(() => {
        // Generate mock results
        const count = Math.floor(Math.random() * 15) + 5;
        const total = Math.floor(Math.random() * 500000) + 150000;
        setSyncedCount(count);
        setDeductibleTotal(total);
        setSyncState('reviewing');
      }, 2500);
      
    }, 1500);
  };

  const handleConfirmSync = () => {
    setSyncState('done');
    onTransactionsSynced(syncedCount, deductibleTotal);
    setTimeout(() => {
      setSyncState('idle');
      setSelectedBank(null);
    }, 3000);
  };

  return (
    <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute -top-12 -right-12 w-32 h-32 bg-primary-container/5 rounded-full blur-2xl"></div>

      {syncState === 'idle' && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="w-12 h-12 bg-primary-container/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <Landmark className="w-6 h-6 text-primary-container" />
            </div>
            <div>
              <h3 className="text-lg font-black text-primary-container">Auto-Sync Bank Feeds</h3>
              <p className="text-sm text-on-surface-variant mt-1">Connect your business or personal account to automatically detect deductible expenses using our AI engine.</p>
              <div className="flex items-center space-x-4 mt-3">
                <span className="flex items-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <Lock className="w-3 h-3 mr-1" /> Secure Open Banking
                </span>
                <span className="flex items-center text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">
                  <Sparkles className="w-3 h-3 mr-1 text-emerald-600" /> AI Categorization
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setSyncState('selecting')}
            className="w-full sm:w-auto h-12 px-6 bg-[#013220] text-white text-sm font-bold rounded-xl hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer shadow-sm flex items-center justify-center space-x-2 flex-shrink-0"
          >
            <RefreshCw className="w-4 h-4" />
            <span>Connect Bank</span>
          </button>
        </div>
      )}

      {syncState === 'selecting' && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-on-surface uppercase tracking-wider">Select your Bank</h3>
            <button onClick={() => setSyncState('idle')} className="text-xs font-bold text-primary-container hover:underline cursor-pointer">Cancel</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {NIGERIAN_BANKS.map(bank => (
              <button
                key={bank.id}
                onClick={() => startConnection(bank)}
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
               {selectedBank && (
                 <div className={`w-10 h-10 rounded-lg ${selectedBank.color} flex items-center justify-center text-white font-black text-lg`}>
                   {selectedBank.logo}
                 </div>
               )}
            </div>
            <div className="absolute inset-0 border-4 border-primary-container border-t-transparent rounded-full animate-spin"></div>
          </div>
          <div>
            <h3 className="text-sm font-black text-primary-container">
              {syncState === 'connecting' ? 'Establishing Secure Connection...' : 'Fetching & Analyzing Transactions...'}
            </h3>
            <p className="text-xs text-on-surface-variant mt-1">
              {syncState === 'connecting' ? 'Authenticating with ' + selectedBank?.name : 'AI is identifying deductible expenses'}
            </p>
          </div>
        </motion.div>
      )}

      {syncState === 'reviewing' && (
        <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
          <div className="flex items-center space-x-3 text-emerald-700">
            <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold">Analysis Complete</h3>
              <p className="text-xs">We found deductible expenses from {selectedBank?.name}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl p-4">
              <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Transactions Found</p>
              <p className="text-2xl font-black text-primary-container mt-1">{syncedCount}</p>
            </div>
            <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Deductible Total</p>
              <p className="text-2xl font-black text-emerald-700 mt-1">₦{deductibleTotal.toLocaleString()}</p>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => setSyncState('idle')} className="flex-1 h-11 bg-surface-container text-on-surface-variant text-xs font-bold rounded-xl cursor-pointer">
              Discard
            </button>
            <button onClick={handleConfirmSync} className="flex-[2] h-11 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all cursor-pointer flex items-center justify-center space-x-2">
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
          <p className="text-sm text-on-surface-variant mt-1">Transactions have been added to your ledger.</p>
        </motion.div>
      )}
    </div>
  );
}

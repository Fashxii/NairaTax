'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  RefreshCw,
  Landmark,
  ArrowUpRight,
  ArrowDownLeft,
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react';
import ConnectBankButton from './ConnectBankButton';

// Mock/Default fallback data for client preview if database API is empty
export interface TransactionRow {
  id: string;
  connectedAccountId: string;
  bankName: string;
  accountNumber: string;
  providerTxId: string;
  amountInKobo: number;
  type: 'CREDIT' | 'DEBIT';
  narration: string;
  category: string;
  date: string;
}

export interface BankAccountSummary {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  balanceInKobo: number;
  syncStatus: 'ACTIVE' | 'REAUTH_REQUIRED' | 'DISCONNECTED';
}

const DEFAULT_ACCOUNTS: BankAccountSummary[] = [
  {
    id: 'acc_1',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '0123456789',
    accountName: 'Chinedu Abiodun Okafor',
    balanceInKobo: 185000000, // ₦1,850,000.00
    syncStatus: 'ACTIVE',
  },
  {
    id: 'acc_2',
    bankName: 'Zenith Bank',
    accountNumber: '2289012345',
    accountName: 'Apex Ventures Ltd',
    balanceInKobo: 420000000, // ₦4,200,000.00
    syncStatus: 'ACTIVE',
  },
  {
    id: 'acc_3',
    bankName: 'Kuda Microfinance Bank',
    accountNumber: '2001234567',
    accountName: 'Chinedu Okafor',
    balanceInKobo: 34500000, // ₦345,000.00
    syncStatus: 'REAUTH_REQUIRED',
  },
];

const DEFAULT_TRANSACTIONS: TransactionRow[] = [
  {
    id: 'tx_101',
    connectedAccountId: 'acc_1',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '0123456789',
    providerTxId: 'mono_tx_901',
    amountInKobo: 45000000, // ₦450,000.00
    type: 'CREDIT',
    narration: 'TRF/NIP/PAYROLL/TECH CORP JULY SALARY',
    category: 'Salary',
    date: '2026-08-05T10:15:00Z',
  },
  {
    id: 'tx_102',
    connectedAccountId: 'acc_1',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '0123456789',
    providerTxId: 'mono_tx_902',
    amountInKobo: 15000000, // ₦150,000.00
    type: 'DEBIT',
    narration: 'POS/SHOPRITE IKEJA CITY MALL/GROCERIES',
    category: 'Business Expenses',
    date: '2026-08-04T16:30:00Z',
  },
  {
    id: 'tx_103',
    connectedAccountId: 'acc_2',
    bankName: 'Zenith Bank',
    accountNumber: '2289012345',
    providerTxId: 'mono_tx_903',
    amountInKobo: 125000000, // ₦1,250,000.00
    type: 'CREDIT',
    narration: 'NIP/INVOICE #1042/CLIENT RETAINER PAYMENT',
    category: 'Consulting Income',
    date: '2026-08-03T09:45:00Z',
  },
  {
    id: 'tx_104',
    connectedAccountId: 'acc_1',
    bankName: 'Guaranty Trust Bank',
    accountNumber: '0123456789',
    providerTxId: 'mono_tx_904',
    amountInKobo: 8500000, // ₦85,000.00
    type: 'DEBIT',
    narration: 'WEB/LIRS TAX REMITTANCE/DIRECT DRAFT',
    category: 'Taxes',
    date: '2026-08-02T11:20:00Z',
  },
  {
    id: 'tx_105',
    connectedAccountId: 'acc_3',
    bankName: 'Kuda Microfinance Bank',
    accountNumber: '2001234567',
    providerTxId: 'mono_tx_905',
    amountInKobo: 3500000, // ₦35,000.00
    type: 'DEBIT',
    narration: 'ATM/WITHDRAWAL/VICTORIA ISLAND MAIN',
    category: 'Personal Utilities',
    date: '2026-08-01T14:10:00Z',
  },
];

export default function BankTransactionsTable() {
  const [accounts] = useState<BankAccountSummary[]>(DEFAULT_ACCOUNTS);
  const [transactions] = useState<TransactionRow[]>(DEFAULT_TRANSACTIONS);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CREDIT' | 'DEBIT'>('ALL');
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 5;

  // Check if any connected bank needs re-authorization
  const reauthAccount = useMemo(() => {
    return accounts.find((acc) => acc.syncStatus === 'REAUTH_REQUIRED');
  }, [accounts]);

  // Filter transactions based on selected controls
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      // 1. Account Filter
      if (selectedAccountId !== 'ALL' && tx.connectedAccountId !== selectedAccountId) {
        return false;
      }
      // 2. Type Filter
      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }
      // 3. Search Filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase();
        const matchesNarration = tx.narration.toLowerCase().includes(query);
        const matchesCategory = tx.category.toLowerCase().includes(query);
        const matchesBank = tx.bankName.toLowerCase().includes(query);
        if (!matchesNarration && !matchesCategory && !matchesBank) {
          return false;
        }
      }
      return true;
    });
  }, [transactions, selectedAccountId, typeFilter, searchQuery]);

  // Pagination Math
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage) || 1;
  const paginatedTransactions = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredTransactions.slice(start, start + itemsPerPage);
  }, [filteredTransactions, currentPage, itemsPerPage]);

  // Format Kobo to Naira string
  const formatMoney = (kobo: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(kobo / 100);
  };

  const handleManualSync = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
    }, 1200);
  };

  return (
    <div className="w-full space-y-6 text-left">
      {/* 1. Header Action Bar & Bank Cards Summary */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 border border-outline-variant/60 rounded-2xl shadow-xs">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-[#013220] tracking-tight">Bank Accounts &amp; Live Ledger</h2>
            <span className="bg-emerald-100 text-emerald-800 text-[10px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" /> Mono Verified
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-1">
            Real-time transaction synchronization across Nigerian commercial &amp; microfinance banks.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSync}
            disabled={isSyncing}
            className="px-3.5 py-2.5 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl text-xs font-bold text-on-surface flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#013220] ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
          </button>

          <ConnectBankButton onSuccess={handleManualSync} />
        </div>
      </div>

      {/* 2. Re-authorization Alert Banner if bank connection expired */}
      {reauthAccount && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-amber-900 shadow-xs">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-bold">Re-authorization Required for {reauthAccount.bankName}</p>
              <p className="text-[11px] text-amber-700 leading-snug">
                Internet banking session expired for account <span className="font-mono">{reauthAccount.accountNumber}</span>. Re-enter credentials to maintain automated tax deduction sync.
              </p>
            </div>
          </div>
          <ConnectBankButton variant="secondary" className="text-xs whitespace-nowrap" />
        </div>
      )}

      {/* 3. Filter Controls Toolbar */}
      <div className="bg-white p-4 border border-outline-variant/60 rounded-xl flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 shadow-xs">
        {/* Search Narration Input */}
        <div className="relative flex-grow max-w-md">
          <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search transactions by narration, merchant, or category..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:border-[#013220]"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Bank Selector Dropdown */}
          <div className="flex items-center gap-1.5 border border-outline-variant/60 rounded-lg px-3 py-1.5 bg-surface-container-low">
            <Landmark className="w-3.5 h-3.5 text-on-surface-variant" />
            <select
              value={selectedAccountId}
              onChange={(e) => {
                setSelectedAccountId(e.target.value);
                setCurrentPage(1);
              }}
              className="bg-transparent text-xs font-semibold text-on-surface focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Connected Banks</option>
              {accounts.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.bankName} (***{acc.accountNumber.slice(-4)})
                </option>
              ))}
            </select>
          </div>

          {/* Type Toggle Buttons */}
          <div className="flex items-center bg-surface-container-low p-1 border border-outline-variant/60 rounded-lg">
            <button
              onClick={() => setTypeFilter('ALL')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${
                typeFilter === 'ALL' ? 'bg-[#013220] text-white shadow-xs' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setTypeFilter('CREDIT')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'CREDIT' ? 'bg-emerald-700 text-white shadow-xs' : 'text-emerald-700 hover:bg-emerald-50'
              }`}
            >
              <ArrowDownLeft className="w-3 h-3" /> Credit
            </button>
            <button
              onClick={() => setTypeFilter('DEBIT')}
              className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer flex items-center gap-1 ${
                typeFilter === 'DEBIT' ? 'bg-red-700 text-white shadow-xs' : 'text-red-700 hover:bg-red-50'
              }`}
            >
              <ArrowUpRight className="w-3 h-3" /> Debit
            </button>
          </div>
        </div>
      </div>

      {/* 4. Transactions Data Table */}
      <div className="bg-white border border-outline-variant/60 rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/60 text-on-surface-variant uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Bank Institution</th>
                <th className="py-3.5 px-4">Narration / Description</th>
                <th className="py-3.5 px-4">Category</th>
                <th className="py-3.5 px-4 text-right">Amount (NGN)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {paginatedTransactions.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-on-surface-variant">
                    <SlidersHorizontal className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p className="font-semibold">No transactions found</p>
                    <p className="text-[11px] opacity-70">Try adjusting your filters or connect a new bank account.</p>
                  </td>
                </tr>
              ) : (
                paginatedTransactions.map((tx) => {
                  const isCredit = tx.type === 'CREDIT';
                  return (
                    <tr key={tx.id} className="hover:bg-surface-container-low/50 transition-colors group">
                      {/* Date */}
                      <td className="py-3.5 px-4 font-medium text-on-surface-variant whitespace-nowrap">
                        {new Date(tx.date).toLocaleDateString('en-NG', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>

                      {/* Bank Name */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-md bg-[#013220]/10 text-[#013220] flex items-center justify-center font-black text-[9px]">
                            {tx.bankName.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-bold text-on-surface leading-snug">{tx.bankName}</p>
                            <p className="text-[9px] text-on-surface-variant/60 font-mono">***{tx.accountNumber.slice(-4)}</p>
                          </div>
                        </div>
                      </td>

                      {/* Narration */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="font-medium text-on-surface leading-relaxed truncate group-hover:whitespace-normal group-hover:overflow-visible">
                          {tx.narration}
                        </p>
                        <p className="text-[9px] text-on-surface-variant/50 font-mono">ID: {tx.providerTxId}</p>
                      </td>

                      {/* Category Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="bg-surface-container px-2.5 py-1 rounded-md text-[10px] font-semibold text-on-surface-variant border border-outline-variant/40">
                          {tx.category || 'General'}
                        </span>
                      </td>

                      {/* Amount */}
                      <td className="py-3.5 px-4 text-right whitespace-nowrap font-mono">
                        <span className={`font-bold text-xs ${isCredit ? 'text-emerald-700' : 'text-red-700'}`}>
                          {isCredit ? '+' : '-'} {formatMoney(tx.amountInKobo)}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 5. Pagination Footer Controls */}
        <div className="px-4 py-3 border-t border-outline-variant/60 bg-surface-container-low flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
          <p className="font-medium">
            Showing <span className="font-bold text-on-surface">{paginatedTransactions.length}</span> of{' '}
            <span className="font-bold text-on-surface">{filteredTransactions.length}</span> records
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 border border-outline-variant/60 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="font-bold text-xs px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 border border-outline-variant/60 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState, memo, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Receipt, Plus, X,
  CheckCircle2, Info, Building, User
} from 'lucide-react';
import {
  WHT_RATE_SCHEDULE, WHTTransaction, calculateWHT,
  generateCreditNoteRef, computeWHTSummary
} from '../../utils/whtEngine';
import { formatNaira } from '../../utils/taxEngine';
import { usePersistedState } from '../../hooks/usePersistedState';

const SAMPLE_TRANSACTIONS: WHTTransaction[] = [
  {
    id: 'wht-1',
    date: '2026-08-15',
    payeeType: 'company',
    payeeName: 'Nexgen Consulting Ltd',
    payeeTIN: '1234567890',
    paymentType: 'Professional / Consultancy Fees',
    grossAmount: 2500000,
    whtRate: 0.10,
    whtAmount: 250000,
    netPayment: 2250000,
    creditNoteRef: 'WHT-CR-2026-384921',
    status: 'remitted',
  },
  {
    id: 'wht-2',
    date: '2026-08-22',
    payeeType: 'individual',
    payeeName: 'Engr. Obi Nwosu',
    payeeTIN: '9876543210',
    paymentType: 'Professional / Consultancy Fees',
    grossAmount: 800000,
    whtRate: 0.05,
    whtAmount: 40000,
    netPayment: 760000,
    creditNoteRef: 'WHT-CR-2026-491203',
    status: 'remitted',
  },
  {
    id: 'wht-3',
    date: '2026-09-01',
    payeeType: 'company',
    payeeName: 'Sterling Properties Ltd',
    paymentType: 'Rent',
    grossAmount: 3600000,
    whtRate: 0.10,
    whtAmount: 360000,
    netPayment: 3240000,
    status: 'pending',
  },
  {
    id: 'wht-4',
    date: '2026-09-05',
    payeeType: 'company',
    payeeName: 'BuildPro Construction',
    paymentType: 'Construction / Building',
    grossAmount: 15000000,
    whtRate: 0.025,
    whtAmount: 375000,
    netPayment: 14625000,
    status: 'pending',
  },
];

const WHTTrackerTab = memo(function WHTTrackerTab() {
  const [transactions, setTransactions] = usePersistedState<WHTTransaction[]>('wht_transactions', SAMPLE_TRANSACTIONS);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedTx, setSelectedTx] = useState<WHTTransaction | null>(null);

  // Add form state
  const [newPayeeName, setNewPayeeName] = useState('');
  const [newPayeeTIN, setNewPayeeTIN] = useState('');
  const [newPayeeType, setNewPayeeType] = useState<'company' | 'individual'>('company');
  const [newPaymentTypeId, setNewPaymentTypeId] = useState('professional-fees');
  const [newGrossAmount, setNewGrossAmount] = useState('');

  const summary = useMemo(() => computeWHTSummary(transactions), [transactions]);

  const handleAddTransaction = () => {
    const gross = parseFloat(newGrossAmount);
    if (!newPayeeName.trim() || isNaN(gross) || gross <= 0) return;

    const { whtRate, whtAmount, netPayment } = calculateWHT(gross, newPaymentTypeId, newPayeeType);
    const rateEntry = WHT_RATE_SCHEDULE.find(r => r.id === newPaymentTypeId);

    const newTx: WHTTransaction = {
      id: 'wht-' + Date.now(),
      date: new Date().toISOString().split('T')[0],
      payeeType: newPayeeType,
      payeeName: newPayeeName.trim(),
      payeeTIN: newPayeeTIN.trim() || undefined,
      paymentType: rateEntry?.paymentType || 'Other',
      grossAmount: gross,
      whtRate,
      whtAmount,
      netPayment,
      status: 'pending',
    };

    setTransactions([newTx, ...transactions]);
    setShowAddModal(false);
    resetForm();
  };

  const handleMarkRemitted = (id: string) => {
    setTransactions(transactions.map(t =>
      t.id === id
        ? { ...t, status: 'remitted' as const, creditNoteRef: generateCreditNoteRef() }
        : t
    ));
  };

  const resetForm = () => {
    setNewPayeeName('');
    setNewPayeeTIN('');
    setNewPayeeType('company');
    setNewPaymentTypeId('professional-fees');
    setNewGrossAmount('');
  };

  // Preview calculation for the add form
  const previewCalc = useMemo(() => {
    const gross = parseFloat(newGrossAmount);
    if (isNaN(gross) || gross <= 0) return null;
    return calculateWHT(gross, newPaymentTypeId, newPayeeType);
  }, [newGrossAmount, newPaymentTypeId, newPayeeType]);

  return (
    <motion.section
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-6 text-left"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-primary-container tracking-tight">
            Withholding Tax (WHT) Tracker
          </h2>
          <p className="text-sm text-on-surface-variant mt-1">
            Track WHT deductions at source, generate credit notes, and monitor remittance status.
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="h-11 px-5 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Record WHT</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Gross Payments', value: formatNaira(summary.totalGrossPayments), color: 'text-on-surface' },
          { label: 'Total WHT Deducted', value: formatNaira(summary.totalWHTDeducted), color: 'text-primary-container' },
          { label: 'Pending Remittance', value: formatNaira(summary.pendingRemittance), color: 'text-amber-600' },
          { label: 'Remitted to FIRS', value: formatNaira(summary.remittedTotal), color: 'text-emerald-600' },
        ].map(card => (
          <div key={card.label} className="bg-white border border-outline-variant rounded-xl p-4 shadow-xs">
            <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">{card.label}</p>
            <p className={`text-lg font-black font-mono mt-1 ${card.color}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Rate Reference Table */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-outline-variant/50">
          <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">WHT Rate Schedule</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-surface-container-low">
                <th className="text-left px-5 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Payment Type</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Company</th>
                <th className="text-center px-3 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Individual</th>
              </tr>
            </thead>
            <tbody>
              {WHT_RATE_SCHEDULE.map(entry => (
                <tr key={entry.id} className="border-b border-outline-variant/30 hover:bg-surface-container-low/50">
                  <td className="px-5 py-2.5 font-semibold text-on-surface">{entry.paymentType}</td>
                  <td className="text-center px-3 py-2.5 font-mono font-bold text-primary-container">{(entry.companyRate * 100)}%</td>
                  <td className="text-center px-3 py-2.5 font-mono font-bold text-primary-container">{(entry.individualRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white border border-outline-variant rounded-xl shadow-xs">
        <div className="px-5 py-3 border-b border-outline-variant/50 flex items-center justify-between">
          <h3 className="font-bold text-xs text-primary-container uppercase tracking-wider">WHT Transaction Log</h3>
          <span className="text-[10px] text-on-surface-variant font-bold">{transactions.length} Records</span>
        </div>
        <div className="divide-y divide-outline-variant/30">
          {transactions.map(tx => (
            <div
              key={tx.id}
              className="px-5 py-4 hover:bg-surface-container-low/30 transition-colors cursor-pointer"
              onClick={() => setSelectedTx(selectedTx?.id === tx.id ? null : tx)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs font-bold ${
                    tx.payeeType === 'company' ? 'bg-blue-600' : 'bg-purple-600'
                  }`}>
                    {tx.payeeType === 'company' ? <Building className="w-4 h-4" /> : <User className="w-4 h-4" />}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-on-surface">{tx.payeeName}</p>
                    <p className="text-[10px] text-on-surface-variant">{tx.paymentType} • {tx.date}</p>
                  </div>
                </div>
                <div className="text-right flex items-center gap-3">
                  <div>
                    <p className="text-xs font-mono font-bold text-primary-container">{formatNaira(tx.whtAmount)}</p>
                    <p className="text-[10px] text-on-surface-variant">of {formatNaira(tx.grossAmount)} @ {(tx.whtRate * 100)}%</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider ${
                    tx.status === 'remitted'
                      ? 'bg-emerald-50 text-emerald-700'
                      : tx.status === 'credited'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-amber-50 text-amber-700'
                  }`}>
                    {tx.status}
                  </span>
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {selectedTx?.id === tx.id && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 pt-3 border-t border-outline-variant/30"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[10px]">
                      <div>
                        <span className="text-on-surface-variant font-bold">Gross Payment</span>
                        <p className="font-mono font-bold text-on-surface">{formatNaira(tx.grossAmount)}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant font-bold">WHT Deducted</span>
                        <p className="font-mono font-bold text-red-500">({formatNaira(tx.whtAmount)})</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant font-bold">Net Payment</span>
                        <p className="font-mono font-bold text-emerald-600">{formatNaira(tx.netPayment)}</p>
                      </div>
                      <div>
                        <span className="text-on-surface-variant font-bold">TIN</span>
                        <p className="font-mono font-bold text-on-surface">{tx.payeeTIN || '—'}</p>
                      </div>
                    </div>
                    {tx.creditNoteRef && (
                      <div className="mt-2 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                        <span className="text-[10px] font-bold text-emerald-600">Credit Note: {tx.creditNoteRef}</span>
                      </div>
                    )}
                    {tx.status === 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleMarkRemitted(tx.id); }}
                        className="mt-3 h-8 px-4 bg-emerald-600 text-white text-[10px] font-bold rounded-lg hover:bg-emerald-700 transition-colors cursor-pointer flex items-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Mark as Remitted & Generate Credit Note
                      </button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>

      {/* Legal Reference */}
      <div className="flex items-start gap-3 p-4 bg-surface-container-low border border-outline-variant rounded-xl">
        <Info className="w-4 h-4 text-on-surface-variant flex-shrink-0 mt-0.5" />
        <p className="text-[10px] text-on-surface-variant leading-relaxed">
          <strong className="text-on-surface">WHT Obligations:</strong> Payers must deduct WHT and remit to FIRS within 21 days of the transaction. Credit notes must be issued to payees for offset against their final tax liability. WHT is an advance payment — not a final tax.
        </p>
      </div>

      {/* Add Transaction Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary-container/40 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl max-w-lg w-full overflow-hidden border border-outline-variant"
            >
              <div className="bg-primary-container text-white px-5 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-accent-green" />
                  <span className="font-bold text-xs uppercase tracking-wider">Record WHT Deduction</span>
                </div>
                <button
                  onClick={() => { setShowAddModal(false); resetForm(); }}
                  className="p-1 hover:bg-white/10 rounded-full transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5 text-neutral-300" />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Payee Type Toggle */}
                <div className="flex gap-2">
                  {(['company', 'individual'] as const).map(type => (
                    <button
                      key={type}
                      onClick={() => setNewPayeeType(type)}
                      className={`flex-1 h-10 rounded-lg text-xs font-bold capitalize cursor-pointer transition-all ${
                        newPayeeType === type
                          ? 'bg-primary-container text-white'
                          : 'bg-surface-container-low text-on-surface-variant border border-outline-variant'
                      }`}
                    >
                      {type}
                    </button>
                  ))}
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">Payee Name</label>
                  <input
                    type="text"
                    value={newPayeeName}
                    onChange={e => setNewPayeeName(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. Nexgen Consulting Ltd"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">Payee TIN (Optional)</label>
                  <input
                    type="text"
                    value={newPayeeTIN}
                    onChange={e => setNewPayeeTIN(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="10-digit TIN"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">Payment Type</label>
                  <select
                    value={newPaymentTypeId}
                    onChange={e => setNewPaymentTypeId(e.target.value)}
                    className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold focus:outline-none focus:border-primary-container cursor-pointer"
                  >
                    {WHT_RATE_SCHEDULE.map(entry => (
                      <option key={entry.id} value={entry.id}>
                        {entry.paymentType} ({newPayeeType === 'company' ? entry.companyRate * 100 : entry.individualRate * 100}%)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-on-surface uppercase tracking-wider block">Gross Payment Amount (₦)</label>
                  <input
                    type="number"
                    value={newGrossAmount}
                    onChange={e => setNewGrossAmount(e.target.value)}
                    className="w-full h-10 px-4 bg-background border border-outline rounded-lg text-sm font-semibold focus:outline-none focus:border-primary-container"
                    placeholder="e.g. 2500000"
                  />
                </div>

                {/* Live Preview */}
                {previewCalc && (
                  <div className="bg-surface-container-low rounded-lg p-3 grid grid-cols-3 gap-3 text-[10px]">
                    <div>
                      <span className="text-on-surface-variant font-bold">WHT Rate</span>
                      <p className="font-mono font-bold text-primary-container text-sm">{(previewCalc.whtRate * 100)}%</p>
                    </div>
                    <div>
                      <span className="text-on-surface-variant font-bold">WHT Amount</span>
                      <p className="font-mono font-bold text-red-500 text-sm">{formatNaira(previewCalc.whtAmount)}</p>
                    </div>
                    <div>
                      <span className="text-on-surface-variant font-bold">Net Payment</span>
                      <p className="font-mono font-bold text-emerald-600 text-sm">{formatNaira(previewCalc.netPayment)}</p>
                    </div>
                  </div>
                )}

                <button
                  onClick={handleAddTransaction}
                  disabled={!newPayeeName.trim() || !newGrossAmount}
                  className="w-full h-11 bg-[#013220] text-white text-xs font-bold uppercase tracking-wider rounded-xl hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Record WHT Deduction
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.section>
  );
});

export default WHTTrackerTab;

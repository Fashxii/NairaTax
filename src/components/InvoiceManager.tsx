import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Plus, FileText, Send, CheckCircle2, Clock, AlertTriangle,
  X, Trash2, ArrowRight, Download, ChevronRight, Sparkles,
  Check, ExternalLink
} from 'lucide-react';
import { Invoice, InvoiceLineItem, InvoiceStatus } from '../types';

const VAT_RATE = 0.075; // 7.5% Nigeria VAT

const SAMPLE_INVOICES: Invoice[] = [
  {
    id: 'inv-001',
    invoiceNumber: 'DIY-2026-0001',
    clientName: 'Dangote Industries Ltd',
    clientEmail: 'accounts@dangote.com',
    issueDate: '2026-06-01',
    dueDate: '2026-07-01',
    lineItems: [
      { id: 'li1', description: 'IT Consulting Services — June 2026', quantity: 1, unitPrice: 850000 },
      { id: 'li2', description: 'Cloud Infrastructure Setup', quantity: 1, unitPrice: 420000 },
    ],
    subtotal: 1270000,
    vatAmount: 95250,
    total: 1365250,
    status: 'Paid',
    vatRemitted: true,
    vatRemittanceRef: 'NRS-VAT-20260712-4821'
  },
  {
    id: 'inv-002',
    invoiceNumber: 'DIY-2026-0002',
    clientName: 'Flutterwave Inc.',
    clientEmail: 'finance@flutterwave.com',
    issueDate: '2026-06-15',
    dueDate: '2026-07-15',
    lineItems: [
      { id: 'li3', description: 'API Integration Development', quantity: 40, unitPrice: 25000 },
    ],
    subtotal: 1000000,
    vatAmount: 75000,
    total: 1075000,
    status: 'Sent',
    vatRemitted: false
  },
  {
    id: 'inv-003',
    invoiceNumber: 'DIY-2026-0003',
    clientName: 'Paystack Payments',
    clientEmail: 'vendor@paystack.com',
    issueDate: '2026-05-20',
    dueDate: '2026-06-20',
    lineItems: [
      { id: 'li4', description: 'Security Audit & Penetration Testing', quantity: 1, unitPrice: 1500000 },
      { id: 'li5', description: 'Compliance Documentation', quantity: 1, unitPrice: 350000 },
    ],
    subtotal: 1850000,
    vatAmount: 138750,
    total: 1988750,
    status: 'Overdue',
    vatRemitted: false
  },
  {
    id: 'inv-004',
    invoiceNumber: 'DIY-2026-0004',
    clientName: 'Andela Nigeria',
    clientEmail: 'ap@andela.com',
    issueDate: '2026-07-01',
    dueDate: '2026-08-01',
    lineItems: [
      { id: 'li6', description: 'Staff Training Workshop (3 days)', quantity: 3, unitPrice: 180000 },
    ],
    subtotal: 540000,
    vatAmount: 40500,
    total: 580500,
    status: 'Draft',
    vatRemitted: false
  }
];

const formatNaira = (amount: number) => {
  return '₦' + amount.toLocaleString('en-NG');
};

const statusConfig: Record<InvoiceStatus, { color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { color: 'text-gray-600', bg: 'bg-gray-100', icon: <FileText className="w-3 h-3" /> },
  Sent: { color: 'text-blue-700', bg: 'bg-blue-50', icon: <Send className="w-3 h-3" /> },
  Paid: { color: 'text-emerald-700', bg: 'bg-emerald-50', icon: <CheckCircle2 className="w-3 h-3" /> },
  Overdue: { color: 'text-red-700', bg: 'bg-red-50', icon: <AlertTriangle className="w-3 h-3" /> },
};

export default function InvoiceManager() {
  const [invoices, setInvoices] = useState<Invoice[]>(SAMPLE_INVOICES);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isRemitModalOpen, setIsRemitModalOpen] = useState(false);
  const [remitStep, setRemitStep] = useState<'confirm' | 'processing' | 'success'>('confirm');
  const [remitRef, setRemitRef] = useState('');
  const [filterStatus, setFilterStatus] = useState<InvoiceStatus | 'All'>('All');

  // Create invoice form state
  const [newClientName, setNewClientName] = useState('');
  const [newClientEmail, setNewClientEmail] = useState('');
  const [newDueDate, setNewDueDate] = useState('');
  const [newLineItems, setNewLineItems] = useState<InvoiceLineItem[]>([
    { id: 'new-1', description: '', quantity: 1, unitPrice: 0 }
  ]);

  const filteredInvoices = filterStatus === 'All'
    ? invoices
    : invoices.filter(inv => inv.status === filterStatus);

  const totalOutstanding = invoices
    .filter(inv => inv.status === 'Sent' || inv.status === 'Overdue')
    .reduce((sum, inv) => sum + inv.total, 0);

  const totalVatCollected = invoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + inv.vatAmount, 0);

  const totalVatUnremitted = invoices
    .filter(inv => inv.status === 'Paid' && !inv.vatRemitted)
    .reduce((sum, inv) => sum + inv.vatAmount, 0);

  // Line item handlers
  const updateLineItem = (id: string, field: keyof InvoiceLineItem, value: string | number) => {
    setNewLineItems(prev => prev.map(li =>
      li.id === id ? { ...li, [field]: value } : li
    ));
  };

  const addLineItem = () => {
    setNewLineItems(prev => [...prev, {
      id: 'new-' + Date.now(),
      description: '',
      quantity: 1,
      unitPrice: 0
    }]);
  };

  const removeLineItem = (id: string) => {
    if (newLineItems.length <= 1) return;
    setNewLineItems(prev => prev.filter(li => li.id !== id));
  };

  const handleCreateInvoice = () => {
    if (!newClientName.trim() || !newDueDate) return;

    const subtotal = newLineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0);
    const vatAmount = Math.round(subtotal * VAT_RATE);
    const total = subtotal + vatAmount;
    const invoiceNum = 'DIY-2026-' + String(invoices.length + 1).padStart(4, '0');

    const newInvoice: Invoice = {
      id: 'inv-' + Date.now(),
      invoiceNumber: invoiceNum,
      clientName: newClientName,
      clientEmail: newClientEmail,
      issueDate: new Date().toISOString().split('T')[0],
      dueDate: newDueDate,
      lineItems: newLineItems.filter(li => li.description.trim()),
      subtotal,
      vatAmount,
      total,
      status: 'Draft',
      vatRemitted: false
    };

    setInvoices(prev => [newInvoice, ...prev]);
    setIsCreateModalOpen(false);
    setNewClientName('');
    setNewClientEmail('');
    setNewDueDate('');
    setNewLineItems([{ id: 'new-1', description: '', quantity: 1, unitPrice: 0 }]);
  };

  const handleMarkAsSent = (id: string) => {
    setInvoices(prev => prev.map(inv =>
      inv.id === id ? { ...inv, status: 'Sent' as InvoiceStatus } : inv
    ));
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(prev => prev ? { ...prev, status: 'Sent' } : null);
    }
  };

  const handleMarkAsPaid = (id: string) => {
    setInvoices(prev => prev.map(inv =>
      inv.id === id ? { ...inv, status: 'Paid' as InvoiceStatus } : inv
    ));
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(prev => prev ? { ...prev, status: 'Paid' } : null);
    }
  };

  const handleRemitVAT = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setRemitStep('confirm');
    setIsRemitModalOpen(true);
  };

  const executeRemitVAT = () => {
    setRemitStep('processing');
    setTimeout(() => {
      const ref = 'NRS-VAT-' + new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      setRemitRef(ref);

      if (selectedInvoice) {
        setInvoices(prev => prev.map(inv =>
          inv.id === selectedInvoice.id
            ? { ...inv, vatRemitted: true, vatRemittanceRef: ref }
            : inv
        ));
        setSelectedInvoice(prev => prev ? { ...prev, vatRemitted: true, vatRemittanceRef: ref } : null);
      }

      setRemitStep('success');
    }, 2000);
  };

  const newSubtotal = newLineItems.reduce((sum, li) => sum + (li.quantity * li.unitPrice), 0);
  const newVat = Math.round(newSubtotal * VAT_RATE);
  const newTotal = newSubtotal + newVat;

  return (
    <div className="max-w-5xl mx-auto space-y-6 text-left pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-black text-primary-container tracking-tight">E-Invoicing Portal</h2>
          <p className="text-sm text-on-surface-variant mt-1">Create, track, and remit VAT on invoices — NRS compliant.</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="h-11 px-5 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.98] transition-all flex items-center space-x-2 shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create Invoice</span>
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Outstanding</p>
          <p className="text-2xl font-black text-primary-container mt-1">{formatNaira(totalOutstanding)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">{invoices.filter(i => i.status === 'Sent' || i.status === 'Overdue').length} invoices pending</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">VAT Collected</p>
          <p className="text-2xl font-black text-emerald-700 mt-1">{formatNaira(totalVatCollected)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">From paid invoices</p>
        </div>
        <div className="bg-white border border-outline-variant rounded-xl p-5 shadow-xs">
          <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">VAT Unremitted</p>
          <p className="text-2xl font-black text-amber-600 mt-1">{formatNaira(totalVatUnremitted)}</p>
          <p className="text-[10px] text-on-surface-variant mt-1">Due to NRS</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-1 bg-surface-container p-1 rounded-xl border border-outline-variant overflow-x-auto">
        {(['All', 'Draft', 'Sent', 'Paid', 'Overdue'] as const).map(status => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap cursor-pointer ${
              filterStatus === status
                ? 'bg-white text-primary-container shadow-sm border border-outline-variant/40'
                : 'text-on-surface-variant hover:text-primary-container hover:bg-white/50'
            }`}
          >
            {status}
            {status !== 'All' && (
              <span className="ml-1.5 text-[10px] opacity-60">
                ({invoices.filter(i => i.status === status).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        {filteredInvoices.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="w-10 h-10 text-on-surface-variant/30 mx-auto mb-3" />
            <p className="text-sm font-semibold text-on-surface-variant">No invoices found</p>
          </div>
        ) : (
          <div className="divide-y divide-outline-variant/40">
            {filteredInvoices.map(invoice => {
              const cfg = statusConfig[invoice.status];
              return (
                <motion.div
                  key={invoice.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex items-center justify-between px-5 py-4 hover:bg-surface-container-low/50 transition-colors cursor-pointer group"
                  onClick={() => setSelectedInvoice(invoice)}
                >
                  <div className="flex items-center space-x-4 min-w-0">
                    <div className={`w-9 h-9 rounded-lg ${cfg.bg} flex items-center justify-center ${cfg.color} flex-shrink-0`}>
                      {cfg.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-mono font-bold text-on-surface-variant">{invoice.invoiceNumber}</span>
                        <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>{invoice.status}</span>
                        {invoice.vatRemitted && (
                          <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">VAT Remitted</span>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-on-surface truncate mt-0.5">{invoice.clientName}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 flex-shrink-0">
                    <div className="text-right">
                      <p className="text-sm font-black text-primary-container">{formatNaira(invoice.total)}</p>
                      <p className="text-[10px] text-on-surface-variant">Due: {invoice.dueDate}</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-on-surface-variant/40 group-hover:text-primary-container transition-colors" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* ===================== INVOICE DETAIL SLIDE-OVER ===================== */}
      <AnimatePresence>
        {selectedInvoice && !isRemitModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex justify-end"
            onClick={() => setSelectedInvoice(null)}
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="w-full max-w-lg bg-white h-full overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-white border-b border-outline-variant/40 px-6 py-4 flex items-center justify-between z-10">
                <div>
                  <p className="text-xs font-mono font-bold text-on-surface-variant">{selectedInvoice.invoiceNumber}</p>
                  <p className="text-lg font-black text-primary-container">{selectedInvoice.clientName}</p>
                </div>
                <button onClick={() => setSelectedInvoice(null)} className="p-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Status & Dates */}
                <div className="flex items-center gap-3 flex-wrap">
                  {(() => {
                    const cfg = statusConfig[selectedInvoice.status];
                    return <span className={`text-xs font-bold uppercase px-3 py-1 rounded-full ${cfg.bg} ${cfg.color} flex items-center gap-1`}>{cfg.icon} {selectedInvoice.status}</span>;
                  })()}
                  {selectedInvoice.vatRemitted && (
                    <span className="text-xs font-bold uppercase px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 flex items-center gap-1">
                      <Check className="w-3 h-3" /> VAT Remitted
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Issue Date</p>
                    <p className="text-sm font-semibold text-on-surface mt-0.5">{selectedInvoice.issueDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Due Date</p>
                    <p className="text-sm font-semibold text-on-surface mt-0.5">{selectedInvoice.dueDate}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Email</p>
                    <p className="text-sm font-semibold text-on-surface mt-0.5">{selectedInvoice.clientEmail}</p>
                  </div>
                  {selectedInvoice.vatRemittanceRef && (
                    <div>
                      <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">VAT Ref</p>
                      <p className="text-xs font-mono font-bold text-emerald-700 mt-0.5">{selectedInvoice.vatRemittanceRef}</p>
                    </div>
                  )}
                </div>

                {/* Line Items Table */}
                <div className="border border-outline-variant rounded-xl overflow-hidden">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-surface-container-low">
                        <th className="px-4 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Description</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-center">Qty</th>
                        <th className="px-3 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Unit Price</th>
                        <th className="px-4 py-2.5 text-[10px] font-bold text-on-surface-variant uppercase tracking-wider text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/40">
                      {selectedInvoice.lineItems.map(li => (
                        <tr key={li.id}>
                          <td className="px-4 py-3 text-xs font-semibold text-on-surface">{li.description}</td>
                          <td className="px-3 py-3 text-xs text-on-surface-variant text-center">{li.quantity}</td>
                          <td className="px-3 py-3 text-xs text-on-surface-variant text-right">{formatNaira(li.unitPrice)}</td>
                          <td className="px-4 py-3 text-xs font-bold text-on-surface text-right">{formatNaira(li.quantity * li.unitPrice)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Totals */}
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-semibold">Subtotal</span>
                    <span className="font-bold text-on-surface">{formatNaira(selectedInvoice.subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-semibold">VAT (7.5%)</span>
                    <span className="font-bold text-on-surface">{formatNaira(selectedInvoice.vatAmount)}</span>
                  </div>
                  <div className="border-t border-outline-variant pt-2 flex justify-between">
                    <span className="text-sm font-bold text-primary-container">Total</span>
                    <span className="text-lg font-black text-primary-container">{formatNaira(selectedInvoice.total)}</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="space-y-3">
                  {selectedInvoice.status === 'Draft' && (
                    <button
                      onClick={() => handleMarkAsSent(selectedInvoice.id)}
                      className="w-full h-11 bg-blue-600 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>Mark as Sent</span>
                    </button>
                  )}
                  {(selectedInvoice.status === 'Sent' || selectedInvoice.status === 'Overdue') && (
                    <button
                      onClick={() => handleMarkAsPaid(selectedInvoice.id)}
                      className="w-full h-11 bg-emerald-600 text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Mark as Paid</span>
                    </button>
                  )}
                  {selectedInvoice.status === 'Paid' && !selectedInvoice.vatRemitted && (
                    <button
                      onClick={() => handleRemitVAT(selectedInvoice)}
                      className="w-full h-11 bg-[#013220] text-white text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer shadow-sm"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>Remit VAT to NRS — {formatNaira(selectedInvoice.vatAmount)}</span>
                    </button>
                  )}
                  <button className="w-full h-11 bg-surface-container border border-outline-variant text-on-surface-variant text-xs font-bold rounded-xl flex items-center justify-center space-x-2 hover:bg-surface-container-high transition-colors cursor-pointer">
                    <Download className="w-4 h-4" />
                    <span>Download PDF</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== CREATE INVOICE MODAL ===================== */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
            onClick={() => setIsCreateModalOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="sticky top-0 bg-white border-b border-outline-variant/40 px-6 py-4 flex items-center justify-between z-10 rounded-t-2xl">
                <h3 className="text-lg font-black text-primary-container">Create New Invoice</h3>
                <button onClick={() => setIsCreateModalOpen(false)} className="p-2 rounded-lg hover:bg-surface-container transition-colors cursor-pointer">
                  <X className="w-5 h-5 text-on-surface-variant" />
                </button>
              </div>

              <div className="p-6 space-y-6">
                {/* Client Info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Name *</label>
                    <input
                      type="text"
                      value={newClientName}
                      onChange={e => setNewClientName(e.target.value)}
                      placeholder="e.g. MTN Nigeria"
                      className="w-full h-11 px-4 bg-background border border-outline rounded-xl text-sm font-semibold text-on-surface focus:outline-none focus:border-primary-container"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Client Email</label>
                    <input
                      type="email"
                      value={newClientEmail}
                      onChange={e => setNewClientEmail(e.target.value)}
                      placeholder="accounts@client.com"
                      className="w-full h-11 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary-container"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Due Date *</label>
                  <input
                    type="date"
                    value={newDueDate}
                    onChange={e => setNewDueDate(e.target.value)}
                    className="w-full sm:w-48 h-11 px-4 bg-background border border-outline rounded-xl text-sm text-on-surface focus:outline-none focus:border-primary-container"
                  />
                </div>

                {/* Line Items */}
                <div>
                  <p className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-3">Line Items</p>
                  <div className="space-y-3">
                    {newLineItems.map((li, idx) => (
                      <div key={li.id} className="flex items-start gap-2">
                        <div className="flex-grow">
                          <input
                            type="text"
                            value={li.description}
                            onChange={e => updateLineItem(li.id, 'description', e.target.value)}
                            placeholder={`Item ${idx + 1} description`}
                            className="w-full h-10 px-3 bg-background border border-outline rounded-lg text-xs font-semibold text-on-surface focus:outline-none focus:border-primary-container"
                          />
                        </div>
                        <input
                          type="number"
                          value={li.quantity}
                          onChange={e => updateLineItem(li.id, 'quantity', parseInt(e.target.value) || 0)}
                          min={1}
                          className="w-16 h-10 px-2 bg-background border border-outline rounded-lg text-xs text-center text-on-surface focus:outline-none focus:border-primary-container"
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          value={li.unitPrice || ''}
                          onChange={e => updateLineItem(li.id, 'unitPrice', parseInt(e.target.value) || 0)}
                          className="w-28 h-10 px-2 bg-background border border-outline rounded-lg text-xs text-right text-on-surface focus:outline-none focus:border-primary-container"
                          placeholder="Unit Price (₦)"
                        />
                        <button
                          onClick={() => removeLineItem(li.id)}
                          className="p-2.5 text-on-surface-variant/40 hover:text-red-500 transition-colors cursor-pointer flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={addLineItem}
                    className="mt-3 text-xs font-bold text-primary-container hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3 h-3" /> Add Line Item
                  </button>
                </div>

                {/* Live Totals */}
                <div className="bg-surface-container-low border border-outline-variant rounded-xl p-4 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-semibold">Subtotal</span>
                    <span className="font-bold text-on-surface">{formatNaira(newSubtotal)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-on-surface-variant font-semibold">VAT (7.5%)</span>
                    <span className="font-bold text-on-surface">{formatNaira(newVat)}</span>
                  </div>
                  <div className="border-t border-outline-variant pt-2 flex justify-between">
                    <span className="text-sm font-bold text-primary-container">Invoice Total</span>
                    <span className="text-lg font-black text-primary-container">{formatNaira(newTotal)}</span>
                  </div>
                </div>

                {/* Submit */}
                <button
                  onClick={handleCreateInvoice}
                  disabled={!newClientName.trim() || !newDueDate}
                  className="w-full h-12 bg-[#013220] text-white text-sm font-bold rounded-xl flex items-center justify-center space-x-2 hover:opacity-95 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  <span>Create Invoice as Draft</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ===================== VAT REMITTANCE MODAL ===================== */}
      <AnimatePresence>
        {isRemitModalOpen && selectedInvoice && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-[60] flex items-center justify-center p-4"
            onClick={() => { if (remitStep !== 'processing') { setIsRemitModalOpen(false); } }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              {remitStep === 'confirm' && (
                <div className="p-6 space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-[#013220]/10 flex items-center justify-center mx-auto">
                    <ExternalLink className="w-7 h-7 text-[#013220]" />
                  </div>
                  <h3 className="text-lg font-black text-primary-container">Remit VAT to NRS</h3>
                  <p className="text-sm text-on-surface-variant">
                    You are about to remit <span className="font-bold text-on-surface">{formatNaira(selectedInvoice.vatAmount)}</span> in VAT collected from invoice <span className="font-mono font-bold">{selectedInvoice.invoiceNumber}</span> directly to the Nigeria Revenue Service.
                  </p>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-[11px] font-semibold text-amber-800">
                      ⚠️ This action is irreversible. Ensure the payment has been received before remitting.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setIsRemitModalOpen(false)}
                      className="flex-1 h-11 bg-surface-container border border-outline-variant text-on-surface-variant text-xs font-bold rounded-xl hover:bg-surface-container-high transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={executeRemitVAT}
                      className="flex-1 h-11 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 active:scale-[0.99] transition-all flex items-center justify-center space-x-2 cursor-pointer"
                    >
                      <ArrowRight className="w-4 h-4" />
                      <span>Confirm & Remit</span>
                    </button>
                  </div>
                </div>
              )}

              {remitStep === 'processing' && (
                <div className="p-8 text-center space-y-4">
                  <div className="w-12 h-12 border-4 border-[#013220]/20 border-t-[#013220] rounded-full animate-spin mx-auto"></div>
                  <p className="text-sm font-bold text-on-surface-variant">Processing VAT Remittance...</p>
                  <p className="text-[11px] text-on-surface-variant">Transmitting to NRS e-filing gateway</p>
                </div>
              )}

              {remitStep === 'success' && (
                <div className="p-6 space-y-5 text-center">
                  <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-black text-emerald-700">VAT Remitted Successfully!</h3>
                  <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-1">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">NRS Reference Number</p>
                    <p className="text-lg font-mono font-black text-emerald-800">{remitRef}</p>
                  </div>
                  <p className="text-xs text-on-surface-variant">
                    {formatNaira(selectedInvoice.vatAmount)} has been remitted to the Nigeria Revenue Service.
                  </p>
                  <button
                    onClick={() => { setIsRemitModalOpen(false); }}
                    className="w-full h-11 bg-[#013220] text-white text-xs font-bold rounded-xl hover:opacity-95 transition-all cursor-pointer"
                  >
                    Done
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

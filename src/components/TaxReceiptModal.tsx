import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Download, ShieldCheck, Landmark } from 'lucide-react';
import { TaxFiling, UserSession } from '../types';

interface TaxReceiptModalProps {
  filing: TaxFiling | null;
  session: UserSession;
  onClose: () => void;
}

export default function TaxReceiptModal({ filing, session, onClose }: TaxReceiptModalProps) {
  if (!filing) return null;

  const handleDownload = () => {
    // Standard alert or simulation of downloading
    alert(`Downloading Tax Receipt PDF: ${filing.receiptNumber}.pdf`);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40 backdrop-blur-xs">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl border border-outline-variant flex flex-col max-h-[90vh]"
        >
          {/* Header */}
          <div className="bg-primary-container text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Landmark className="w-5 h-5 text-accent-green" />
              <span className="font-bold text-sm uppercase tracking-wider">Official Tax Receipt</span>
            </div>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/10 rounded-full transition-colors"
            >
              <X className="w-5 h-5 text-neutral-300 hover:text-white" />
            </button>
          </div>

          {/* Certificate Body */}
          <div className="p-6 md:p-8 overflow-y-auto space-y-6 text-on-surface">
            {/* Stamp / Logo */}
            <div className="flex flex-col items-center text-center space-y-2 border-b border-outline-variant pb-6">
              <div className="w-16 h-16 bg-surface-container-low rounded-full border-4 border-accent-green/30 flex items-center justify-center">
                <ShieldCheck className="w-8 h-8 text-primary-container" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-primary-container">Federal Inland Revenue Service</h3>
                <p className="text-[10px] text-on-surface-variant font-bold tracking-widest uppercase">Federal Republic of Nigeria</p>
              </div>
            </div>

            {/* Receipt Parameters */}
            <div className="grid grid-cols-2 gap-4 text-xs border-b border-outline-variant pb-6">
              <div>
                <p className="text-on-surface-variant font-medium">Taxpayer Type</p>
                <p className="font-bold text-on-surface uppercase mt-0.5">{session.accountType}</p>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium">Filing Date</p>
                <p className="font-bold text-on-surface mt-0.5">{filing.dateFiled}</p>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium">TIN / NIN</p>
                <p className="font-mono font-bold text-on-surface mt-0.5">
                  {session.isNINLinked && session.nin ? session.nin : 'N/A (LIMITED ACCESS)'}
                </p>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium">Receipt No.</p>
                <p className="font-mono font-bold text-primary-container mt-0.5">{filing.receiptNumber}</p>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium">Tax Category</p>
                <p className="font-bold text-on-surface mt-0.5">{filing.type}</p>
              </div>
              <div>
                <p className="text-on-surface-variant font-medium">Tax Year / Period</p>
                <p className="font-bold text-on-surface mt-0.5">{filing.period}</p>
              </div>
            </div>

            {/* Payment Summary */}
            <div className="bg-surface-container-low rounded-xl p-4 border border-outline-variant/30 flex justify-between items-center">
              <div>
                <p className="text-xs text-on-surface-variant font-semibold">Total Amount Remitted</p>
                <p className="text-2xl font-black text-primary-container mt-1 font-mono">
                  ₦{filing.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="bg-[#4ADE80]/15 text-[#013220] border border-[#4ADE80]/30 font-bold text-[10px] tracking-widest uppercase px-3 py-1.5 rounded-full">
                {filing.status}
              </div>
            </div>

            {/* Verification Watermark */}
            <p className="text-[10px] text-on-surface-variant/70 leading-relaxed text-center">
              This receipt is electronically compiled and secured under the Nigeria Unified Revenue Portal. Please check the receipt number on the official DIYtax9ja verification portal to authenticate this transaction.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="bg-surface-container-low border-t border-outline-variant px-6 py-4 flex justify-between items-center">
            <button
              onClick={onClose}
              className="px-4 py-2 hover:bg-surface-container rounded-lg font-semibold text-xs text-on-surface-variant uppercase tracking-wider"
            >
              Close Window
            </button>
            <button
              onClick={handleDownload}
              className="px-4 py-2.5 bg-primary-container text-white font-semibold text-xs rounded-lg hover:bg-primary-container/95 active:scale-95 transition-all flex items-center space-x-1.5 shadow-xs uppercase tracking-wider"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

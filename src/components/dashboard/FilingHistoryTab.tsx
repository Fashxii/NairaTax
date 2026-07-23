import React from 'react';
import { motion } from 'motion/react';
import { Download, FileText, ShieldCheck, ChevronRight } from 'lucide-react';
import { UserSession, TaxFiling } from '../../types';

interface FilingHistoryTabProps {
  filings: TaxFiling[];
  session: UserSession;
  onSelectFiling: (filing: TaxFiling) => void;
  onStartFiling: () => void;
}

export default function FilingHistoryTab({ filings, session, onSelectFiling, onStartFiling }: FilingHistoryTabProps) {
  return (
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
              onStartFiling();
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
                      onClick={() => onSelectFiling(f)}
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
  );
}

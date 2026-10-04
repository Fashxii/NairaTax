/**
 * EmailAuditLogViewer.tsx — Email Delivery Audit Log
 *
 * Searchable, filterable audit log of all dispatched emails with:
 * - Status indicators (Sent, Delivered, Failed, Queued)
 * - Template type badges
 * - Sandbox email preview modal
 * - Export and clear actions
 */

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'motion/react';
import {
  Search, Mail, CheckCircle, XCircle,
  Clock, AlertTriangle, Eye, Trash2,
  ChevronDown, X, Inbox, Send, RefreshCw,
} from 'lucide-react';
import type { EmailLogEntry, EmailDeliveryStatus } from '../../types/email';
import { getEmailAuditLogs, getSandboxEmails, clearSandbox } from '../../utils/emailService';

const STATUS_CONFIG: Record<EmailDeliveryStatus, { icon: typeof CheckCircle; color: string; bg: string }> = {
  Queued:    { icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
  Sent:      { icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
  Delivered: { icon: CheckCircle, color: 'text-green-600', bg: 'bg-green-50' },
  Failed:    { icon: XCircle, color: 'text-red-600', bg: 'bg-red-50' },
  Bounced:   { icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
};

export default function EmailAuditLogViewer() {
  const [logs, setLogs] = useState<EmailLogEntry[]>([]);
  const [sandboxEmails, setSandboxEmails] = useState<ReturnType<typeof getSandboxEmails>>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<EmailDeliveryStatus | 'all'>('all');
  const [modeFilter, setModeFilter] = useState<'all' | 'live' | 'sandbox'>('all');
  const [selectedSandboxId, setSelectedSandboxId] = useState<string | null>(null);
  const [view, setView] = useState<'logs' | 'sandbox'>('logs');

  useEffect(() => {
    refreshData();
  }, []);

  const refreshData = () => {
    setLogs(getEmailAuditLogs());
    setSandboxEmails(getSandboxEmails());
  };

  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      const matchesSearch = !searchQuery ||
        log.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
        log.templateName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
      const matchesMode = modeFilter === 'all' || log.mode === modeFilter;
      return matchesSearch && matchesStatus && matchesMode;
    });
  }, [logs, searchQuery, statusFilter, modeFilter]);

  const selectedSandbox = sandboxEmails.find(e => e.id === selectedSandboxId);

  const handleClearSandbox = () => {
    clearSandbox();
    setSandboxEmails([]);
    setSelectedSandboxId(null);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* View Toggle & Actions */}
      <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex bg-surface-container-low rounded-xl p-0.5">
            <button
              onClick={() => setView('logs')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                view === 'logs' ? 'bg-white shadow-xs text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Delivery Log
              <span className="bg-surface-container px-1.5 py-0.5 rounded-full text-[9px] font-mono">{logs.length}</span>
            </button>
            <button
              onClick={() => setView('sandbox')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                view === 'sandbox' ? 'bg-white shadow-xs text-on-surface' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <Inbox className="w-3.5 h-3.5" />
              Dev Sandbox
              {sandboxEmails.length > 0 && (
                <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[9px] font-mono">{sandboxEmails.length}</span>
              )}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={refreshData}
            className="p-2 rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-all cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {view === 'sandbox' && sandboxEmails.length > 0 && (
            <button
              onClick={handleClearSandbox}
              className="px-3 py-2 rounded-lg text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear All
            </button>
          )}
        </div>
      </div>

      {view === 'logs' ? (
        <>
          {/* Filters */}
          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search by recipient, subject, or template…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
              />
            </div>

            <div className="flex gap-2">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value as EmailDeliveryStatus | 'all')}
                  className="pl-3 pr-8 py-2 rounded-lg border border-outline-variant bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-green/40 appearance-none cursor-pointer"
                >
                  <option value="all">All Statuses</option>
                  <option value="Sent">Sent</option>
                  <option value="Delivered">Delivered</option>
                  <option value="Failed">Failed</option>
                  <option value="Bounced">Bounced</option>
                  <option value="Queued">Queued</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-on-surface-variant pointer-events-none" />
              </div>

              <div className="relative">
                <select
                  value={modeFilter}
                  onChange={e => setModeFilter(e.target.value as 'all' | 'live' | 'sandbox')}
                  className="pl-3 pr-8 py-2 rounded-lg border border-outline-variant bg-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-accent-green/40 appearance-none cursor-pointer"
                >
                  <option value="all">All Modes</option>
                  <option value="live">Live</option>
                  <option value="sandbox">Sandbox</option>
                </select>
                <ChevronDown className="w-3.5 h-3.5 absolute right-2 top-2.5 text-on-surface-variant pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Log Table */}
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
            {filteredLogs.length === 0 ? (
              <div className="py-16 text-center text-on-surface-variant">
                <Mail className="w-10 h-10 mx-auto opacity-20 mb-3" />
                <p className="text-sm font-semibold">No email logs yet</p>
                <p className="text-xs mt-1">Dispatched emails will appear here</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant/40">
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Status</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Template</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Recipient</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Subject</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Mode</th>
                      <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">Sent</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/20">
                    {filteredLogs.map(log => {
                      const statusCfg = STATUS_CONFIG[log.status];
                      const StatusIcon = statusCfg.icon;
                      return (
                        <tr key={log.id} className="hover:bg-surface-container-low/50 transition-colors">
                          <td className="px-4 py-3">
                            <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full ${statusCfg.bg}`}>
                              <StatusIcon className={`w-3 h-3 ${statusCfg.color}`} />
                              <span className={`text-[10px] font-bold ${statusCfg.color}`}>{log.status}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs font-semibold text-on-surface">{log.templateName}</p>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-on-surface font-mono">{log.recipientEmail}</p>
                            {log.recipientName && (
                              <p className="text-[10px] text-on-surface-variant">{log.recipientName}</p>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-xs text-on-surface truncate max-w-48">{log.subject}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full ${
                              log.mode === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                            }`}>
                              {log.mode}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-[10px] text-on-surface-variant font-mono">
                              {new Date(log.sentAt).toLocaleString()}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ── Sandbox View ─────────────────────────────────────────── */
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Sandbox Email List */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
              {sandboxEmails.length === 0 ? (
                <div className="py-16 text-center text-on-surface-variant">
                  <Inbox className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-semibold">Sandbox is empty</p>
                  <p className="text-xs mt-1">Emails sent in dev mode appear here</p>
                </div>
              ) : (
                <div className="max-h-[500px] overflow-y-auto divide-y divide-outline-variant/20">
                  {sandboxEmails.map(email => (
                    <button
                      key={email.id}
                      onClick={() => setSelectedSandboxId(email.id)}
                      className={`w-full px-4 py-3 text-left transition-all cursor-pointer ${
                        selectedSandboxId === email.id
                          ? 'bg-amber-50 border-l-4 border-l-amber-400'
                          : 'hover:bg-surface-container-low border-l-4 border-l-transparent'
                      }`}
                    >
                      <p className="text-xs font-semibold text-on-surface truncate">{email.subject}</p>
                      <p className="text-[10px] text-on-surface-variant mt-0.5">To: {email.to}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">
                          {email.templateName}
                        </span>
                        <span className="text-[9px] text-on-surface-variant font-mono">
                          {new Date(email.sentAt).toLocaleTimeString()}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sandbox Preview */}
          <div className="lg:col-span-3">
            <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
              {selectedSandbox ? (
                <>
                  <div className="px-4 py-3 border-b border-outline-variant/40 bg-surface-container-low">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-on-surface">{selectedSandbox.subject}</p>
                        <p className="text-[10px] text-on-surface-variant mt-0.5">To: {selectedSandbox.to}</p>
                      </div>
                      <button
                        onClick={() => setSelectedSandboxId(null)}
                        className="p-1.5 rounded-lg hover:bg-surface-container cursor-pointer"
                      >
                        <X className="w-4 h-4 text-on-surface-variant" />
                      </button>
                    </div>
                  </div>
                  <iframe
                    srcDoc={selectedSandbox.html}
                    title="Sandbox Preview"
                    className="w-full border-0"
                    style={{ height: '460px' }}
                    sandbox="allow-same-origin"
                  />
                </>
              ) : (
                <div className="py-24 text-center text-on-surface-variant">
                  <Eye className="w-10 h-10 mx-auto opacity-20 mb-3" />
                  <p className="text-sm font-semibold">Select an email to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}

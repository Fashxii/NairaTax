import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FileCode, Download, Search, X, Eye } from 'lucide-react';
import { useToast } from '../Toast';

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorEmail: string;
  action: string;
  module: 'System Config' | 'User Management' | 'Security & API' | 'Filing Engine';
  severity: 'INFO' | 'WARN' | 'CRITICAL';
  ipAddress: string;
  timestamp: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
}

const INITIAL_LOGS: AuditLogEntry[] = [
  {
    id: 'log_1001',
    actorName: 'Adebayo Ogunlade',
    actorEmail: 'adebayo@diytax9ja.ng',
    action: 'UPDATE_SYSTEM_TAX_DEFAULTS',
    module: 'System Config',
    severity: 'WARN',
    ipAddress: '197.210.64.12',
    timestamp: '2026-08-08 15:02:14',
    beforeState: { vatRate: 5.0, maintenanceMode: false },
    afterState: { vatRate: 7.5, maintenanceMode: false },
  },
  {
    id: 'log_1002',
    actorName: 'Adebayo Ogunlade',
    actorEmail: 'adebayo@diytax9ja.ng',
    action: 'PROVISION_API_KEY',
    module: 'Security & API',
    severity: 'INFO',
    ipAddress: '197.210.64.12',
    timestamp: '2026-08-08 14:45:00',
    beforeState: { keyCount: 2 },
    afterState: { keyCount: 3, keyName: 'Mono Open Banking Webhook Key' },
  },
  {
    id: 'log_1003',
    actorName: 'Fatima Bello',
    actorEmail: 'fatima.b@diytax9ja.ng',
    action: 'SUSPEND_USER_ACCOUNT',
    module: 'User Management',
    severity: 'CRITICAL',
    ipAddress: '102.88.19.04',
    timestamp: '2026-08-07 16:20:11',
    beforeState: { userId: 'u104', status: 'active' },
    afterState: { userId: 'u104', status: 'suspended', reason: 'Unverified NIN details' },
  },
  {
    id: 'log_1004',
    actorName: 'System Worker',
    actorEmail: 'system@diytax9ja.ng',
    action: 'MONO_WEBHOOK_SYNC_SUCCESS',
    module: 'Filing Engine',
    severity: 'INFO',
    ipAddress: '52.14.99.10',
    timestamp: '2026-08-07 12:00:05',
    beforeState: { accountId: 'mono_acc_01', lastSync: '2026-08-06' },
    afterState: { accountId: 'mono_acc_01', syncedTransactionsCount: 14 },
  },
];

export default function AuditLogViewer() {
  const { showToast } = useToast();
  const [logs] = useState<AuditLogEntry[]>(INITIAL_LOGS);
  const [searchQuery, setSearchQuery] = useState('');
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [moduleFilter, setModuleFilter] = useState<string>('ALL');
  const [selectedDiffLog, setSelectedDiffLog] = useState<AuditLogEntry | null>(null);

  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      log.actorEmail.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSeverity = severityFilter === 'ALL' || log.severity === severityFilter;
    const matchesModule = moduleFilter === 'ALL' || log.module === moduleFilter;
    return matchesSearch && matchesSeverity && matchesModule;
  });

  const exportCSV = () => {
    const headers = ['ID', 'Actor Name', 'Actor Email', 'Action', 'Module', 'Severity', 'IP Address', 'Timestamp'];
    const rows = filteredLogs.map((l) => [
      l.id,
      `"${l.actorName}"`,
      `"${l.actorEmail}"`,
      `"${l.action}"`,
      `"${l.module}"`,
      l.severity,
      l.ipAddress,
      l.timestamp,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `DIYtax9ja_Audit_Logs_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    showToast('success', 'Export Complete', 'Exported audit log entries to CSV file.');
  };

  const getSeverityStyle = (severity: AuditLogEntry['severity']) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'WARN':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">Immutable System Audit Logs</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Complete compliance trail capturing administrative actions, parameter diffs, and security events.
          </p>
        </div>

        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-primary-container hover:bg-primary-container/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 self-start sm:self-auto"
        >
          <Download className="w-4 h-4 text-accent-green" />
          <span>Export Audit Log CSV</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 border border-outline-variant/60 rounded-xl flex flex-col lg:flex-row items-center justify-between gap-4 shadow-xs">
        <div className="relative flex-grow w-full lg:max-w-md">
          <Search className="w-4 h-4 text-on-surface-variant/60 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by action, admin name, or email..."
            className="w-full pl-9 pr-4 py-2 bg-surface-container-low border border-outline-variant/60 rounded-lg text-xs text-on-surface focus:outline-none focus:border-primary-container"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Modules</option>
            <option value="System Config">System Config</option>
            <option value="User Management">User Management</option>
            <option value="Security & API">Security &amp; API</option>
            <option value="Filing Engine">Filing Engine</option>
          </select>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="bg-surface-container-low border border-outline-variant/60 rounded-lg px-3 py-2 text-xs font-semibold text-on-surface cursor-pointer focus:outline-none"
          >
            <option value="ALL">All Severities</option>
            <option value="INFO">INFO</option>
            <option value="WARN">WARN</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-outline-variant rounded-2xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant/60 text-on-surface-variant uppercase text-[10px] font-extrabold tracking-wider">
                <th className="py-3.5 px-4">Timestamp</th>
                <th className="py-3.5 px-4">Actor</th>
                <th className="py-3.5 px-4">Action</th>
                <th className="py-3.5 px-4">Module</th>
                <th className="py-3.5 px-4">Severity</th>
                <th className="py-3.5 px-4 text-right">Payload Diff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/30">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-surface-container-low/40">
                  <td className="py-3.5 px-4 font-mono text-[11px] text-on-surface-variant whitespace-nowrap">
                    {log.timestamp}
                  </td>

                  <td className="py-3.5 px-4">
                    <p className="font-bold text-on-surface">{log.actorName}</p>
                    <p className="text-[9px] text-on-surface-variant font-mono">{log.ipAddress}</p>
                  </td>

                  <td className="py-3.5 px-4 font-mono font-bold text-xs text-primary-container">
                    {log.action}
                  </td>

                  <td className="py-3.5 px-4 text-on-surface font-medium">{log.module}</td>

                  <td className="py-3.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded border text-[9px] font-extrabold uppercase ${getSeverityStyle(
                        log.severity
                      )}`}
                    >
                      {log.severity}
                    </span>
                  </td>

                  <td className="py-3.5 px-4 text-right">
                    <button
                      onClick={() => setSelectedDiffLog(log)}
                      className="px-2.5 py-1 bg-surface-container hover:bg-surface-container-high text-primary-container rounded-lg text-[10px] font-bold cursor-pointer inline-flex items-center gap-1"
                    >
                      <Eye className="w-3.5 h-3.5" /> View Diff
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* JSON Payload Diff Modal */}
      <AnimatePresence>
        {selectedDiffLog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white border border-outline-variant rounded-2xl max-w-2xl w-full p-6 shadow-xl relative text-left"
            >
              <button
                onClick={() => setSelectedDiffLog(null)}
                className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40 mb-4">
                <FileCode className="w-5 h-5 text-primary-container" />
                <div>
                  <h4 className="font-extrabold text-sm text-primary-container">Audit Event State Diff</h4>
                  <p className="text-[11px] text-on-surface-variant font-mono">{selectedDiffLog.action}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 font-mono text-[11px]">
                <div className="bg-red-50/60 border border-red-200 p-3 rounded-xl">
                  <p className="font-bold text-red-900 mb-2 uppercase text-[10px]">State Before Action</p>
                  <pre className="whitespace-pre-wrap text-red-800 overflow-x-auto">
                    {JSON.stringify(selectedDiffLog.beforeState || {}, null, 2)}
                  </pre>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-200 p-3 rounded-xl">
                  <p className="font-bold text-emerald-900 mb-2 uppercase text-[10px]">State After Action</p>
                  <pre className="whitespace-pre-wrap text-emerald-800 overflow-x-auto">
                    {JSON.stringify(selectedDiffLog.afterState || {}, null, 2)}
                  </pre>
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedDiffLog(null)}
                  className="px-4 py-2 bg-surface-container hover:bg-surface-container-high text-on-surface font-bold text-xs rounded-xl cursor-pointer"
                >
                  Close State Diff
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

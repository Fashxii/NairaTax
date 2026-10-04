import { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, FileText, ShieldCheck, Calendar, CheckCircle, X } from 'lucide-react';
import type { TaxFiling } from '../types';
import { useUserPersistedState } from '../utils/userScope';

interface Notification {
  id: string;
  type: 'filing' | 'compliance' | 'deadline' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

interface NotificationSource {
  merchant: string;
  amount: number;
  date: string;
  id: string;
}

interface NotificationPanelProps {
  filings?: TaxFiling[];
  transactions?: NotificationSource[];
  isNINLinked?: boolean;
  accountMode?: 'personal' | 'business';
}

const DAY = 24 * 60 * 60 * 1000;
const fmtDate = (d: Date) => d.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' });
const daysUntil = (d: Date) => Math.ceil((d.getTime() - Date.now()) / DAY);
const dueLabel = (d: Date) => {
  const n = daysUntil(d);
  return n <= 0 ? 'Due today' : n === 1 ? 'Due tomorrow' : `Due in ${n} days`;
};
const relativeTime = (iso: string) => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return '';
  const days = Math.floor((Date.now() - t) / DAY);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
};

/** Next statutory deadlines (Nigeria): PIT self-assessment 31 Mar, VAT 21st monthly, CIT 30 Jun (Dec year-end). */
function upcomingDeadlines(accountMode: 'personal' | 'business'): Omit<Notification, 'read'>[] {
  const now = new Date();
  const y = now.getFullYear();
  const out: Omit<Notification, 'read'>[] = [];
  const next = (month: number, day: number) => {
    const d = new Date(y, month, day, 23, 59);
    return d.getTime() >= now.getTime() ? d : new Date(y + 1, month, day, 23, 59);
  };
  if (accountMode === 'personal') {
    const pit = next(2, 31);
    out.push({
      id: `deadline-pit-${pit.getFullYear()}`,
      type: 'deadline',
      title: 'Annual PIT Self-Assessment',
      message: `Your FY ${pit.getFullYear() - 1} personal income tax return is due by ${fmtDate(pit)}.`,
      time: dueLabel(pit),
    });
  } else {
    let vat = new Date(y, now.getMonth(), 21, 23, 59);
    if (vat.getTime() < now.getTime()) vat = new Date(y, now.getMonth() + 1, 21, 23, 59);
    const prevMonth = new Date(vat.getFullYear(), vat.getMonth() - 1, 1);
    out.push({
      id: `deadline-vat-${vat.getFullYear()}-${vat.getMonth()}`,
      type: 'filing',
      title: 'Monthly VAT Return',
      message: `VAT for ${prevMonth.toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })} is due by ${fmtDate(vat)}.`,
      time: dueLabel(vat),
    });
    const cit = next(5, 30);
    out.push({
      id: `deadline-cit-${cit.getFullYear()}`,
      type: 'deadline',
      title: 'Company Income Tax Return',
      message: `CIT for financial year ending Dec ${cit.getFullYear() - 1} is due by ${fmtDate(cit)}.`,
      time: dueLabel(cit),
    });
  }
  return out;
}

const ICON_MAP = {
  filing: FileText,
  compliance: ShieldCheck,
  deadline: Calendar,
  system: CheckCircle,
};

const ICON_COLORS = {
  filing: 'text-blue-600 bg-blue-50',
  compliance: 'text-emerald-600 bg-emerald-50',
  deadline: 'text-amber-600 bg-amber-50',
  system: 'text-primary-container bg-primary-container/10',
};

export default function NotificationPanel({
  filings = [],
  transactions = [],
  isNINLinked = true,
  accountMode = 'personal',
}: NotificationPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [state, setState] = useUserPersistedState<{ read: string[]; dismissed: string[] }>(
    'notification_state',
    { read: [], dismissed: [] }
  );
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useMemo<Notification[]>(() => {
    const items: Omit<Notification, 'read'>[] = [];
    if (!isNINLinked) {
      items.push({
        id: 'compliance-nin',
        type: 'compliance',
        title: 'Link your NIN',
        message: 'Link your National Identification Number to prepare and record tax returns.',
        time: 'Action required',
      });
    }
    filings
      .filter(f => f.status !== 'Paid')
      .slice(0, 3)
      .forEach(f => items.push({
        id: `filing-${f.id}-${f.status}`,
        type: 'filing',
        title: `${f.type} — ${f.status}`,
        message: `${f.period} return (ref ${f.receiptNumber}) for ₦${f.amount.toLocaleString()} is ${f.status === 'Pending' ? 'awaiting payment and submission' : 'being processed'}.`,
        time: relativeTime(f.dateFiled),
      }));
    items.push(...upcomingDeadlines(accountMode));
    const latest = transactions[0];
    if (latest) {
      items.push({
        id: `tx-${latest.id}`,
        type: 'system',
        title: 'Receipt recorded',
        message: `${latest.merchant} (₦${latest.amount.toLocaleString()}) is in your ledger.`,
        time: latest.date,
      });
    }
    return items
      .filter(n => !state.dismissed.includes(n.id))
      .map(n => ({ ...n, read: state.read.includes(n.id) }));
  }, [filings, transactions, isNINLinked, accountMode, state]);

  const unreadCount = notifications.filter(n => !n.read).length;

  // Close on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  const markAllRead = () => {
    setState(prev => ({ ...prev, read: Array.from(new Set([...prev.read, ...notifications.map(n => n.id)])) }));
  };

  const dismissNotification = (id: string) => {
    setState(prev => ({ ...prev, dismissed: [...prev.dismissed, id] }));
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="text-on-surface-variant hover:bg-secondary-container rounded-full p-2 transition-colors active:scale-95 cursor-pointer relative"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full animate-pulse" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-12 w-80 sm:w-96 bg-white border border-outline-variant rounded-2xl shadow-xl overflow-hidden z-50"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-outline-variant/40 flex items-center justify-between bg-surface-container-low">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-primary-container">Notifications</span>
                {unreadCount > 0 && (
                  <span className="text-[9px] font-bold bg-error text-white px-1.5 py-0.5 rounded-full">
                    {unreadCount}
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-bold text-primary-container hover:underline cursor-pointer"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification List */}
            <div className="max-h-80 overflow-y-auto divide-y divide-outline-variant/20">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="w-8 h-8 text-on-surface-variant/30 mx-auto mb-2" />
                  <p className="text-xs text-on-surface-variant">No notifications</p>
                </div>
              ) : (
                notifications.map(n => {
                  const Icon = ICON_MAP[n.type];
                  const colorClass = ICON_COLORS[n.type];
                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 flex items-start gap-3 group transition-colors ${
                        n.read ? 'bg-white' : 'bg-primary-container/[0.03]'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${colorClass}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="flex-grow min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs leading-snug ${n.read ? 'font-medium text-on-surface' : 'font-bold text-primary-container'}`}>
                            {n.title}
                          </p>
                          <button
                            onClick={() => dismissNotification(n.id)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded hover:bg-surface-container cursor-pointer flex-shrink-0"
                          >
                            <X className="w-3 h-3 text-on-surface-variant" />
                          </button>
                        </div>
                        <p className="text-[10px] text-on-surface-variant leading-relaxed mt-0.5">{n.message}</p>
                        <p className="text-[9px] text-on-surface-variant/60 mt-1 font-medium">{n.time}</p>
                      </div>
                      {!n.read && (
                        <div className="w-1.5 h-1.5 bg-primary-container rounded-full mt-2 flex-shrink-0" />
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-2.5 border-t border-outline-variant/40 bg-surface-container-low text-center">
                <span className="text-[10px] font-medium text-on-surface-variant">
                  Based on your filings, receipts and statutory deadlines
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

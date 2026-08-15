import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, FileText, ShieldCheck, Calendar, CheckCircle, X } from 'lucide-react';

interface Notification {
  id: string;
  type: 'filing' | 'compliance' | 'deadline' | 'system';
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const MOCK_NOTIFICATIONS: Notification[] = [
  {
    id: 'n1',
    type: 'filing',
    title: 'VAT Return Due',
    message: 'Your monthly VAT return for July 2026 is due by August 21st.',
    time: '2 hours ago',
    read: false,
  },
  {
    id: 'n2',
    type: 'compliance',
    title: 'TCC Renewal Reminder',
    message: 'Your Tax Clearance Certificate expires in 45 days. File outstanding returns to auto-renew.',
    time: '1 day ago',
    read: false,
  },
  {
    id: 'n3',
    type: 'system',
    title: 'Receipt Synced Successfully',
    message: 'Manda Office Rent Ltd receipt (₦150,000) has been added to your deductions ledger.',
    time: '3 days ago',
    read: true,
  },
  {
    id: 'n4',
    type: 'deadline',
    title: 'Quarterly Estimated Tax',
    message: 'Q3 2026 estimated income tax payment deadline is September 30, 2026.',
    time: '5 days ago',
    read: true,
  },
];

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

export default function NotificationPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);
  const panelRef = useRef<HTMLDivElement>(null);

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
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
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
                <button className="text-[10px] font-bold text-primary-container hover:underline cursor-pointer">
                  View All Activity
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

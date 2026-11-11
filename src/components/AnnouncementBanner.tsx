import { useState } from 'react';
import { Info, AlertTriangle, ShieldAlert, X } from 'lucide-react';
import { usePlatformSettings } from '../admin/platformStore';
import { isAnnouncementVisible } from '../admin/platformSettings';

const TONE = {
  info: { cls: 'bg-sky-50 border-sky-200 text-sky-900', Icon: Info },
  warning: { cls: 'bg-amber-50 border-amber-200 text-amber-900', Icon: AlertTriangle },
  critical: { cls: 'bg-red-50 border-red-200 text-red-900', Icon: ShieldAlert },
};

/** Admin-broadcast banner (platform_config/settings.announcement). */
export default function AnnouncementBanner({ accountType }: { accountType: 'individual' | 'business' }) {
  const { announcement } = usePlatformSettings();
  const [dismissedMessage, setDismissedMessage] = useState<string | null>(null);
  if (!isAnnouncementVisible(announcement, accountType) || dismissedMessage === announcement.message) return null;
  const { cls, Icon } = TONE[announcement.tone];
  return (
    <div role="status" className={`mb-6 p-4 rounded-xl border flex items-start gap-3 text-sm ${cls}`}>
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="flex-1 whitespace-pre-line">{announcement.message}</p>
      {announcement.tone !== 'critical' && (
        <button onClick={() => setDismissedMessage(announcement.message)} aria-label="Dismiss announcement" className="p-1 rounded hover:bg-black/5 cursor-pointer">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}


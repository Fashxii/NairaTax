/**
 * ContentPanel.tsx — Site content (CMS) and dashboard announcements.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Megaphone, Save, Lock, Eye } from 'lucide-react';
import { useToast } from '../Toast';
import CMSManager from '../CMSManager';
import { usePermissions } from '../../admin/usePermissions';
import { usePlatformSettingsState, savePlatformSettings, describeWriteError } from '../../admin/platformStore';
import { isAnnouncementVisible, type Announcement } from '../../admin/platformSettings';
import { recordAuditLog } from '../../utils/auditLogger';

const TONE_CLS = {
  info: 'bg-sky-50 border-sky-200 text-sky-900',
  warning: 'bg-amber-50 border-amber-200 text-amber-900',
  critical: 'bg-red-50 border-red-200 text-red-900',
};

function AnnouncementEditor() {
  const { showToast } = useToast();
  const { can, actorEmail, actorName } = usePermissions();
  const live = usePlatformSettingsState();
  const canEdit = can('announcements.manage');
  const [draft, setDraft] = useState<Announcement>(live.value.announcement);
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(draft) !== JSON.stringify(live.value.announcement);

  useEffect(() => {
    if (!dirty) setDraft(live.value.announcement);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.value]);

  const save = async () => {
    if (draft.enabled && !draft.message.trim()) return showToast('error', 'Message required', 'Write the announcement text first.');
    setSaving(true);
    try {
      await savePlatformSettings({ ...live.value, announcement: { ...draft, message: draft.message.trim() } }, actorEmail);
      recordAuditLog({
        actorName, actorEmail, module: 'Content', severity: 'INFO',
        action: draft.enabled ? 'PUBLISH_ANNOUNCEMENT' : 'WITHDRAW_ANNOUNCEMENT',
        afterState: { ...draft },
      });
      showToast('success', draft.enabled ? 'Announcement live' : 'Announcement withdrawn');
    } catch (err) {
      showToast('error', 'Not saved', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const liveNow = isAnnouncementVisible(live.value.announcement, 'individual') || isAnnouncementVisible(live.value.announcement, 'business');

  return (
    <div className="max-w-4xl mx-auto bg-white border border-outline-variant rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-on-surface flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary-container" /> Dashboard announcement</h3>
          <p className="text-xs text-on-surface-variant">A banner shown at the top of every taxpayer’s dashboard — deadlines, outages, policy changes.</p>
        </div>
        <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-full ${liveNow ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>{liveNow ? 'Live' : 'Not showing'}</span>
      </div>
      {!canEdit && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: requires “Broadcast announcements”.</p>}
      <fieldset disabled={!canEdit} className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <label className="md:col-span-3 block">
          <span className="font-bold block mb-1">Message</span>
          <textarea rows={3} maxLength={500} value={draft.message} onChange={(e) => setDraft({ ...draft, message: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-outline-variant" placeholder="e.g. VAT returns for October are due on 21 November." />
          <span className="text-[10px] text-on-surface-variant">{draft.message.length}/500</span>
        </label>
        <label className="block">
          <span className="font-bold block mb-1">Tone</span>
          <select value={draft.tone} onChange={(e) => setDraft({ ...draft, tone: e.target.value as Announcement['tone'] })} className="w-full h-10 px-3 rounded-lg border border-outline-variant">
            <option value="info">Information</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical (cannot be dismissed)</option>
          </select>
        </label>
        <label className="block">
          <span className="font-bold block mb-1">Audience</span>
          <select value={draft.audience} onChange={(e) => setDraft({ ...draft, audience: e.target.value as Announcement['audience'] })} className="w-full h-10 px-3 rounded-lg border border-outline-variant">
            <option value="all">All taxpayers</option>
            <option value="individual">Individuals only</option>
            <option value="business">Businesses only</option>
          </select>
        </label>
        <label className="block">
          <span className="font-bold block mb-1">Hide after (optional)</span>
          <input type="date" value={draft.expiresOn} onChange={(e) => setDraft({ ...draft, expiresOn: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-outline-variant" />
        </label>
        <label className="flex items-center gap-2 font-bold cursor-pointer">
          <input type="checkbox" checked={draft.enabled} onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })} className="w-4 h-4 accent-[#013220]" />
          Show this announcement
        </label>
      </fieldset>
      {draft.message.trim() && (
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant mb-1 flex items-center gap-1"><Eye className="w-3 h-3" /> Preview</p>
          <div className={`p-3 rounded-xl border text-sm ${TONE_CLS[draft.tone]}`}>{draft.message}</div>
        </div>
      )}
      {canEdit && (
        <div className="flex justify-end">
          <button onClick={save} disabled={!dirty || saving} className="h-10 px-5 bg-[#013220] text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            <Save className="w-4 h-4" /> {saving ? 'Publishing…' : 'Publish announcement'}
          </button>
        </div>
      )}
    </div>
  );
}

export default function ContentPanel() {
  const { can } = usePermissions();
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      {can('announcements.manage') || can('cms.edit') ? <AnnouncementEditor /> : null}
      <CMSManager />
    </motion.div>
  );
}


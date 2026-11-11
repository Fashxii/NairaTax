/**
 * SystemSettingsPanel.tsx — Platform settings: feature flags and maintenance mode.
 *
 * Writes Firestore `platform_config/settings`. Every control here has a real
 * consumer (see FEATURE_FLAGS[].affects); changes reach open sessions live.
 * Statutory tax figures moved to the Tax Rules tab; session policy to Security.
 */

import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Save, AlertTriangle, Sliders, Wrench, Lock, RotateCcw } from 'lucide-react';
import { useToast } from '../Toast';
import { usePermissions } from '../../admin/usePermissions';
import { usePlatformSettingsState, savePlatformSettings, describeWriteError } from '../../admin/platformStore';
import { FEATURE_FLAGS, defaultSettings, type PlatformSettings } from '../../admin/platformSettings';
import { recordAuditLog } from '../../utils/auditLogger';

export default function SystemSettingsPanel() {
  const { showToast } = useToast();
  const { can, actorEmail, actorName } = usePermissions();
  const live = usePlatformSettingsState();
  const [draft, setDraft] = useState<PlatformSettings>(live.value);
  const [saving, setSaving] = useState(false);
  const canFlags = can('system.flags');
  const canMaintenance = can('system.maintenance');

  const dirty =
    JSON.stringify(draft.flags) !== JSON.stringify(live.value.flags) ||
    JSON.stringify(draft.maintenance) !== JSON.stringify(live.value.maintenance);

  useEffect(() => {
    if (!dirty) setDraft(live.value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [live.value]);

  const handleSave = async () => {
    setSaving(true);
    // Only overwrite the slices this panel owns, on top of the latest live values.
    const next: PlatformSettings = {
      ...live.value,
      flags: canFlags ? draft.flags : live.value.flags,
      maintenance: canMaintenance ? draft.maintenance : live.value.maintenance,
    };
    try {
      await savePlatformSettings(next, actorEmail);
      const changedFlags = FEATURE_FLAGS.filter((f) => next.flags[f.id] !== live.value.flags[f.id]).map((f) => `${f.id}:${next.flags[f.id] ? 'on' : 'off'}`);
      const maintenanceChanged = next.maintenance.enabled !== live.value.maintenance.enabled;
      recordAuditLog({
        actorName,
        actorEmail,
        action: maintenanceChanged ? (next.maintenance.enabled ? 'ENABLE_MAINTENANCE_MODE' : 'DISABLE_MAINTENANCE_MODE') : 'UPDATE_FEATURE_FLAGS',
        module: 'Platform',
        severity: maintenanceChanged ? 'CRITICAL' : 'WARN',
        beforeState: { flags: live.value.flags, maintenance: live.value.maintenance.enabled },
        afterState: { changedFlags, maintenance: next.maintenance.enabled },
      });
      showToast('success', 'Settings published', 'Changes are live for all users.');
    } catch (err) {
      showToast('error', 'Not saved', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = FEATURE_FLAGS.filter((f) => draft.flags[f.id]).length;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">Platform Settings</h3>
          <p className="text-xs text-on-surface-variant mt-1">Turn product features on or off and control maintenance mode. Changes apply to every open session within seconds.</p>
          <p className="text-[11px] text-on-surface-variant mt-1">
            {live.exists ? `Last published ${live.value.updatedAt?.slice(0, 16).replace('T', ' ')} by ${live.value.updatedBy}` : 'Using built-in defaults (nothing published yet).'}
            {live.error && <span className="text-error"> · {live.error}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button onClick={() => setDraft(live.value)} className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold cursor-pointer flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Discard
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving || !dirty || (!canFlags && !canMaintenance)}
            className="px-4 py-2 bg-primary-container text-white rounded-xl text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5 text-accent-green" /> {saving ? 'Publishing…' : 'Publish settings'}
          </button>
        </div>
      </div>

      {draft.maintenance.enabled && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold">Maintenance mode {live.value.maintenance.enabled ? 'is ACTIVE' : 'will be enabled when you publish'}</p>
            <p className="text-[11px] text-red-700">Taxpayers see the maintenance notice and cannot request sign-in codes. Staff can still sign in at /admin.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Feature flags */}
        <div className="lg:col-span-2 bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-outline-variant/40">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-primary-container" />
              <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Feature flags</h4>
            </div>
            <span className="text-[11px] font-bold text-on-surface-variant">{enabledCount}/{FEATURE_FLAGS.length} on</span>
          </div>
          {!canFlags && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: requires “Toggle feature flags”.</p>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
            {FEATURE_FLAGS.map((f) => (
              <label key={f.id} className={`flex items-start justify-between gap-3 p-3 border rounded-xl ${draft.flags[f.id] ? 'border-emerald-200 bg-emerald-50/40' : 'border-outline-variant/60 bg-surface-container-low'} ${canFlags ? 'cursor-pointer' : 'cursor-not-allowed opacity-80'}`}>
                <span className="min-w-0">
                  <span className="font-bold text-on-surface block">{f.label}</span>
                  <span className="text-[10px] text-on-surface-variant block">{f.description}</span>
                  <span className="text-[10px] text-primary-container/70 block mt-0.5">↳ {f.affects}</span>
                </span>
                <input
                  type="checkbox"
                  role="switch"
                  checked={draft.flags[f.id]}
                  disabled={!canFlags}
                  onChange={(e) => setDraft((d) => ({ ...d, flags: { ...d.flags, [f.id]: e.target.checked } }))}
                  className="mt-1 w-4 h-4 accent-[#013220]"
                />
              </label>
            ))}
          </div>
          {canFlags && (
            <button onClick={() => setDraft((d) => ({ ...d, flags: defaultSettings().flags }))} className="text-[11px] font-bold text-primary-container hover:underline cursor-pointer">
              Turn all features on (defaults)
            </button>
          )}
        </div>

        {/* Maintenance */}
        <div className="bg-white border border-red-200 rounded-2xl p-6 shadow-xs space-y-4 h-fit">
          <div className="flex items-center gap-2 pb-3 border-b border-red-100">
            <Wrench className="w-4 h-4 text-red-700" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-red-800">Maintenance mode</h4>
          </div>
          {!canMaintenance && <p className="text-[11px] text-amber-700 flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Read-only: requires “Maintenance mode”.</p>}
          <label className={`flex items-center justify-between gap-3 text-xs font-bold ${canMaintenance ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
            Block taxpayer access
            <input
              type="checkbox"
              role="switch"
              checked={draft.maintenance.enabled}
              disabled={!canMaintenance}
              onChange={(e) => setDraft((d) => ({ ...d, maintenance: { ...d.maintenance, enabled: e.target.checked } }))}
              className="w-4 h-4 accent-red-700"
            />
          </label>
          <label className="block text-xs">
            <span className="font-bold block mb-1">Message shown to taxpayers</span>
            <textarea
              rows={4}
              value={draft.maintenance.message}
              disabled={!canMaintenance}
              onChange={(e) => setDraft((d) => ({ ...d, maintenance: { ...d.maintenance, message: e.target.value } }))}
              className="w-full px-3 py-2 rounded-lg border border-outline-variant text-xs"
            />
          </label>
          <p className="text-[10px] text-on-surface-variant">Enforced on the landing page and dashboard, and by the sign-in code service once the updated Cloud Functions are deployed.</p>
        </div>
      </div>
    </motion.div>
  );
}

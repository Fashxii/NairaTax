/**
 * StatutoryOverridesModal — super-admin control for per-profile statutory toggles.
 *
 * Individuals: switch on pre-2026 reliefs (disability, children, dependant
 * relative, approved charity) once the taxpayer's statutory status is verified.
 * Businesses: force the CIT bracket and/or VAT status.
 *
 * Writes users/{email}.statutoryOverrides (super_admin only per firestore.rules)
 * and records an audit log entry.
 */
import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { X, ShieldCheck, Scale, Receipt, HeartHandshake, Loader2 } from 'lucide-react';
import {
  APPROVED_RELIEFS,
  CIT_BRACKET_LABELS,
  VAT_STATUS_LABELS,
  DEFAULT_OVERRIDES,
  StatutoryOverrides,
  CitBracketOverride,
  VatStatusOverride,
  loadStatutoryOverrides,
  saveStatutoryOverrides,
} from '../../utils/statutoryOverrides';
import { recordAuditLog } from '../../utils/auditLogger';
import { useToast } from '../Toast';
import { formatNaira } from '../../utils/taxEngine';

interface Props {
  user: { email: string; fullName: string; accountType: string };
  actorEmail: string;
  onClose: () => void;
}

function Switch({ id, checked, onChange, label }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-emerald-600' : 'bg-gray-300'
      }`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function StatutoryOverridesModal({ user, actorEmail, onClose }: Props) {
  const { showToast } = useToast();
  const isBusiness = user.accountType === 'business';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [initial, setInitial] = useState<StatutoryOverrides>(DEFAULT_OVERRIDES);
  const [draft, setDraft] = useState<StatutoryOverrides>(DEFAULT_OVERRIDES);

  useEffect(() => {
    let alive = true;
    loadStatutoryOverrides(user.email).then((o) => {
      if (!alive) return;
      setInitial(o);
      setDraft(o);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [user.email]);

  const setRelief = (key: keyof StatutoryOverrides['reliefs'], v: boolean) =>
    setDraft((d) => ({ ...d, reliefs: { ...d.reliefs, [key]: v } }));

  const setCorporate = (patch: Partial<StatutoryOverrides['corporate']>) =>
    setDraft((d) => ({ ...d, corporate: { ...d.corporate, ...patch } }));

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveStatutoryOverrides(user.email, draft, actorEmail);
      recordAuditLog({
        actorName: 'Super Admin',
        actorEmail,
        action: 'UPDATE_STATUTORY_OVERRIDES',
        module: 'User Management',
        severity: 'WARN',
        beforeState: { email: user.email, ...initial },
        afterState: { email: user.email, ...saved },
      });
      showToast('success', 'Statutory status updated', `Overrides saved for ${user.fullName}.`);
      onClose();
    } catch (err: any) {
      showToast('error', 'Save failed', err?.message || 'Only super admins can change statutory overrides.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white border border-outline-variant rounded-2xl max-w-lg w-full p-6 shadow-xl relative text-left max-h-[90vh] overflow-y-auto"
      >
        <button onClick={onClose} aria-label="Close" className="absolute top-4 right-4 p-1 rounded-lg hover:bg-surface-container cursor-pointer">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 pb-4 border-b border-outline-variant/40 mb-4">
          <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-emerald-700" />
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-primary-container">Statutory Status Overrides</h4>
            <p className="text-xs text-on-surface-variant">
              {user.fullName} · <span className="font-mono">{user.email}</span> · {isBusiness ? 'Business' : 'Individual'}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="py-10 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-primary-container" />
          </div>
        ) : (
          <div className="space-y-5 text-xs">
            {!isBusiness && (
              <section className="space-y-2">
                <p className="font-bold text-on-surface flex items-center gap-1.5">
                  <HeartHandshake className="w-4 h-4 text-emerald-700" /> Approved personal reliefs
                </p>
                <p className="text-[11px] text-on-surface-variant">
                  Not general reliefs under the NTA 2025. Switch on only after verifying the taxpayer's statutory status.
                </p>
                <div className="divide-y divide-outline-variant/30 border border-outline-variant/50 rounded-xl">
                  {APPROVED_RELIEFS.map((r) => (
                    <div key={r.key} className="flex items-center justify-between gap-3 p-3">
                      <div>
                        <p className="font-semibold text-on-surface">{r.label}</p>
                        <p className="text-[10px] text-on-surface-variant">
                          {r.statutoryBasis} · {formatNaira(r.amount)}/yr
                        </p>
                      </div>
                      <Switch
                        id={`override-relief-${r.key}`}
                        label={r.label}
                        checked={draft.reliefs[r.key]}
                        onChange={(v) => setRelief(r.key, v)}
                      />
                    </div>
                  ))}
                </div>
              </section>
            )}

            {isBusiness && (
              <>
                <section className="space-y-2">
                  <label htmlFor="override-cit" className="font-bold text-on-surface flex items-center gap-1.5">
                    <Scale className="w-4 h-4 text-emerald-700" /> CIT bracket
                  </label>
                  <select
                    id="override-cit"
                    value={draft.corporate.citBracket}
                    onChange={(e) => setCorporate({ citBracket: e.target.value as CitBracketOverride })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none"
                  >
                    {(Object.keys(CIT_BRACKET_LABELS) as CitBracketOverride[]).map((k) => (
                      <option key={k} value={k}>{CIT_BRACKET_LABELS[k]}</option>
                    ))}
                  </select>
                </section>

                <section className="space-y-2">
                  <label htmlFor="override-vat" className="font-bold text-on-surface flex items-center gap-1.5">
                    <Receipt className="w-4 h-4 text-emerald-700" /> VAT status
                  </label>
                  <select
                    id="override-vat"
                    value={draft.corporate.vatStatus}
                    onChange={(e) => setCorporate({ vatStatus: e.target.value as VatStatusOverride })}
                    className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none"
                  >
                    {(Object.keys(VAT_STATUS_LABELS) as VatStatusOverride[]).map((k) => (
                      <option key={k} value={k}>{VAT_STATUS_LABELS[k]}</option>
                    ))}
                  </select>
                  <p className="text-[10px] text-on-surface-variant">"Exempt" stops 7.5% VAT being added to this company's invoices.</p>
                </section>
              </>
            )}

            <section className="space-y-1.5">
              <label htmlFor="override-note" className="font-bold text-on-surface block">Justification / evidence reference</label>
              <textarea
                id="override-note"
                rows={2}
                value={draft.note || ''}
                onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                placeholder="e.g. Disability certificate verified on 2026-03-01 (ref. JONAPWD/123)"
                className="w-full bg-surface-container-low border border-outline rounded-lg p-2.5 text-xs focus:outline-none focus:border-primary-container"
              />
              {initial.updatedAt && (
                <p className="text-[10px] text-on-surface-variant">
                  Last changed {new Date(initial.updatedAt).toLocaleString('en-NG')} by {initial.updatedBy}
                </p>
              )}
            </section>
          </div>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-outline-variant rounded-xl font-bold text-xs cursor-pointer hover:bg-surface-container">
            Cancel
          </button>
          <button
            id="override-save"
            onClick={handleSave}
            disabled={loading || saving}
            className="px-4 py-2 bg-primary-container text-white rounded-xl font-bold text-xs cursor-pointer hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save overrides
          </button>
        </div>
      </motion.div>
    </div>
  );
}

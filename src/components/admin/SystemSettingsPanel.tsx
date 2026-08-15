import { useState } from 'react';
import { motion } from 'motion/react';
import { Save, RefreshCw, AlertTriangle, Sliders, ShieldCheck, ToggleLeft, ToggleRight, DollarSign } from 'lucide-react';
import { useToast } from '../Toast';

export interface SystemSettings {
  // Tax Parameters
  vatRate: number; // e.g. 7.5
  craPercentage: number; // e.g. 20
  craFixedBase: number; // e.g. 200000
  citSmallRate: number; // 0%
  citMediumRate: number; // 20%
  citLargeRate: number; // 30%
  penaltyRate: number; // 10%
  
  // Feature Toggles
  enableEFiling: boolean;
  enableBankSync: boolean;
  enableReceiptOCR: boolean;
  enableTccAutoIssuance: boolean;
  maintenanceMode: boolean;

  // Limits
  sessionTimeoutHours: number;
  maxFileUploadMb: number;
  apiRateLimitPerMin: number;
}

const DEFAULT_SETTINGS: SystemSettings = {
  vatRate: 7.5,
  craPercentage: 20,
  craFixedBase: 200000,
  citSmallRate: 0,
  citMediumRate: 20,
  citLargeRate: 30,
  penaltyRate: 10,
  enableEFiling: true,
  enableBankSync: true,
  enableReceiptOCR: true,
  enableTccAutoIssuance: true,
  maintenanceMode: false,
  sessionTimeoutHours: 24,
  maxFileUploadMb: 10,
  apiRateLimitPerMin: 120,
};

export default function SystemSettingsPanel() {
  const { showToast } = useToast();
  const [settings, setSettings] = useState<SystemSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = () => {
    setIsSaving(true);
    setTimeout(() => {
      setIsSaving(false);
      showToast('success', 'Settings Saved', 'Global application parameters and system defaults updated.');
    }, 800);
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
    showToast('info', 'Settings Reset', 'Restored default statutory tax laws and system limits.');
  };

  const toggleFlag = (key: keyof SystemSettings) => {
    setSettings((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-left"
    >
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 border border-outline-variant rounded-2xl shadow-xs">
        <div>
          <h3 className="text-lg font-black text-primary-container tracking-tight">Global System Variables &amp; Tax Policy Defaults</h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure statutory tax parameters, platform feature flags, and operational rate limits.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleReset}
            className="px-3.5 py-2 border border-outline-variant hover:bg-surface-container rounded-xl text-xs font-bold text-on-surface transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5 text-on-surface-variant" />
            <span>Reset Defaults</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary-container hover:bg-primary-container/90 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5 text-accent-green" />
            <span>{isSaving ? 'Saving...' : 'Save Configuration'}</span>
          </button>
        </div>
      </div>

      {/* Maintenance Mode Warning */}
      {settings.maintenanceMode && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-xl flex items-center gap-3 text-red-900 shadow-xs">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          <div>
            <p className="text-xs font-bold">System Maintenance Mode Active</p>
            <p className="text-[11px] text-red-700">
              Taxpayer login and self-assessment filing endpoints are currently disabled for public users.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Section 1: Statutory Tax Parameters */}
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40">
            <DollarSign className="w-4 h-4 text-primary-container" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Statutory Nigerian Tax Defaults</h4>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-bold text-on-surface block mb-1">VAT Rate (%)</label>
              <input
                type="number"
                step="0.1"
                value={settings.vatRate}
                onChange={(e) => setSettings({ ...settings, vatRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
              />
              <span className="text-[10px] text-on-surface-variant">Standard Value Added Tax (FIRS)</span>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">CRA Rate (% of Gross)</label>
              <input
                type="number"
                value={settings.craPercentage}
                onChange={(e) => setSettings({ ...settings, craPercentage: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
              />
              <span className="text-[10px] text-on-surface-variant">Consolidated Relief Allowance (PITA)</span>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">CRA Base Relief (NGN)</label>
              <input
                type="number"
                value={settings.craFixedBase}
                onChange={(e) => setSettings({ ...settings, craFixedBase: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
              />
              <span className="text-[10px] text-on-surface-variant">Fixed base CRA deduction (₦200k)</span>
            </div>

            <div>
              <label className="font-bold text-on-surface block mb-1">Penalty Penalty Rate (%)</label>
              <input
                type="number"
                value={settings.penaltyRate}
                onChange={(e) => setSettings({ ...settings, penaltyRate: parseFloat(e.target.value) || 0 })}
                className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
              />
              <span className="text-[10px] text-on-surface-variant">Late filing statutory penalty</span>
            </div>
          </div>
        </div>

        {/* Section 2: Platform Feature Flags */}
        <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40">
            <Sliders className="w-4 h-4 text-primary-container" />
            <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Platform Feature Flags</h4>
          </div>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between p-3 border border-outline-variant/50 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-bold text-on-surface">Automated e-Filing Engine</p>
                <p className="text-[10px] text-on-surface-variant">Allows taxpayers to submit self-assessment returns to FIRS</p>
              </div>
              <button onClick={() => toggleFlag('enableEFiling')} className="cursor-pointer">
                {settings.enableEFiling ? (
                  <ToggleRight className="w-7 h-7 text-primary-container" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-on-surface-variant/40" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-outline-variant/50 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-bold text-on-surface">Mono Open Banking Sync</p>
                <p className="text-[10px] text-on-surface-variant">Enables live bank statement fetching via Mono API</p>
              </div>
              <button onClick={() => toggleFlag('enableBankSync')} className="cursor-pointer">
                {settings.enableBankSync ? (
                  <ToggleRight className="w-7 h-7 text-primary-container" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-on-surface-variant/40" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-outline-variant/50 rounded-xl bg-surface-container-low">
              <div>
                <p className="font-bold text-on-surface">TCC Automatic Issuance</p>
                <p className="text-[10px] text-on-surface-variant">Auto-generates TCC certificates when 3-year history is clear</p>
              </div>
              <button onClick={() => toggleFlag('enableTccAutoIssuance')} className="cursor-pointer">
                {settings.enableTccAutoIssuance ? (
                  <ToggleRight className="w-7 h-7 text-primary-container" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-on-surface-variant/40" />
                )}
              </button>
            </div>

            <div className="flex items-center justify-between p-3 border border-red-200 rounded-xl bg-red-50/50">
              <div>
                <p className="font-bold text-red-900">Maintenance Mode</p>
                <p className="text-[10px] text-red-700">Disable non-admin user access for emergency maintenance</p>
              </div>
              <button onClick={() => toggleFlag('maintenanceMode')} className="cursor-pointer">
                {settings.maintenanceMode ? (
                  <ToggleRight className="w-7 h-7 text-red-600" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-on-surface-variant/40" />
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: System Thresholds */}
      <div className="bg-white border border-outline-variant rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-outline-variant/40 mb-4">
          <ShieldCheck className="w-4 h-4 text-primary-container" />
          <h4 className="font-extrabold text-xs uppercase tracking-wider text-primary-container">Operational Limits &amp; Security Quotas</h4>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="font-bold text-on-surface block mb-1">Session Expiry (Hours)</label>
            <input
              type="number"
              value={settings.sessionTimeoutHours}
              onChange={(e) => setSettings({ ...settings, sessionTimeoutHours: parseInt(e.target.value) || 24 })}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
            />
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">Max Upload Size (MB)</label>
            <input
              type="number"
              value={settings.maxFileUploadMb}
              onChange={(e) => setSettings({ ...settings, maxFileUploadMb: parseInt(e.target.value) || 10 })}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
            />
          </div>

          <div>
            <label className="font-bold text-on-surface block mb-1">API Rate Limit (Req/Min)</label>
            <input
              type="number"
              value={settings.apiRateLimitPerMin}
              onChange={(e) => setSettings({ ...settings, apiRateLimitPerMin: parseInt(e.target.value) || 60 })}
              className="w-full bg-surface-container-low border border-outline-variant rounded-lg p-2.5 font-mono text-xs focus:outline-none focus:border-primary-container"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

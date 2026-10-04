/**
 * EmailSettingsPanel.tsx — SMTP Configuration & Live Test Console
 *
 * Super Admin panel for configuring SMTP server settings with:
 * - Provider presets (SendGrid, SES, Mailgun, Brevo, Postmark, Gmail, Custom)
 * - Credential management with masked password field
 * - Live SMTP connection tester with terminal-style diagnostics
 * - Sender identity configuration
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail, Server, Shield, Send, CheckCircle, XCircle,
  Loader2, Eye, EyeOff, Zap, RefreshCw, Settings,
  ChevronDown, AlertTriangle,
} from 'lucide-react';
import type { SMTPSettings, SMTPProvider, SMTPTestStep } from '../../types/email';
import {
  getSMTPSettings, saveSMTPSettings, SMTP_PRESETS,
  getPresetForProvider, testSMTPConnection, getEmailStats,
} from '../../utils/emailService';

const fadeIn = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -12 },
  transition: { duration: 0.25 },
};

const DEFAULT_SETTINGS: SMTPSettings = {
  provider: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: { user: '', pass: '' },
  senderName: 'DIYtax9ja Tax Portal',
  senderEmail: '',
  replyTo: '',
  enableTracking: false,
  active: false,
};

export default function EmailSettingsPanel() {
  const [settings, setSettings] = useState<SMTPSettings>(() => getSMTPSettings() || DEFAULT_SETTINGS);
  const [showPassword, setShowPassword] = useState(false);
  const [saved, setSaved] = useState(false);

  // Test console state
  const [testEmail, setTestEmail] = useState('');
  const [testing, setTesting] = useState(false);
  const [testSteps, setTestSteps] = useState<SMTPTestStep[]>([]);
  const [testResult, setTestResult] = useState<'success' | 'failure' | null>(null);
  const [testLatency, setTestLatency] = useState<number | null>(null);

  // Email stats
  const [stats, setStats] = useState({ totalSent: 0, totalFailed: 0, todaySent: 0, sandboxCount: 0 });

  useEffect(() => {
    setStats(getEmailStats());
  }, []);

  const handleProviderChange = (provider: SMTPProvider) => {
    const preset = getPresetForProvider(provider);
    if (preset) {
      setSettings(prev => ({
        ...prev,
        provider,
        host: preset.host,
        port: preset.port,
        secure: preset.secure,
      }));
    } else {
      setSettings(prev => ({ ...prev, provider }));
    }
  };

  const handleSave = () => {
    saveSMTPSettings(settings);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleTest = async () => {
    if (!testEmail.includes('@')) return;
    setTesting(true);
    setTestSteps([]);
    setTestResult(null);
    setTestLatency(null);

    const result = await testSMTPConnection(settings, testEmail);

    // Animate steps one by one
    for (let i = 0; i < result.steps.length; i++) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setTestSteps(prev => [...prev, result.steps[i]]);
    }

    setTestResult(result.success ? 'success' : 'failure');
    setTestLatency(result.latencyMs || null);
    setTesting(false);

    if (result.success) {
      setSettings(prev => ({
        ...prev,
        lastTestedAt: new Date().toISOString(),
        lastTestResult: 'success',
      }));
    }
  };

  const selectedPreset = getPresetForProvider(settings.provider);

  return (
    <motion.div {...fadeIn} className="space-y-6">
      {/* KPI Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Sent', value: stats.totalSent.toLocaleString(), icon: Send, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Failed', value: stats.totalFailed.toLocaleString(), icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'Today', value: stats.todaySent.toLocaleString(), icon: Zap, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Sandbox', value: stats.sandboxCount.toLocaleString(), icon: Mail, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white border border-outline-variant rounded-xl p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} ${kpi.color} flex items-center justify-center flex-shrink-0`}>
              <kpi.icon className="w-4.5 h-4.5" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">{kpi.label}</p>
              <p className={`text-lg font-black font-mono ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ── Left: SMTP Configuration ─────────────────────────────── */}
        <div className="lg:col-span-3 space-y-5">
          {/* Provider Selection */}
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs">
            <div className="flex items-center gap-2 mb-4">
              <Server className="w-4.5 h-4.5 text-primary-container" />
              <h3 className="text-sm font-bold text-on-surface">SMTP Provider</h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mb-4">
              {SMTP_PRESETS.map(preset => (
                <button
                  key={preset.provider}
                  onClick={() => handleProviderChange(preset.provider)}
                  className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                    settings.provider === preset.provider
                      ? 'border-accent-green bg-emerald-50 shadow-xs'
                      : 'border-outline-variant/40 hover:border-outline-variant hover:bg-surface-container-low'
                  }`}
                >
                  <span className="text-lg">{preset.icon}</span>
                  <p className="text-xs font-bold mt-1 text-on-surface">{preset.label}</p>
                </button>
              ))}
            </div>

            {selectedPreset && (
              <div className="bg-surface-container-low rounded-lg p-3 flex items-start gap-2">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-on-surface-variant leading-relaxed">{selectedPreset.authHint}</p>
              </div>
            )}
          </div>

          {/* Server Configuration */}
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-4.5 h-4.5 text-primary-container" />
              <h3 className="text-sm font-bold text-on-surface">Server Configuration</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Host</label>
                <input
                  type="text"
                  value={settings.host}
                  onChange={e => setSettings(s => ({ ...s, host: e.target.value }))}
                  placeholder="smtp.example.com"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Port</label>
                  <input
                    type="number"
                    value={settings.port}
                    onChange={e => setSettings(s => ({ ...s, port: Number(e.target.value) }))}
                    className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Security</label>
                  <div className="mt-1 relative">
                    <select
                      value={settings.secure ? 'ssl' : 'starttls'}
                      onChange={e => setSettings(s => ({ ...s, secure: e.target.value === 'ssl' }))}
                      className="w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40 appearance-none cursor-pointer"
                    >
                      <option value="ssl">SSL/TLS</option>
                      <option value="starttls">STARTTLS</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-3 text-on-surface-variant pointer-events-none" />
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Username</label>
                <input
                  type="text"
                  value={settings.auth.user}
                  onChange={e => setSettings(s => ({ ...s, auth: { ...s.auth, user: e.target.value } }))}
                  placeholder="user@example.com"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Password / API Key</label>
                <div className="mt-1 relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={settings.auth.pass}
                    onChange={e => setSettings(s => ({ ...s, auth: { ...s.auth, pass: e.target.value } }))}
                    placeholder="••••••••••••"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-outline-variant bg-white text-sm font-mono focus:outline-none focus:ring-2 focus:ring-accent-green/40 focus:border-accent-green"
                  />
                  <button
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-on-surface-variant hover:text-on-surface cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Sender Identity */}
          <div className="bg-white border border-outline-variant rounded-2xl p-5 shadow-xs space-y-4">
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-4.5 h-4.5 text-primary-container" />
              <h3 className="text-sm font-bold text-on-surface">Sender Identity</h3>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Sender Name</label>
                <input
                  type="text"
                  value={settings.senderName}
                  onChange={e => setSettings(s => ({ ...s, senderName: e.target.value }))}
                  placeholder="DIYtax9ja Tax Portal"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Sender Email</label>
                <input
                  type="email"
                  value={settings.senderEmail}
                  onChange={e => setSettings(s => ({ ...s, senderEmail: e.target.value }))}
                  placeholder="noreply@diytax9ja.ng"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
                />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Reply-To (Optional)</label>
              <input
                type="email"
                value={settings.replyTo || ''}
                onChange={e => setSettings(s => ({ ...s, replyTo: e.target.value }))}
                placeholder="support@diytax9ja.ng"
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
              />
            </div>

            {/* Active toggle + Save */}
            <div className="flex items-center justify-between pt-2">
              <label className="flex items-center gap-2.5 cursor-pointer">
                <div
                  onClick={() => setSettings(s => ({ ...s, active: !s.active }))}
                  className={`w-11 h-6 rounded-full transition-colors relative cursor-pointer ${
                    settings.active ? 'bg-accent-green' : 'bg-outline-variant'
                  }`}
                >
                  <div className={`w-5 h-5 bg-white rounded-full shadow-sm absolute top-0.5 transition-transform ${
                    settings.active ? 'translate-x-5.5' : 'translate-x-0.5'
                  }`} />
                </div>
                <span className="text-xs font-bold text-on-surface">
                  {settings.active ? 'SMTP Active' : 'SMTP Inactive'}
                </span>
              </label>

              <button
                onClick={handleSave}
                className={`px-5 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 ${
                  saved
                    ? 'bg-accent-green text-white'
                    : 'bg-primary-container text-white hover:opacity-90'
                }`}
              >
                {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
                {saved ? 'Saved!' : 'Save Configuration'}
              </button>
            </div>
          </div>
        </div>

        {/* ── Right: Live Test Console ─────────────────────────────── */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden sticky top-24">
            <div className="bg-primary-container px-5 py-4">
              <div className="flex items-center gap-2">
                <Zap className="w-4.5 h-4.5 text-accent-green" />
                <h3 className="text-sm font-bold text-white">SMTP Connection Tester</h3>
              </div>
              <p className="text-[10px] text-white/60 mt-1">Send a diagnostic test email to verify your configuration</p>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Test Recipient Email</label>
                <input
                  type="email"
                  value={testEmail}
                  onChange={e => setTestEmail(e.target.value)}
                  placeholder="test@example.com"
                  className="mt-1 w-full px-3 py-2.5 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
                />
              </div>

              <button
                onClick={handleTest}
                disabled={testing || !testEmail.includes('@')}
                className="w-full py-3 rounded-xl bg-primary-container text-white text-xs font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {testing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Running Diagnostics…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Test Connection & Send Email
                  </>
                )}
              </button>

              {/* Terminal-style diagnostics */}
              {testSteps.length > 0 && (
                <div className="bg-gray-950 rounded-xl p-4 font-mono text-xs space-y-2 max-h-64 overflow-y-auto">
                  <div className="text-gray-500 text-[10px]">$ smtp-diag --host={settings.host} --port={settings.port}</div>
                  <AnimatePresence>
                    {testSteps.map((step, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2"
                      >
                        {step.status === 'pass' ? (
                          <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0 mt-0.5" />
                        ) : step.status === 'fail' ? (
                          <XCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                        ) : (
                          <Loader2 className="w-3.5 h-3.5 text-blue-400 flex-shrink-0 mt-0.5 animate-spin" />
                        )}
                        <div>
                          <span className={step.status === 'pass' ? 'text-green-300' : step.status === 'fail' ? 'text-red-300' : 'text-blue-300'}>
                            {step.name}
                          </span>
                          <span className="text-gray-500 ml-2">{step.message}</span>
                          {step.durationMs && <span className="text-gray-600 ml-2">{step.durationMs}ms</span>}
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {testResult && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className={`pt-2 border-t border-gray-800 ${testResult === 'success' ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {testResult === 'success'
                        ? `✓ All checks passed${testLatency ? ` (${testLatency}ms total)` : ''}`
                        : '✗ Connection test failed — check credentials'
                      }
                    </motion.div>
                  )}
                </div>
              )}

              {/* Last test info */}
              {settings.lastTestedAt && (
                <div className="flex items-center gap-2 text-[10px] text-on-surface-variant">
                  <RefreshCw className="w-3 h-3" />
                  Last tested: {new Date(settings.lastTestedAt).toLocaleString()}
                  {settings.lastTestResult === 'success' && (
                    <span className="text-accent-green font-bold">✓ Passed</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

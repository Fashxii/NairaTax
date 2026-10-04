/**
 * EmailTemplateManager.tsx — Dynamic Email Template Editor
 *
 * Split-screen visual template editor with:
 * - Left: Template selector, subject/preheader editor, merge tag chips, HTML source
 * - Right: Real-time responsive live preview (Desktop/Mobile toggle)
 * - Send Test Preview and Reset to Default actions
 */

import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  FileText, Code, Eye, Smartphone, Monitor, Tag,
  Send, RotateCcw, ChevronRight, Copy, CheckCircle,
  Search, Sparkles, Layers, Mail,
} from 'lucide-react';
import type { EmailTemplateKey, EmailModule } from '../../types/email';
import {
  getAllTemplates, getTemplate, getSampleMergeData,
  interpolateMergeTags,
} from '../../utils/emailTemplates';
import { sendEmail } from '../../utils/emailService';

const MODULE_COLORS: Record<EmailModule, { bg: string; text: string; border: string }> = {
  Auth:         { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  TCC:          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  'E-Invoicing': { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
  Payroll:      { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  Filing:       { bg: 'bg-indigo-50', text: 'text-indigo-700', border: 'border-indigo-200' },
  WHT:          { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  Planner:      { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

export default function EmailTemplateManager() {
  const allTemplates = useMemo(() => getAllTemplates(), []);
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>('auth_verification_otp');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterModule, setFilterModule] = useState<EmailModule | 'all'>('all');
  const [copied, setCopied] = useState<string | null>(null);
  const [testSending, setTestSending] = useState(false);
  const [testSent, setTestSent] = useState(false);

  const template = getTemplate(selectedKey);
  const sampleData = getSampleMergeData(selectedKey);
  const renderedHtml = template ? interpolateMergeTags(template.bodyHtml, sampleData) : '';
  const renderedSubject = template ? interpolateMergeTags(template.subject, sampleData) : '';

  const filteredTemplates = allTemplates.filter(t => {
    const matchesSearch = !searchQuery ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.key.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesModule = filterModule === 'all' || t.module === filterModule;
    return matchesSearch && matchesModule;
  });

  const modules = Array.from(new Set(allTemplates.map(t => t.module)));

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(`{{${tag}}}`);
    setCopied(tag);
    setTimeout(() => setCopied(null), 1500);
  };

  const handleSendTest = async () => {
    if (!template) return;
    setTestSending(true);
    await sendEmail({
      templateKey: selectedKey,
      recipientEmail: 'admin@diytax9ja.ng',
      recipientName: 'Admin Test',
      mergeData: sampleData,
    });
    setTestSending(false);
    setTestSent(true);
    setTimeout(() => setTestSent(false), 3000);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Header Bar */}
      <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-on-surface">Email Template Manager</h3>
            <p className="text-[10px] text-on-surface-variant">{allTemplates.length} templates across {modules.length} modules</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSendTest}
            disabled={testSending}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
              testSent
                ? 'bg-accent-green text-white'
                : 'bg-primary-container text-white hover:opacity-90'
            } disabled:opacity-50`}
          >
            {testSent ? <CheckCircle className="w-3.5 h-3.5" /> : <Send className="w-3.5 h-3.5" />}
            {testSent ? 'Sent to Sandbox!' : testSending ? 'Sending…' : 'Send Test Preview'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5" style={{ minHeight: '600px' }}>
        {/* ── Left Panel: Template List & Editor ──────────────────── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Search & Filter */}
          <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-on-surface-variant" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search templates…"
                className="w-full pl-9 pr-3 py-2 rounded-lg border border-outline-variant bg-white text-sm focus:outline-none focus:ring-2 focus:ring-accent-green/40"
              />
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setFilterModule('all')}
                className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer ${
                  filterModule === 'all' ? 'bg-primary-container text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container'
                }`}
              >
                All
              </button>
              {modules.map(mod => {
                const colors = MODULE_COLORS[mod];
                return (
                  <button
                    key={mod}
                    onClick={() => setFilterModule(mod)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-bold transition-all cursor-pointer border ${
                      filterModule === mod
                        ? `${colors.bg} ${colors.text} ${colors.border}`
                        : 'bg-surface-container-low text-on-surface-variant border-transparent hover:bg-surface-container'
                    }`}
                  >
                    {mod}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Template List */}
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden">
            <div className="max-h-72 overflow-y-auto divide-y divide-outline-variant/30">
              {filteredTemplates.map(t => {
                const colors = MODULE_COLORS[t.module];
                const isActive = t.key === selectedKey;
                return (
                  <button
                    key={t.key}
                    onClick={() => setSelectedKey(t.key)}
                    className={`w-full px-4 py-3 flex items-center justify-between text-left transition-all cursor-pointer ${
                      isActive ? 'bg-emerald-50 border-l-4 border-l-accent-green' : 'hover:bg-surface-container-low border-l-4 border-l-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className={`text-[9px] font-bold uppercase px-1.5 py-0.5 rounded ${colors.bg} ${colors.text}`}>
                          {t.module}
                        </span>
                        {t.hasAttachment && (
                          <span className="text-[9px] text-indigo-500 font-bold">📎 PDF</span>
                        )}
                      </div>
                      <p className={`text-xs font-semibold truncate ${isActive ? 'text-primary-container' : 'text-on-surface'}`}>
                        {t.name}
                      </p>
                      <p className="text-[10px] text-on-surface-variant truncate">{t.triggerEvent}</p>
                    </div>
                    <ChevronRight className={`w-4 h-4 flex-shrink-0 ${isActive ? 'text-accent-green' : 'text-outline-variant'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Merge Tags */}
          {template && (
            <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs">
              <div className="flex items-center gap-2 mb-3">
                <Tag className="w-4 h-4 text-primary-container" />
                <h4 className="text-xs font-bold text-on-surface">Merge Tags</h4>
                <span className="text-[9px] bg-surface-container-low px-1.5 py-0.5 rounded-full text-on-surface-variant font-bold">
                  {template.mergeTags.length} variables
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {template.mergeTags.map(tag => (
                  <button
                    key={tag.key}
                    onClick={() => handleCopyTag(tag.key)}
                    title={`${tag.label}: ${tag.sampleValue}`}
                    className={`px-2.5 py-1.5 rounded-lg border text-[10px] font-mono font-bold transition-all cursor-pointer flex items-center gap-1 ${
                      copied === tag.key
                        ? 'bg-accent-green/10 border-accent-green text-accent-green'
                        : tag.required
                          ? 'bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100'
                          : 'bg-surface-container-low border-outline-variant/40 text-on-surface-variant hover:bg-surface-container'
                    }`}
                  >
                    {copied === tag.key ? <CheckCircle className="w-3 h-3" /> : <Copy className="w-3 h-3 opacity-50" />}
                    {`{{${tag.key}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Subject & Preheader Preview */}
          {template && (
            <div className="bg-white border border-outline-variant rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Mail className="w-4 h-4 text-primary-container" />
                <h4 className="text-xs font-bold text-on-surface">Subject Line</h4>
              </div>
              <div className="bg-surface-container-low rounded-lg p-3">
                <p className="text-xs font-mono text-on-surface">{renderedSubject}</p>
              </div>
              {template.preheader && (
                <>
                  <h4 className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider">Preheader</h4>
                  <div className="bg-surface-container-low rounded-lg p-3">
                    <p className="text-[11px] text-on-surface-variant italic">{template.preheader}</p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Right Panel: Live Preview ──────────────────────────── */}
        <div className="lg:col-span-7">
          <div className="bg-white border border-outline-variant rounded-2xl shadow-xs overflow-hidden sticky top-24">
            {/* Preview Toolbar */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-outline-variant/40 bg-surface-container-low">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary-container" />
                <span className="text-xs font-bold text-on-surface">Live Preview</span>
                {template && (
                  <span className="text-[9px] bg-accent-green/10 text-accent-green px-2 py-0.5 rounded-full font-bold">
                    {template.name}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setViewMode('desktop')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'desktop' ? 'bg-primary-container text-white' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                  title="Desktop view"
                >
                  <Monitor className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('mobile')}
                  className={`p-1.5 rounded-lg transition-all cursor-pointer ${
                    viewMode === 'mobile' ? 'bg-primary-container text-white' : 'text-on-surface-variant hover:bg-surface-container'
                  }`}
                  title="Mobile view"
                >
                  <Smartphone className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Preview iframe */}
            <div className="p-4 bg-gray-100 flex justify-center" style={{ minHeight: '520px' }}>
              <div
                className="bg-white rounded-lg shadow-lg overflow-hidden transition-all duration-300"
                style={{
                  width: viewMode === 'desktop' ? '100%' : '375px',
                  maxWidth: '100%',
                }}
              >
                {renderedHtml ? (
                  <iframe
                    srcDoc={renderedHtml}
                    title="Email Preview"
                    className="w-full border-0"
                    style={{ height: '520px' }}
                    sandbox="allow-same-origin"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center h-80 text-on-surface-variant">
                    <Layers className="w-10 h-10 opacity-30 mb-3" />
                    <p className="text-sm font-semibold">Select a template to preview</p>
                  </div>
                )}
              </div>
            </div>

            {/* Template info footer */}
            {template && (
              <div className="px-4 py-3 border-t border-outline-variant/40 bg-surface-container-low flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-on-surface-variant">
                    <Code className="w-3 h-3 inline mr-1" />
                    Key: <code className="font-mono text-primary-container">{template.key}</code>
                  </span>
                  <span className="text-[10px] text-on-surface-variant">
                    <FileText className="w-3 h-3 inline mr-1" />
                    Trigger: {template.triggerEvent}
                  </span>
                </div>
                <button
                  onClick={() => {/* Reset to default - already default */}}
                  className="text-[10px] text-on-surface-variant hover:text-error font-bold flex items-center gap-1 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Reset to Default
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

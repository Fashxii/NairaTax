/**
 * SeoSitemapManager.tsx — Admin Console SEO, Meta Tag & Google Sitemap Manager
 *
 * Lets administrators:
 * 1. Edit & publish live page title, meta description, keywords, canonical URL,
 *    Open Graph / X social cards, and Schema.org organization name to Firestore
 *    (`platform_config/content.seo`).
 * 2. Paste Google Search Console (`google-site-verification`) and Bing Webmaster
 *    (`msvalidate.01`) verification codes without code redeploys.
 * 3. Control indexing visibility mode (Landing Page Only, Public Pages, or Full Stealth).
 * 4. Inspect live Google SERP + Social Card previews and a 0–100 SEO Health score.
 * 5. Generate, copy, or download `sitemap.xml` and `robots.txt` for Google Search Console.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Search, Globe, Share2, FileCode2, CheckCircle2, AlertTriangle, Copy, Download,
  Save, RotateCcw, Lock, ExternalLink, ShieldCheck,
} from 'lucide-react';
import { useContent } from '../../context/ContentContext';
import { usePermissions } from '../../admin/usePermissions';
import { describeWriteError } from '../../admin/platformStore';
import { recordAuditLog } from '../../utils/auditLogger';
import { useToast } from '../Toast';
import {
  DEFAULT_SEO_CONFIG,
  cleanCanonicalOrigin,
  evaluateSeoHealth,
  generateRobotsTxt,
  generateSitemapXml,
  type SeoConfig,
  type SeoIndexingMode,
  type SitemapChangefreq,
} from '../../utils/seo';

export default function SeoSitemapManager() {
  const { content, publishContent } = useContent();
  const { can, actorEmail, actorName } = usePermissions();
  const { showToast } = useToast();
  const canEdit = can('cms.edit');

  const [draft, setDraft] = useState<SeoConfig>(() => ({ ...DEFAULT_SEO_CONFIG, ...content.seo }));
  const [saving, setSaving] = useState(false);
  const [previewTab, setPreviewTab] = useState<'serp' | 'social' | 'sitemap' | 'robots'>('serp');

  const dirty = JSON.stringify(draft) !== JSON.stringify(content.seo);

  useEffect(() => {
    if (!dirty) {
      setDraft({ ...DEFAULT_SEO_CONFIG, ...content.seo });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.seo]);

  const health = useMemo(() => evaluateSeoHealth(draft), [draft]);
  const sitemapXml = useMemo(() => generateSitemapXml(draft), [draft]);
  const robotsTxt = useMemo(() => generateRobotsTxt(draft), [draft]);
  const canonicalOrigin = cleanCanonicalOrigin(draft.canonicalUrl);
  const sitemapUrl = `${canonicalOrigin}/sitemap.xml`;

  const setField = <K extends keyof SeoConfig>(key: K, value: SeoConfig[K]) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canEdit) return;
    setSaving(true);
    try {
      const cleaned: SeoConfig = {
        ...draft,
        canonicalUrl: cleanCanonicalOrigin(draft.canonicalUrl),
        siteTitle: draft.siteTitle.trim() || DEFAULT_SEO_CONFIG.siteTitle,
        metaDescription: draft.metaDescription.trim() || DEFAULT_SEO_CONFIG.metaDescription,
      };
      await publishContent({ ...content, seo: cleaned }, actorEmail);
      recordAuditLog({
        actorName,
        actorEmail,
        action: 'UPDATE_SEO_META_CONFIG',
        module: 'Content',
        severity: 'INFO',
        afterState: {
          canonicalUrl: cleaned.canonicalUrl,
          indexingMode: cleaned.indexingMode,
          siteTitle: cleaned.siteTitle,
          seoScore: health.score,
        },
      });
      showToast('success', 'SEO & Meta tags published', 'Live meta tags, JSON-LD, and robots directives updated.');
    } catch (err) {
      showToast('error', 'Failed to publish SEO config', describeWriteError(err));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setDraft({ ...DEFAULT_SEO_CONFIG });
    showToast('info', 'Reset to defaults', 'Click Publish SEO Settings to apply the defaults.');
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(
      () => showToast('success', 'Copied', `${label} copied to clipboard.`),
      () => showToast('error', 'Copy failed', 'Select and copy the text manually.'),
    );
  };

  const downloadFile = (filename: string, body: string, mime: string) => {
    const blob = new Blob([body], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-4xl mx-auto bg-white border border-outline-variant rounded-2xl p-6 md:p-8 shadow-sm space-y-6 text-left">
      {/* Header & Score */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-outline-variant/40 pb-5">
        <div>
          <h3 className="text-xl font-black text-primary-container flex items-center gap-2">
            <Search className="w-5 h-5 text-accent-green" />
            SEO, Site Meta Tags &amp; Google Sitemap
          </h3>
          <p className="text-xs text-on-surface-variant mt-1">
            Configure search engine meta tags, Open Graph social cards, Search Console verification tokens, and your Google XML sitemap.
          </p>
          {!canEdit && (
            <p className="text-[11px] text-amber-700 mt-1.5 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" /> Read-only: requires “Edit &amp; publish site content” (`cms.edit`).
            </p>
          )}
        </div>

        <div className="flex items-center gap-3">
          <div className={`px-3.5 py-2 rounded-xl border text-right ${
            health.score >= 85
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : health.score >= 65
              ? 'bg-amber-50 border-amber-200 text-amber-900'
              : 'bg-red-50 border-red-200 text-red-900'
          }`}>
            <span className="text-[10px] font-bold uppercase tracking-wider block opacity-75">SEO Health</span>
            <span className="text-lg font-black">{health.score}/100</span>
          </div>

          {canEdit && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleReset}
                className="h-10 px-3 rounded-lg border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container-low flex items-center gap-1.5 cursor-pointer"
                title="Reset to default SEO settings"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Defaults
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!dirty || saving}
                className="h-10 px-5 bg-[#013220] text-white text-xs font-bold rounded-lg flex items-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Publishing…' : 'Publish SEO Settings'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* SEO Health Checklist */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-surface-container-low p-4 rounded-xl border border-outline-variant/60">
        {health.checks.map((c) => (
          <div key={c.id} className="flex items-start gap-2 text-xs">
            {c.passed ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div>
              <p className="font-bold text-on-surface">{c.label}</p>
              <p className="text-[11px] text-on-surface-variant">{c.detail}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Primary Meta Tag Controls */}
      <fieldset disabled={!canEdit} className="space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="md:col-span-2 block">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Page Title (`&lt;title&gt;`)</span>
              <span className={`text-[11px] font-mono ${draft.siteTitle.length >= 30 && draft.siteTitle.length <= 65 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {draft.siteTitle.length}/65 chars
              </span>
            </div>
            <input
              type="text"
              maxLength={100}
              value={draft.siteTitle}
              onChange={(e) => setField('siteTitle', e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-outline-variant text-sm font-semibold"
              placeholder="DIYtax9ja — Nigeria Tax Filing, Calculator & NRS Compliance Platform"
            />
          </label>

          <label className="md:col-span-2 block">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs font-bold text-on-surface uppercase tracking-wider">Meta Description (`name=&quot;description&quot;`)</span>
              <span className={`text-[11px] font-mono ${draft.metaDescription.length >= 110 && draft.metaDescription.length <= 160 ? 'text-emerald-700' : 'text-amber-700'}`}>
                {draft.metaDescription.length}/160 chars
              </span>
            </div>
            <textarea
              rows={3}
              maxLength={250}
              value={draft.metaDescription}
              onChange={(e) => setField('metaDescription', e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-outline-variant text-sm"
              placeholder="Summarize DIYtax9ja for Google search snippets (110–160 chars)..."
            />
          </label>

          <label className="md:col-span-2 block">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
              Target Keywords (`name=&quot;keywords&quot;`, comma-separated)
            </span>
            <input
              type="text"
              value={draft.keywords}
              onChange={(e) => setField('keywords', e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-outline-variant text-xs"
              placeholder="Nigeria tax calculator, PIT calculator, PAYE, CIT, VAT 7.5%, WHT, NRS Rev360, TCC Nigeria"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
              Canonical Domain URL
            </span>
            <input
              type="url"
              value={draft.canonicalUrl}
              onChange={(e) => setField('canonicalUrl', e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-outline-variant text-sm font-mono"
              placeholder="https://diytax9ja.ng"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-on-surface uppercase tracking-wider block mb-1">
              Schema.org Brand / Organization Name
            </span>
            <input
              type="text"
              value={draft.structuredDataOrgName}
              onChange={(e) => setField('structuredDataOrgName', e.target.value)}
              className="w-full h-11 px-3.5 rounded-xl border border-outline-variant text-sm"
              placeholder="DIYtax9ja"
            />
          </label>
        </div>

        {/* Open Graph & Social Card Settings */}
        <div className="pt-4 border-t border-outline-variant/40 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-primary-container flex items-center gap-1.5">
            <Share2 className="w-4 h-4 text-accent-green" />
            Open Graph &amp; WhatsApp / LinkedIn / X Social Cards
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">Social Share Title (`og:title`)</span>
              <input
                type="text"
                value={draft.ogTitle}
                onChange={(e) => setField('ogTitle', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">Social Image URL (`og:image`, 1200×630)</span>
              <input
                type="url"
                value={draft.ogImageUrl}
                onChange={(e) => setField('ogImageUrl', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs font-mono"
                placeholder="https://diytax9ja.ng/og-cover.png"
              />
            </label>
            <label className="md:col-span-2 block">
              <span className="text-xs font-bold text-on-surface block mb-1">Social Share Description (`og:description`)</span>
              <input
                type="text"
                value={draft.ogDescription}
                onChange={(e) => setField('ogDescription', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">X / Twitter Handle (`twitter:site`)</span>
              <input
                type="text"
                value={draft.twitterHandle}
                onChange={(e) => setField('twitterHandle', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs"
                placeholder="@diytax9ja"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">X / Twitter Card Layout</span>
              <select
                value={draft.twitterCard}
                onChange={(e) => setField('twitterCard', e.target.value as SeoConfig['twitterCard'])}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs"
              >
                <option value="summary_large_image">Large Image Card (summary_large_image)</option>
                <option value="summary">Compact Summary Card (summary)</option>
              </select>
            </label>
          </div>
        </div>

        {/* Search Console Verification & Crawler Visibility Policy */}
        <div className="pt-4 border-t border-outline-variant/40 space-y-4">
          <h4 className="text-xs font-black uppercase tracking-wider text-primary-container flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-accent-green" />
            Search Console Verification &amp; Crawler Visibility Policy
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">
                Google Search Console Verification Code (`google-site-verification`)
              </span>
              <input
                type="text"
                value={draft.googleSiteVerification}
                onChange={(e) => setField('googleSiteVerification', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs font-mono"
                placeholder="Paste token from Google Search Console HTML tag method"
              />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">
                Bing Webmaster Verification Code (`msvalidate.01`)
              </span>
              <input
                type="text"
                value={draft.bingSiteVerification}
                onChange={(e) => setField('bingSiteVerification', e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs font-mono"
                placeholder="Optional Bing verification token"
              />
            </label>

            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">Search Engine Indexing Mode</span>
              <select
                value={draft.indexingMode}
                onChange={(e) => setField('indexingMode', e.target.value as SeoIndexingMode)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs font-semibold"
              >
                <option value="landing_only">Landing Page Only (Recommended — hides /admin, /dashboard, /register &amp; *.web.app)</option>
                <option value="public_pages">Public Pages (/ and /register — hides /admin, /dashboard &amp; *.web.app)</option>
                <option value="full_stealth">Full Stealth Mode (noindex everywhere — private beta)</option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-on-surface block mb-1">Sitemap Change Frequency (`changefreq`)</span>
              <select
                value={draft.sitemapChangefreq}
                onChange={(e) => setField('sitemapChangefreq', e.target.value as SitemapChangefreq)}
                className="w-full h-10 px-3 rounded-lg border border-outline-variant text-xs"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly (Recommended)</option>
                <option value="monthly">Monthly</option>
              </select>
            </label>
          </div>
        </div>
      </fieldset>

      {/* Previews & Sitemap Generator */}
      <div className="pt-4 border-t border-outline-variant/40 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 bg-surface-container p-1 rounded-xl border border-outline-variant">
            {([
              { id: 'serp', label: 'Google SERP Preview', Icon: Search },
              { id: 'social', label: 'Social Card Preview', Icon: Share2 },
              { id: 'sitemap', label: 'Google Sitemap XML', Icon: FileCode2 },
              { id: 'robots', label: 'robots.txt Policy', Icon: Globe },
            ] as const).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPreviewTab(t.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all ${
                  previewTab === t.id
                    ? 'bg-white text-primary-container shadow-xs border border-outline-variant/40'
                    : 'text-on-surface-variant hover:text-on-surface'
                }`}
              >
                <t.Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => downloadFile('sitemap.xml', sitemapXml, 'application/xml;charset=utf-8')}
              className="h-9 px-3 rounded-lg border border-outline-variant text-xs font-bold text-primary-container hover:bg-surface-container-low flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download sitemap.xml
            </button>
            <button
              type="button"
              onClick={() => downloadFile('robots.txt', robotsTxt, 'text/plain;charset=utf-8')}
              className="h-9 px-3 rounded-lg border border-outline-variant text-xs font-bold text-on-surface-variant hover:bg-surface-container-low flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Download robots.txt
            </button>
          </div>
        </div>

        {previewTab === 'serp' && (
          <div className="p-5 rounded-xl border border-outline-variant bg-surface-container-low space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-on-surface-variant">
              <span className="w-6 h-6 rounded-full bg-[#013220] text-white font-black text-[11px] flex items-center justify-center">N</span>
              <div>
                <p className="font-bold text-on-surface leading-none">{draft.structuredDataOrgName || 'DIYtax9ja'}</p>
                <p className="text-[11px] text-on-surface-variant">{canonicalOrigin}</p>
              </div>
            </div>
            <p className="text-lg font-semibold text-[#1a0dab] hover:underline cursor-pointer leading-snug pt-1">
              {draft.siteTitle || DEFAULT_SEO_CONFIG.siteTitle}
            </p>
            <p className="text-xs text-[#4d5156] leading-relaxed max-w-2xl">
              {draft.metaDescription || DEFAULT_SEO_CONFIG.metaDescription}
            </p>
            {draft.indexingMode === 'full_stealth' && (
              <p className="text-[11px] font-bold text-amber-700 pt-1">
                ⚠️ Full Stealth Mode is selected — search engines will be instructed not to index this page.
              </p>
            )}
          </div>
        )}

        {previewTab === 'social' && (
          <div className="max-w-md rounded-xl border border-outline-variant overflow-hidden bg-surface-container-low">
            <div className="h-44 bg-[#013220] flex items-center justify-center text-white px-6 text-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-accent-green">Open Graph Cover Preview</p>
                <p className="text-base font-black mt-1">{draft.structuredDataOrgName || 'DIYtax9ja'}</p>
                <p className="text-[11px] text-white/70 font-mono mt-1 break-all">{draft.ogImageUrl}</p>
              </div>
            </div>
            <div className="p-4 space-y-1 bg-white">
              <p className="text-[10px] font-bold uppercase text-on-surface-variant">{canonicalOrigin.replace(/^https?:\/\//, '')}</p>
              <p className="text-sm font-bold text-on-surface line-clamp-1">{draft.ogTitle || draft.siteTitle}</p>
              <p className="text-xs text-on-surface-variant line-clamp-2">{draft.ogDescription || draft.metaDescription}</p>
            </div>
          </div>
        )}

        {previewTab === 'sitemap' && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs">
              <div>
                <span className="font-bold text-emerald-950">Live Sitemap Submission URL: </span>
                <a href="/sitemap.xml" target="_blank" rel="noreferrer" className="font-mono text-emerald-800 underline inline-flex items-center gap-1">
                  {sitemapUrl} <ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => copyText(sitemapUrl, 'Sitemap URL')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copy URL
                </button>
                <button
                  type="button"
                  onClick={() => copyText(sitemapXml, 'sitemap.xml')}
                  className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-900 font-bold flex items-center gap-1 cursor-pointer"
                >
                  <Copy className="w-3 h-3" /> Copy XML
                </button>
              </div>
            </div>
            <pre className="p-4 rounded-xl bg-gray-950 text-emerald-300 text-xs font-mono overflow-x-auto leading-relaxed">
              {sitemapXml}
            </pre>
            <div className="p-3.5 rounded-xl bg-surface-container-low border border-outline-variant/60 text-xs text-on-surface-variant space-y-1">
              <p className="font-bold text-on-surface">How to Submit Your Sitemap to Google Search Console:</p>
              <ol className="list-decimal list-inside space-y-0.5 text-[11px]">
                <li>Open <strong>Google Search Console</strong> and add property <code>{canonicalOrigin}</code> (choose <em>URL prefix → HTML tag</em>).</li>
                <li>Paste the verification token into <strong>Google Search Console Verification Code</strong> above and click <strong>Publish SEO Settings</strong>.</li>
                <li>In Google Search Console → <strong>Sitemaps</strong>, enter <code>sitemap.xml</code> and click <strong>Submit</strong>.</li>
              </ol>
            </div>
          </div>
        )}

        {previewTab === 'robots' && (
          <div className="space-y-2">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => copyText(robotsTxt, 'robots.txt')}
                className="px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3 h-3" /> Copy robots.txt
              </button>
            </div>
            <pre className="p-4 rounded-xl bg-gray-950 text-sky-300 text-xs font-mono overflow-x-auto leading-relaxed">
              {robotsTxt}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}


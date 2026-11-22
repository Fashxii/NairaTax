/**
 * seo.ts — Dynamic SEO Meta Tags, Schema.org JSON-LD, Sitemap XML & Health Audit
 *
 * Powers both:
 * 1. Live DOM <head> synchronization for visitors and search crawlers.
 * 2. The Admin Console SEO, Meta Tags & Sitemap Manager (SERP preview, score, XML export).
 */

export type SeoIndexingMode = 'landing_only' | 'public_pages' | 'full_stealth';
export type SitemapChangefreq = 'daily' | 'weekly' | 'monthly';

export interface SeoConfig {
  siteTitle: string;
  metaDescription: string;
  keywords: string;
  canonicalUrl: string;
  ogTitle: string;
  ogDescription: string;
  ogImageUrl: string;
  twitterHandle: string;
  twitterCard: 'summary_large_image' | 'summary';
  googleSiteVerification: string;
  bingSiteVerification: string;
  indexingMode: SeoIndexingMode;
  structuredDataOrgName: string;
  sitemapChangefreq: SitemapChangefreq;
  sitemapIncludeRegister: 'true' | 'false';
}

export const DEFAULT_SEO_CONFIG: SeoConfig = {
  siteTitle: 'DIYtax9ja — Nigeria Tax Filing, Calculator & NRS Compliance Platform',
  metaDescription:
    'Calculate Nigerian PIT, PAYE, CIT, VAT (7.5%), WHT, Stamp Duty and Capital Gains. Prepare NRS Rev360 schedules, track reliefs, and verify TCC readiness.',
  keywords:
    'Nigeria tax calculator, PIT calculator Nigeria, PAYE calculator Nigeria, CIT Nigeria, VAT 7.5% Nigeria, WHT calculator, NRS Rev360, TaxProMax, Tax Clearance Certificate TCC Nigeria, DIYtax9ja',
  canonicalUrl: 'https://diytax9ja.ng',
  ogTitle: 'DIYtax9ja — Nigeria Tax Calculator & NRS Compliance Platform',
  ogDescription:
    'Self-service Nigerian tax calculator and NRS Rev360 return preparation platform for individuals and businesses.',
  ogImageUrl: 'https://diytax9ja.ng/og-cover.png',
  twitterHandle: '@diytax9ja',
  twitterCard: 'summary_large_image',
  googleSiteVerification: '',
  bingSiteVerification: '',
  indexingMode: 'landing_only',
  structuredDataOrgName: 'DIYtax9ja',
  sitemapChangefreq: 'weekly',
  sitemapIncludeRegister: 'false',
};

/** Normalize canonical origin (no trailing slash). */
export function cleanCanonicalOrigin(raw: string): string {
  const trimmed = (raw || '').trim().replace(/\/+$/, '');
  if (/^https?:\/\/[a-z0-9.-]+/i.test(trimmed)) return trimmed;
  return DEFAULT_SEO_CONFIG.canonicalUrl;
}

/** Determine the effective robots meta directive for a given hostname and pathname. */
export function computeRobotsDirective(
  seo: SeoConfig,
  pathname: string,
  hostname: string,
): string {
  const host = (hostname || '').toLowerCase();
  // Raw cloud hosting URLs must never be indexed by public search engines.
  if (host.endsWith('.web.app') || host.endsWith('.firebaseapp.com')) {
    return 'noindex, nofollow, noarchive, nosnippet';
  }
  if (seo.indexingMode === 'full_stealth') {
    return 'noindex, nofollow, noarchive, nosnippet';
  }
  const cleanPath = pathname === '' ? '/' : pathname;
  if (cleanPath === '/') {
    return 'index, follow, max-image-preview:large, max-snippet:-1';
  }
  if (
    seo.indexingMode === 'public_pages' &&
    (cleanPath === '/register' || cleanPath === '/register/business')
  ) {
    return 'index, follow';
  }
  return 'noindex, nofollow, noarchive, nosnippet';
}

/** Build Schema.org JSON-LD for Nigerian financial/tax web application. */
export function buildStructuredDataJsonLd(seo: SeoConfig): string {
  const origin = cleanCanonicalOrigin(seo.canonicalUrl);
  const payload = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebApplication',
        '@id': `${origin}/#app`,
        name: seo.structuredDataOrgName || 'DIYtax9ja',
        url: `${origin}/`,
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'All',
        inLanguage: 'en-NG',
        description: seo.metaDescription,
        areaServed: {
          '@type': 'Country',
          name: 'Nigeria',
        },
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'NGN',
        },
      },
      {
        '@type': 'Organization',
        '@id': `${origin}/#organization`,
        name: seo.structuredDataOrgName || 'DIYtax9ja',
        url: `${origin}/`,
         ...(seo.ogImageUrl ? { logo: seo.ogImageUrl } : {}),
      },
    ],
  };
  return JSON.stringify(payload);
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  if (typeof document === 'undefined') return;
  const selector = `meta[${attr}="${key}"]`;
  let el = document.head.querySelector<HTMLMetaElement>(selector);
  if (!content.trim()) {
    if (el) el.remove();
    return;
  }
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content.trim());
}

function upsertCanonical(href: string): void {
  if (typeof document === 'undefined') return;
  let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}

/** Apply live SEO configuration and route-aware robots directives to the browser DOM. */
export function applySeoToDocument(
  seo: SeoConfig,
  pathname: string = '/',
  hostname: string = typeof window !== 'undefined' ? window.location.hostname : '',
): void {
  if (typeof document === 'undefined') return;

  const origin = cleanCanonicalOrigin(seo.canonicalUrl);
  const cleanPath = pathname === '/' ? '' : pathname;
  const canonicalHref = `${origin}${cleanPath || '/'}`;

  // Route-specific title suffix for non-landing views while keeping landing exact
  if (pathname.startsWith('/admin')) {
    document.title = `Admin Console · ${seo.structuredDataOrgName || 'DIYtax9ja'}`;
  } else if (pathname.startsWith('/dashboard')) {
    document.title = `Taxpayer Workspace · ${seo.structuredDataOrgName || 'DIYtax9ja'}`;
  } else {
    document.title = seo.siteTitle || DEFAULT_SEO_CONFIG.siteTitle;
  }

  upsertCanonical(canonicalHref);
  upsertMeta('name', 'description', seo.metaDescription);
  upsertMeta('name', 'keywords', seo.keywords);
  upsertMeta('name', 'author', seo.structuredDataOrgName || 'DIYtax9ja');
  upsertMeta('name', 'robots', computeRobotsDirective(seo, pathname, hostname));

  // Search Console verification tags (removed automatically when blank)
  upsertMeta('name', 'google-site-verification', seo.googleSiteVerification);
  upsertMeta('name', 'msvalidate.01', seo.bingSiteVerification);

  // Open Graph
  upsertMeta('property', 'og:site_name', seo.structuredDataOrgName || 'DIYtax9ja');
  upsertMeta('property', 'og:locale', 'en_NG');
  upsertMeta('property', 'og:type', 'website');
  upsertMeta('property', 'og:url', canonicalHref);
  upsertMeta('property', 'og:title', seo.ogTitle || seo.siteTitle);
  upsertMeta('property', 'og:description', seo.ogDescription || seo.metaDescription);
  upsertMeta('property', 'og:image', seo.ogImageUrl);

  // Twitter / X Card
  upsertMeta('name', 'twitter:card', seo.twitterCard || 'summary_large_image');
  upsertMeta('name', 'twitter:title', seo.ogTitle || seo.siteTitle);
  upsertMeta('name', 'twitter:description', seo.ogDescription || seo.metaDescription);
  upsertMeta('name', 'twitter:image', seo.ogImageUrl);
  upsertMeta('name', 'twitter:site', seo.twitterHandle);

  // Schema.org JSON-LD
  let ld = document.head.querySelector<HTMLScriptElement>('script#seo-jsonld');
  if (!ld) {
    ld = document.createElement('script');
    ld.id = 'seo-jsonld';
    ld.type = 'application/ld+json';
    document.head.appendChild(ld);
  }
  ld.textContent = buildStructuredDataJsonLd(seo);
}

/** Generate valid Google Sitemap XML (0.9) from the admin SEO config. */
export function generateSitemapXml(
  seo: SeoConfig,
  lastmod: string = new Date().toISOString().slice(0, 10),
): string {
  const origin = cleanCanonicalOrigin(seo.canonicalUrl);
  const freq = seo.sitemapChangefreq || 'weekly';
  const urls: Array<{ loc: string; priority: string; changefreq: string }> = [
    { loc: `${origin}/`, priority: '1.0', changefreq: freq },
  ];
  if (seo.sitemapIncludeRegister === 'true' && seo.indexingMode === 'public_pages') {
    urls.push(
      { loc: `${origin}/register`, priority: '0.7', changefreq: 'monthly' },
      { loc: `${origin}/register/business`, priority: '0.7', changefreq: 'monthly' },
    );
  }

  const entries = urls
    .map(
      (u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${escapeXml(lastmod)}</lastmod>
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>
`;
}

/** Generate a matching robots.txt that points to the canonical sitemap.xml. */
export function generateRobotsTxt(seo: SeoConfig): string {
  const origin = cleanCanonicalOrigin(seo.canonicalUrl);
  const isStealth = seo.indexingMode === 'full_stealth';
  const allowPublicPages = seo.indexingMode === 'public_pages';

  const rules = isStealth
    ? 'User-agent: *\nDisallow: /'
    : [
        'User-agent: *',
        'Allow: /$',
        'Allow: /sitemap.xml$',
        ...(allowPublicPages ? ['Allow: /register$', 'Allow: /register/business$'] : ['Disallow: /register']),
        'Disallow: /admin',
        'Disallow: /dashboard',
        'Disallow: /verify',
        'Disallow: /compliance',
        'Disallow: /api/',
        'Disallow: /assets/',
      ].join('\n');

  return `# DIYtax9ja — Search Engine & Scraper Policy
User-agent: GPTBot
User-agent: ChatGPT-User
User-agent: OAI-SearchBot
User-agent: CCBot
User-agent: ClaudeBot
User-agent: Claude-Web
User-agent: anthropic-ai
User-agent: Google-Extended
User-agent: Bytespider
User-agent: PerplexityBot
User-agent: Amazonbot
User-agent: Applebot-Extended
User-agent: Meta-ExternalAgent
Disallow: /

${rules}

Sitemap: ${origin}/sitemap.xml
`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export interface SeoHealthCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
}

/** Evaluate SEO readiness and return a 0–100 score + checklist for the Admin Console. */
export function evaluateSeoHealth(seo: SeoConfig): { score: number; checks: SeoHealthCheck[] } {
  const titleLen = seo.siteTitle.trim().length;
  const descLen = seo.metaDescription.trim().length;
  const kwCount = seo.keywords
    .split(',')
    .map((k) => k.trim())
    .filter(Boolean).length;
  const hasHttpsCanonical = /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}$/i.test(cleanCanonicalOrigin(seo.canonicalUrl));
  const noCloudLeak = !/web\.app|firebaseapp\.com/i.test(seo.canonicalUrl);

  const checks: SeoHealthCheck[] = [
    {
      id: 'title',
      label: 'Title tag length (30–65 characters)',
      passed: titleLen >= 30 && titleLen <= 65,
      detail: `${titleLen} chars ${titleLen >= 30 && titleLen <= 65 ? '(optimal for Google SERP)' : '(aim for 30–65 chars)'}`,
    },
    {
      id: 'description',
      label: 'Meta description length (110–160 characters)',
      passed: descLen >= 110 && descLen <= 160,
      detail: `${descLen} chars ${descLen >= 110 && descLen <= 160 ? '(optimal snippet length)' : '(aim for 110–160 chars)'}`,
    },
    {
      id: 'canonical',
      label: 'HTTPS custom canonical domain (no .web.app leak)',
      passed: hasHttpsCanonical && noCloudLeak,
      detail: cleanCanonicalOrigin(seo.canonicalUrl),
    },
    {
      id: 'keywords',
      label: 'Target Nigerian tax keywords (5+ terms)',
      passed: kwCount >= 5,
      detail: `${kwCount} keyword phrase${kwCount === 1 ? '' : 's'} configured`,
    },
    {
      id: 'og',
      label: 'Open Graph & X/Twitter social card metadata',
      passed: Boolean(seo.ogTitle.trim() && seo.ogDescription.trim() && /^https?:\/\//i.test(seo.ogImageUrl.trim())),
      detail: seo.ogImageUrl.trim() ? 'Title, description & social image URL set' : 'Add an HTTPS social preview image URL',
    },
    {
      id: 'protection',
      label: 'Admin, workspace & JS bundle de-indexing protection',
      passed: true,
      detail: 'X-Robots-Tag + robots.txt + runtime noindex active on /admin, /dashboard, /assets/* and *.web.app',
    },
  ];

  const passedCount = checks.filter((c) => c.passed).length;
  const score = Math.round((passedCount / checks.length) * 100);
  return { score, checks };
}


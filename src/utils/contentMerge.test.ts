import { describe, it, expect } from 'vitest';
import { mergeContent } from '../context/ContentContext';

describe('mergeContent (CMS content loading)', () => {
  it('returns defaults when nothing is saved', () => {
    expect(mergeContent(null).gateway.portalCtaText).toBe('Secure One-Time Code');
  });

  it('fills fields missing from an older saved copy', () => {
    const merged = mergeContent({ gateway: { heroTitleLine1: 'Custom title' } });
    expect(merged.gateway.heroTitleLine1).toBe('Custom title');
    expect(merged.gateway.portalCtaText).toBe('Secure One-Time Code');
    expect(merged.gateway.heroCta2Text).toBe('Calculate Your Reliefs');
    expect(merged.dashboard.welcomeGreeting).toBe('Hello,');
  });

  it('ignores blank or non-string saved values', () => {
    const merged = mergeContent({ gateway: { navCtaText: '   ', portalTitle: 42 } });
    expect(merged.gateway.navCtaText).toBe('File Tax Return');
    expect(merged.gateway.portalTitle).toBe('Secure Filing Portal');
  });

  it('merges SEO meta tags and generates valid sitemap.xml and robots directives', async () => {
    const {
      DEFAULT_SEO_CONFIG,
      computeRobotsDirective,
      evaluateSeoHealth,
      generateRobotsTxt,
      generateSitemapXml,
    } = await import('./seo');

    const merged = mergeContent({
      seo: {
        siteTitle: 'DIYtax9ja — Custom Nigerian Tax Portal Title',
        googleSiteVerification: 'gsc_token_123',
      },
    });
    expect(merged.seo.siteTitle).toBe('DIYtax9ja — Custom Nigerian Tax Portal Title');
    expect(merged.seo.googleSiteVerification).toBe('gsc_token_123');
    expect(merged.seo.canonicalUrl).toBe(DEFAULT_SEO_CONFIG.canonicalUrl);

    // Cloud domain (*.web.app) and non-landing routes are always noindex
    expect(computeRobotsDirective(merged.seo, '/', 'nairatax-6128f.web.app')).toContain('noindex');
    expect(computeRobotsDirective(merged.seo, '/admin', 'diytax9ja.ng')).toContain('noindex');
    expect(computeRobotsDirective(merged.seo, '/dashboard', 'diytax9ja.ng')).toContain('noindex');
    // Custom domain landing page is indexable in landing_only mode
    expect(computeRobotsDirective(merged.seo, '/', 'diytax9ja.ng')).toContain('index, follow');

    const xml = generateSitemapXml(merged.seo, '2026-11-21');
    expect(xml).toContain('<loc>https://diytax9ja.ng/</loc>');
    expect(xml).toContain('<lastmod>2026-11-21</lastmod>');

    const robots = generateRobotsTxt(merged.seo);
    expect(robots).toContain('Sitemap: https://diytax9ja.ng/sitemap.xml');
    expect(robots).toContain('Disallow: /admin');

    const health = evaluateSeoHealth(merged.seo);
    expect(health.score).toBeGreaterThanOrEqual(80);
  });

  it('ensures no source file in src/ contains corrupted UTF-8 Naira (â‚¦) or symbol mojibake', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    function walk(dir: string, out: string[] = []): string[] {
      for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, ent.name);
        if (ent.isDirectory()) walk(full, out);
        else if (/\.(tsx?|jsx?)$/.test(ent.name) && !ent.name.endsWith('.test.ts')) out.push(full);
      }
      return out;
    }
    const mojibakeRe = /â‚¦|â‰ˆ|â€”|â€“|â€™|â€œ|â€¢|â€¦|â†’|\ufffd/;
    const badFiles: string[] = [];
    for (const file of walk(path.resolve(process.cwd(), 'src'))) {
      const content = fs.readFileSync(file, 'utf8');
      if (mojibakeRe.test(content)) badFiles.push(file);
    }
    expect(badFiles).toEqual([]);
  });
});

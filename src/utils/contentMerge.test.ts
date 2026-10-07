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
});

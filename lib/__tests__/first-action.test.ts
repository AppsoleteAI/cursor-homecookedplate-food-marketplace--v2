import { firstActionRole, firstLegalReady, firstLocationReady, nextFirstStep } from '../first-action';
import { SIGNED_LEGAL_RECORD } from '@/backend/lib/legal-gate';

describe('first action', () => {
  const created = new Date('2026-01-01T00:00:00.000Z');

  it('sends a PlateTaker through the page, the location, and the order notes', () => {
    expect(firstActionRole('order')).toBe('platetaker');
    expect(nextFirstStep({ legalReady: false, locationReady: false, briefReady: false })).toBe('legal');
    expect(nextFirstStep({ legalReady: true, locationReady: false, briefReady: false })).toBe('location');
    expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: false })).toBe('brief');
    expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: true })).toBe('ready');
  });

  it('sends a PlateMaker through the page, the location, and the cottage-food rules', () => {
    expect(firstActionRole('publish')).toBe('platemaker');
    expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: false })).toBe('brief');
    expect(nextFirstStep({ legalReady: true, locationReady: true, briefReady: true })).toBe('ready');
  });

  it('treats a saved agreement and a named metro as already done', () => {
    expect(firstLegalReady(SIGNED_LEGAL_RECORD, created)).toBe(true);
    expect(firstLegalReady(null, created)).toBe(false);
    expect(firstLocationReady('Pittsburgh')).toBe(true);
    expect(firstLocationReady('Remote/Other')).toBe(true);
    expect(firstLocationReady(null)).toBe(false);
    expect(firstLocationReady('')).toBe(false);
  });
});

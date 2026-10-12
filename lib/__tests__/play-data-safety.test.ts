import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAY_DATA_SAFETY_OVERVIEW, PLAY_DATA_SAFETY_TYPES, PLAY_LISTING_URLS } from '../play-data-safety';

const root = join(__dirname, '../..');
const privacy = readFileSync(join(root, 'pages/legal/privacy.html'), 'utf8');

describe('Play Console Data safety', () => {
  it('uses the same privacy, terms, and support pages', () => {
    expect(PLAY_LISTING_URLS).toEqual({
      privacyPolicy: 'https://homecookedplate.com/privacy',
      terms: 'https://homecookedplate.com/terms',
      support: 'https://homecookedplate.com/support',
    });
    expect(existsSync(join(root, 'pages/legal/privacy.html'))).toBe(true);
    expect(existsSync(join(root, 'pages/legal/terms.html'))).toBe(true);
    expect(existsSync(join(root, 'pages/legal/support.html'))).toBe(true);
  });

  it('answers the overview from the privacy page', () => {
    expect(PLAY_DATA_SAFETY_OVERVIEW.collectsOrSharesUserData).toBe(true);
    expect(PLAY_DATA_SAFETY_OVERVIEW.encryptedInTransit).toBe(true);
    expect(PLAY_DATA_SAFETY_OVERVIEW.usersCanRequestDeletion).toBe(true);
    expect(PLAY_DATA_SAFETY_OVERVIEW.dataSold).toBe(false);
    expect(PLAY_DATA_SAFETY_OVERVIEW.usedForTracking).toBe(false);
    expect(PLAY_DATA_SAFETY_OVERVIEW.usesAdvertisingId).toBe(false);
    expect(PLAY_DATA_SAFETY_OVERVIEW.directedAtChildrenUnder13).toBe(false);
    for (const excerpt of Object.values(PLAY_DATA_SAFETY_OVERVIEW.excerpts)) {
      expect(privacy).toContain(excerpt);
    }
  });

  it('declares only data types the privacy page describes, and does not mark them shared', () => {
    expect(PLAY_DATA_SAFETY_TYPES.length).toBeGreaterThan(0);
    for (const answer of PLAY_DATA_SAFETY_TYPES) {
      expect(answer.collected).toBe(true);
      expect(answer.shared).toBe(false);
      expect(answer.ephemeral).toBe(false);
      expect(answer.purposes.length).toBeGreaterThan(0);
      expect(privacy).toContain(answer.privacyExcerpt);
    }
  });
});

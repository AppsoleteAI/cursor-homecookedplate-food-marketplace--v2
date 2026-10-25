import {
  FOOD_INFLUENCER_MARK,
  clipFrameAllowsNavigation,
  foodReviewClipMeta,
  foodReviewLinkClip,
  foodReviewTimeline,
  seedFoodReviewClips,
  socialClipEmbed,
  withSeedClips,
} from '../food-review-clips';

const INSTAGRAM_REEL = 'https://www.instagram.com/reel/DMWBHRruXvj/?hl=en';
const SNAPCHAT_SPOTLIGHT = 'https://www.snapchat.com/@belieber_qal/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYY2Zpdnd2c3FtAaFqnqVdAaFqnpFAAAAAAA';

const FACEBOOK_POST = 'https://www.facebook.com/DjYoyoFromMiami/posts/an-indiana-woman-got-the-internet-real-confused-after-her-accent-started-switchi/4412902925522983/';

describe('social clip links', () => {
  it('plays a Facebook post inside the clip frame', () => {
    const embed = socialClipEmbed(FACEBOOK_POST, 360, 640);
    expect(embed.source).toBe('facebook');
    expect(embed.embedUrl).toContain('https://www.facebook.com/plugins/post.php?href=');
    expect(embed.embedUrl).toContain(encodeURIComponent('https://www.facebook.com/DjYoyoFromMiami/posts/4412902925522983'));
    expect(embed.letterbox).toBe(true);
  });

  it('plays a Facebook video and a YouTube short inside the clip frame', () => {
    const video = socialClipEmbed('https://www.facebook.com/page/videos/1234567890/');
    expect(video.source).toBe('facebook');
    expect(video.embedUrl).toContain('plugins/video.php');
    const short = socialClipEmbed('https://www.youtube.com/shorts/BNtYg_hnO7E');
    expect(short.source).toBe('youtube');
    expect(short.embedUrl).toContain('https://www.youtube.com/embed/BNtYg_hnO7E');
  });

  it('plays Instagram, TikTok, Snapchat, and X links inside the clip frame', () => {
    expect(socialClipEmbed(INSTAGRAM_REEL).embedUrl).toBe('https://www.instagram.com/reel/DMWBHRruXvj/embed');
    expect(socialClipEmbed('https://www.tiktok.com/@cook/video/1234567890123456789').embedUrl).toBe('https://www.tiktok.com/embed/v2/1234567890123456789');
    expect(socialClipEmbed(SNAPCHAT_SPOTLIGHT).embedUrl).toContain('https://www.snapchat.com/embed?url=');
    expect(socialClipEmbed(SNAPCHAT_SPOTLIGHT).embedUrl).toContain('belieber_qal');
    expect(foodReviewLinkClip('https://vimeo.com/123456789')).toBeNull();
    expect(socialClipEmbed('https://x.com/cook/status/1234567890123456789').letterbox).toBe(true);
  });

  it('keeps a click from leaving the clip and lets playback load', () => {
    expect(clipFrameAllowsNavigation('click')).toBe(false);
    expect(clipFrameAllowsNavigation('other')).toBe(true);
  });

  it('accepts a direct video file and refuses a page that is not a clip', () => {
    expect(foodReviewLinkClip('https://cdn.example.com/plate.mp4')?.source).toBe('file');
    expect(foodReviewLinkClip('https://example.com/not-a-clip')).toBeNull();
    expect(foodReviewLinkClip(FACEBOOK_POST)?.source).toBe('facebook');
  });
});

describe('verified influencer seed', () => {
  it('keeps the verified influencer clip and puts Snapchat in the fourth seed slot', () => {
    const clip = seedFoodReviewClips[0];
    expect(clip.author).toBe('DjYoyoFromMiami');
    expect(clip.verifiedInfluencer).toBe(true);
    expect(FOOD_INFLUENCER_MARK).toBe('✅');
    expect(clip.videoUri).toBe(INSTAGRAM_REEL);
    expect(foodReviewClipMeta(clip)).toBe('platetaker · Instagram');
    expect(seedFoodReviewClips[3].id).toBe('clip-belieber-spotlight');
    expect(seedFoodReviewClips[3].author).toBe('belieber_qal');
    expect(seedFoodReviewClips[3].videoUri).toBe(SNAPCHAT_SPOTLIGHT);
  });

  it('shows two new clips, then the next popular clip', () => {
    const ordered = foodReviewTimeline(seedFoodReviewClips).map((clip) => clip.id);
    expect(ordered).toEqual([
      'clip-dj-yoyo-indiana',
      'clip-belieber-spotlight',
      'clip-orlando-plates',
      'clip-two-dollar-plates',
      'clip-louisiana-plates',
    ]);
  });

  it('replaces a stored seed link when the seed video changes', () => {
    const stored = { ...seedFoodReviewClips[0], videoUri: FACEBOOK_POST };
    const merged = withSeedClips([stored]);
    expect(merged.find((clip) => clip.id === 'clip-dj-yoyo-indiana')?.videoUri).toBe(INSTAGRAM_REEL);
  });

  it('adds a missing seed clip without dropping clips already on the device', () => {
    const mine = seedFoodReviewClips[1];
    const merged = withSeedClips([mine]);
    expect(merged[0].id).toBe('clip-dj-yoyo-indiana');
    expect(merged.some((clip) => clip.id === mine.id)).toBe(true);
  });
});

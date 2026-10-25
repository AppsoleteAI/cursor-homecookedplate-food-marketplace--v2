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
const TIKTOK_CLIP = 'https://www.tiktok.com/@nicole.ludwig/video/7524134107157105950';
const REDDIT_REVIEW = 'https://www.reddit.com/r/LoveTrash/comments/1wz4alk/reviewing_influencer_food_reviews/';
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

  it('plays Instagram, TikTok, Reddit, and X links inside the clip frame', () => {
    expect(socialClipEmbed(INSTAGRAM_REEL).embedUrl).toBe('https://www.instagram.com/reel/DMWBHRruXvj/embed');
    expect(socialClipEmbed(TIKTOK_CLIP).embedUrl).toBe('https://www.tiktok.com/player/v1/7524134107157105950?music_info=1&description=1');
    expect(socialClipEmbed(REDDIT_REVIEW).embedUrl).toBe('https://www.redditmedia.com/r/LoveTrash/comments/1wz4alk/reviewing_influencer_food_reviews/?ref_source=embed&ref=share&embed=true');
    expect(socialClipEmbed(SNAPCHAT_SPOTLIGHT).embedUrl).toBeNull();
    expect(foodReviewLinkClip(SNAPCHAT_SPOTLIGHT)).toBeNull();
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
  it('keeps the TikTok clip in the first seed slot and the Reddit review in the fourth', () => {
    const clip = seedFoodReviewClips[0];
    expect(clip.author).toBe('nicole.ludwig');
    expect(clip.mealName).toBe('TikTok clip');
    expect(clip.verifiedInfluencer).toBeUndefined();
    expect(FOOD_INFLUENCER_MARK).toBe('✅');
    expect(clip.videoUri).toBe(TIKTOK_CLIP);
    expect(foodReviewClipMeta(clip)).toBe('platetaker · TikTok');
    expect(seedFoodReviewClips[3].id).toBe('clip-belieber-spotlight');
    expect(seedFoodReviewClips[3].author).toBe('LoveTrash');
    expect(seedFoodReviewClips[3].verifiedInfluencer).toBe(true);
    expect(seedFoodReviewClips[3].mealName).toBe('Reviewing influencer food reviews');
    expect(seedFoodReviewClips[3].videoUri).toBe(REDDIT_REVIEW);
    expect(foodReviewClipMeta(seedFoodReviewClips[3])).toBe('platetaker · Reddit');
  });

  it('shows two new clips, then the next popular clip', () => {
    const ordered = foodReviewTimeline(seedFoodReviewClips).map((clip) => clip.id);
    expect(ordered).toEqual([
      'clip-belieber-spotlight',
      'clip-two-dollar-plates',
      'clip-orlando-plates',
      'clip-louisiana-plates',
      'clip-dj-yoyo-indiana',
    ]);
  });

  it('replaces a stored seed link when the seed video changes', () => {
    const stored = { ...seedFoodReviewClips[0], videoUri: FACEBOOK_POST };
    const merged = withSeedClips([stored]);
    expect(merged.find((clip) => clip.id === 'clip-dj-yoyo-indiana')?.videoUri).toBe(TIKTOK_CLIP);
  });

  it('drops a stored Snapchat clip and keeps the Reddit review in that slot', () => {
    const stored = { ...seedFoodReviewClips[3], videoUri: SNAPCHAT_SPOTLIGHT, counts: { smile: 2, heart: 0, star: 0 }, reactionsByUser: {} };
    const stray = { ...seedFoodReviewClips[1], id: 'clip-old-snap', videoUri: SNAPCHAT_SPOTLIGHT };
    const merged = withSeedClips([stored, stray]);
    expect(merged.some((clip) => clip.videoUri.includes('snapchat.com'))).toBe(false);
    expect(merged.find((clip) => clip.id === 'clip-belieber-spotlight')?.videoUri).toBe(REDDIT_REVIEW);
    expect(merged.find((clip) => clip.id === 'clip-belieber-spotlight')?.counts.smile).toBe(2);
  });

  it('adds a missing seed clip without dropping clips already on the device', () => {
    const mine = seedFoodReviewClips[1];
    const merged = withSeedClips([mine]);
    expect(merged[0].id).toBe('clip-dj-yoyo-indiana');
    expect(merged.some((clip) => clip.id === mine.id)).toBe(true);
  });
});

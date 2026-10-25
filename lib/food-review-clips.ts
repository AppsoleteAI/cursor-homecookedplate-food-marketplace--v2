export const FOOD_REVIEW_MAX_SECONDS = 20;

export const FOOD_REVIEW_PLAYER_SIZES = {
  mobile: { width: 360, height: 640 },
  tablet: { width: 480, height: 853 },
  web: { width: 640, height: 1138 },
} as const;

export type FoodReviewPlayerSurface = keyof typeof FOOD_REVIEW_PLAYER_SIZES;

export type FoodReviewReaction = 'smile' | 'heart' | 'star';

/** 75% of the 36px back-arrow chip. */
export const FOOD_REVIEW_REACTION_EMOJI_SIZE = 27;

/**
 * Space-between spreads the reactions across the row. Half of that gap
 * pulls the same three chips toward the center.
 */
export function foodReviewReactionGap(rowWidth: number, chipWidth: number, count = FOOD_REVIEW_REACTIONS.length): number {
  if (rowWidth <= 0 || chipWidth <= 0 || count < 2) return 0;
  const spread = Math.max(0, rowWidth - chipWidth * count);
  return spread / (count - 1) / 2;
}

export const FOOD_REVIEW_REACTIONS: { kind: FoodReviewReaction; emoji: string; label: string }[] = [
  { kind: 'smile', emoji: '😊', label: 'Smile' },
  { kind: 'heart', emoji: '❤️', label: 'Heart' },
  { kind: 'star', emoji: '⭐', label: 'Star' },
];

/** Shown beside @screenname after a food influencer is verified. */
export const FOOD_INFLUENCER_MARK = '✅';

export interface FoodReviewClip {
  id: string;
  mealName: string;
  author: string;
  role: 'platemaker' | 'platetaker';
  videoUri: string;
  posterUri: string;
  durationSeconds: number;
  createdAt: string;
  counts: Record<FoodReviewReaction, number>;
  reactionsByUser: Record<string, FoodReviewReaction[]>;
  /** Social food influencer whose profiles were verified. */
  verifiedInfluencer?: boolean;
  /** False when the length is the 20 second slot, not a measured clip. */
  durationMeasured?: boolean;
}

export type FoodReviewSurface = 'mobile' | 'tablet' | 'web';

export function foodReviewSurface(platformOs: string, windowWidth: number, windowHeight: number): FoodReviewSurface {
  if (platformOs !== 'web') {
    return Math.min(windowWidth, windowHeight) >= 768 ? 'tablet' : 'mobile';
  }
  if (windowWidth >= 1100) return 'web';
  if (windowWidth >= 700) return 'tablet';
  return 'mobile';
}

/**
 * The clip is as wide as the post: left edge with the title, right edge with the star.
 * Height stays 9:16, and the timeline scrolls.
 */
export function resolveFoodReviewTimelineLayout(
  windowWidth: number,
  _windowHeight: number,
  surface: FoodReviewSurface = 'mobile',
) {
  const gutter = 16;
  const availableWidth = Math.max(windowWidth - gutter * 2, 200);
  const columnCap = surface === 'web' ? 720 : surface === 'tablet' ? 640 : 420;
  const columnWidth = Math.min(availableWidth, columnCap);
  const width = columnWidth;
  const height = Math.round(width * (16 / 9));
  return { columnWidth, width, height };
}

/** ImagePicker reports milliseconds. HTML video metadata reports seconds. */
export function exceedsFoodReviewClipLimit(duration: number | null | undefined): boolean {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return false;
  const seconds = duration >= 1000 ? duration / 1000 : duration;
  return seconds > FOOD_REVIEW_MAX_SECONDS + 0.25;
}

export function foodReviewDurationSeconds(duration: number | null | undefined, fallback = FOOD_REVIEW_MAX_SECONDS): number {
  if (typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) return fallback;
  const seconds = duration >= 1000 ? duration / 1000 : duration;
  return Math.min(FOOD_REVIEW_MAX_SECONDS, Math.max(1, Math.round(seconds)));
}

export function toggleFoodReviewReaction(
  clip: FoodReviewClip,
  username: string,
  kind: FoodReviewReaction,
): FoodReviewClip {
  const mine = new Set(clip.reactionsByUser[username] ?? []);
  const already = mine.has(kind);
  if (already) mine.delete(kind);
  else mine.add(kind);
  const delta = already ? -1 : 1;
  return {
    ...clip,
    counts: {
      ...clip.counts,
      [kind]: Math.max(0, clip.counts[kind] + delta),
    },
    reactionsByUser: {
      ...clip.reactionsByUser,
      [username]: [...mine],
    },
  };
}

export const FOOD_REVIEW_CLIPS_KEY = '@food_review_clips_v2';

/** YouTube page URLs are not video files. The player embeds these. */
export function youtubeVideoId(uri: string): string | null {
  try {
    const url = new URL(uri);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      const id = url.pathname.split('/').filter(Boolean)[0];
      return id || null;
    }
    if (host !== 'youtube.com' && host !== 'm.youtube.com') return null;
    if (url.pathname.startsWith('/shorts/') || url.pathname.startsWith('/embed/')) {
      return url.pathname.split('/')[2] || null;
    }
    return url.searchParams.get('v');
  } catch {
    return null;
  }
}

export function youtubeEmbedUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?rel=0&controls=1&playsinline=1&fs=1`;
}

export type SocialClipSource = 'youtube' | 'facebook' | 'instagram' | 'tiktok' | 'snapchat' | 'x' | 'file';

export function socialClipSourceLabel(source: SocialClipSource): string {
  switch (source) {
    case 'youtube': return 'YouTube';
    case 'facebook': return 'Facebook';
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    case 'snapchat': return 'Snapchat';
    case 'x': return 'X';
    default: return 'Clip';
  }
}

function httpsUrl(uri: string): URL | null {
  try {
    const url = new URL(uri.trim());
    if (url.protocol !== 'https:') return null;
    return url;
  } catch {
    return null;
  }
}

function siteHost(url: URL): string {
  return url.hostname.replace(/^www\./, '').replace(/^m\./, '').replace(/^web\./, '');
}

/**
 * Page links from social sites play inside the clip frame.
 * A file URL stays a video. Any other page is not an embed.
 */
export function socialClipEmbed(
  uri: string,
  width = 360,
  height = 640,
): { source: SocialClipSource; embedUrl: string | null; posterUri: string; letterbox: boolean } {
  const empty = { source: 'file' as const, embedUrl: null, posterUri: '', letterbox: false };
  const url = httpsUrl(uri);
  if (!url) return empty;

  const youtubeId = youtubeVideoId(url.toString());
  if (youtubeId) {
    return {
      source: 'youtube',
      embedUrl: youtubeEmbedUrl(youtubeId),
      posterUri: `https://i.ytimg.com/vi/${youtubeId}/hq2.jpg`,
      letterbox: false,
    };
  }

  const host = siteHost(url);
  const frameWidth = Math.max(220, Math.round(width));
  const frameHeight = Math.max(220, Math.round(height));

  if (host === 'facebook.com' || host === 'fb.com' || host === 'fb.watch') {
    const parts = url.pathname.split('/').filter(Boolean);
    const video = host === 'fb.watch'
      || /\/(videos|reel|watch)(\/|$)/.test(url.pathname)
      || url.searchParams.has('v');
    const postId = [...parts].reverse().find((part) => /^\d+$/.test(part));
    const page = parts[0];
    const permalink = !video && postId && page && page !== 'posts'
      ? `https://www.facebook.com/${page}/posts/${postId}`
      : url.toString();
    const href = encodeURIComponent(permalink);
    const embedUrl = video
      ? `https://www.facebook.com/plugins/video.php?href=${href}&show_text=false&width=${frameWidth}&height=${frameHeight}`
      : `https://www.facebook.com/plugins/post.php?href=${href}&show_text=true&width=${frameWidth}`;
    return { source: 'facebook', embedUrl, posterUri: '', letterbox: !video };
  }

  if (host === 'instagram.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const kind = parts[0];
    const code = parts[1];
    if ((kind === 'p' || kind === 'reel' || kind === 'tv') && code) {
      const embedKind = kind === 'tv' ? 'p' : kind;
      return {
        source: 'instagram',
        embedUrl: `https://www.instagram.com/${embedKind}/${code}/embed`,
        posterUri: '',
        letterbox: kind === 'p',
      };
    }
    return empty;
  }

  if (host === 'tiktok.com') {
    const match = url.pathname.match(/\/video\/(\d+)/);
    if (!match) return empty;
    return { source: 'tiktok', embedUrl: `https://www.tiktok.com/embed/v2/${match[1]}`, posterUri: '', letterbox: false };
  }

  if (host === 'snapchat.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const spotlightAt = parts.indexOf('spotlight');
    const id = spotlightAt >= 0 ? parts[spotlightAt + 1]?.split('?')[0] : '';
    if (!id) return empty;
    const user = parts[0]?.startsWith('@') ? parts[0] : '';
    const canonical = user
      ? `https://www.snapchat.com/${user}/spotlight/${id}`
      : `https://www.snapchat.com/spotlight/${id}`;
    return {
      source: 'snapchat',
      embedUrl: `https://www.snapchat.com/embed?url=${encodeURIComponent(canonical)}`,
      posterUri: '',
      letterbox: false,
    };
  }

  if (host === 'x.com' || host === 'twitter.com') {
    const parts = url.pathname.split('/').filter(Boolean);
    const id = parts[parts.length - 1];
    if (parts.includes('status') && id && /^\d+$/.test(id)) {
      return { source: 'x', embedUrl: `https://platform.twitter.com/embed/Tweet.html?id=${id}`, posterUri: '', letterbox: true };
    }
    return empty;
  }

  return empty;
}

/** A pasted link that can play in the clip frame, or a direct video file. */
export function foodReviewLinkClip(uri: string): { videoUri: string; posterUri: string; source: SocialClipSource } | null {
  const trimmed = uri.trim();
  const url = httpsUrl(trimmed);
  if (!url) return null;
  const embed = socialClipEmbed(trimmed);
  if (embed.embedUrl) {
    return { videoUri: url.toString(), posterUri: embed.posterUri, source: embed.source };
  }
  if (/\.(mp4|mov|m4v|webm|m3u8)(\?|$)/i.test(url.pathname)) {
    return { videoUri: url.toString(), posterUri: '', source: 'file' };
  }
  return null;
}

export function foodReviewReactionTotal(clip: Pick<FoodReviewClip, 'counts'>): number {
  return clip.counts.smile + clip.counts.heart + clip.counts.star;
}

/** A click that would leave the clip is refused. Playback loads stay in the frame. */
export function clipFrameAllowsNavigation(navigationType: string | undefined): boolean {
  return navigationType !== 'click';
}

/**
 * Two newest clips, then the next popular clip that is not already shown.
 * new, new, popular, new, new, popular.
 */
export function foodReviewTimeline<T extends FoodReviewClip>(clips: T[]): T[] {
  const fresh = [...clips].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const popular = [...clips].sort((left, right) => (
    foodReviewReactionTotal(right) - foodReviewReactionTotal(left) || right.createdAt.localeCompare(left.createdAt)
  ));
  const used = new Set<string>();
  const ordered: T[] = [];
  const take = (list: T[], cursor: { index: number }) => {
    while (cursor.index < list.length && used.has(list[cursor.index].id)) cursor.index += 1;
    if (cursor.index >= list.length) return false;
    used.add(list[cursor.index].id);
    ordered.push(list[cursor.index]);
    cursor.index += 1;
    return true;
  };
  const freshCursor = { index: 0 };
  const popularCursor = { index: 0 };
  while (ordered.length < clips.length) {
    const addedNew = take(fresh, freshCursor);
    const addedSecond = take(fresh, freshCursor);
    const addedPopular = take(popular, popularCursor);
    if (!addedNew && !addedSecond && !addedPopular) break;
  }
  return ordered;
}

export function foodReviewClipMeta(clip: Pick<FoodReviewClip, 'role' | 'videoUri' | 'durationSeconds' | 'durationMeasured'>): string {
  const embed = socialClipEmbed(clip.videoUri);
  if (embed.embedUrl) {
    const label = socialClipSourceLabel(embed.source);
    if (clip.durationMeasured === false) return `${clip.role} · ${label}`;
    return `${clip.role} · ${label} · ${clip.durationSeconds}s`;
  }
  return `${clip.role} · ${clip.durationSeconds}s`;
}

export const seedFoodReviewClips: FoodReviewClip[] = [
  {
    id: 'clip-dj-yoyo-indiana',
    mealName: 'An Indiana woman got the internet real confused',
    author: 'DjYoyoFromMiami',
    role: 'platetaker',
    videoUri: 'https://www.instagram.com/reel/DMWBHRruXvj/?hl=en',
    posterUri: '',
    durationSeconds: FOOD_REVIEW_MAX_SECONDS,
    createdAt: '2026-10-25T07:00:00.000Z',
    counts: { smile: 0, heart: 0, star: 0 },
    reactionsByUser: {},
    verifiedInfluencer: true,
    durationMeasured: false,
  },
  {
    id: 'clip-orlando-plates',
    mealName: 'Selling plates in Orlando, FL 32825',
    author: 'collegegirlcooks',
    role: 'platemaker',
    videoUri: 'https://www.youtube.com/shorts/BNtYg_hnO7E',
    posterUri: 'https://i.ytimg.com/vi/BNtYg_hnO7E/hq2.jpg',
    durationSeconds: 11,
    createdAt: '2026-04-02T18:00:00.000Z',
    counts: { smile: 12, heart: 9, star: 7 },
    reactionsByUser: {},
  },
  {
    id: 'clip-louisiana-plates',
    mealName: 'Come sell plates in Louisiana',
    author: '9etherhouseoframen',
    role: 'platemaker',
    videoUri: 'https://www.youtube.com/shorts/yB0HFxUOf9s',
    posterUri: 'https://i.ytimg.com/vi/yB0HFxUOf9s/hq2.jpg',
    durationSeconds: 67,
    createdAt: '2026-04-04T19:30:00.000Z',
    counts: { smile: 6, heart: 14, star: 4 },
    reactionsByUser: {},
  },
  {
    id: 'clip-belieber-spotlight',
    mealName: 'Spotlight',
    author: 'belieber_qal',
    role: 'platetaker',
    videoUri: 'https://www.snapchat.com/@belieber_qal/spotlight/W7_EDlXWTBiXAEEniNoMPwAAYY2Zpdnd2c3FtAaFqnqVdAaFqnpFAAAAAAA',
    posterUri: '',
    durationSeconds: FOOD_REVIEW_MAX_SECONDS,
    createdAt: '2026-10-25T06:00:00.000Z',
    counts: { smile: 0, heart: 0, star: 0 },
    reactionsByUser: {},
    durationMeasured: false,
  },
  {
    id: 'clip-two-dollar-plates',
    mealName: 'These $2 plates are selling fast',
    author: 'chefquail',
    role: 'platemaker',
    videoUri: 'https://www.youtube.com/shorts/Kv6JGnMJAv0',
    posterUri: 'https://i.ytimg.com/vi/Kv6JGnMJAv0/hq2.jpg',
    durationSeconds: 8,
    createdAt: '2026-04-06T12:15:00.000Z',
    counts: { smile: 4, heart: 3, star: 11 },
    reactionsByUser: {},
  },
];

export function withSeedClips(clips: FoodReviewClip[]): FoodReviewClip[] {
  const seeds = new Map(seedFoodReviewClips.map((clip) => [clip.id, clip]));
  const refreshed = clips.map((clip) => {
    const seed = seeds.get(clip.id);
    if (!seed) return clip;
    return { ...clip, ...seed, counts: clip.counts, reactionsByUser: clip.reactionsByUser };
  });
  const ids = new Set(refreshed.map((clip) => clip.id));
  const missing = seedFoodReviewClips.filter((clip) => !ids.has(clip.id));
  return missing.length > 0 ? [...missing, ...refreshed] : refreshed;
}

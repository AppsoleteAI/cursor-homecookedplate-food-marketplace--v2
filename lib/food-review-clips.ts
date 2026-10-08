export const FOOD_REVIEW_MAX_SECONDS = 20;

export const FOOD_REVIEW_PLAYER_SIZES = {
  mobile: { width: 360, height: 640 },
  tablet: { width: 480, height: 853 },
  web: { width: 640, height: 1138 },
} as const;

export type FoodReviewPlayerSurface = keyof typeof FOOD_REVIEW_PLAYER_SIZES;

export type FoodReviewReaction = 'smile' | 'heart' | 'star';

export const FOOD_REVIEW_REACTIONS: { kind: FoodReviewReaction; emoji: string; label: string }[] = [
  { kind: 'smile', emoji: '😊', label: 'Smile' },
  { kind: 'heart', emoji: '❤️', label: 'Heart' },
  { kind: 'star', emoji: '⭐', label: 'Star' },
];

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

export const seedFoodReviewClips: FoodReviewClip[] = [
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

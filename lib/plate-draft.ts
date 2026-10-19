export type PlateDraftMedia = {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
};

export type PlateDraft = {
  name: string;
  price: string;
  media: PlateDraftMedia[];
  postVideoToTimeline: boolean;
};

const emptyDraft = (): PlateDraft => ({ name: '', price: '', media: [], postVideoToTimeline: false });

let current: PlateDraft = emptyDraft();
const published = new Set<() => void>();

/** Snapshot the create-meal form before opening the publish screen. */
export function writePlateDraft(next: PlateDraft) {
  current = {
    name: next.name,
    price: next.price,
    media: next.media.map((item) => ({ ...item })),
    postVideoToTimeline: next.postVideoToTimeline === true,
  };
}

export function readPlateDraft(): PlateDraft {
  return {
    name: current.name,
    price: current.price,
    media: current.media.map((item) => ({ ...item })),
    postVideoToTimeline: current.postVideoToTimeline === true,
  };
}

/** Create Meal listens for this so a finished publish clears the form. */
export function onPlatePublished(listener: () => void) {
  published.add(listener);
  return () => {
    published.delete(listener);
  };
}

export function markPlatePublished() {
  current = emptyDraft();
  published.forEach((listener) => listener());
}

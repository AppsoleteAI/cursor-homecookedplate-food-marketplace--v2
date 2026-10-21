export type PlateDraftMedia = {
  uri: string;
  type: 'image' | 'video';
  duration?: number;
};

export type PlateWindow = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};

export type PlateDraft = {
  name: string;
  price: string;
  preparationMinutes: string;
  media: PlateDraftMedia[];
  availabilityWindows: PlateWindow[];
  portions: string;
  postVideoToTimeline: boolean;
};

const emptyDraft = (): PlateDraft => ({
  name: '',
  price: '',
  preparationMinutes: '',
  media: [],
  availabilityWindows: [],
  portions: '1',
  postVideoToTimeline: false,
});

let current: PlateDraft = emptyDraft();
const published = new Set<() => void>();

/** Snapshot the create-meal form before opening the publish screen. */
export function writePlateDraft(next: PlateDraft) {
  current = {
    name: next.name,
    price: next.price,
    preparationMinutes: next.preparationMinutes,
    media: next.media.map((item) => ({ ...item })),
    availabilityWindows: next.availabilityWindows.map((window) => ({ ...window })),
    portions: next.portions || '1',
    postVideoToTimeline: next.postVideoToTimeline === true,
  };
}

export function readPlateDraft(): PlateDraft {
  return {
    name: current.name,
    price: current.price,
    preparationMinutes: current.preparationMinutes ?? '',
    media: current.media.map((item) => ({ ...item })),
    availabilityWindows: (current.availabilityWindows ?? []).map((window) => ({ ...window })),
    portions: current.portions || '1',
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

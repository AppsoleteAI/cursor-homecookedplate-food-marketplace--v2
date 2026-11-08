import { parseMealImageReport, visiblePlateMedia, withoutHiddenVideos } from '../hidden-clips';

describe('hidden clip videos', () => {
  it('keeps the food photo and holds the reported video', () => {
    const photo = 'https://example.supabase.co/storage/v1/object/public/meal-media/cook/meal/plate.jpg';
    const video = 'https://example.supabase.co/storage/v1/object/public/meal-media/cook/meal/plate.mp4';
    expect(withoutHiddenVideos([photo, video], new Set([video]))).toEqual([photo]);
  });

  it('holds a reported food photo and keeps the other photo and the video', () => {
    const first = 'https://example.supabase.co/storage/v1/object/public/meal-media/cook/meal/one.jpg';
    const second = 'https://example.supabase.co/storage/v1/object/public/meal-media/cook/meal/two.jpg';
    const video = 'https://example.supabase.co/storage/v1/object/public/meal-media/cook/meal/plate.mp4';
    expect(visiblePlateMedia([first, second, video], [first], new Set())).toEqual([second, video]);
    expect(parseMealImageReport(`meal-1|${first}`)).toEqual({ mealId: 'meal-1', imageUrl: first });
  });
});
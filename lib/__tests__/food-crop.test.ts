import { FOOD_SUBJECT_Y, foodCrop } from '../food-crop';

describe('foodCrop', () => {
  it('puts the dish in the middle of a short frame', () => {
    const crop = foodCrop(800, 1066, 336, 180);
    expect(crop).not.toBeNull();
    const subject = crop!.top + FOOD_SUBJECT_Y * crop!.height;
    expect(subject).toBeCloseTo(90, 5);
    expect(crop!.top).toBeLessThan(0);
  });

  it('keeps a wide photo centered from side to side', () => {
    const crop = foodCrop(1200, 800, 200, 200);
    expect(crop).not.toBeNull();
    expect(crop!.top).toBe(0);
    expect(crop!.left).toBeLessThan(0);
    expect(crop!.left + crop!.width / 2).toBeCloseTo(100, 5);
  });

  it('returns nothing until the photo and the frame are known', () => {
    expect(foodCrop(0, 100, 100, 100)).toBeNull();
    expect(foodCrop(100, 100, 0, 100)).toBeNull();
  });
});

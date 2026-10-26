/** Plated food usually sits a little below the middle of a tall photo. */
export const FOOD_SUBJECT_Y = 0.66;

export type FoodCropBox = {
  width: number;
  height: number;
  left: number;
  top: number;
};

/**
 * Cover-crop a food photo so the dish lands in the middle of the frame.
 * A tall photo in a short frame shifts down toward the plate. A wide photo stays centered.
 */
export function foodCrop(
  naturalWidth: number,
  naturalHeight: number,
  frameWidth: number,
  frameHeight: number,
): FoodCropBox | null {
  if (naturalWidth <= 0 || naturalHeight <= 0 || frameWidth <= 0 || frameHeight <= 0) return null;
  const imageAspect = naturalWidth / naturalHeight;
  const frameAspect = frameWidth / frameHeight;
  if (imageAspect < frameAspect) {
    const height = frameWidth / imageAspect;
    return {
      width: frameWidth,
      height,
      left: 0,
      top: frameHeight / 2 - FOOD_SUBJECT_Y * height,
    };
  }
  const width = frameHeight * imageAspect;
  return {
    width,
    height: frameHeight,
    left: (frameWidth - width) / 2,
    top: 0,
  };
}

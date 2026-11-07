/** Source tree for the binaries uploaded on 2 November 2026. */
export const SOURCE_VERSION = '1.0.0';
export const UPLOADED_IOS_BUILD = '9';
export const UPLOADED_ANDROID_VERSION_CODE = 9;

/**
 * Public reviews as of 2 November 2026. iOS 1.0.0 (8) was Waiting for Review.
 * Play production 8 was In review for the United States. Build 9 is uploaded
 * and is not that binary. Build 8 has no home-kitchen agreement screen.
 */
export const PUBLIC_REVIEW_BUILD = 8;

export function kitchenAgreementIsInBinary(build: number): boolean {
  return Number.isInteger(build) && build >= 9;
}

/** iOS 13 was uploaded 18 November 2026. Android 13 is the 16 KB page package. */
export const SOURCE_VERSION = '1.0.0';
export const UPLOADED_IOS_BUILD = '13';
export const UPLOADED_ANDROID_VERSION_CODE = 13;

/**
 * Public phone app: the store binary a person installs, build 8, on iOS and
 * on Android. It is not the website, and it is not later internal builds.
 * Build 8 has email sign-in, no Apple sign-in, no Google sign-in, and no
 * home-kitchen agreement screen. The cook saves that agreement on the
 * website. iOS, Android, and the website then use that one account record.
 * Build 9 and later include the agreement screen and Apple and Google
 * sign-in, and they are not the public binary until App Review promotes one.
 */
export const PUBLIC_REVIEW_BUILD = 8;

export function kitchenAgreementIsInBinary(build: number): boolean {
  return Number.isInteger(build) && build >= 9;
}

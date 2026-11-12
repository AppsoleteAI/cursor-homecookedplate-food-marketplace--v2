/** Source tree for the binaries uploaded on 12 November 2026. */
export const SOURCE_VERSION = '1.0.0';
export const UPLOADED_IOS_BUILD = '12';
export const UPLOADED_ANDROID_VERSION_CODE = 11;

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

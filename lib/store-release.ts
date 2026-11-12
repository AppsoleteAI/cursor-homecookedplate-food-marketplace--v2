/** Source tree for the binaries uploaded on 10 November 2026. */
export const SOURCE_VERSION = '1.0.0';
export const UPLOADED_IOS_BUILD = '10';
export const UPLOADED_ANDROID_VERSION_CODE = 10;

/**
 * Public phone app: the store binary a person installs, build 8, on iOS and
 * on Android. It is not the website, and it is not build 9 or build 10.
 * Build 8 has email sign-in, no Apple sign-in, no Google sign-in, and no
 * home-kitchen agreement screen. The cook saves that agreement on the
 * website. iOS, Android, and the website then use that one account record.
 * Build 10 includes the agreement screen and Apple and Google sign-in, and
 * it is not the public binary.
 */
export const PUBLIC_REVIEW_BUILD = 8;

export function kitchenAgreementIsInBinary(build: number): boolean {
  return Number.isInteger(build) && build >= 9;
}

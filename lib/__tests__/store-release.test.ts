import { readFileSync } from 'fs';
import { join } from 'path';
import {
  PUBLIC_REVIEW_BUILD,
  SOURCE_VERSION,
  UPLOADED_ANDROID_VERSION_CODE,
  UPLOADED_IOS_BUILD,
  kitchenAgreementIsInBinary,
} from '../store-release';

describe('store release', () => {
  const app = JSON.parse(readFileSync(join(__dirname, '../../app.json'), 'utf8')) as {
    expo: { version: string; ios: { buildNumber: string }; android: { versionCode: number } };
  };

  it('matches the uploaded 1.0.0 iOS 12 / Android 11 pair and leaves the public review on build 8', () => {
    expect(app.expo.version).toBe(SOURCE_VERSION);
    expect(app.expo.ios.buildNumber).toBe(UPLOADED_IOS_BUILD);
    expect(app.expo.android.versionCode).toBe(UPLOADED_ANDROID_VERSION_CODE);
    expect(Number(app.expo.ios.buildNumber)).toBeGreaterThan(PUBLIC_REVIEW_BUILD);
    expect(app.expo.android.versionCode).toBeGreaterThan(PUBLIC_REVIEW_BUILD);
    expect(kitchenAgreementIsInBinary(PUBLIC_REVIEW_BUILD)).toBe(false);
    expect(kitchenAgreementIsInBinary(Number(app.expo.ios.buildNumber))).toBe(true);
    expect(kitchenAgreementIsInBinary(app.expo.android.versionCode)).toBe(true);
  });
});

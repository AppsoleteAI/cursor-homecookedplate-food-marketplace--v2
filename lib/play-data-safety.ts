import { PRIVACY_POLICY_URL, SUPPORT_URL, TERMS_OF_SERVICE_URL } from '@/constants/urls';

/**
 * Play Console Data safety answers taken from pages/legal/privacy.html.
 * Play Console has no public API for this form, so these are the selections
 * to enter for com.rork.homecookedplate. Shared stays no: the privacy page
 * says Supabase, Stripe, Expo, Sentry, and Cloudflare process data for
 * HomeCookedPlate.
 */
export const PLAY_LISTING_URLS = {
  privacyPolicy: PRIVACY_POLICY_URL,
  terms: TERMS_OF_SERVICE_URL,
  support: SUPPORT_URL,
} as const;

export const PLAY_DATA_SAFETY_OVERVIEW = {
  collectsOrSharesUserData: true,
  encryptedInTransit: true,
  usersCanRequestDeletion: true,
  dataSold: false,
  usedForTracking: false,
  usesAdvertisingId: false,
  directedAtChildrenUnder13: false,
  accountCreation: ['Email address', 'Username and password'],
  excerpts: {
    encryptedInTransit: 'encrypted in transit',
    deletion: 'delete the account',
    notSold: 'We do not sell personal information.',
    notTracking: 'We do not use it for cross-app advertising.',
    noAdvertisingId: 'does not use an advertising id',
    children: 'not directed to children under 13',
    serviceProviders: 'process data for HomeCookedPlate',
    foregroundLocation: 'does not collect location in the background',
  },
} as const;

export interface PlayDataTypeAnswer {
  section: string;
  dataType: string;
  collected: true;
  shared: false;
  ephemeral: false;
  required: boolean;
  purposes: readonly string[];
  privacyExcerpt: string;
}

export const PLAY_DATA_SAFETY_TYPES: readonly PlayDataTypeAnswer[] = [
  {
    section: 'Personal info',
    dataType: 'Email address',
    collected: true,
    shared: false,
    ephemeral: false,
    required: true,
    purposes: ['Account management', 'App functionality'],
    privacyExcerpt: 'email address',
  },
  {
    section: 'Personal info',
    dataType: 'Name',
    collected: true,
    shared: false,
    ephemeral: false,
    required: true,
    purposes: ['Account management', 'App functionality'],
    privacyExcerpt: 'username',
  },
  {
    section: 'Personal info',
    dataType: 'Phone number',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['Account management'],
    privacyExcerpt: 'phone number if you add one',
  },
  {
    section: 'Personal info',
    dataType: 'User IDs',
    collected: true,
    shared: false,
    ephemeral: false,
    required: true,
    purposes: ['Account management', 'Fraud prevention, security, and compliance'],
    privacyExcerpt: 'account-binding token',
  },
  {
    section: 'Location',
    dataType: 'Precise location',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'can read your location',
  },
  {
    section: 'Location',
    dataType: 'Approximate location',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'supported metro',
  },
  {
    section: 'Financial info',
    dataType: 'Purchase history',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'order amounts, payment status',
  },
  {
    section: 'Financial info',
    dataType: 'User payment info',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'Full card numbers and bank account numbers are collected by Stripe, not stored in the app.',
  },
  {
    section: 'Photos and videos',
    dataType: 'Photos',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'meal photos',
  },
  {
    section: 'Photos and videos',
    dataType: 'Videos',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'food review clips',
  },
  {
    section: 'Audio',
    dataType: 'Voice or sound recordings',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'Microphone audio only when you record a food review clip.',
  },
  {
    section: 'Messages',
    dataType: 'Other in-app messages',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'Messages you send to another user in the app.',
  },
  {
    section: 'App activity',
    dataType: 'Other user-generated content',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'ingredient and allergen text',
  },
  {
    section: 'App info and performance',
    dataType: 'Crash logs',
    collected: true,
    shared: false,
    ephemeral: false,
    required: true,
    purposes: ['Fraud prevention, security, and compliance'],
    privacyExcerpt: 'crash diagnostics that can include your account id, email, and username',
  },
  {
    section: 'Device or other IDs',
    dataType: 'Device or other IDs',
    collected: true,
    shared: false,
    ephemeral: false,
    required: false,
    purposes: ['App functionality'],
    privacyExcerpt: 'Expo push token',
  },
];

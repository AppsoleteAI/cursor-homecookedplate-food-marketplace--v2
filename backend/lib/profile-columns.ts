/** Columns returned when a PlateMaker or PlateTaker signs in. */
export const SIGN_IN_PROFILE_COLUMNS = [
  'id',
  'username',
  'business_name',
  'email',
  'role',
  'is_admin',
  'main_admin',
  'monitor_admin',
  'phone',
  'bio',
  'profile_image',
  'created_at',
  'is_paused',
  'legal_safety_agreement',
  'ordering_removed',
  'account_code',
].join(', ');

/** Columns the signed-in account screen and membership refresh read. */
export const ACCOUNT_PROFILE_COLUMNS = [
  'id',
  'username',
  'business_name',
  'email',
  'role',
  'is_admin',
  'main_admin',
  'monitor_admin',
  'phone',
  'bio',
  'profile_image',
  'created_at',
  'is_paused',
  'two_factor_enabled',
  'membership_tier',
  'stripe_customer_id',
  'stripe_subscription_id',
  'metro_area',
  'trial_ends_at',
  'food_safety_acknowledged',
  'legal_safety_agreement',
  'ordering_removed',
  'apple_original_transaction_id',
  'apple_expires_at',
  'apple_revoked_at',
  'apple_auto_renew',
  'apple_checked_at',
  'google_purchase_token',
  'google_expires_at',
  'google_checked_at',
  'account_code',
].join(', ');

type ProfileRead = { data: any; error: { message?: string } | null };

function columnNamedInError(message: string, column: string): boolean {
  return new RegExp(`\\b${column}\\b`).test(message);
}

/**
 * Reads the named profile columns. When the database says one of those columns
 * is missing, the same read runs again without that column.
 * Dynamic select strings are untyped in supabase-js, so data stays any.
 */
export async function readProfileRow(
  columns: string,
  run: (columns: string) => PromiseLike<ProfileRead>,
): Promise<ProfileRead> {
  let current = columns;
  let result = await run(current);
  for (let attempt = 0; attempt < 4 && result.error; attempt += 1) {
    const message = result.error.message || '';
    const next = current
      .split(', ')
      .filter((name) => name.length > 0 && !columnNamedInError(message, name))
      .join(', ');
    if (next === current || next.length === 0) return result;
    current = next;
    result = await run(current);
  }
  return result;
}

/** Columns written back when a PlateMaker or PlateTaker saves the account screen. */
export const SAVED_PROFILE_COLUMNS = [
  'id',
  'username',
  'business_name',
  'email',
  'role',
  'phone',
  'bio',
  'profile_image',
  'created_at',
  'is_paused',
  'two_factor_enabled',
  'food_safety_acknowledged',
  'legal_safety_agreement',
].join(', ');

/** Columns returned after a PlateMaker or PlateTaker account is created. */
export const SIGN_UP_PROFILE_COLUMNS = [
  'id',
  'username',
  'email',
  'role',
  'is_admin',
  'phone',
  'bio',
  'profile_image',
  'created_at',
  'is_paused',
  'two_factor_enabled',
  'metro_area',
  'trial_ends_at',
  'membership_tier',
].join(', ');

/** Columns returned when someone who is already a PlateMaker asks for that role again. */
export const ROLE_PROFILE_COLUMNS = [
  'id',
  'username',
  'email',
  'role',
  'phone',
  'bio',
  'profile_image',
  'created_at',
  'is_paused',
  'two_factor_enabled',
].join(', ');

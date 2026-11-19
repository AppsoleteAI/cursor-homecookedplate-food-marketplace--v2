export const PROVIDER_ROLE_STORAGE_KEY = 'hcp_provider_role';
export const FRESH_PROVIDER_ACCOUNT_MS = 10 * 60 * 1000;

export const PROVIDER_CONTINUE_MESSAGE =
  'This email already uses Apple or Google. Continue with that sign-in, then choose Order a Plate or Start Cooking.';

export const GOOGLE_BUTTON_MESSAGE = 'You must sign in with the Google button.';

export const APPLE_BUTTON_MESSAGE = 'You must sign in with the Apple button.';

export const APPLE_AND_GOOGLE_BUTTON_MESSAGE =
  'You must sign in with the Apple button or the Google button.';

export const UNCONFIRMED_RESET_MESSAGE =
  'Confirm this email before changing the password. A reset link cannot set a password until the address is verified.';

export const UNFINISHED_PROFILE_MESSAGE =
  'This email is registered, and the profile is not finished. Reset the password, or continue with Apple or Google if that is how you signed up.';

export const EMAIL_ALREADY_REGISTERED_MESSAGE =
  'An account with this email already exists. Please use login instead.';

export type AccountRole = 'platemaker' | 'platetaker';
export type AuthIdentityKind = 'none' | 'provider' | 'email' | 'apple' | 'google' | 'apple_google' | 'unknown';

export function isAccountRole(value: unknown): value is AccountRole {
  return value === 'platemaker' || value === 'platetaker';
}

export function providerUsernameBase(email: string | null | undefined, metadataUsername?: string | null): string {
  const raw = (metadataUsername || email?.split('@')[0] || 'member').toLowerCase();
  const cleaned = raw.replace(/[^a-z0-9_]/g, '');
  const base = cleaned.length >= 3 ? cleaned : `member${cleaned}`;
  return base.slice(0, 24);
}

/** Names to try when the email prefix is already a username. The last one includes the account id. */
export function usernameCandidates(email: string | null | undefined, userId: string, metadataUsername?: string | null): string[] {
  const root = providerUsernameBase(email, metadataUsername);
  const names = [root];
  for (let i = 2; i <= 20; i += 1) {
    names.push(`${root.slice(0, 20)}${i}`);
  }
  names.push(`${root.slice(0, 12)}${userId.replace(/-/g, '').slice(0, 8)}`);
  return [...new Set(names)];
}

export type ProviderProfileAction =
  | { action: 'create'; role: AccountRole }
  | { action: 'correct'; role: 'platemaker' }
  | { action: 'keep' }
  | { action: 'choose' };

function freshAccount(value: string | null, now: number): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  if (Number.isNaN(time)) return false;
  const age = now - time;
  return age >= 0 && age <= FRESH_PROVIDER_ACCOUNT_MS;
}

/**
 * A missing profile is finished with the role the person chose.
 * A brand-new PlateTaker with no plates and no orders becomes a PlateMaker when they chose Start Cooking.
 * An older account, or one that already cooked or ordered, keeps the role it has.
 */
export function providerProfileAction(input: {
  chosenRole: AccountRole | null;
  profileRole: string | null;
  accountCreatedAt: string | null;
  profileCreatedAt: string | null;
  hasActivity: boolean;
  now: number;
}): ProviderProfileAction {
  const chosen = input.chosenRole;
  const role = input.profileRole;
  if (role !== 'platemaker' && role !== 'platetaker') {
    if (!chosen) return { action: 'choose' };
    return { action: 'create', role: chosen };
  }
  if (!chosen || chosen === role) return { action: 'keep' };
  if (role === 'platemaker') return { action: 'keep' };
  if (input.hasActivity) return { action: 'keep' };
  if (!freshAccount(input.accountCreatedAt, input.now) || !freshAccount(input.profileCreatedAt, input.now)) {
    return { action: 'keep' };
  }
  return { action: 'correct', role: 'platemaker' };
}

export function signupAlreadyRegisteredMessage(input: {
  profileExists: boolean;
  passwordAccepted: boolean;
  identity: AuthIdentityKind;
}): string | null {
  if (input.passwordAccepted) return null;
  if (input.identity === 'provider' || !input.profileExists) return PROVIDER_CONTINUE_MESSAGE;
  return EMAIL_ALREADY_REGISTERED_MESSAGE;
}

export function signInWithoutProfileMessage(identity: AuthIdentityKind): string | null {
  if (identity === 'google') return GOOGLE_BUTTON_MESSAGE;
  if (identity === 'apple') return APPLE_BUTTON_MESSAGE;
  if (identity === 'apple_google') return APPLE_AND_GOOGLE_BUTTON_MESSAGE;
  if (identity === 'provider') return PROVIDER_CONTINUE_MESSAGE;
  if (identity === 'email') return UNFINISHED_PROFILE_MESSAGE;
  return null;
}

export function providerButtonMessage(providers: Iterable<string | null | undefined> | null | undefined): string | null {
  const names = new Set(providers ?? []);
  const apple = names.has('apple');
  const google = names.has('google');
  if (apple && google) return APPLE_AND_GOOGLE_BUTTON_MESSAGE;
  if (google) return GOOGLE_BUTTON_MESSAGE;
  if (apple) return APPLE_BUTTON_MESSAGE;
  return null;
}

type ProviderIdentityAdmin = {
  rpc: (fn: string, args: { target_email: string }) => PromiseLike<{ data: unknown; error: { message?: string } | null }>;
  auth?: {
    admin?: {
      getUserById?: (id: string) => PromiseLike<{
        data: { user: { identities?: { provider?: string | null }[] | null; email_confirmed_at?: string | null } | null } | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

/** Names the button when this email is an Apple or Google identity. */
export async function readProviderButtonMessage(
  admin: ProviderIdentityAdmin,
  email: string,
  userId?: string | null,
): Promise<string | null> {
  const lookup = userId ? admin.auth?.admin?.getUserById : undefined;
  if (userId && lookup) {
    try {
      const { data, error } = await lookup(userId);
      if (!error) {
        const named = providerButtonMessage(data?.user?.identities?.map((identity) => identity.provider));
        if (named) return named;
      }
    } catch {
      // The identity function below still names a known Apple or Google account.
    }
  }
  const kind = await readAuthIdentityKind(admin, email);
  if (kind === 'email' || kind === 'none' || kind === 'unknown') return null;
  return signInWithoutProfileMessage(kind);
}

/** A Google or Apple account must use that button. An unverified email cannot set a password from a reset link. */
export async function readPasswordResetBlock(
  admin: ProviderIdentityAdmin,
  email: string,
  userId?: string | null,
): Promise<string | null> {
  const button = await readProviderButtonMessage(admin, email, userId);
  if (button) return button;
  const lookup = userId ? admin.auth?.admin?.getUserById : undefined;
  if (!userId || !lookup) return null;
  try {
    const { data, error } = await lookup(userId);
    if (error || !data?.user) return null;
    if (!data.user.email_confirmed_at) return UNCONFIRMED_RESET_MESSAGE;
  } catch {
    return null;
  }
  return null;
}

export async function readAuthIdentityKind(
  admin: { rpc: (fn: string, args: { target_email: string }) => PromiseLike<{ data: unknown; error: { message?: string } | null }> },
  email: string,
): Promise<AuthIdentityKind> {
  try {
    const { data, error } = await admin.rpc('auth_identity_kind', { target_email: email });
    if (error) return 'unknown';
    if (
      data === 'provider'
      || data === 'email'
      || data === 'none'
      || data === 'apple'
      || data === 'google'
      || data === 'apple_google'
    ) return data;
    if (data == null) return 'none';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

import { readFileSync } from 'fs';
import path from 'path';
import { abandonFailedSignup, DUPLICATE_ACCOUNT_MESSAGE, isDuplicateAuthError, planSignupMetro } from '../signup-account';

const PITTSBURGH = { lat: 40.440624, lng: -79.995888 };

function geofenceAdmin(row: { is_active?: boolean; trial_days?: number } | null) {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: row ? { metro_name: 'Pittsburgh', ...row } : null,
            error: null,
          }),
        }),
      }),
    }),
  };
}

describe('signup does not prove an existing password', () => {
  it('treats a duplicate email as one error and ignores a password result', () => {
    expect(isDuplicateAuthError({ message: 'A user with this email address has already been registered', status: 422, code: 'email_exists' })).toBe(true);
    expect(isDuplicateAuthError({ message: 'User already exists' })).toBe(true);
    expect(isDuplicateAuthError({ code: '23505' })).toBe(true);
    expect(isDuplicateAuthError({ message: 'Invalid login credentials' })).toBe(false);
    expect(isDuplicateAuthError({ message: 'Email not confirmed' })).toBe(false);
    expect(isDuplicateAuthError(null)).toBe(false);
    expect(DUPLICATE_ACCOUNT_MESSAGE).toBe('An account with this email already exists. Please use login instead.');
  });

  it('checks the metro before creating a user and never signs in', () => {
    const source = readFileSync(path.join(__dirname, '../../trpc/routes/auth/signup/route.ts'), 'utf8');
    const form = readFileSync(path.join(__dirname, '../../../hooks/useSignupForm.ts'), 'utf8');
    expect(source).not.toContain('signInWithPassword');
    expect(source).not.toContain('not confirmed');
    expect(source.indexOf('plan.pausedMessage')).toBeLessThan(source.indexOf('admin.createUser'));
    expect(source.indexOf('admin.createUser')).toBeLessThan(source.indexOf('increment_metro_count'));
    expect(source).toContain('if (!committed)');
    expect(source).toContain('abandonFailedSignup');
    expect(form).not.toContain('skipping location check');
    expect(form).toContain('readDeviceCoordinates');
  });
});

describe('signup metro plan', () => {
  it('holds a slot only after the city is active', async () => {
    const paused = await planSignupMetro(geofenceAdmin({ is_active: false, trial_days: 90 }), PITTSBURGH.lat, PITTSBURGH.lng);
    expect(paused.pausedMessage).toMatch(/Pittsburgh/);
    expect(paused.holdSlot).toBe(false);

    const open = await planSignupMetro(geofenceAdmin({ is_active: true, trial_days: 45 }), PITTSBURGH.lat, PITTSBURGH.lng);
    expect(open.pausedMessage).toBeNull();
    expect(open.assignedMetro).toBe('Pittsburgh');
    expect(open.trialDays).toBe(45);
    expect(open.holdSlot).toBe(true);
  });

  it('stores a missing or outside point as Remote/Other and does not hold a slot', async () => {
    const unread = { from() { throw new Error('settings should not be read'); } };
    const missing = await planSignupMetro(unread, null, undefined);
    expect(missing).toEqual({ assignedMetro: 'Remote/Other', pausedMessage: null, trialDays: 0, holdSlot: false });

    const outside = await planSignupMetro(unread, 0, 0);
    expect(outside.assignedMetro).toBe('Remote/Other');
    expect(outside.holdSlot).toBe(false);
  });
});

describe('a failed signup returns the slot and the auth user', () => {
  function slotAdmin(count: number) {
    const updates: { column: string; value: number }[] = [];
    const deleted: string[] = [];
    const admin = {
      from() {
        return {
          select(column: string) {
            return {
              eq() {
                return { maybeSingle: async () => ({ data: { [column]: count }, error: null }) };
              },
            };
          },
          update(patch: Record<string, number>) {
            const column = Object.keys(patch).find((key) => key.endsWith('_count'));
            if (column) updates.push({ column, value: patch[column] });
            return { eq: async () => ({ error: null }) };
          },
        };
      },
      rpc: async () => ({ data: null, error: null }),
      auth: { admin: { deleteUser: async (id: string) => { deleted.push(id); } } },
    };
    return { admin, updates, deleted };
  }

  it('returns a PlateMaker slot and deletes the auth user', async () => {
    const { admin, updates, deleted } = slotAdmin(4);
    await abandonFailedSignup(admin, 'cook-1', { role: 'platemaker', metro: 'Pittsburgh' });
    expect(updates).toEqual([{ column: 'platemaker_count', value: 3 }]);
    expect(deleted).toEqual(['cook-1']);
  });

  it('returns a PlateTaker slot and deletes the auth user', async () => {
    const { admin, updates, deleted } = slotAdmin(2);
    await abandonFailedSignup(admin, 'buyer-1', { role: 'platetaker', metro: 'Pittsburgh' });
    expect(updates).toEqual([{ column: 'platetaker_count', value: 1 }]);
    expect(deleted).toEqual(['buyer-1']);
  });

  it('does not go below zero and still deletes the auth user', async () => {
    const { admin, updates, deleted } = slotAdmin(0);
    await abandonFailedSignup(admin, 'cook-2', { role: 'platemaker', metro: 'Pittsburgh' });
    expect(updates).toEqual([]);
    expect(deleted).toEqual(['cook-2']);
  });

  it('still deletes the auth user when the slot cannot be returned', async () => {
    const deleted: string[] = [];
    const admin = {
      from() { throw new Error('down'); },
      rpc: async () => ({ data: null, error: null }),
      auth: { admin: { deleteUser: async (id: string) => { deleted.push(id); } } },
    };
    await abandonFailedSignup(admin, 'cook-3', { role: 'platemaker', metro: 'Pittsburgh' });
    expect(deleted).toEqual(['cook-3']);
  });
});

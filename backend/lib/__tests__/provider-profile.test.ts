import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  EMAIL_ALREADY_REGISTERED_MESSAGE,
  PROVIDER_CONTINUE_MESSAGE,
  UNFINISHED_PROFILE_MESSAGE,
  providerProfileAction,
  providerUsernameBase,
  signupAlreadyRegisteredMessage,
  signInWithoutProfileMessage,
  usernameCandidates,
} from '../provider-profile';

const NOW = Date.parse('2026-11-06T21:00:00.000Z');
const FRESH = '2026-11-06T20:55:00.000Z';
const OLD = '2026-11-01T20:55:00.000Z';

describe.each(['platemaker', 'platetaker'] as const)('provider profile for a %s choice', (role) => {
  it('creates a missing profile with that role and keeps a finished account', () => {
    expect(providerProfileAction({
      chosenRole: role,
      profileRole: null,
      accountCreatedAt: FRESH,
      profileCreatedAt: null,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'create', role });
    expect(providerProfileAction({
      chosenRole: role,
      profileRole: role,
      accountCreatedAt: OLD,
      profileCreatedAt: OLD,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'keep' });
  });

  it('does not guess a role when the person has not chosen', () => {
    expect(providerProfileAction({
      chosenRole: null,
      profileRole: null,
      accountCreatedAt: FRESH,
      profileCreatedAt: null,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'choose' });
  });
});

describe('provider profile repair', () => {
  it('turns a brand-new PlateTaker into a PlateMaker when Start Cooking was chosen and nothing was ordered', () => {
    expect(providerProfileAction({
      chosenRole: 'platemaker',
      profileRole: 'platetaker',
      accountCreatedAt: FRESH,
      profileCreatedAt: FRESH,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'correct', role: 'platemaker' });
  });

  it('keeps an older PlateTaker and a PlateTaker who already ordered', () => {
    expect(providerProfileAction({
      chosenRole: 'platemaker',
      profileRole: 'platetaker',
      accountCreatedAt: OLD,
      profileCreatedAt: OLD,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'keep' });
    expect(providerProfileAction({
      chosenRole: 'platemaker',
      profileRole: 'platetaker',
      accountCreatedAt: FRESH,
      profileCreatedAt: FRESH,
      hasActivity: true,
      now: NOW,
    })).toEqual({ action: 'keep' });
  });

  it('does not turn a PlateMaker into a PlateTaker', () => {
    expect(providerProfileAction({
      chosenRole: 'platetaker',
      profileRole: 'platemaker',
      accountCreatedAt: FRESH,
      profileCreatedAt: FRESH,
      hasActivity: false,
      now: NOW,
    })).toEqual({ action: 'keep' });
  });

  it('picks another username when the email prefix is taken', () => {
    expect(providerUsernameBase('Cook.Name@example.com', null)).toBe('cookname');
    const names = usernameCandidates('cook@example.com', '11111111-1111-4111-8111-111111111111', null);
    expect(names[0]).toBe('cook');
    expect(names).toContain('cook2');
    expect(names[names.length - 1]).toBe('cook11111111');
    expect(new Set(names).size).toBe(names.length);
  });

  it('sends a missing profile back to Apple or Google instead of password signup', () => {
    expect(signupAlreadyRegisteredMessage({
      profileExists: false,
      passwordAccepted: false,
      identity: 'unknown',
    })).toBe(PROVIDER_CONTINUE_MESSAGE);
    expect(signupAlreadyRegisteredMessage({
      profileExists: true,
      passwordAccepted: false,
      identity: 'provider',
    })).toBe(PROVIDER_CONTINUE_MESSAGE);
    expect(signupAlreadyRegisteredMessage({
      profileExists: true,
      passwordAccepted: false,
      identity: 'email',
    })).toBe(EMAIL_ALREADY_REGISTERED_MESSAGE);
    expect(signInWithoutProfileMessage('provider')).toBe(PROVIDER_CONTINUE_MESSAGE);
    expect(signInWithoutProfileMessage('email')).toBe(UNFINISHED_PROFILE_MESSAGE);
    expect(signInWithoutProfileMessage('none')).toBeNull();
  });

  it('does not default a provider user to PlateTaker or swallow a taken username', () => {
    const trigger = readFileSync(resolve(__dirname, '../../sql/auto_create_profile.sql'), 'utf8');
    expect(trigger.includes("COALESCE(NEW.raw_user_meta_data->>'role', 'platetaker')")).toBe(false);
    expect(trigger).toContain('WHEN unique_violation');
    expect(trigger).toContain('chosen_role NOT IN');
  });
});

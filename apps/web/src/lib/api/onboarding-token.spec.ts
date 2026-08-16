import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getOnboardingToken, sessionHeaders, storeOnboardingToken } from '@/lib/api/onboarding';

describe('onboarding token storage (localStorage + safe same-session fallback)', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Test 1: normal storage/read behavior is unchanged', () => {
    storeOnboardingToken('s-1', 'token-1');

    expect(window.localStorage.getItem('bc_onboarding_token_s-1')).toBe('token-1');
    expect(getOnboardingToken('s-1')).toBe('token-1');
    expect(sessionHeaders('s-1')).toEqual({ 'X-Onboarding-Token': 'token-1' });
  });

  it('Test 2: storeOnboardingToken does not crash and keeps the token via the fallback when setItem throws', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(() => storeOnboardingToken('s-2', 'token-2')).not.toThrow();
    expect(window.localStorage.getItem('bc_onboarding_token_s-2')).toBeNull();
    expect(getOnboardingToken('s-2')).toBe('token-2');
  });

  it('Test 3: getOnboardingToken retrieves the token from the safe fallback when getItem is unavailable', () => {
    storeOnboardingToken('s-3', 'token-3');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(getOnboardingToken('s-3')).toBe('token-3');
  });

  it('Test 4: sessionHeaders emits X-Onboarding-Token when localStorage is unavailable but the fallback has the token', () => {
    storeOnboardingToken('s-4', 'token-4');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage blocked');
    });

    expect(sessionHeaders('s-4')).toEqual({ 'X-Onboarding-Token': 'token-4' });
  });
});
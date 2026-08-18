import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitRegistration, type RegistrationDeps } from './submit-registration';
import { ApiError } from '@/lib/api/client';

function build() {
  const registerUser = vi
    .fn()
    .mockResolvedValue({ email: 'a@b.com', message: 'Account created' });
  const createSession = vi.fn().mockResolvedValue({ id: 's-1' });
  const navigate = vi.fn();
  const setError = vi.fn();

  const p: RegistrationDeps = {
    name: 'A',
    email: 'a@b.com',
    password: 'Password123',
    registerUser: registerUser as RegistrationDeps['registerUser'],
    createSession: createSession as RegistrationDeps['createSession'],
    navigate: navigate as RegistrationDeps['navigate'],
    setError: setError as RegistrationDeps['setError'],
  };

  return { p, registerUser, createSession, navigate, setError };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitRegistration', () => {
  it('routes a successful registration to the onboarding verify step (step 0) and creates no authenticated session', async () => {
    const { p, registerUser, createSession, navigate, setError } = build();

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser).toHaveBeenCalledWith('A', 'a@b.com', 'Password123');
    expect(createSession).toHaveBeenCalledWith('a@b.com', 'A');
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('retries exactly once (after a 500ms delay) when the first attempt fails with a connection-level error (status 0), then continues the flow', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError } = build();
      registerUser
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce({ email: 'a@b.com', message: 'Account created' });

      const promise = submitRegistration(p);
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(registerUser).toHaveBeenCalledTimes(2);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(createSession).toHaveBeenCalledWith('a@b.com', 'A');
      expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
      expect(setError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('shows the error and does not call createSession when both retry attempts fail with status 0', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError } = build();
      registerUser.mockRejectedValue(new ApiError('Network Error', 0, 'ERR_NETWORK'));

      const promise = submitRegistration(p);
      await vi.advanceTimersByTimeAsync(500);
      await promise;

      expect(registerUser).toHaveBeenCalledTimes(2);
      expect(createSession).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith('Network Error');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry an HTTP 409 (duplicate email)', async () => {
    const { p, createSession, navigate, setError } = build();
    const dupe = vi.fn().mockRejectedValue(new ApiError('Email already registered', 409)) as RegistrationDeps['registerUser'];
    p.registerUser = dupe;

    await submitRegistration(p);

    expect(dupe).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Email already registered');
  });

  it('does not retry an HTTP 400 (invalid request)', async () => {
    const { p, createSession, navigate, setError } = build();
    const invalid = vi.fn().mockRejectedValue(new ApiError('The request was invalid', 400)) as RegistrationDeps['registerUser'];
    p.registerUser = invalid;

    await submitRegistration(p);

    expect(invalid).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('The request was invalid');
  });

  it('does not retry when the first attempt succeeds', async () => {
    const { p, registerUser, createSession, navigate, setError } = build();

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('shows a clear message and does not navigate when the session reservation fails after the account is committed', async () => {
    const { p, navigate, setError } = build();
    const failing = vi.fn().mockRejectedValue(new Error('create failed')) as RegistrationDeps['createSession'];
    p.createSession = failing;

    await submitRegistration(p);

    expect(failing).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Your account was created. Please sign in to continue onboarding.');
  });
});

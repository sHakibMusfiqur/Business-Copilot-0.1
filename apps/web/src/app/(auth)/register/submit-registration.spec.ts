import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  submitRegistration,
  waitForApiReadiness,
  type RegistrationDeps,
  CONNECTING_STATUS_MESSAGE,
  CONNECTION_ERROR_MESSAGE,
  HEALTH_POLL_INTERVAL_MS,
  HEALTH_POLL_MAX_ATTEMPTS,
  REGISTER_RETRY_DELAY_MS,
  STARTING_STATUS_MESSAGE,
} from './submit-registration';
import { ApiError } from '@/lib/api/client';

function build() {
  const registerUser = vi
    .fn()
    .mockResolvedValue({ email: 'a@b.com', message: 'Account created', emailSent: true });
  const createSession = vi.fn().mockResolvedValue({ id: 's-1' });
  const navigate = vi.fn();
  const setError = vi.fn();
  const pingHealth = vi.fn().mockResolvedValue(undefined);
  const onStatus = vi.fn();

  const p: RegistrationDeps = {
    name: 'A',
    email: 'a@b.com',
    password: 'Password123',
    registerUser: registerUser as RegistrationDeps['registerUser'],
    createSession: createSession as RegistrationDeps['createSession'],
    navigate: navigate as RegistrationDeps['navigate'],
    setError: setError as RegistrationDeps['setError'],
    pingHealth: pingHealth as RegistrationDeps['pingHealth'],
    onStatus: onStatus as RegistrationDeps['onStatus'],
  };

  return { p, registerUser, createSession, navigate, setError, pingHealth, onStatus };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitRegistration', () => {
  it('registers immediately with a single call on a warm API and routes to the verify step (step 0)', async () => {
    const { p, registerUser, createSession, navigate, setError, pingHealth } = build();

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser).toHaveBeenCalledWith('A', 'a@b.com', 'Password123');
    expect(pingHealth).not.toHaveBeenCalled();
    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith('a@b.com', 'A');
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('appends emailSent=false to the verify URL when the verification email could not be delivered', async () => {
    const { p, registerUser, navigate, setError } = build();
    registerUser.mockResolvedValue({ email: 'a@b.com', message: 'Registered', emailSent: false });

    await submitRegistration(p);

    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1&emailSent=false');
    expect(setError).not.toHaveBeenCalled();
  });

  it('does not append emailSent param when email was sent successfully', async () => {
    const { p, registerUser, navigate } = build();
    registerUser.mockResolvedValue({ email: 'a@b.com', message: 'Registered', emailSent: true });

    await submitRegistration(p);

    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(navigate.mock.calls[0][0]).not.toContain('emailSent');
  });

  it('recovers from a brief connection failure by waiting for the API, then completes the flow exactly once', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError, pingHealth, onStatus } = build();
      registerUser
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce({ email: 'a@b.com', message: 'Account created', emailSent: true });
      pingHealth
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce(undefined);

      const promise = submitRegistration(p);
      await vi.advanceTimersByTimeAsync(HEALTH_POLL_INTERVAL_MS);
      await promise;

      expect(registerUser).toHaveBeenCalledTimes(2);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(createSession).toHaveBeenCalledWith('a@b.com', 'A');
      expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
      expect(setError).not.toHaveBeenCalled();
      expect(onStatus).toHaveBeenNthCalledWith(1, STARTING_STATUS_MESSAGE);
      expect(onStatus).toHaveBeenCalledWith(CONNECTING_STATUS_MESSAGE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('retries once after a short delay when no health probe is available', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError } = build();
      delete p.pingHealth;
      registerUser
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce({ email: 'a@b.com', message: 'Account created', emailSent: true });

      const promise = submitRegistration(p);
      await vi.advanceTimersByTimeAsync(REGISTER_RETRY_DELAY_MS);
      await promise;

      expect(registerUser).toHaveBeenCalledTimes(2);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
      expect(setError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives up with a connection error after the API never becomes reachable (max window)', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError, pingHealth } = build();
      registerUser.mockRejectedValue(new ApiError('Network Error', 0, 'ERR_NETWORK'));
      pingHealth.mockRejectedValue(new ApiError('Network Error', 0, 'ERR_NETWORK'));

      const promise = submitRegistration(p);
      await vi.advanceTimersByTimeAsync(
        (HEALTH_POLL_MAX_ATTEMPTS - 1) * HEALTH_POLL_INTERVAL_MS,
      );
      await promise;

      expect(registerUser).toHaveBeenCalledTimes(1);
      expect(pingHealth).toHaveBeenCalledTimes(HEALTH_POLL_MAX_ATTEMPTS);
      expect(createSession).not.toHaveBeenCalled();
      expect(navigate).not.toHaveBeenCalled();
      expect(setError).toHaveBeenCalledWith(CONNECTION_ERROR_MESSAGE);
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry an HTTP 409 (duplicate email)', async () => {
    const { p, createSession, navigate, setError, pingHealth } = build();
    const dupe = vi.fn().mockRejectedValue(new ApiError('Email already registered', 409)) as RegistrationDeps['registerUser'];
    p.registerUser = dupe;

    await submitRegistration(p);

    expect(dupe).toHaveBeenCalledTimes(1);
    expect(pingHealth).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Email already registered');
  });

  it('does not retry an HTTP 400 (invalid request)', async () => {
    const { p, createSession, navigate, setError, pingHealth } = build();
    const invalid = vi.fn().mockRejectedValue(new ApiError('The request was invalid', 400)) as RegistrationDeps['registerUser'];
    p.registerUser = invalid;

    await submitRegistration(p);

    expect(invalid).toHaveBeenCalledTimes(1);
    expect(pingHealth).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('The request was invalid');
  });

  it('does not retry an HTTP 500 (server error)', async () => {
    const { p, createSession, navigate, setError, pingHealth } = build();
    const failing = vi.fn().mockRejectedValue(new ApiError('Internal server error', 500)) as RegistrationDeps['registerUser'];
    p.registerUser = failing;

    await submitRegistration(p);

    expect(failing).toHaveBeenCalledTimes(1);
    expect(pingHealth).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Internal server error');
  });

  it('creates the onboarding session exactly once and only after the account is committed', async () => {
    const { p, registerUser, createSession, navigate, setError } = build();
    let resolveRegister!: (value: { email: string; message: string; emailSent: boolean }) => void;
    registerUser.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveRegister = resolve;
        }),
    ) as typeof registerUser;

    const promise = submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();

    resolveRegister({ email: 'a@b.com', message: 'Account created', emailSent: true });
    await promise;

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith('a@b.com', 'A');
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('ignores a duplicate submission while a registration is already in flight', async () => {
    vi.useFakeTimers();
    try {
      const { p, registerUser, createSession, navigate, setError, pingHealth } = build();
      registerUser
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce({ email: 'a@b.com', message: 'Account created', emailSent: true });
      pingHealth
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockResolvedValueOnce(undefined);

      const first = submitRegistration(p);
      const second = submitRegistration(p);

      await vi.advanceTimersByTimeAsync(HEALTH_POLL_INTERVAL_MS);
      await Promise.all([first, second]);

      expect(registerUser).toHaveBeenCalledTimes(2);
      expect(createSession).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledTimes(1);
      expect(setError).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it('reports a connection error when the retry also cannot reach the API, without creating a session', async () => {
    const { p, registerUser, createSession, navigate, setError } = build();
    registerUser.mockRejectedValue(new ApiError('Network Error', 0, 'ERR_NETWORK'));

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(2);
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith(CONNECTION_ERROR_MESSAGE);
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

describe('waitForApiReadiness', () => {
  it('returns true once the health endpoint answers', async () => {
    const pingHealth = vi.fn().mockResolvedValue(undefined);
    await expect(waitForApiReadiness(pingHealth)).resolves.toBe(true);
    expect(pingHealth).toHaveBeenCalledTimes(1);
  });

  it('keeps polling only on connection failures and treats any HTTP response as ready', async () => {
    vi.useFakeTimers();
    try {
      const pingHealth = vi
        .fn()
        .mockRejectedValueOnce(new ApiError('Network Error', 0, 'ERR_NETWORK'))
        .mockRejectedValueOnce(new ApiError('Rate limited', 429))
        .mockResolvedValueOnce(undefined);

      const promise = waitForApiReadiness(pingHealth);
      await vi.advanceTimersByTimeAsync(HEALTH_POLL_INTERVAL_MS);
      await promise;

      expect(pingHealth).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

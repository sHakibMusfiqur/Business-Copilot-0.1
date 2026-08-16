import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { User } from '@bc/types';

import type { OnboardingSession } from '@/lib/api/onboarding';

import { submitRegistration, type RegistrationDeps } from './submit-registration';

const user = { id: 'u-1', email: 'a@b.com', name: 'A' } as unknown as User;
const session = (id: string) => ({ id, email: 'a@b.com', name: 'A' } as unknown as OnboardingSession);

function build() {
  const registerUser = vi.fn().mockResolvedValue({ user, accessToken: 'at' });
  const createSession = vi.fn().mockResolvedValue(session('s-1'));
  const updateSession = vi.fn().mockResolvedValue(session('s-1'));
  const getSessionByEmail = vi.fn().mockResolvedValue(session('s-2'));
  const setUser = vi.fn();
  const navigate = vi.fn();
  const setError = vi.fn();

  const p: RegistrationDeps = {
    name: 'A',
    email: 'a@b.com',
    password: 'Password123',
    registerUser: registerUser as RegistrationDeps['registerUser'],
    createSession: createSession as RegistrationDeps['createSession'],
    updateSession: updateSession as RegistrationDeps['updateSession'],
    getSessionByEmail: getSessionByEmail as RegistrationDeps['getSessionByEmail'],
    setUser: setUser as RegistrationDeps['setUser'],
    navigate: navigate as RegistrationDeps['navigate'],
    setError: setError as RegistrationDeps['setError'],
  };

  return { p, registerUser, createSession, updateSession, getSessionByEmail, setUser, navigate, setError };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('submitRegistration', () => {
  it('Test 6: a normal successful registration navigates to /onboarding/verify?session=...', async () => {
    const { p, registerUser, updateSession, navigate, setError } = build();

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(registerUser).toHaveBeenCalledWith('A', 'a@b.com', 'Password123');
    expect(updateSession).toHaveBeenCalledWith('s-1', { userId: 'u-1' });
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('Test 5a: after the account is committed, a createSession failure recovers the existing session instead of dead-ending', async () => {
    const { p, registerUser, getSessionByEmail, navigate, setError } = build();
    p.createSession = vi.fn().mockRejectedValue(new Error('create failed')) as RegistrationDeps['createSession'];

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(getSessionByEmail).toHaveBeenCalledWith('a@b.com');
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-2');
    expect(setError).not.toHaveBeenCalled();
  });

  it('Test 5b: after the account is committed, an updateSession failure navigates to the already-created session', async () => {
    const { p, registerUser, getSessionByEmail, navigate, setError } = build();
    const bindFn = vi.fn().mockRejectedValue(new Error('bind failed')) as RegistrationDeps['updateSession'];
    p.updateSession = bindFn;

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(bindFn).toHaveBeenCalledTimes(1);
    expect(getSessionByEmail).not.toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/onboarding/verify?session=s-1');
    expect(setError).not.toHaveBeenCalled();
  });

  it('Test 5c: when recovery also fails, it surfaces a clear message and never re-registers (no silent dead-end)', async () => {
    const { p, registerUser, navigate, setError } = build();
    p.createSession = vi.fn().mockRejectedValue(new Error('create failed')) as RegistrationDeps['createSession'];
    p.getSessionByEmail = vi.fn().mockRejectedValue(new Error('resume failed')) as RegistrationDeps['getSessionByEmail'];

    await submitRegistration(p);

    expect(registerUser).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Your account was created. Please sign in to continue onboarding.');
  });

  it('Test 5d: a pre-commit failure (e.g. duplicate email) surfaces the message and does not call createSession', async () => {
    const { p, createSession, navigate, setError } = build();
    const dupe = vi.fn().mockRejectedValue(new Error('Email already registered')) as RegistrationDeps['registerUser'];
    p.registerUser = dupe;

    await submitRegistration(p);

    expect(dupe).toHaveBeenCalledTimes(1);
    expect(createSession).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Email already registered');
  });
});
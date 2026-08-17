import { beforeEach, describe, expect, it, vi } from 'vitest';

import { submitRegistration, type RegistrationDeps } from './submit-registration';

function build() {
  const registerUser = vi
    .fn()
    .mockResolvedValue({ user: { id: 'u-1', email: 'a@b.com', name: 'A' }, message: 'Account created' });
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

  it('shows a clear message and does not navigate when the session reservation fails after the account is committed', async () => {
    const { p, navigate, setError } = build();
    const failing = vi.fn().mockRejectedValue(new Error('create failed')) as RegistrationDeps['createSession'];
    p.createSession = failing;

    await submitRegistration(p);

    expect(failing).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Your account was created. Please sign in to continue onboarding.');
  });

  it('does not navigate or reserve a session when registration fails (e.g. duplicate email)', async () => {
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
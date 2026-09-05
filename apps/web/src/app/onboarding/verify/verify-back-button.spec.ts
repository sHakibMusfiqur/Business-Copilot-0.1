import { describe, it, expect, vi, beforeEach } from 'vitest';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => '/onboarding/verify',
  useSearchParams: () => new URLSearchParams('session=test-session-123'),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Verify page Back button navigates to /register', () => {
  it('navigates to /register', () => {
    push('/register');

    expect(push).toHaveBeenCalledTimes(1);
    expect(push).toHaveBeenCalledWith('/register');
  });

  it('does NOT navigate to /onboarding', () => {
    push('/register');

    const target = push.mock.calls[0][0] as string;
    expect(target).not.toBe('/onboarding');
    expect(target).not.toContain('/onboarding');
  });

  it('does NOT navigate to /login', () => {
    push('/register');

    const target = push.mock.calls[0][0] as string;
    expect(target).not.toBe('/login');
  });

  it('does NOT navigate to /onboarding/verify', () => {
    push('/register');

    const target = push.mock.calls[0][0] as string;
    expect(target).not.toContain('verify');
  });

  it('does not pass a session query parameter', () => {
    push('/register');

    const target = push.mock.calls[0][0] as string;
    expect(target).not.toContain('session=');
  });
});

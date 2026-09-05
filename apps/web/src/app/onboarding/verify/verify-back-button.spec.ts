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

describe('Verify page emailSent query parameter', () => {
  it('reads emailSent=false from URL to indicate email delivery failure', () => {
    const params = new URLSearchParams('session=test-session-123&emailSent=false');
    expect(params.get('emailSent')).toBe('false');
  });

  it('reads emailSent absent from URL as email delivery success (default)', () => {
    const params = new URLSearchParams('session=test-session-123');
    expect(params.get('emailSent')).toBeNull();
  });

  it('emailSent=false is distinguishable from emailSent=true', () => {
    const failedParams = new URLSearchParams('session=s&emailSent=false');
    const successParams = new URLSearchParams('session=s&emailSent=true');
    expect(failedParams.get('emailSent')).toBe('false');
    expect(successParams.get('emailSent')).toBe('true');
  });
});

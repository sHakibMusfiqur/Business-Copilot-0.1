import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createProvisioningEventSource, getProvisioningSseToken } from '@/lib/api/onboarding';

const { mockApi } = vi.hoisted(() => ({
  mockApi: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));


vi.mock('@/lib/api/client', () => ({ api: mockApi }));

describe('onboarding provisioning API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('getProvisioningSseToken GETs /onboarding/sessions/:id/sse-token with session auth and returns the token', async () => {
    window.localStorage.setItem('bc_onboarding_token_s-1', 'onb-tok');
    mockApi.get.mockResolvedValue({ data: { token: 'sse-tok', expiresInSeconds: 120 } });

    const result = await getProvisioningSseToken('s-1');

    expect(mockApi.get).toHaveBeenCalledWith(
      '/onboarding/sessions/s-1/sse-token',
      expect.objectContaining({ headers: { 'X-Onboarding-Token': 'onb-tok' } }),
    );
    expect(result).toEqual({ token: 'sse-tok', expiresInSeconds: 120 });
  });

  it('createProvisioningEventSource uses the sseToken query param and never the onboarding token', () => {
    const instances: { url: string }[] = [];
    class FakeEventSource {
      url: string;
      instance: { url: string };
      constructor(url: string) {
        this.url = url;
        this.instance = { url };
        instances.push(this.instance);
      }
      close() {}
    }
    vi.stubGlobal('EventSource', FakeEventSource);

    createProvisioningEventSource('s-1', 'tok a/b+c?');
    const url = instances[0].url;

    expect(url).toContain('/api/onboarding/sessions/s-1/progress/stream');
    expect(url).toContain(`?sseToken=${encodeURIComponent('tok a/b+c?')}`);
   
    expect(url).not.toMatch(/\?token=/);
    expect(url).not.toContain('onboardingToken=');
  });
});
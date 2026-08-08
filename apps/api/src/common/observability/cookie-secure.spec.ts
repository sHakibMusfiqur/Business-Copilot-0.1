import { ConfigService } from '../../config/config.service';
import { AuthController } from '../../auth/auth.controller';
import { AdminAuthController } from '../../platform-admin/admin-auth.controller';
import { OrganizationController } from '../../organization/organization.controller';
import type { AuthService } from '../../auth/auth.service';
import type { AdminAuthService } from '../../platform-admin/admin-auth.service';
import type { OrganizationService } from '../../organization/organization.service';

interface MockResponse {
  cookie: jest.Mock;
  clearCookie: jest.Mock;
}

function makeResponse(): MockResponse {
  return {
    cookie: jest.fn(),
    clearCookie: jest.fn(),
  };
}

function makeConfig(isProduction: boolean): Partial<ConfigService> {
  return { isProduction };
}

describe('cookie secure flag follows ConfigService.isProduction', () => {
  function cookieCalls(res: MockResponse): Array<{ name: string; secure: boolean }> {
    return res.cookie.mock.calls.map(([name, , opts]: [string, string, { secure: boolean }]) => ({
      name,
      secure: opts.secure,
    }));
  }

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('AuthController', () => {
    const authService = {
      login: jest.fn(),
      register: jest.fn(),
      refreshToken: jest.fn(),
      logout: jest.fn(),
      getProfile: jest.fn(),
    };

    const request = {
      ip: '',
      headers: {},
      cookies: {},
    } as never;

    function makeController(isProduction: boolean): AuthController {
      return new AuthController(
        authService as unknown as AuthService,
        makeConfig(isProduction) as ConfigService,
      );
    }

    it('sets secure:true on auth cookies in production', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: {},
      });
      const res = makeResponse();
      await makeController(true).login({ email: 'e@x.com', password: 'p' } as never, res as never, request);
      const calls = cookieCalls(res);
      expect(calls).toHaveLength(2);
      for (const c of calls) expect(c.secure).toBe(true);
    });

    it('sets secure:false on auth cookies in development', async () => {
      authService.login.mockResolvedValue({
        accessToken: 'a',
        refreshToken: 'r',
        user: {},
      });
      const res = makeResponse();
      await makeController(false).login({} as never, res as never, request);
      const calls = cookieCalls(res);
      expect(calls).toHaveLength(2);
      for (const c of calls) expect(c.secure).toBe(false);
    });

    it('clears cookies with secure:true on logout in production', async () => {
      authService.logout.mockResolvedValue(undefined);
      const res = makeResponse();
      await makeController(true).logout({ id: 1 } as never, res as never, request);
      const secure = res.clearCookie.mock.calls.map(
        ([, opts]: [string, { secure: boolean }]) => opts.secure,
      );
      expect(secure.length).toBeGreaterThan(0);
      for (const s of secure) expect(s).toBe(true);
    });

    it('clears cookies with secure:false on logout in development', async () => {
      authService.logout.mockResolvedValue(undefined);
      const res = makeResponse();
      await makeController(false).logout({ id: 1 } as never, res as never, request);
      const secure = res.clearCookie.mock.calls.map(
        ([, opts]: [string, { secure: boolean }]) => opts.secure,
      );
      expect(secure.length).toBeGreaterThan(0);
      for (const s of secure) expect(s).toBe(false);
    });
  });

  describe('AdminAuthController', () => {
    const adminAuthService = { login: jest.fn() };

    function makeAdmin(isProduction: boolean): AdminAuthController {
      return new AdminAuthController(
        adminAuthService as unknown as AdminAuthService,
        makeConfig(isProduction) as ConfigService,
      );
    }

    it('sets secure:true on admin auth cookies in production', async () => {
      adminAuthService.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
      const res = makeResponse();
      await makeAdmin(true).login({} as never, res as never, {
        ip: '',
        headers: {},
      } as never);
      const calls = cookieCalls(res);
      expect(calls).toHaveLength(2);
      for (const c of calls) expect(c.secure).toBe(true);
    });

    it('sets secure:false on admin auth cookies in development', async () => {
      adminAuthService.login.mockResolvedValue({ accessToken: 'a', refreshToken: 'r' });
      const res = makeResponse();
      await makeAdmin(false).login({} as never, res as never, {
        ip: '',
        headers: {},
      } as never);
      const calls = cookieCalls(res);
      expect(calls).toHaveLength(2);
      for (const c of calls) expect(c.secure).toBe(false);
    });
  });

  describe('OrganizationController', () => {
    const organizationService = { create: jest.fn() };
    const authService = { generateTokens: jest.fn() };

    function makeOrg(isProduction: boolean): OrganizationController {
      return new OrganizationController(
        organizationService as unknown as OrganizationService,
        authService as unknown as AuthService,
        makeConfig(isProduction) as ConfigService,
      );
    }

    it('sets secure:true on the refresh cookie in production', async () => {
      organizationService.create.mockResolvedValue({
        organization: { id: 1 },
        userEmail: 'e@x.com',
        userRole: 'ADMIN',
      });
      authService.generateTokens.mockResolvedValue({ refreshToken: 'r', accessToken: 'a' });
      const res = makeResponse();
      const result = await makeOrg(true).create({} as never, { id: 1 } as never, res as never);
      expect(result).toBeDefined();
      expect(res.cookie).toHaveBeenCalled();
      const opts = res.cookie.mock.calls[0][2] as { secure: boolean };
      expect(opts.secure).toBe(true);
    });

    it('sets secure:false on the refresh token in development', async () => {
      organizationService.create.mockResolvedValue({
        organization: { id: 1 },
        userEmail: 'e@x.com',
        userRole: 'ADMIN',
      });
      authService.generateTokens.mockResolvedValue({ refreshToken: 'r', accessToken: 'a' });
      const res = makeResponse();
      await makeOrg(false).create({} as never, { id: 1 } as never, res as never);
      const opts = res.cookie.mock.calls[0][2] as { secure: boolean };
      expect(opts.secure).toBe(false);
    });
  });
});
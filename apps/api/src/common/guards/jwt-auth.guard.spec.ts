import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { JwtAuthGuard } from './jwt-auth.guard';
import { Public, IS_PUBLIC_KEY } from '../decorators/public.decorator';

function makeReflector(isPublic: boolean | undefined): Reflector {
  return {
    getAllAndOverride: jest.fn(() => isPublic),
  } as unknown as Reflector;
}

function makeContext(): ExecutionContext {
  return {
    getHandler: () => ({}),
    getClass: () => ({}),
    switchToHttp: () => ({ getRequest: () => ({}) }),
  } as unknown as ExecutionContext;
}

describe('JwtAuthGuard', () => {
  it('allows requests decorated with @Public() without validating a token', () => {
    const guard = new JwtAuthGuard(makeReflector(true));
    expect(guard.canActivate(makeContext())).toBe(true);
  });

  it('consults both the handler and class metadata for the public flag', () => {
    const reflector = makeReflector(true);
    const guard = new JwtAuthGuard(reflector);
    guard.canActivate(makeContext());
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(IS_PUBLIC_KEY, [
      expect.anything(),
      expect.anything(),
    ]);
  });

  it('returns the authenticated user from handleRequest', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    const user = { id: 'u1', email: 'a@b.c' };
    expect(guard.handleRequest(null, user)).toBe(user);
  });

  it('rejects handleRequest with Unauthorized when no user is present', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    expect(() => guard.handleRequest(null, undefined)).toThrow(UnauthorizedException);
  });

  it('rethrows the passport error from handleRequest', () => {
    const guard = new JwtAuthGuard(makeReflector(false));
    const err = new Error('token expired');
    expect(() => guard.handleRequest(err, undefined)).toThrow(err);
  });

  it('keeps the @Public() decorator metadata key stable', () => {
    const handler = () => undefined;
    const target = { handler };
    const descriptor = { value: handler, writable: true, configurable: true };
    Public()(target, 'handler', descriptor);
    expect(Reflect.getMetadata(IS_PUBLIC_KEY, target.handler as object)).toBe(true);
  });
});

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { JwtPayload } from '@/lib/jwt';
import { decodeJWT, isTokenExpired } from '@/lib/jwt';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

const ORG_ROUTE_PREFIXES = [
  '/dashboard',
  '/customers',
  '/suppliers',
  '/products',
  '/inventory',
  '/crm',
  '/sales',
  '/purchases',
  '/invoices',
  '/accounting',
  '/payroll',
  '/employees',
  '/users',
  '/roles',
  '/reports',
  '/copilot',
];

function isOrgRoute(pathname: string): boolean {
  return ORG_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('access_token')?.value;
  const payload = (token ? decodeJWT(token) : null) as JwtPayload | null;
  const activePayload = payload && !isTokenExpired(payload) ? payload : null;
  const isLoggedIn = activePayload !== null;

  // ── Public routes ──────────────────────────────────────────────
  if (PUBLIC_ROUTES.includes(pathname)) {
    if (!isLoggedIn) {
      return NextResponse.next();
    }

    const role = activePayload.role;
    const hasOrg = !!activePayload.organizationId;

    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    if (hasOrg) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  // ── Protected routes (require authentication) ──────────────────
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  const role = activePayload.role;
  const hasOrg = !!activePayload.organizationId;

  // ── Platform admin routes ──────────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // ── Organization routes (require auth + organizationId) ────────
  if (isOrgRoute(pathname)) {
    if (!hasOrg) {
      if (role === 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/organization/create', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

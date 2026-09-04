import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import type { JwtPayload } from '@/lib/jwt';
import { decodeJWT, isTokenExpired } from '@/lib/jwt';

const PUBLIC_ROUTES = ['/', '/login', '/register', '/forgot-password', '/reset-password', '/accept-invite'];

// Organization-aware login via URL path: businesscopilot.com/company/:slug/login
const PUBLIC_PREFIXES = ['/company/'];


const ALLOW_AUTHENTICATED_PUBLIC_ROUTES = ['/register'];

const ONBOARDING_ROUTES = ['/onboarding'];

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
  '/departments',
  '/employees',
  '/leaves',
  '/payroll',
  '/users',
  '/roles',
  '/audit',
  '/reports',
  '/copilot',
];

function isOrgRoute(pathname: string): boolean {
  return ORG_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get('access_token')?.value;
  const refreshToken = request.cookies.get('refresh_token')?.value;
  const payload = (token ? decodeJWT(token) : null) as JwtPayload | null;
  const activePayload = payload && !isTokenExpired(payload) ? payload : null;
 
  const isLoggedIn = activePayload !== null && Boolean(refreshToken);
  const role = isLoggedIn ? activePayload.role : null;
 
  const onboardingCompleted = isLoggedIn ? activePayload.onboardingCompleted === true : false;

  // ── Public routes ──────────────────────────────────────────────
  if (PUBLIC_ROUTES.includes(pathname) || PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    if (!isLoggedIn) {
      return NextResponse.next();
    }

    if (ALLOW_AUTHENTICATED_PUBLIC_ROUTES.includes(pathname)) {
      return NextResponse.next();
    }

    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }

    if (pathname === '/') {
      return NextResponse.redirect(new URL(onboardingCompleted ? '/dashboard' : '/onboarding', request.url));
    }

    if (onboardingCompleted) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    return NextResponse.next();
  }

  // ── Onboarding routes (allow unauthenticated access for steps 0-1) ──
  if (ONBOARDING_ROUTES.some((prefix) => pathname === prefix || pathname.startsWith(prefix + '/'))) {
    return NextResponse.next();
  }

  
  if (pathname === '/admin/login') {
    if (!isLoggedIn) {
      return NextResponse.next();
    }
    if (role === 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.redirect(new URL(onboardingCompleted ? '/dashboard' : '/onboarding', request.url));
  }

  if (pathname.startsWith('/admin')) {
    if (!isLoggedIn) {
      const adminLoginUrl = new URL('/admin/login', request.url);
      adminLoginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(adminLoginUrl);
    }
    if (role !== 'SUPER_ADMIN') {
      return NextResponse.redirect(new URL(onboardingCompleted ? '/dashboard' : '/onboarding', request.url));
    }
    return NextResponse.next();
  }

  // ── Protected routes (require authentication) ──────────────────
  if (!isLoggedIn) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── Organization routes (require auth + completed onboarding) ──
  if (isOrgRoute(pathname)) {
    if (!onboardingCompleted) {
      if (role === 'SUPER_ADMIN') {
        return NextResponse.redirect(new URL('/admin', request.url));
      }
      return NextResponse.redirect(new URL('/onboarding', request.url));
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};

'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2, Lock, Mail } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { login, getOrgBySlug, getOrgByEmail, type PublicOrganization } from '@/lib/api';
import {
  DEFAULT_BRANDING,
  brandFontStack,
  brandInitials,
  fontCssUrl,
  hexToHsl,
  hexToRgba,
  normalizeBranding,
  pickForeground,
  resolveLogo,
  type BrandingTheme,
} from '@/lib/branding';
import { EMAIL_RE } from '@/lib/validation';
import { useAuthStore } from '@/store/auth-store';

const APP_SUBDOMAIN_DENYLIST = new Set(['www', 'app']);

function deriveSubdomainSlug(): string | null {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname.toLowerCase();
  if (!host || host === 'localhost' || host === '127.0.0.1') return null;
  const parts = host.split('.').filter(Boolean);
  if (parts.length < 3) return null;
  const sub = parts[0];
  if (APP_SUBDOMAIN_DENYLIST.has(sub)) return null;
  const appDomain = process.env.NEXT_PUBLIC_APP_DOMAIN;
  if (appDomain) {
    const base = parts.slice(1).join('.');
    const normalizedAppDomain = appDomain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .split('/')[0];
    if (base !== normalizedAppDomain) return null;
  }
  return sub;
}

/** Applies an org's branding to the document root while the login page is mounted. */
function useApplyLoginBranding(brand: BrandingTheme) {
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--primary', hexToHsl(brand.primaryColor));
    root.style.setProperty('--primary-foreground', pickForeground(brand.primaryColor));
    root.style.setProperty('--ring', hexToHsl(brand.primaryColor));
    root.style.setProperty('--brand-secondary', hexToHsl(brand.secondaryColor));
    root.style.setProperty('--brand-accent', hexToHsl(brand.accentColor));
  }, [brand.primaryColor, brand.secondaryColor, brand.accentColor]);

  useEffect(() => {
    const root = document.documentElement;
    const heading = brand.headingFont.trim()
      ? brandFontStack(brand.headingFont)
      : brand.fontFamily.trim()
        ? brandFontStack(brand.fontFamily)
        : '';
    root.style.setProperty('--font-body', brand.fontFamily.trim() ? brandFontStack(brand.fontFamily) : '');
    root.style.setProperty('--font-heading', heading);

    const families = new Set<string>();
    for (const f of [brand.fontFamily, brand.headingFont]) {
      const url = fontCssUrl(f);
      if (url) families.add(url);
    }
    const links: HTMLLinkElement[] = [];
    families.forEach((href) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
      links.push(link);
    });
    return () => links.forEach((link) => link.remove());
  }, [brand.fontFamily, brand.headingFont]);

  useEffect(() => {
    if (!brand.faviconUrl) return;
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = brand.faviconUrl;
  }, [brand.faviconUrl]);

  useEffect(() => {
    const suffix = brand.brandName.trim();
    if (!suffix) return;
    if (document.title === suffix) return;
    document.title = suffix;
  }, [brand.brandName]);
}

type OrgLookupState = 'idle' | 'loading' | 'done' | 'error';

interface OrgAwareLoginProps {
  slug?: string;
}

export function OrgAwareLogin({ slug: slugProp }: OrgAwareLoginProps) {
  const router = useRouter();
  const { user, setUser } = useAuthStore();

  const [slug, setSlug] = useState<string | null>(null);
  const [mode, setMode] = useState<'known' | 'email-first'>('known');
  const [lookupState, setLookupState] = useState<OrgLookupState>('idle');
  const [lookupError, setLookupError] = useState<string | null>(null);

  const [org, setOrg] = useState<PublicOrganization | null>(null);
  const [detectedBrand, setDetectedBrand] = useState<BrandingTheme | null>(null);
  const detectedEmailRef = useRef<string | null>(null);

  const [step, setStep] = useState<'email' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Resolve the org context from the URL: explicit slug prop, subdomain, or none.
  useEffect(() => {
    if (slugProp) {
      setMode('known');
      setSlug(slugProp);
      return;
    }
    const sub = deriveSubdomainSlug();
    if (sub) {
      setMode('known');
      setSlug(sub);
    } else {
      setMode('email-first');
    }
  }, [slugProp]);

  const effectiveBrand = detectedBrand ?? DEFAULT_BRANDING;
  useApplyLoginBranding(effectiveBrand);

  // Load org + branding when a slug is known (subdomain or /company/:slug path).
  useEffect(() => {
    if (!slug) return;
    const controller = new AbortController();
    setLookupState('loading');
    setLookupError(null);
    getOrgBySlug(slug, controller.signal)
      .then((result) => {
        setOrg(result);
        setDetectedBrand(normalizeBranding(result.brand));
        setLookupState('done');
      })
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setOrg(null);
        setDetectedBrand(null);
        setLookupState('error');
        setLookupError(err instanceof Error ? err.message : 'Could not load this workspace.');
      });
    return () => controller.abort();
  }, [slug]);

  const detectByEmail = useCallback(async (emailValue: string) => {
    const normalized = emailValue.trim().toLowerCase();
    setDetecting(true);
    setLookupError(null);
    try {
      const result = await getOrgByEmail(normalized);
      if (result.found && result.organization) {
        detectedEmailRef.current = normalized;
        setOrg(result.organization);
        setDetectedBrand(normalizeBranding(result.organization.brand));
        setStep('password');
      } else {
        detectedEmailRef.current = null;
        setOrg(null);
        setDetectedBrand(null);
        setLookupError(
          'We could not find an organization for this email. Check the address and try again.',
        );
      }
    } catch (err: unknown) {
      setLookupError(
        err instanceof Error ? err.message : 'Something went wrong while checking your email.',
      );
    } finally {
      setDetecting(false);
    }
  }, []);

  // Re-detect the organization when the email is edited on the password step.
  useEffect(() => {
    if (mode !== 'email-first' || step !== 'password') return;
    if (!email.trim()) return;
    if (email.trim().toLowerCase() === detectedEmailRef.current) return;
    const timer = setTimeout(() => {
      void detectByEmail(email);
    }, 600);
    return () => clearTimeout(timer);
  }, [email, step, mode, detectByEmail]);

  const redirectAfterLogin = useCallback(
    (loggedInUser: { role?: string; onboardingCompleted?: boolean }) => {
      if (loggedInUser.role === 'SUPER_ADMIN') {
        router.replace('/admin');
      } else if (loggedInUser.onboardingCompleted) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    },
    [router],
  );

  useEffect(() => {
    if (user) redirectAfterLogin(user);
  }, [user, redirectAfterLogin]);

  if (user) {
    return null;
  }

  function handleEmailContinue(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError('Enter a valid email address');
      return;
    }
    setEmailError(null);
    void detectByEmail(value);
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setEmailError('Enter a valid email address');
      return;
    }
    if (!password) {
      setLoginError('Password is required');
      return;
    }
    setEmailError(null);
    setLoginError(null);
    setIsSubmitting(true);
    try {
      const result = await login(value, password);
      setUser(result.user, result.accessToken);
      redirectAfterLogin(result.user);
    } catch (err: unknown) {
      setLoginError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  const headingFont = brandFontStack(effectiveBrand.headingFont || effectiveBrand.fontFamily);
  const bodyFont = brandFontStack(effectiveBrand.fontFamily);

  const brandHeader = (
    <div className="mb-8 text-center">
      <Link href="/" className="inline-flex items-center gap-2">
        {resolveLogo(effectiveBrand) ? (
          <div
            className="h-10 w-10 rounded-xl bg-primary/10 bg-contain bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${resolveLogo(effectiveBrand)})` }}
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
            <span className="text-lg font-bold text-primary-foreground">
              {brandInitials(effectiveBrand.brandName)}
            </span>
          </div>
        )}
        <span className="text-xl font-semibold">{effectiveBrand.brandName}</span>
      </Link>
      <h1 className="mt-6 text-2xl font-semibold" style={{ fontFamily: headingFont }}>
        {mode === 'email-first' && step === 'email' ? 'Sign in to your workspace' : 'Welcome back'}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        {effectiveBrand.tagline || (mode === 'email-first' && step === 'password' && org
          ? `Continue signing in to ${org.name}`
          : 'Sign in to your account to continue')}
      </p>
    </div>
  );

  const emailField = (
    <div>
      <label htmlFor="email" className="mb-2 block text-sm font-medium">
        {mode === 'email-first' && step === 'email' ? 'Work email' : 'Email'}
      </label>
      <div className="relative">
        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="you@example.com"
        />
      </div>
      {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
    </div>
  );

  const passwordField = (
    <div>
      <label htmlFor="password" className="mb-2 block text-sm font-medium">
        Password
      </label>
      <div className="relative">
        <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          id="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          placeholder="Enter your password"
        />
        <button
          type="button"
          onClick={() => setShowPassword((v) => !v)}
          aria-label={showPassword ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        >
          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  );

  const signInButton = (
    <button
      type="submit"
      disabled={isSubmitting}
      className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
    >
      {isSubmitting ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          Sign in
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </button>
  );

  const backgroundStyle = useMemo(() => {
    if (effectiveBrand.loginBackgroundUrl) {
      return { backgroundImage: `url(${effectiveBrand.loginBackgroundUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' };
    }
    return {
      backgroundImage: `linear-gradient(to bottom right, ${hexToRgba(effectiveBrand.primaryColor, 0.05)}, transparent 50%, ${hexToRgba(effectiveBrand.secondaryColor, 0.06)})`,
    };
  }, [effectiveBrand]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0" style={backgroundStyle} />
      <div
        className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[100px]"
        style={{ backgroundColor: hexToRgba(effectiveBrand.primaryColor, 0.1) }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] h-[400px] w-[400px] rounded-full blur-[100px]"
        style={{ backgroundColor: hexToRgba(effectiveBrand.accentColor, 0.1) }}
      />
      {effectiveBrand.loginIllustrationUrl && (
        <div
          className="pointer-events-none absolute bottom-[-4%] right-[-6%] hidden h-[45%] w-auto opacity-90 lg:block"
          style={{
            backgroundImage: `url(${effectiveBrand.loginIllustrationUrl})`,
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'bottom right',
          }}
        />
      )}

      <div
        className="relative z-10 m-auto w-full max-w-md px-4"
        style={{ fontFamily: bodyFont }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-2xl p-8"
        >
          {mode === 'known' && lookupState === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading workspace...</p>
            </div>
          )}

          {mode === 'known' && lookupState === 'done' && (
            <LoginFormShell
              brandHeader={brandHeader}
              lookupError={lookupError}
              loginError={loginError}
              emailField={emailField}
              passwordField={passwordField}
              signInButton={signInButton}
              handleLogin={handleLogin}
            />
          )}

          {mode === 'known' && lookupState === 'error' && (
            <LoginFormShell
              brandHeader={brandHeader}
              lookupError={lookupError}
              loginError={loginError}
              emailField={emailField}
              passwordField={passwordField}
              signInButton={signInButton}
              handleLogin={handleLogin}
            />
          )}

          {mode === 'email-first' && step === 'email' && (
            <div>
              {brandHeader}
              {lookupError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {lookupError}
                </motion.div>
              )}
              <form onSubmit={handleEmailContinue} className="space-y-5">
                {emailField}
                <button
                  type="submit"
                  disabled={detecting}
                  className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
                >
                  {detecting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Continue'}
                </button>
              </form>
              <p className="mt-6 text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{' '}
                <Link href="/register" className="font-medium text-primary hover:text-primary/80">
                  Create one
                </Link>
              </p>
            </div>
          )}

          {mode === 'email-first' && step === 'password' && (
            <div>
              {brandHeader}
              {lookupError && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {lookupError}
                </motion.div>
              )}
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label htmlFor="email" className="text-sm font-medium">
                      Work email
                    </label>
                    <button
                      type="button"
                      onClick={() => setStep('email')}
                      className="text-xs font-medium text-primary hover:text-primary/80"
                    >
                      Not you? Use a different email
                    </button>
                  </div>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                      id="email"
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  {emailError && <p className="mt-1 text-xs text-destructive">{emailError}</p>}
                  {detecting && (
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Checking organization...
                    </p>
                  )}
                </div>

                {passwordField}

                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                    <span className="text-sm text-muted-foreground">Remember me</span>
                  </label>
                  <Link
                    href="/forgot-password"
                    className="text-sm font-medium text-primary hover:text-primary/80"
                  >
                    Forgot password?
                  </Link>
                </div>

                {signInButton}
              </form>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

function LoginFormShell({
  brandHeader,
  lookupError,
  loginError,
  emailField,
  passwordField,
  signInButton,
  handleLogin,
}: {
  brandHeader: React.ReactNode;
  lookupError: string | null;
  loginError: string | null;
  emailField: React.ReactNode;
  passwordField: React.ReactNode;
  signInButton: React.ReactNode;
  handleLogin: (e: React.FormEvent) => void;
}) {
  return (
    <div>
      {brandHeader}
      {lookupError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-2 rounded-lg bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-400"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {lookupError}
        </motion.div>
      )}
      {loginError && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          {loginError}
        </motion.div>
      )}
      <form onSubmit={handleLogin} className="space-y-5">
        {emailField}
        {passwordField}

        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
            />
            <span className="text-sm text-muted-foreground">Remember me</span>
          </label>
          <Link href="/forgot-password" className="text-sm font-medium text-primary hover:text-primary/80">
            Forgot password?
          </Link>
        </div>

        {signInButton}
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link href="/register" className="font-medium text-primary hover:text-primary/80">
          Create one
        </Link>
      </p>
    </div>
  );
}

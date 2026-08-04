'use client';

import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { adminLogin } from '@/lib/api';
import { EMAIL_RE } from '@/lib/validation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { useAuthStore } from '@/store/auth-store';

export default function AdminLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isDev = process.env.NODE_ENV !== 'production';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address');
      return;
    }
    if (!password) {
      setError('Password is required');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const result = await adminLogin(value, password);
      setUser(result.user, result.accessToken);
      const requested =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search).get('redirect')
          : null;
      const target = requested && requested.startsWith('/admin') ? requested : '/admin';
      router.replace(target);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Invalid email or password');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-background">
      {/* ── Ambient background ─────────────────────────────────── */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.10),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(99,102,241,0.08),transparent_55%)]" />
        <div className="absolute -left-24 -top-24 h-96 w-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-indigo-500/10 blur-[120px]" />
        <div className="absolute left-1/3 top-1/3 h-72 w-72 rounded-full bg-sky-400/10 blur-[110px]" />
      </div>

      <div className="absolute right-5 top-5 z-30">
        <ThemeToggle />
      </div>

      {/* ── Split layout ───────────────────────────────────────── */}
      <div className="relative z-10 mx-auto grid w-full max-w-6xl flex-1 items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:gap-16">
        {/* Left: Platform Console branding panel */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="hidden max-w-md lg:block"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Business Copilot</p>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Enterprise ERP Platform
              </p>
            </div>
          </div>

          <h1 className="mt-10 text-[2.6rem] font-semibold leading-[1.1] tracking-tight">
            Platform <span className="text-gradient">Console</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
            Administer organizations, users, billing, AI usage and platform-wide security from a
            single secure control room.
          </p>

          <ul className="mt-10 space-y-4 text-sm text-muted-foreground">
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="h-4 w-4" />
              </span>
              Restricted to platform administrators only
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Lock className="h-4 w-4" />
              </span>
              Encrypted sessions with role-based access control
            </li>
            <li className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Sparkles className="h-4 w-4" />
              </span>
              Live platform insights, audit trails and monitoring
            </li>
          </ul>

          <div className="mt-12 rounded-xl border border-border bg-card/40 p-4 backdrop-blur-sm">
            <p className="text-xs text-muted-foreground">
              This portal is separate from organization sign-in. Organization users continue to
              sign in through their workspace at{' '}
              <Link href="/login" className="font-medium text-primary hover:text-primary/80">
                /login
              </Link>
              .
            </p>
          </div>
        </motion.div>

        {/* Right: glass login card */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: 'easeOut' }}
          className="mx-auto w-full max-w-[430px]"
        >
          <div className="rounded-2xl border border-border bg-card/70 p-8 shadow-[0_8px_30px_-12px_rgba(15,23,42,0.25)] backdrop-blur-xl dark:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.55)]">
            <div className="mb-8 text-center lg:hidden">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>

            <h2 className="text-2xl font-semibold tracking-tight">Sign in</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Platform Console access · Platform administrators only
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-email"
                    type="email"
                    autoComplete="email"
                    autoFocus
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-10 pl-10"
                    placeholder="admin@example.com"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="admin-password">Password</Label>
                  <span className="cursor-not-allowed text-xs font-medium text-muted-foreground/70" title="Coming soon">
                    Forgot password? <span className="rounded border border-border px-1 py-0.5 text-[10px] uppercase tracking-wide">Coming soon</span>
                  </span>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="admin-password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="h-10 px-10"
                    placeholder="Enter your password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 rounded border-input bg-background text-primary accent-primary focus:ring-primary"
                  />
                  Remember me
                </label>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
                >
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  <>
                    Sign in to console
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 flex items-start gap-2.5 rounded-xl border border-border bg-muted/40 p-3.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-xs leading-relaxed text-muted-foreground">
                Authorized access only. All sign-in attempts are logged and monitored. Your session
                is encrypted.
              </p>
            </div>

            {isDev && (
              <p className="mt-5 rounded-lg border border-border bg-background/60 px-3 py-2 text-center text-xs text-muted-foreground">
                Development access · <span className="font-mono">admin@businesscopilot.local</span> /{' '}
                <span className="font-mono">Admin@123</span>
              </p>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/login" className="inline-flex items-center gap-1.5 font-medium text-primary transition-colors hover:text-primary/80">
              <Building2 className="h-4 w-4" />
              Go to Organization Login
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

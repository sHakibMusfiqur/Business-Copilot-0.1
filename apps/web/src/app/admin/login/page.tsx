'use client';

import { motion } from 'framer-motion';
import {
  ArrowRight,
  BrainCircuit,
  Building2,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ScrollText,
  Server,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { PlatformBackground } from '@/components/admin/login/platform-background';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { adminLogin } from '@/lib/api';
import { EMAIL_RE } from '@/lib/validation';
import { useAuthStore } from '@/store/auth-store';

interface Capability {
  icon: LucideIcon;
  title: string;
  description: string;
}

const CAPABILITIES: Capability[] = [
  { icon: Building2, title: 'Organization Control', description: 'Create, suspend, and manage workspaces' },
  { icon: CreditCard, title: 'Billing & Revenue', description: 'Plans, invoices, and subscriptions' },
  { icon: BrainCircuit, title: 'AI Platform', description: 'Token usage, costs, and model providers' },
  { icon: ShieldCheck, title: 'Security Center', description: 'Encrypted sessions, role-based access' },
  { icon: ScrollText, title: 'Audit Logs', description: 'Every action captured and reviewable' },
  { icon: Server, title: 'Infrastructure Monitoring', description: 'Uptime, health, and observability' },
];

export default function AdminLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    <div className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#0B1120] text-slate-100 [color-scheme:dark] [font-family:var(--font-inter),ui-sans-serif,system-ui,sans-serif]">
      <PlatformBackground />

      {/* ── Top right: theme toggle ─────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.6, delay: 0.6 }}
        className="absolute right-5 top-5 z-30"
      >
        <ThemeToggle className="rounded-[10px] text-slate-400 hover:bg-white/[0.06] hover:text-white" />
      </motion.div>

      {/* ── Split layout: 55% branding / 45% login card ─────────── */}
      <div className="relative z-10 mx-auto grid min-h-screen w-full max-w-[1440px] items-center gap-10 px-6 py-12 lg:grid-cols-[11fr_9fr] lg:gap-24 lg:px-12">
        {/* ── Left: Enterprise OS branding ──────────────────────── */}
        <section aria-label="Business Copilot platform overview" className="hidden lg:block">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          >
            {/* Logo + badge */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-lg shadow-blue-950/60 ring-1 ring-white/10">
                <ShieldCheck className="h-7 w-7 text-white" />
              </div>
              <div>
                <p className="text-xl font-semibold tracking-tight text-white">Business Copilot</p>
                <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-slate-300">
                    Platform Console
                  </span>
                </span>
              </div>
            </div>

            {/* Heading */}
            <h1 className="mt-16 text-[56px] font-semibold leading-[1.02] tracking-tight text-white xl:text-[64px]">
              Business Copilot
              <span className="block bg-gradient-to-r from-white via-[#BFDBFE] to-[#60A5FA] bg-clip-text text-transparent">
                Platform Console
              </span>
            </h1>

            <p className="mt-7 max-w-xl text-base leading-relaxed text-slate-400">
              Administer every organization, subscription, AI usage, billing, feature flags,
              support, monitoring, audit, and security from a single, unified platform.
            </p>

            {/* Capability cards */}
            <div className="mt-14 grid max-w-2xl grid-cols-2 gap-4">
              {CAPABILITIES.map((capability, i) => (
                <motion.div
                  key={capability.title}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.12 + i * 0.06, duration: 0.5, ease: 'easeOut' }}
                  whileHover={{ y: -3 }}
                  className="group rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 backdrop-blur-sm transition-colors duration-300 hover:border-blue-400/30 hover:bg-white/[0.05]"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.05] text-blue-300 transition-colors duration-300 group-hover:border-blue-400/30 group-hover:bg-blue-500/10">
                    <capability.icon className="h-[18px] w-[18px]" />
                  </div>
                  <p className="mt-3 text-sm font-medium text-slate-200">{capability.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-slate-500">
                    {capability.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </section>

        {/* ── Right: glass login card ───────────────────────────── */}
        <section className="relative mx-auto w-full max-w-[460px]">
          <motion.div
            initial={{ opacity: 0, y: 28, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="relative rounded-[28px] border border-white/10 bg-white/[0.04] p-8 shadow-[0_24px_80px_-20px_rgba(2,6,23,0.9)] backdrop-blur-2xl sm:p-10"
          >
            {/* Top hairline highlight */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            />

            {/* Compact branding for mobile / tablet */}
            <div className="mb-9 flex items-center justify-center gap-3 lg:hidden">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-lg shadow-blue-950/50 ring-1 ring-white/10">
                <ShieldCheck className="h-5 w-5 text-white" />
              </div>
              <div className="text-left">
                <p className="font-semibold leading-tight text-white">Business Copilot</p>
                <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">
                  Platform Console
                </p>
              </div>
            </div>

            {/* Role badge */}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-400/20 bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-300">
              <Lock className="h-3 w-3" />
              Platform Administrator
            </span>

            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-white">Sign in</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-400">
              Restricted access. Only Business Copilot Platform Administrators can continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-9 space-y-6">
              {/* Email */}
              <div className="group relative">
                <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-300" />
                <Input
                  id="admin-email"
                  type="email"
                  autoComplete="email"
                  autoFocus
                  placeholder=" "
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="peer h-[52px] w-full rounded-[14px] border border-white/10 bg-white/[0.04] pb-1 pl-12 pr-4 pt-[18px] text-[15px] text-white placeholder:text-transparent transition-[border-color,box-shadow] duration-300 focus-visible:border-blue-400/60 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:ring-offset-0"
                />
                <Label
                  htmlFor="admin-email"
                  className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-[15px] font-normal text-slate-500 transition-all duration-200 peer-focus:top-[14px] peer-focus:-translate-y-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-blue-300 peer-[:not(:placeholder-shown)]:top-[14px] peer-[:not(:placeholder-shown)]:-translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-slate-400"
                >
                  Email
                </Label>
              </div>

              {/* Password */}
              <div className="group relative">
                <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-500 transition-colors duration-300 group-focus-within:text-blue-300" />
                <Input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder=" "
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="peer h-[52px] w-full rounded-[14px] border border-white/10 bg-white/[0.04] pb-1 pl-12 pr-12 pt-[18px] text-[15px] text-white placeholder:text-transparent transition-[border-color,box-shadow] duration-300 focus-visible:border-blue-400/60 focus-visible:ring-2 focus-visible:ring-blue-500/25 focus-visible:ring-offset-0"
                />
                <Label
                  htmlFor="admin-password"
                  className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-[15px] font-normal text-slate-500 transition-all duration-200 peer-focus:top-[14px] peer-focus:-translate-y-0 peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-blue-300 peer-[:not(:placeholder-shown)]:top-[14px] peer-[:not(:placeholder-shown)]:-translate-y-0 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-slate-400"
                >
                  Password
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>

              {/* Remember me + forgot password */}
              <div className="flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={remember}
                    onChange={(e) => setRemember(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded border-white/20 bg-white/[0.04] accent-[#3B82F6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
                  />
                  Remember me
                </label>
                <span
                  title="Coming soon"
                  className="cursor-not-allowed text-xs font-medium text-slate-500"
                >
                  Forgot password?{' '}
                  <span className="ml-0.5 rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                    Coming soon
                  </span>
                </span>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  role="alert"
                  className="flex items-start gap-2 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300"
                >
                  <span aria-hidden className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                  {error}
                </motion.div>
              )}

              {/* Primary action */}
              <motion.div whileTap={{ scale: 0.98 }}>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="group relative h-[54px] w-full overflow-hidden rounded-[14px] bg-gradient-to-r from-[#2563EB] to-[#3B82F6] text-[15px] font-semibold text-white shadow-[0_8px_24px_-8px_rgba(37,99,235,0.65)] transition-all duration-300 hover:shadow-[0_14px_36px_-8px_rgba(37,99,235,0.85)] hover:brightness-110 disabled:opacity-70"
                >
                  <span
                    aria-hidden
                    className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.25)_50%,transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                  />
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Signing in…
                    </>
                  ) : (
                    <>
                      Sign in to console
                      <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                    </>
                  )}
                </Button>
              </motion.div>
            </form>

            {/* Audit notice */}
            <p className="mt-8 flex items-center justify-center gap-1.5 text-xs text-slate-500">
              <ShieldCheck className="h-3.5 w-3.5 text-slate-600" />
              All access is logged and monitored.
            </p>
          </motion.div>

          {/* Muted organization link */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-8 text-center text-[13px] text-slate-500"
          >
            Need workspace access?{' '}
            <Link
              href="/login"
              className="group inline-flex items-center gap-1 rounded font-medium text-slate-400 transition-colors hover:text-blue-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40"
            >
              Sign in to your organization
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-0.5" />
            </Link>
          </motion.p>
        </section>
      </div>
    </div>
  );
}

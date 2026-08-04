'use client';

import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import {
  ArrowRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ThemeToggle } from '@/components/ui/theme-toggle';
import { adminLogin } from '@/lib/api';
import { EMAIL_RE } from '@/lib/validation';
import { useAuthStore } from '@/store/auth-store';

export default function AdminLoginPage() {
  const router = useRouter();
  const setUser = useAuthStore((s) => s.setUser);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const cardRef = useRef<HTMLDivElement>(null);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);
  const springX = useSpring(mouseX, { stiffness: 80, damping: 22, mass: 0.8 });
  const springY = useSpring(mouseY, { stiffness: 80, damping: 22, mass: 0.8 });
  const rotateX = useTransform(springY, [-0.5, 0.5], [3, -3]);
  const rotateY = useTransform(springX, [-0.5, 0.5], [-3, 3]);

  const handleCardMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = cardRef.current?.getBoundingClientRect();
      if (!rect) return;
      mouseX.set((e.clientX - rect.left) / rect.width - 0.5);
      mouseY.set((e.clientY - rect.top) / rect.height - 0.5);
    },
    [mouseX, mouseY],
  );

  const handleCardMouseLeave = useCallback(() => {
    mouseX.set(0);
    mouseY.set(0);
  }, [mouseX, mouseY]);

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
    <div
      className="relative flex min-h-screen w-full flex-col overflow-hidden bg-[#080D1A] text-slate-100 [color-scheme:dark] [font-family:var(--font-inter),ui-sans-serif,system-ui,sans-serif]"
    >
      {/* ═══════ Layer 1 · Atmospheric Background ═══════ */}
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#080D1A] via-[#0C1322] to-[#080D1A]" />

        {/* Architectural grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.025)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.025)_1px,transparent_1px)] bg-[size:80px_80px] [mask-image:radial-gradient(ellipse_at_center,black_15%,transparent_65%)]" />

        {/* Blueprint crosshair — center */}
        <div className="absolute left-1/2 top-1/2 h-px w-[600px] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/[0.025] to-transparent" />
        <div className="absolute left-1/2 top-1/2 h-[600px] w-px -translate-y-1/2 bg-gradient-to-b from-transparent via-white/[0.025] to-transparent" />

        {/* Concentric rings — centered */}
        <div className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.02]" />
        <div className="absolute left-1/2 top-1/2 h-[560px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.015]" />
        <div className="absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.01]" />
        <div className="absolute left-1/2 top-1/2 h-[1100px] w-[1100px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.005]" />

        {/* Orbital accent — tilted ellipse */}
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.015] [transform:rotateX(65deg)]" />

        {/* Floating orbs */}
        <motion.div
          className="absolute left-[15%] top-[18%] h-[400px] w-[400px] rounded-full bg-[#1E3A8A]/[0.07] blur-[160px]"
          animate={{ x: [0, 50, 0], y: [0, 30, 0] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-[15%] right-[12%] h-[350px] w-[350px] rounded-full bg-[#0C4A6E]/[0.05] blur-[160px]"
          animate={{ x: [0, -40, 0], y: [0, -25, 0] }}
          transition={{ duration: 34, repeat: Infinity, ease: 'easeInOut' }}
        />

        {/* Central radial glow */}
        <div className="absolute left-1/2 top-[45%] h-[500px] w-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#1E40AF]/[0.03] blur-[120px]" />

        {/* Noise texture */}
        <div
          className="absolute inset-0 opacity-[0.012] mix-blend-overlay"
          style={{
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27200%27 height=%27200%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.8%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
          }}
        />

        {/* Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(8,13,26,0.75)_100%)]" />
      </div>

      {/* ═══════ Layer 2 · Brand + Typography + Card ═══════ */}

      {/* Top brand */}
      <motion.header
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
        className="absolute left-0 top-0 z-20 flex items-center gap-3 px-8 py-7 md:px-12"
      >
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-[9px] bg-gradient-to-br from-[#2563EB] to-[#1D4ED8] shadow-[0_2px_8px_rgba(37,99,235,0.25)]" />
          <div className="relative flex h-full w-full items-center justify-center text-[13px] font-bold text-white">
            BC
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-semibold tracking-[-0.01em] text-white/90">
            Business Copilot
          </span>
          <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500/50">
            Platform Admin
          </span>
        </div>
      </motion.header>

      {/* Theme toggle — top right */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.6 }}
        className="absolute right-6 top-6 z-20 md:right-8 md:top-7"
      >
        <ThemeToggle className="h-9 w-9 rounded-full text-slate-500/50 hover:text-slate-300" />
      </motion.div>

      {/* Center content */}
      <div className="relative z-10 flex min-h-screen flex-col items-center justify-center px-6">

        {/* Typography — above card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="mb-12 text-center md:mb-14"
        >
          <h1 className="text-[clamp(40px,4.5vw,64px)] font-semibold leading-[1.05] tracking-[-0.025em] text-white">
            Platform{' '}
            <span className="bg-gradient-to-r from-white via-[#BFDBFE] to-[#60A5FA] bg-clip-text text-transparent">
              Console
            </span>
          </h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.45 }}
            className="mt-5 text-[15px] text-slate-500/60"
          >
            Sign in to access the admin console
          </motion.p>
        </motion.div>

        {/* ── Login Card (PIXEL-PERFECT — DO NOT MODIFY) ── */}
        <motion.div
          ref={cardRef}
          onMouseMove={handleCardMouseMove}
          onMouseLeave={handleCardMouseLeave}
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            rotateX,
            rotateY,
            transformPerspective: 1200,
            transformOrigin: 'center center',
          }}
          className="w-full max-w-[420px]"
        >
          {/* Outer shell — gradient border + ambient glow */}
          <div className="relative rounded-[28px] p-[1px]">
            {/* Ambient glow behind card */}
            <div
              aria-hidden
              className="absolute -inset-4 rounded-[40px] opacity-40 blur-[60px]"
              style={{
                background:
                  'radial-gradient(ellipse at 50% 20%, rgba(37,99,235,0.10) 0%, transparent 60%)',
              }}
            />

            {/* Gradient border ring */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-[28px]"
              style={{
                background:
                  'linear-gradient(160deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 40%, rgba(255,255,255,0.04) 60%, rgba(255,255,255,0.08) 100%)',
              }}
            />

            {/* Inner card surface */}
            <div
              className="relative rounded-[27px] bg-[#0D1424]/95 backdrop-blur-2xl"
              style={{
                boxShadow:
                  '0 0 0 0.5px rgba(255,255,255,0.04), 0 1px 2px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.2), 0 12px 24px rgba(0,0,0,0.2), 0 32px 64px rgba(0,0,0,0.25), 0 48px 96px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.06)',
              }}
            >
              {/* Top edge highlight */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px rounded-full bg-gradient-to-r from-transparent via-white/[0.14] to-transparent"
              />
              {/* Second edge highlight */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-10 top-px h-px bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
              />

              {/* Glass reflection */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 rounded-[27px]"
                style={{
                  background:
                    'linear-gradient(165deg, rgba(255,255,255,0.04) 0%, transparent 35%, transparent 65%, rgba(255,255,255,0.015) 100%)',
                }}
              />

              {/* Inner top reflection */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 top-0 h-[120px] rounded-t-[27px]"
                style={{
                  background:
                    'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)',
                }}
              />

              {/* ── Card content ── */}
              <div className="relative px-10 py-12 sm:px-12 sm:py-14">
                {/* Card heading */}
                <div className="mb-10">
                  <h2 className="text-[28px] font-semibold tracking-[-0.02em] text-white">
                    Sign in
                  </h2>
                  <p className="mt-2 text-[14px] text-slate-500">
                    Access the admin console
                  </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Email */}
                  <div className="group relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-600 transition-all duration-300 group-focus-within:text-[#60A5FA]/50" />
                    <Input
                      id="admin-email"
                      type="email"
                      autoComplete="email"
                      autoFocus
                      placeholder=" "
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="peer h-[54px] w-full rounded-[14px] border border-white/[0.06] bg-white/[0.03] pl-12 pr-4 text-[15px] text-white placeholder:text-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300 hover:border-white/[0.10] hover:bg-white/[0.04] focus-visible:border-[#3B82F6]/30 focus-visible:bg-white/[0.04] focus-visible:ring-0 focus-visible:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_0_0_3px_rgba(59,130,246,0.08),0_0_24px_rgba(59,130,246,0.04)]"
                    />
                    <Label
                      htmlFor="admin-email"
                      className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-[15px] text-slate-500 transition-all duration-200 peer-focus:top-[15px] peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-[#60A5FA]/50 peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-slate-500"
                    >
                      Email address
                    </Label>
                  </div>

                  {/* Password */}
                  <div className="group relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-600 transition-all duration-300 group-focus-within:text-[#60A5FA]/50" />
                    <Input
                      id="admin-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder=" "
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="peer h-[54px] w-full rounded-[14px] border border-white/[0.06] bg-white/[0.03] pl-12 pr-12 text-[15px] text-white placeholder:text-transparent shadow-[inset_0_2px_4px_rgba(0,0,0,0.2),inset_0_0_0_1px_rgba(255,255,255,0.02)] transition-all duration-300 hover:border-white/[0.10] hover:bg-white/[0.04] focus-visible:border-[#3B82F6]/30 focus-visible:bg-white/[0.04] focus-visible:ring-0 focus-visible:shadow-[inset_0_2px_4px_rgba(0,0,0,0.15),0_0_0_3px_rgba(59,130,246,0.08),0_0_24px_rgba(59,130,246,0.04)]"
                    />
                    <Label
                      htmlFor="admin-password"
                      className="pointer-events-none absolute left-12 top-1/2 -translate-y-1/2 text-[15px] text-slate-500 transition-all duration-200 peer-focus:top-[15px] peer-focus:text-[11px] peer-focus:font-medium peer-focus:text-[#60A5FA]/50 peer-[:not(:placeholder-shown)]:top-[15px] peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium peer-[:not(:placeholder-shown)]:text-slate-500"
                    >
                      Password
                    </Label>
                    <motion.button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      whileTap={{ scale: 0.9 }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-slate-600 transition-colors hover:text-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/40"
                    >
                      <motion.span
                        key={showPassword ? 'off' : 'on'}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15 }}
                      >
                        {showPassword ? (
                          <EyeOff className="h-[18px] w-[18px]" />
                        ) : (
                          <Eye className="h-[18px] w-[18px]" />
                        )}
                      </motion.span>
                    </motion.button>
                  </div>

                  {/* Error */}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      role="alert"
                      className="flex items-center gap-2 rounded-[12px] border border-red-500/15 bg-red-500/[0.06] px-4 py-3 text-[13px] text-red-300"
                    >
                      <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-400 shadow-[0_0_6px_rgba(248,113,113,0.4)]" />
                      {error}
                    </motion.div>
                  )}

                  {/* Submit */}
                  <motion.div whileTap={{ scale: 0.985 }} className="pt-1">
                    <Button
                      type="submit"
                      disabled={isSubmitting}
                      className="group relative h-[54px] w-full overflow-hidden rounded-[14px] bg-[#2563EB] text-[15px] font-medium text-white transition-all duration-300 hover:bg-[#3B82F6] hover:shadow-[0_4px_16px_rgba(37,99,235,0.4),0_0_40px_rgba(37,99,235,0.12)] disabled:opacity-50"
                      style={{
                        boxShadow:
                          '0 2px 8px rgba(37,99,235,0.3), 0 8px 24px rgba(37,99,235,0.2)',
                      }}
                    >
                      {/* Shimmer */}
                      <span
                        aria-hidden
                        className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_30%,rgba(255,255,255,0.15)_50%,transparent_70%)] opacity-0 transition-opacity duration-500 group-hover:opacity-100"
                      />
                      {isSubmitting ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-2">
                          Sign in
                          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
                        </span>
                      )}
                    </Button>
                  </motion.div>
                </form>

                {/* Divider */}
                <div className="my-8 h-px bg-gradient-to-r from-transparent via-white/[0.05] to-transparent" />

                {/* Security */}
                <p className="flex items-center justify-center gap-1.5 text-[12px] text-slate-600/80">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  All access is logged and monitored
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* ═══════ Layer 3 · Footer ═══════ */}
      <motion.footer
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 1 }}
        className="absolute bottom-0 left-0 right-0 z-10 flex items-center justify-between px-8 py-6 md:px-12"
      >
        <span className="text-[12px] text-slate-600/40">
          &copy; Business Copilot
        </span>
        <Link
          href="/login"
          className="group inline-flex items-center gap-1 text-[12px] text-slate-600/40 transition-colors duration-300 hover:text-slate-400/60"
        >
          Organization Login
          <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-0.5" />
        </Link>
      </motion.footer>
    </div>
  );
}

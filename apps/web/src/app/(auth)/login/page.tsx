'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { Eye, EyeOff, Mail, Lock, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { login } from '@/lib/api';
import { brandInitials, hexToRgba } from '@/lib/branding';
import { useOrganizationTheme } from '@/providers/organization-theme-provider';
import { useAuthStore } from '@/store/auth-store';

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const { brand } = useOrganizationTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  useEffect(() => {
    if (user) {
      if (user.role === 'SUPER_ADMIN') {
        router.replace('/admin');
      } else if (user.onboardingCompleted) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    }
  }, [user, router]);

  if (user) {
    return null;
  }

  async function onSubmit(data: LoginFormData) {
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await login(data.email, data.password);
      setUser(result.user, result.accessToken);
      if (result.user.role === 'SUPER_ADMIN') {
        router.replace('/admin');
      } else if (result.user.onboardingCompleted) {
        router.replace('/dashboard');
      } else {
        router.replace('/onboarding');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Invalid email or password';
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen flex overflow-hidden bg-background">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${hexToRgba(brand.primaryColor, 0.05)}, transparent 50%, ${hexToRgba(brand.secondaryColor, 0.06)})`,
        }}
      />
      <div
        className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[100px]"
        style={{ backgroundColor: hexToRgba(brand.primaryColor, 0.1) }}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] h-[400px] w-[400px] rounded-full blur-[100px]"
        style={{ backgroundColor: hexToRgba(brand.accentColor, 0.1) }}
      />

      <div className="relative z-10 m-auto w-full max-w-md px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="glass-card rounded-2xl p-8"
        >
          <div className="mb-8 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              {brand.logoUrl ? (
                <div
                  className="h-10 w-10 rounded-xl bg-primary/10 bg-contain bg-center bg-no-repeat"
                  style={{ backgroundImage: `url(${brand.logoUrl})` }}
                />
              ) : (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
                  <span className="text-lg font-bold text-primary-foreground">{brandInitials(brand.brandName)}</span>
                </div>
              )}
              <span className="text-xl font-semibold">{brand.brandName}</span>
            </Link>
            <h1 className="mt-6 text-2xl font-semibold">Welcome back</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {brand.tagline || 'Sign in to your account to continue'}
            </p>
          </div>

          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-6 rounded-lg bg-destructive/10 p-3 text-sm text-destructive"
            >
              {error}
            </motion.div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-medium">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  {...register('email')}
                  className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-4 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="you@example.com"
                />
              </div>
              {errors.email && (
                <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

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
                  {...register('password')}
                  className="w-full rounded-lg border border-input bg-background/50 py-2.5 pl-10 pr-10 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

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

            <button
              type="submit"
              disabled={isSubmitting}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:opacity-50"
            >
              {isSubmitting ? (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
              ) : (
                <>
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link
              href="/register"
              className="font-medium text-primary hover:text-primary/80"
            >
              Create one
            </Link>
          </p>
        </motion.div>
      </div>
    </div>
  );
}

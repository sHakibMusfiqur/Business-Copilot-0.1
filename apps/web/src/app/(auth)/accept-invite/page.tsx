'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Lock, Eye, EyeOff, Mail, ArrowRight, CheckCircle2, ShieldAlert, Loader2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { acceptInvitation, verifyInvitation } from '@/lib/api';
import type { VerifiedInvitation } from '@/lib/api/invitations';
import { brandFontStack, brandInitials, hexToRgba } from '@/lib/branding';

const PASSWORD_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,128}$/;

type Stage = 'verifying' | 'invalid' | 'ready' | 'accepted';

function AcceptInvitePage() {
  const router = useRouter();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>('verifying');
  const [invite, setInvite] = useState<VerifiedInvitation | null>(null);
  const [invalidMessage, setInvalidMessage] = useState<string | null>(null);
  const [token, setToken] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const verifiedRef = useRef(false);

  useEffect(() => {
    if (verifiedRef.current) return;
    verifiedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const rawToken = params.get('token') ?? '';
    setToken(rawToken);
    if (!rawToken) {
      setInvalidMessage('Missing invitation token.');
      setStage('invalid');
      return;
    }
    verifyInvitation(rawToken)
      .then((result) => {
        setInvite(result);
        setName(result.name);
        setStage('ready');
      })
      .catch((error: Error) => {
        setInvalidMessage(error.message ?? 'This invitation is invalid or has expired.');
        setStage('invalid');
      });
  }, []);

  const handleSubmit = useCallback(async () => {
    const fieldErrors: Record<string, string> = {};
    if (!PASSWORD_RE.test(password)) {
      fieldErrors.password = 'Password must be at least 8 characters with uppercase, lowercase, and a number.';
    }
    if (password !== confirmPassword) {
      fieldErrors.confirmPassword = 'Passwords do not match.';
    }
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await acceptInvitation({ token, password, name: name.trim() || undefined });
      setStage('accepted');
    } catch (error) {
      toast({
        title: 'Could not accept invitation',
        description: error instanceof Error ? error.message : 'Something went wrong.',
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  }, [token, password, confirmPassword, name, toast]);

  const brand = invite?.brand;
  const headingFont = brand ? brandFontStack(brand.fontFamily) : undefined;

  const backgroundStyle = useMemo(() => {
    if (!brand) return undefined;
    return {
      backgroundImage: `linear-gradient(to bottom right, ${hexToRgba(brand.primaryColor, 0.06)}, transparent 50%, ${hexToRgba(brand.secondaryColor, 0.08)})`,
    };
  }, [brand]);

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0" style={backgroundStyle} />
      <div
        className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full blur-[100px]"
        style={brand ? { backgroundColor: hexToRgba(brand.primaryColor, 0.1) } : undefined}
      />
      <div
        className="absolute bottom-[-20%] left-[-10%] h-[400px] w-[400px] rounded-full blur-[100px]"
        style={brand ? { backgroundColor: hexToRgba(brand.accentColor, 0.1) } : undefined}
      />

      <div className="relative z-10 m-auto w-full max-w-md px-4" style={{ fontFamily: headingFont }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="glass-card rounded-2xl p-8"
        >
          {stage === 'verifying' && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Verifying your invitation...</p>
            </div>
          )}

          {stage === 'invalid' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h1 className="text-lg font-semibold">Invitation not available</h1>
              <p className="text-sm text-muted-foreground">{invalidMessage}</p>
              <p className="text-xs text-muted-foreground">
                Please ask your administrator to resend the invitation.
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Go to sign in
              </Link>
            </div>
          )}

          {stage === 'ready' && invite && (
            <>
              <div className="mb-8 text-center">
                <div className="flex items-center justify-center gap-2">
                  {brand?.logoUrl ? (
                    <div
                      className="h-10 w-10 rounded-xl bg-primary/10 bg-contain bg-center bg-no-repeat"
                      style={{ backgroundImage: `url(${brand.logoUrl})` }}
                    />
                  ) : (
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-xl"
                      style={{ backgroundColor: brand?.primaryColor ?? '#3B82F6' }}
                    >
                      <span className="text-lg font-bold text-white">{brandInitials(brand?.companyName ?? '')}</span>
                    </div>
                  )}
                  <span className="text-xl font-semibold">{brand?.companyName ?? invite.organization.name}</span>
                </div>
                <h1 className="mt-6 text-2xl font-semibold">You&apos;ve been invited</h1>
                <p className="mt-2 text-sm text-muted-foreground">
                  {invite.email} · Set a password to activate your account.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="name" className="text-sm font-medium">Full name</Label>
                  <div className="relative mt-1">
                    <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="password" className="text-sm font-medium">Password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      className={errors.password ? 'border-destructive pl-10 pr-10' : 'pl-10 pr-10'}
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
                  {errors.password && <p className="mt-1 text-xs text-destructive">{errors.password}</p>}
                </div>

                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirm password</Label>
                  <div className="relative mt-1">
                    <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Repeat your password"
                      className={errors.confirmPassword ? 'border-destructive pl-10' : 'pl-10'}
                    />
                  </div>
                  {errors.confirmPassword && (
                    <p className="mt-1 text-xs text-destructive">{errors.confirmPassword}</p>
                  )}
                </div>

                <Button
                  type="button"
                  onClick={() => void handleSubmit()}
                  disabled={submitting}
                  className="flex w-full items-center justify-center gap-2"
                  style={{ backgroundColor: brand?.primaryColor }}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Accept Invitation
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              <p className="mt-6 text-center text-xs text-muted-foreground">
                By accepting you agree to join {brand?.companyName ?? 'the organization'}&apos;s workspace.
              </p>
            </>
          )}

          {stage === 'accepted' && (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-500"
              >
                <CheckCircle2 className="h-7 w-7" />
              </motion.div>
              <h1 className="text-lg font-semibold">Account created!</h1>
              <p className="text-sm text-muted-foreground">
                Your account is ready. Sign in to {brand?.companyName ?? 'your organization'} to get started.
              </p>
              <Button
                className="mt-2 w-full gap-2"
                style={{ backgroundColor: brand?.primaryColor }}
                onClick={() => router.push('/login')}
              >
                Go to Login
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}

export default function AcceptInvitePageWrapper() {
  return <AcceptInvitePage />;
}

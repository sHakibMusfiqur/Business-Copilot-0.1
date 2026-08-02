'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { motion } from 'framer-motion';
import { AxiosError } from 'axios';
import { Building2, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { createOrganization, setAccessToken } from '@/lib/api';
import { useAuthStore } from '@/store/auth-store';

const createOrganizationSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Organization name must be at least 2 characters')
    .max(100, 'Organization name must not exceed 100 characters')
    .regex(
      /^[a-zA-Z0-9\s\-'.&]+$/,
      'Name can only contain letters, numbers, spaces, hyphens, apostrophes, periods, and ampersands',
    ),
});

type CreateOrganizationFormData = z.infer<typeof createOrganizationSchema>;

export default function CreateOrganizationPage() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateOrganizationFormData>({
    resolver: zodResolver(createOrganizationSchema),
  });

  async function onSubmit(data: CreateOrganizationFormData) {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await createOrganization(data.name);
      if (!mountedRef.current) return;
      const { organization, accessToken: newToken } = response;
      setAccessToken(newToken);
      if (user) {
        setUser({ ...user, organizationId: organization.id }, newToken);
      }
      router.push('/dashboard');
    } catch (err: unknown) {
      let message = 'Failed to create organization';
      if (err instanceof AxiosError && err.response?.data) {
        const data = err.response.data as Record<string, unknown>;
        if (typeof data.message === 'string') {
          message = data.message;
        } else if (Array.isArray(data.message)) {
          message = data.message[0] ?? message;
        }
      } else if (err instanceof Error) {
        message = err.message;
      }
      if (mountedRef.current) setError(message);
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) setIsSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-[calc(100vh-8rem)] flex overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-600/5" />
      <div className="absolute top-[-20%] right-[-10%] h-[500px] w-[500px] rounded-full bg-primary/10 blur-[100px]" />
      <div className="absolute bottom-[-20%] left-[-10%] h-[400px] w-[400px] rounded-full bg-blue-600/10 blur-[100px]" />

      <div className="relative z-10 m-auto w-full max-w-lg px-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Card className="glass-card border-none shadow-xl">
            <CardHeader className="text-center pb-6">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-primary/10">
                <Building2 className="h-7 w-7 text-primary" />
              </div>
              <CardTitle className="text-2xl">Create your organization</CardTitle>
              <CardDescription className="text-base">
                Set up your workspace to get started with Business Copilot
              </CardDescription>
            </CardHeader>

            <CardContent>
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
                  <Label htmlFor="name" className="mb-2 block text-sm font-medium">
                    Organization Name
                  </Label>
                  <Input
                    id="name"
                    placeholder="e.g. Acme Corp"
                    {...register('name')}
                    className="bg-background/50"
                  />
                  {errors.name && (
                    <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full"
                  size="lg"
                >
                  {isSubmitting ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  ) : (
                    <>
                      Create Organization
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </form>
            </CardContent>

            <CardFooter className="justify-center pt-2 pb-6">
              <p className="text-sm text-muted-foreground">
                You can always change your organization settings later.
              </p>
            </CardFooter>
          </Card>
        </motion.div>
      </div>
    </div>
  );
}

'use client';

import { Toaster } from '@/components/ui/toaster';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AuthProvider } from '@/providers/auth-provider';
import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <OrganizationThemeProvider>
        <AdminLayout>{children}</AdminLayout>
        <Toaster />
      </OrganizationThemeProvider>
    </AuthProvider>
  );
}

'use client';

import { usePathname } from 'next/navigation';

import { Toaster } from '@/components/ui/toaster';
import { AdminLayout } from '@/components/admin/admin-layout';
import { AuthProvider } from '@/providers/auth-provider';
import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';

export default function Layout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // The Platform Console sign-in page lives under /admin but must never be
  // wrapped in the authenticated console shell (sidebar, auth guard, org
  // theme). It is a standalone, unauthenticated screen.
  if (pathname === '/admin/login') {
    return (
      <OrganizationThemeProvider>
        {children}
        <Toaster />
      </OrganizationThemeProvider>
    );
  }

  return (
    <AuthProvider signInPath="/admin/login">
      <OrganizationThemeProvider>
        <AdminLayout>{children}</AdminLayout>
        <Toaster />
      </OrganizationThemeProvider>
    </AuthProvider>
  );
}

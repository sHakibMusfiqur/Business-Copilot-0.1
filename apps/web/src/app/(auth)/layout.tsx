import { OrganizationThemeProvider } from '@/providers/organization-theme-provider';

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <OrganizationThemeProvider>
      {children}
    </OrganizationThemeProvider>
  );
}

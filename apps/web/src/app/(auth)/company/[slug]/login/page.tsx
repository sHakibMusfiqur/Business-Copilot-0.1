import { OrgAwareLogin } from '@/components/auth/org-aware-login';

interface CompanyLoginPageProps {
  params: Promise<{ slug: string }>;
}

export default async function CompanyLoginPage({ params }: CompanyLoginPageProps) {
  const { slug } = await params;
  return <OrgAwareLogin slug={slug} />;
}

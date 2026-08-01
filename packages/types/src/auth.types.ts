export interface User {
  id: string;
  email: string;
  name: string;
  avatar: string | null;
  phone: string | null;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER' | 'VIEWER';
  isActive: boolean;
  organizationId: string | null;
  onboardingCompleted?: boolean;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

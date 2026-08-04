import {
  LayoutDashboard,
  Building2,
  UsersRound,
  CreditCard,
  LineChart,
  Landmark,
  Bot,
  LifeBuoy,
  ScrollText,
  Settings,
  Flag,
  Activity,
  Bell,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';

export interface AdminNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
}

export interface AdminNavSection {
  section: string;
  items: AdminNavItem[];
}

export const ADMIN_NAV: AdminNavSection[] = [
  {
    section: 'Overview',
    items: [{ label: 'Dashboard', href: '/admin', icon: LayoutDashboard }],
  },
  {
    section: 'Management',
    items: [
      { label: 'Organizations', href: '/admin/organizations', icon: Building2 },
      { label: 'Users', href: '/admin/users', icon: UsersRound },
    ],
  },
  {
    section: 'Monetization',
    items: [
      { label: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
      { label: 'Revenue', href: '/admin/revenue', icon: LineChart },
      { label: 'Payments', href: '/admin/payments', icon: Landmark },
    ],
  },
  {
    section: 'Intelligence',
    items: [{ label: 'AI Usage', href: '/admin/ai', icon: Bot }],
  },
  {
    section: 'Support',
    items: [{ label: 'Support Tickets', href: '/admin/support', icon: LifeBuoy }],
  },
  {
    section: 'Governance',
    items: [
      { label: 'Audit Logs', href: '/admin/audit', icon: ScrollText },
      { label: 'Feature Flags', href: '/admin/feature-flags', icon: Flag },
    ],
  },
  {
    section: 'Platform',
    items: [
      { label: 'Platform Settings', href: '/admin/settings', icon: Settings },
      { label: 'System Monitoring', href: '/admin/monitoring', icon: Activity },
    ],
  },
  {
    section: 'Account',
    items: [
      { label: 'Notifications', href: '/admin/notifications', icon: Bell },
      { label: 'Profile', href: '/admin/profile', icon: UserCircle },
    ],
  },
];

export function findActiveSection(pathname: string): string | null {
  for (const section of ADMIN_NAV) {
    for (const item of section.items) {
      if (pathname === item.href || (item.href !== '/admin' && pathname.startsWith(`${item.href}/`))) {
        return section.section;
      }
    }
  }
  return null;
}

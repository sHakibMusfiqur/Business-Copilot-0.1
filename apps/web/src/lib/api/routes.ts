export const API_ROUTES = {
  HEALTH: '/health',
  AUTH: {
    LOGIN: '/auth/login',
    ADMIN_LOGIN: '/admin/auth/login',
    REGISTER: '/auth/register',
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    REFRESH: '/auth/refresh',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    VERIFY_EMAIL: '/auth/verify-email',
    VERIFY_EMAIL_CODE: '/auth/verify-email/code',
    RESEND_VERIFICATION: '/auth/resend-verification',
  },
  ORGANIZATIONS: {
    ROOT: '/organizations',
    BY_SLUG: '/organizations/by-slug/{slug}',
    BY_EMAIL: '/organizations/by-email',
  },
  DASHBOARD: {
    OVERVIEW: '/dashboard/overview',
  },
  AI: {
    STATUS: '/ai/status',
    ASK: '/ai/ask',
  },
  ONBOARDING: {
    INDUSTRIES: '/onboarding/industries',
    SESSIONS: '/onboarding/sessions',
    BY_EMAIL: '/onboarding/by-email',
    COMPLETE_STEP: '/onboarding/sessions/{sessionId}/complete-step',
    PROVISION: '/onboarding/sessions/{sessionId}/provision',
  },
  ADMIN: {
    DASHBOARD: '/admin/dashboard',
    ORGANIZATIONS: '/admin/organizations',
    USERS: '/admin/users',
    AUDIT: '/admin/audit',
    AUDIT_ACTIONS: '/admin/audit/actions',
    SETTINGS: '/admin/settings',
    PLANS: '/admin/plans',
  },
  BILLING: {
    PLANS: '/billing/plans',
    GATEWAYS: '/billing/gateways',
    SUBSCRIPTION: '/billing/subscription',
    TRIAL: '/billing/trial',
    CHANGE_PLAN: '/billing/change-plan',
    PAYMENTS: '/billing/payments',
    INVOICES: '/billing/invoices',
    CHECKOUT: '/billing/checkout',
    VERIFY: '/billing/verify',
    REFUND: '/billing/refund',
  },
  ROLES: {
    ROOT: '/roles',
    PERMISSIONS_GROUPED: '/permissions/grouped',
    PERMISSIONS_ME: '/permissions/me',
  },
  USERS: {
    ROOT: '/users',
    ASSIGNABLE: '/users/assignable',
  },
  INVITATIONS: {
    ROOT: '/invitations',
    VERIFY: '/invitations/verify',
    ACCEPT: '/invitations/accept',
  },
  DEPARTMENTS: {
    ROOT: '/departments',
  },
  CUSTOMERS: {
    ROOT: '/customers',
  },
  SUPPLIERS: {
    ROOT: '/suppliers',
  },
  PRODUCTS: {
    ROOT: '/products',
    CATEGORIES: '/categories',
  },
  INVENTORY: {
    ROOT: '/inventory',
    ADJUST: '/inventory/adjust',
    SUMMARY: '/inventory/summary',
  },
  PURCHASE: {
    ROOT: '/purchase',
  },
  SALES: {
    ROOT: '/sales',
  },
  ACCOUNTING: {
    SUMMARY: '/accounting/summary',
    ACCOUNTS: '/accounting/accounts',
    JOURNAL: '/accounting/journal',
    RECEIVABLES: '/accounting/receivables',
    PAYABLES: '/accounting/payables',
    PAYMENTS: '/accounting/payments',
    LEDGER: '/accounting/ledger',
    TRIAL_BALANCE: '/accounting/trial-balance',
  },
  CRM: {
    SUMMARY: '/crm/summary',
    LEADS: '/crm/leads',
    ACTIVITIES: '/crm/activities',
  },
  AUDIT: {
    ROOT: '/audit',
  },
  SETTINGS: {
    ROOT: '/settings',
    FILES: '/settings/files',
  },
  IMPORT: {
    START: '/import/start',
    ROOT: '/import',
  },
} as const;

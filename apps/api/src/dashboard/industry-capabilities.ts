// ─── Capability Definitions ────────────────────────────────────────────────────

/** Core business capabilities backed by real Prisma models. */
export type Capability =
  | 'sales'          // SalesOrder, Invoice (type=SALES)
  | 'purchasing'     // PurchaseOrder, Supplier
  | 'inventory'      // Product, Inventory, InventoryTransaction
  | 'customers'      // Customer
  | 'employees'      // Employee, Department
  | 'payroll'        // Payroll
  | 'leaves'         // Leave
  | 'accounting'     // Account, JournalEntry, Receivable, Payable
  | 'crm'            // Lead, Contact, Pipeline, Deal, Activity
  | 'audit';         // AuditLog

/** Industry → supported capabilities. Only real Prisma-backed capabilities. */
export const INDUSTRY_CAPABILITIES: Record<string, readonly Capability[]> = {
  restaurant:     ['sales', 'inventory', 'customers'],
  hospital:       ['sales', 'inventory', 'customers', 'employees', 'payroll', 'leaves'],
  manufacturing:  ['sales', 'purchasing', 'inventory', 'customers'],
  school:         ['sales', 'customers', 'employees', 'payroll', 'leaves'],
  software:       ['sales', 'customers', 'employees', 'payroll', 'leaves'],
  retail:         ['sales', 'inventory', 'customers'],
  pharmacy:       ['sales', 'inventory', 'customers'],
  garments:       ['sales', 'purchasing', 'inventory', 'customers'],
  'it-services':  ['sales', 'customers', 'employees', 'payroll', 'leaves'],
  general:        ['sales', 'purchasing', 'inventory', 'customers', 'employees', 'payroll', 'leaves', 'accounting', 'crm', 'audit'],
};

/** Check if an industry supports a capability. */
export function hasCapability(industry: string, capability: Capability): boolean {
  const caps = INDUSTRY_CAPABILITIES[industry] ?? INDUSTRY_CAPABILITIES.general;
  return caps.includes(capability);
}

/** Get all capabilities for an industry. */
export function getCapabilities(industry: string): readonly Capability[] {
  return INDUSTRY_CAPABILITIES[industry] ?? INDUSTRY_CAPABILITIES.general;
}

// ─── Widget Source Definitions ─────────────────────────────────────────────────


export interface WidgetSourceDef {
  source: string;
  capability: Capability;
  permission: string[];
  supported: boolean;
}

/** Registry of ALL widget sources with their capability requirements. */
export const WIDGET_SOURCES: Record<string, WidgetSourceDef> = {
  // ─── Sales & Orders ───
  todaySales:         { source: 'todaySales',         capability: 'sales',     permission: ['sales.read', 'invoices.read'],          supported: true },
  todayOrders:        { source: 'todayOrders',        capability: 'sales',     permission: ['sales.read'],                           supported: true },
  todayRevenue:       { source: 'todayRevenue',       capability: 'sales',     permission: ['invoices.read', 'accounting.read'],      supported: true },
  todayExpenses:      { source: 'todayExpenses',      capability: 'purchasing', permission: ['purchase.read', 'accounting.read'],     supported: true },
  pendingOrders:      { source: 'pendingOrders',      capability: 'sales',     permission: ['sales.read'],                           supported: true },
  completedOrders:    { source: 'completedOrders',    capability: 'sales',     permission: ['sales.read'],                           supported: true },
  cancelledOrders:    { source: 'cancelledOrders',    capability: 'sales',     permission: ['sales.read'],                           supported: true },
  averageOrderValue:  { source: 'averageOrderValue',  capability: 'sales',     permission: ['sales.read', 'invoices.read'],          supported: true },
  recentOrders:       { source: 'recentOrders',       capability: 'sales',     permission: ['sales.read'],                           supported: true },
  topSellingProducts: { source: 'topSellingProducts', capability: 'sales',     permission: ['sales.read'],                           supported: true },

  // ─── Inventory ───
  lowStock:           { source: 'lowStock',           capability: 'inventory', permission: ['inventory.read'],                       supported: true },
  inventoryValue:     { source: 'inventoryValue',     capability: 'inventory', permission: ['inventory.read'],                       supported: true },

  // ─── Customers ───
  totalCustomers:     { source: 'totalCustomers',     capability: 'customers', permission: ['customers.read'],                       supported: true },
  newCustomersThisMonth: { source: 'newCustomersThisMonth', capability: 'customers', permission: ['customers.read'],                  supported: true },

  // ─── Employees ───
  totalEmployees:     { source: 'totalEmployees',     capability: 'employees', permission: ['employees.read'],                       supported: true },
  pendingLeaves:      { source: 'pendingLeaves',      capability: 'leaves',    permission: ['employees.read'],                       supported: true },
  monthlyPayroll:     { source: 'monthlyPayroll',     capability: 'payroll',   permission: ['payroll.read'],                         supported: true },

  // ─── Finance ───
  monthlyRevenue:     { source: 'monthlyRevenue',     capability: 'accounting', permission: ['invoices.read', 'accounting.read'],     supported: true },
  revenue:            { source: 'revenue',            capability: 'accounting', permission: ['invoices.read', 'accounting.read'],     supported: true },
  cashFlow:           { source: 'cashFlow',           capability: 'accounting', permission: ['invoices.read', 'accounting.read'],     supported: true },

  // ─── System ───
  activity:           { source: 'activity',           capability: 'audit',     permission: ['audit.read'],                           supported: true },
  aiInsights:         { source: 'aiInsights',         capability: 'audit',     permission: ['ai.read'],                              supported: true },
  quickActions:       { source: 'quickActions',       capability: 'audit',     permission: [],                                       supported: true },
};

/** Check if a source is supported for a given industry. */
export function isSourceSupported(source: string, industry: string): boolean {
  const def = WIDGET_SOURCES[source];
  if (!def || !def.supported) return false;
  return hasCapability(industry, def.capability);
}

/** Get the source definition. Returns null if unknown. */
export function getSourceDef(source: string): WidgetSourceDef | null {
  return WIDGET_SOURCES[source] ?? null;
}

/** Get all supported sources for an industry. */
export function getSupportedSources(industry: string): string[] {
  return Object.keys(WIDGET_SOURCES).filter((source) => isSourceSupported(source, industry));
}

// ─── Module Enablement ─────────────────────────────────────────────────────────


export const MODULE_CAPABILITIES: Record<string, readonly Capability[]> = {
  'sales':     ['sales'],
  'invoices':  ['sales', 'accounting'],
  'inventory': ['inventory'],
  'customers': ['customers'],
  'employees': ['employees', 'leaves'],
  'payroll':   ['payroll'],
  'accounting':['accounting'],
  'crm':       ['crm'],
  'audit':     ['audit'],
  'purchase':  ['purchasing'],
};


export function filterByModules(
  capabilities: readonly Capability[],
  enabledModules: readonly string[],
): Capability[] {
  if (enabledModules.length === 0) return [...capabilities];

  const requiredCaps = new Set<Capability>();
  for (const mod of enabledModules) {
    const caps = MODULE_CAPABILITIES[mod];
    if (caps) {
      for (const cap of caps) requiredCaps.add(cap);
    }
  }

  // If no modules map to any capabilities, return all (safe fallback)
  if (requiredCaps.size === 0) return [...capabilities];

  return capabilities.filter((cap) => requiredCaps.has(cap));
}

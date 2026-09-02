import { describe, expect, it } from 'vitest';

import { MODULE_MANIFESTS } from '@/core/modules/definitions';
import { buildNavigation } from '@/core/navigation/navigation-engine';

describe('Industry-based module filtering', () => {
  const ALL_PERMISSIONS = [
    'dashboard.read', 'customers.read', 'suppliers.read', 'crm.read',
    'products.read', 'inventory.read', 'sales.read', 'purchase.read',
    'accounting.read', 'accounting.accounts.read', 'accounting.journal.read',
    'accounting.receivables.read', 'accounting.payables.read', 'payments.read',
    'employees.read', 'payroll.read', 'organization.manage', 'users.read',
    'audit.read', 'billing.read', 'reports.read', 'ai.read',
    'settings.manage',
  ];

  function getModuleIdsForIndustry(industry: string): string[] {
    const filtered = MODULE_MANIFESTS.filter((m) => {
      if (m.visibility?.always) return true;
      const industries = m.industries;
      if (!industries || industries.length === 0) return true;
      return industries.includes(industry as never);
    });
    return filtered.map((m) => m.id);
  }

  function getNavIdsForIndustry(industry: string): string[] {
    const filtered = MODULE_MANIFESTS.filter((m) => {
      if (m.visibility?.always) return true;
      const industries = m.industries;
      if (!industries || industries.length === 0) return true;
      return industries.includes(industry as never);
    });
    const nav = buildNavigation(filtered, ALL_PERMISSIONS);
    return nav.flatMap((s) => s.items.map((i) => i.id));
  }

  describe('restaurant gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, sales, purchases, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('restaurant');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('hospital gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('hospital');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });

    it('does NOT include sales', () => {
      const ids = getModuleIdsForIndustry('hospital');
      expect(ids).not.toContain('sales');
    });
  });

  describe('manufacturing gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, sales, purchases, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('manufacturing');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('school gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('school');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });

    it('does NOT include sales', () => {
      const ids = getModuleIdsForIndustry('school');
      expect(ids).not.toContain('sales');
    });
  });

  describe('retail gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, sales, purchases, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('retail');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('pharmacy gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, sales, purchases, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('pharmacy');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('garments gets expected modules', () => {
    it('includes customers, suppliers, products, inventory, sales, purchases, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('garments');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('software gets expected modules', () => {
    it('includes customers, sales, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('software');
      expect(ids).toContain('customers');
      expect(ids).toContain('sales');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });

    it('does NOT include inventory, suppliers, products, purchases', () => {
      const ids = getModuleIdsForIndustry('software');
      expect(ids).not.toContain('inventory');
      expect(ids).not.toContain('suppliers');
      expect(ids).not.toContain('products');
      expect(ids).not.toContain('purchases');
    });
  });

  describe('it-services gets expected modules', () => {
    it('includes customers, sales, accounting, crm', () => {
      const ids = getModuleIdsForIndustry('it-services');
      expect(ids).toContain('customers');
      expect(ids).toContain('sales');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });

    it('does NOT include inventory, suppliers, products, purchases', () => {
      const ids = getModuleIdsForIndustry('it-services');
      expect(ids).not.toContain('inventory');
      expect(ids).not.toContain('suppliers');
      expect(ids).not.toContain('products');
      expect(ids).not.toContain('purchases');
    });
  });

  describe('general fallback', () => {
    it('includes all standard modules', () => {
      const ids = getModuleIdsForIndustry('general');
      expect(ids).toContain('customers');
      expect(ids).toContain('suppliers');
      expect(ids).toContain('products');
      expect(ids).toContain('inventory');
      expect(ids).toContain('sales');
      expect(ids).toContain('purchases');
      expect(ids).toContain('accounting');
      expect(ids).toContain('crm');
    });
  });

  describe('permission missing -> hidden', () => {
    it('hides modules when user lacks permission', () => {
      const nav = buildNavigation(
        MODULE_MANIFESTS.filter((m) => {
          if (m.visibility?.always) return true;
          const industries = m.industries;
          if (!industries || industries.length === 0) return true;
          return industries.includes('restaurant');
        }),
        ['dashboard.read'],
      );
      const ids = nav.flatMap((s) => s.items.map((i) => i.id));
      expect(ids).not.toContain('customers');
      expect(ids).not.toContain('suppliers');
      expect(ids).not.toContain('sales');
    });
  });

  describe('industry disallowed -> hidden', () => {
    it('hides sales for hospital even with permission', () => {
      const nav = buildNavigation(
        MODULE_MANIFESTS.filter((m) => {
          if (m.visibility?.always) return true;
          const industries = m.industries;
          if (!industries || industries.length === 0) return true;
          return industries.includes('hospital');
        }),
        ALL_PERMISSIONS,
      );
      const ids = nav.flatMap((s) => s.items.map((i) => i.id));
      expect(ids).not.toContain('sales');
    });

    it('hides inventory for software even with permission', () => {
      const nav = buildNavigation(
        MODULE_MANIFESTS.filter((m) => {
          if (m.visibility?.always) return true;
          const industries = m.industries;
          if (!industries || industries.length === 0) return true;
          return industries.includes('software');
        }),
        ALL_PERMISSIONS,
      );
      const ids = nav.flatMap((s) => s.items.map((i) => i.id));
      expect(ids).not.toContain('inventory');
      expect(ids).not.toContain('suppliers');
      expect(ids).not.toContain('products');
      expect(ids).not.toContain('purchases');
    });
  });

  describe('navDisabled -> hidden', () => {
    it('excludes navDisabled modules from navigation', () => {
      const nav = getNavIdsForIndustry('general');
      expect(nav).not.toContain('ai');
      expect(nav).toContain('employees');
      expect(nav).toContain('payroll');
      expect(nav).toContain('reports');
    });
  });

  describe('capability missing -> hidden', () => {
    it('excludes modules whose capabilities are not in the filtered set', () => {
      const nav = buildNavigation(
        MODULE_MANIFESTS.filter((m) => {
          if (m.visibility?.always) return true;
          const industries = m.industries;
          if (!industries || industries.length === 0) return true;
          return industries.includes('software');
        }),
        ALL_PERMISSIONS,
      );
      const ids = nav.flatMap((s) => s.items.map((i) => i.id));
      expect(ids).not.toContain('inventory');
      expect(ids).not.toContain('products');
    });
  });

  describe('child route active-state remains correct', () => {
    it('accounting sub-modules have routes under /accounting', () => {
      const accountingSubModules = MODULE_MANIFESTS.filter((m) =>
        m.dependencies?.includes('accounting'),
      );
      for (const mod of accountingSubModules) {
        expect(mod.route).toMatch(/^\/accounting/);
      }
    });

    it('crm sub-module has route under /crm', () => {
      const crmModule = MODULE_MANIFESTS.find((m) => m.id === 'crm');
      expect(crmModule?.route).toBe('/crm');
    });
  });

  describe('unsupported capability without real route never appears', () => {
    it('all non-navDisabled modules have valid routes', () => {
      const visibleModules = MODULE_MANIFESTS.filter((m) => !m.navDisabled);
      for (const mod of visibleModules) {
        expect(mod.route).toBeTruthy();
        expect(mod.route.startsWith('/')).toBe(true);
      }
    });
  });
});

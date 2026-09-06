import { describe, expect, it } from 'vitest';

import {
  type Capability,
  INDUSTRY_CAPABILITIES,
  hasCapability,
  getCapabilities,
  isSourceSupported,
  getSourceDef,
  getSupportedSources,
  MODULE_CAPABILITIES,
  filterByModules,
} from './industry-capabilities';

describe('Industry Capability Registry', () => {
  describe('INDUSTRY_CAPABILITIES', () => {
    it('defines capabilities for all 10 industries', () => {
      const expectedIndustries = [
        'restaurant', 'hospital', 'manufacturing', 'school', 'software',
        'retail', 'pharmacy', 'garments', 'it-services', 'general',
      ];
      for (const industry of expectedIndustries) {
        expect(INDUSTRY_CAPABILITIES[industry]).toBeDefined();
        expect(INDUSTRY_CAPABILITIES[industry].length).toBeGreaterThan(0);
      }
    });

    it('restaurant has sales, inventory, customers', () => {
      expect(INDUSTRY_CAPABILITIES.restaurant).toContain('sales');
      expect(INDUSTRY_CAPABILITIES.restaurant).toContain('inventory');
      expect(INDUSTRY_CAPABILITIES.restaurant).toContain('customers');
    });

    it('hospital has employees, payroll, leaves', () => {
      expect(INDUSTRY_CAPABILITIES.hospital).toContain('employees');
      expect(INDUSTRY_CAPABILITIES.hospital).toContain('payroll');
      expect(INDUSTRY_CAPABILITIES.hospital).toContain('leaves');
    });

    it('general has all capabilities', () => {
      expect(INDUSTRY_CAPABILITIES.general).toContain('sales');
      expect(INDUSTRY_CAPABILITIES.general).toContain('purchasing');
      expect(INDUSTRY_CAPABILITIES.general).toContain('inventory');
      expect(INDUSTRY_CAPABILITIES.general).toContain('customers');
      expect(INDUSTRY_CAPABILITIES.general).toContain('employees');
      expect(INDUSTRY_CAPABILITIES.general).toContain('payroll');
      expect(INDUSTRY_CAPABILITIES.general).toContain('leaves');
      expect(INDUSTRY_CAPABILITIES.general).toContain('accounting');
      expect(INDUSTRY_CAPABILITIES.general).toContain('crm');
      expect(INDUSTRY_CAPABILITIES.general).toContain('audit');
    });
  });

  describe('hasCapability', () => {
    it('returns true for supported capability', () => {
      expect(hasCapability('restaurant', 'sales')).toBe(true);
      expect(hasCapability('hospital', 'employees')).toBe(true);
    });

    it('returns false for unsupported capability', () => {
      expect(hasCapability('restaurant', 'employees')).toBe(false);
      expect(hasCapability('restaurant', 'payroll')).toBe(false);
    });

    it('falls back to general for unknown industry', () => {
      expect(hasCapability('unknown', 'sales')).toBe(true);
      expect(hasCapability('unknown', 'audit')).toBe(true);
    });
  });

  describe('getCapabilities', () => {
    it('returns capabilities for known industry', () => {
      const caps = getCapabilities('restaurant');
      expect(caps).toContain('sales');
      expect(caps).toContain('inventory');
    });

    it('returns general capabilities for unknown industry', () => {
      const caps = getCapabilities('nonexistent');
      expect(caps).toEqual(INDUSTRY_CAPABILITIES.general);
    });
  });

  describe('isSourceSupported', () => {
    it('returns true for sales source in restaurant', () => {
      expect(isSourceSupported('todaySales', 'restaurant')).toBe(true);
      expect(isSourceSupported('todayOrders', 'restaurant')).toBe(true);
    });

    it('returns false for employee source in restaurant (no employees capability)', () => {
      expect(isSourceSupported('totalEmployees', 'restaurant')).toBe(false);
      expect(isSourceSupported('pendingLeaves', 'restaurant')).toBe(false);
    });

    it('returns true for employee source in hospital', () => {
      expect(isSourceSupported('totalEmployees', 'hospital')).toBe(true);
      expect(isSourceSupported('pendingLeaves', 'hospital')).toBe(true);
    });

    it('returns false for unknown source', () => {
      expect(isSourceSupported('nonexistent', 'general')).toBe(false);
    });
  });

  describe('getSourceDef', () => {
    it('returns definition for known source', () => {
      const def = getSourceDef('todaySales');
      expect(def).not.toBeNull();
      if (def) {
        expect(def.source).toBe('todaySales');
        expect(def.capability).toBe('sales');
        expect(def.supported).toBe(true);
      }
    });

    it('returns null for unknown source', () => {
      expect(getSourceDef('nonexistent')).toBeNull();
    });
  });

  describe('getSupportedSources', () => {
    it('returns sales sources for restaurant', () => {
      const sources = getSupportedSources('restaurant');
      expect(sources).toContain('todaySales');
      expect(sources).toContain('todayOrders');
      expect(sources).toContain('pendingOrders');
    });

    it('excludes employee sources for restaurant', () => {
      const sources = getSupportedSources('restaurant');
      expect(sources).not.toContain('totalEmployees');
      expect(sources).not.toContain('pendingLeaves');
    });

    it('includes employee sources for hospital', () => {
      const sources = getSupportedSources('hospital');
      expect(sources).toContain('totalEmployees');
      expect(sources).toContain('pendingLeaves');
    });
  });
});

describe('Module Capability Filtering', () => {
  describe('MODULE_CAPABILITIES', () => {
    it('maps sales module to sales capability', () => {
      expect(MODULE_CAPABILITIES['sales']).toContain('sales');
    });

    it('maps inventory module to inventory capability', () => {
      expect(MODULE_CAPABILITIES['inventory']).toContain('inventory');
    });

    it('maps employees module to employees and leaves capabilities', () => {
      expect(MODULE_CAPABILITIES['employees']).toContain('employees');
      expect(MODULE_CAPABILITIES['employees']).toContain('leaves');
    });
  });

  describe('filterByModules', () => {
    const allCaps: Capability[] = ['sales', 'inventory', 'customers', 'employees', 'payroll'];

    it('returns all capabilities when no modules provided', () => {
      const result = filterByModules(allCaps, []);
      expect(result).toEqual(allCaps);
    });

    it('filters by sales module only', () => {
      const result = filterByModules(allCaps, ['sales']);
      expect(result).toContain('sales');
      expect(result).not.toContain('inventory');
      expect(result).not.toContain('employees');
    });

    it('filters by multiple modules', () => {
      const result = filterByModules(allCaps, ['sales', 'inventory']);
      expect(result).toContain('sales');
      expect(result).toContain('inventory');
      expect(result).not.toContain('employees');
    });

    it('returns all when no modules map to capabilities', () => {
      const result = filterByModules(allCaps, ['nonexistent']);
      expect(result).toEqual(allCaps);
    });
  });
});

describe('Industry Source Semantic Contract', () => {
  it('todaySales maps to sales capability (real SalesOrder model)', () => {
    const def = getSourceDef('todaySales');
    expect(def).not.toBeNull();
    expect(def?.capability).toBe('sales');
    expect(def?.supported).toBe(true);
  });

  it('lowStock maps to inventory capability (real Inventory model)', () => {
    const def = getSourceDef('lowStock');
    expect(def).not.toBeNull();
    expect(def?.capability).toBe('inventory');
    expect(def?.supported).toBe(true);
  });

  it('totalEmployees maps to employees capability (real Employee model)', () => {
    const def = getSourceDef('totalEmployees');
    expect(def).not.toBeNull();
    expect(def?.capability).toBe('employees');
    expect(def?.supported).toBe(true);
  });

  it('pendingLeaves maps to leaves capability (real Leave model)', () => {
    const def = getSourceDef('pendingLeaves');
    expect(def).not.toBeNull();
    expect(def?.capability).toBe('leaves');
    expect(def?.supported).toBe(true);
  });

  it('monthlyPayroll maps to payroll capability (real Payroll model)', () => {
    const def = getSourceDef('monthlyPayroll');
    expect(def).not.toBeNull();
    expect(def?.capability).toBe('payroll');
    expect(def?.supported).toBe(true);
  });
});

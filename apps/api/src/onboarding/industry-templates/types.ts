export interface IndustryTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  categories: IndustryCategory[];
  defaultModules: string[];
  estimatedUsers: number;
  estimatedMonthlyPrice: number;
}

export interface IndustryCategory {
  id: string;
  name: string;
  description: string;
}

export interface IndustryDefaults {
  fiscalYearStart: string;
  fiscalYearEnd: string;
  workingDays: string[];
  holidayCalendar: string[];
  locale: string;
  timezone: string;
  currency: string;
  numberingSequences: NumberingSequenceDef[];
  invoicePrefix: string;
  purchasePrefix: string;
  employeeIdFormat: string;
  taxDefaults: TaxDefaultDef[];
  businessSettings: Record<string, unknown>;
}

export interface NumberingSequenceDef {
  module: string;
  prefix: string;
  padLength: number;
  nextNumber: number;
}

export interface TaxDefaultDef {
  name: string;
  rate: number;
  type: 'PERCENTAGE' | 'FIXED';
  isDefault: boolean;
}

export interface ProvisioningConfig {
  departments: DepartmentDef[];
  roles: RoleDef[];
  chartOfAccounts: AccountDef[];
  inventoryCategories: InventoryCategoryDef[];
  approvalWorkflows: ApprovalWorkflowDef[];
  dashboardWidgets: DashboardWidgetDef[];
  defaults?: IndustryDefaults;
}

export interface DepartmentDef {
  name: string;
  description: string;
}

export interface RoleDef {
  name: string;
  description: string;
  permissions: string[];
}

export interface AccountDef {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  subType?: string;
}

export interface InventoryCategoryDef {
  name: string;
  description: string;
}

export interface ApprovalWorkflowDef {
  name: string;
  module: string;
  steps: string[];
}

export interface DashboardWidgetDef {
  title: string;
  type: string;
  module: string;
  size: 'sm' | 'md' | 'lg';
}

import type { IndustryTemplate, ProvisioningConfig } from './types';

export const schoolTemplate: IndustryTemplate = {
  id: 'school',
  name: 'School & Education',
  description: 'Schools, colleges, universities, coaching centers, and educational institutions',
  icon: 'school',
  color: '#f59e0b',
  categories: [
    { id: 'school-k12', name: 'K-12 School', description: 'Primary and secondary education' },
    { id: 'school-college', name: 'College', description: 'Higher education and university' },
    { id: 'school-coaching', name: 'Coaching Center', description: 'Test prep and tutoring services' },
    { id: 'school-preschool', name: 'Preschool', description: 'Early childhood education' },
  ],
  defaultModules: ['inventory', 'purchase', 'sales', 'accounting', 'crm', 'hr'],
  estimatedUsers: 15,
  estimatedMonthlyPrice: 129,
};

export const schoolProvisioning: ProvisioningConfig = {
  departments: [
    { name: 'Academic', description: 'Teaching faculty and academic administration' },
    { name: 'Admissions', description: 'Student enrollment and registration' },
    { name: 'Finance', description: 'Fee collection, accounting, and budgeting' },
    { name: 'Library', description: 'Book and resource management' },
    { name: 'Transport', description: 'School bus and transport management' },
    { name: 'Administration', description: 'General administration and HR' },
    { name: 'IT', description: 'Technology and systems management' },
  ],
  roles: [
    { name: 'Teacher', description: 'Classroom instruction', permissions: ['students:read', 'attendance:write', 'grades:write'] },
    { name: 'Accountant', description: 'Fee management and accounting', permissions: ['accounting:manage', 'students:read'] },
    { name: 'Librarian', description: 'Library management', permissions: ['inventory:read'] },
    { name: 'Admissions Officer', description: 'Student admissions', permissions: ['students:manage', 'crm:write'] },
    { name: 'Transport Manager', description: 'Transport operations', permissions: ['transport:manage'] },
  ],
  chartOfAccounts: [
    { code: '1001', name: 'Cash & Bank', type: 'ASSET', subType: 'Current Asset' },
    { code: '1002', name: 'Library Books', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '1003', name: 'School Equipment', type: 'ASSET', subType: 'Fixed Asset' },
    { code: '2001', name: 'Staff Salary Payable', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '2002', name: 'Vendor Payables', type: 'LIABILITY', subType: 'Current Liability' },
    { code: '3001', name: 'Capital Fund', type: 'EQUITY', subType: 'Equity' },
    { code: '4001', name: 'Tuition Fees', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4002', name: 'Admission Fees', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '4003', name: 'Transport Fees', type: 'REVENUE', subType: 'Operating Revenue' },
    { code: '5001', name: 'Staff Salaries', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5002', name: 'Utilities', type: 'EXPENSE', subType: 'Operating Expense' },
    { code: '5003', name: 'Educational Materials', type: 'EXPENSE', subType: 'Operating Expense' },
  ],
  inventoryCategories: [
    { name: 'Books', description: 'Textbooks, reference books, library books' },
    { name: 'Stationery', description: 'Office and classroom supplies' },
    { name: 'Lab Equipment', description: 'Science lab apparatus and chemicals' },
    { name: 'Sports Equipment', description: 'Sports gear and equipment' },
    { name: 'Furniture', description: 'Classroom and office furniture' },
  ],
  approvalWorkflows: [
    { name: 'Book Purchase', module: 'purchase', steps: ['Librarian', 'Principal', 'Finance'] },
    { name: 'Fee Waiver', module: 'sales', steps: ['Class Teacher', 'Principal'] },
    { name: 'Equipment Purchase', module: 'purchase', steps: ['Department Head', 'Administration', 'Finance'] },
  ],
  dashboardWidgets: [
    { title: 'Student Enrollment', type: 'metric', module: 'crm', size: 'sm' },
    { title: 'Fee Collection', type: 'chart', module: 'accounting', size: 'md' },
    { title: 'Attendance Overview', type: 'chart', module: 'hr', size: 'md' },
    { title: 'Library Stock', type: 'list', module: 'inventory', size: 'sm' },
  ],
};

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AccountingModule } from './accounting/accounting.module';
import { AiModule } from './ai/ai.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { SystemModule } from './system/system.module';
import { CategoriesModule } from './categories/categories.module';
import { ConfigModule } from './config/config.module';
import { CoreModule } from './core/core.module';
import { CrmModule } from './crm/crm.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { DepartmentsModule } from './departments/departments.module';
import { EmployeesModule } from './employees/employees.module';
import { InventoryModule } from './inventory/inventory.module';
import { ImportModule } from './import/import.module';
import { LeavesModule } from './leaves/leaves.module';
import { InvitationsModule } from './invitations/invitations.module';
import { MailModule } from './mail/mail.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OrganizationModule } from './organization/organization.module';
import { PayrollModule } from './payroll/payroll.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { ReportsModule } from './reports/reports.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UsersModule } from './users/users.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';
import { TenantScopeModule } from './common/tenant/tenant-scope.module';
import { THROTTLE_BUCKETS } from './common/throttle/throttle.config';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot(THROTTLE_BUCKETS),
    AccountingModule,
    AiModule,
    AuditModule,
    BillingModule,
    CrmModule,
    ConfigModule,
    CoreModule,
    PrismaModule,
    RedisModule,
    AuthModule,
    SystemModule,
    CategoriesModule,
    CustomersModule,
    DepartmentsModule,
    EmployeesModule,
    LeavesModule,
    InvitationsModule,
    MailModule,
    OnboardingModule,
    OrganizationModule,
    PayrollModule,
    PlatformAdminModule,
    DashboardModule,
    InventoryModule,
    ImportModule,
    ProductsModule,
    PurchaseModule,
    RbacModule,
    ReportsModule,
    SalesModule,
    SettingsModule,
    SuppliersModule,
    UsersModule,
    TenantScopeModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
  ],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';

import { AccountingModule } from './accounting/accounting.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { BillingModule } from './billing/billing.module';
import { SystemModule } from './system/system.module';
import { CategoriesModule } from './categories/categories.module';
import { ConfigModule } from './config/config.module';
import { CrmModule } from './crm/crm.module';
import { CustomersModule } from './customers/customers.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { InventoryModule } from './inventory/inventory.module';
import { OnboardingModule } from './onboarding/onboarding.module';
import { OrganizationModule } from './organization/organization.module';
import { PlatformAdminModule } from './platform-admin/platform-admin.module';
import { PurchaseModule } from './purchase/purchase.module';
import { PrismaModule } from './prisma/prisma.module';
import { RbacModule } from './rbac/rbac.module';
import { ProductsModule } from './products/products.module';
import { SalesModule } from './sales/sales.module';
import { SettingsModule } from './settings/settings.module';
import { SuppliersModule } from './suppliers/suppliers.module';
import { UsersModule } from './users/users.module';
import { AllExceptionsFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 10 },
      { name: 'medium', ttl: 10000, limit: 50 },
      { name: 'long', ttl: 60000, limit: 200 },
    ]),
    AccountingModule,
    AuditModule,
    BillingModule,
    CrmModule,
    ConfigModule,
    PrismaModule,
    AuthModule,
    SystemModule,
    CategoriesModule,
    CustomersModule,
    OnboardingModule,
    OrganizationModule,
    PlatformAdminModule,
    DashboardModule,
    InventoryModule,
    ProductsModule,
    PurchaseModule,
    RbacModule,
    SalesModule,
    SettingsModule,
    SuppliersModule,
    UsersModule,
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

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AccountingModule } from '../accounting/accounting.module';
import { RbacModule } from '../rbac/rbac.module';
import { AuditModule } from '../audit/audit.module';
import { InvoicesModule } from '../invoices/invoices.module';

import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';

@Module({
  imports: [PrismaModule, AccountingModule, RbacModule, AuditModule, InvoicesModule],
  controllers: [SalesController],
  providers: [SalesService],
  exports: [SalesService],
})
export class SalesModule {}

import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';
import { RbacModule } from '../rbac/rbac.module';
import { MailModule } from '../mail/mail.module';
import { AccountingModule } from '../accounting/accounting.module';

import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [PrismaModule, AuditModule, RbacModule, MailModule, AccountingModule],
  controllers: [InvoicesController],
  providers: [InvoicesService],
  exports: [InvoicesService],
})
export class InvoicesModule {}

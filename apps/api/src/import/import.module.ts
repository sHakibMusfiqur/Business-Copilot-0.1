import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { ImportController } from './import.controller';
import { ImportService } from './import.service';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [ImportController],
  providers: [ImportService],
  exports: [ImportService],
})
export class ImportModule {}

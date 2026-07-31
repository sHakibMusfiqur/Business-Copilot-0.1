import { Module, OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ensureUploadDirs } from './file-upload.config';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements OnModuleInit {
  onModuleInit(): void {
    ensureUploadDirs();
  }
}

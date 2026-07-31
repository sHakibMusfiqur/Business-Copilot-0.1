import { Module, OnModuleInit } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';

import { SettingsController } from './settings.controller';
import { SettingsService } from './settings.service';
import { ensureUploadDirs } from './file-upload.config';

@Module({
  imports: [PrismaModule],
  controllers: [SettingsController],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule implements OnModuleInit {
  onModuleInit(): void {
    ensureUploadDirs();
  }
}

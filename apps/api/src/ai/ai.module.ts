import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { RbacModule } from '../rbac/rbac.module';

import { AiConfigService } from './ai-config.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';
import { CopilotDataService } from './data/copilot-data.service';
import { AiProvider } from './providers/ai-provider.interface';
import { OpenAiProvider } from './providers/openai.provider';

@Module({
  imports: [PrismaModule, RbacModule],
  controllers: [AiController],
  providers: [
    AiConfigService,
    CopilotDataService,
    { provide: AiProvider, useClass: OpenAiProvider },
    AiService,
  ],
  exports: [AiService],
})
export class AiModule {}
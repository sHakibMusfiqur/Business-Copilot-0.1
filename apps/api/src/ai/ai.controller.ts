import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { RbacService } from '../rbac/rbac.service';

import { AiConfigService } from './ai-config.service';
import { AiService } from './ai.service';
import { AskCopilotDto } from './dto/ask-copilot.dto';

@ApiTags('Copilot (AI)')
@Controller('ai')
@UseGuards(JwtAuthGuard, PermissionGuard)
@ApiBearerAuth('access-token')
export class AiController {
  constructor(
    private readonly aiService: AiService,
    private readonly config: AiConfigService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('status')
  @Permissions(['ai.read'])
  @ApiOkResponse({ description: 'AI provider configuration status (no secrets)' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  getStatus() {
    return this.config.status();
  }

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Permissions(['ai.read'])
  @ApiBody({ type: AskCopilotDto })
  @ApiOkResponse({ description: 'Grounded Copilot answer or explicit unavailable state' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async ask(@Body() dto: AskCopilotDto, @CurrentUser() user: CurrentUserPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    const permissions = await this.rbacService.getUserPermissions(user.id, user.organizationId);
    return this.aiService.ask(dto.query, user.organizationId, permissions, dto.maxTokens);
  }
}
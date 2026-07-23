import { Controller, Get, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Dashboard overview retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getOverview(@CurrentUser() user: CurrentUserPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return this.dashboardService.getOverview(user.organizationId, user.id);
  }
}

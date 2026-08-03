import { Controller, Get, UseGuards, HttpCode, HttpStatus, ForbiddenException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiUnauthorizedResponse, ApiForbiddenResponse } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { DashboardService } from './dashboard.service';
import { RbacService } from '../rbac/rbac.service';

@ApiTags('Dashboard')
@Controller('dashboard')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly rbacService: RbacService,
  ) {}

  @Get('overview')
  @HttpCode(HttpStatus.OK)
  @Permissions(['dashboard.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Dashboard overview retrieved successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async getOverview(@CurrentUser() user: CurrentUserPayload) {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    const permissions = await this.rbacService.getUserPermissions(user.id, user.organizationId);
    return this.dashboardService.getOverview(user.organizationId, user.id, permissions);
  }
}

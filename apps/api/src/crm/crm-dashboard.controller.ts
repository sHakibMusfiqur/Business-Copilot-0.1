import {
  Controller,
  Get,
  Query,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { WorkspaceAccessEnforcer } from '../core/workspace-access-enforcer';
import { WorkspaceRuntimeAccessService } from '../rbac/workspace-runtime-access.service';

import { CrmDashboardService } from './crm-dashboard.service';

import type { QueryCrmReportsDto } from './dto/query-crm-reports.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CrmDashboardController {
  constructor(
    private readonly dashboardService: CrmDashboardService,
    private readonly workspaceAccess: WorkspaceRuntimeAccessService,
    private readonly enforcer: WorkspaceAccessEnforcer,
  ) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  private async requireCrmAccess(user: CurrentUserPayload): Promise<void> {
    const workspace = await this.workspaceAccess.resolveForUser(user);
    this.enforcer.requireModule(workspace, 'crm');
  }

  @Get('dashboard')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'CRM dashboard KPIs, funnel and revenue trend' })
  async getDashboard(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryCrmReportsDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.dashboardService.getDashboard(orgId, query);
  }

  @Get('reports')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.reports'])
  @ApiOperation({ summary: 'CRM reports: funnel, revenue trend, leaderboard and targets' })
  async getReports(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryCrmReportsDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.dashboardService.getReports(orgId, query);
  }
}

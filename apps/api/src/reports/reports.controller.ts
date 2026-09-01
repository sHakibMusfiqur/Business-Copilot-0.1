import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { ReportsService } from './reports.service';

@ApiTags('Reports')
@Controller('reports')
@UseGuards(JwtAuthGuard)
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get('overview')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get reports overview (sales, purchases, employees)' })
  @ApiOkResponse({ description: 'Reports overview' })
  async getOverview(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getDashboardOverview(orgId);
  }

  @Get('sales')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read', 'reports.finance'], 'OR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get sales report summary' })
  @ApiOkResponse({ description: 'Sales summary' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  async getSalesSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getSalesSummary(orgId, { startDate, endDate });
  }

  @Get('purchases')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read', 'reports.finance'], 'OR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get purchase report summary' })
  @ApiOkResponse({ description: 'Purchase summary' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  async getPurchaseSummary(
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getPurchaseSummary(orgId, { startDate, endDate });
  }

  @Get('inventory')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read', 'inventory.read'], 'OR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get inventory report summary' })
  @ApiOkResponse({ description: 'Inventory summary' })
  async getInventorySummary(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getInventorySummary(orgId);
  }

  @Get('accounting')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read', 'reports.finance'], 'OR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get accounting report summary' })
  @ApiOkResponse({ description: 'Accounting summary' })
  async getAccountingSummary(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getAccountingSummary(orgId);
  }

  @Get('employees')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.read', 'employees.read'], 'OR')
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Get employee report summary' })
  @ApiOkResponse({ description: 'Employee summary' })
  async getEmployeeSummary(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.reportsService.getEmployeeSummary(orgId);
  }
}

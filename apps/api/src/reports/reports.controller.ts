import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
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

  private toCsv(headers: string[], rows: (string | number)[][]): string {
    const escape = (val: string | number) => `"${String(val).replace(/"/g, '""')}"`;
    const lines = [headers.map(escape).join(',')];
    for (const row of rows) {
      lines.push(row.map(escape).join(','));
    }
    return lines.join('\n');
  }

  @Get('sales/export')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.export'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export sales report as CSV' })
  @ApiOkResponse({ description: 'CSV file' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  async exportSalesCsv(
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() response?: Response,
  ) {
    const orgId = this.requireOrg(user);
    const data = await this.reportsService.getSalesSummary(orgId, { startDate, endDate });
    const csv = this.toCsv(
      ['Status', 'Count', 'Total'],
      data.byStatus.map((s) => [s.status, s.count, s.total]),
    );
    const filename = `sales-report-${new Date().toISOString().split('T')[0]}.csv`;
    response?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response?.send(csv);
  }

  @Get('purchases/export')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.export'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export purchases report as CSV' })
  @ApiOkResponse({ description: 'CSV file' })
  @ApiQuery({ name: 'startDate', required: false, description: 'Start date (ISO 8601)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'End date (ISO 8601)' })
  async exportPurchasesCsv(
    @CurrentUser() user: CurrentUserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Res() response?: Response,
  ) {
    const orgId = this.requireOrg(user);
    const data = await this.reportsService.getPurchaseSummary(orgId, { startDate, endDate });
    const csv = this.toCsv(
      ['Status', 'Count', 'Total'],
      data.byStatus.map((s) => [s.status, s.count, s.total]),
    );
    const filename = `purchases-report-${new Date().toISOString().split('T')[0]}.csv`;
    response?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response?.send(csv);
  }

  @Get('inventory/export')
  @UseGuards(PermissionGuard)
  @Permissions(['reports.export'])
  @ApiBearerAuth('access-token')
  @ApiOperation({ summary: 'Export inventory report as CSV' })
  @ApiOkResponse({ description: 'CSV file' })
  async exportInventoryCsv(
    @CurrentUser() user: CurrentUserPayload,
    @Res() response?: Response,
  ) {
    const orgId = this.requireOrg(user);
    const data = await this.reportsService.getInventorySummary(orgId);
    const csv = this.toCsv(
      ['Total Products', 'Total Inventory Items', 'Total Quantity'],
      [[data.totalProducts, data.totalInventoryItems, data.totalQuantity]],
    );
    const filename = `inventory-report-${new Date().toISOString().split('T')[0]}.csv`;
    response?.setHeader('Content-Type', 'text/csv; charset=utf-8');
    response?.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    response?.send(csv);
  }
}

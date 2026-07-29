import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuditService } from '../audit/audit.service';

import { PlatformAdminService } from './platform-admin.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { DeleteOrganizationDto } from './dto/delete-organization.dto';
import { RestoreOrganizationDto } from './dto/restore-organization.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { UpdateSystemSettingV2Dto } from './dto/update-system-setting-v2.dto';

@ApiTags('Platform Admin')
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('SUPER_ADMIN')
@ApiBearerAuth('access-token')
export class PlatformAdminController {
  private readonly logger = new Logger(PlatformAdminController.name);

  constructor(
    private readonly adminService: PlatformAdminService,
    private readonly auditService: AuditService,
  ) {}

  @Throttle({ default: { limit: 120, ttl: 60000 } })
  @Get('dashboard')
  @ApiOkResponse({ description: 'Platform admin dashboard data' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('organizations')
  @ApiOkResponse({ description: 'List all organizations' })
  async listOrganizations(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.adminService.listOrganizations(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
      status,
      includeDeleted === 'true',
    );
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('organizations/:id')
  @ApiOkResponse({ description: 'Organization details' })
  async getOrganization(
    @Param('id') id: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.adminService.getOrganization(id, includeDeleted === 'true');
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('organizations')
  @ApiOkResponse({ description: 'Create organization' })
  async createOrganization(
    @Body() dto: CreateOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.createOrganization(dto);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.CREATE_ORGANIZATION',
      entity: 'Organization',
      entityId: result.id,
    });
    return result;
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Patch('organizations/:id')
  @ApiOkResponse({ description: 'Update organization' })
  async updateOrganization(
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.updateOrganization(id, dto);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.UPDATE_ORGANIZATION',
      entity: 'Organization',
      entityId: id,
    });
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('organizations/:id/suspend')
  @ApiOkResponse({ description: 'Suspend organization' })
  async suspendOrganization(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.suspendOrganization(id);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.SUSPEND_ORGANIZATION',
      entity: 'Organization',
      entityId: id,
    });
    this.logger.warn(`Organization ${id} suspended by ${user.id}`);
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Patch('organizations/:id/activate')
  @ApiOkResponse({ description: 'Activate organization' })
  async activateOrganization(
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.activateOrganization(id);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.ACTIVATE_ORGANIZATION',
      entity: 'Organization',
      entityId: id,
    });
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Delete('organizations/:id')
  @ApiOkResponse({ description: 'Soft delete organization' })
  async deleteOrganization(
    @Param('id') id: string,
    @Body() dto: DeleteOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.deleteOrganization(id, user.id, dto.reason);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.DELETE_ORGANIZATION',
      entity: 'Organization',
      entityId: id,
      metadata: { reason: dto.reason ?? null, deletedBy: user.id },
    });
    this.logger.warn(`Organization ${id} soft-deleted by ${user.id} reason=${dto.reason ?? 'none'}`);
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch('organizations/:id/restore')
  @ApiOkResponse({ description: 'Restore soft-deleted organization' })
  async restoreOrganization(
    @Param('id') id: string,
    @Body() dto: RestoreOrganizationDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.restoreOrganization(id, dto.reason);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.RESTORE_ORGANIZATION',
      entity: 'Organization',
      entityId: id,
      metadata: { reason: dto.reason ?? null, restoredBy: user.id },
    });
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Patch('organizations/:id/transfer')
  @ApiOkResponse({ description: 'Transfer organization ownership' })
  async transferOwnership(
    @Param('id') id: string,
    @Body() dto: TransferOwnershipDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.transferOwnership(id, dto);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.TRANSFER_OWNERSHIP',
      entity: 'Organization',
      entityId: id,
    });
    this.logger.warn(`Organization ${id} ownership transferred to ${dto.newOwnerUserId} by ${user.id}`);
    return result;
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('organizations/:id/statistics')
  @ApiOkResponse({ description: 'Organization statistics' })
  async getOrganizationStatistics(@Param('id') id: string) {
    return this.adminService.getOrganizationStatistics(id);
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('users')
  @ApiOkResponse({ description: 'List all platform users' })
  async listUsers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('organizationId') orgId?: string,
    @Query('role') role?: string,
  ) {
    return this.adminService.listUsers(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
      search,
      orgId,
      role,
    );
  }

  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @Get('audit')
  @ApiOkResponse({ description: 'Platform-wide audit logs' })
  async getAuditLogs(@Query() query: AdminAuditQueryDto) {
    return this.auditService.findAll(
      {
        page: query.page,
        limit: query.limit,
        search: query.search,
        action: query.action,
        entity: query.entity,
        userId: query.userId,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      },
      undefined,
      true,
    );
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('audit/actions')
  @ApiOkResponse({ description: 'Distinct audit actions' })
  async getAuditActions() {
    return this.auditService.getDistinctActions(undefined, true);
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Get('settings')
  @ApiOkResponse({ description: 'System settings' })
  async getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Throttle({ default: { limit: 20, ttl: 60000 } })
  @Patch('settings')
  @ApiOkResponse({ description: 'Update system setting with history' })
  async updateSystemSetting(
    @Body() dto: UpdateSystemSettingV2Dto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.updateSystemSettings(dto.key, dto.value, user.id, dto.reason);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.UPDATE_SETTINGS',
      entity: 'SystemSettings',
      entityId: dto.key,
      metadata: { reason: dto.reason ?? null },
    });
    return result;
  }

  @Throttle({ default: { limit: 30, ttl: 60000 } })
  @Get('settings/:key/history')
  @ApiOkResponse({ description: 'Setting version history' })
  async getSettingHistory(@Param('key') key: string) {
    return this.adminService.getSettingHistory(key);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('settings/:key/rollback')
  @ApiOkResponse({ description: 'Rollback setting to a previous version' })
  async rollbackSetting(
    @Param('key') key: string,
    @Body('version') version: number,
    @Body('reason') reason: string | undefined,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.rollbackSetting(key, version, user.id, reason);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.ROLLBACK_SETTINGS',
      entity: 'SystemSettings',
      entityId: key,
      metadata: { targetVersion: version, reason: reason ?? null },
    });
    this.logger.warn(`Setting ${key} rolled back to v${version} by ${user.id}`);
    return result;
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Get('plans')
  @ApiOkResponse({ description: 'Subscription plans' })
  async getPlans() {
    return this.adminService.getSubscriptionPlans();
  }
}

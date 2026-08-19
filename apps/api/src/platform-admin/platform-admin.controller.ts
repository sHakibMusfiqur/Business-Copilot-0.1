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
import { THROTTLE } from '../common/throttle/throttle.config';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { ParseSettingsKeyPipe } from '../common/pipes/parse-settings-key.pipe';

import { PlatformAdminService } from './platform-admin.service';
import { AdminAuditQueryDto } from './dto/admin-audit-query.dto';
import { AdminListOrganizationsQueryDto } from './dto/admin-list-organizations-query.dto';
import { AdminListUsersQueryDto } from './dto/admin-list-users-query.dto';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { DeleteOrganizationDto } from './dto/delete-organization.dto';
import { RestoreOrganizationDto } from './dto/restore-organization.dto';
import { RollbackSettingDto } from './dto/rollback-setting.dto';
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

  @Throttle({ default: THROTTLE.loose })
  @Get('dashboard')
  @ApiOkResponse({ description: 'Platform admin dashboard data' })
  async getDashboard() {
    return this.adminService.getDashboard();
  }

  @Throttle({ default: THROTTLE.public })
  @Get('organizations')
  @ApiOkResponse({ description: 'List all organizations' })
  async listOrganizations(@Query() query: AdminListOrganizationsQueryDto) {
    return this.adminService.listOrganizations(
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
      query.status,
      query.includeDeleted ?? false,
    );
  }

  @Throttle({ default: THROTTLE.public })
  @Get('organizations/:id')
  @ApiOkResponse({ description: 'Organization details' })
  async getOrganization(
    @Param('id', ParseCuidPipe) id: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    return this.adminService.getOrganization(id, includeDeleted === 'true');
  }

  @Throttle({ default: THROTTLE.strict })
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

  @Throttle({ default: THROTTLE.standard })
  @Patch('organizations/:id')
  @ApiOkResponse({ description: 'Update organization' })
  async updateOrganization(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.strict })
  @Patch('organizations/:id/suspend')
  @ApiOkResponse({ description: 'Suspend organization' })
  async suspendOrganization(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.strict })
  @Patch('organizations/:id/activate')
  @ApiOkResponse({ description: 'Activate organization' })
  async activateOrganization(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.veryStrict })
  @Delete('organizations/:id')
  @ApiOkResponse({ description: 'Soft delete organization' })
  async deleteOrganization(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.veryStrict })
  @Patch('organizations/:id/restore')
  @ApiOkResponse({ description: 'Restore soft-deleted organization' })
  async restoreOrganization(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.veryStrict })
  @Patch('organizations/:id/transfer')
  @ApiOkResponse({ description: 'Transfer organization ownership' })
  async transferOwnership(
    @Param('id', ParseCuidPipe) id: string,
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

  @Throttle({ default: THROTTLE.standard })
  @Get('organizations/:id/statistics')
  @ApiOkResponse({ description: 'Organization statistics' })
  async getOrganizationStatistics(@Param('id', ParseCuidPipe) id: string) {
    return this.adminService.getOrganizationStatistics(id);
  }

  @Throttle({ default: THROTTLE.public })
  @Get('users')
  @ApiOkResponse({ description: 'List all platform users' })
  async listUsers(@Query() query: AdminListUsersQueryDto) {
    return this.adminService.listUsers(
      query.page ?? 1,
      query.limit ?? 20,
      query.search,
      query.organizationId,
      query.role,
    );
  }

  @Throttle({ default: THROTTLE.public })
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

  @Throttle({ default: THROTTLE.standard })
  @Get('audit/actions')
  @ApiOkResponse({ description: 'Distinct audit actions' })
  async getAuditActions() {
    return this.auditService.getDistinctActions(undefined, true);
  }

  @Throttle({ default: THROTTLE.moderate })
  @Get('settings')
  @ApiOkResponse({ description: 'System settings' })
  async getSystemSettings() {
    return this.adminService.getSystemSettings();
  }

  @Throttle({ default: THROTTLE.moderate })
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

  @Throttle({ default: THROTTLE.standard })
  @Get('settings/:key/history')
  @ApiOkResponse({ description: 'Setting version history' })
  async getSettingHistory(@Param('key', ParseSettingsKeyPipe) key: string) {
    return this.adminService.getSettingHistory(key);
  }

  @Throttle({ default: THROTTLE.strict })
  @Post('settings/:key/rollback')
  @ApiOkResponse({ description: 'Rollback setting to a previous version' })
  async rollbackSetting(
    @Param('key', ParseSettingsKeyPipe) key: string,
    @Body() dto: RollbackSettingDto,
    @CurrentUser() user: CurrentUserPayload,
  ) {
    const result = await this.adminService.rollbackSetting(key, dto.version, user.id, dto.reason);
    this.auditService.record({
      userId: user.id,
      action: 'PLATFORM.ROLLBACK_SETTINGS',
      entity: 'SystemSettings',
      entityId: key,
      metadata: { targetVersion: dto.version, reason: dto.reason ?? null },
    });
    this.logger.warn(`Setting ${key} rolled back to v${dto.version} by ${user.id}`);
    return result;
  }

  @Throttle({ default: THROTTLE.strict })
  @Get('plans')
  @ApiOkResponse({ description: 'Subscription plans' })
  async getPlans() {
    return this.adminService.getSubscriptionPlans();
  }
}

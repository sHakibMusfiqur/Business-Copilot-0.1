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
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { WorkspaceAccessEnforcer } from '../core/workspace-access-enforcer';
import { WorkspaceRuntimeAccessService } from '../rbac/workspace-runtime-access.service';

import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';

import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { QueryLeadDto } from './dto/query-lead.dto';
import type { CreateActivityDto } from './dto/create-activity.dto';
import type { UpdateActivityDto } from './dto/update-activity.dto';
import type { QueryActivityDto } from './dto/query-activity.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly activityService: ActivityService,
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

  @Get('summary')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read', 'crm.activities'])
  @ApiOperation({ summary: 'Get CRM summary' })
  async getSummary(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.getSummary(orgId);
  }

  @Get('leads')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List all leads' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryLeadDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.findAll(orgId, query);
  }

  @Get('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get lead by ID' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.findById(orgId, id);
  }

  @Post('leads')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a new lead' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeadDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.create(orgId, user.id, dto);
  }

  @Patch('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a lead' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.update(orgId, user.id, id, dto);
  }

  @Patch('leads/:id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update lead status' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body('status') status: LeadStatus,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.updateStatus(orgId, user.id, id, status);
  }

  @Patch('leads/:id/assign')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Assign lead to user' })
  async assignUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body('assignedToId') assignedToId: string | null,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.assignUser(orgId, user.id, id, assignedToId ?? null);
  }

  @Delete('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a lead' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.softDelete(orgId, user.id, id);
  }

  @Get('leads/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get lead timeline' })
  async getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.leadService.getTimeline(orgId, id);
  }

  @Get('activities')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List all activities in the organization' })
  async findAllActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryActivityDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.findAll(orgId, query);
  }

  @Get('activities/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get activity by ID' })
  async findActivityById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.findById(orgId, id);
  }

  @Get('leads/:id/activities')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get lead activities' })
  async getActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Query() query: QueryActivityDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.findByLead(orgId, id, query);
  }

  @Post('leads/:id/activities')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create activity for lead' })
  async createActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: CreateActivityDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.create(orgId, user.id, id, dto);
  }

  @Patch('activities/:id/toggle')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Toggle activity completion' })
  async toggleActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.toggleComplete(orgId, user.id, id);
  }

  @Patch('activities/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update an activity' })
  async updateActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
    @Body() dto: UpdateActivityDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.update(orgId, user.id, id, dto);
  }

  @Delete('activities/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Delete an activity' })
  async deleteActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') id: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.activityService.delete(orgId, user.id, id);
  }
}

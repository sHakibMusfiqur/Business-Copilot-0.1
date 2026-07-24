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
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { LeadStatus } from '@prisma/client';

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';

import { LeadService } from './lead.service';
import { ActivityService } from './activity.service';

import type { CreateLeadDto } from './dto/create-lead.dto';
import type { UpdateLeadDto } from './dto/update-lead.dto';
import type { QueryLeadDto } from './dto/query-lead.dto';
import type { CreateActivityDto } from './dto/create-activity.dto';
import type { QueryActivityDto } from './dto/query-activity.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class LeadController {
  constructor(
    private readonly leadService: LeadService,
    private readonly activityService: ActivityService,
  ) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get('summary')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read', 'crm.activities'])
  @ApiOperation({ summary: 'Get CRM summary' })
  async getSummary(@CurrentUser() user: CurrentUserPayload) {
    return this.leadService.getSummary(this.requireOrg(user));
  }

  @Get('leads')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List all leads' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryLeadDto) {
    return this.leadService.findAll(this.requireOrg(user), query);
  }

  @Get('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get lead by ID' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadService.findById(this.requireOrg(user), id);
  }

  @Post('leads')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a new lead' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadService.create(this.requireOrg(user), user.id, dto);
  }

  @Patch('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a lead' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadService.update(this.requireOrg(user), user.id, id, dto);
  }

  @Patch('leads/:id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update lead status' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status') status: LeadStatus,
  ) {
    return this.leadService.updateStatus(this.requireOrg(user), user.id, id, status);
  }

  @Patch('leads/:id/assign')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Assign lead to user' })
  async assignUser(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body('assignedToId') assignedToId: string | null,
  ) {
    return this.leadService.assignUser(this.requireOrg(user), user.id, id, assignedToId ?? null);
  }

  @Delete('leads/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a lead' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadService.softDelete(this.requireOrg(user), user.id, id);
  }

  @Get('leads/:id/timeline')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get lead timeline' })
  async getTimeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.leadService.getTimeline(this.requireOrg(user), id);
  }

  @Get('leads/:id/activities')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read', 'crm.activities'])
  @ApiOperation({ summary: 'Get lead activities' })
  async getActivities(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryActivityDto,
  ) {
    return this.activityService.findByLead(this.requireOrg(user), id, query);
  }

  @Post('leads/:id/activities')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.activities'])
  @ApiOperation({ summary: 'Create activity for lead' })
  async createActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateActivityDto,
  ) {
    return this.activityService.create(this.requireOrg(user), user.id, id, dto);
  }

  @Patch('activities/:id/toggle')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.activities'])
  @ApiOperation({ summary: 'Toggle activity completion' })
  async toggleActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.activityService.toggleComplete(this.requireOrg(user), user.id, id);
  }

  @Delete('activities/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.activities'])
  @ApiOperation({ summary: 'Delete an activity' })
  async deleteActivity(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.activityService.delete(this.requireOrg(user), user.id, id);
  }
}

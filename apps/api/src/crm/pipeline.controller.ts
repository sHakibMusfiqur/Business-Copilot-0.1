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

import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';
import { CurrentUser, type CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { WorkspaceAccessEnforcer } from '../core/workspace-access-enforcer';
import { WorkspaceRuntimeAccessService } from '../rbac/workspace-runtime-access.service';

import { PipelineService } from './pipeline.service';

import type { CreatePipelineDto } from './dto/create-pipeline.dto';
import type { UpdatePipelineDto } from './dto/update-pipeline.dto';
import type { QueryPipelinesDto } from './dto/query-pipelines.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class PipelineController {
  constructor(
    private readonly pipelineService: PipelineService,
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

  @Get('pipelines')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List pipelines for the organization' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryPipelinesDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineService.findAll(orgId, query);
  }

  @Get('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get pipeline by ID' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineService.findById(orgId, id);
  }

  @Post('pipelines')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a new pipeline' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreatePipelineDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineService.create(orgId, user.id, dto);
  }

  @Patch('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a pipeline' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePipelineDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineService.update(orgId, user.id, id, dto);
  }

  @Delete('pipelines/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a pipeline' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineService.softDelete(orgId, user.id, id);
  }
}
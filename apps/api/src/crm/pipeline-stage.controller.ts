import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
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

import { PipelineStageService } from './pipeline-stage.service';

import type { CreatePipelineStageDto } from './dto/create-pipeline-stage.dto';
import type { UpdatePipelineStageDto } from './dto/update-pipeline-stage.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class PipelineStageController {
  constructor(
    private readonly pipelineStageService: PipelineStageService,
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

  @Get('pipelines/:pipelineId/stages')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List stages for a pipeline' })
  async findByPipeline(
    @CurrentUser() user: CurrentUserPayload,
    @Param('pipelineId', ParseCuidPipe) pipelineId: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineStageService.findByPipeline(orgId, pipelineId);
  }

  @Get('stages/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get stage by ID' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineStageService.findById(orgId, id);
  }

  @Post('pipelines/:pipelineId/stages')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a stage in a pipeline' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Param('pipelineId', ParseCuidPipe) pipelineId: string,
    @Body() dto: CreatePipelineStageDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineStageService.create(orgId, user.id, pipelineId, dto);
  }

  @Patch('stages/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a stage' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdatePipelineStageDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineStageService.update(orgId, user.id, id, dto);
  }

  @Delete('stages/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a stage' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.pipelineStageService.softDelete(orgId, user.id, id);
  }
}
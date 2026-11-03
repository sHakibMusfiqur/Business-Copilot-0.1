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

import { SalesTargetService } from './sales-target.service';

import type { CreateSalesTargetDto } from './dto/create-sales-target.dto';
import type { UpdateSalesTargetDto } from './dto/update-sales-target.dto';
import type { QuerySalesTargetsDto } from './dto/query-sales-targets.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class SalesTargetController {
  constructor(
    private readonly salesTargetService: SalesTargetService,
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

  @Get('sales-targets')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List sales targets with achievement' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QuerySalesTargetsDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.salesTargetService.findAll(orgId, query);
  }

  @Get('sales-targets/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get sales target by ID' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.salesTargetService.findById(orgId, id);
  }

  @Post('sales-targets')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a sales target' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateSalesTargetDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.salesTargetService.create(orgId, user.id, dto);
  }

  @Patch('sales-targets/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a sales target' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateSalesTargetDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.salesTargetService.update(orgId, user.id, id, dto);
  }

  @Delete('sales-targets/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Delete a sales target' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.salesTargetService.remove(orgId, user.id, id);
  }
}

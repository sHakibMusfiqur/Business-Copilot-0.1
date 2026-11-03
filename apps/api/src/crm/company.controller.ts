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

import { CompanyService } from './company.service';

import type { CreateCompanyDto } from './dto/create-company.dto';
import type { UpdateCompanyDto } from './dto/update-company.dto';
import type { QueryCompaniesDto } from './dto/query-companies.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class CompanyController {
  constructor(
    private readonly companyService: CompanyService,
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

  @Get('companies')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List companies for the organization' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryCompaniesDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.companyService.findAll(orgId, query);
  }

  @Get('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get company by ID with related records' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.companyService.findById(orgId, id);
  }

  @Post('companies')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a new company' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateCompanyDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.companyService.create(orgId, user.id, dto);
  }

  @Patch('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a company' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateCompanyDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.companyService.update(orgId, user.id, id, dto);
  }

  @Delete('companies/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a company' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.companyService.softDelete(orgId, user.id, id);
  }
}

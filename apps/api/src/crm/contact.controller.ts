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

import { ContactService } from './contact.service';

import type { CreateContactDto } from './dto/create-contact.dto';
import type { UpdateContactDto } from './dto/update-contact.dto';
import type { QueryContactsDto } from './dto/query-contacts.dto';

@ApiTags('CRM')
@UseGuards(JwtAuthGuard)
@Controller('crm')
export class ContactController {
  constructor(
    private readonly contactService: ContactService,
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

  @Get('contacts')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'List all contacts' })
  async findAll(@CurrentUser() user: CurrentUserPayload, @Query() query: QueryContactsDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.contactService.findAll(orgId, query);
  }

  @Get('contacts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.read'])
  @ApiOperation({ summary: 'Get contact by ID' })
  async findById(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.contactService.findById(orgId, id);
  }

  @Post('contacts')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.create'])
  @ApiOperation({ summary: 'Create a new contact' })
  async create(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateContactDto) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.contactService.create(orgId, user.id, dto);
  }

  @Patch('contacts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.update'])
  @ApiOperation({ summary: 'Update a contact' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) id: string,
    @Body() dto: UpdateContactDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.contactService.update(orgId, user.id, id, dto);
  }

  @Delete('contacts/:id')
  @UseGuards(PermissionGuard)
  @Permissions(['crm.delete'])
  @ApiOperation({ summary: 'Soft delete a contact' })
  async remove(@CurrentUser() user: CurrentUserPayload, @Param('id', ParseCuidPipe) id: string) {
    const orgId = this.requireOrg(user);
    await this.requireCrmAccess(user);
    return this.contactService.softDelete(orgId, user.id, id);
  }
}
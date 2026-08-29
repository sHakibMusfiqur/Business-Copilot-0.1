import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOkResponse, ApiCreatedResponse, ApiUnauthorizedResponse, ApiForbiddenResponse, ApiNotFoundResponse } from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { ParseCuidPipe } from '../common/pipes/parse-cuid.pipe';
import { Permissions } from '../common/decorators/permissions.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';

import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { AssignPermissionsDto } from './dto/assign-permissions.dto';
import { AssignUserRolesDto } from './dto/assign-user-roles.dto';
import { DuplicateRoleDto } from './dto/duplicate-role.dto';
import { ClonePermissionsDto } from './dto/clone-permissions.dto';

@ApiTags('RBAC')
@Controller()
@UseGuards(JwtAuthGuard, PermissionGuard)
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  // ─── Permissions ───────────────────────────────────────────────

  @Get('permissions')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'All permissions retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getPermissions(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.rbacService.findAllPermissions(orgId);
  }

  @Get('permissions/grouped')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Permissions grouped by module' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getPermissionsGrouped(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.rbacService.findPermissionsGrouped(orgId);
  }

  @Get('permissions/me')
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Current user permissions retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getMyPermissions(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.rbacService.getMyPermissions(user.id, orgId);
  }

  // ─── Roles ─────────────────────────────────────────────────────

  @Get('roles')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'All roles retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  async getRoles(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.rbacService.findAllRoles(orgId);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Role created' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'User does not belong to an organization' })
  async createRole(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateRoleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.createRole(orgId, dto, user.id);
  }

  @Patch('roles/:id')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Role updated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async updateRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
    @Body() dto: UpdateRoleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.updateRole(orgId, roleId, dto, user.id);
  }

  @Delete('roles/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Role deleted' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async deleteRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
  ) {
    const orgId = this.requireOrg(user);
    await this.rbacService.deleteRole(orgId, roleId, user.id);
  }

  @Post('roles/:id/duplicate')
  @HttpCode(HttpStatus.CREATED)
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'Role duplicated' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async duplicateRole(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
    @Body() dto: DuplicateRoleDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.duplicateRole(orgId, roleId, dto, user.id);
  }

  // ─── Role Assigned Users ───────────────────────────────────────

  @Get('roles/:id/users')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Users assigned to the role retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async getRoleUsers(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.getRoleUsers(orgId, roleId);
  }

  // ─── Role Permissions ──────────────────────────────────────────

  @Get('roles/:id/permissions')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Role permissions retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async getRolePermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.getRolePermissions(orgId, roleId);
  }

  @Put('roles/:id/permissions')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Permissions assigned to role' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  async assignPermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
    @Body() dto: AssignPermissionsDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.rbacService.assignPermissions(orgId, roleId, dto, user.id);
    return { message: 'Permissions updated successfully' };
  }

  @Put('roles/:id/permissions/clone')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Permissions copied from another role' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'Role not found' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async clonePermissions(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) roleId: string,
    @Body() dto: ClonePermissionsDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.clonePermissions(orgId, roleId, dto, user.id);
  }

  // ─── User Roles ────────────────────────────────────────────────

  @Get('users/:id/roles')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'User roles retrieved' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async getUserRoles(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) userId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.rbacService.getUserRoles(orgId, userId);
  }

  @Put('users/:id/roles')
  @Permissions(['organization.manage'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Roles assigned to user' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiNotFoundResponse({ description: 'User or role not found' })
  async assignUserRoles(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id', ParseCuidPipe) userId: string,
    @Body() dto: AssignUserRolesDto,
  ) {
    const orgId = this.requireOrg(user);
    await this.rbacService.assignUserRoles(orgId, userId, dto, user.id);
    return { message: 'Roles updated successfully' };
  }

}

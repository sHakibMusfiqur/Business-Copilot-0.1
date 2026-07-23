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
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOkResponse,
  ApiCreatedResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiBadRequestResponse,
} from '@nestjs/swagger';

import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { CurrentUserPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionGuard } from '../common/guards/permission.guard';
import { Permissions } from '../common/decorators/permissions.decorator';

import { UsersService } from './users.service';
import { QueryUsersDto } from './dto/query-users.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';

@ApiTags('Users')
@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  private requireOrg(user: CurrentUserPayload): string {
    if (!user.organizationId) {
      throw new ForbiddenException('User does not belong to an organization');
    }
    return user.organizationId;
  }

  @Get()
  @UseGuards(PermissionGuard)
  @Permissions(['users.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'Paginated list of users' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAll(
    @CurrentUser() user: CurrentUserPayload,
    @Query() query: QueryUsersDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.findAll(orgId, query);
  }

  @Get('assignable')
  @UseGuards(PermissionGuard)
  @Permissions(['users.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'All assignable users in organization' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  async findAssignable(@CurrentUser() user: CurrentUserPayload) {
    const orgId = this.requireOrg(user);
    return this.usersService.findAssignable(orgId);
  }

  @Get(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['users.read'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'User details' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async findById(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.findById(orgId, userId);
  }

  @Post()
  @UseGuards(PermissionGuard)
  @Permissions(['users.create'])
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth('access-token')
  @ApiCreatedResponse({ description: 'User created successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiBadRequestResponse({ description: 'Validation failed' })
  async create(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateUserDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.create(orgId, user.id, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['users.update'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'User updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  async update(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.update(orgId, user.id, userId, dto);
  }

  @Delete(':id')
  @UseGuards(PermissionGuard)
  @Permissions(['users.delete'])
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'User deleted successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Cannot delete own account' })
  async remove(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.softDelete(orgId, user.id, userId);
  }

  @Patch(':id/status')
  @UseGuards(PermissionGuard)
  @Permissions(['users.update'])
  @ApiBearerAuth('access-token')
  @ApiOkResponse({ description: 'User status updated successfully' })
  @ApiUnauthorizedResponse({ description: 'Invalid or expired token' })
  @ApiForbiddenResponse({ description: 'Insufficient permissions' })
  @ApiNotFoundResponse({ description: 'User not found' })
  @ApiBadRequestResponse({ description: 'Cannot deactivate own account' })
  async updateStatus(
    @CurrentUser() user: CurrentUserPayload,
    @Param('id') userId: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    const orgId = this.requireOrg(user);
    return this.usersService.updateStatus(orgId, user.id, userId, dto);
  }
}
